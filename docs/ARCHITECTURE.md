# BlockProof — 区块链电子文件存证系统

> 基于以太坊智能合约 + IPFS + SM3 国密算法的电子文件存证平台
> 公网地址：https://bigdogbarks.top

---

## 一、系统概述

用户上传文件 → 后端计算文件哈希（SM3/SHA-256）→ 文件存入 IPFS → 哈希和 CID 写入以太坊合约 → 生成不可篡改的存证记录。

任意第三方可通过文件哈希验证：计算文件哈希 → 链上查询 → 匹配则未被篡改。

## 二、技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 区块链 | Solidity 0.8.20 / Foundry Anvil | 存证合约（环形缓冲 MAX_RECENT=200） |
| 后端 | Python FastAPI / Web3.py / gmssl | 40+ 路由，JWT + API_KEY 双认证 |
| 前端 | React 18 / Tailwind CSS 3 / lucide-react | 13 个组件，暗色/日间双主题 |
| 存储 | IPFS (mock) + SQLite | 文件存 IPFS，操作日志存 SQLite |
| 部署 | NixOS + nginx + Cloudflare Tunnel | 公网 HTTPS，CF 隧道转本地 |

## 三、架构

```
用户浏览器 → bigdogbarks.top
                    ↓
        Cloudflare Tunnel (HTTPS)
                    ↓
        NixOS nginx :49514
          ├── /  → :3000 (React dev / build)
          ├── /api/* → :8001 (FastAPI, rewrite 剥前缀)
          └── /vnc/* → :6080 (noVNC)

端口映射:
          8545 → Anvil (以太坊节点)
          8001 → FastAPI (后端 API)
          3000 → React (前端 dev server)
```

## 四、目录结构

```
project_hjl/
├── backend/                     # FastAPI 后端
│   ├── main.py                  # 入口 + 所有路由
│   ├── blockchain_service.py    # Web3 合约交互
│   ├── auth.py                  # API_KEY + JWT 认证
│   ├── database.py              # SQLite 初始化
│   ├── models.py                # Pydantic 数据模型
│   ├── config.py                # .env 配置项
│   ├── ipfs_service.py          # IPFS 上传服务
│   └── evidence.db              # SQLite 数据库
├── frontend/                    # React 前端
│   └── src/
│       ├── App.js               # 根组件（状态/主题/路由）
│       ├── index.css            # 全局 + Tailwind 样式
│       └── components/
│           ├── PortalPage.jsx       # 门户页（device_id 生成）
│           ├── AdminLogin.jsx       # 管理员登录浮层
│           ├── AdminConsole.jsx     # 管理控制台仪表盘
│           ├── Navbar.jsx           # 导航栏
│           ├── Dashboard.jsx        # 数据概览卡片
│           ├── UploadDropzone.jsx   # 文件拖拽上传
│           ├── EvidenceList.jsx     # 存证列表（分页）
│           ├── MyEvidence.jsx       # 我的存证（按设备过滤）
│           ├── VerifyTool.jsx       # 哈希验证
│           ├── TrendChart.jsx       # 趋势柱状图
│           ├── Toast.jsx            # 通知提示
│           ├── Skeleton.jsx         # 骨架屏
│           └── ErrorBoundary.jsx    # 错误边界
├── contracts/
│   ├── EvidenceStorage.sol      # 智能合约
│   └── deploy.js                # 部署脚本
├── docs/                        # 项目文档
│   ├── ARCHITECTURE.md          # 本文：架构总览
│   ├── HISTORY.md               # 完整实现历史
│   ├── DEBUG.md                 # 调试与故障排查
│   └── worklog/                 # 每日工作日志
├── start.sh                     # 一键启动脚本
└── README.md                    # 项目简介
```

## 五、API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 无 | 服务信息 |
| POST | `/upload` | API_KEY(可选) | 单文件上传存证 |
| POST | `/batch-upload` | API_KEY(可选) | 批量上传(最多20文件) |
| GET | `/verify/{file_hash}` | 无 | 验证哈希是否上链 |
| GET | `/evidence/{file_hash}` | 无 | 查询存证详情 |
| GET | `/stats` | 无 | 合约统计 + 个人存证数 |
| GET | `/trend` | 无 | N天存证趋势 |
| GET | `/logs` | API_KEY(可选) | 分页操作日志（支持 uploader 过滤） |
| POST | `/admin/login` | 无 | 管理员登录(JWT) |
| GET | `/admin/status` | JWT | 系统状态 |
| GET | `/admin/dashboard` | JWT | 聚合仪表盘（设备Top5+热日历） |
| POST | `/admin/contract/pause` | JWT | 暂停合约 |
| POST | `/admin/contract/unpause` | JWT | 恢复合约 |
| POST | `/admin/cleanup` | JWT | 清理临时文件 |

## 六、认证方式

1. **API_KEY** — 上传/列表接口。`X-API-Key` 请求头。环境变量 `API_KEY` 为空时跳过
2. **JWT** — 管理员接口。`Authorization: Bearer <token>`。默认账密 `admin / admin123`

## 七、数据库（SQLite）

表 `operation_logs`：
```
id, file_hash, file_name, uploader, ipfs_cid, tx_hash, block_number, created_at
```

uploader 字段存 wallet 地址或 device_id（UUID v4），用于个人存证统计和「我的存证」过滤。

## 八、智能合约（EvidenceStorage.sol）

- **环形缓冲区**：MAX_RECENT=200，超出覆盖最旧记录
- **核心函数**：uploadEvidence(hash, name, cid)、verifyEvidence(hash)、getEvidence(hash)、pause()/unpause()
- **部署地址**：`0x7A9Ec1d04904907De0ED7b6839CcdD59c3716AC9`（本地 anvil 链）
- **链 ID**：31337 (Anvil localhost:8545)

## 九、关键设计决策

| 决策 | 原因 |
|------|------|
| anvil 替代 Hardhat | NixOS 上 Hardhat node SIGBUS（glibc 不兼容） |
| nginx proxy 替代 root+tryFiles | NixOS nginx 模块里 tryFiles 一直 500 |
| JWT 替代 API_KEY 管理鉴权 | 安全 + 可过期，上传保留 API_KEY |
| device_id 做门户控制 | Floorp 浏览器钱包不可用，UUID 做临时账户 |
| EvidenceList / MyEvidence 自管理分页 | 跨组件 page 状态同步导致回弹 |
| SVG RingChart 替代第三方库 | 环形图简单，减少依赖包体积 |
| `window.location.reload()` 替代 useState | 门户→主界面状态边界刷新，避免 useEffect 依赖遗漏 |
| 使用率分母 MAX_RECENT=200 | 合约环形缓冲区大小，数据少时不四舍五入为 0% |
| Cloudflare Tunnel 替代端口开放 | 公网 HTTPS 转发到内网 nginx，免暴露端口 |

## 十、启动方式

### 一键启动
```bash
cd ~/Desktop/project_hjl && bash start.sh
```

### 手动启动
```fish
# 终端1：链
nix-shell -p foundry --run "anvil --host 127.0.0.1 --port 8545 --state .anvil --state-interval 10"

# 终端2：部署 + 后端
cd ~/Desktop/project_hjl
npx hardhat run contracts/deploy.js --network localhost
cd backend
source venv/bin/activate.fish
uvicorn main:app --reload --port 8001

# 终端3：前端
cd ~/Desktop/project_hjl/frontend
npm start
```

浏览器访问 http://localhost:3000 或 https://bigdogbarks.top
