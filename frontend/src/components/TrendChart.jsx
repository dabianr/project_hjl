// 存证柱状图 — ECharts + 空状态占位
import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { BarChart3 } from "lucide-react";

export default function TrendChart({ data = [] }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const chart = echarts.init(ref.current, null, { renderer: "svg" });
    chart.setOption({
      tooltip: { trigger: "axis" },
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: "category", data: data.map((d) => d.date),
        axisLine: { lineStyle: { color: "#4b5563" } },
        axisLabel: { color: "#9ca3af" },
      },
      yAxis: {
        type: "value", minInterval: 1,
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
        axisLabel: { color: "#9ca3af" },
      },
      series: [{
        data: data.map((d) => d.count),
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
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="card-glow mt-6 h-64 flex flex-col items-center justify-center">
        <BarChart3 className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-gray-500 text-sm">暂无趋势数据</p>
        <p className="text-gray-600 text-xs mt-1">上传文件后将显示 7 天存证趋势</p>
      </div>
    );
  }

  return <div ref={ref} className="w-full h-64 mt-6 rounded-xl" />;
}
