// 存证柱状图 — ECharts + 空状态占位 + 天数选择器
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as echarts from "echarts";
import { BarChart3 } from "lucide-react";

export default function TrendChart({ data = [], apiBase = "/api" }) {
  const ref = useRef();
  const [days, setDays] = useState(7);
  const [trendData, setTrendData] = useState(data);

  const fetchTrend = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/trend?days=${days}`);
      if (!res.ok) return;
      const json = await res.json();
      setTrendData(json.data || json);
    } catch {
      // silently fail
    }
  }, [days, apiBase]);

  useEffect(() => {
    if (data && data.length > 0) {
      setTrendData(data);
    } else {
      fetchTrend();
    }
  }, [data, fetchTrend]);

  useEffect(() => {
    if (!ref.current || trendData.length === 0) return;
    const chart = echarts.init(ref.current, null, { renderer: "svg" });
    chart.setOption({
      tooltip: { trigger: "axis" },
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: "category", data: trendData.map((d) => d.date),
        axisLine: { lineStyle: { color: "#4b5563" } },
        axisLabel: { color: "#9ca3af" },
      },
      yAxis: {
        type: "value", minInterval: 1,
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        axisLabel: { color: "#9ca3af" },
      },
      series: [{
        data: trendData.map((d) => d.count),
        type: "bar",
        barWidth: "40%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#a78bfa" },
            { offset: 1, color: "#8b5cf6" },
          ]),
        },
      }],
      backgroundColor: "transparent",
    });
    return () => chart.dispose();
  }, [trendData]);

  if (trendData.length === 0) {
    return (
      <div className="card-glow mt-6 h-64 flex flex-col items-center justify-center relative">
        <select
          value={days}
          onChange={(e) => { setDays(Number(e.target.value)); }}
          className="absolute top-3 right-3 text-xs px-2 py-1 rounded border-0 outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.03)", color: "#9ca3af" }}
        >
          <option value={7}>7天</option>
          <option value={30}>30天</option>
          <option value={90}>90天</option>
        </select>
        <BarChart3 className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-gray-500 text-sm">暂无趋势数据</p>
        <p className="text-gray-600 text-xs mt-1">上传文件后将显示 {days} 天存证趋势</p>
      </div>
    );
  }

  return (
    <div className="relative mt-6">
      <select
        value={days}
        onChange={(e) => { setDays(Number(e.target.value)); }}
        className="absolute top-3 right-3 z-10 text-xs px-2 py-1 rounded border-0 outline-none cursor-pointer"
        style={{ background: "rgba(255,255,255,0.03)", color: "#9ca3af" }}
      >
        <option value={7}>7天</option>
        <option value={30}>30天</option>
        <option value={90}>90天</option>
      </select>
      <div ref={ref} className="w-full h-64 rounded-xl" />
    </div>
  );
}
