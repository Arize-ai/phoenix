"""Unit tests for WASMBackend.

These tests use mocking to avoid requiring the wasmtime package or a real WASM
binary. They cover the module-level singleton patterns, epoch ticker lifecycle,
and thread pool behavior.
"""

from __future__ import annotations

import threading
from collections.abc import Generator
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Attempt to import WASMBackend — skip all tests if wasmtime is not installed.
pytest.importorskip("wasmtime", reason="wasmtime not installed")

from phoenix.server.sandbox.wasm_backend import (  # noqa: E402
    _epoch_tickers,
    _start_epoch_ticker,
    _thread_pools,
    _wasm_module_cache,
)


@pytest.fixture(autouse=True)
def clear_module_caches() -> Generator[None, None, None]:
    """Reset module-level caches before each test to ensure isolation."""
    _wasm_module_cache.clear()
    _thread_pools.clear()
    # Don't clear _epoch_tickers — they're daemon threads keyed by engine id;
    # we check the specific engine id in each test.
    yield
    _wasm_module_cache.clear()
    _thread_pools.clear()


class TestWASMBackendBinaryLoading:
    def test_raises_on_missing_binary(self, tmp_path: Path) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMBackend

        missing = tmp_path / "nonexistent.wasm"
        with pytest.raises(FileNotFoundError, match="WASM binary not found"):
            WASMBackend(wasm_binary=missing)

    def test_module_cached_after_first_load(self, tmp_path: Path) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMBackend

        fake_wasm = tmp_path / "python.wasm"
        fake_wasm.write_bytes(b"\x00asm\x01\x00\x00\x00")  # minimal WASM magic

        mock_engine = MagicMock()
        mock_module = MagicMock()

        with (
            patch("phoenix.server.sandbox.wasm_backend.Config"),
            patch("phoenix.server.sandbox.wasm_backend.Engine", return_value=mock_engine),
            patch("phoenix.server.sandbox.wasm_backend.Module") as mock_module_cls,
            patch("phoenix.server.sandbox.wasm_backend._start_epoch_ticker"),
        ):
            mock_module_cls.from_file.return_value = mock_module

            b1 = WASMBackend(wasm_binary=fake_wasm)
            b2 = WASMBackend(wasm_binary=fake_wasm)

        # Engine and Module should only be constructed once
        assert mock_module_cls.from_file.call_count == 1
        assert b1._engine is b2._engine
        assert b1._module is b2._module

    def test_different_paths_get_separate_cache_entries(self, tmp_path: Path) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMBackend

        wasm_a = tmp_path / "a.wasm"
        wasm_b = tmp_path / "b.wasm"
        wasm_a.write_bytes(b"\x00asm\x01\x00\x00\x00")
        wasm_b.write_bytes(b"\x00asm\x01\x00\x00\x00")

        with (
            patch("phoenix.server.sandbox.wasm_backend.Config"),
            patch("phoenix.server.sandbox.wasm_backend.Engine"),
            patch("phoenix.server.sandbox.wasm_backend.Module") as mock_module_cls,
            patch("phoenix.server.sandbox.wasm_backend._start_epoch_ticker"),
        ):
            mock_module_cls.from_file.return_value = MagicMock()
            WASMBackend(wasm_binary=wasm_a)
            WASMBackend(wasm_binary=wasm_b)

        assert mock_module_cls.from_file.call_count == 2


class TestEpochTickerLifecycle:
    def test_start_epoch_ticker_starts_daemon_thread(self) -> None:
        engine = MagicMock()
        engine_id = id(engine)

        # Remove any pre-existing ticker for this engine id
        _epoch_tickers.pop(engine_id, None)

        _start_epoch_ticker(engine)

        assert engine_id in _epoch_tickers
        ticker = _epoch_tickers[engine_id]
        assert isinstance(ticker, threading.Thread)
        assert ticker.daemon is True
        assert ticker.is_alive()

    def test_start_epoch_ticker_idempotent(self) -> None:
        engine = MagicMock()
        engine_id = id(engine)
        _epoch_tickers.pop(engine_id, None)

        _start_epoch_ticker(engine)
        first_thread = _epoch_tickers[engine_id]

        _start_epoch_ticker(engine)
        second_thread = _epoch_tickers[engine_id]

        # Second call should NOT replace an alive ticker
        assert first_thread is second_thread

    def test_wasm_backend_init_calls_start_epoch_ticker(self, tmp_path: Path) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMBackend

        fake_wasm = tmp_path / "python.wasm"
        fake_wasm.write_bytes(b"\x00asm\x01\x00\x00\x00")

        with (
            patch("phoenix.server.sandbox.wasm_backend.Config"),
            patch("phoenix.server.sandbox.wasm_backend.Engine"),
            patch("phoenix.server.sandbox.wasm_backend.Module"),
            patch("phoenix.server.sandbox.wasm_backend._start_epoch_ticker") as mock_start_ticker,
        ):
            WASMBackend(wasm_binary=fake_wasm)
            mock_start_ticker.assert_called_once()


class TestThreadPool:
    def test_thread_pool_created_on_demand(self, tmp_path: Path) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMBackend

        fake_wasm = tmp_path / "python.wasm"
        fake_wasm.write_bytes(b"\x00asm\x01\x00\x00\x00")

        with (
            patch("phoenix.server.sandbox.wasm_backend.Config"),
            patch("phoenix.server.sandbox.wasm_backend.Engine"),
            patch("phoenix.server.sandbox.wasm_backend.Module"),
            patch("phoenix.server.sandbox.wasm_backend._start_epoch_ticker"),
        ):
            b = WASMBackend(wasm_binary=fake_wasm, max_workers=4)

        assert 4 in _thread_pools
        assert b._pool is _thread_pools[4]

    def test_thread_pool_shared_across_instances(self, tmp_path: Path) -> None:
        from phoenix.server.sandbox.wasm_backend import WASMBackend

        fake_wasm = tmp_path / "python.wasm"
        fake_wasm.write_bytes(b"\x00asm\x01\x00\x00\x00")

        with (
            patch("phoenix.server.sandbox.wasm_backend.Config"),
            patch("phoenix.server.sandbox.wasm_backend.Engine"),
            patch("phoenix.server.sandbox.wasm_backend.Module"),
            patch("phoenix.server.sandbox.wasm_backend._start_epoch_ticker"),
        ):
            b1 = WASMBackend(wasm_binary=fake_wasm, max_workers=8)
            b2 = WASMBackend(wasm_binary=fake_wasm, max_workers=8)

        assert b1._pool is b2._pool
