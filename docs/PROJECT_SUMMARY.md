# BlockProof 项目总结（也许是最终版）

> 区块链电子文件存证系统 — Ethereum + IPFS + SM3 国密算法
> 公网地址：https://bigdogbarks.top

---

## 1. 架构总览

```
用户浏览器
    │
    ▼
bigdogbarks.top / www.bigdogbarks.top
    │
    ▼
Cloudflare Tunnel (HTTPS, 边缘 SSL)
    │
    ▼
NixOS 宿主机 — nginx :49514 (自签 SSL, noTLSVerify)
    ├── /       → :3000 (React SPA 前端)
    ├── /api/*  → :8001 (FastAPI 后端, rewrite 剥前缀)
    └── /vnc/*  → :6080 (noVNC 远程桌面, basic auth)
    │
    ▼
FastAPI 后端 :8001
    ├── Web3.py → anvil :8545 (以太坊本地链, 每 30s 状态存盘)
    ├── IPFS Mock → 本地伪 CID 生成
    └── SQLite → evidence.db (操作日志)
```

## 2. 核心文件路径与职责

### 智能合约层

| 文件 | 行数 | 职责 |
|------|------|------|
| `contracts/EvidenceStorage.sol` | 91 | 存证合约：上传哈希、验证存证、事件日志、环形缓冲 |
| `contracts/deploy.js` | - | Hardhat 部署脚本 |

**关键实现：**
- 存储结构 `mapping(string => Evidence)`，哈希唯一索引
- `_recentHashes[MAX_RECENT]` 环形缓冲 (MAX_RECENT=200)，O(1) 写入
- `EvidenceCreated` 事件 — 完整历史靠链下扫事件，链上只存最近 200 条
- `pause()` / `unpause()` 紧急启停，`transferOwnership()` 权限交接

### 后端层

| 文件 | 行数 | 职责 |
|------|------|------|
| `backend/main.py` | 277 | FastAPI 入口：路由注册、CORS、频率限制、请求日志 |
| `backend/blockchain_service.py` | 143 | Web3.py 合约调用：存证上链、验证、统计、RPC 重试 |
| `backend/ipfs_service.py` | - | IPFS 上传（Mock/真实双模式） |
| `backend/database.py` | - | SQLite 初始化（operation_logs 表） |
| `backend/config.py` | - | 环境变量：RPC_URL、CONTRACT_ADDRESS、端口、限制 |
| `backend/models.py` | - | Pydantic 数据模型：上传响应、批量结果、验证、统计 |
| `backend/auth.py` | - | API Key 认证（开发模式跳过） |

**API 路由：**

| 方法 | 路径 | 功能 |
|------|------|------|
| `GET` | `/` | 服务信息 |
| `POST` | `/upload` | 单文件上传 + 存证 |
| `POST` | `/batch-upload` | 批量上传 + 存证（并发处理） |
| `GET` | `/verify/{hash}` | 验证哈希是否已存证 |
| `GET` | `/evidence/{hash}` | 查询存证详情 |
| `GET` | `/stats` | 统计：总数/区块高度/个人数量/合约状态 |
| `GET` | `/trend` | 最近 N 天存证趋势（SQLite 聚合） |
| `GET` | `/logs` | 操作日志分页 |

**安全措施：** 频率限制 `30/minute`、文件大小 `50MB`、CORS 全开

### 前端层

| 文件 | 行数 | 职责 |
|------|------|------|
| `frontend/src/App.js` | 148 | 根组件：状态管理、主题、路由、网络状态 |
| `frontend/src/components/UploadDropzone.jsx` | ~300 | 拖拽上传：进度条、文件图标、批量模式 |
| `frontend/src/components/Dashboard.jsx` | ~100 | 四色统计卡片 + count-up 动画 + 趋势图 |
| `frontend/src/components/EvidenceList.jsx` | ~130 | 存证列表：复制按钮、相对时间、错峰入场 |
| `frontend/src/components/VerifyTool.jsx` | ~150 | 哈希验证：分步动画、结果展示 |
| `frontend/src/components/TrendChart.jsx` | ~60 | ECharts 柱状图 + 空状态占位 |
| `frontend/src/components/Navbar.jsx` | - | 导航栏 + 钱包连接 + 主题切换 |
| `frontend/src/components/Toast.jsx` | - | Toast 通知（success/error/info） |
| `frontend/src/components/Skeleton.jsx` | - | 骨架屏加载占位 |
| `frontend/src/components/ErrorBoundary.jsx` | - | 错误边界，子组件崩溃不拖全页 |
| `frontend/src/index.css` | ~100 | 全局样式：动画、滚动条、浅色/深色适配 |

**前端特性：**
- Dark/Light 主题切换（Tailwind `dark:` 前缀 + `html.dark` class）
- 统计卡片按颜色区分（紫/青/绿/橙）+ 数字递增动画
- 文件拖拽区域：按扩展名显示不同图标（PDF→FileText, 图片→Image, 压缩包→Archive）
- 真实上传进度（axios `onUploadProgress`，非模拟）
- 复制按钮：`navigator.clipboard` + `execCommand` fallback
- 存证列表相对时间："刚刚 / 5 分钟前 / 3 小时前 / 2 天前"
- Tab 切换下滑线指示器 + fade-in 动画
- Footer 区块链网络状态圆点（绿/红/黄）
- 钱包连接设为可选（Floorp 浏览器兼容问题）
- 错误边界、骨架屏、Toast 通知

### 基础设施

| 文件 | 行数 | 职责 |
|------|------|------|
| `start.sh` | 122 | 一键启动：anvil → 编译合约 → 部署 → .env → 后端 → 前端 |
| `~/.nixcfg/apps/services/remote-ctrl/nginx.nix` | - | nginx 反代：前端/API/VNC + 上传限制 + 缓存控制 |
| `~/.nixcfg/apps/services/remote-ctrl/cloudflared.nix` | - | Cloudflare Tunnel：域名指向 nginx 49514 |
| `tests/test_hash.py` | - | pytest：SM3 标准向量、SHA-256 确定性、空文件 |
| `.github/workflows/test.yml` | - | CI：push/PR 自动跑 pytest |

## 3. 现实应用

BlockProof 可用于以下场景：

- **电子合同存证** — 合同双方签署后上传哈希到链，任何一方无法单方面篡改
- **知识产权保护** — 代码、设计稿、论文等原创作品的时间戳证明
- **供应链溯源** — 每批货物的质检报告哈希上链，防篡改追溯
- **医疗记录存证** — 病历哈希上链，患者可验证记录未被修改
- **司法取证** — 电子证据的哈希指纹写入区块链，法庭可验证证据真伪
- **证书防伪** — 学历/资质证书的哈希存证，企业可快速验证

**核心优势：**
- 去中心化：不依赖任何第三方机构，任何人可独立验证
- 防篡改：区块链的不可变性保证哈希记录永久可信
- 国密合规：优先 SM3 哈希算法，兼顾 SHA-256
- 零信任：验证方无需相信存证方，只需信任数学和区块链

## 4. 启动与维护

```fish
# 一键启动（首次或常规使用）
bash ~/Desktop/project_hjl/start.sh

# 修改前端后部署
cd ~/Desktop/project_hjl/frontend && npm run build
sudo nixos-rebuild switch --flake ~/nixcfg#lap
sudo systemctl restart nginx

# 查看访问日志
sudo tail -f /var/log/nginx/access.log

# 链状态位置
~/.anvil/state.json        # 每 30s 自动存盘
~/.anvil/contract_addr     # 合约地址持久化
