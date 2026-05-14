import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Shield, Activity, Database, HardDrive, PauseCircle, PlayCircle, Trash2,
  RefreshCw, Server, AlertTriangle, CheckCircle2, Loader2
} from "lucide-react";

export default function AdminPanel({ apiBase }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const auth = () => ({ headers: { "X-API-Key": localStorage.getItem("api_key") || "" } });

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(apiBase + "/admin/status", auth());
      setStatus(data);
    } catch (err) {
      setMessage({ type: "error", text: "获取状态失败，请检查 API_KEY 是否配置" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [apiBase]);

  const doAction = async (action, endpoint) => {
    setActionLoading(action);
    setMessage(null);
    try {
      const { data } = await axios.post(apiBase + endpoint, {}, auth());
      if (data.success) {
        const text = action === "pause" ? "合约已暂停" : action === "unpause" ? "合约已恢复" : "已清理 " + data.deleted_files + " 个临时文件";
        setMessage({ type: "success", text });
        fetchStatus();
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "操作失败" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#8b5cf6" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {!localStorage.getItem("api_key") && (
        <div className="max-w-md mx-auto p-4 rounded-xl text-sm text-center"
             style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
          请在浏览器开发者工具中设置 API_KEY：
          <code className="block mt-1 text-xs">localStorage.setItem("api_key", "你的密钥")</code>
          然后刷新页面
        </div>
      )}

      <h2 className="text-lg font-semibold dark:text-gray-400 text-gray-500">系统状态</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard icon={Shield} label="合约状态" value={status?.contract_paused ? "已暂停" : "运行中"}
                    color={status?.contract_paused ? "#f59e0b" : "#10b981"} />
        <StatusCard icon={Server} label="合约 Owner" value={status?.contract_owner?.slice(0, 10) + "..."} color="#8b5cf6" />
        <StatusCard icon={Database} label="链上存证数" value={status?.total_evidence_onchain} color="#06d6d6" />
        <StatusCard icon={HardDrive} label="临时文件数" value={status?.temp_upload_files} color="#f59e0b" />
      </div>

      <h2 className="text-lg font-semibold dark:text-gray-400 text-gray-500 mt-8">管理操作</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActionCard icon={status?.contract_paused ? PlayCircle : PauseCircle}
          label={status?.contract_paused ? "恢复合约" : "暂停合约"}
          desc={status?.contract_paused ? "允许用户继续上传存证" : "暂停后用户无法上传新的存证"}
          loading={actionLoading === "pause" || actionLoading === "unpause"}
          onClick={() => doAction(status?.contract_paused ? "unpause" : "pause", status?.contract_paused ? "/admin/contract/unpause" : "/admin/contract/pause")}
          color={status?.contract_paused ? "#10b981" : "#f59e0b"} />
        <ActionCard icon={Trash2} label="清理临时文件"
          desc={"删除 uploads/ 目录下的 " + (status?.temp_upload_files || 0) + " 个临时文件"}
          loading={actionLoading === "cleanup"} onClick={() => doAction("cleanup", "/admin/cleanup")} color="#ef4444" />
        <ActionCard icon={RefreshCw} label="刷新状态" desc="重新获取系统状态数据"
          loading={false} onClick={fetchStatus} color="#8b5cf6" />
      </div>

      {message && (
        <div className="max-w-md mx-auto p-4 rounded-xl text-sm text-center fade-in flex items-center gap-2 justify-center"
             style={{ background: message.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: message.type === "success" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                      color: message.type === "success" ? "#4ade80" : "#f87171" }}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="card-glow p-4 text-xs text-gray-500">
        <p><span className="text-gray-600">RPC 节点：</span>{status?.network}</p>
        <p><span className="text-gray-600">数据库记录：</span>{status?.total_logs_in_db} 条</p>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card-glow p-5 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
           style={{ background: color + "15" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-gray-500 text-xs mb-0.5">{label}</p>
        <p className="dark:text-white text-gray-900 font-semibold text-sm break-all">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, desc, loading, onClick, color }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="card-glow card-hover p-5 text-left w-full"
      style={{ opacity: loading ? 0.5 : 1 }}>
      <div className="flex items-center gap-3 mb-2">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
          : <Icon className="w-5 h-5" style={{ color }} />}
        <span className="font-medium dark:text-white text-gray-900 text-sm">{label}</span>
      </div>
      <p className="text-gray-500 text-xs">{desc}</p>
    </button>
  );
}
