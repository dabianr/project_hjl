#!/usr/bin/env bash
# 依赖检测脚本
# 用法: bash check-deps.sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
ok() { echo -e "  ${GREEN}✅${NC} $1"; }
no() { echo -e "  ${RED}❌${NC} $1"; }
ISSUES=0

echo "=== 根 npm (Hardhat) ==="
cd "$DIR"
if [ -d "node_modules" ]; then
    ok "node_modules"
    for p in hardhat "@nomicfoundation/hardhat-toolbox"; do
        [ -d "node_modules/$p" ] && ok "$p" || { no "$p"; ISSUES=$((ISSUES+1)); }
    done
else
    no "node_modules"
    echo "    → npm install"
    ISSUES=$((ISSUES+1))
fi

echo ""; echo "=== 前端 npm (React) ==="
cd "$DIR/frontend"
if [ -d "node_modules" ]; then
    ok "node_modules"
    for p in react react-dom axios react-dropzone lucide-react; do
        [ -d "node_modules/$p" ] && ok "$p" || { no "$p"; ISSUES=$((ISSUES+1)); }
    done
else
    no "node_modules"
    echo "    → npm install"
    ISSUES=$((ISSUES+1))
fi

echo ""; echo "=== 后端 pip (FastAPI) ==="
cd "$DIR/backend"
for p in fastapi uvicorn web3 gmssl aiofiles aiosqlite slowapi dotenv; do
    python3 -c "import $p" 2>/dev/null && ok "$p" || { no "$p"; ISSUES=$((ISSUES+1)); }
done

echo ""
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}全部就绪 ✅${NC}"
else
    echo -e "${RED}$ISSUES 个缺失${NC}"
    echo "一键修复:"
    echo "  cd $DIR && npm install"
    echo "  cd $DIR/frontend && npm install"
    echo "  cd $DIR/backend && pip install -r requirements.txt"
fi
