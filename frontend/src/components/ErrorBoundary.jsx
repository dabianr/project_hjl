// 错误边界 — 子组件崩了不拖全页面下水
import React from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Component crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6 rounded-xl text-center"
               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm font-medium">该模块出错了</p>
            <p className="text-gray-600 text-xs mt-1">{this.state.error?.message || "未知错误"}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-700 hover:text-white transition-colors">
              重试
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
