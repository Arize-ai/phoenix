from __future__ import annotations

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from wasmtime import (
    Config,
    Engine,
    ExitTrap,
    Func,
    Linker,
    Module,
    Store,
    Trap,
    WasiConfig,
)

from phoenix.config import get_working_dir

from .types import BaseNoSessionBackend, ExecutionResult, SandboxAdapter, SandboxBackend

logger = logging.getLogger(__name__)

# Epoch tick interval for timeout enforcement (seconds).
# A single background thread increments the shared engine epoch at this rate.
# Per-execution Store deadlines are set as current_epoch + (timeout / tick_interval),
# so timeouts remain accurate under concurrent executions sharing the same engine.
_EPOCH_TICK_INTERVAL = 0.5

# Module-level cache: maps WASM binary path → (Engine, Module).
# Avoids recompiling the large WASM binary on every WASMBackend() call.
_wasm_module_cache: dict[Path, tuple[Engine, Module]] = {}

# Module-level thread pool singleton keyed by max_workers.
# Shared across all WASMBackend instances to avoid creating redundant pools.
_thread_pools: dict[int, ThreadPoolExecutor] = {}

# Per-engine singleton epoch ticker threads.
# wasmtime's epoch-based timeout design expects one background ticker per engine
# that monotonically increments at a fixed rate. Each Store's deadline is set as
# current_epoch + delta so concurrent executions each have their own absolute
# deadline against the shared monotonic counter — no cross-execution interference.
_epoch_tickers: dict[int, threading.Thread] = {}
_epoch_tickers_lock = threading.Lock()


def _start_epoch_ticker(engine: Engine) -> None:
    """Ensure a daemon ticker thread is running for *engine*."""
    engine_id = id(engine)
    with _epoch_tickers_lock:
        existing = _epoch_tickers.get(engine_id)
        if existing is not None and existing.is_alive():
            return

        def _tick() -> None:
            while True:
                threading.Event().wait(_EPOCH_TICK_INTERVAL)
                engine.increment_epoch()

        t = threading.Thread(target=_tick, daemon=True, name=f"wasm-epoch-ticker-{engine_id}")
        t.start()
        _epoch_tickers[engine_id] = t


def _get_thread_pool(max_workers: int) -> ThreadPoolExecutor:
    if max_workers not in _thread_pools:
        _thread_pools[max_workers] = ThreadPoolExecutor(max_workers=max_workers)
    return _thread_pools[max_workers]


def _wasm_binary_path() -> Path:
    return get_working_dir() / "sandbox" / "python-3.12.0.wasm"


class WASMBackend(BaseNoSessionBackend):
    """Sandbox backend that executes Python code inside a WebAssembly sandbox.

    Uses wasmtime to run a CPython 3.12 WASM binary with WASI deny-all
    configuration. No filesystem, network, or process-spawning access is
    available to guest code. Evaluator code must be pure stdlib Python.

    The compiled WASM Module is cached and shared across all execute() calls.
    Each execute() creates a fresh Store + Instance (~1ms overhead) for
    isolation. A ThreadPoolExecutor is used because wasmtime-py has no native
    async API.

    Timeout enforcement uses wasmtime's epoch-based interruption. A single
    daemon thread per engine increments the epoch at _EPOCH_TICK_INTERVAL.
    Each Store sets its deadline as current_epoch + ticks, giving it an
    independent absolute deadline — concurrent executions on the same engine
    do not interfere with each other's timeouts.

    The WASM binary must be present at the given path before instantiation.
    Call ensure_wasm_binary() during server startup to download it if needed.
    """

    def __init__(
        self,
        wasm_binary: Path | str | None = None,
        max_workers: int = 8,
    ) -> None:
        wasm_path = Path(wasm_binary) if wasm_binary else _wasm_binary_path()
        if not wasm_path.exists():
            raise FileNotFoundError(
                f"WASM binary not found at {wasm_path}. "
                "The binary is downloaded automatically at server startup when the "
                "[sandbox] extra is installed."
            )

        if wasm_path in _wasm_module_cache:
            self._engine, self._module = _wasm_module_cache[wasm_path]
        else:
            config = Config()
            config.epoch_interruption = True
            self._engine = Engine(config)
            self._module = Module.from_file(self._engine, str(wasm_path))
            _wasm_module_cache[wasm_path] = (self._engine, self._module)

        _start_epoch_ticker(self._engine)
        self._pool = _get_thread_pool(max_workers)

    def _run_in_wasm(self, code: str, timeout: float) -> ExecutionResult:
        """Synchronous WASM execution — called inside a thread pool worker."""
        stdout_buf = bytearray()
        stderr_buf = bytearray()

        wasi_config = WasiConfig()
        wasi_config.argv = ("python", "-c", code)
        wasi_config.stdout_custom = lambda data: stdout_buf.extend(data)
        wasi_config.stderr_custom = lambda data: stderr_buf.extend(data)

        store = Store(self._engine)
        store.set_wasi(wasi_config)

        # set_epoch_deadline(delta) adds delta to the engine's *current* epoch,
        # giving this Store an absolute deadline independent of other concurrent
        # executions. The shared ticker increments the engine epoch at a fixed rate.
        epoch_ticks = max(1, int(timeout / _EPOCH_TICK_INTERVAL))
        store.set_epoch_deadline(epoch_ticks)

        linker = Linker(self._engine)
        linker.define_wasi()

        try:
            instance = linker.instantiate(store, self._module)
            start_fn = instance.exports(store)["_start"]
            if not isinstance(start_fn, Func):
                raise RuntimeError("_start export is not a Func")
            start_fn(store)
            return ExecutionResult(
                stdout=stdout_buf.decode("utf-8", errors="replace"),
                stderr=stderr_buf.decode("utf-8", errors="replace"),
                exit_code=0,
            )
        except ExitTrap as exc:
            return ExecutionResult(
                stdout=stdout_buf.decode("utf-8", errors="replace"),
                stderr=stderr_buf.decode("utf-8", errors="replace"),
                exit_code=exc.code,
                error=exc if exc.code != 0 else None,
            )
        except Trap as exc:
            trap_msg = str(exc)
            is_timeout = "interrupt" in trap_msg
            if is_timeout:
                return ExecutionResult(
                    stdout=stdout_buf.decode("utf-8", errors="replace"),
                    stderr=f"Execution timed out after {timeout}s",
                    exit_code=-1,
                    timed_out=True,
                )
            return ExecutionResult(
                stdout=stdout_buf.decode("utf-8", errors="replace"),
                stderr=stderr_buf.decode("utf-8", errors="replace") or trap_msg,
                exit_code=1,
                error=exc,
            )
        except Exception as exc:
            return ExecutionResult(
                stdout=stdout_buf.decode("utf-8", errors="replace"),
                stderr=str(exc),
                exit_code=1,
                error=exc,
            )

    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._pool, self._run_in_wasm, code, timeout)

    async def close(self) -> None:
        pass


class WASMAdapter(SandboxAdapter):
    _key = "WASM"
    label = "WASM (Local)"
    description = "Runs code evaluators locally using WebAssembly."
    python_packages = ["wasmtime"]
    env_vars: list[Any] = []
    config_fields: list[Any] = []
    config_required = False
    setup_instructions = ['pip install "arize-phoenix[sandbox]"']

    def is_installed(self) -> bool:
        if not super().is_installed():
            return False
        return _wasm_binary_path().exists()

    def create_backend(self, config: dict[str, Any], credentials: dict[str, Any]) -> SandboxBackend:
        wasm_path = _wasm_binary_path()
        return WASMBackend(wasm_binary=wasm_path)
