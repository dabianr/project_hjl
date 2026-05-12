// 骨架屏 — 加载占位
import React from "react";

export function CardSkeleton() {
  return (
    <div className="card-glow p-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="h-6 w-32 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card-glow p-5 animate-pulse">
          <div className="space-y-3">
            <div className="h-4 w-48 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-3 w-full rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
            <div className="h-3 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
