import json
import os
from web3 import Web3
from eth_account import Account
from config import settings

w3 = Web3(Web3.HTTPProvider(settings.RPC_URL))

_ABI_PATH = os.path.join(os.path.dirname(__file__), "..", "artifacts", "contracts",
                         "EvidenceStorage.sol", "EvidenceStorage.json")

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
    if os.path.exists(_ABI_PATH):
        with open(_ABI_PATH, "r", encoding="utf-8") as f:
            return json.load(f).get("abi", _FALLBACK_ABI)
    return _FALLBACK_ABI


def get_contract():
    address = w3.to_checksum_address(settings.CONTRACT_ADDRESS)
    return w3.eth.contract(address=address, abi=_load_abi())


async def upload_evidence_onchain(file_hash: str, file_name: str, ipfs_cid: str) -> dict:
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


async def verify_evidence_onchain(file_hash: str) -> tuple:
    contract = get_contract()
    return contract.functions.verifyEvidence(file_hash).call()


async def get_contract_stats(uploader_address: str = "") -> dict:
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
