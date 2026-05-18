// 骨架屏 — 加载占位
import React from "react";

export function CardSkeleton() {
  return (
    <div className="card-glow p-6 shimmer">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded shimmer" />
          <div className="h-6 w-32 rounded shimmer" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card-glow p-5 shimmer">
          <div className="space-y-3">
            <div className="h-4 w-48 rounded shimmer" />
            <div className="h-3 w-full rounded shimmer" />
            <div className="h-3 w-3/4 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
