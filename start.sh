#!/usr/bin/env bash
# BlockProof 一键启动 (NixOS + fish shell)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
banner(){ echo -e "${CYAN}$1${NC}"; }

banner "BlockProof 一键启动"

# ── 0. 权限 ──
[ -w "$DIR" ] || { warn "修权限..."; sudo chown -R "$USER:users" "$DIR"; }

# ── 1. 依赖检查 ──
[ -d "$DIR/node_modules" ] || { log "安装根依赖..."; cd "$DIR"; npm install; }
[ -d "$DIR/frontend/node_modules" ] || { log "安装前端依赖..."; cd "$DIR/frontend"; npm install; }
[ -d "$DIR/backend/venv" ] || {
    log "创建后端 venv..."; cd "$DIR/backend"; python3 -m venv venv
    source venv/bin/activate; pip install -q -r requirements.txt
}

# ── 2. 编译合约 ──
[ -d "$DIR/artifacts" ] || { log "编译合约..."; cd "$DIR"; npx hardhat compile; }

# ── 3. 启动链 ──
NIXPKGS_ALLOW_UNFREE=1 nix-shell -p nodejs solc steam-run \
    --run "steam-run npx hardhat node" > /tmp/hardhat-node.log 2>&1 &
sleep 4

# ── 4. 部署合约 ──
cd "$DIR"
ADDR=$(npx hardhat run contracts/deploy.js --network localhost 2>&1 | grep -oP '0x[a-fA-F0-9]{40}')
[ -z "$ADDR" ] && { warn "部署失败，检查 /tmp/hardhat-node.log"; exit 1; }
log "合约: $ADDR"

# ── 5. 写 .env ──
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

# ── 6. 后端 ──
source venv/bin/activate
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/backend.log 2>&1 &
log "后端: http://127.0.0.1:8000"

# ── 7. 前端 ──
cd "$DIR/frontend"
BROWSER=none npm start > /tmp/frontend.log 2>&1 &
log "前端: http://localhost:3000"

echo ""
banner "启动完成！浏览器打开 http://localhost:3000"
