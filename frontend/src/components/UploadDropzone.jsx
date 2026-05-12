// 拖拽上传组件，支持单文件和多文件批量上传 + 文件类型图标 + 状态覆盖
import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { UploadCloud, File, FileText, Image, Archive, X, CheckCircle2, Loader2, ShieldCheck, AlertCircle, Layers, XCircle } from "lucide-react";

function getFileIcon(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase();
  if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext)) return Image;
  if (["pdf","doc","docx","txt","md","csv","xls","xlsx","ppt","pptx"].includes(ext)) return FileText;
  if (["zip","rar","7z","tar","gz","bz2"].includes(ext)) return Archive;
  return File;
}

function getIconColor(ext) {
  const e = (ext || "").toLowerCase();
  if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(e)) return "#10b981";
  if (["pdf","doc","docx","txt","md","csv","xls","xlsx","ppt","pptx"].includes(e)) return "#6366f1";
  if (["zip","rar","7z","tar","gz","bz2"].includes(e)) return "#f59e0b";
  return "#06d6d6";
}

function getExt(filename) {
  return (filename || "").split(".").pop() || "";
}

export default function UploadDropzone({ onSuccess, apiBase }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  // 每个文件的上传状态: null / "success" / "error"
  const [fileStatus, setFileStatus] = useState({});

  const onDrop = useCallback((accepted) => {
    setFiles(accepted.map((f) => Object.assign(f, { id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })));
    setSingleResult(null);
    setBatchResult(null);
    setError(null);
    setProgress(0);
    setFileStatus({});
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 20,
    multiple: true,
  });

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSingleResult(null);
    setBatchResult(null);
    setError(null);
  };

  const clearAll = () => {
    setFiles([]);
    setSingleResult(null);
    setBatchResult(null);
    setError(null);
    setFileStatus({});
  };

  // 单文件上传
  const handleSingleUpload = async () => {
    if (files.length !== 1) return;
    const formData = new FormData();
    formData.append("file", files[0]);

    setUploading(true);
    setProgress(10);
    const timer = setInterval(() => setProgress((p) => (p >= 90 ? 90 : p + Math.random() * 15)), 400);

    try {
      const { data } = await axios.post(`${apiBase}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      clearInterval(timer);
      setProgress(100);
      setSingleResult(data);
      setFileStatus({ [files[0].id]: "success" });
      onSuccess && onSuccess();
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setFileStatus({ [files[0].id]: "error" });
      setError(err.response?.data?.detail || err.message || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  // 批量上传
  const handleBatchUpload = async () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    setUploading(true);
    setProgress(10);
    const timer = setInterval(() => setProgress((p) => (p >= 90 ? 90 : p + Math.random() * 10)), 500);

    try {
      const { data } = await axios.post(`${apiBase}/batch-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      clearInterval(timer);
      setProgress(100);
      setBatchResult(data);
      // 标记每个文件状态
      const status = {};
      (data.results || []).forEach((r, i) => {
        const f = files[i];
        if (f) status[f.id] = r.success ? "success" : "error";
      });
      setFileStatus(status);
      onSuccess && onSuccess();
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setError(err.response?.data?.detail || err.message || "批量上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = () => {
    if (files.length === 1) {
      handleSingleUpload();
    } else {
      handleBatchUpload();
    }
  };

  return (
    <div className="space-y-6">
      {/* 拖拽区域 */}
      <div {...getRootProps()} className={`dropzone-border cursor-pointer ${isDragActive ? "scale-[1.02]" : ""}`}>
        <div className="p-12 flex flex-col items-center justify-center min-h-[260px]">
          <input {...getInputProps()} />
          {files.length === 0 ? (
            <>
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all ${isDragActive ? "scale-110" : ""}`}
                   style={{ background: isDragActive ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)" }}>
                <UploadCloud className="w-9 h-9" style={{ color: isDragActive ? "#8b5cf6" : "#6b7280" }} />
              </div>
              <p className="dark:text-gray-300 text-gray-600 text-base font-medium mb-1">
                {isDragActive ? "松开以添加文件" : "拖拽文件到此处（支持多文件）"}
              </p>
              <p className="text-gray-600 text-sm">或点击选择 · 最大 50MB/文件 · 最多 20 个</p>
            </>
          ) : (
            <div className="w-full max-w-2xl space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="dark:text-gray-400 text-gray-500 text-sm">
                  {files.length} 个文件 {files.length > 1 ? "(批量模式)" : "(单文件模式)"}
                </span>
                {!uploading && files.length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); clearAll(); }}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                    清除全部
                  </button>
                )}
              </div>
              {files.map((f) => {
                const ext = getExt(f.name);
                const Icon = getFileIcon(f.name);
                const status = fileStatus[f.id];
                return (
                  <div key={f.id}
                    className="flex items-center gap-3 p-3 rounded-lg relative"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <Icon className="w-6 h-6 shrink-0" style={{ color: getIconColor(ext) }} />
                    <div className="flex-1 min-w-0">
                      <p className="dark:text-white text-gray-900 text-sm truncate">{f.name}</p>
                      <p className="text-gray-500 text-xs">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                    {!uploading && !status && (
                      <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {status === "success" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                    {status === "error" && <XCircle className="w-5 h-5 text-red-400" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 上传按钮 */}
      {files.length > 0 && !singleResult && !batchResult && (
        <div className="flex flex-col items-center gap-4">
          {uploading && (
            <div className="w-full max-w-md space-y-2">
              <div className="flex justify-between text-xs dark:text-gray-400 text-gray-500">
                <span>{files.length > 1 ? "批量上传中..." : "正在上传 & 计算哈希..."}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <button onClick={handleUpload} disabled={uploading} className="btn-primary flex items-center gap-2">
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />处理中...</>
            ) : files.length > 1 ? (
              <><Layers className="w-4 h-4" />批量存证到区块链 ({files.length} 个文件)</>
            ) : (
              <><ShieldCheck className="w-4 h-4" />提交存证到区块链</>
            )}
          </button>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="max-w-md mx-auto p-4 rounded-xl text-sm text-center fade-in"
             style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* 单文件结果 */}
      {singleResult && (
        <ResultCard result={singleResult} onReset={clearAll} />
      )}

      {/* 批量结果 */}
      {batchResult && (
        <div className="max-w-2xl mx-auto space-y-4 fade-in">
          <div className="card-glow p-6" style={{ borderColor: "rgba(34,197,94,0.2)" }}>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
              <div>
                <h3 className="text-lg font-bold text-green-400">
                  {batchResult.failed === 0 ? "全部存证成功" : "部分存证完成"}
                </h3>
                <p className="text-gray-500 text-sm">
                  {batchResult.succeeded} / {batchResult.total} 成功
                  {batchResult.failed > 0 && ` · ${batchResult.failed} 失败`}
                </p>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {batchResult.results.map((r, i) => (
                <div key={i}
                  className="p-3 rounded-lg fade-in"
                  style={{ animationDelay: `${i * 0.05}s`, background: r.success ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium dark:text-gray-200 text-gray-700 truncate">{r.file_name}</span>
                  </div>
                  {r.success ? (
                    <div className="text-xs text-gray-500 font-mono ml-6 space-y-0.5">
                      <div>哈希: {r.file_hash?.slice(0, 24)}...</div>
                      <div>IPFS: {r.ipfs_cid}</div>
                      <div>区块: #{r.block_number}</div>
                    </div>
                  ) : (
                    <p className="text-xs text-red-400 ml-6">{r.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <button onClick={clearAll} className="btn-secondary">上传新文件</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 单文件成功结果卡片
function ResultCard({ result, onReset }) {
  return (
    <div className="max-w-2xl mx-auto fade-in">
      <div className="card-glow p-6" style={{ borderColor: "rgba(34,197,94,0.2)" }}>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
          <h3 className="text-lg font-bold text-green-400">存证成功</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: "文件哈希 (SM3/SHA-256)", value: result.file_hash },
            { label: "IPFS CID", value: result.ipfs_cid },
            { label: "交易哈希", value: result.tx_hash },
            { label: "区块号", value: `#${result.block_number}` },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-gray-500 text-xs mb-1">{item.label}</p>
              <p className="dark:text-gray-200 text-gray-700 font-mono break-all text-xs">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="text-center mt-4">
        <button onClick={onReset} className="btn-secondary">继续上传新文件</button>
      </div>
    </div>
  );
}
