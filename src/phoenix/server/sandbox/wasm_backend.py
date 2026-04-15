"""
WASM sandbox backend.

Executes Python code locally via a CPython 3.12 WebAssembly binary using the
``wasmtime`` runtime. Stateless — inherits BaseNoSessionBackend.

The WASM binary is downloaded on first use via _download.ensure_wasm_binary().
Execution runs in a thread pool to avoid blocking the event loop.

Requires the ``wasmtime`` package (optional extra).
"""

from __future__ import annotations

import asyncio
import io
import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    import wasmtime  # type: ignore[import-not-found]

from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    UnsupportedOperation,
    WASMConfig,
)

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_SECONDS = 30
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="wasm-sandbox")


# Module-level cache: path → (engine, compiled module).
# Engine and module must be paired — a module compiled with one engine
# cannot be used with a store from a different engine.
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

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    stdin_path: str | None = None

    try:
        engine, module = _get_engine_and_module(binary_path)

        linker = _wasm.Linker(engine)
        linker.define_wasi()

        wasi = _wasm.WasiConfig()
        wasi.stdout_custom(stdout_buf)
        wasi.stderr_custom(stderr_buf)

        # Inject code via a temp stdin file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            stdin_path = f.name
        wasi.stdin_file(stdin_path)

        store = _wasm.Store(engine)
        store.set_wasi(wasi)
        store.set_epoch_deadline(timeout)

        instance = linker.instantiate(store, module)
        exports = instance.exports(store)
        start = exports.get("_start")
        if isinstance(start, _wasm.Func):
            start(store)

        return ExecutionResult(stdout=stdout_buf.getvalue(), stderr=stderr_buf.getvalue())
    except Exception as exc:
        return ExecutionResult(
            stdout=stdout_buf.getvalue(),
            stderr=stderr_buf.getvalue(),
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

    def __init__(
        self,
        binary_path: Optional[Path] = None,
    ) -> None:
        self._binary_path = binary_path

    def _resolve_binary(self) -> Path:
        if self._binary_path is not None:
            return self._binary_path
        from phoenix.server.sandbox._download import ensure_wasm_binary

        return ensure_wasm_binary()

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        if env:
            raise UnsupportedOperation("WASM backend does not support environment variables")
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


class WASMAdapter(SandboxAdapter):
    key = "WASM"
    display_name = "WebAssembly (local)"
    language = "PYTHON"
    config_model = WASMConfig

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        if user_env:
            raise UnsupportedOperation(
                "WASM backend does not support user-supplied environment variables. "
                "Disable env_vars for WASM configs or switch to a backend that "
                "supports env vars (e.g. E2B)."
            )
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        if packages:
            raise UnsupportedOperation(
                "WASM backend does not support dependency installation. "
                "Use a pre-baked template or switch to a backend that supports dependencies."
            )
        internet_access = config.get("internet_access")
        if internet_access is not None:
            mode = (
                internet_access.get("mode")
                if isinstance(internet_access, dict)
                else getattr(internet_access, "mode", None)
            )
            if mode is not None:
                raise UnsupportedOperation(
                    "WASM backend does not support internet_access configuration. "
                    "Remove the internet_access field or switch to a backend that supports it."
                )
        return WASMBackend()
