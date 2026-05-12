#!/usr/bin/env bash
# BlockProof 一键启动 (anvil 持久化 + backend + frontend)
# 端口: 链 8545, 后端 8001, 前端 3000
DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log(){ echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${RED}[✗]${NC} $1"; }
die(){ echo -e "${RED}[✗]${NC} $1"; exit 1; }

# 配置
STATE_DIR="$DIR/.anvil"
ADDR_FILE="$STATE_DIR/contract_addr"
BACKEND_PORT=8001
LOG_DIR="$DIR/.logs"
mkdir -p "$STATE_DIR" "$LOG_DIR"

# 清理旧日志，避免权限冲突
rm -f "$LOG_DIR"/anvil.log "$LOG_DIR"/backend.log "$LOG_DIR"/frontend.log

# anvil：优先直接用，没有就走 nix-shell
if command -v anvil &>/dev/null; then
    ANVIL_CMD="anvil"
else
    ANVIL_CMD="nix-shell -p foundry --run anvil"
fi

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

$ANVIL_CMD --state "$STATE_DIR" --state-interval 30 --host 127.0.0.1 --port 8545 > "$LOG_DIR/anvil.log" 2>&1 &
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
log "链已就绪 (port 8545)"

# 3. 部署合约（首次）或复用地址
if [ "$SKIP_DEPLOY" -eq 1 ] && [ -f "$ADDR_FILE" ]; then
    ADDR=$(cat "$ADDR_FILE")
    log "复用合约: $ADDR"
else
    log "部署合约..."
    OUT=$(npx hardhat run contracts/deploy.js --network localhost 2>&1)
    ADDR=$(echo "$OUT" | grep -oP '0x[a-fA-F0-9]{40}' | tail -1)
    if [ -z "$ADDR" ]; then die "部署失败: $OUT"; fi
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
fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
source venv/bin/activate
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port $BACKEND_PORT > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
log "等后端就绪..."
for i in $(seq 1 8); do
    sleep 1
    curl -s http://127.0.0.1:$BACKEND_PORT/ > /dev/null 2>&1 && break
done
curl -s http://127.0.0.1:$BACKEND_PORT/ > /dev/null 2>&1 \
    && log "后端: http://127.0.0.1:$BACKEND_PORT" \
    || warn "后端可能还在启动，查看 $LOG_DIR/backend.log"

# 6. 前端
cd "$DIR/frontend"
fuser -k 3000/tcp 2>/dev/null || true
nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
log "等前端就绪..."
for i in $(seq 1 12); do
    sleep 1
    curl -s http://localhost:3000 > /dev/null 2>&1 && break
done
curl -s http://localhost:3000 > /dev/null 2>&1 \
    && log "前端: http://localhost:3000" \
    || warn "前端可能还在编译，查看 $LOG_DIR/frontend.log"

# 保存 PID
echo "$ANVIL_PID $BACKEND_PID $FRONTEND_PID" > "$LOG_DIR/pids.txt"

echo ""
echo -e "${GREEN}启动完成！${NC}"
echo "  链状态每 30 秒自动存盘 → $STATE_DIR"
echo "  日志目录 → $LOG_DIR"
echo "  重启后数据不丢，兄弟放心"
