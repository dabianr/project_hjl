import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadDropzone from "./components/UploadDropzone";
import EvidenceList from "./components/EvidenceList";
import VerifyTool from "./components/VerifyTool";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

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

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("请先安装 MetaMask");
      return;
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
  }, []);

  const disconnectWallet = () => setAccount(null);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) =>
      setAccount(accounts.length > 0 ? accounts[0] : null);
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/stats`, {
        params: account ? { uploader: account } : {},
      });
      setStats(data);
    } catch (err) {
      console.error("Stats error:", err);
    }
  }, [account]);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/logs`, { params: { limit: 10 } });
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Logs error:", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLogs();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchLogs]);

  const onUploadSuccess = () => {
    fetchStats();
    fetchLogs();
  };

  return (
    <div className="min-h-screen" style={{ background: "#0d0d15" }}>
      <Navbar account={account} onConnect={connectWallet} onDisconnect={disconnectWallet} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard stats={stats} />
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
        {activeTab === "upload" && <UploadDropzone onSuccess={onUploadSuccess} apiBase={API_BASE} />}
        {activeTab === "list" && <EvidenceList logs={logs} onRefresh={fetchLogs} apiBase={API_BASE} />}
        {activeTab === "verify" && <VerifyTool apiBase={API_BASE} />}
      </main>
      <footer className="border-t border-gray-800 py-6 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600 text-xs">
          BlockProof — 区块链电子文件存证系统 | Ethereum + IPFS + SM3
        </div>
      </footer>
    </div>
  );
}
