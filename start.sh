#!/usr/bin/env bash
# BlockProof 一键启动脚本
# 用法: chmod +x start.sh && ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ENV_FILE="$BACKEND_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo -e "${CYAN}═══════════════════════════════════${NC}"
echo -e "${CYAN}  BlockProof 一键启动              ${NC}"
echo -e "${CYAN}═══════════════════════════════════${NC}"

# ── 0. 修权限 ──
if [ ! -w "$PROJECT_DIR" ]; then
    warn "目录权限不足，尝试修复..."
    sudo chown -R "$USER:users" "$PROJECT_DIR" 2>/dev/null || {
        err "请手动执行: sudo chown -R \$USER:users $PROJECT_DIR"
    }
    log "权限已修复"
fi

# ── 1. 检查 Node ──
echo ""
command -v node &>/dev/null || err "请先安装 Node.js >= 18"
log "Node.js $(node -v)"

# ── 2. 检查 Python ──
command -v python3 &>/dev/null || err "请先安装 Python >= 3.10"
log "Python $(python3 --version)"

# ── 3. 安装根依赖 + 编译合约 ──
echo ""
log "安装项目依赖..."
cd "$PROJECT_DIR"
npm install --silent 2>/dev/null || npm install

log "编译智能合约..."
npx hardhat compile --quiet 2>/dev/null

# ── 4. 启动本地链 ──
echo ""
log "启动 Hardhat 本地链 (后台)..."
npx hardhat node > /tmp/hardhat-node.log 2>&1 &
HARDHAT_PID=$!
sleep 2

if ! kill -0 $HARDHAT_PID 2>/dev/null; then
    err "Hardhat 节点启动失败，查看日志: cat /tmp/hardhat-node.log"
fi
log "Hardhat 节点已启动 (PID: $HARDHAT_PID)"

# ── 5. 部署合约 ──
echo ""
log "部署合约..."
DEPLOY_OUTPUT=$(npx hardhat run contracts/deploy.js --network localhost 2>&1)
CONTRACT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[a-fA-F0-9]{40}')

if [ -z "$CONTRACT_ADDR" ]; then
    kill $HARDHAT_PID 2>/dev/null
    err "合约部署失败: $DEPLOY_OUTPUT"
fi
log "合约已部署: $CONTRACT_ADDR"
log "Hardhat 默认账户私钥: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# ── 6. 写 .env ──
echo ""
log "生成后端配置..."
cat > "$ENV_FILE" <<EOF
# BlockProof 后端配置 (自动生成)
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=$CONTRACT_ADDR
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

# ── 7. 装后端依赖 ──
cd "$BACKEND_DIR"
pip install -q -r requirements.txt 2>/dev/null || pip install -r requirements.txt
log "后端依赖已安装"

# ── 8. 启动后端 ──
echo ""
log "启动后端 (后台, 端口 8000)..."
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    kill $HARDHAT_PID 2>/dev/null
    err "后端启动失败，查看日志: cat /tmp/backend.log"
fi
log "后端已启动 (PID: $BACKEND_PID)"

# ── 9. 装前端依赖 ──
cd "$FRONTEND_DIR"
log "安装前端依赖..."
npm install --silent 2>/dev/null || npm install
log "前端依赖已安装"

# ── 10. 启动前端 ──
echo ""
log "启动前端 (端口 3000)..."
BROWSER=none npm start &
FRONTEND_PID=$!
log "前端已启动 (PID: $FRONTEND_PID)"

# ── 保存 PID 方便关停 ──
cat > /tmp/blockproof-pids.sh <<EOF
#!/bin/bash
# BlockProof 关停脚本
kill $HARDHAT_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
echo "BlockProof 已停止"
EOF
chmod +x /tmp/blockproof-pids.sh

# ── 完成 ──
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  BlockProof 启动完成！                   ${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  前端:    ${CYAN}http://localhost:3000${NC}"
echo -e "  后端:    ${CYAN}http://127.0.0.1:8000${NC}"
echo -e "  API文档: ${CYAN}http://127.0.0.1:8000/docs${NC}"
echo -e "  合约:    ${CYAN}$CONTRACT_ADDR${NC}"
echo ""
echo -e "  关停:    ${YELLOW}bash /tmp/blockproof-pids.sh${NC}"
echo -e "  日志:    ${YELLOW}后端 tail -f /tmp/backend.log${NC}"
echo -e "          ${YELLOW}链   tail -f /tmp/hardhat-node.log${NC}"
echo ""
