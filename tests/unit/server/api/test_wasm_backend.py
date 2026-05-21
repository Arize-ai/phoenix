from __future__ import annotations

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
    empty_scalars_result = MagicMock()
    empty_scalars_result.all = MagicMock(return_value=[])
    session = MagicMock(
        get=AsyncMock(return_value=None),
        scalars=AsyncMock(return_value=empty_scalars_result),
    )
    return SecretsContext(session=cast("AsyncSession", session), decrypt=lambda b: b)


class TestWASMBackendSessionNoop:
    async def test_start_session_does_not_raise(self) -> None:
        backend = WASMBackend()
        await backend.find_or_create_session("any-key")

    async def test_close_session_does_not_raise(self) -> None:
        backend = WASMBackend()
        await backend.close_session("any-key")

    async def test_close_does_not_raise(self) -> None:
        backend = WASMBackend()
        await backend.close()


class TestWASMBackendExecute:
    async def test_execute_resolves_binary_and_delegates_to_run_wasm(self) -> None:
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
    def test_returns_error_result_on_exception(self) -> None:
        result = _run_wasm(Path("/does/not/exist.wasm"), "x=1", timeout=5)
        assert result.error is not None
        assert not result.success


class TestWASMAdapter:
    def test_kind(self) -> None:
        assert WASMAdapter.backend_type == "WASM"

    def test_supported_languages_from_config_literal(self) -> None:
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
    def test_stdout_captured_via_setter_property(self) -> None:
        import wasmtime

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
        import wasmtime

        wasi = wasmtime.WasiConfig()
        with pytest.raises(AttributeError):
            _ = wasi.stdout_custom

    def test_stdin_assigned_via_setter_property(self) -> None:
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

    def test_epoch_timer_is_started_and_cancelled(self) -> None:
        import wasmtime

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
                del path

        class _StartFunc:
            def __call__(self, store: object) -> None:
                del store

        class _FakeTimer:
            def __init__(self, interval: float, function: object) -> None:
                self.interval = interval
                self.function = function
                self.daemon = False
                self.started = False
                self.cancelled = False

            def start(self) -> None:
                self.started = True

            def cancel(self) -> None:
                self.cancelled = True

        timers: list[_FakeTimer] = []

        def _make_timer(interval: float, function: object) -> _FakeTimer:
            timer = _FakeTimer(interval, function)
            timers.append(timer)
            return timer

        engine = MagicMock()
        fake_store = MagicMock()
        mock_exports = MagicMock()
        mock_exports.get.return_value = _StartFunc()
        mock_instance = MagicMock()
        mock_instance.exports.return_value = mock_exports

        with patch(
            "phoenix.server.sandbox.wasm_backend._get_engine_and_module",
            return_value=(engine, MagicMock()),
        ):
            with patch("wasmtime.WasiConfig", _CapturingWasiConfig):
                with patch("wasmtime.Linker") as mock_linker_cls:
                    mock_linker = MagicMock()
                    mock_linker_cls.return_value = mock_linker
                    mock_linker.instantiate.return_value = mock_instance
                    with patch("wasmtime.Store", return_value=fake_store):
                        with patch.object(wasmtime, "Func", _StartFunc):
                            with patch(
                                "phoenix.server.sandbox.wasm_backend.threading.Timer",
                                side_effect=_make_timer,
                            ):
                                result = _run_wasm(
                                    Path("/fake/cpython.wasm"), "print(1)", timeout=5
                                )

        assert result.error is None
        fake_store.set_epoch_deadline.assert_called_once_with(1)
        assert len(timers) == 1
        assert timers[0].interval == 5
        assert timers[0].function is engine.increment_epoch
        assert timers[0].daemon is True
        assert timers[0].started is True
        assert timers[0].cancelled is True


class TestTempFileCleanup:
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
        from phoenix.server.sandbox import _download

        monkeypatch.delenv("PHOENIX_WASM_BINARY_PATH", raising=False)
        empty_cache = tmp_path / "cache"
        with patch(
            "urllib.request.urlretrieve", side_effect=AssertionError("network used")
        ) as mock_retrieve:
            resolved = _download.resolve_wasm_binary_if_present(wasm_dir=empty_cache)
        assert resolved is None, "resolver must report no binary when env unset and cache empty"
        mock_retrieve.assert_not_called()
        assert not empty_cache.exists(), "probe must not create the cache directory"


class TestSandboxBackendsResolverWASMStatus:
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
