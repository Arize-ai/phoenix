"""WASM sandbox backend executing Python via CPython-WASM under wasmtime."""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Mapping, Optional

if TYPE_CHECKING:
    import wasmtime

from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    NoCredentials,
    SandboxAdapter,
    SandboxBackend,
    WASMConfig,
    WASMDeployment,
)

logger = logging.getLogger(__name__)

_WASM_BINARY_PATH_ENV = "PHOENIX_WASM_BINARY_PATH"

_DEFAULT_TIMEOUT_SECONDS = 30
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="wasm-sandbox")


# Engine and module must be paired: a module compiled with one engine cannot
# be used with a store from a different engine.
_MODULE_CACHE: dict[str, tuple[wasmtime.Engine, wasmtime.Module]] = {}


def _get_engine_and_module(binary_path: Path) -> tuple[wasmtime.Engine, wasmtime.Module]:
    """Return a cached (engine, module) pair, compiling on first use."""
    import wasmtime as _wasm

    cache_key = str(binary_path)
    if cache_key not in _MODULE_CACHE:
        engine_cfg = _wasm.Config()
        engine_cfg.epoch_interruption = True
        engine = _wasm.Engine(engine_cfg)
        module = _wasm.Module.from_file(engine, str(binary_path))
        _MODULE_CACHE[cache_key] = (engine, module)
    return _MODULE_CACHE[cache_key]


def _run_wasm(binary_path: Path, code: str, timeout: int) -> ExecutionResult:
    """Execute *code* in a wasmtime WASI context. Runs in a thread."""
    import wasmtime as _wasm

    stdout_chunks: list[bytes] = []
    stderr_chunks: list[bytes] = []
    stdin_path: str | None = None

    try:
        engine, module = _get_engine_and_module(binary_path)

        linker = _wasm.Linker(engine)
        linker.define_wasi()

        wasi = _wasm.WasiConfig()
        wasi.stdout_custom = lambda data: stdout_chunks.append(data)
        wasi.stderr_custom = lambda data: stderr_chunks.append(data)

        # Inject code via a temp stdin file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            stdin_path = f.name
        wasi.stdin_file = stdin_path

        store = _wasm.Store(engine)
        store.set_wasi(wasi)
        store.set_epoch_deadline(timeout)

        instance = linker.instantiate(store, module)
        exports = instance.exports(store)
        start = exports.get("_start")
        if isinstance(start, _wasm.Func):
            start(store)

        return ExecutionResult(
            stdout=b"".join(stdout_chunks).decode("utf-8", errors="replace"),
            stderr=b"".join(stderr_chunks).decode("utf-8", errors="replace"),
        )
    except Exception as exc:
        return ExecutionResult(
            stdout=b"".join(stdout_chunks).decode("utf-8", errors="replace"),
            stderr=b"".join(stderr_chunks).decode("utf-8", errors="replace"),
            error=str(exc),
        )
    finally:
        if stdin_path is not None:
            import os

            try:
                os.unlink(stdin_path)
            except OSError:
                pass


class WASMBackend(BaseNoSessionBackend):
    """Local CPython-WASM sandbox backend. Stateless and single-node."""

    def __init__(self) -> None:
        pass

    def _resolve_binary(self) -> Path:
        from phoenix.server.sandbox._download import ensure_wasm_binary

        return ensure_wasm_binary()

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        binary_path = self._resolve_binary()
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _EXECUTOR,
            _run_wasm,
            binary_path,
            code,
            timeout if timeout is not None else _DEFAULT_TIMEOUT_SECONDS,
        )

    async def close(self) -> None:
        pass


@dataclass(frozen=True)
class WASMBinaryProbe:
    """Outcome of a non-network probe for the CPython WASM binary."""

    available: bool
    detail: Optional[str]
    path: Optional[Path]


class WASMAdapter(SandboxAdapter[WASMConfig, NoCredentials, WASMDeployment]):
    backend_type = "WASM"
    display_name = "WebAssembly"
    hosting_type = "local"
    dependency_hints = (
        "Install Phoenix with the `wasm` extra so `wasmtime` is available.",
        (
            "Allow Phoenix to download the CPython WASM binary on first use, "
            "or pre-populate the local WASM cache."
        ),
    )
    config_model = WASMConfig
    credentials_model = NoCredentials
    deployment_config_model = WASMDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify ``wasmtime`` is installed; ImportError surfaces NOT_INSTALLED."""
        import wasmtime  # noqa: F401

    def build_backend(
        self,
        config: WASMConfig,
        *,
        credentials: NoCredentials,
        deployment: WASMDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        return WASMBackend()

    @staticmethod
    def probe_binary() -> WASMBinaryProbe:
        """Report whether the CPython WASM binary is locally resolvable. No network, no writes."""
        from phoenix.config import _no_local_storage
        from phoenix.server.sandbox._download import (
            no_local_storage_message,
            resolve_wasm_binary_if_present,
        )

        resolved = resolve_wasm_binary_if_present()
        if resolved is not None:
            return WASMBinaryProbe(available=True, detail=None, path=resolved)

        env_path = os.environ.get(_WASM_BINARY_PATH_ENV)
        if env_path:
            return WASMBinaryProbe(
                available=False,
                detail=(f"{_WASM_BINARY_PATH_ENV}={env_path} is set but the file does not exist."),
                path=None,
            )
        if _no_local_storage():
            return WASMBinaryProbe(
                available=False,
                detail=no_local_storage_message(short=True),
                path=None,
            )
        return WASMBinaryProbe(
            available=False,
            detail="WASM binary not present locally; will download on first use.",
            path=None,
        )
