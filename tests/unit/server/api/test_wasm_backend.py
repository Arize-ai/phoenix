"""Tests for WASMBackend and WASMAdapter.

Tests that require the wasmtime package are marked with the ``wasmtime`` import
guard — they are skipped automatically when wasmtime is not installed.

Execution tests use a real WASM binary path fixture if available, otherwise
they test only the non-execution surface (start/stop session no-ops, adapter
metadata, build_backend config plumbing).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

pytest.importorskip("wasmtime", reason="wasmtime optional extra not installed")

from phoenix.server.sandbox.types import ExecutionResult  # noqa: E402
from phoenix.server.sandbox.wasm_backend import WASMAdapter, WASMBackend, _run_wasm  # noqa: E402


class TestWASMBackendSessionNoop:
    """WASMBackend inherits BaseNoSessionBackend — start/stop are no-ops."""

    async def test_start_session_does_not_raise(self) -> None:
        backend = WASMBackend(binary_path=Path("/nonexistent"))
        await backend.start_session("any-key")

    async def test_stop_session_does_not_raise(self) -> None:
        backend = WASMBackend(binary_path=Path("/nonexistent"))
        await backend.stop_session("any-key")

    async def test_close_does_not_raise(self) -> None:
        backend = WASMBackend(binary_path=Path("/nonexistent"))
        await backend.close()


class TestWASMBackendExecute:
    """WASMBackend.execute() delegates to _run_wasm in a thread executor."""

    async def test_execute_returns_execution_result(self) -> None:
        expected = ExecutionResult(stdout="hello\n", stderr="")
        binary_path = Path("/fake/cpython.wasm")
        backend = WASMBackend(binary_path=binary_path, timeout=10)

        with patch(
            "phoenix.server.sandbox.wasm_backend._run_wasm",
            return_value=expected,
        ) as mock_run:
            result = await backend.execute("print('hello')", session_key="k")

        assert result is expected
        mock_run.assert_called_once_with(binary_path, "print('hello')", 10)

    async def test_execute_resolves_binary_via_download_when_path_is_none(self) -> None:
        expected = ExecutionResult(stdout="", stderr="")
        fake_path = Path("/downloaded/cpython.wasm")

        backend = WASMBackend(binary_path=None, timeout=5)
        with patch(
            "phoenix.server.sandbox.wasm_backend._run_wasm",
            return_value=expected,
        ):
            with patch(
                "phoenix.server.sandbox._download.ensure_wasm_binary",
                return_value=fake_path,
            ):
                result = await backend.execute("", session_key="k")

        assert result is expected


class TestRunWasm:
    """_run_wasm returns ExecutionResult with error field on exception."""

    def test_returns_error_result_on_exception(self) -> None:
        # Pass a nonexistent path — wasmtime.Module.from_file will raise
        result = _run_wasm(Path("/does/not/exist.wasm"), "x=1", timeout=5)
        assert result.error is not None
        assert not result.success


class TestWASMAdapter:
    def test_key(self) -> None:
        assert WASMAdapter.key == "WASM"

    def test_supported_languages(self) -> None:
        assert "PYTHON" in WASMAdapter.supported_languages

    def test_build_backend_default_timeout(self) -> None:
        adapter = WASMAdapter()
        backend = adapter.build_backend({})
        assert isinstance(backend, WASMBackend)
        assert backend._timeout == 30

    def test_build_backend_custom_timeout(self) -> None:
        adapter = WASMAdapter()
        backend = adapter.build_backend({"timeout": "60"})
        assert isinstance(backend, WASMBackend)
        assert backend._timeout == 60

    def test_build_backend_returns_sandbox_backend(self) -> None:
        from phoenix.server.sandbox.types import SandboxBackend

        adapter = WASMAdapter()
        backend = adapter.build_backend({})
        assert isinstance(backend, SandboxBackend)
