"""Tests for WASMBackend and WASMAdapter.

Tests that require the wasmtime package are marked with the ``wasmtime`` import
guard — they are skipped automatically when wasmtime is not installed.

Execution tests use a real WASM binary path fixture if available, otherwise
they test only the non-execution surface (start/stop session no-ops, adapter
metadata, build_backend config plumbing).
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast  # noqa: F401

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock, patch  # noqa: F401

import pytest

pytest.importorskip("wasmtime", reason="wasmtime optional extra not installed")

from phoenix.server.sandbox import SecretsContext  # noqa: E402
from phoenix.server.sandbox.types import ExecutionResult  # noqa: E402
from phoenix.server.sandbox.wasm_backend import (  # noqa: E402
    WASMAdapter,
    WASMBackend,
    WASMBinaryProbe,
    _run_wasm,
)


def _empty_secrets_context() -> SecretsContext:
    """A ``SecretsContext`` whose DB lookups all resolve to "nothing".

    The resolver tests below exercise ``get_sandbox_backend_info`` which:
    (a) reads provider credentials via ``session.scalars(...)``, and
    (b) reads the deployment row via ``session.get(...)``.
    Neither call should produce real DB results — we just need awaitable
    stubs so the await sites don't TypeError. The behavior under test is
    the WASM-binary probe path; credential and deployment resolution are
    out of scope.
    """
    empty_scalars_result = MagicMock()
    empty_scalars_result.all = MagicMock(return_value=[])
    session = MagicMock(
        get=AsyncMock(return_value=None),
        scalars=AsyncMock(return_value=empty_scalars_result),
    )
    return SecretsContext(session=cast("AsyncSession", session), decrypt=lambda b: b)


class TestWASMBackendSessionNoop:
    """WASMBackend inherits BaseNoSessionBackend — start/stop are no-ops."""

    async def test_start_session_does_not_raise(self) -> None:
        backend = WASMBackend()
        await backend.start_session("any-key")

    async def test_stop_session_does_not_raise(self) -> None:
        backend = WASMBackend()
        await backend.stop_session("any-key")

    async def test_close_does_not_raise(self) -> None:
        backend = WASMBackend()
        await backend.close()


class TestWASMBackendExecute:
    """WASMBackend.execute() delegates to _run_wasm in a thread executor."""

    async def test_execute_resolves_binary_and_delegates_to_run_wasm(self) -> None:
        """execute() resolves the binary via ensure_wasm_binary, then delegates to _run_wasm."""
        expected = ExecutionResult(stdout="hello\n", stderr="")
        fake_path = Path("/downloaded/cpython.wasm")
        backend = WASMBackend()

        with patch(
            "phoenix.server.sandbox._download.ensure_wasm_binary",
            return_value=fake_path,
        ):
            with patch(
                "phoenix.server.sandbox.wasm_backend._run_wasm",
                return_value=expected,
            ) as mock_run:
                result = await backend.execute("print('hello')", session_key="k")

        assert result is expected
        from phoenix.server.sandbox.wasm_backend import _DEFAULT_TIMEOUT_SECONDS

        mock_run.assert_called_once_with(fake_path, "print('hello')", _DEFAULT_TIMEOUT_SECONDS)


class TestRunWasm:
    """_run_wasm returns ExecutionResult with error field on exception."""

    def test_returns_error_result_on_exception(self) -> None:
        # Pass a nonexistent path — wasmtime.Module.from_file will raise
        result = _run_wasm(Path("/does/not/exist.wasm"), "x=1", timeout=5)
        assert result.error is not None
        assert not result.success


class TestWASMAdapter:
    def test_kind(self) -> None:
        assert WASMAdapter.backend_type == "WASM"

    def test_supported_languages_from_config_literal(self) -> None:
        # The Config's ``language: Literal[...]`` is the structural source of
        # truth for supported languages; the adapter no longer carries a
        # separate ``supported_languages`` frozenset.
        from typing import get_args

        assert get_args(WASMAdapter.config_model.model_fields["language"].annotation) == ("PYTHON",)

    def test_build_backend_returns_wasm_backend(self) -> None:
        from phoenix.server.sandbox.types import NoCredentials, WASMConfig, WASMDeployment

        adapter = WASMAdapter()
        backend = adapter.build_backend(
            WASMConfig(language="PYTHON"),
            credentials=NoCredentials(),
            deployment=WASMDeployment(),
        )
        assert isinstance(backend, WASMBackend)


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

        class _StartFunc:
            def __call__(self, store: object) -> None:
                del store
                if stdout_cb_holder:
                    stdout_cb_holder[0](b"hello from wasm\n")

        mock_exports = MagicMock()
        mock_exports.get.return_value = _StartFunc()

        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        fake_store = MagicMock()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=fake_store):
                        with patch.object(wasmtime, "Func", _StartFunc):
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

        class _StartFunc:
            def __call__(self, store: object) -> None:
                del store
                if stderr_cb_holder:
                    stderr_cb_holder[0](b"error output\n")

        mock_exports = MagicMock()
        mock_exports.get.return_value = _StartFunc()

        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        fake_store = MagicMock()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=fake_store):
                        with patch.object(wasmtime, "Func", _StartFunc):
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

        class _StartFunc:
            def __call__(self, store: object) -> None:
                del store

        mock_exports = MagicMock()
        mock_exports.get.return_value = _StartFunc()
        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        fake_store = MagicMock()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=fake_store):
                        with patch.object(wasmtime, "Func", _StartFunc):
                            result = _run_wasm(Path("/fake/cpython.wasm"), "print(1)", timeout=5)

        assert result.error is None
        assert len(stdin_path_holder) == 1
        assert stdin_path_holder[0].endswith(".py")


class TestTempFileCleanup:
    """_run_wasm cleans up its temp stdin file after execution."""

    def test_stdin_temp_file_is_deleted_after_run(self, tmp_path: Path) -> None:
        import wasmtime

        stdin_path = tmp_path / "stdin.py"

        class _NamedTempFile:
            def __enter__(self) -> Any:
                self._file = stdin_path.open("w")
                return self._file

            def __exit__(self, *args: object) -> None:
                self._file.close()

        mock_linker = MagicMock()
        mock_linker.instantiate.side_effect = RuntimeError("instantiate failed")
        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("tempfile.NamedTemporaryFile", return_value=_NamedTempFile()):
                with patch.object(wasmtime, "WasiConfig", return_value=MagicMock()):
                    with patch.object(wasmtime, "Store", return_value=MagicMock()):
                        with patch.object(wasmtime, "Linker", return_value=mock_linker):
                            result = _run_wasm(Path("/fake.wasm"), "x=1", timeout=5)

        assert result.error is not None
        assert not stdin_path.exists()

    def test_no_env_inherited_into_sandbox(self) -> None:
        """Verify wasi.inherit_env() is not called — user code gets no server env."""
        import wasmtime

        mock_wasi = MagicMock()
        mock_linker = MagicMock()
        mock_linker.instantiate.side_effect = RuntimeError("stop before real instantiate")
        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch.object(wasmtime, "WasiConfig", return_value=mock_wasi):
                with patch.object(wasmtime, "Store", return_value=MagicMock()):
                    with patch.object(wasmtime, "Linker", return_value=mock_linker):
                        _run_wasm(Path("/fake.wasm"), "x=1", timeout=5)

        mock_wasi.inherit_env.assert_not_called()


class TestWASMAdapterProbeBinary:
    """WASMAdapter.probe_binary() reports binary-asset availability without I/O.

    The probe is the capability-probe path — it reports whether the CPython
    WASM binary is locally resolvable so the GraphQL sandboxBackends resolver
    can surface accurate ``SandboxBackendStatus``. It MUST NOT touch the
    network and MUST NOT create cache files; the assertions below pin those
    invariants explicitly.
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

    def test_probe_returns_no_local_storage_detail(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """In no-local-storage mode (postgres configured, no working dir set)
        with no operator-supplied binary path, the probe surfaces the
        canonical short-form remediation string used by the settings panel.
        """
        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        with patch(
            "phoenix.server.sandbox._download.resolve_wasm_binary_if_present",
            return_value=None,
        ):
            with patch(
                "phoenix.config._no_local_storage",
                return_value=True,
            ):
                with patch(
                    "urllib.request.urlretrieve",
                    side_effect=AssertionError("network used"),
                ) as mock_retrieve:
                    probe = WASMAdapter.probe_binary()
        assert probe.available is False
        assert probe.path is None
        assert probe.detail == "No-local-storage mode: set PHOENIX_WORKING_DIR to enable WASM."
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
        the assertion that the resolver did NOT invoke it is the critical
        check that the probe path stays side-effect-free.
        ``WASMAdapter.probe_binary()`` itself is exercised end-to-end in
        the other tests in this class.
        """
        from phoenix.server.sandbox import _download

        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        empty_cache = tmp_path / "cache"  # does not exist; resolver must not create it
        with patch(
            "urllib.request.urlretrieve", side_effect=AssertionError("network used")
        ) as mock_retrieve:
            resolved = _download.resolve_wasm_binary_if_present(wasm_dir=empty_cache)
        assert resolved is None, "resolver must report no binary when env unset and cache empty"
        mock_retrieve.assert_not_called()
        assert not empty_cache.exists(), "probe must not create the cache directory"


class TestSandboxBackendsResolverWASMStatus:
    """The sandboxBackends GraphQL resolver layers ``WASMAdapter.probe_binary()``
    on top of build_backend() so that status reflects binary-asset presence,
    not just SDK-importability.

    These tests exercise the resolver helper ``get_sandbox_backend_info``
    directly — it is the single locus of the probe wiring and is more
    surgical to test than the full GraphQL surface.
    """

    async def test_wasm_reports_available_when_probe_finds_binary(self) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            get_sandbox_backend_info,
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
                infos = await get_sandbox_backend_info(
                    secrets=_empty_secrets_context(),
                )
        wasm = next(info for info in infos if info.backend_type.value == "WASM")
        assert wasm.status == SandboxBackendStatus.AVAILABLE
        assert wasm.status_detail is None

    async def test_wasm_reports_unavailable_when_env_var_set_but_missing(self) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            get_sandbox_backend_info,
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
                infos = await get_sandbox_backend_info(
                    secrets=_empty_secrets_context(),
                )
        wasm = next(info for info in infos if info.backend_type.value == "WASM")
        assert wasm.status == SandboxBackendStatus.UNAVAILABLE
        assert wasm.status_detail == detail

    async def test_wasm_reports_unavailable_when_unset_and_no_cache(self) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            get_sandbox_backend_info,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        detail = "WASM binary not present locally; will download on first use."
        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            with patch.object(
                WASMAdapter,
                "probe_binary",
                return_value=WASMBinaryProbe(available=False, detail=detail, path=None),
            ):
                infos = await get_sandbox_backend_info(
                    secrets=_empty_secrets_context(),
                )
        wasm = next(info for info in infos if info.backend_type.value == "WASM")
        assert wasm.status == SandboxBackendStatus.UNAVAILABLE
        assert wasm.status_detail == detail

    async def test_wasm_reports_disabled_when_excluded_by_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            get_sandbox_backend_info,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        monkeypatch.setenv("PHOENIX_ALLOWED_SANDBOX_PROVIDERS", "DENO")
        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            infos = await get_sandbox_backend_info(
                secrets=_empty_secrets_context(),
            )
        wasm = next(info for info in infos if info.backend_type.value == "WASM")
        assert wasm.status == SandboxBackendStatus.DISABLED
        assert wasm.status_detail == "Disabled on the server."

    async def test_wasm_reports_no_local_storage_status_detail(self) -> None:
        """The settings panel surfaces the short-form remediation when the
        probe reports no-local-storage mode.
        """
        from phoenix.server.api.types.SandboxConfig import (
            SandboxBackendStatus,
            get_sandbox_backend_info,
        )
        from phoenix.server.sandbox import _SANDBOX_ADAPTERS

        detail = "No-local-storage mode: set PHOENIX_WORKING_DIR to enable WASM."
        with patch.dict(_SANDBOX_ADAPTERS, {"WASM": WASMAdapter()}, clear=False):
            with patch.object(
                WASMAdapter,
                "probe_binary",
                return_value=WASMBinaryProbe(available=False, detail=detail, path=None),
            ):
                infos = await get_sandbox_backend_info(
                    secrets=_empty_secrets_context(),
                )
        wasm = next(info for info in infos if info.backend_type.value == "WASM")
        assert wasm.status == SandboxBackendStatus.UNAVAILABLE
        assert wasm.status_detail == detail

    async def test_wasm_status_path_does_not_invoke_network(self) -> None:
        """Resolver-level guarantee: even when the probe is exercised end-to-end,
        ``urllib.request.urlretrieve`` is never called.
        """
        from phoenix.server.api.types.SandboxConfig import (
            get_sandbox_backend_info,
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
                    await get_sandbox_backend_info(
                        secrets=_empty_secrets_context(),
                    )
        mock_retrieve.assert_not_called()


class TestEpochTicker:
    """The epoch ticker is what makes the WASM execution timeout fire at all:
    wasmtime traps a runaway guest only once the engine epoch passes the
    store's deadline, and that epoch advances solely via increment_epoch()."""

    def test_start_epoch_ticker_advances_engine_epoch(self) -> None:
        from phoenix.server.sandbox import wasm_backend

        increments = 0

        class _FakeEngine:
            def increment_epoch(self) -> None:
                nonlocal increments
                increments += 1

        with patch.object(wasm_backend, "_EPOCH_TICK_SECONDS", 0.01):
            wasm_backend._start_epoch_ticker(cast(Any, _FakeEngine()))
            time.sleep(0.1)

        assert increments >= 3, "ticker must keep advancing the engine epoch"

    def test_get_engine_and_module_starts_one_ticker_per_engine(self) -> None:
        import wasmtime

        from phoenix.server.sandbox import wasm_backend
        from phoenix.server.sandbox.wasm_backend import _MODULE_CACHE, _get_engine_and_module

        fake_path = Path("/fake/ticker-per-engine.wasm")
        _MODULE_CACHE.pop(str(fake_path), None)

        with patch.object(wasm_backend, "_start_epoch_ticker") as mock_ticker:
            with patch.object(wasmtime.Module, "from_file", return_value="fake_module"):
                engine1, _ = _get_engine_and_module(fake_path)
                engine2, _ = _get_engine_and_module(fake_path)

        assert engine1 is engine2
        # One engine → one ticker; the cached second call must not start another.
        mock_ticker.assert_called_once_with(engine1)
        _MODULE_CACHE.pop(str(fake_path), None)


class TestRunWasmTimeout:
    """_run_wasm enforces the per-execution timeout via the store's epoch
    deadline and classifies a deadline trap as a timeout."""

    def test_reports_timeout_when_trap_fires_after_deadline(self) -> None:
        import wasmtime

        class _TrappingStart:
            def __call__(self, store: object) -> None:
                del store
                raise RuntimeError("wasm trap: interrupt")

        mock_exports = MagicMock()
        mock_exports.get.return_value = _TrappingStart()
        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports
        fake_store = MagicMock()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("wasmtime.Linker") as mock_linker_cls:
                mock_linker_cls.return_value.instantiate.return_value = mock_instance
                with patch("wasmtime.Store", return_value=fake_store):
                    with patch.object(wasmtime, "Func", _TrappingStart):
                        # started_at, then the except branch reads 30s later.
                        with patch("time.monotonic", side_effect=[100.0, 130.0]):
                            result = _run_wasm(
                                Path("/fake/cpython.wasm"), "while True: pass", timeout=30
                            )

        # 30s timeout / 1s tick → a 30-tick epoch deadline.
        fake_store.set_epoch_deadline.assert_called_once_with(30)
        assert result.error == "Execution timed out after 30s"

    def test_preserves_generic_error_raised_before_timeout(self) -> None:
        import wasmtime

        class _FailingStart:
            def __call__(self, store: object) -> None:
                del store
                raise RuntimeError("integer division by zero")

        mock_exports = MagicMock()
        mock_exports.get.return_value = _FailingStart()
        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("wasmtime.Linker") as mock_linker_cls:
                mock_linker_cls.return_value.instantiate.return_value = mock_instance
                with patch("wasmtime.Store", return_value=MagicMock()):
                    with patch.object(wasmtime, "Func", _FailingStart):
                        # Only 0.5s elapsed — far under the 30s timeout, so the
                        # error is a genuine guest fault, not a deadline trap.
                        with patch("time.monotonic", side_effect=[100.0, 100.5]):
                            result = _run_wasm(Path("/fake/cpython.wasm"), "1/0", timeout=30)

        assert result.error == "integer division by zero"

    def test_epoch_deadline_is_at_least_one_tick(self) -> None:
        import wasmtime

        class _NoopStart:
            def __call__(self, store: object) -> None:
                del store

        mock_exports = MagicMock()
        mock_exports.get.return_value = _NoopStart()
        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports
        fake_store = MagicMock()

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(MagicMock(), MagicMock()),
        ):
            with patch("wasmtime.Linker") as mock_linker_cls:
                mock_linker_cls.return_value.instantiate.return_value = mock_instance
                with patch("wasmtime.Store", return_value=fake_store):
                    with patch.object(wasmtime, "Func", _NoopStart):
                        result = _run_wasm(Path("/fake/cpython.wasm"), "x=1", timeout=0)

        # ceil(0 / 1.0) is 0, floored to a minimum of one tick.
        fake_store.set_epoch_deadline.assert_called_once_with(1)
        assert result.error is None
