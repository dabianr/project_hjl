# BlockProof — 区块链电子文件存证系统

<p align="center">
  <strong>Ethereum + IPFS + SM3 国密算法</strong><br>
  可信 · 防篡改 · 去中心化存证
</p>

---

## 是什么

BlockProof 把电子文件的哈希指纹写入以太坊区块链，文件本身存入 IPFS。任何人拿到文件后，重新计算哈希去链上对比，就能验证文件是否被篡改过——而且这个验证不依赖任何中心化机构。

---

## 启动方式

### 一键启动（推荐）

```bash
chmod +x start.sh
./start.sh
```

浏览器打开 http://localhost:3000

### 手动启动（NixOS / fish shell）

**终端 1 — 启动链：**
```fish
cd ~/Desktop/project_hjl
NIXPKGS_ALLOW_UNFREE=1 nix-shell -p nodejs solc steam-run --run "steam-run npx hardhat node"
```

**终端 2 — 部署 + 后端：**
```fish
cd ~/Desktop/project_hjl
npx hardhat run contracts/deploy.js --network localhost
# 记录输出的合约地址

cd backend
echo 'RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=合约地址
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CHAIN_ID=31337
IPFS_API_URL=http://127.0.0.1:5001/api/v0
IPFS_MOCK=true
DATABASE_PATH=evidence.db
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_MB=50
RATE_LIMIT=30/minute' > .env

source venv/bin/activate.fish
uvicorn main:app --reload
```

**终端 3 — 前端：**
```fish
cd ~/Desktop/project_hjl/frontend
npm start
```

### 通用系统启动

```bash
# 终端 1：启动本地链
npm run node

# 终端 2：部署合约
npm run deploy
# 把输出的合约地址填到 backend/.env

# 终端 3：启动后端
cd backend
pip install -r requirements.txt
cp .env.example .env   # 编辑填入合约地址
uvicorn main:app --reload

# 终端 4：启动前端
cd frontend
npm install && npm start
```

---

## 核心流程

```
拖拽文件 → 计算 SM3 哈希 → 上传 IPFS → 写入合约 → 链上存证完成
                                                    ↓
任何人拿文件重新算哈希 → 去链上验证 → 匹配 = 未被篡改 ✅
```

## 项目结构

```
├── contracts/         智能合约（Solidity + Hardhat）
├── backend/           FastAPI 后端
├── frontend/          React 前端（Tailwind CSS）
├── hardhat.config.js  Hardhat 配置
├── start.sh           一键启动脚本
├── NIXOS_DEBUG.md     NixOS 环境调试记录
└── PROJECT_ARCHITECTURE.md  详细架构文档
```

## 技术栈

| 层 | 技术 |
|----|------|
| 区块链 | Solidity 0.8.20 / Hardhat / 以太坊 |
| 后端 | FastAPI / Web3.py / gmssl |
| 前端 | React / Tailwind CSS / ethers.js |
| 存储 | IPFS + SQLite |

## API 一览

| 方法 | 路径 | 功能 |
|------|------|------|
| `POST` | `/upload` | 上传文件并存证 |
| `POST` | `/batch-upload` | 批量上传并证 |
| `GET` | `/verify/{hash}` | 验证存证 |
| `GET` | `/evidence/{hash}` | 查存证详情 |
| `GET` | `/stats` | 统计数据 |
| `GET` | `/logs` | 操作日志 |

## 环境变量（backend/.env）

```env
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...
CHAIN_ID=31337
IPFS_API_URL=http://127.0.0.1:5001/api/v0
IPFS_MOCK=true       # true=不需要真实 IPFS 节点
MAX_UPLOAD_SIZE_MB=50
RATE_LIMIT=30/minute
```

## 相关资源

- 📄 [完整架构文档](./PROJECT_ARCHITECTURE.md)
- 🐛 [NixOS 调试记录](./NIXOS_DEBUG.md)
- 🔗 原项目：[Vasto1/blockchain-evidence-system](https://github.com/Vasto1/blockchain-evidence-system)
