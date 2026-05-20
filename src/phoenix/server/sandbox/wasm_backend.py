"""
WASM sandbox backend.

Executes Python code locally via a CPython 3.12 WebAssembly binary using the
``wasmtime`` runtime. Stateless — inherits BaseNoSessionBackend.

The WASM binary is downloaded on first use via _download.ensure_wasm_binary().
Execution runs in a thread pool to avoid blocking the event loop. The
per-execution timeout is enforced through wasmtime epoch interruption: a
daemon ticker thread advances the engine epoch (see _start_epoch_ticker) so a
store's epoch deadline actually traps runaway guest code instead of letting it
run forever and leak a worker thread.

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
import math
import os
import tempfile
import threading
import time
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


# Wall-clock interval between engine epoch increments. A store's epoch
# deadline is a tick count, so with a 1s tick it maps directly to seconds.
_EPOCH_TICK_SECONDS = 1.0

# Module-level cache: path → (engine, compiled module).
# Engine and module must be paired — a module compiled with one engine
# cannot be used with a store from a different engine.
_MODULE_CACHE: dict[str, tuple[wasmtime.Engine, wasmtime.Module]] = {}

# Serializes the check-compile-cache sequence in _get_engine_and_module so
# concurrent _EXECUTOR worker threads cannot create duplicate engines — each
# duplicate would also spawn its own (orphaned, never-stopping) ticker thread.
_MODULE_CACHE_LOCK = threading.Lock()


def _start_epoch_ticker(engine: wasmtime.Engine) -> None:
    """Advance *engine*'s epoch on a daemon thread, once per _EPOCH_TICK_SECONDS.

    wasmtime epoch interruption only traps a running guest once the engine's
    epoch counter passes the store's deadline, and that counter advances ONLY
    when increment_epoch() is called. Without this ticker the deadline set in
    _run_wasm would never be reached, so guest code such as an infinite loop
    would run forever and permanently consume an _EXECUTOR worker thread —
    four such executions would wedge the WASM backend process-wide.

    The thread is a daemon (never blocks interpreter shutdown) and keeps the
    engine alive, which is fine: engines live in _MODULE_CACHE for the life of
    the process anyway.
    """

    def _tick() -> None:
        while True:
            time.sleep(_EPOCH_TICK_SECONDS)
            engine.increment_epoch()

    threading.Thread(target=_tick, name="wasm-epoch-ticker", daemon=True).start()


def _get_engine_and_module(binary_path: Path) -> tuple[wasmtime.Engine, wasmtime.Module]:
    """Return a cached (engine, module) pair, compiling on first use.

    The first call for a binary creates the engine and starts its epoch-ticker
    thread (see _start_epoch_ticker) so per-store epoch deadlines fire. The
    lock keeps that one-time setup atomic across worker threads.
    """
    import wasmtime as _wasm

    cache_key = str(binary_path)
    with _MODULE_CACHE_LOCK:
        if cache_key not in _MODULE_CACHE:
            engine_cfg = _wasm.Config()
            engine_cfg.epoch_interruption = True
            engine = _wasm.Engine(engine_cfg)
            module = _wasm.Module.from_file(engine, str(binary_path))
            _start_epoch_ticker(engine)
            _MODULE_CACHE[cache_key] = (engine, module)
        return _MODULE_CACHE[cache_key]


def _run_wasm(binary_path: Path, code: str, timeout: int) -> ExecutionResult:
    """Execute *code* in a wasmtime WASI context. Runs in a thread.

    The *timeout* (seconds) is enforced via the store's epoch deadline, which
    the engine ticker thread advances; runaway guest code traps after roughly
    *timeout* seconds and is reported as a timeout rather than running forever
    and leaking this worker thread.
    """
    import wasmtime as _wasm

    stdout_chunks: list[bytes] = []
    stderr_chunks: list[bytes] = []
    stdin_path: str | None = None
    started_at = time.monotonic()

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
        # Epoch deadline, expressed in engine ticks. The ticker advances one
        # tick every _EPOCH_TICK_SECONDS, so ceil(timeout / tick) ticks is
        # roughly `timeout` seconds; at least one tick so a deadline always
        # exists.
        store.set_epoch_deadline(max(1, math.ceil(timeout / _EPOCH_TICK_SECONDS)))

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
        stdout = b"".join(stdout_chunks).decode("utf-8", errors="replace")
        stderr = b"".join(stderr_chunks).decode("utf-8", errors="replace")
        # An epoch-deadline trap fires ~timeout seconds in. wasmtime surfaces
        # it as a generic trap, so identify it by elapsed wall time and report
        # an actionable timeout message instead of a raw trap string.
        if time.monotonic() - started_at >= timeout:
            message = f"Execution timed out after {timeout}s"
            return ExecutionResult(stdout=stdout, stderr=stderr, error=message)
        return ExecutionResult(stdout=stdout, stderr=stderr, error=str(exc))
    finally:
        if stdin_path is not None:
            try:
                os.unlink(stdin_path)
            except OSError:
                pass


class WASMBackend(BaseNoSessionBackend):
    """Local CPython-WASM sandbox backend. Stateless and single-node."""

    def __init__(self) -> None:
        # secret_values stays at the SandboxBackend class default (frozenset()):
        # WASM takes no provider credentials and does not support user_env.
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
          default location under the Phoenix working directory (when the env
          var is unset).
        - ``available=False`` with detail
          ``"PHOENIX_WASM_BINARY_PATH=<path> is set but the file does not exist."``
          — the env var is set but the file is missing. The execution path
          treats the env var as authoritative and will NOT fall back to lazy
          download in that case, so this is the correct surfaced state.
        - ``available=False`` with the no-local-storage short-form detail —
          Phoenix is running with a postgres database and no
          ``PHOENIX_WORKING_DIR``, so the runtime cannot be saved locally
          and no operator-supplied binary path is set.
        - ``available=False`` with detail
          ``"WASM binary not present locally; will download on first use."``
          — env var unset, working directory writable, and the binary has
          not yet been downloaded. Execution will succeed via lazy download
          on first use, but operators may want to pre-warm the binary to
          avoid a cold-start cost.
        """
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
