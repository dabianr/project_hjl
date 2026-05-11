import hashlib
import os
import aiofiles
from config import settings


async def upload_to_ipfs(file_path: str) -> str:
    if settings.IPFS_MOCK:
        return await _mock_upload(file_path)
    return await _real_upload(file_path)


async def _mock_upload(file_path: str) -> str:
    async with aiofiles.open(file_path, "rb") as f:
        content = await f.read()
    sha256_hash = hashlib.sha256(content).hexdigest()
    name_hash = hashlib.md5(os.path.basename(file_path).encode()).hexdigest()[:8]
    return f"mock-cid-{sha256_hash[:16]}-{name_hash}"


async def _real_upload(file_path: str) -> str:
    import aiohttp
    url = f"{settings.IPFS_API_URL.rstrip('/')}/add"
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field("file", open(file_path, "rb"), filename=os.path.basename(file_path))
        async with session.post(url, data=data) as resp:
            if resp.status != 200:
                raise RuntimeError(f"IPFS upload failed: {await resp.text()}")
            return (await resp.json())["Hash"]
