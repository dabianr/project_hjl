import os
import uuid
import time
import logging
import aiosqlite
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from gmssl import sm3

from config import settings
from database import init_db
from models import UploadResponse, VerifyResponse, EvidenceDetail, StatsResponse, ErrorResponse
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
    yield


app = FastAPI(
    title="区块链电子文件存证系统 API",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


def _compute_sm3(file_path: str) -> str:
    sm3_obj = sm3.SM3()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sm3_obj.update(chunk)
    return sm3_obj.hexdigest()


def _compute_sha256(file_path: str) -> str:
    import hashlib
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()


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
):
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    file_ext = os.path.splitext(file.filename or "unknown")[1]
    save_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4().hex}{file_ext}")
    with open(save_path, "wb") as f:
        f.write(content)

    try:
        try:
            file_hash = _compute_sm3(save_path)
            hash_algo = "SM3"
        except Exception:
            file_hash = _compute_sha256(save_path)
            hash_algo = "SHA-256"

        ipfs_cid = await upload_to_ipfs(save_path)
        tx_result = await upload_evidence_onchain(file_hash, file.filename or "unknown", ipfs_cid)

        db = await aiosqlite.connect(settings.DATABASE_PATH)
        db.row_factory = aiosqlite.Row
        await db.execute(
            "INSERT INTO operation_logs (file_hash, file_name, uploader, ipfs_cid, tx_hash, block_number) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (file_hash, file.filename or "unknown", uploader or "anonymous",
             ipfs_cid, tx_result["tx_hash"], tx_result["block_number"]),
        )
        await db.commit()
        await db.close()

        return UploadResponse(
            success=True, file_hash=file_hash, file_name=file.filename or "unknown",
            ipfs_cid=ipfs_cid, tx_hash=tx_result["tx_hash"],
            block_number=tx_result["block_number"],
            message=f"存证成功 | {hash_algo}",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(save_path):
            os.remove(save_path)


@app.get("/verify/{file_hash}", response_model=VerifyResponse)
@limiter.limit(settings.RATE_LIMIT)
async def verify_file(request: Request, file_hash: str):
    exists, evidence = await verify_evidence_onchain(file_hash)
    if not exists:
        return VerifyResponse(exists=False, verified=False, message="未找到存证记录")
    return VerifyResponse(
        exists=True, verified=True,
        evidence=EvidenceDetail(file_hash=evidence[0], file_name=evidence[1],
                                uploader=evidence[2], timestamp=evidence[3],
                                ipfs_cid=evidence[4]),
        message="区块链权威认证：该文件已存证且未被篡改",
    )


@app.get("/evidence/{file_hash}")
async def get_evidence_detail(file_hash: str):
    detail = await get_evidence_onchain(file_hash)
    if detail is None:
        raise HTTPException(status_code=404, detail="存证记录不存在")
    return detail


@app.get("/stats", response_model=StatsResponse)
async def get_stats(uploader: Optional[str] = Query(None)):
    return StatsResponse(**await get_contract_stats(uploader or ""))


@app.get("/logs")
async def get_operation_logs(limit: int = 50, offset: int = 0):
    db = await aiosqlite.connect(settings.DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    cursor = await db.execute(
        "SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    rows = await cursor.fetchall()
    await db.close()
    return {"total": len(rows), "logs": [dict(row) for row in rows]}
