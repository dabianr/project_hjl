# BlockProof — 区块链电子文件存证系统 · 项目架构文档

> 源码来源：[Vasto1/blockchain-evidence-system](https://github.com/Vasto1/blockchain-evidence-system)  
> 文档生成时间：2026-05-11

---

## 1. 项目概述

BlockProof 是一个基于 **以太坊 + IPFS + SM3 国密算法** 的电子文件存证系统。核心思路：用户上传文件 → 后端计算文件哈希（SM3/SHA-256）→ 文件存入 IPFS → 哈希&CID 写入以太坊智能合约 → 任意第三方可通过哈希值验证文件是否被篡改。

**技术栈：**
- **区块链层**：Solidity 0.8.20（智能合约） + Hardhat（编译/部署/本地链）
- **后端**：Python FastAPI + Web3.py + gmssl（国密）
- **前端**：React + Tailwind CSS + ethers.js（钱包连接）
- **存储**：IPFS（去中心化文件存储）+ SQLite（操作日志）

---

## 2. 项目目录结构

```
blockchain-evidence-system/
│
├── contracts/                    # 智能合约
│   ├── EvidenceStorage.sol       # 核心存证合约
│   └── deploy.js                 # Hardhat 部署脚本
│
├── backend/                      # FastAPI 后端
│   ├── main.py                   # API 入口 + 路由（上传/验证/查询/统计）
│   ├── blockchain_service.py     # 区块链交互层（封装合约调用）
│   ├── ipfs_service.py           # IPFS 上传服务（支持 Mock 模式）
│   ├── database.py               # SQLite 数据库初始化
│   ├── config.py                 # 环境变量配置
│   ├── models.py                 # Pydantic 数据模型
│   ├── requirements.txt          # Python 依赖
│   └── .env.example              # 环境变量模板
│
├── frontend/                     # React 前端
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js                # 根组件（路由 + 状态管理）
│   │   ├── index.js / index.css
│   │   └── components/
│   │       ├── Navbar.jsx        # 导航栏 + 钱包连接
│   │       ├── Dashboard.jsx     # 数据概览仪表盘
│   │       ├── UploadDropzone.jsx # 拖拽上传组件
│   │       ├── EvidenceList.jsx  # 存证记录列表
│   │       └── VerifyTool.jsx    # 哈希验证工具
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── hardhat.config.js             # Hardhat 配置
├── package.json                  # 根级 npm 脚本
└── .gitignore
```

---

## 3. 核心模块详解

### 3.1 智能合约 — `EvidenceStorage.sol`

**部署网络**：本地 Hardhat 链（Chain ID 31337），可迁移至任意 EVM 兼容链。

**核心数据结构：**

```solidity
struct Evidence {
    string fileHash;    // 文件哈希（SM3 或 SHA-256）
    string fileName;    // 原始文件名
    address uploader;   // 存证人地址
    uint256 timestamp;  // 存证时间戳
    string ipfsCID;     // IPFS 内容标识符
}
```

**核心函数：**

| 函数 | 可见性 | 说明 |
|------|--------|------|
| `uploadEvidence(hash, name, cid)` | external | 存证上传（防重复，hash 唯一） |
| `getEvidence(hash)` | view | 根据哈希查询存证详情 |
| `verifyEvidence(hash)` | view | 验证存证是否存在（返回 bool + 详情） |
| `getAllEvidenceHashes(offset, limit)` | view | 分页获取所有哈希列表 |
| `getUploaderEvidenceCount(addr)` | view | 查询某地址的存证数量 |
| `totalEvidenceCount()` | view | 全网存证总数 |
| `pause()` / `unpause()` | onlyOwner | 合约紧急启停 |
| `transferOwnership(newOwner)` | onlyOwner | 转移合约所有权 |

### 3.2 后端 API — FastAPI

**启动命令**：`uvicorn backend.main:app --reload`  
**端口**：8000

**API 路由表：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 服务信息 |
| `POST` | `/upload` | 上传文件并存证 |
| `GET` | `/verify/{file_hash}` | 验证存证是否存在 |
| `GET` | `/evidence/{file_hash}` | 查询存证详情 |
| `GET` | `/stats?uploader=0x...` | 统计信息 |
| `GET` | `/logs?limit=50&offset=0` | 操作日志（SQLite） |

**上传流程（`POST /upload`）：**
1. 接收文件 → 校验大小（默认 50MB）
2. 保存到临时目录
3. 计算哈希（优先 SM3 国密，fallback SHA-256）
4. 上传到 IPFS → 获取 CID
5. 调用合约 `uploadEvidence(hash, name, cid)` → 获取 tx_hash
6. 写入 SQLite 操作日志
7. 删除临时文件 → 返回结果

**验证流程（`GET /verify/{file_hash}`）：**
1. 调用合约 `verifyEvidence(hash)` 
2. 存在 → 返回存证详情 + "区块链权威认证"
3. 不存在 → 返回 `exists=false`

**安全措施：**
- 频率限制：`30/minute`（可配）
- 文件大小限制：`50MB`（可配）
- CORS 全开（开发模式）

### 3.3 前端 — React SPA

**启动**：`cd frontend && npm start`  
**端口**：3000

**组件树：**
```
App
├── Navbar          （钱包连接/断开 MetaMask）
├── Dashboard       （4 个统计卡片：总数/区块高度/个人数量/合约状态）
├── Tab 切换        （上传存证 / 存证列表 / 验证工具）
│   ├── UploadDropzone  （react-dropzone 拖拽上传 + 进度条 + 结果展示）
│   ├── EvidenceList    （操作日志列表）
│   └── VerifyTool      （哈希输入 → 验证结果展示）
└── Footer
```

**状态管理**：App 组件统一管理 `stats`、`logs`、`account`、`activeTab`，通过 props 下传。

### 3.4 IPFS 服务

`ipfs_service.py` 支持双模式：

- **Mock 模式**（`IPFS_MOCK=true`）：用本地 SHA-256 模拟 CID 生成，无需真实 IPFS 节点
- **真实模式**（`IPFS_MOCK=false`）：调用 IPFS HTTP API `/api/v0/add` 上传文件

---

## 4. 数据流图

```
用户上传文件
    │
    ▼
[React Frontend] ──POST /upload──▶ [FastAPI Backend]
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                     [SM3 哈希]   [IPFS 存储]   [SQLite]
                          │            │            │
                          └────────────┼────────────┘
                                       ▼
                              [Ethereum 合约]
                              uploadEvidence()
                                       │
                                       ▼
                              返回 tx_hash + block_number
                                       │
                                       ▼
                              [前端展示存证结果]
```

---

## 5. 部署与运行指南

### 5.1 环境要求

- Node.js ≥ 18
- Python ≥ 3.10
- （可选）IPFS Kubo 节点（Mock 模式下不需要）

### 5.2 本地运行步骤

```bash
# 1. 启动本地以太坊链
npm run node

# 2. 部署合约（新终端）
npm run deploy
# 记录输出的合约地址 → 填入 backend/.env 的 CONTRACT_ADDRESS

# 3. 配置后端
cp backend/.env.example backend/.env
# 编辑 .env 填入 CONTRACT_ADDRESS

# 4. 启动后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 5. 启动前端（新终端）
cd frontend
npm install
npm start
```

### 5.3 一键脚本（npm scripts）

```bash
npm run compile    # 编译合约
npm run node       # 启动 Hardhat 本地链
npm run deploy     # 部署合约到 localhost
```

---

## 6. 后端依赖清单

| 包名 | 版本 | 用途 |
|------|------|------|
| `fastapi` | 0.115.6 | Web 框架 |
| `uvicorn[standard]` | 0.34.0 | ASGI 服务器 |
| `web3` | 7.6.1 | 以太坊交互 |
| `gmssl` | 3.2.2 | 国密 SM3 哈希 |
| `python-multipart` | 0.0.19 | 文件上传解析 |
| `aiofiles` | 24.1.0 | 异步文件 I/O |
| `aiosqlite` | 0.20.0 | 异步 SQLite |
| `slowapi` | 0.1.9 | API 频率限制 |
| `python-dotenv` | 1.0.1 | 环境变量加载 |

---

## 7. 安全与设计考量

- **防篡改**：文件哈希 + 区块时间戳 + IPFS CID 三重锚定在链上，任何一方无法单方面修改
- **国密合规**：优先使用 SM3 哈希算法，兼顾国际标准 SHA-256
- **紧急启停**：合约 owner 可 pause/unpause，应对安全事件
- **防重放**：同一哈希不可重复存证（合约层 enforce）
- **日志审计**：所有操作写入 SQLite，支持离线索查
