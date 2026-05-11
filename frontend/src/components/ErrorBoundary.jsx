// 铁子，错误边界组件
// 之前任何一个子组件崩了，整个页面白屏，属于纯纯搞心态
// 现在包一层 ErrorBoundary，崩了只显示一个错误提示，不影响别的模块
// React 16+ 自带的功能，不用白不用

import React from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // 崩了别慌，标记一下
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // 打日志，方便查 bug
    console.error("组件炸了兄弟:", error, info);
  }

  render() {
    if (this.state.hasError) {
      // 你可以自定义 fallback，默认给个提示
      return (
        this.props.fallback || (
          <div
            className="p-6 rounded-xl text-center"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm font-medium">这模块崩了</p>
            <p className="text-gray-600 text-xs mt-1">
              {this.state.error?.message || "未知错误"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500 transition-colors"
            >
              重试
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
