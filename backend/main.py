# BlockProof API 主入口 — FastAPI
# SQLite 用 Depends 注入，不用每次手动开关连接

import os
import uuid
import time
import logging
import asyncio
import datetime
import jwt
import io
import aiosqlite
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Query, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from gmssl import sm3

from config import settings
from database import init_db
from models import (
    TrendResponse,
    UploadResponse, BatchUploadResponse, BatchItemResult,
    VerifyResponse, EvidenceDetail, StatsResponse, ErrorResponse, LoginRequest,
)
from auth import require_auth
from ipfs_service import upload_to_ipfs

# JWT 配置
JWT_SECRET = os.getenv("JWT_SECRET", "blockproof-local-jwt-secret-change-in-production")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer(auto_error=False)

async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """验证 JWT token"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="需要管理员权限")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="不是管理员")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的 Token")
from web3 import Web3
from blockchain_service import (
    upload_evidence_onchain, get_evidence_onchain,
    verify_evidence_onchain, get_contract_stats, get_contract,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info("Server started")
    yield
    logger.info("Server stopped")


app = FastAPI(
    title="区块链电子文件存证系统 API",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


async def get_db():
    """每个请求一个 SQLite 连接，用完后自动关闭"""
    db = await aiosqlite.connect(settings.DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


def _compute_sm3(file_path: str) -> str:
    """国密 SM3 哈希"""
    sm3_obj = sm3.SM3()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sm3_obj.update(chunk)
    return sm3_obj.hexdigest()


def _compute_sha256(file_path: str) -> str:
    """SHA-256 哈希"""
    import hashlib
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()


def _compute_hash(file_path: str) -> tuple:
    """计算文件哈希，优先 SM3，失败 fallback SHA-256"""
    try:
        return _compute_sm3(file_path), "SM3"
    except Exception:
        return _compute_sha256(file_path), "SHA-256"


async def _process_single_file(
    file: UploadFile, uploader: str, db: aiosqlite.Connection
) -> BatchItemResult:
    """处理单个文件的上传+存证流水线，返回结果"""
    file_name = file.filename or "unknown"
    try:
        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            return BatchItemResult(
                file_name=file_name, success=False,
                error=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit"
            )

        # 写临时文件
        file_ext = os.path.splitext(file_name)[1]
        save_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4().hex}{file_ext}")
        with open(save_path, "wb") as f:
            f.write(content)

        try:
            file_hash, hash_algo = _compute_hash(save_path)
            ipfs_cid = await upload_to_ipfs(save_path)
            tx_result = await upload_evidence_onchain(file_hash, file_name, ipfs_cid)

            await db.execute(
                "INSERT INTO operation_logs (file_hash, file_name, uploader, ipfs_cid, tx_hash, block_number) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (file_hash, file_name, uploader or "anonymous",
                 ipfs_cid, tx_result["tx_hash"], tx_result["block_number"]),
            )
            await db.commit()

            return BatchItemResult(
                file_name=file_name, success=True, file_hash=file_hash,
                ipfs_cid=ipfs_cid, tx_hash=tx_result["tx_hash"],
                block_number=tx_result["block_number"],
            )
        finally:
            if os.path.exists(save_path):
                os.remove(save_path)
    except Exception as e:
        logger.error(f"Batch item failed: {file_name} — {e}")
        return BatchItemResult(file_name=file_name, success=False, error=str(e))


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({time.time() - start:.3f}s)")
    return response


@app.get("/")
async def root():
    return {"service": "区块链电子文件存证系统", "version": "1.0.0"}


@app.post("/upload", response_model=UploadResponse)
@limiter.limit(settings.RATE_LIMIT)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    uploader: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
    _auth=Depends(require_auth),
):
    """上传单个文件并存证"""
    result = await _process_single_file(file, uploader or "", db)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return UploadResponse(
        success=True, file_hash=result.file_hash, file_name=result.file_name,
        ipfs_cid=result.ipfs_cid, tx_hash=result.tx_hash,
        block_number=result.block_number, message="存证成功",
    )


@app.post("/batch-upload", response_model=BatchUploadResponse)
@limiter.limit(settings.RATE_LIMIT)
async def batch_upload_files(
    request: Request,
    files: List[UploadFile] = File(...),
    uploader: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
    _auth=Depends(require_auth),
):
    """
    批量上传多个文件并存证
    文件并发处理（asyncio.gather），单个失败不影响其他
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # 并发处理所有文件，各管各的
    tasks = [_process_single_file(f, uploader or "", db) for f in files]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 把异常转成 BatchItemResult
    final_results = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            final_results.append(BatchItemResult(
                file_name=files[i].filename or "unknown",
                success=False, error=str(r),
            ))
        else:
            final_results.append(r)

    succeeded = sum(1 for r in final_results if r.success)
    failed = len(final_results) - succeeded

    return BatchUploadResponse(
        total=len(final_results),
        succeeded=succeeded,
        failed=failed,
        results=final_results,
        message=f"批量上传完成: {succeeded} 成功, {failed} 失败",
    )


