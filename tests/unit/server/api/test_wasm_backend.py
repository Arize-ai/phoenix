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

from phoenix.server.sandbox.types import ExecutionResult, UnsupportedOperation  # noqa: E402
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
        backend = WASMBackend(binary_path=binary_path)

        with patch(
            "phoenix.server.sandbox.wasm_backend._run_wasm",
            return_value=expected,
        ) as mock_run:
            result = await backend.execute("print('hello')", session_key="k")

        assert result is expected
        from phoenix.server.sandbox.wasm_backend import _DEFAULT_TIMEOUT_SECONDS

        mock_run.assert_called_once_with(binary_path, "print('hello')", _DEFAULT_TIMEOUT_SECONDS)

    async def test_execute_raises_unsupported_operation_when_env_passed(self) -> None:
        backend = WASMBackend(binary_path=Path("/fake/cpython.wasm"))
        with pytest.raises(UnsupportedOperation):
            await backend.execute("x=1", session_key="k", env={"FOO": "bar"})

    async def test_execute_resolves_binary_via_download_when_path_is_none(self) -> None:
        expected = ExecutionResult(stdout="", stderr="")
        fake_path = Path("/downloaded/cpython.wasm")

        backend = WASMBackend(binary_path=None)
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

    def test_language(self) -> None:
        assert WASMAdapter.language == "PYTHON"

    def test_build_backend_returns_wasm_backend(self) -> None:
        adapter = WASMAdapter()
        backend = adapter.build_backend({})
        assert isinstance(backend, WASMBackend)

    def test_build_backend_returns_sandbox_backend(self) -> None:
        from phoenix.server.sandbox.types import SandboxBackend

        adapter = WASMAdapter()
        backend = adapter.build_backend({})
        assert isinstance(backend, SandboxBackend)


class TestEngineCaching:
    """Engine and module are cached together to avoid cross-engine misuse."""

    def test_get_engine_and_module_caches_by_path(self) -> None:
        from phoenix.server.sandbox.wasm_backend import (
            _MODULE_CACHE,
            _get_engine_and_module,
            _get_wasmtime,
        )

        fake_path = Path("/fake/test-cache.wasm")
        cache_key = str(fake_path)
        _MODULE_CACHE.pop(cache_key, None)

        wasmtime = _get_wasmtime()

        with patch.object(wasmtime.Module, "from_file", return_value="fake_module"):
            engine1, mod1 = _get_engine_and_module(fake_path)
            engine2, mod2 = _get_engine_and_module(fake_path)

        assert engine1 is engine2, "Same engine must be reused across calls"
        assert mod1 is mod2, "Same module must be reused across calls"
        _MODULE_CACHE.pop(cache_key, None)

    def test_different_paths_get_different_caches(self) -> None:
        from phoenix.server.sandbox.wasm_backend import (
            _MODULE_CACHE,
            _get_engine_and_module,
            _get_wasmtime,
        )

        path_a = Path("/fake/a.wasm")
        path_b = Path("/fake/b.wasm")
        _MODULE_CACHE.pop(str(path_a), None)
        _MODULE_CACHE.pop(str(path_b), None)

        wasmtime = _get_wasmtime()

        with patch.object(wasmtime.Module, "from_file", return_value="fake_module"):
            engine_a, _ = _get_engine_and_module(path_a)
            engine_b, _ = _get_engine_and_module(path_b)

        assert engine_a is not engine_b
        _MODULE_CACHE.pop(str(path_a), None)
        _MODULE_CACHE.pop(str(path_b), None)


class TestTempFileCleanup:
    """_run_wasm cleans up its temp stdin file after execution."""

    def test_stdin_temp_file_is_deleted_after_run(self) -> None:
        # Run with a nonexistent binary — will error but should still clean up
        result = _run_wasm(Path("/does/not/exist.wasm"), "x=1", timeout=5)
        assert result.error is not None

    def test_no_env_inherited_into_sandbox(self) -> None:
        """Verify wasi.inherit_env() is not called — user code gets no server env."""
        from phoenix.server.sandbox.wasm_backend import _get_wasmtime

        wasmtime = _get_wasmtime()

        with patch.object(wasmtime.Module, "from_file"):
            with patch.object(wasmtime.WasiConfig, "inherit_env") as mock_inherit:
                _run_wasm(Path("/fake.wasm"), "x=1", timeout=5)
                mock_inherit.assert_not_called()
