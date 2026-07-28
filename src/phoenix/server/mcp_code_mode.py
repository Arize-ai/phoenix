from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack
from types import ModuleType
from typing import TYPE_CHECKING, Any, Callable, Optional, Union

from fastmcp.exceptions import ToolError

if TYPE_CHECKING:
    from pydantic_monty import AsyncMonty, ResourceLimits

logger = logging.getLogger(__name__)


DEFAULT_LIMITS: "ResourceLimits" = {
    "max_duration_secs": 30.0,
    "max_memory": 100_000_000,  # 100 MB
    "max_recursion_depth": 200,
}
"""Per-session guest limits. ``max_duration_secs`` charges guest execution only,
not time awaiting a host callback."""

DEFAULT_MAX_PROCESSES = 4
"""Ceiling on concurrent ``execute`` calls; each holds one worker."""

DEFAULT_REQUEST_TIMEOUT = 180.0
"""Deadline for one pool/worker turn, re-armed each round-trip. Bounds how long a
worker can go silent, not how long an ``execute`` takes."""

DEFAULT_TOTAL_TIMEOUT = 300.0
"""End-to-end ceiling for one ``execute``, host callbacks and pool startup
included. Immediate for a block awaiting a tool; a block already executing runs
on to its guest limit."""

DEFAULT_CHECKOUT_TIMEOUT = 30.0
"""How long an ``execute`` waits for a free worker before reporting a busy
sandbox."""

STARTUP_CHECK_TIMEOUT = 10.0
"""Ceiling on the ``validate`` probe. It runs inline in server startup, so an
install that spawns but never responds must stall boot briefly, not for the
full execute budget."""


class _Unset:
    """Sentinel separating "argument omitted" from an explicit ``None``."""

    def __repr__(self) -> str:
        return "UNSET"


UNSET = _Unset()


def _import_monty() -> ModuleType:
    """Import ``pydantic_monty``, deferred so a disabled code mode never loads it."""
    try:
        import pydantic_monty
    except ModuleNotFoundError as exc:
        raise ToolError(
            "Code mode requires pydantic-monty, which is not installed. Reinstall "
            "Phoenix, or disable code mode with PHOENIX_ENABLE_MCP_CODE_MODE=false."
        ) from exc
    return pydantic_monty


