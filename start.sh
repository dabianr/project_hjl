#!/usr/bin/env bash
# BlockProof 一键启动
# 用法: bash start.sh
DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log(){ echo -e "${GREEN}[✓]${NC} $1"; }
err(){ echo -e "${RED}[✗]${NC} $1"; }

echo -e "${CYAN}BlockProof 一键启动${NC}"

# 1. 后台起链
log "启动 Hardhat 链..."
NIXPKGS_ALLOW_UNFREE=1 nix-shell -p nodejs solc steam-run \
    --run "steam-run npx hardhat node" > /tmp/hardhat-node.log 2>&1 &
log "等待链就绪..."
for i in $(seq 1 30); do
    curl -s -X POST http://127.0.0.1:8545 \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        2>/dev/null | grep -q result && break
    sleep 1
done
log "链已就绪"

# 2. 部署合约
cd "$DIR"
OUT=$(npx hardhat run contracts/deploy.js --network localhost 2>&1)
ADDR=$(echo "$OUT" | grep -oP '0x[a-fA-F0-9]{40}')
if [ -z "$ADDR" ]; then err "部署失败: $OUT"; exit 1; fi
log "合约: $ADDR"

# 3. 写 .env
cd "$DIR/backend"
cat > .env << EOF
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=$ADDR
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CHAIN_ID=31337
IPFS_API_URL=http://127.0.0.1:5001/api/v0
IPFS_MOCK=true
DATABASE_PATH=evidence.db
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_MB=50
RATE_LIMIT=30/minute
EOF
log ".env 已生成"

# 4. 创建 venv (如果不存在)
[ -d venv ] || { python3 -m venv venv; source venv/bin/activate; pip install -q -r requirements.txt; }

# 5. 启后端
log "启动后端..."
kill $(lsof -t -i:8000) 2>/dev/null || true
source venv/bin/activate
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/backend.log 2>&1 &
sleep 2
curl -s http://127.0.0.1:8000/ > /dev/null && log "后端: http://127.0.0.1:8000" || err "后端启动失败: tail /tmp/backend.log"

# 6. 启前端
cd "$DIR/frontend"
log "启动前端..."
kill $(lsof -t -i:3000) 2>/dev/null || true
nohup npm start > /tmp/frontend.log 2>&1 &
sleep 4
curl -s http://localhost:3000 > /dev/null && log "前端: http://localhost:3000" || err "前端启动失败: tail /tmp/frontend.log"

echo -e "\n${GREEN}启动完成！${NC}"
