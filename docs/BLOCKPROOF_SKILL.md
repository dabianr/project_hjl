---
name: blockproof-project
description: BlockProof 区块链电子文件存证系统 — 架构、已知问题、经验教训
---

# BlockProof 项目知识

## 项目概要

区块链电子文件存证系统，公网部署于 https://bigdogbarks.top。
技术栈：Solidity + FastAPI + React + Tailwind + anvil + Cloudflare Tunnel + NixOS nginx。

## 架构

```
bigdogbarks.top → Cloudflare Tunnel → nginx :49514
  ├── /       → :3000 (React dev server / build 静态文件)
  ├── /api/*  → :8001 (FastAPI, rewrite 剥前缀)
  └── /vnc/*  → :6080 (noVNC)
```

### NixOS 配置
- nginx: `~/nixcfg/apps/services/remote-ctrl/nginx.nix`
- cloudflared: `~/nixcfg/apps/services/remote-ctrl/cloudflared.nix`

## 已知问题与教训（避免重犯）

### 1. dark class 必须挂在 `<html>` 上，不是 `<div>`
Tailwind darkMode: "class" 模式下，CSS 选择器如 `html:not(.dark)` 只在 `<html>` 有 dark class 时生效。
如果挂在 `<div>` 上，CSS 选择器永远不匹配。
**正确做法：** `document.documentElement.classList.toggle("dark", isDark)`

### 2. NixOS nginx 模块的 root + tryFiles 会报 500
原因不明，可能是 NixOS nginx 模块的 bug 或限制。
**安全做法：** proxy 到 React dev server (:3000)，不要用 root + tryFiles 托管静态文件。

### 3. Cloudflare 缓存导致 bundle.js 不更新
Cloudflare 边缘缓存会保留旧的 bundle.js，即使重启 npm start 也没用。
**解决方案：**
- `npm run build` 产出带 hash 的文件名（main.abc123.js）
- 或者去 Cloudflare 后台手动 Purge Everything
- 在 nginx 加 `Cache-Control: no-store`（需要 nixos-rebuild）

### 4. anvil --state-interval 30 不是实时存盘
两次存盘之间的数据在重启时会丢失。
**改进：** 减小 interval 到 5-10 秒，或使用 `--dump-state` 并处理 SIGINT 信号。

### 5. 无法从沙箱操作宿主机的系统服务
沙箱无法：`nixos-rebuild switch`、`systemctl`、`pkill`、`kill` 宿主机进程。
只能：读写文件、curl 验证、GitHub API push。

### 6. 前端进度条用 setInterval 模拟会卡在 90%
**正确做法：** 用 axios `onUploadProgress` 获取真实上传进度。

### 7. navigator.clipboard.writeText 需要安全上下文
非 HTTPS 下会静默失败。
**解决方案：** 加 fallback `document.execCommand("copy")` + 临时 textarea。

### 8. 前端 API_BASE 不能写死 127.0.0.1
公网访客的浏览器会连自己电脑的 127.0.0.1。
**正确做法：** 生产用 `/api`（相对路径，过 nginx），开发用 `.env.development` 设 `REACT_APP_API_URL=http://127.0.0.1:8001`。

### 9. commit message 必须简短短
好的：`fix: dark class 挂 <html>`
坏的：`feat: 修了很多东西改了很多文件详细的描述了一大堆`

### 10. 沙箱写文件 vs 宿主文件同步
沙箱 sudo tee / sudo cp 写入的文件，宿主机的 inotify 可能检测不到。
**工作流：** 改完后 touch 一下文件触发 webpack HMR，或直接让用户重启服务。

## 文件地图

| 路径 | 说明 |
|------|------|
| `contracts/EvidenceStorage.sol` | 存证合约，环形缓冲 MAX_RECENT=200 |
| `backend/main.py` | FastAPI 入口，7 个路由 |
| `backend/blockchain_service.py` | Web3.py 合约调用 |
| `frontend/src/App.js` | 根组件，主题/路由/网络状态 |
| `frontend/src/components/EvidenceList.jsx` | 存证列表，分页/复制/暗色卡片 |
| `frontend/src/index.css` | 全局样式，evidence-card 类 |
| `start.sh` | 一键启动脚本 |
| `~/.nixcfg/apps/services/remote-ctrl/nginx.nix` | nginx 反代配置 |
| `~/.nixcfg/apps/services/remote-ctrl/cloudflared.nix` | Cloudflare Tunnel 配置 |
