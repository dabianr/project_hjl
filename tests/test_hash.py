# 后端核心函数测试 — pytest
import os, sys, tempfile, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import _compute_sm3, _compute_sha256, _compute_hash


class TestHashFunctions:
    """SM3 和 SHA-256 哈希 — 确定性、一致性、fallback"""

    def test_sha256_deterministic(self):
        # 同一内容两次哈希，结果必须一样
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as f:
            f.write(b"hello blockchain")
            path = f.name
        try:
            h1 = _compute_sha256(path)
            h2 = _compute_sha256(path)
            assert h1 == h2
            assert len(h1) == 64  # SHA-256 = 64 hex chars
        finally:
            os.unlink(path)

    def test_sha256_different_content(self):
        # 不同内容，哈希不同
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"aaa")
            p1 = f.name
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"bbb")
            p2 = f.name
        try:
            assert _compute_sha256(p1) != _compute_sha256(p2)
        finally:
            os.unlink(p1); os.unlink(p2)

    def test_sm3_deterministic(self):
        # 国密 SM3，相同内容 = 相同哈希
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as f:
            f.write(b"blockchain evidence")
            path = f.name
        try:
            h1 = _compute_sm3(path)
            h2 = _compute_sm3(path)
            assert h1 == h2
            assert len(h1) == 64
        finally:
            os.unlink(path)

    def test_sm3_known_vector(self):
        # SM3 标准测试向量: "abc"
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"abc")
            path = f.name
        try:
            assert _compute_sm3(path) == "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0"
        finally:
            os.unlink(path)

    def test_compute_hash_prefers_sm3(self):
        # 正常情况走 SM3
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test")
            path = f.name
        try:
            h, algo = _compute_hash(path)
            assert algo == "SM3"
            assert len(h) == 64
        finally:
            os.unlink(path)

    def test_empty_file(self):
        # 空文件也能算哈希
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        try:
            h1 = _compute_sha256(path)
            h2 = _compute_sm3(path)
            assert len(h1) == 64
            assert len(h2) == 64
        finally:
            os.unlink(path)
