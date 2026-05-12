// 存证记录列表 — 复制按钮 + 相对时间 + 卡片 hover
import React, { useState } from "react";
import { FileText, Copy, Check } from "lucide-react";

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "刚刚";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(dateStr).toLocaleString();
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    // clipboard API（需要安全上下文）
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {}
    // fallback：临时 textarea + execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button onClick={handle} className="ml-1.5 p-1 rounded hover:bg-gray-800 transition-colors inline-flex align-middle"
            title="复制">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />}
    </button>
  );
}

export default function EvidenceList({ logs, onRefresh }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-600">暂无存证记录</p>
        <p className="text-gray-700 text-sm mt-1">上传文件后记录将显示在此处</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-gray-400 text-gray-500">最近存证记录</h2>
        <button onClick={onRefresh} className="btn-secondary text-xs">刷新</button>
      </div>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="card-glow card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="dark:text-white text-gray-900 font-medium">{log.file_name}</p>
                <p className="text-gray-600 text-xs mt-0.5">
                  {formatRelativeTime(log.created_at)}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full text-green-400"
                    style={{ background: "rgba(34,197,94,0.1)" }}>
                已存证
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">哈希: </span>
                <span className="dark:text-gray-400 text-gray-500 font-mono break-all">{log.file_hash}</span>
                <CopyBtn text={log.file_hash} />
              </div>
              <div>
                <span className="text-gray-600">IPFS: </span>
                <span className="dark:text-gray-400 text-gray-500 font-mono break-all">{log.ipfs_cid}</span>
                <CopyBtn text={log.ipfs_cid} />
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-600">交易: </span>
                <span className="dark:text-gray-400 text-gray-500 font-mono break-all">{log.tx_hash}</span>
                <CopyBtn text={log.tx_hash} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
