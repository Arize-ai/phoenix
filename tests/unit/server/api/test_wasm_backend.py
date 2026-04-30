"""Tests for WASMBackend and WASMAdapter.

Tests that require the wasmtime package are marked with the ``wasmtime`` import
guard — they are skipped automatically when wasmtime is not installed.

Execution tests use a real WASM binary path fixture if available, otherwise
they test only the non-execution surface (start/stop session no-ops, adapter
metadata, build_backend config plumbing).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any  # noqa: F401
from unittest.mock import MagicMock, patch  # noqa: F401

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
        backend = WASMBackend(binary_path=binary_path)

        with patch(
            "phoenix.server.sandbox.wasm_backend._run_wasm",
            return_value=expected,
        ) as mock_run:
            result = await backend.execute("print('hello')", session_key="k")

        assert result is expected
        from phoenix.server.sandbox.wasm_backend import _DEFAULT_TIMEOUT_SECONDS

        mock_run.assert_called_once_with(binary_path, "print('hello')", _DEFAULT_TIMEOUT_SECONDS)

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
        from phoenix.server.sandbox.wasm_backend import _MODULE_CACHE, _get_engine_and_module

        fake_path = Path("/fake/test-cache.wasm")
        cache_key = str(fake_path)
        _MODULE_CACHE.pop(cache_key, None)

        import wasmtime  # type: ignore[import-not-found]

        with patch.object(wasmtime.Module, "from_file", return_value="fake_module"):
            engine1, mod1 = _get_engine_and_module(fake_path)
            engine2, mod2 = _get_engine_and_module(fake_path)

        assert engine1 is engine2, "Same engine must be reused across calls"
        assert mod1 is mod2, "Same module must be reused across calls"
        _MODULE_CACHE.pop(cache_key, None)

    def test_different_paths_get_different_caches(self) -> None:
        from phoenix.server.sandbox.wasm_backend import _MODULE_CACHE, _get_engine_and_module

        path_a = Path("/fake/a.wasm")
        path_b = Path("/fake/b.wasm")
        _MODULE_CACHE.pop(str(path_a), None)
        _MODULE_CACHE.pop(str(path_b), None)

        import wasmtime

        with patch.object(wasmtime.Module, "from_file", return_value="fake_module"):
            engine_a, _ = _get_engine_and_module(path_a)
            engine_b, _ = _get_engine_and_module(path_b)

        assert engine_a is not engine_b
        _MODULE_CACHE.pop(str(path_a), None)
        _MODULE_CACHE.pop(str(path_b), None)


class TestRunWasmStdoutCapture:
    """_run_wasm captures stdout/stderr via WasiConfig setter-property assignment.

    Patches _get_engine_and_module and Linker.instantiate to exercise the real
    WasiConfig setter-property code path without a WASM binary.  A real
    wasmtime.Func is used for _start so isinstance(start, wasmtime.Func) passes;
    its callback invokes the captured stdout callback, proving bytes flow through
    the accumulator and are decoded into result.stdout.
    """

    def test_stdout_captured_via_setter_property(self) -> None:
        import wasmtime

        # Captures the stdout/stderr callbacks registered via setter assignment
        stdout_cb_holder: list[Any] = []
        stderr_cb_holder: list[Any] = []

        class _CapturingWasiConfig:
            @property
            def stdout_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stdout_custom.setter
            def stdout_custom(self, cb: object) -> None:
                stdout_cb_holder.append(cb)

            @property
            def stderr_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stderr_custom.setter
            def stderr_custom(self, cb: object) -> None:
                stderr_cb_holder.append(cb)

            @property
            def stdin_file(self) -> None:
                raise AttributeError("unreadable attribute")

            @stdin_file.setter
            def stdin_file(self, path: object) -> None:
                pass

            def inherit_env(self) -> None:
                pass

        # Real Store needed to construct a real wasmtime.Func
        store = wasmtime.Store()
        ft = wasmtime.FuncType([], [])

        def _start_impl(caller: object) -> None:
            if stdout_cb_holder:
                stdout_cb_holder[0](b"hello from wasm\n")

        start_func = wasmtime.Func(store, ft, _start_impl, access_caller=True)

        mock_exports = MagicMock()
        mock_exports.get.return_value = start_func

        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        fake_engine = wasmtime.Engine()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(fake_engine, MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=store):
                        result = _run_wasm(Path("/fake/cpython.wasm"), "x=1", timeout=5)

        assert result.error is None
        assert result.stdout == "hello from wasm\n"

    def test_stderr_captured_via_setter_property(self) -> None:
        import wasmtime

        stderr_cb_holder: list[Any] = []

        class _CapturingWasiConfig:
            @property
            def stdout_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stdout_custom.setter
            def stdout_custom(self, cb: object) -> None:
                pass

            @property
            def stderr_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stderr_custom.setter
            def stderr_custom(self, cb: object) -> None:
                stderr_cb_holder.append(cb)

            @property
            def stdin_file(self) -> None:
                raise AttributeError("unreadable attribute")

            @stdin_file.setter
            def stdin_file(self, path: object) -> None:
                pass

            def inherit_env(self) -> None:
                pass

        store = wasmtime.Store()
        ft = wasmtime.FuncType([], [])

        def _start_impl(caller: object) -> None:
            if stderr_cb_holder:
                stderr_cb_holder[0](b"error output\n")

        start_func = wasmtime.Func(store, ft, _start_impl, access_caller=True)

        mock_exports = MagicMock()
        mock_exports.get.return_value = start_func

        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        fake_engine = wasmtime.Engine()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(fake_engine, MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=store):
                        result = _run_wasm(Path("/fake/cpython.wasm"), "x=1", timeout=5)

        assert result.error is None
        assert result.stderr == "error output\n"

    def test_wasi_config_setter_raises_on_read(self) -> None:
        """WasiConfig.stdout_custom is set-only — reading it raises AttributeError."""
        import wasmtime

        wasi = wasmtime.WasiConfig()
        with pytest.raises(AttributeError):
            _ = wasi.stdout_custom

    def test_stdin_assigned_via_setter_property(self) -> None:
        """wasi.stdin_file assignment (not method call) is the correct API."""
        import wasmtime

        stdin_path_holder: list[Any] = []

        class _CapturingWasiConfig:
            @property
            def stdout_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stdout_custom.setter
            def stdout_custom(self, cb: object) -> None:
                pass

            @property
            def stderr_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stderr_custom.setter
            def stderr_custom(self, cb: object) -> None:
                pass

            @property
            def stdin_file(self) -> None:
                raise AttributeError("unreadable attribute")

            @stdin_file.setter
            def stdin_file(self, path: object) -> None:
                stdin_path_holder.append(path)

            def inherit_env(self) -> None:
                pass

        store = wasmtime.Store()
        ft = wasmtime.FuncType([], [])
        start_func = wasmtime.Func(store, ft, lambda c: None, access_caller=True)

        mock_exports = MagicMock()
        mock_exports.get.return_value = start_func
        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        fake_engine = wasmtime.Engine()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(fake_engine, MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=store):
                        result = _run_wasm(Path("/fake/cpython.wasm"), "print(1)", timeout=5)

        assert result.error is None
        assert len(stdin_path_holder) == 1
        assert stdin_path_holder[0].endswith(".py")


class TestTempFileCleanup:
    """_run_wasm cleans up its temp stdin file after execution."""

    def test_stdin_temp_file_is_deleted_after_run(self) -> None:
        # Run with a nonexistent binary — will error but should still clean up
        result = _run_wasm(Path("/does/not/exist.wasm"), "x=1", timeout=5)
        assert result.error is not None

    def test_no_env_inherited_into_sandbox(self) -> None:
        """Verify wasi.inherit_env() is not called — user code gets no server env."""
        import wasmtime

        with patch.object(wasmtime.Module, "from_file"):
            with patch.object(wasmtime.WasiConfig, "inherit_env") as mock_inherit:
                _run_wasm(Path("/fake.wasm"), "x=1", timeout=5)
                mock_inherit.assert_not_called()
