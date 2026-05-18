// 验证结果页 — 二维码扫描后跳转到这里
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, CheckCircle2, XCircle, Copy, Check } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "/api";

export default function VerifyResult({ hash, onBack }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/verify/${hash}`);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || "验证请求失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hash]);

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = hash;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d15" }}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#8b5cf6" }} />
          <p className="text-gray-400 text-sm">正在验证存证...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0d0d15" }}>
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "#ef4444" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#ef4444" }}>验证失败</h2>
          <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>{error}</p>
          <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}>返回首页</button>
        </div>
      </div>
    );
  }

  const verified = result?.exists && result?.verified;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0d0d15" }}>
      <div className="w-full max-w-lg">
        <div className="rounded-2xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${verified ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            backdropFilter: "blur(12px)",
          }}>
          <div className="mb-4">
            {verified
              ? <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: "#22c55e" }} />
              : <XCircle className="w-16 h-16 mx-auto" style={{ color: "#ef4444" }} />}
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: verified ? "#22c55e" : "#ef4444" }}>
            {verified ? "存证验证通过" : "存证未找到"}
          </h2>
          <p className="text-sm mb-6" style={{ color: "#9ca3af" }}>
            {verified ? "区块链权威认证：该文件已存证且未被篡改" : result?.message || "未找到存证记录"}
          </p>
          {verified && result.evidence && (
            <div className="rounded-xl p-4 text-left text-sm space-y-2 mb-6"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {["file_name", "ipfs_cid", "uploader", "timestamp"].map(k => (
                <div key={k} className="flex">
                  <span className="text-gray-500 w-20 flex-shrink-0">
                    {{file_name:"文件名称",ipfs_cid:"IPFS CID",uploader:"上传者",timestamp:"上链时间"}[k]}
                  </span>
                  <span className="text-gray-300 truncate">{result.evidence[k] || "—"}</span>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl p-3 text-left text-xs mb-6 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-gray-500 truncate mr-2" style={{ fontFamily: "monospace" }}>{hash}</span>
            <button onClick={copyHash} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
          <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 0 16px rgba(139,92,246,0.2)" }}>
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
