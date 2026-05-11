# Pydantic 数据模型，定义了所有 API 的请求/响应格式

from pydantic import BaseModel
from typing import Optional, List


class UploadResponse(BaseModel):
    success: bool
    file_hash: str
    file_name: str
    ipfs_cid: str
    tx_hash: str
    block_number: int
    message: str


class BatchItemResult(BaseModel):
    """批量上传中单个文件的结果"""
    file_name: str
    success: bool
    file_hash: Optional[str] = None
    ipfs_cid: Optional[str] = None
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    error: Optional[str] = None


class BatchUploadResponse(BaseModel):
    """批量上传整体响应"""
    total: int
    succeeded: int
    failed: int
    results: List[BatchItemResult]
    message: str


class EvidenceDetail(BaseModel):
    file_hash: str
    file_name: str
    uploader: str
    timestamp: int
    ipfs_cid: str


class VerifyResponse(BaseModel):
    exists: bool
    verified: bool
    evidence: Optional[EvidenceDetail] = None
    message: str


class StatsResponse(BaseModel):
    total_evidence_count: int
    current_block_height: int
    your_evidence_count: int
    contract_paused: bool


class ErrorResponse(BaseModel):
    detail: str
