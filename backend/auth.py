# API 认证 — 简单 token 校验
# 生产环境换 JWT，现在先用 API_KEY 顶着
import os
from fastapi import HTTPException, Header
from typing import Optional

from config import settings

# 从环境变量读，没配就跳过校验
API_KEY = os.getenv("API_KEY", "")


async def require_auth(x_api_key: Optional[str] = Header(None)):
    """没有 API_KEY 配就不管；配了就对不上就 401"""
    if not API_KEY:
        return  # 开发模式，放过
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
