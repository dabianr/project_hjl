# IPFS 上传服务，支持真实模式和 Mock 模式
# Mock 模式无需运行 IPFS 节点，本地算假 CID

import hashlib
import os
import aiofiles
from config import settings


async def upload_to_ipfs(file_path: str) -> str:
    if settings.IPFS_MOCK:
        return await _mock_upload(file_path)
    return await _real_upload(file_path)


async def _mock_upload(file_path: str) -> str:
    # Mock: SHA-256 + MD5 拼出伪 CID
    async with aiofiles.open(file_path, "rb") as f:
        content = await f.read()
    sha256_hash = hashlib.sha256(content).hexdigest()
    name_hash = hashlib.md5(os.path.basename(file_path).encode()).hexdigest()[:8]
    return f"mock-cid-{sha256_hash[:16]}-{name_hash}"


async def _real_upload(file_path: str) -> str:
    # 真实 IPFS HTTP API，aiohttp 异步上传
    import aiohttp

    url = f"{settings.IPFS_API_URL.rstrip('/')}/add"
    async with aiohttp.ClientSession() as session:
        async with aiofiles.open(file_path, "rb") as f:
            file_content = await f.read()

        data = aiohttp.FormData()
        data.add_field("file", file_content, filename=os.path.basename(file_path))
        async with session.post(url, data=data) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise RuntimeError(f"IPFS upload failed: {text}")
            result = await resp.json()
            return result["Hash"]
