// Toast 通知组件 — 飘右上角，3秒自动消失
import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

const icons = { success: CheckCircle2, error: XCircle, info: AlertCircle };
const colors = {
  success: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.3)", text: "#4ade80" },
  error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#f87171" },
  info: { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", text: "#a78bfa" },
};

export default function Toast({ type = "info", message, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const Icon = icons[type] || AlertCircle;
  const c = colors[type] || colors.info;

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (leaving) {
      const t = setTimeout(onClose, 300);
      return () => clearTimeout(t);
    }
  }, [leaving, onClose]);

  return (
    <div onClick={() => setLeaving(true)}
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm shadow-lg cursor-pointer transition-all duration-300 ${
        leaving ? "opacity-0 translate-x-8" : "opacity-100"
      }`}
      style={{ background: c.bg, border: `1px solid ${c.border}`, maxWidth: 360 }}>
      <Icon className="w-5 h-5 shrink-0" style={{ color: c.text }} />
      <span style={{ color: c.text }} className="flex-1">{message}</span>
      <X className="w-4 h-4 shrink-0 opacity-60 hover:opacity-100" style={{ color: c.text }} />
    </div>
  );
}
