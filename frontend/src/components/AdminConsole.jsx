import React, { useState, useEffect } from "react";
import axios from "axios";
import { Shield, Database, HardDrive, PauseCircle, PlayCircle, Trash2, RefreshCw, Server, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

function StatusCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card-glow p-5 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "15" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-gray-500 text-xs mb-0.5">{label}</p>
        <p className="dark:text-white text-gray-900 font-semibold text-sm break-all">{value ?? "\u2014"}</p>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, desc, loading, onClick, color }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="card-glow card-hover p-5 text-left w-full" style={{ opacity: loading ? 0.5 : 1 }}>
      <div className="flex items-center gap-3 mb-2">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color }} /> : <Icon className="w-5 h-5" style={{ color }} />}
        <span className="font-medium dark:text-white text-gray-900 text-sm">{label}</span>
      </div>
      <p className="text-gray-500 text-xs">{desc}</p>
    </button>
  );
}

export default function AdminConsole({ apiBase, onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const auth = () => ({ headers: { "Authorization": "Bearer " + (localStorage.getItem("admin_token") || "") } });

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(apiBase + "/admin/status", auth());
      setStatus(data);
    } catch (err) {
      setMessage({ type: "error", text: "获取状态失败" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, [apiBase]);

  const doAction = async (action, endpoint) => {
    setActionLoading(action);
    setMessage(null);
    try {
      const { data } = await axios.post(apiBase + endpoint, {}, auth());
      if (data.success) {
        setMessage({ type: "success", text: action === "pause" ? "合约已暂停" : action === "unpause" ? "合约已恢复" : "已清理 " + data.deleted_files + " 个文件" });
        fetchStatus();
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "操作失败" });
    } finally { setActionLoading(null); }
  };

  if (loading) return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#8b5cf6" }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto p-6 rounded-2xl backdrop-blur-xl fade-in"
           style={{ background: "rgba(13,13,21,0.95)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">管理控制台</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-sm font-semibold dark:text-gray-400 text-gray-500 mb-3">系统状态</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard icon={Shield} label="合约状态" value={status?.contract_paused ? "已暂停" : "运行中"} color={status?.contract_paused ? "#f59e0b" : "#10b981"} />
          <StatusCard icon={Server} label="合约 Owner" value={status?.contract_owner?.slice(0, 10) + "..."} color="#8b5cf6" />
          <StatusCard icon={Database} label="链上存证数" value={status?.total_evidence_onchain} color="#06d6d6" />
          <StatusCard icon={HardDrive} label="临时文件数" value={status?.temp_upload_files} color="#f59e0b" />
        </div>

        <h3 className="text-sm font-semibold dark:text-gray-400 text-gray-500 mt-6 mb-3">管理操作</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard icon={status?.contract_paused ? PlayCircle : PauseCircle}
            label={status?.contract_paused ? "恢复合约" : "暂停合约"}
            desc={status?.contract_paused ? "允许用户继续上传存证" : "暂停后用户无法上传新的存证"}
            loading={actionLoading === "pause" || actionLoading === "unpause"}
            onClick={() => doAction(status?.contract_paused ? "unpause" : "pause", status?.contract_paused ? "/admin/contract/unpause" : "/admin/contract/pause")}
            color={status?.contract_paused ? "#10b981" : "#f59e0b"} />
          <ActionCard icon={Trash2} label="清理临时文件"
            desc={"删除 uploads/ 目录下的 " + (status?.temp_upload_files || 0) + " 个文件"}
            loading={actionLoading === "cleanup"} onClick={() => doAction("cleanup", "/admin/cleanup")} color="#ef4444" />
          <ActionCard icon={RefreshCw} label="刷新状态" desc="重新获取系统状态数据" loading={false} onClick={fetchStatus} color="#8b5cf6" />
        </div>

        {message && (
          <div className="max-w-md mx-auto mt-4 p-3 rounded-xl text-xs text-center fade-in flex items-center gap-2 justify-center"
               style={{ background: message.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        border: message.type === "success" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                        color: message.type === "success" ? "#4ade80" : "#f87171" }}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
