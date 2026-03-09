from __future__ import annotations

import asyncio
import hashlib
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

_HASH_LENGTH = 16

logger = logging.getLogger(__name__)

# Epoch tick interval for timeout enforcement (seconds).
_EPOCH_TICK_INTERVAL = 0.5

# Module-level cache: maps WASM binary path → (Engine, Module, env_hash).
# Avoids recompiling the large WASM binary and rehashing on every WASMBackend() call.
_wasm_module_cache: dict[Path, tuple[Engine, Module, str]] = {}

# Module-level thread pool singleton keyed by max_workers.
# Shared across all WASMBackend instances to avoid creating redundant pools.
_thread_pools: dict[int, ThreadPoolExecutor] = {}


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
            self._engine, self._module, self._env_hash = _wasm_module_cache[wasm_path]
        else:
            config = Config()
            config.epoch_interruption = True
            self._engine = Engine(config)
            self._module = Module.from_file(self._engine, str(wasm_path))
            self._env_hash = self._compute_hash(wasm_path)
            _wasm_module_cache[wasm_path] = (self._engine, self._module, self._env_hash)
        self._pool = _get_thread_pool(max_workers)

    @staticmethod
    def _compute_hash(wasm_path: Path) -> str:
        h = hashlib.sha256(wasm_path.read_bytes())
        return h.hexdigest()[:_HASH_LENGTH]

    def environment_hash(self) -> str:
        return self._env_hash

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

        # Epoch-based timeout: compute ticks from timeout and tick interval.
        epoch_ticks = max(1, int(timeout / _EPOCH_TICK_INTERVAL))
        store.set_epoch_deadline(epoch_ticks)

        # Background thread to increment epoch at fixed intervals.
        stop_event = threading.Event()

        def _epoch_timer() -> None:
            for _ in range(epoch_ticks):
                if stop_event.wait(_EPOCH_TICK_INTERVAL):
                    return
                self._engine.increment_epoch()

        timer = threading.Thread(target=_epoch_timer, daemon=True)
        timer.start()

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
                    error=TimeoutError(f"WASM execution timed out after {timeout}s"),
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
        finally:
            stop_event.set()

    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._pool, self._run_in_wasm, code, timeout)

    async def close(self) -> None:
        pass

    async def __aenter__(self) -> "WASMBackend":
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.close()


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
