# 区块链层：web3 合约调用、发交易、查数据
# 所有函数加了 RPC 重试，网络抽风不怕

import json
import os
import asyncio
import functools
from web3 import Web3
from eth_account import Account
from config import settings

w3 = Web3(Web3.HTTPProvider(settings.RPC_URL))

_ABI_PATH = os.path.join(os.path.dirname(__file__), "..", "artifacts", "contracts",
                         "EvidenceStorage.sol", "EvidenceStorage.json")


def _load_abi():
    if not os.path.exists(_ABI_PATH):
        raise RuntimeError(
            f"合约 ABI 文件不存在: {_ABI_PATH}\n"
            f"请先运行: cd {os.path.join(os.path.dirname(__file__), '..')} && npx hardhat compile"
        )
    with open(_ABI_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["abi"]


def get_contract():
    address = w3.to_checksum_address(settings.CONTRACT_ADDRESS)
    return w3.eth.contract(address=address, abi=_load_abi())


# RPC 重试装饰器，最多重试 max_retries 次，指数退避
def _retry_on_rpc_error(max_retries=3, base_delay=1.0):
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
                        import logging
                        logging.getLogger(__name__).warning(
                            f"RPC failed (attempt {attempt + 1}): {e}, retrying in {delay:.1f}s"
                        )
                        await asyncio.sleep(delay)
                    else:
                        break
            raise RuntimeError(f"RPC failed after {max_retries} retries: {last_exc}")
        return wrapper
    return decorator


@_retry_on_rpc_error(max_retries=3, base_delay=1.0)
async def upload_evidence_onchain(file_hash: str, file_name: str, ipfs_cid: str) -> dict:
    """存证上链，需要 PRIVATE_KEY，gas 写死 200 万"""
    if not settings.PRIVATE_KEY:
        raise RuntimeError("PRIVATE_KEY not configured")

    contract = get_contract()
    account = Account.from_key(settings.PRIVATE_KEY)

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
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return {
        "tx_hash": receipt.transactionHash.hex(),
        "block_number": receipt.blockNumber,
    }


@_retry_on_rpc_error(max_retries=2, base_delay=0.5)
async def get_evidence_onchain(file_hash: str) -> dict | None:
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
        return None


@_retry_on_rpc_error(max_retries=2, base_delay=0.5)
async def verify_evidence_onchain(file_hash: str) -> tuple:
    contract = get_contract()
    return contract.functions.verifyEvidence(file_hash).call()


@_retry_on_rpc_error(max_retries=2, base_delay=0.5)
async def get_contract_stats(uploader_address: str = "") -> dict:
    contract = get_contract()
    total = contract.functions.totalEvidenceCount().call()
    paused = contract.functions.paused().call()
    block_height = w3.eth.block_number

    your_count = 0
    if uploader_address and Web3.is_address(uploader_address):
        your_count = contract.functions.getUploaderEvidenceCount(
            w3.to_checksum_address(uploader_address)
        ).call()

    return {
        "total_evidence_count": total,
        "current_block_height": block_height,
        "your_evidence_count": your_count,
        "contract_paused": paused,
    }
