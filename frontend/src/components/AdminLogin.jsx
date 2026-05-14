import React, { useState, useEffect } from "react";
import axios from "axios";
import { Shield, X, Loader2, AlertCircle } from "lucide-react";

export default function AdminLogin({ apiBase, onSuccess, onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(apiBase + "/admin/login", { username, password });
      localStorage.setItem("admin_token", data.access_token);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={"fixed inset-0 z-[90] flex items-center justify-center transition-all duration-300 " + (closing ? "opacity-0" : "opacity-100")}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={handleClose} />
      <div className={"relative w-full max-w-sm mx-4 p-8 rounded-2xl backdrop-blur-xl transition-all duration-300 " + (closing ? "scale-95 opacity-0" : "scale-100 opacity-100")}
           style={{ background: "rgba(13,13,21,0.95)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <button onClick={handleClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-800 text-gray-500">
          <X className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
             style={{ background: "rgba(139,92,246,0.15)" }}>
          <Shield className="w-6 h-6" style={{ color: "#8b5cf6" }} />
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-1">管理员登录</h2>
        <p className="text-xs text-center mb-6" style={{ color: "#6b7280" }}>管理控制台需要身份验证</p>
        <div className="space-y-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名" autoFocus
            className="w-full p-3 rounded-xl text-sm outline-none transition-all text-gray-300 placeholder-gray-600"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="密码"
            className="w-full p-3 rounded-xl text-sm outline-none transition-all text-gray-300 placeholder-gray-600"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <button onClick={handleLogin} disabled={loading}
            className="w-full py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "验证中..." : "登录"}
          </button>
          {error && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
