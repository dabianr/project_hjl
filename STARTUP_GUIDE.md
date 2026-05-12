# BlockProof 启动指南

## 一键启动

```bash
bash start.sh
```

## 手动启动

### 终端1 — 启动链（勿关）

```fish
nix-shell -p foundry --run "anvil --host 127.0.0.1 --port 8545"
```

看到 `Listening on 127.0.0.1:8545` 即成功。

### 终端2 — 部署合约 + 后端

```fish
cd ~/Desktop/project_hjl
npx hardhat run contracts/deploy.js --network localhost
# 记录合约地址 0x...

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

### 终端3 — 前端

```fish
cd ~/Desktop/project_hjl/frontend
npm start
```

浏览器打开 http://localhost:3000

## 环境说明

- **链**：使用 Foundry anvil（Rust 原生，NixOS 不炸）
- **后端**：Python venv + FastAPI
- **前端**：React + npm start
