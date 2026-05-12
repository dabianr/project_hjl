// BlockProof 前端入口 — 主题/Toast/骨架屏/趋势图
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadDropzone from "./components/UploadDropzone";
import EvidenceList from "./components/EvidenceList";
import VerifyTool from "./components/VerifyTool";
import ErrorBoundary from "./components/ErrorBoundary";
import Toast from "./components/Toast";

// API 走 nginx 反代 /api → 后端 :8001，同域无跨域问题
const API_BASE = process.env.REACT_APP_API_URL || "/api";
const POLL_INTERVAL = parseInt(process.env.REACT_APP_POLL_INTERVAL || "15000", 10);

export default function App() {
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState({
    total_evidence_count: 0, current_block_height: 0,
    your_evidence_count: 0, contract_paused: false, trend: [],
  });
  const [activeTab, setActiveTab] = useState("upload");
  const [logs, setLogs] = useState([]);
  const [walletError, setWalletError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message) => {
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    document.body.style.background = theme === "dark" ? "#0d0d15" : "#f5f5f5";
  }, [theme]);

  // 钱包——非必须，有就连，没有跳过
  const connectWallet = useCallback(async () => {
    if (!window?.ethereum?.request) {
      setWalletError("未检测到钱包，上传功能不受影响。建议安装 MetaMask");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) { setAccount(accounts[0]); addToast("success", "钱包已连接"); }
    } catch (err) {
      if (err.code !== 4001) addToast("info", "跳过钱包连接，上传照常可用");
    }
  }, []);

  const disconnectWallet = () => { setAccount(null); addToast("info", "钱包已断开"); };

  useEffect(() => {
    if (!window.ethereum) return;
    const ac = (a) => setAccount(a.length > 0 ? a[0] : null);
    const dc = () => setAccount(null);
    window.ethereum.on("accountsChanged", ac);
    window.ethereum.on("disconnect", dc);
    return () => { window.ethereum.removeListener("accountsChanged", ac); window.ethereum.removeListener("disconnect", dc); };
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/stats`, {
        params: account ? { uploader: account } : {},
      });
      setStats((prev) => ({ ...prev, ...data }));
    } catch (err) {
      // 后端没起时不报错
    } finally {
      setLoading(false);
    }
  }, [account]);

  const fetchTrend = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/trend`, { params: { days: 7 } });
      setStats((prev) => ({ ...prev, trend: data.data || [] }));
    } catch (err) {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/logs`, { params: { limit: 10 } });
      setLogs(data.logs || []);
    } catch (err) {}
  }, []);

  useEffect(() => {
    fetchStats(); fetchLogs(); fetchTrend();
    const i = setInterval(() => { fetchStats(); fetchTrend(); }, POLL_INTERVAL);
    return () => clearInterval(i);
  }, [fetchStats, fetchLogs, fetchTrend]);

  const onUploadSuccess = () => {
    fetchStats(); fetchLogs(); fetchTrend();
    addToast("success", "存证已提交到区块链");
  };

  const isDark = theme === "dark";
  const tabs = [
    { key: "upload", label: "上传存证" },
    { key: "list", label: "存证列表" },
    { key: "verify", label: "验证工具" },
  ];

  return (
    <div className={"min-h-screen transition-colors " + (isDark ? "dark" : "")}
         style={{ background: isDark ? "#0d0d15" : "#f5f5f5", color: isDark ? "#d1d5db" : "#374151" }}>
      <Navbar account={account} onConnect={connectWallet}
              onDisconnect={disconnectWallet} walletError={walletError}
              theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorBoundary><Dashboard stats={stats} loading={loading} /></ErrorBoundary>
        <div className="flex gap-2 mt-10 mb-6">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key ? "text-white border shadow-lg" : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
              style={activeTab === tab.key ? {
                background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.3)",
                boxShadow: "0 0 20px rgba(139,92,246,0.1)",
              } : {}}
            >{tab.label}</button>
          ))}
        </div>
        {activeTab === "upload" && <ErrorBoundary key="upload"><UploadDropzone onSuccess={onUploadSuccess} apiBase={API_BASE} /></ErrorBoundary>}
        {activeTab === "list" && <ErrorBoundary key="list"><EvidenceList logs={logs} onRefresh={fetchLogs} apiBase={API_BASE} /></ErrorBoundary>}
        {activeTab === "verify" && <ErrorBoundary key="verify"><VerifyTool apiBase={API_BASE} /></ErrorBoundary>}
      </main>
      <footer className="py-6 mt-16" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
        <div className="text-center text-xs opacity-40">BlockProof — 区块链电子文件存证系统 | Ethereum + IPFS + SM3</div>
      </footer>
      {toasts.map((t) => <Toast key={t.id} type={t.type} message={t.message} onClose={() => removeToast(t.id)} />)}
    </div>
  );
}
