// 管理控制台 — 环形图/设备 Top5/时间线/热日历
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Shield, Server, Database, HardDrive, Users, FileText, PauseCircle, PlayCircle, Trash2, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// 小指标卡
function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
      <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color }} />
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-200 truncate">{value ?? "—"}</p>
    </div>
  );
}

// 环形图
function RingChart({ percent = 0, size = 130, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(percent, 100) / 100);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 absolute">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#8b5cf6" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-2xl font-bold text-white">{Math.round(percent)}%</span>
        <span className="text-xs text-gray-500">使用率</span>
      </div>
    </div>
  );
}

// 设备 Top5 水平条
function DeviceBar({ data = {}, loading }) {
  const entries = Object.entries(data);
  const maxCount = Math.max(...entries.map(([, v]) => v), 1);
  if (loading) return <p className="text-xs text-gray-600 text-center py-4">加载中...</p>;
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-3">上传设备 Top 5</p>
      <div className="space-y-2">
        {entries.map(([name, count]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-6 text-right font-mono">{count}</span>
            <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full rounded-md transition-all duration-500"
                style={{ width: `${(count / maxCount) * 100}%`, background: "linear-gradient(90deg, #8b5cf6, #06d6d6)" }} />
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[80px]">{name === "anonymous" ? "匿名" : name.slice(0, 10)}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-gray-600 text-center py-4">暂无设备数据</p>}
      </div>
    </div>
  );
}

// 相对时间
function getTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

// 活动时间线
function ActivityTimeline({ logs = [], loading }) {
  if (loading) return <p className="text-xs text-gray-600 text-center py-4">加载中...</p>;
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-3">最近存证活动</p>
      <div className="space-y-0">
        {logs.slice(0, 8).map((log, i) => (
          <div key={log.id} className="flex gap-3 pb-4 relative">
            {i < logs.length - 1 && i < 7 && (
              <div className="absolute left-[11px] top-5 bottom-0 w-px" style={{ background: "rgba(139,92,246,0.1)" }} />
            )}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 ${i === 0 ? "ring-2 ring-violet-500/30" : ""}`}
                 style={{ background: i === 0 ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)" }}>
              {i === 0
                ? <div className="w-2 h-2 rounded-full" style={{ background: "#8b5cf6" }} />
                : <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300 truncate">{log.file_name || "未知文件"}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full text-green-400 shrink-0" style={{ background: "rgba(34,197,94,0.1)" }}>已确认</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                <span>{getTimeAgo(log.created_at)}</span>
                {log.block_number && <span>· 区块 #{log.block_number}</span>}
              </div>
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="text-xs text-gray-600 text-center py-8">暂无活动记录</p>}
      </div>
    </div>
  );
}

// 热日历
function HeatCalendar({ data = [], loading }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const dayNames = ["一", "二", "三", "四", "五", "六", "日"];

  const getFullWeek = () => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const found = data.find(item => item.date === dateStr);
      result.push({ date: dateStr, count: found ? found.count : 0, day: dayNames[(d.getDay() + 6) % 7] });
    }
    return result;
  };

  const week = getFullWeek();

  if (loading) return <p className="text-xs text-gray-600 text-center py-4">加载中...</p>;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-3">近 7 天上传热度</p>
      <div className="grid grid-cols-7 gap-2">
        {dayNames.map(d => <div key={d} className="text-center text-xs text-gray-600 pb-1">{d}</div>)}
        {week.map(item => (
          <div key={item.date} className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg transition-all"
                 style={{ background: item.count === 0 ? "rgba(255,255,255,0.03)" : `rgba(139, 92, 246, ${0.15 + (item.count / maxCount) * 0.7})` }}
                 title={`${item.date}: ${item.count} 次`} />
            <span className="text-[10px] text-gray-600">{item.count || ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 主组件
export default function AdminConsole({ apiBase, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const headers = { Authorization: `Bearer ${localStorage.getItem("admin_token")}` };
      try {
        const [statusRes, dashRes, logsRes] = await Promise.all([
          axios.get(`${apiBase}/admin/status`, { headers }),
          axios.get(`${apiBase}/admin/dashboard`, { headers }),
          axios.get(`${apiBase}/logs?limit=8`, { headers }),
        ]);
        setStatus(statusRes.data);
        setDashData(dashRes.data);
        setLogs(logsRes.data.logs || []);
      } catch (err) {
        setError("加载失败: " + (err.response?.data?.detail || err.message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiBase]);

  const handleClose = () => { setClosing(true); setTimeout(onClose, 300); };

  const doAction = async (url, label) => {
    setActionLoading(label);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("admin_token")}` };
      await axios.post(url, {}, { headers });
    } catch (err) {
      setError(err.response?.data?.detail || `${label} 失败`);
    } finally {
      setActionLoading(null);
    }
  };

  const usagePercent = status?.total_evidence_onchain ? Math.min((status.total_evidence_onchain / 10000) * 100, 100) : 0;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${closing ? "opacity-0" : "opacity-100"}`}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} onClick={handleClose} />

      <div className={`relative w-full max-w-4xl mx-4 max-h-[90vh] rounded-2xl backdrop-blur-xl overflow-hidden transition-all duration-300 ${closing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
           style={{ background: "rgba(13,13,21,0.97)", border: "1px solid rgba(139,92,246,0.15)" }}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
              <Shield className="w-4 h-4" style={{ color: "#8b5cf6" }} />
            </div>
            <span className="text-base font-bold text-white">管理控制台</span>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2"
               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: "calc(90vh - 64px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8b5cf6" }} />
            </div>
          ) : (
            <>
              {/* 第一行：6 张指标卡 */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                <MiniStat icon={Shield} label="合约状态" value={status?.contract_paused ? "暂停" : "运行"}
                  color={status?.contract_paused ? "#f59e0b" : "#10b981"} />
                <MiniStat icon={Server} label="Owner" value={status?.contract_owner?.slice(0, 8) + "..."} color="#8b5cf6" />
                <MiniStat icon={Database} label="存证总数" value={status?.total_evidence_onchain?.toLocaleString()} color="#06d6d6" />
                <MiniStat icon={HardDrive} label="临时文件" value={status?.temp_upload_files} color="#f59e0b" />
                <MiniStat icon={Users} label="设备数" value={Object.keys(dashData?.device_stats || {}).length} color="#10b981" />
                <MiniStat icon={FileText} label="DB 记录" value={status?.total_logs_in_db} color="#6b7280" />
              </div>

              {/* 第二行：环形图 + 设备 Top5 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl flex items-center justify-center"
                     style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <RingChart percent={usagePercent} />
                </div>
                <div className="p-5 rounded-xl"
                     style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <DeviceBar data={dashData?.device_stats || {}} loading={loading} />
                </div>
              </div>

              {/* 第三行：时间线 + 热日历 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl"
                     style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <ActivityTimeline logs={logs} loading={loading} />
                </div>
                <div className="p-5 rounded-xl flex items-center justify-center"
                     style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <HeatCalendar data={dashData?.heatmap || []} loading={loading} />
                </div>
              </div>

              {/* 第四行：操作按钮 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button onClick={() => doAction(`${apiBase}/admin/contract/pause`, "暂停")} disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 text-gray-300"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  {actionLoading === "暂停" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" style={{ color: "#f59e0b" }} />}
                  暂停合约
                </button>
                <button onClick={() => doAction(`${apiBase}/admin/contract/unpause`, "恢复")} disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 text-gray-300"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {actionLoading === "恢复" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" style={{ color: "#10b981" }} />}
                  恢复合约
                </button>
                <button onClick={() => doAction(`${apiBase}/admin/cleanup`, "清理")} disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 text-gray-300"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {actionLoading === "清理" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} />}
                  清理文件
                </button>
                <button onClick={() => window.location.reload()} disabled={actionLoading}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 text-gray-300"
                  style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <RefreshCw className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                  刷新数据
                </button>
              </div>

              {/* 尾部系统信息 */}
              <div className="p-3 rounded-xl text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1"
                   style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span>RPC: {status?.network || "—"}</span>
                <span>管理员: {status?.contract_owner?.slice(0, 16) || "—"}...</span>
                <span>使用率: {Math.round(usagePercent)}%</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}