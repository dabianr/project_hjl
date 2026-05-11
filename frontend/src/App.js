// 铁子，这 App.js 是整个前端的指挥部
// 改了什么：
// 1. 轮询间隔可配了（环境变量 REACT_APP_POLL_INTERVAL，默认 15s）
// 2. 加了 ErrorBoundary，模块崩了不拖全页面下水
// 3. 钱包不只认 MetaMask 了，没插件的给个提示引导，不至于直接凉凉

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadDropzone from "./components/UploadDropzone";
import EvidenceList from "./components/EvidenceList";
import VerifyTool from "./components/VerifyTool";
import ErrorBoundary from "./components/ErrorBoundary";

// 后端地址，默认 localhost:8000
const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
// 轮询间隔，默认 15 秒，想改就改环境变量
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

  // ── 钱包连接 ──

  const connectWallet = useCallback(async () => {
    setWalletError(null);
    // 先看看有没有钱包插件，不一定是 MetaMask
    // ethers.js 通过 window.ethereum 兼容大部分钱包（MetaMask, Coinbase, Rabby 等等）
    if (!window.ethereum) {
      setWalletError(
        "兄弟，你没安钱包插件啊。去下一个 MetaMask 或者 Rabby，装完刷新页面再来。"
      );
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (err) {
      // 用户拒绝了或者钱包报错了
      console.error("钱包连接失败:", err);
      if (err.code === 4001) {
        setWalletError("你自己点了拒绝啊铁子，要连再点一下。");
      } else {
        setWalletError(`钱包连接出问题了: ${err.message}`);
      }
    }
  }, []);

  const disconnectWallet = () => setAccount(null);

  // 监听钱包账户切换和断开
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts.length > 0 ? accounts[0] : null);
      setWalletError(null);
    };

    const handleDisconnect = () => {
      setAccount(null);
      setWalletError("钱包断开了，重新连一下。");
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("disconnect", handleDisconnect);
    };
  }, []);

  // ── 数据获取 ──

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/stats`, {
        params: account ? { uploader: account } : {},
      });
      setStats(data);
    } catch (err) {
      console.error("拉统计失败:", err);
    }
  }, [account]);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/logs`, {
        params: { limit: 10 },
      });
      setLogs(data.logs || []);
    } catch (err) {
      console.error("拉日志失败:", err);
    }
  }, []);

  // POLL_INTERVAL 可配，不再写死 15 秒
  useEffect(() => {
    fetchStats();
    fetchLogs();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats, fetchLogs]);

  const onUploadSuccess = () => {
    fetchStats();
    fetchLogs();
  };

  // ── 渲染 ──

  return (
    <div className="min-h-screen" style={{ background: "#0d0d15" }}>
      <Navbar
        account={account}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        walletError={walletError}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ErrorBoundary 包每个模块，崩了自己扛，别拖别人下水 */}
        <ErrorBoundary>
          <Dashboard stats={stats} />
        </ErrorBoundary>

        <div className="flex gap-2 mt-10 mb-6">
          {[
            { key: "upload", label: "上传存证" },
            { key: "list", label: "存证列表" },
            { key: "verify", label: "验证工具" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "text-white border shadow-lg"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
              style={
                activeTab === tab.key
                  ? {
                      background: "rgba(139,92,246,0.15)",
                      borderColor: "rgba(139,92,246,0.3)",
                      boxShadow: "0 0 20px rgba(139,92,246,0.1)",
                    }
                  : {}
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "upload" && (
          <ErrorBoundary>
            <UploadDropzone onSuccess={onUploadSuccess} apiBase={API_BASE} />
          </ErrorBoundary>
        )}
        {activeTab === "list" && (
          <ErrorBoundary>
            <EvidenceList
              logs={logs}
              onRefresh={fetchLogs}
              apiBase={API_BASE}
            />
          </ErrorBoundary>
        )}
        {activeTab === "verify" && (
          <ErrorBoundary>
            <VerifyTool apiBase={API_BASE} />
          </ErrorBoundary>
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
