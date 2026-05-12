#!/usr/bin/env bash
# BlockProof 一键启动 (anvil 持久化 + backend + frontend)
DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log(){ echo -e "${GREEN}[✓]${NC} $1"; }
err(){ echo -e "${RED}[✗]${NC} $1"; }

# 配置
STATE_DIR="$DIR/.anvil"
ANVIL_BIN="/nix/store/2xkfzz1rzpzgylwhxydbnald1hy07agw-foundry-1.5.1/bin/anvil"
ADDR_FILE="$STATE_DIR/contract_addr"
mkdir -p "$STATE_DIR"

[ -n "$VIRTUAL_ENV" ] && deactivate 2>/dev/null
echo -e "${CYAN}BlockProof 一键启动${NC}"

# 1. 编译合约
cd "$DIR"
[ -d artifacts ] || { log "编译合约..."; npx hardhat compile; }

# 2. 起 anvil（自动加载/保存状态，每30秒存盘防丢）
if [ -f "$STATE_DIR/state.json" ]; then
    log "加载已保存的链状态..."
    SKIP_DEPLOY=1
else
    log "全新启动链（首次运行）..."
    SKIP_DEPLOY=0
fi

"$ANVIL_BIN" --state "$STATE_DIR" --state-interval 30 --host 127.0.0.1 --port 8545 > /tmp/anvil.log 2>&1 &
ANVIL_PID=$!
sleep 2

log "等链就绪..."
for i in $(seq 1 20); do
    curl -s -X POST http://127.0.0.1:8545 \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        2>/dev/null | grep -q '"result"' && break
    sleep 1
done
log "链已就绪"

# 3. 部署合约（首次）或复用地址
if [ "$SKIP_DEPLOY" -eq 1 ] && [ -f "$ADDR_FILE" ]; then
    ADDR=$(cat "$ADDR_FILE")
    log "复用合约: $ADDR"
else
    log "部署合约..."
    OUT=$(npx hardhat run contracts/deploy.js --network localhost 2>&1)
    ADDR=$(echo "$OUT" | grep -oP '0x[a-fA-F0-9]{40}' | tail -1)
    if [ -z "$ADDR" ]; then err "部署失败: $OUT"; exit 1; fi
    echo "$ADDR" > "$ADDR_FILE"
    log "新合约: $ADDR"
fi

# 4. 写 .env
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

# 5. 后端
[ -d venv ] || { python3 -m venv venv; source venv/bin/activate; pip install -q -r requirements.txt; }
fuser -k 8000/tcp 2>/dev/null || true
source venv/bin/activate
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2
curl -s http://127.0.0.1:8000/ > /dev/null && log "后端: http://127.0.0.1:8000" || err "后端失败: tail /tmp/backend.log"

# 6. 前端
cd "$DIR/frontend"
fuser -k 3000/tcp 2>/dev/null || true
nohup npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 4
curl -s http://localhost:3000 > /dev/null && log "前端: http://localhost:3000" || err "前端失败: tail /tmp/frontend.log"

# 保存 PID 方便手动杀
echo "$ANVIL_PID $BACKEND_PID $FRONTEND_PID" > /tmp/blockproof_pids.txt

echo -e "\n${GREEN}启动完成！${NC}"
echo "链状态每 30 秒自动存盘 → $STATE_DIR"
echo "重启后数据不丢，兄弟放心"
