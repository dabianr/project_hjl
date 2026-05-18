// 仪表盘 — 加载时骨架屏，就绪后四张统计卡片 + 趋势图
// 每张卡片不同强调色 + count-up 数字递增动画 + 错峰入场
import React, { useState, useEffect, useRef } from "react";
import TrendChart from "./TrendChart";
import { Database, Blocks, FileCheck, ShieldAlert } from "lucide-react";

const COLORS = {
  purple: { icon: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  cyan:   { icon: "#06d6d6", bg: "rgba(6,214,214,0.12)" },
  green:  { icon: "#10b981", bg: "rgba(16,185,129,0.12)" },
  orange: { icon: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

function AnimatedValue({ target }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (typeof target !== "number" || started.current) return;
    started.current = true;
    const duration = 800;
    const steps = 30;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setVal(target);
        clearInterval(timer);
      } else {
        setVal(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  if (typeof target !== "number") return <>{target}</>;
  return <span className="count-up">{val.toLocaleString()}</span>;
}

function StatCard({ icon: Icon, label, value, colorKey }) {
  const c = COLORS[colorKey] || COLORS.purple;
  return (
    <div className="card-glow card-hover p-6 flex items-start gap-4"
         style={{ background: c.bg }}>
      <div className="icon-box" style={{ background: c.bg }}>
        <Icon className="w-6 h-6" style={{ color: c.icon }} />
      </div>
      <div>
        <p className="text-gray-500 text-xs font-medium tracking-wider uppercase mb-1">{label}</p>
        <p className="text-3xl font-bold dark:text-white text-gray-900">
          <AnimatedValue target={value} />
        </p>
      </div>
    </div>
  );
}

const CARD_DATA = [
  { icon: Database,   label: "全网存证总数", key: "purple" },
  { icon: Blocks,     label: "当前区块高度", key: "cyan" },
  { icon: FileCheck,  label: "你的存证数量", key: "green" },
  { icon: ShieldAlert, label: "合约状态",    key: "orange" },
];

export default function Dashboard({ stats, loading, recentLogs, apiBase }) {
  const values = [
    stats.total_evidence_count,
    stats.current_block_height,
    stats.your_evidence_count,
    stats.contract_paused ? "已暂停" : "运行中",
  ];

  const today_count = stats.today_count ?? 0;

  return (
    <div className="fade-in">
      <h2 className="text-lg font-semibold dark:text-gray-400 text-gray-500 mb-4">数据概览</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="card-glow p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-16 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <div className="h-7 w-20 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
                  </div>
                </div>
              </div>
            ))
          : CARD_DATA.map((card, idx) => (
              <div key={card.key} className="fade-in" style={{ animationDelay: (idx * 0.1) + "s" }}>
                <StatCard icon={card.icon} label={card.label} value={values[idx]} colorKey={card.key} />
              </div>
            ))
        }
      </div>
      {!loading && <TrendChart data={stats.trend || []} apiBase={apiBase} />}
      {!loading && (
        <div className="card-glow p-4 mt-4">
          <p className="text-sm font-semibold dark:text-gray-300 text-gray-600 mb-3">
            📊 今日存证: {today_count} 次
          </p>
          <div className="space-y-2">
            {recentLogs && recentLogs.length > 0
              ? recentLogs.slice(0, 3).map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm dark:text-gray-400 text-gray-500">
                    <span>📄 {log.file_name} · {log.time_ago}</span>
                  </div>
                ))
              : <p className="text-sm dark:text-gray-500 text-gray-400">暂无记录</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}