@app.get("/verify/{file_hash}", response_model=VerifyResponse)
@limiter.limit(settings.RATE_LIMIT)
async def verify_file(request: Request, file_hash: str):
    """验证存证是否存在"""
    exists, evidence = await verify_evidence_onchain(file_hash)
    if not exists:
        return VerifyResponse(exists=False, verified=False, message="未找到存证记录")
    return VerifyResponse(
        exists=True, verified=True,
        evidence=EvidenceDetail(
            file_hash=evidence[0], file_name=evidence[1],
            uploader=evidence[2], timestamp=evidence[3], ipfs_cid=evidence[4],
        ),
        message="区块链权威认证：该文件已存证且未被篡改",
    )


@app.get("/evidence/{file_hash}")
async def get_evidence_detail(file_hash: str):
    """查询存证详情"""
    detail = await get_evidence_onchain(file_hash)
    if detail is None:
        raise HTTPException(status_code=404, detail="存证记录不存在")
    return detail


@app.get("/stats", response_model=StatsResponse)
async def get_stats(
    uploader: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    """合约统计 + 个人存证数（支持钱包地址或 device_id）+ 今日存证数"""
    stats = await get_contract_stats(uploader or "")
    if uploader:
        cursor = await db.execute(
            "SELECT COUNT(DISTINCT tx_hash) FROM operation_logs WHERE uploader = ?",
            (uploader,)
        )
        row = await cursor.fetchone()
        if row and row[0]:
            stats["your_evidence_count"] = row[0]

    # 今日存证数
    today_cursor = await db.execute(
        "SELECT COUNT(*) FROM operation_logs WHERE DATE(created_at) = DATE('now')"
    )
    today_row = await today_cursor.fetchone()
    stats["today_count"] = today_row[0] if today_row else 0

    return StatsResponse(**stats)


@app.get("/trend", response_model=TrendResponse)
async def get_trend(days: int = 7, db: aiosqlite.Connection = Depends(get_db)):
    """最近 N 天存证趋势，给前端折线图用"""
    cursor = await db.execute(
        "SELECT DATE(created_at) as date, COUNT(*) as count FROM operation_logs "
        "WHERE created_at >= DATE('now', ?) GROUP BY date ORDER BY date",
        (f"-{days} days",),
    )
    rows = await cursor.fetchall()
    data = [{"date": r["date"], "count": r["count"]} for r in rows]
    return TrendResponse(data=data)



# ===== 管理员登录 =====

@app.post("/admin/login")
async def admin_login(req: LoginRequest):
    """管理员登录，返回 JWT token"""
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = jwt.encode({
        "sub": req.username,
        "role": "admin",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
    }, JWT_SECRET, algorithm="HS256")

    return {"access_token": token, "token_type": "bearer"}


# ===== 管理员面板 ====

@app.get("/admin/status")
async def admin_status(db: aiosqlite.Connection = Depends(get_db), _auth=Depends(require_admin)):
    """管理员面板 — 系统完整状态"""
    contract = get_contract()
    contract_paused = contract.functions.paused().call()
    owner = contract.functions.owner().call()
    total = contract.functions.totalEvidenceCount().call()

    count_cursor = await db.execute("SELECT COUNT(*) FROM operation_logs")
    total_row = await count_cursor.fetchone()
    db_count = total_row[0] if total_row else 0

    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    temp_files = 0
    if os.path.exists(upload_dir):
        temp_files = len([f for f in os.listdir(upload_dir) if os.path.isfile(os.path.join(upload_dir, f))])

    return {
        "contract_paused": contract_paused,
        "contract_owner": owner,
        "total_evidence_onchain": total,
        "total_logs_in_db": db_count,
        "temp_upload_files": temp_files,
        "network": settings.RPC_URL,
    }


@app.post("/admin/contract/pause")
async def pause_contract(_auth=Depends(require_admin)):
    """暂停合约"""
    from blockchain_service import w3
    contract = get_contract()
    tx = contract.functions.pause().build_transaction({
        "from": w3.eth.account.from_key(settings.PRIVATE_KEY).address,
        "nonce": w3.eth.get_transaction_count(w3.eth.account.from_key(settings.PRIVATE_KEY).address),
        "gas": 200000,
        "gasPrice": w3.eth.gas_price,
        "chainId": settings.CHAIN_ID,
    })
    signed = w3.eth.account.sign_transaction(tx, settings.PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return {"success": True, "tx_hash": tx_hash.hex(), "block": receipt["blockNumber"]}


@app.post("/admin/contract/unpause")
async def unpause_contract(_auth=Depends(require_admin)):
    """恢复合约"""
    from blockchain_service import w3
    contract = get_contract()
    tx = contract.functions.unpause().build_transaction({
        "from": w3.eth.account.from_key(settings.PRIVATE_KEY).address,
        "nonce": w3.eth.get_transaction_count(w3.eth.account.from_key(settings.PRIVATE_KEY).address),
        "gas": 200000,
        "gasPrice": w3.eth.gas_price,
        "chainId": settings.CHAIN_ID,
    })
    signed = w3.eth.account.sign_transaction(tx, settings.PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return {"success": True, "tx_hash": tx_hash.hex(), "block": receipt["blockNumber"]}


@app.post("/admin/cleanup")
async def cleanup_temp(_auth=Depends(require_admin)):
    """清理上传临时文件"""
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    count = 0
    if os.path.exists(upload_dir):
        for f in os.listdir(upload_dir):
            fp = os.path.join(upload_dir, f)
            if os.path.isfile(fp):
                os.remove(fp)
                count += 1
    return {"success": True, "deleted_files": count}

@app.get("/admin/dashboard")
async def admin_dashboard(db: aiosqlite.Connection = Depends(get_db), _auth=Depends(require_admin)):
    """聚合仪表盘数据：设备统计 + 热日历"""
    from collections import Counter
    
    cursor = await db.execute("SELECT uploader FROM operation_logs")
    rows = await cursor.fetchall()
    uploaders = [r["uploader"] for r in rows if r["uploader"] and r["uploader"] != "anonymous"]
    device_stats = dict(Counter(uploaders).most_common(5))
    total_device_count = len(set(uploaders))
    
    heat = await db.execute(
        "SELECT DATE(created_at) as date, COUNT(*) as count FROM operation_logs "
        "WHERE created_at >= DATE('now', '-6 days') GROUP BY date ORDER BY date"
    )
    heat_data = await heat.fetchall()
    
    return {
        "device_stats": device_stats,
        "total_device_count": total_device_count,
        "heatmap": [{"date": r["date"], "count": r["count"]} for r in heat_data],
    }


# ===== PDF 证书 =====


@app.get("/certificate/{log_id}")
async def generate_certificate(
    log_id: int,
    db: aiosqlite.Connection = Depends(get_db),
):
    """生成存证 PDF 证书"""
    cursor = await db.execute(
        "SELECT * FROM operation_logs WHERE id = ?", (log_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="存证记录不存在")

    log = dict(row)

    # 构造证书编号：ZC-YYYYMMDD-{id:03d}
    created = datetime.datetime.fromisoformat(log["created_at"]) if isinstance(log["created_at"], str) else log["created_at"]
    cert_no = f"ZC-{created.strftime('%Y%m%d')}-{log_id:03d}"

    # 验证链接 — 前端验证页
    verify_url = f"https://bigdogbarks.top/?verify={log['file_hash']}"

    # 尝试导入 reportlab，失败则返回错误
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF 生成库未安装（reportlab）")

    # 注册 CJK 字体
    CJK_FONT = "Helvetica"
    import glob
    for pat in [
        "/nix/store/*ghostscript*/share/ghostscript/*/Resource/CIDFSubst/DroidSansFallback.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    ]:
        m = glob.glob(pat)
        if m:
            try:
                pdfmetrics.registerFont(TTFont("CJKFont", m[0]))
                CJK_FONT = "CJKFont"
            except Exception:
                pass
            break

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    # === 背景 ===
    c.setFillColor(HexColor("#F5F5F5"))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # === 上部：标题 + 基础信息 ===
    y_top = height - 60

    # 标题
    c.setFillColor(HexColor("#1a1a2e"))
    c.setFont(CJK_FONT, 22)
    c.drawCentredString(width / 2, y_top, "区块链电子数据存证证书")
    y_top -= 30

    # 证书编号
    c.setFont(CJK_FONT, 11)
    c.setFillColor(HexColor("#555555"))
    c.drawCentredString(width / 2, y_top, f"证书编号: {cert_no}")
    y_top -= 22

    # 分隔线
    c.setStrokeColor(HexColor("#CCCCCC"))
    c.line(50, y_top, width - 50, y_top)
    y_top -= 20

    # 信息行
    line_h = 26
    info_items = [
        ("文件名称", log.get("file_name", "N/A")),
        ("SM3 哈希", log.get("file_hash", "N/A")),
        ("IPFS CID", log.get("ipfs_cid", "N/A")),
        ("区块高度", str(log.get("block_number", "N/A"))),
        ("交易哈希", log.get("tx_hash", "N/A")),
        ("上传时间", log.get("created_at", "N/A")),
    ]

    c.setFont(CJK_FONT, 10)
    for label, value in info_items:
        c.setFillColor(HexColor("#333333"))
        # 动态截断长值显示
        text = str(value)
        if len(text) > 70:
            text = text[:67] + "..."
        c.drawString(55, y_top, f"{label}:  {text}")
        y_top -= line_h

    # === 下部：二维码区域 ===
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=4, border=2)
        qr.add_data(verify_url)
        qr.make(fit=True)
        matrix = qr.modules
        n = len(matrix)
        module_size = 3.5
        qr_size = n * module_size
        qr_x = (width - qr_size) / 2
        qr_y = 180  # 底部上方留空间给 footer

        # 白色背景
        c.setFillColor(HexColor("#FFFFFF"))
        c.roundRect(qr_x - 10, qr_y - 10, qr_size + 20, qr_size + 20, 6, fill=1, stroke=0)

        # 浅色边框
        c.setStrokeColor(HexColor("#DDDDDD"))
        c.roundRect(qr_x - 10, qr_y - 10, qr_size + 20, qr_size + 20, 6, fill=0, stroke=1)

        # 画黑色模块
        c.setFillColor(HexColor("#000000"))
        for row in range(n):
            for col in range(n):
                if matrix[row][col]:
                    c.rect(qr_x + col * module_size,
                           qr_y + (n - 1 - row) * module_size,
                           module_size, module_size, fill=1, stroke=0)

        # 二维码下方提示文字
        c.setFillColor(HexColor("#888888"))
        c.setFont(CJK_FONT, 8)
        c.drawCentredString(width / 2, qr_y + qr_size + 20, "扫码验证存证真伪")
        c.setFont("Helvetica", 6)
        c.drawCentredString(width / 2, qr_y + qr_size + 10, verify_url)
    except ImportError:
        # qrcode 未装 — 显示文字链接
        c.setFont(CJK_FONT, 9)
        c.setFillColor(HexColor("#666666"))
        c.drawCentredString(width / 2, height * 0.35, "验证链接（复制到浏览器打开）：")
        c.setFont("Helvetica", 7)
        c.setFillColor(HexColor("#8b5cf6"))
        c.drawCentredString(width / 2, height * 0.35 - 14, verify_url)

    # === 底部说明 ===
    c.setFont(CJK_FONT, 8)
    c.setFillColor(HexColor("#999999"))
    c.drawCentredString(width / 2, 40, "本证书由区块链电子数据存证系统自动生成")
    c.drawCentredString(width / 2, 28, f"生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    c.save()
    buf.seek(0)

    filename = f"certificate_{log_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/logs")
async def get_operation_logs(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    uploader: Optional[str] = None,
    keyword: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
    _auth=Depends(require_auth),
):
    """操作日志分页，支持按 uploader 过滤和 keyword 搜索文件名"""

    # Build WHERE clauses dynamically
    conditions = []
    params = []

    if uploader:
        conditions.append("uploader = ?")
        params.append(uploader)

    if keyword:
        conditions.append("file_name LIKE ?")
        params.append(f"%{keyword}%")

    where_sql = ""
    if conditions:
        where_sql = " WHERE " + " AND ".join(conditions)

    # Count
    count_cursor = await db.execute(
        f"SELECT COUNT(*) FROM operation_logs{where_sql}", params
    )
    total_row = await count_cursor.fetchone()
    total_count = total_row[0] if total_row else 0

    # Data
    cursor = await db.execute(
        f"SELECT * FROM operation_logs{where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [*params, limit, offset],
    )
    rows = await cursor.fetchall()
    return {"total": total_count, "logs": [dict(row) for row in rows], "limit": limit, "offset": offset}
