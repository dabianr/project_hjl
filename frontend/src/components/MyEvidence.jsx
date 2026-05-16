// 我的存证 — 按 device_id 过滤个人记录，完整凭证详情
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FileText, File, Image, Archive, Copy, Check } from "lucide-react";

export default function MyEvidence({ apiBase }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const deviceId = localStorage.getItem("device_id");

  const fetchMyLogs = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${apiBase}/logs`, {
        params: { limit, offset: (pageNum - 1) * limit, uploader: deviceId },
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [apiBase, deviceId]);

  useEffect(() => { fetchMyLogs(page); }, [page, fetchMyLogs]);

  // 文件类型图标
  const getIcon = (name) => {
    const ext = (name || "").split(".").pop()?.toLowerCase();
    if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext)) return Image;
    if (["pdf","doc","docx","txt","md","csv","xls","xlsx","ppt","pptx"].includes(ext)) return FileText;
    if (["zip","rar","7z","tar","gz","bz2"].includes(ext)) return Archive;
    return File;
  };

  // 复制按钮
  function CopyBtn({ text, label }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    };
    return (
      <button onClick={handle} className="ml-1 p-0.5 rounded hover:bg-gray-800 transition-colors inline-flex align-middle" title={`复制${label || ""}`}>
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />}
      </button>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const deviceLabel = deviceId ? deviceId.slice(0, 8) + "..." : "未知";

  return (
    <div className="fade-in">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold dark:text-gray-400 text-gray-500">我的存证</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            设备密钥: <span className="font-mono">{deviceLabel}</span> · 共 {total} 条记录
          </p>
        </div>
        <button onClick={() => fetchMyLogs(page)}
          className="btn-secondary text-xs px-3 py-1.5">
          刷新
        </button>
      </div>

      {/* 加载态 */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card-glow p-5 animate-pulse">
              <div className="h-4 w-48 rounded" style={{background:"rgba(255,255,255,0.06)"}} />
              <div className="h-3 w-full rounded mt-3" style={{background:"rgba(255,255,255,0.04)"}} />
              <div className="h-3 w-3/4 rounded mt-2" style={{background:"rgba(255,255,255,0.04)"}} />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        /* 空状态 */
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600">暂无存证记录</p>
          <p className="text-gray-700 text-sm mt-1">上传文件后记录将显示在此处</p>
        </div>
      ) : (
        /* 列表 */
        <div className="space-y-3">
          {logs.map((log) => {
            const Icon = getIcon(log.file_name);
            return (
              <div key={log.id} className="card-glow p-5 card-hover">
                {/* 第一行: 文件名 + 状态 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                         style={{background:"rgba(139,92,246,0.1)"}}>
                      <Icon className="w-4 h-4" style={{color:"#8b5cf6"}} />
                    </div>
                    <div>
                      <p className="dark:text-white text-gray-900 font-medium text-sm truncate">{log.file_name}</p>
                      <p className="text-gray-500 text-xs">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                        {log.block_number ? ` · 区块 #${log.block_number}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full text-green-400 shrink-0 ml-2"
                        style={{background:"rgba(34,197,94,0.1)"}}>
                    已上链
                  </span>
                </div>

                {/* 第二行: 哈希/IPFS/交易 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mt-3 pt-3"
                     style={{borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                  <div>
                    <span className="text-gray-600">SM3: </span>
                    <span className="dark:text-gray-400 text-gray-500 font-mono">{log.file_hash?.slice(0, 20)}...</span>
                    <CopyBtn text={log.file_hash} label="SM3哈希" />
                  </div>
                  <div>
                    <span className="text-gray-600">IPFS: </span>
                    <span className="dark:text-gray-400 text-gray-500 font-mono">{log.ipfs_cid?.slice(0, 16)}...</span>
                    <CopyBtn text={log.ipfs_cid} label="IPFS CID" />
                  </div>
                  <div>
                    <span className="text-gray-600">交易: </span>
                    <span className="dark:text-gray-400 text-gray-500 font-mono">{log.tx_hash?.slice(0, 16)}...</span>
                    <CopyBtn text={log.tx_hash} label="交易哈希" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-gray-500 text-xs">共 {total} 条</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-30">
              上一页
            </button>
            <span className="flex items-center text-xs text-gray-500 px-2">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-30">
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
