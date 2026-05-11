# 铁子，这里是区块链层面的所有交互
# web3 调合约、发交易、查数据都在这里
# 注意了嗷：之前 RPC 抽风直接炸，现在加了重试，网卡了也知道再试两次

import json
import os
import asyncio
import functools
from web3 import Web3
from eth_account import Account
from config import settings

w3 = Web3(Web3.HTTPProvider(settings.RPC_URL))

_ABI_PATH = os.path.join(
    os.path.dirname(__file__), "..", "artifacts", "contracts",
    "EvidenceStorage.sol", "EvidenceStorage.json"
)

# 兜底 ABI——万一编译产物没找到就硬编码顶上
# 这波属于留个后手，不至于合约部署完连不上
_FALLBACK_ABI = json.loads("""[
    {"type":"constructor","inputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"getAllEvidenceHashes","inputs":[{"name":"offset","type":"uint256"},{"name":"limit","type":"uint256"}],"outputs":[{"name":"hashes","type":"string[]"},{"name":"total","type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"getEvidence","inputs":[{"name":"fileHash","type":"string"}],"outputs":[{"name":"","type":"tuple","components":[{"name":"fileHash","type":"string"},{"name":"fileName","type":"string"},{"name":"uploader","type":"address"},{"name":"timestamp","type":"uint256"},{"name":"ipfsCID","type":"string"}]}],"stateMutability":"view"},
    {"type":"function","name":"getUploaderEvidenceCount","inputs":[{"name":"uploader","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address"}],"stateMutability":"view"},
    {"type":"function","name":"pause","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"paused","inputs":[],"outputs":[{"name":"","type":"bool"}],"stateMutability":"view"},
    {"type":"function","name":"totalEvidenceCount","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"unpause","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"uploadEvidence","inputs":[{"name":"fileHash","type":"string"},{"name":"fileName","type":"string"},{"name":"ipfsCID","type":"string"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"verifyEvidence","inputs":[{"name":"fileHash","type":"string"}],"outputs":[{"name":"exists","type":"bool"},{"name":"evidence","type":"tuple","components":[{"name":"fileHash","type":"string"},{"name":"fileName","type":"string"},{"name":"uploader","type":"address"},{"name":"timestamp","type":"uint256"},{"name":"ipfsCID","type":"string"}]}],"stateMutability":"view"},
    {"type":"event","name":"ContractPaused","inputs":[{"name":"by","type":"address","indexed":true}],"anonymous":false},
    {"type":"event","name":"ContractUnpaused","inputs":[{"name":"by","type":"address","indexed":true}],"anonymous":false},
    {"type":"event","name":"EvidenceCreated","inputs":[{"name":"fileHash","type":"string","indexed":true},{"name":"fileName","type":"string","indexed":false},{"name":"uploader","type":"address","indexed":true},{"name":"timestamp","type":"uint256","indexed":false},{"name":"ipfsCID","type":"string","indexed":false}],"anonymous":false}
]""")


def _load_abi():
    # 优先读编译产物，读不到就硬编码兜底
    if os.path.exists(_ABI_PATH):
        with open(_ABI_PATH, "r", encoding="utf-8") as f:
            return json.load(f).get("abi", _FALLBACK_ABI)
    return _FALLBACK_ABI


def get_contract():
    address = w3.to_checksum_address(settings.CONTRACT_ADDRESS)
    return w3.eth.contract(address=address, abi=_load_abi())


# ──────────────────────────────────────────────


# 铁子，这是自制的重试装饰器
# 以太坊 RPC 偶尔抽风太常见了，之前一抽就报 500 属于纯纯搞人心态
# 现在最多重试 3 次，指数退避，1s → 2s → 4s，给足面子
# 问就是血泪教训，不问也是
def _retry_on_rpc_error(max_retries=3, base_delay=1.0):
    """RPC 翻车自动重试，最多 {max_retries} 次，每次等更久"""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exc = e
                    if attempt < max_retries:
                        delay = base_delay * (2 ** attempt)
                        # 别慌，只是重试而已
                        import logging
                        logging.getLogger(__name__).warning(
                            f"RPC 翻车第 {attempt + 1} 次 ({e})，{delay:.1f}s 后再来..."
                        )
                        await asyncio.sleep(delay)
                    else:
                        break
            raise RuntimeError(f"重试 {max_retries} 次依然翻车，RPC 可能真挂了: {last_exc}")
        return wrapper
    return decorator


# ──────────────────────────────────────────────


@_retry_on_rpc_error(max_retries=3, base_delay=1.0)
async def upload_evidence_onchain(file_hash: str, file_name: str, ipfs_cid: str) -> dict:
    """
    把存证信息干上链
    需要 PRIVATE_KEY 私钥，没配就报错——这不废话吗没钥匙签不了名
    重试 3 次，RPC 抽风不怕
    """
    if not settings.PRIVATE_KEY:
        raise RuntimeError("PRIVATE_KEY 没配啊兄弟，拿什么签名交易？")

    contract = get_contract()
    account = Account.from_key(settings.PRIVATE_KEY)

    # 组装交易，gas 写死 200 万，够用了
    # 这波不用估计 gas，直接写死，省得 RPC 多调一次 eth_estimateGas
    txn = contract.functions.uploadEvidence(
        file_hash, file_name, ipfs_cid
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 2000000,
        "gasPrice": w3.eth.gas_price,
        "chainId": settings.CHAIN_ID,
    })

    signed_txn = account.sign_transaction(txn)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)

    # 等区块确认，这步最慢，耐心点
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return {
        "tx_hash": receipt.transactionHash.hex(),
        "block_number": receipt.blockNumber,
    }


@_retry_on_rpc_error(max_retries=2, base_delay=0.5)
async def get_evidence_onchain(file_hash: str) -> dict | None:
    """
    从链上查存证详情
    查不到就返回 None，别慌
    """
    contract = get_contract()
    try:
        result = contract.functions.getEvidence(file_hash).call()
        return {
            "file_hash": result[0],
            "file_name": result[1],
            "uploader": result[2],
            "timestamp": result[3],
            "ipfs_cid": result[4],
        }
    except Exception:
        # 合约会 revert "Not found"，这里吞掉返回 None
        return None


@_retry_on_rpc_error(max_retries=2, base_delay=0.5)
async def verify_evidence_onchain(file_hash: str) -> tuple:
    """
    验证存证是否存在
    返回 (exists: bool, evidence: tuple)
    """
    contract = get_contract()
    return contract.functions.verifyEvidence(file_hash).call()


@_retry_on_rpc_error(max_retries=2, base_delay=0.5)
async def get_contract_stats(uploader_address: str = "") -> dict:
    """
    拉合约统计数据
    总数、区块高度、某地址数量、是否暂停
    """
    contract = get_contract()
    total = contract.functions.totalEvidenceCount().call()
    paused = contract.functions.paused().call()
    block_height = w3.eth.block_number

    your_count = 0
    if uploader_address:
        your_count = contract.functions.getUploaderEvidenceCount(
            w3.to_checksum_address(uploader_address)
        ).call()

    return {
        "total_evidence_count": total,
        "current_block_height": block_height,
        "your_evidence_count": your_count,
        "contract_paused": paused,
    }
