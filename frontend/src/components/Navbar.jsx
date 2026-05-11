// 铁子，导航栏组件
// 左边 Logo，右边钱包连接按钮
// 新增：钱包连接出错时给个提示，别再偷偷摸摸啥也不说

import React from "react";
import { Shield, Wallet, LogOut, AlertCircle } from "lucide-react";

export default function Navbar({ account, onConnect, onDisconnect, walletError }) {
  return (
    <>
      <nav
        className="border-b border-gray-800"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* 左边：Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.15)" }}
            >
              <Shield className="w-5 h-5" style={{ color: "#8b5cf6" }} />
            </div>
            <span className="text-white font-bold text-lg">BlockProof</span>
            <span className="text-gray-600 text-xs ml-1">存证系统</span>
          </div>

          {/* 右边：钱包 */}
          <div>
            {account ? (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                {account.slice(0, 6)}...{account.slice(-4)}
                <LogOut className="w-3 h-3 ml-1" />
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                }}
              >
                <Wallet className="w-4 h-4" />
                连接钱包
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 钱包报错提示——之前啥也不说属于摆烂，现在给你说明白 */}
      {walletError && !account && (
        <div
          className="max-w-7xl mx-auto px-6 mt-3"
        >
          <div
            className="flex items-center gap-3 p-3 rounded-lg text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300">{walletError}</span>
          </div>
        </div>
      )}
    </>
  );
}
