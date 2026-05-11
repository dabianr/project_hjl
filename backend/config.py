import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    RPC_URL: str = os.getenv("RPC_URL", "http://127.0.0.1:8545")
    CONTRACT_ADDRESS: str = os.getenv("CONTRACT_ADDRESS", "")
    PRIVATE_KEY: str = os.getenv("PRIVATE_KEY", "")
    CHAIN_ID: int = int(os.getenv("CHAIN_ID", "31337"))

    IPFS_API_URL: str = os.getenv("IPFS_API_URL", "http://127.0.0.1:5001/api/v0")
    IPFS_MOCK: bool = os.getenv("IPFS_MOCK", "true").lower() == "true"

    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "evidence.db")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))
    RATE_LIMIT: str = os.getenv("RATE_LIMIT", "30/minute")


settings = Settings()
