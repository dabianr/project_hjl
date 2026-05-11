from pydantic import BaseModel
from typing import Optional


class UploadResponse(BaseModel):
    success: bool
    file_hash: str
    file_name: str
    ipfs_cid: str
    tx_hash: str
    block_number: int
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
