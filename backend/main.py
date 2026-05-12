# BlockProof API 主入口 — FastAPI
# SQLite 用 Depends 注入，不用每次手动开关连接

import os
import uuid
import time
import logging
import asyncio
import aiosqlite
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Query, Depends
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
    VerifyResponse, EvidenceDetail, StatsResponse, ErrorResponse,
)
from auth import require_auth
from ipfs_service import upload_to_ipfs
from blockchain_service import (
    upload_evidence_onchain, get_evidence_onchain,
    verify_evidence_onchain, get_contract_stats,
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
async def get_stats(uploader: Optional[str] = Query(None)):
    """合约统计"""
    return StatsResponse(**await get_contract_stats(uploader or ""))


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


@app.get("/logs")
async def get_operation_logs(
    limit: int = 50,
    offset: int = 0,
    db: aiosqlite.Connection = Depends(get_db),
    _auth=Depends(require_auth),
):
    """操作日志分页"""
    cursor = await db.execute(
        "SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    rows = await cursor.fetchall()
    return {"total": len(rows), "logs": [dict(row) for row in rows]}
