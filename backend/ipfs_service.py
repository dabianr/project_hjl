# 铁子们，IPFS 上传服务
# 支持真实模式和摸鱼模式（Mock），不想搭 IPFS 节点就先 mock 着用
# 改了：之前那个同步 open() 纯纯内鬼，异步函数里用同步 IO 等于堵马路中间唠嗑
# 现在用 aiofiles，全链路异步，舒服了

import hashlib
import os
import aiofiles
from config import settings


async def upload_to_ipfs(file_path: str) -> str:
    # 兄弟，IPFS_MOCK=true 就是摸鱼模式，不用真节点
    # 直接本地算个假 CID 返回
    if settings.IPFS_MOCK:
        return await _mock_upload(file_path)
    return await _real_upload(file_path)


async def _mock_upload(file_path: str) -> str:
    # 假的也给你做得像真的，SHA-256 + MD5 拼一下
    # 看起来还挺像那么回事儿的嗷
    async with aiofiles.open(file_path, "rb") as f:
        content = await f.read()
    sha256_hash = hashlib.sha256(content).hexdigest()
    # 文件名也混进去，至少不同文件不会撞 CID
    name_hash = hashlib.md5(os.path.basename(file_path).encode()).hexdigest()[:8]
    return f"mock-cid-{sha256_hash[:16]}-{name_hash}"


async def _real_upload(file_path: str) -> str:
    # 真实的 IPFS 上传，调 HTTP API
    # 注意了嗷铁子：这里用 aiohttp 异步请求，别给我搞同步阻塞
    # 之前的 open(file_path, 'rb') 是纯纯的菜鸟写法，已毙掉
    import aiohttp

    url = f"{settings.IPFS_API_URL.rstrip('/')}/add"
    async with aiohttp.ClientSession() as session:
        # 现在用 aiofiles 异步读文件，不卡事件循环了
        async with aiofiles.open(file_path, "rb") as f:
            file_content = await f.read()

        data = aiohttp.FormData()
        data.add_field(
            "file",
            file_content,
            filename=os.path.basename(file_path),
        )
        async with session.post(url, data=data) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise RuntimeError(f"IPFS 上传翻车了: {text}")
            result = await resp.json()
            return result["Hash"]
