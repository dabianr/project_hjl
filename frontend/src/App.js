// BlockProof 前端入口 — 主题/Toast/骨架屏
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadDropzone from "./components/UploadDropzone";
import EvidenceList from "./components/EvidenceList";
import VerifyTool from "./components/VerifyTool";
import ErrorBoundary from "./components/ErrorBoundary";
import Toast from "./components/Toast";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL = parseInt(process.env.REACT_APP_POLL_INTERVAL || "15000", 10);

export default function App() {
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState({ total_evidence_count: 0, current_block_height: 0, your_evidence_count: 0, contract_paused: false });
  const [activeTab, setActiveTab] = useState("upload");
  const [logs, setLogs] = useState([]);
  const [walletError, setWalletError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // 应用主题
  useEffect(() => {
    document.body.style.background = theme === "dark" ? "#0d0d15" : "#f5f5f5";
  }, [theme]);

  const connectWallet = useCallback(async () => {
    // 钱包非必须——有就连，没有不报错
    if (!window?.ethereum?.request) { setWalletError("未检测到钱包，上传功能不受影响。建议安装 MetaMask"); return; }
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
    window.ethereum.on("accountsChanged", (a) => setAccount(a.length > 0 ? a[0] : null));
    window.ethereum.on("disconnect", () => setAccount(null));
    return () => { window.ethereum.removeAllListeners(); };
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // 限制钱包弹窗10秒没反应就超时
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000); const { data } = await axios.get(`${API_BASE}/stats`, { params: account ? { uploader: account } : {} }); setStats(data); } catch (err) {}
    finally { setLoading(false); }
  }, [account]);

  const fetchLogs = useCallback(async () => {
    try {
      // 限制钱包弹窗10秒没反应就超时
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000); const { data } = await axios.get(`${API_BASE}/logs`, { params: { limit: 10 } }); setLogs(data.logs || []); } catch (err) {}
  }, []);

  useEffect(() => { fetchStats(); fetchLogs(); const i = setInterval(fetchStats, POLL_INTERVAL); return () => clearInterval(i); }, [fetchStats, fetchLogs]);
  const onUploadSuccess = () => { fetchStats(); fetchLogs(); addToast("success", "存证已提交到区块链"); };

  const isDark = theme === "dark";
  const bg = isDark ? "#0d0d15" : "#f5f5f5";
  const text = isDark ? "#d1d5db" : "#374151";
  const border = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  return (
    <div className={"min-h-screen transition-colors " + (isDark ? "dark" : "")} style={{ background: bg, color: text }}>
      <Navbar account={account} onConnect={connectWallet} onDisconnect={disconnectWallet} walletError={walletError} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorBoundary><Dashboard stats={stats} loading={loading} /></ErrorBoundary>
        <div className="flex gap-2 mt-10 mb-6">
          {[{ key: "upload", label: "上传存证" }, { key: "list", label: "存证列表" }, { key: "verify", label: "验证工具" }].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key ? "text-white border shadow-lg" : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
              style={activeTab === tab.key ? { background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.3)", boxShadow: "0 0 20px rgba(139,92,246,0.1)" } : {}}
            >{tab.label}</button>
          ))}
        </div>
        {activeTab === "upload" && <ErrorBoundary><UploadDropzone onSuccess={onUploadSuccess} apiBase={API_BASE} /></ErrorBoundary>}
        {activeTab === "list" && <ErrorBoundary><EvidenceList logs={logs} onRefresh={fetchLogs} apiBase={API_BASE} /></ErrorBoundary>}
        {activeTab === "verify" && <ErrorBoundary><VerifyTool apiBase={API_BASE} /></ErrorBoundary>}
      </main>
      <footer className="py-6 mt-16" style={{ borderTop: `1px solid ${border}` }}>
        <div className="max-w-7xl mx-auto px-6 text-center text-xs opacity-40">BlockProof — 区块链电子文件存证系统 | Ethereum + IPFS + SM3</div>
      </footer>
      {toasts.map((t) => (<Toast key={t.id} type={t.type} message={t.message} onClose={() => removeToast(t.id)} />))}
    </div>
  );
}