class MontyPoolSandboxProvider:
    """FastMCP ``SandboxProvider`` running code-mode blocks in worker subprocesses.

    Each ``run`` checks out its own session, so no guest state survives into
    another ``execute``.

    Args:
        limits: Per-session guest limits. Omit for :data:`DEFAULT_LIMITS`; pass
            ``None`` for no guest limits.
        max_processes: Ceiling on live workers, and so on concurrent ``execute``.
        request_timeout: Deadline for one pool/worker turn; exceeding it kills
            the worker.
        total_timeout: End-to-end deadline for one ``execute``; prompt for a block
            awaiting a tool, but one already executing runs on to its guest
            limit. ``None`` removes it.
        checkout_timeout: How long to wait for a free worker before reporting busy.
    """

    def __init__(
        self,
        *,
        limits: Union["ResourceLimits", None, _Unset] = UNSET,
        max_processes: int = DEFAULT_MAX_PROCESSES,
        request_timeout: float = DEFAULT_REQUEST_TIMEOUT,
        total_timeout: Optional[float] = DEFAULT_TOTAL_TIMEOUT,
        checkout_timeout: float = DEFAULT_CHECKOUT_TIMEOUT,
    ) -> None:
        # Copied so neither a caller's dict nor DEFAULT_LIMITS is mutable through
        # this attribute.
        if isinstance(limits, _Unset):
            resolved: Optional["ResourceLimits"] = DEFAULT_LIMITS.copy()
        elif limits is None:
            resolved = None
        else:
            resolved = limits.copy()
        self.limits: Optional["ResourceLimits"] = resolved
        self._max_processes = max_processes
        self._request_timeout = request_timeout
        self._total_timeout = total_timeout
        self._checkout_timeout = checkout_timeout
        self._pool: Optional["AsyncMonty"] = None
        self._stack: Optional[AsyncExitStack] = None
        self._lock = asyncio.Lock()
        self._closed = False

    async def _ensure_pool(self) -> "AsyncMonty":
        """Return the pool, spawning workers on first use so an unused code mode
        costs no subprocess. The lock keeps a concurrent burst to one pool."""
        if self._pool is not None:
            return self._pool
        async with self._lock:
            if self._pool is not None:
                return self._pool
            if self._closed:
                raise ToolError("Code mode sandbox is shutting down.")
            pydantic_monty = _import_monty()
            stack = AsyncExitStack()
            # The pool's context must outlive this call, so it is held open in a
            # stack that `aclose` unwinds.
            try:
                pool: "AsyncMonty" = await stack.enter_async_context(
                    pydantic_monty.AsyncMonty(
                        max_processes=self._max_processes,
                        request_timeout=self._request_timeout,
                        checkout_timeout=self._checkout_timeout,
                    )
                )
            except (RuntimeError, OSError) as exc:
                # Spawning needs the `monty` binary from pydantic-monty-runtime;
                # a missing or unrunnable one is a deployment fault, not the
                # model's, and monty reports it as a bare RuntimeError/OSError.
                await stack.aclose()
                logger.exception("Failed to start the code-mode sandbox pool.")
                raise ToolError(
                    "The code-mode sandbox could not be started, so no code can run. This is a "
                    "server configuration problem; check the Phoenix logs."
                ) from exc
            self._stack = stack
            self._pool = pool
            logger.debug(
                "Started code-mode sandbox pool (max_processes=%d, request_timeout=%.1fs)",
                self._max_processes,
                self._request_timeout,
            )
            return pool

    async def _feed(
        self,
        pool: "AsyncMonty",
        code: str,
        inputs: Optional[dict[str, Any]],
        external_functions: Optional[dict[str, Callable[..., Any]]],
    ) -> Any:
        """Check out a worker and run one block, as the single coroutine
        ``run``'s total-timeout wrapper bounds."""
        try:
            async with pool.checkout(limits=self.limits) as session:
                # `external_lookup` resolves undefined names; this is how
                # `call_tool` reaches the host.
                return await session.feed_run(
                    code,
                    inputs=inputs or None,
                    external_lookup=external_functions or None,
                )
        except TimeoutError as exc:
            # Saturation, translated here rather than in `run`: from 3.11
            # `asyncio.TimeoutError` is this same class, so a handler there could
            # not tell this apart from the caller's own deadline expiring.
            logger.warning("Code-mode sandbox saturated; no worker free within checkout timeout.")
            raise ToolError(
                "The sandbox is busy running other execute calls and no capacity became "
                "available. Retry shortly."
            ) from exc
        except RuntimeError as exc:
            # Shutdown dropped the pool mid-call; monty reports that as a bare
            # RuntimeError.
            if not self._closed:
                raise
            raise ToolError("Code mode sandbox is shutting down.") from exc

    async def _acquire_and_feed(
        self,
        code: str,
        inputs: Optional[dict[str, Any]],
        external_functions: Optional[dict[str, Callable[..., Any]]],
    ) -> Any:
        """Everything the total timeout must bound: acquisition spawns workers
        while holding the lock, so a wedged spawn left outside the deadline
        would hang every ``run`` and ``aclose`` behind it."""
        pool = await self._ensure_pool()
        return await self._feed(pool, code, inputs, external_functions)

    async def run(
        self,
        code: str,
        *,
        inputs: Optional[dict[str, Any]] = None,
        external_functions: Optional[dict[str, Callable[..., Any]]] = None,
    ) -> Any:
        """Execute one code-mode block and return its result.

        Guest errors propagate unchanged so the model can correct its own code;
        sandbox failures become :class:`ToolError`.
        """
        pydantic_monty = _import_monty()
        try:
            # Applied here because no sandbox limit advances while the host
            # answers a `call_tool`.
            return await asyncio.wait_for(
                self._acquire_and_feed(code, inputs, external_functions),
                timeout=self._total_timeout,
            )
        except asyncio.TimeoutError as exc:
            logger.warning(
                "Code-mode execute exceeded the total timeout of %.0fs.", self._total_timeout
            )
            raise ToolError(
                f"Execution exceeded the {self._total_timeout:.0f}s limit for a single execute "
                "call, counting the time its tool calls took. Split the work across multiple "
                "calls, or reduce the number of tool calls in this block."
            ) from exc
        except pydantic_monty.MontyCrashedError as exc:
            if exc.timed_out:
                logger.warning("Code-mode worker exceeded the turn timeout; worker killed.")
                raise ToolError(
                    f"The sandbox stopped responding for {self._request_timeout:.0f}s and was "
                    "terminated, so no result was produced. Retry, and split the work across "
                    "multiple calls if it persists."
                ) from exc
            logger.warning(
                "Code-mode worker died during execution (exit_status=%s).", exc.exit_status
            )
            raise ToolError(
                "The sandbox process terminated while running this code, so no result was "
                "produced. This is typically caused by code that exhausts memory or nests "
                "data structures very deeply. The server is unaffected; adjust the code and "
                "retry."
            ) from exc

    async def validate(self) -> bool:
        """Report at startup whether the sandbox can actually run code.

        Spawns a throwaway worker and runs a trivial block, so a broken install
        is found at boot rather than by the first caller. Uses its own pool and
        closes it, leaving nothing running — a deployment that never calls
        ``execute`` keeps no worker. Checking only that the binary resolves and
        is executable would be cheaper but would still miss an unrunnable or
        protocol-incompatible one.
        """
        provider = MontyPoolSandboxProvider(
            limits={"max_duration_secs": 10.0},
            max_processes=1,
            total_timeout=STARTUP_CHECK_TIMEOUT,
        )
        try:
            await provider.run("return 1")
            return True
        except Exception:
            logger.error(
                "Code-mode sandbox failed a startup check; `execute` will not work. "
                "Set PHOENIX_ENABLE_MCP_CODE_MODE=false to remove the tool.",
                exc_info=True,
            )
            return False
        finally:
            await provider.aclose()

    async def aclose(self) -> None:
        """Drop the pool without waiting on work in flight. Idempotent, and a
        no-op if none ever started. Marks closed first so a racing call cannot
        respawn a pool. A worker mid-block is released only when that block
        ends, so shutdown does not cut one short."""
        async with self._lock:
            self._closed = True
            stack, self._stack, self._pool = self._stack, None, None
        if stack is not None:
            await stack.aclose()
            logger.debug("Stopped code-mode sandbox pool.")
