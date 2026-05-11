// React 前端入口 — BlockProof 存证系统
// 轮询间隔可配 (REACT_APP_POLL_INTERVAL)，钱包兼容 MetaMask/Coinbase 等

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadDropzone from "./components/UploadDropzone";
import EvidenceList from "./components/EvidenceList";
import VerifyTool from "./components/VerifyTool";
import ErrorBoundary from "./components/ErrorBoundary";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL = parseInt(process.env.REACT_APP_POLL_INTERVAL || "15000", 10);

export default function App() {
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState({
    total_evidence_count: 0,
    current_block_height: 0,
    your_evidence_count: 0,
    contract_paused: false,
  });
  const [activeTab, setActiveTab] = useState("upload");
  const [logs, setLogs] = useState([]);
  const [walletError, setWalletError] = useState(null);

  // ── 钱包 ──

  const connectWallet = useCallback(async () => {
    setWalletError(null);
    if (!window.ethereum) {
      setWalletError("没有检测到钱包插件，请安装 MetaMask 或 Rabby 后刷新页面。");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) setAccount(accounts[0]);
    } catch (err) {
      if (err.code === 4001) {
        setWalletError("你点了拒绝，再点一下连接就好。");
      } else {
        setWalletError(`钱包连接失败: ${err.message}`);
      }
    }
  }, []);

  const disconnectWallet = () => setAccount(null);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      setAccount(accounts.length > 0 ? accounts[0] : null);
      setWalletError(null);
    };
    const handleDisconnect = () => {
      setAccount(null);
      setWalletError("钱包已断开，重新连接一下。");
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("disconnect", handleDisconnect);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("disconnect", handleDisconnect);
    };
  }, []);

  // ── 数据 ──

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/stats`, {
        params: account ? { uploader: account } : {},
      });
      setStats(data);
    } catch (err) { console.error("Stats error:", err); }
  }, [account]);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/logs`, { params: { limit: 10 } });
      setLogs(data.logs || []);
    } catch (err) { console.error("Logs error:", err); }
  }, []);

  useEffect(() => {
    fetchStats(); fetchLogs();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats, fetchLogs]);

  const onUploadSuccess = () => { fetchStats(); fetchLogs(); };

  // ── 渲染 ──

  return (
    <div className="min-h-screen" style={{ background: "#0d0d15" }}>
      <Navbar account={account} onConnect={connectWallet}
              onDisconnect={disconnectWallet} walletError={walletError} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorBoundary><Dashboard stats={stats} /></ErrorBoundary>
        <div className="flex gap-2 mt-10 mb-6">
          {[
            { key: "upload", label: "上传存证" },
            { key: "list", label: "存证列表" },
            { key: "verify", label: "验证工具" },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "text-white border shadow-lg"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
              style={activeTab === tab.key ? {
                background: "rgba(139,92,246,0.15)",
                borderColor: "rgba(139,92,246,0.3)",
                boxShadow: "0 0 20px rgba(139,92,246,0.1)",
              } : {}}
            >{tab.label}</button>
          ))}
        </div>
        {activeTab === "upload" && (
          <ErrorBoundary>
            <UploadDropzone onSuccess={onUploadSuccess} apiBase={API_BASE} />
          </ErrorBoundary>
        )}
        {activeTab === "list" && (
          <ErrorBoundary>
            <EvidenceList logs={logs} onRefresh={fetchLogs} apiBase={API_BASE} />
          </ErrorBoundary>
        )}
        {activeTab === "verify" && (
          <ErrorBoundary><VerifyTool apiBase={API_BASE} /></ErrorBoundary>
        )}
      </main>
      <footer className="border-t border-gray-800 py-6 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600 text-xs">
          BlockProof — 区块链电子文件存证系统 | Ethereum + IPFS + SM3
        </div>
      </footer>
    </div>
  );
}
