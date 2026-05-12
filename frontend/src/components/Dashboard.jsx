// 仪表盘 — 加载时骨架屏，就绪后四张统计卡片
import React from "react";
import { Database, Blocks, FileCheck, ShieldAlert } from "lucide-react";

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card-glow p-6 flex items-start gap-4">
      <div className="icon-box"><Icon className="w-6 h-6" style={{ color: "#06d6d6" }} /></div>
      <div>
        <p className="text-gray-500 text-xs font-medium tracking-wider uppercase mb-1">{label}</p>
        <p className="text-3xl font-bold dark:text-white text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}

export default function Dashboard({ stats, loading }) {
  return (
    <div>
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
          : <>
              <StatCard icon={Database} label="全网存证总数" value={stats.total_evidence_count} />
              <StatCard icon={Blocks} label="当前区块高度" value={stats.current_block_height} />
              <StatCard icon={FileCheck} label="你的存证数量" value={stats.your_evidence_count} />
              <StatCard icon={ShieldAlert} label="合约状态" value={stats.contract_paused ? "已暂停" : "运行中"} />
            </>
        }
      </div>
    </div>
  );
}
