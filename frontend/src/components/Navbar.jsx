import React from "react";
import { Shield, Wallet, LogOut } from "lucide-react";

export default function Navbar({ account, onConnect, onDisconnect }) {
  return (
    <nav className="border-b border-gray-800" style={{ background: "rgba(0,0,0,0.3)" }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
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
  );
}
