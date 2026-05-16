import React, { useState, useEffect } from "react";
import { Shield, Key, ArrowRight, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";

export default function PortalPage({ onEnter, onOpenAdmin }) {
  const [deviceId, setDeviceId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => ((Math.random()*16)|0).toString(16));
      localStorage.setItem("device_id", id);
    }
    setDeviceId(id);
  }, []);

  const handleEnter = () => {
    if (inputValue.trim()) localStorage.setItem("device_id", inputValue.trim());
    onEnter();
  };

  const handleCopy = async () => {
    const text = deviceId || localStorage.getItem("device_id") || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleShield = () => {
    const n = clickCount + 1; setClickCount(n);
    if (n >= 3) { setClickCount(0); onOpenAdmin?.(); }
    setTimeout(() => setClickCount(0), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 50%, #0d0d15 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 60%)" }} />
      <div className="relative w-full max-w-md mx-4">
        <div className="absolute -inset-[1px] rounded-2xl pointer-events-none"
             style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), transparent, rgba(6,214,214,0.1))" }} />
        <div className="relative p-8 rounded-2xl backdrop-blur-xl text-center"
             style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 20px rgba(139,92,246,0.2)" }}>
            <Key className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">BlockProof</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>区块链电子文件存证系统</p>
          <div className="my-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

          {/* 折叠密钥 */}
          <button onClick={() => setShowKey(!showKey)}
            className="flex items-center justify-center gap-1.5 mx-auto mb-4 text-xs font-medium transition-colors"
            style={{ color: "#6b7280" }}>
            {showKey ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {showKey ? "隐藏身份密钥" : "查看身份密钥"}
          </button>

          {showKey && (
            <>
              <p className="text-xs font-medium mb-2" style={{ color: "#6b7280" }}>你的临时身份密钥</p>
              <div className="flex items-center gap-2 p-3 rounded-xl mb-4 font-mono text-sm"
                   style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="flex-1 truncate text-gray-300 text-xs">{deviceId}</span>
                <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
            </>
          )}

          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnter()}
            placeholder="粘贴已有密钥..."
            className="w-full p-3 rounded-xl text-sm text-center font-mono mb-4 outline-none transition-all placeholder-gray-600 text-gray-300"
            style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <button onClick={handleEnter}
            className="w-full py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 transition-all"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 20px rgba(139,92,246,0.2)" }}>
            进入应用 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <button onClick={handleShield}
        className="fixed bottom-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all opacity-20 hover:opacity-40"
        style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.15)" }}
        title="管理员入口（连续点击 3 次）">
        <Shield className="w-5 h-5" style={{ color: "#8b5cf6" }} />
      </button>
    </div>
  );
}
