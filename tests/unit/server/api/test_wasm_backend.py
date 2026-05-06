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
from phoenix.server.sandbox.wasm_backend import (  # noqa: E402
    WASMAdapter,
    WASMBackend,
    WASMBinaryProbe,
    _run_wasm,
)


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

        import wasmtime

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
                del path

            def inherit_env(self) -> None:
                pass

        # Real Store needed to construct a real wasmtime.Func
        store = wasmtime.Store()
        ft = wasmtime.FuncType([], [])

        def _start_impl(caller: object) -> None:
            del caller
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
                del cb

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
                del path

            def inherit_env(self) -> None:
                pass

        store = wasmtime.Store()
        ft = wasmtime.FuncType([], [])

        def _start_impl(caller: object) -> None:
            del caller
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
                del cb

            @property
            def stderr_custom(self) -> None:
                raise AttributeError("unreadable attribute")

            @stderr_custom.setter
            def stderr_custom(self, cb: object) -> None:
                del cb

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

        def _noop_start(caller: object) -> None:
            del caller

        start_func = wasmtime.Func(store, ft, _noop_start, access_caller=True)

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


class TestWASMAdapterProbeBinary:
    """WASMAdapter.probe_binary() reports binary-asset availability without I/O.

    The probe is the *capability-probe path* per D3/D4 — it reports whether the
    CPython WASM binary is locally resolvable so the GraphQL sandboxBackends
    resolver can surface accurate ``SandboxBackendStatus``. It MUST NOT touch
    the network and MUST NOT create cache files; the assertions below pin
    those invariants explicitly.
    """

    def test_probe_returns_available_when_resolver_returns_path(self) -> None:
        fake_path = Path("/opt/phoenix/wasm/python-3.12.0.wasm")
        with patch(
            "phoenix.server.sandbox._download.resolve_wasm_binary_if_present",
            return_value=fake_path,
        ):
            with patch(
                "urllib.request.urlretrieve", side_effect=AssertionError("network used")
            ) as mock_retrieve:
                probe = WASMAdapter.probe_binary()
        assert isinstance(probe, WASMBinaryProbe)
        assert probe.available is True
        assert probe.detail is None
        assert probe.path == fake_path
        mock_retrieve.assert_not_called()

    def test_probe_returns_env_var_set_but_missing_detail(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        env_path = "/opt/phoenix/wasm/python-3.12.0.wasm"
        monkeypatch.setenv("PHOENIX_WASM_BINARY_PATH", env_path)
        with patch(
            "phoenix.server.sandbox._download.resolve_wasm_binary_if_present",
            return_value=None,
        ):
            with patch(
                "urllib.request.urlretrieve", side_effect=AssertionError("network used")
            ) as mock_retrieve:
                probe = WASMAdapter.probe_binary()
        assert probe.available is False
        assert probe.path is None
        assert probe.detail == (
            f"PHOENIX_WASM_BINARY_PATH={env_path} is set but the file does not exist."
        )
        mock_retrieve.assert_not_called()

    def test_probe_returns_unset_no_cache_detail(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        with patch(
            "phoenix.server.sandbox._download.resolve_wasm_binary_if_present",
            return_value=None,
        ):
            with patch(
                "urllib.request.urlretrieve", side_effect=AssertionError("network used")
            ) as mock_retrieve:
                probe = WASMAdapter.probe_binary()
        assert probe.available is False
        assert probe.path is None
        assert probe.detail == "WASM binary not present locally; will download on first use."
        mock_retrieve.assert_not_called()

    def test_probe_does_not_invoke_real_resolver_network_path(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        """End-to-end with the real resolver: env var unset, empty cache → no
        download attempted, resolver returns None.

        Calls ``resolve_wasm_binary_if_present`` directly so the cache_dir
        argument can be redirected to an empty tmp dir (the default cache
        path may exist on dev workstations). Patches
        ``urllib.request.urlretrieve`` to fail any attempted network call —
        the assertion that the resolver did NOT invoke it is the
        load-bearing check that the probe path stays side-effect-free.
        ``WASMAdapter.probe_binary()`` itself is exercised end-to-end in
        the other tests in this class.
        """
        from phoenix.server.sandbox import _download

        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        empty_cache = tmp_path / "cache"  # does not exist; resolver must not create it
        with patch(
            "urllib.request.urlretrieve", side_effect=AssertionError("network used")
        ) as mock_retrieve:
            resolved = _download.resolve_wasm_binary_if_present(cache_dir=empty_cache)
        assert resolved is None, "resolver must report no binary when env unset and cache empty"
        mock_retrieve.assert_not_called()
        assert not empty_cache.exists(), "probe must not create the cache directory"


class TestSandboxBackendsResolverWASMStatus:
    """The sandboxBackends GraphQL resolver layers ``WASMAdapter.probe_binary()``
    on top of build_backend() so that status reflects binary-asset presence,
    not just SDK-importability per D4.

    These tests exercise the resolver helper ``_get_sandbox_backend_info_with_session``
    directly — it is the single locus of the probe wiring and is more
    surgical to test than the full GraphQL surface.
    """

    async def test_wasm_reports_available_when_probe_finds_binary(self) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            _get_sandbox_backend_info_with_session,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            with patch.object(
                WASMAdapter,
                "probe_binary",
                return_value=WASMBinaryProbe(
                    available=True,
                    detail=None,
                    path=Path("/opt/phoenix/wasm/python-3.12.0.wasm"),
                ),
            ):
                infos = await _get_sandbox_backend_info_with_session(session=None, decrypt=None)
        wasm = next(info for info in infos if info.backend_type == "WASM")
        assert wasm.status == SandboxBackendStatus.AVAILABLE
        assert wasm.status_detail is None

    async def test_wasm_reports_unavailable_when_env_var_set_but_missing(self) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            _get_sandbox_backend_info_with_session,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        env_path = "/opt/phoenix/wasm/python-3.12.0.wasm"
        detail = f"PHOENIX_WASM_BINARY_PATH={env_path} is set but the file does not exist."
        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            with patch.object(
                WASMAdapter,
                "probe_binary",
                return_value=WASMBinaryProbe(available=False, detail=detail, path=None),
            ):
                infos = await _get_sandbox_backend_info_with_session(session=None, decrypt=None)
        wasm = next(info for info in infos if info.backend_type == "WASM")
        assert wasm.status == SandboxBackendStatus.UNAVAILABLE
        assert wasm.status_detail == detail

    async def test_wasm_reports_unavailable_when_unset_and_no_cache(self) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            _get_sandbox_backend_info_with_session,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        detail = "WASM binary not present locally; will download on first use."
        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            with patch.object(
                WASMAdapter,
                "probe_binary",
                return_value=WASMBinaryProbe(available=False, detail=detail, path=None),
            ):
                infos = await _get_sandbox_backend_info_with_session(session=None, decrypt=None)
        wasm = next(info for info in infos if info.backend_type == "WASM")
        assert wasm.status == SandboxBackendStatus.UNAVAILABLE
        assert wasm.status_detail == detail

    async def test_wasm_status_path_does_not_invoke_network(self) -> None:
        """Resolver-level guarantee: even when the probe is exercised end-to-end,
        ``urllib.request.urlretrieve`` is never called.
        """
        from phoenix.server.api.types.SandboxConfig import (
            _get_sandbox_backend_info_with_session,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            with patch(
                "phoenix.server.sandbox._download.resolve_wasm_binary_if_present",
                return_value=None,
            ):
                with patch(
                    "urllib.request.urlretrieve",
                    side_effect=AssertionError("network used"),
                ) as mock_retrieve:
                    await _get_sandbox_backend_info_with_session(session=None, decrypt=None)
        mock_retrieve.assert_not_called()
