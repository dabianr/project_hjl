import React from "react";
import { FileText, ExternalLink } from "lucide-react";

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
        <h2 className="text-lg font-semibold text-gray-400">最近存证记录</h2>
        <button onClick={onRefresh} className="btn-secondary text-xs">刷新</button>
      </div>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="card-glow p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-medium">{log.file_name}</p>
                <p className="text-gray-600 text-xs mt-0.5">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
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
                <span className="text-gray-400 font-mono break-all">{log.file_hash}</span>
              </div>
              <div>
                <span className="text-gray-600">IPFS: </span>
                <span className="text-gray-400 font-mono break-all">{log.ipfs_cid}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-600">交易: </span>
                <span className="text-gray-400 font-mono break-all">{log.tx_hash}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
