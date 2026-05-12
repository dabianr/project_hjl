// 存证趋势图 — ECharts 折线
import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function TrendChart({ data = [] }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const chart = echarts.init(ref.current, null, { renderer: "svg" });
    chart.setOption({
      tooltip: { trigger: "axis" },
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: { type: "category", data: data.map((d) => d.date), axisLine: { lineStyle: { color: "#4b5563" } } },
      yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } },
      series: [{
        data: data.map((d) => d.count),
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#8b5cf6", width: 2 },
        itemStyle: { color: "#8b5cf6" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(139,92,246,0.3)" },
          { offset: 1, color: "rgba(139,92,246,0.02)" },
        ]) },
      }],
      backgroundColor: "transparent",
    });
    return () => chart.dispose();
  }, [data]);

  if (data.length === 0) return null;

  return <div ref={ref} className="w-full h-64 mt-6 rounded-xl" />;
}
