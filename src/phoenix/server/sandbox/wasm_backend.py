"""
WASM sandbox backend.

Executes Python code locally via a CPython 3.12 WebAssembly binary using the
``wasmtime`` runtime. Stateless — inherits BaseNoSessionBackend.

The WASM binary is downloaded on first use via _download.ensure_wasm_binary().
Execution runs in a thread pool to avoid blocking the event loop. A single
execution's host-memory footprint is bounded on two fronts: the guest's
WebAssembly linear memory is capped (_MAX_WASM_MEMORY_BYTES), and captured
stdout/stderr is capped (_MAX_OUTPUT_BYTES) so a guest that prints in a loop
cannot grow host RAM through output alone.

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
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Iterator, Mapping, Optional

if TYPE_CHECKING:
    import wasmtime

from phoenix.config import ENV_PHOENIX_WASM_BINARY_PATH, get_env_wasm_binary_path

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

_DEFAULT_TIMEOUT_SECONDS = 30
_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="wasm-sandbox")

# 1s tick: store epoch deadline (a tick count) maps directly to seconds.
_EPOCH_INTERVAL_SECONDS = 1.0

# Cap on a single guest's WebAssembly linear memory. An over-cap memory.grow
# fails inside the guest (MemoryError in CPython-WASM) rather than OOM-killing
# the Phoenix process. 128 MiB is well above the interpreter's baseline and
# leaves room for evaluator code, while keeping the aggregate a single user
# can pin modest: _EXECUTOR runs 4 workers, so worst case is 4 × this.
_MAX_WASM_MEMORY_BYTES = 128 * 1024 * 1024

# Per-stream cap on guest stdout/stderr retained in host memory. Distinct from
# _MAX_WASM_MEMORY_BYTES: that bounds the guest's own memory, not what the host
# accumulates from its output. See _BoundedOutputSink.
_MAX_OUTPUT_BYTES = 1024 * 1024


# Engine and module must be paired: a module compiled with one engine cannot
# be used with a store from a different engine.
_MODULE_CACHE: dict[str, tuple[wasmtime.Engine, wasmtime.Module]] = {}

_EPOCH_TICKERS: dict[int, "_EngineEpochTicker"] = {}
_EPOCH_TICKERS_LOCK = threading.Lock()


class _EngineEpochTicker:
    """Drives ``engine.increment_epoch()`` so store epoch deadlines fire.

    ``acquire``/``release`` mutate ``_ref_count`` under ``_EPOCH_TICKERS_LOCK``.
    """

    def __init__(self, engine: wasmtime.Engine) -> None:
        self._engine = engine
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=self._run,
            name="wasm-sandbox-epoch",
            daemon=True,
        )
        self._ref_count = 0

    def acquire(self) -> None:
        self._ref_count += 1
        if not self._thread.is_alive():
            self._thread.start()

    def release(self) -> bool:
        self._ref_count -= 1
        return self._ref_count <= 0

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=_EPOCH_INTERVAL_SECONDS * 2)

    def _run(self) -> None:
        while not self._stop.wait(_EPOCH_INTERVAL_SECONDS):
            try:
                self._engine.increment_epoch()
            except Exception:
                logger.debug("Error incrementing WASM engine epoch", exc_info=True)


@contextmanager
def _engine_epoch_ticker(engine: wasmtime.Engine) -> Iterator[None]:
    """Ref-counted lifetime guard for the per-engine epoch ticker."""
    engine_key = id(engine)
    with _EPOCH_TICKERS_LOCK:
        ticker = _EPOCH_TICKERS.get(engine_key)
        if ticker is None:
            ticker = _EngineEpochTicker(engine)
            _EPOCH_TICKERS[engine_key] = ticker
        ticker.acquire()
    try:
        yield
    finally:
        with _EPOCH_TICKERS_LOCK:
            stop_ticker = ticker.release()
            if stop_ticker:
                _EPOCH_TICKERS.pop(engine_key, None)
        if stop_ticker:
            ticker.stop()


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


class _BoundedOutputSink:
    """Accumulates guest stdout/stderr into a sliding window of the most recent
    ``limit`` bytes, so a guest that prints in a loop cannot grow host RAM
    without bound.

    The window keeps the **tail**, not the head. This is deliberate: the
    code-evaluator harness prints its fenced result markers (parsed by
    ``_extract_fenced_result``) last, after the user's code, so head-truncation
    would drop them and break result parsing — the tiny trailing marker block
    always fits the retained tail. ``getvalue()`` prepends a notice when older
    output was dropped.
    """

    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._buf = bytearray()
        self._dropped = 0

    def write(self, data: bytes) -> None:
        # A write at least as large as the window makes everything buffered so
        # far unreachable. Slice to the tail rather than appending: `_buf +=`
        # would copy the whole payload in, so the sink's transient footprint
        # would track the largest callback payload, not the window.
        if len(data) >= self._limit:
            self._dropped += len(self._buf) + (len(data) - self._limit)
            self._buf = bytearray(data[-self._limit :])
            return
        self._buf += data
        # Trim lazily — only once the buffer reaches twice the window — so the
        # amortized cost is O(1) per byte rather than O(limit) per write.
        if len(self._buf) > 2 * self._limit:
            self._trim()

    def _trim(self) -> None:
        excess = len(self._buf) - self._limit
        if excess > 0:
            del self._buf[:excess]
            self._dropped += excess

    def getvalue(self) -> str:
        self._trim()
        text = self._buf.decode("utf-8", errors="replace")
        if self._dropped:
            text = f"[output truncated: {self._dropped} earlier bytes dropped]\n{text}"
        return text


def _run_wasm(binary_path: Path, code: str, timeout: int) -> ExecutionResult:
    """Execute *code* in a wasmtime WASI context. Runs in a thread."""
    import wasmtime as _wasm

    stdout_sink = _BoundedOutputSink(_MAX_OUTPUT_BYTES)
    stderr_sink = _BoundedOutputSink(_MAX_OUTPUT_BYTES)
    stdin_path: str | None = None
    started_at = time.monotonic()

    try:
        engine, module = _get_engine_and_module(binary_path)

        linker = _wasm.Linker(engine)
        linker.define_wasi()

        wasi = _wasm.WasiConfig()
        wasi.stdout_custom = stdout_sink.write
        wasi.stderr_custom = stderr_sink.write

        # Inject code via a temp stdin file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            stdin_path = f.name
        wasi.stdin_file = stdin_path

        store = _wasm.Store(engine)
        store.set_wasi(wasi)
        # Deadline in engine ticks; with a 1s tick this is `timeout` seconds.
        store.set_epoch_deadline(timeout)
        # Must be set before instantiate(), where the guest memory is created.
        # See _MAX_WASM_MEMORY_BYTES.
        store.set_limits(memory_size=_MAX_WASM_MEMORY_BYTES)

        with _engine_epoch_ticker(engine):
            instance = linker.instantiate(store, module)
            exports = instance.exports(store)
            start = exports.get("_start")
            if isinstance(start, _wasm.Func):
                start(store)

        return ExecutionResult(stdout=stdout_sink.getvalue(), stderr=stderr_sink.getvalue())
    except Exception as exc:
        stdout = stdout_sink.getvalue()
        stderr = stderr_sink.getvalue()
        # Classify late traps as timeouts (raw wasmtime trap string is opaque).
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

        env_path = get_env_wasm_binary_path()
        if env_path is not None:
            return WASMBinaryProbe(
                available=False,
                detail=(
                    f"{ENV_PHOENIX_WASM_BINARY_PATH}={env_path} is set but the file does not exist."
                ),
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
