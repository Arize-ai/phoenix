from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack
from types import ModuleType
from typing import TYPE_CHECKING, Any, Callable, Optional

from fastmcp.exceptions import ToolError

if TYPE_CHECKING:
    from pydantic_monty import AsyncMonty, ResourceLimits

logger = logging.getLogger(__name__)


DEFAULT_LIMITS: "ResourceLimits" = {
    "max_duration_secs": 30.0,
    "max_memory": 100_000_000,  # 100 MB
    "max_recursion_depth": 200,
}
"""Per-session guest limits. These bound work the guest does itself; time spent
awaiting ``call_tool`` is bounded by ``request_timeout`` instead."""

DEFAULT_MAX_PROCESSES = 4
"""Ceiling on concurrent ``execute`` calls. Each in-flight call holds one worker,
so this caps how much memory and CPU the sandbox can claim at once: a limit that
is only enforced per session multiplies by the number of sessions running
together, which is what makes a single expensive block cheap to repeat."""

DEFAULT_REQUEST_TIMEOUT = 180.0
"""Wall-clock ceiling for one ``execute`` turn, host callbacks included. Sized to
leave room for a full chain of ``call_tool`` round-trips; it exists to reclaim a
wedged worker, not to express a latency target."""

DEFAULT_CHECKOUT_TIMEOUT = 30.0
"""How long an ``execute`` waits for a free worker once ``max_processes`` are
busy. Bounded so overload is reported to the caller as a busy sandbox rather than
accumulating as an unbounded queue of waiters."""


def _import_monty() -> ModuleType:
    """Import ``pydantic_monty``, reporting the packaging cause on failure.

    Deferred to first use so importing this module — which happens whenever the
    MCP server is built, including with code mode disabled — does not pay for
    loading a native extension that may never be exercised.
    """
    try:
        import pydantic_monty
    except ModuleNotFoundError as exc:  # pragma: no cover - packaging failure
        raise ToolError(
            "Code mode requires the pydantic-monty sandbox, which is not installed. "
            "Install Phoenix with the fastmcp `code-mode` extra, or disable code "
            "mode by setting PHOENIX_ENABLE_MCP_CODE_MODE=false."
        ) from exc
    return pydantic_monty


class MontyPoolSandboxProvider:
    """Runs code-mode blocks in a pool of sandbox worker subprocesses.

    Implements FastMCP's ``SandboxProvider`` interface. Each ``run`` checks out
    its own session, so no guest state — variables, imported modules, definitions
    — survives into another ``execute``, whether from the same client or a
    different one.

    Args:
        limits: Guest resource limits per session. ``None`` runs the guest
            unlimited, which leaves the worker's own death as the only bound.
        max_processes: Ceiling on live workers, and so on concurrent ``execute``
            calls.
        request_timeout: Wall-clock ceiling for one turn including host
            callbacks; exceeding it kills the worker.
        checkout_timeout: How long to wait for a free worker before reporting the
            sandbox as busy.
    """

    def __init__(
        self,
        *,
        limits: Optional["ResourceLimits"] = None,
        max_processes: int = DEFAULT_MAX_PROCESSES,
        request_timeout: float = DEFAULT_REQUEST_TIMEOUT,
        checkout_timeout: float = DEFAULT_CHECKOUT_TIMEOUT,
    ) -> None:
        # Copy so a caller's dict — and the module-level default — cannot be
        # mutated through this provider's public attribute.
        self.limits: Optional["ResourceLimits"] = (
            dict(DEFAULT_LIMITS) if limits is None else dict(limits)  # type: ignore[assignment]
        )
        self._max_processes = max_processes
        self._request_timeout = request_timeout
        self._checkout_timeout = checkout_timeout
        self._pool: Optional["AsyncMonty"] = None
        self._stack: Optional[AsyncExitStack] = None
        self._lock = asyncio.Lock()
        self._closed = False

    async def _ensure_pool(self) -> "AsyncMonty":
        """Return the running pool, spawning workers on first use.

        Started lazily rather than at server startup so a deployment that never
        calls ``execute`` never pays for a sandbox subprocess. The lock makes the
        first concurrent burst of calls share one pool instead of each spawning
        its own.
        """
        if self._pool is not None:
            return self._pool
        async with self._lock:
            if self._pool is not None:
                return self._pool
            if self._closed:
                raise ToolError("Code mode sandbox is shutting down.")
            pydantic_monty = _import_monty()
            stack = AsyncExitStack()
            # The pool is an async context manager whose workers are spawned on
            # entry, but it has to outlive this call, so its context is held open
            # in a stack that `aclose` unwinds.
            pool: "AsyncMonty" = await stack.enter_async_context(
                pydantic_monty.AsyncMonty(
                    max_processes=self._max_processes,
                    request_timeout=self._request_timeout,
                    checkout_timeout=self._checkout_timeout,
                )
            )
            self._stack = stack
            self._pool = pool
            logger.debug(
                "Started code-mode sandbox pool (max_processes=%d, request_timeout=%.1fs)",
                self._max_processes,
                self._request_timeout,
            )
            return pool

    async def run(
        self,
        code: str,
        *,
        inputs: Optional[dict[str, Any]] = None,
        external_functions: Optional[dict[str, Callable[..., Any]]] = None,
    ) -> Any:
        """Execute one code-mode block in a worker and return its result.

        Errors the guest program caused — a raised exception, a syntax error, a
        limit it exceeded — propagate unchanged so the model sees the sandbox
        traceback and can correct its own code. Failures of the sandbox itself
        are translated into :class:`ToolError`, because their cause and remedy
        lie outside the code the model wrote.
        """
        pydantic_monty = _import_monty()
        pool = await self._ensure_pool()
        try:
            async with pool.checkout(limits=self.limits) as session:
                # `external_lookup` resolves names the block leaves undefined,
                # which is how `call_tool` reaches the host; async callables are
                # awaited in this process.
                return await session.feed_run(
                    code,
                    inputs=inputs or None,
                    external_lookup=external_functions or None,
                )
        except pydantic_monty.MontyCrashedError as exc:
            if exc.timed_out:
                logger.warning("Code-mode worker exceeded the turn timeout; worker killed.")
                raise ToolError(
                    f"Execution exceeded the {self._request_timeout:.0f}s limit for a single "
                    "execute call and was terminated. Split the work across multiple calls, "
                    "or reduce the number of tool calls in this block."
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
        except TimeoutError as exc:
            # Raised by `checkout` when every worker stayed busy; the block never
            # started, so retrying is safe. This is the builtin `TimeoutError`,
            # which is a distinct type from `asyncio.TimeoutError` before 3.11.
            # A limit the guest itself exceeded arrives as a sandbox error
            # instead, so it is not caught here.
            logger.warning("Code-mode sandbox saturated; no worker free within checkout timeout.")
            raise ToolError(
                "The sandbox is busy running other execute calls and no capacity became "
                "available. Retry shortly."
            ) from exc

    async def aclose(self) -> None:
        """Shut the pool down, terminating its workers.

        Idempotent, and a no-op when no ``execute`` ever ran. Marks the provider
        closed first so a call racing with shutdown is refused rather than
        spawning workers that would outlive the server.

        Closing the pool kills its workers rather than waiting for them, so this
        returns promptly even while a block is still running.
        """
        async with self._lock:
            self._closed = True
            stack, self._stack, self._pool = self._stack, None, None
        if stack is not None:
            await stack.aclose()
            logger.debug("Stopped code-mode sandbox pool.")
