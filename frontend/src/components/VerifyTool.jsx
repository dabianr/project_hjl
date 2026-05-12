// 验证工具 — 步骤提示动画 + 结果复制按钮 + placeholder 修复
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ShieldCheck, Search, Loader2, XCircle, CheckCircle2, Copy, Check } from "lucide-react";

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button onClick={handle} className="ml-1.5 p-0.5 rounded hover:bg-gray-800 transition-colors inline-flex align-middle"
            title="复制">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />}
    </button>
  );
}

function VerifyStep({ loading }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!loading) { setStep(1); return; }
    const t1 = setTimeout(() => setStep(2), 1500);
    const t2 = setTimeout(() => setStep(3), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  if (!loading) return null;

  const steps = [
    { label: "正在查询区块链...",    icon: "🔍" },
    { label: "正在验证哈希...",       icon: "⚙️" },
    { label: "验证完成",              icon: "✅" },
  ];

  return (
    <div className="p-4 rounded-xl space-y-2" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-sm"
             style={{ opacity: step > i ? 1 : 0.3, transition: "opacity 0.3s" }}>
          <span>{step > i ? s.icon : <Loader2 className="w-4 h-4 animate-spin" />}</span>
          <span className={step > i ? "text-gray-300" : "text-gray-500"}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

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
    <div className="space-y-6 fade-in">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="粘贴文件哈希值 (SM3 / SHA-256)..."
            className="flex-1 px-4 py-3 rounded-xl text-sm font-mono dark:text-white text-gray-900 dark:placeholder-gray-500 placeholder-gray-400 border border-gray-700 outline-none transition-all focus:border-violet-500"
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

        <VerifyStep loading={loading} />

        {error && (
          <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {result && (
          <div className={`card-glow p-6 fade-in`}
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
                  <div key={item.label} className="p-3 rounded-lg flex items-start justify-between"
                       style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 text-xs mb-1">{item.label}</p>
                      <p className="dark:text-gray-200 text-gray-700 font-mono break-all text-xs">{item.value}</p>
                    </div>
                    <CopyBtn text={item.value} />
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
