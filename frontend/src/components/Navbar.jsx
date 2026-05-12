// 导航栏 — 钱包连接 + 深色/浅色切换
import React from "react";
import { Shield, Wallet, LogOut, AlertCircle, Sun, Moon } from "lucide-react";

export default function Navbar({ account, onConnect, onDisconnect, walletError, theme, onToggleTheme }) {
  return (
    <>
      <nav className="border-b border-gray-800" style={{ background: "rgba(0,0,0,0.3)" }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
              <Shield className="w-5 h-5" style={{ color: "#8b5cf6" }} />
            </div>
            <span className="dark:text-white text-gray-900 font-bold text-lg">BlockProof</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onToggleTheme} className="p-2 rounded-lg hover:bg-gray-800 dark:text-gray-400 text-gray-500 transition-colors"
              title={theme === "dark" ? "切换浅色" : "切换深色"}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {account ? (
              <button onClick={onDisconnect} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-700 dark:text-gray-400 text-gray-500 hover:dark:text-white text-gray-900 transition-colors">
                <Wallet className="w-4 h-4" />{account.slice(0, 6)}...{account.slice(-4)}<LogOut className="w-3 h-3" />
              </button>
            ) : (
              <button onClick={onConnect} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium dark:text-white text-gray-900"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}>
                <Wallet className="w-4 h-4" />连接钱包
              </button>
            )}
          </div>
        </div>
      </nav>
      {walletError && !account && (
        <div className="max-w-7xl mx-auto px-6 mt-3">
          <div className="flex items-center gap-3 p-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle className="w-4 h-4 text-red-400" /><span className="text-red-300">{walletError}</span>
            <button onClick={() => window.open("https://chromewebstore.google.com/detail/njbggmfpkbaihmjpadknnkfhjfigpllh", "_blank")} className="ml-2 px-3 py-1 text-xs rounded-lg border border-red-500 text-red-300 hover:bg-red-500/10 transition-colors shrink-0">安装 MetaMask</button>
          </div>
        </div>
      )}
    </>
  );
}
