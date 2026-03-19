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
from typing import Any, Optional

import wasmtime

from .types import (
    BaseNoSessionBackend,
    ConfigFieldSpec,
    EnvVarSpec,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_SECONDS = 30
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="wasm-sandbox")

# Module-level binary cache: path → compiled wasmtime.Module.
_MODULE_CACHE: dict[str, wasmtime.Module] = {}


def _run_wasm(binary_path: Path, code: str, timeout: int) -> ExecutionResult:
    """Execute *code* in a wasmtime WASI context. Runs in a thread."""
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    try:
        engine_cfg = wasmtime.Config()
        engine_cfg.epoch_interruption = True
        engine = wasmtime.Engine(engine_cfg)

        linker = wasmtime.Linker(engine)
        linker.define_wasi()

        wasi = wasmtime.WasiConfig()
        wasi.inherit_env()
        wasi.stdout_custom(stdout_buf)
        wasi.stderr_custom(stderr_buf)

        # Inject code via a temp stdin file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            stdin_path = f.name
        wasi.stdin_file(stdin_path)

        store = wasmtime.Store(engine)
        store.set_wasi(wasi)
        store.set_epoch_deadline(timeout)

        cache_key = str(binary_path)
        if cache_key not in _MODULE_CACHE:
            _MODULE_CACHE[cache_key] = wasmtime.Module.from_file(engine, str(binary_path))
        module = _MODULE_CACHE[cache_key]

        instance = linker.instantiate(store, module)
        exports = instance.exports(store)
        start = exports.get("_start")
        if isinstance(start, wasmtime.Func):
            start(store)

        return ExecutionResult(stdout=stdout_buf.getvalue(), stderr=stderr_buf.getvalue())
    except Exception as exc:
        return ExecutionResult(
            stdout=stdout_buf.getvalue(),
            stderr=stderr_buf.getvalue(),
            error=str(exc),
        )


class WASMBackend(BaseNoSessionBackend):
    """Local CPython-WASM sandbox backend. Stateless and single-node."""

    def __init__(
        self,
        binary_path: Optional[Path] = None,
        timeout: int = _DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._binary_path = binary_path
        self._timeout = timeout

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
    ) -> ExecutionResult:
        binary_path = self._resolve_binary()
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _EXECUTOR,
            _run_wasm,
            binary_path,
            code,
            self._timeout,
        )

    async def close(self) -> None:
        pass


class WASMAdapter(SandboxAdapter):
    key = "WASM"
    display_name = "WebAssembly (local)"
    supported_languages = ["PYTHON"]
    env_var_specs: list[EnvVarSpec] = []
    config_field_specs = [
        ConfigFieldSpec(
            name="timeout",
            description="Execution timeout in seconds",
            required=False,
            default=_DEFAULT_TIMEOUT_SECONDS,
        ),
    ]

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        timeout = int(config.get("timeout", _DEFAULT_TIMEOUT_SECONDS))
        return WASMBackend(timeout=timeout)
