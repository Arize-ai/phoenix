from __future__ import annotations

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from wasmtime import (  # type: ignore[import-not-found]
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

from .types import ExecutionResult, UnsupportedOperation

logger = logging.getLogger(__name__)

# Epoch tick interval for timeout enforcement (seconds).
_EPOCH_TICK_INTERVAL = 0.5


def _default_wasm_binary() -> Path:
    return get_working_dir() / "sandbox" / "python-3.12.0.wasm"


class WASMBackend:
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
        wasm_path = Path(wasm_binary) if wasm_binary else _default_wasm_binary()
        if not wasm_path.exists():
            raise FileNotFoundError(
                f"WASM binary not found at {wasm_path}. "
                "The binary is downloaded automatically at server startup when the "
                "[sandbox] extra is installed."
            )

        config = Config()
        config.epoch_interruption = True
        self._engine = Engine(config)
        self._module = Module.from_file(self._engine, str(wasm_path))
        self._pool = ThreadPoolExecutor(max_workers=max_workers)

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

    async def execute(self, code: str, timeout: float = 30.0) -> ExecutionResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._pool, self._run_in_wasm, code, timeout)

    async def install(self, packages: list[str]) -> None:
        raise UnsupportedOperation(
            "WASMBackend does not support third-party packages. "
            "Evaluator code must use Python stdlib only. "
            "Use the container backend for evaluators that require packages."
        )

    async def close(self) -> None:
        self._pool.shutdown(wait=False)

    async def __aenter__(self) -> "WASMBackend":
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.close()
