"""
WASM sandbox backend.

Executes Python code locally via a CPython 3.12 WebAssembly binary using the
``wasmtime`` runtime. Stateless — inherits BaseNoSessionBackend.

The WASM binary is downloaded on first use via _download.ensure_wasm_binary().
Execution runs in a thread pool to avoid blocking the event loop.

Requires the ``wasmtime`` package (optional extra). Runtime imports are lazy
inside ``_run_wasm`` and ``_get_engine_and_module`` so the module remains
importable when the extra is absent (test environments mock or skip). Adapter
availability is gated by ``WASMAdapter.probe_dependencies`` at registration
time, which surfaces a missing extra as ``status=NOT_INSTALLED`` instead of a
runtime error during evaluation.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Mapping, Optional

if TYPE_CHECKING:
    import wasmtime

from ._text import strip_ansi
from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    WASMConfig,
)

logger = logging.getLogger(__name__)

_WASM_BINARY_PATH_ENV = "PHOENIX_WASM_BINARY_PATH"

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
            stdout=strip_ansi(b"".join(stdout_chunks).decode("utf-8", errors="replace")),
            stderr=strip_ansi(b"".join(stderr_chunks).decode("utf-8", errors="replace")),
        )
    except Exception as exc:
        return ExecutionResult(
            stdout=strip_ansi(b"".join(stdout_chunks).decode("utf-8", errors="replace")),
            stderr=strip_ansi(b"".join(stderr_chunks).decode("utf-8", errors="replace")),
            error=strip_ansi(str(exc)),
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
        # secret_values stays at the SandboxBackend class default (frozenset()):
        # WASM takes no provider credentials and does not support user_env.
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
    """Outcome of a non-network probe for the CPython WASM binary.

    ``available`` is True when a binary file is resolvable locally without any
    download — either via ``$PHOENIX_WASM_BINARY_PATH`` (when set and the file
    exists) or via the existing on-disk cache. ``detail`` is a human-readable
    explanation suitable for ``SandboxBackendInfo.statusDetail``; it is None
    when the binary is available.
    """

    available: bool
    detail: Optional[str]
    path: Optional[Path]


class WASMAdapter(SandboxAdapter):
    key = "WASM"
    family = "WASM"
    display_name = "WebAssembly"
    language = "PYTHON"
    config_model = WASMConfig

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify ``wasmtime`` is installed; ImportError surfaces NOT_INSTALLED."""
        import wasmtime  # noqa: F401

    def build_backend(
        self,
        config: Mapping[str, Any],
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        return WASMBackend()

    @staticmethod
    def probe_binary() -> WASMBinaryProbe:
        """Report whether the CPython WASM binary is locally resolvable.

        This is the *capability-probe* path — it MUST NOT touch the network,
        MUST NOT create cache files, and MUST NOT write anywhere. It is called
        from the GraphQL ``sandboxBackends`` resolver to surface accurate
        ``SandboxBackendStatus`` for the WASM provider, layered on top of the
        wasmtime-importable check that ``_SANDBOX_ADAPTERS`` registration
        already provides.

        Outcomes:
        - ``available=True`` — a binary file exists at
          ``$PHOENIX_WASM_BINARY_PATH`` (when the env var is set) or at the
          default cache location (when it is unset).
        - ``available=False`` with detail
          ``"PHOENIX_WASM_BINARY_PATH=<path> is set but the file does not exist."``
          — the env var is set but the file is missing. The execution path
          treats the env var as authoritative and will NOT fall back to lazy
          download in that case, so this is the correct surfaced state.
        - ``available=False`` with detail
          ``"WASM binary not present locally; will download on first use."``
          — env var unset and no cache file. Execution will succeed via
          lazy download on first use, but operators may want to pre-warm
          the cache to avoid a cold-start cost.

        The two distinct detail strings let docs/UI link to the relevant
        remediation.
        """
        from phoenix.server.sandbox._download import resolve_wasm_binary_if_present

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
        return WASMBinaryProbe(
            available=False,
            detail="WASM binary not present locally; will download on first use.",
            path=None,
        )
