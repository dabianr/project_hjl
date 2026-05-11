import React, { useState } from "react";
import axios from "axios";
import { ShieldCheck, Search, Loader2, XCircle, CheckCircle2 } from "lucide-react";

export default function VerifyTool({ apiBase }) {
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    if (!hash.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data } = await axios.get(`${apiBase}/verify/${hash.trim()}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "验证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="粘贴文件哈希值 (SM3 / SHA-256)..."
            className="flex-1 px-4 py-3 rounded-xl text-sm font-mono text-white border border-gray-700 outline-none transition-all focus:border-violet-500"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
          <button
            onClick={handleVerify}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            验证
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className={`card-glow p-6 ${result.exists ? "" : ""}`}
               style={{ borderColor: result.exists ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)" }}>
            <div className="flex items-center gap-3 mb-4">
              {result.exists ? (
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              ) : (
                <XCircle className="w-7 h-7 text-red-400" />
              )}
              <div>
                <h3 className="text-lg font-bold" style={{ color: result.exists ? "#4ade80" : "#f87171" }}>
                  {result.exists ? "已验证 — 存证记录存在" : "未找到存证记录"}
                </h3>
                <p className="text-gray-500 text-sm">{result.message}</p>
              </div>
            </div>
            {result.evidence && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-4">
                {[
                  { label: "文件名", value: result.evidence.file_name },
                  { label: "存证人", value: result.evidence.uploader },
                  { label: "时间戳", value: new Date(result.evidence.timestamp * 1000).toLocaleString() },
                  { label: "IPFS CID", value: result.evidence.ipfs_cid },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-gray-500 text-xs mb-1">{item.label}</p>
                    <p className="text-gray-200 font-mono break-all text-xs">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
