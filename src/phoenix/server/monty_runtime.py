"""Shared out-of-process Monty execution runtime."""

from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack
from types import ModuleType
from typing import TYPE_CHECKING, Any, Callable, Literal, Optional

if TYPE_CHECKING:
    from pydantic_monty import AsyncMonty, PrintCallback, ResourceLimits

logger = logging.getLogger(__name__)

MontyConsumer = Literal["mcp", "agent", "evaluator", "validation"]

DEFAULT_MAX_PROCESSES = 4
"""Maximum worker processes owned by one default runtime."""
DEFAULT_REQUEST_TIMEOUT = 180.0
"""Maximum silence during one pool/worker protocol turn."""
DEFAULT_CHECKOUT_TIMEOUT = 30.0
"""Maximum wait at each admission or worker-checkout stage."""
STARTUP_CHECK_TIMEOUT = 10.0
"""End-to-end timeout for the throwaway startup probe."""
SHUTDOWN_GRACE_TIMEOUT = 30.0
"""Maximum time to drain accepted executions before closing the worker pool."""
DEFAULT_GUEST_MAX_MEMORY_BYTES = 100_000_000
DEFAULT_GUEST_MAX_RECURSION_DEPTH = 200


class MontyServiceError(Exception):
    """Base class for Monty worker-pool infrastructure failures."""


class MontyUnavailable(MontyServiceError):
    """The worker pool could not start."""


class MontyBusy(MontyServiceError):
    """No worker became available before the checkout deadline."""


class MontyShuttingDown(MontyServiceError):
    """Execution was requested after runtime shutdown began."""


class MontyDeadlineExceeded(MontyServiceError):
    """An end-to-end execution deadline expired."""


class MontyWorkerCrashed(MontyServiceError):
    """The worker process terminated during execution."""

    def __init__(self, exit_status: Optional[int]) -> None:
        self.exit_status = exit_status
        super().__init__(f"Monty worker terminated (exit_status={exit_status})")


class MontyWorkerTurnTimedOut(MontyWorkerCrashed):
    """The worker was killed after exceeding its per-turn timeout."""


def import_monty() -> ModuleType:
    """Import the optional runtime only when sandbox execution is requested."""
    try:
        import pydantic_monty
    except ModuleNotFoundError as exc:
        raise MontyUnavailable("pydantic-monty is not installed") from exc
    return pydantic_monty


class MontyRuntime:
    """Own one worker pool shared by Phoenix's Monty consumers.

    Each execution gets a fresh checkout, so guest state cannot cross calls.
    Consumer admission limits reserve capacity before the shared pool checkout.
    """

    def __init__(
        self,
        *,
        max_processes: int = DEFAULT_MAX_PROCESSES,
        request_timeout: float = DEFAULT_REQUEST_TIMEOUT,
        checkout_timeout: float = DEFAULT_CHECKOUT_TIMEOUT,
        consumer_limits: Optional[dict[MontyConsumer, int]] = None,
    ) -> None:
        self._max_processes = max_processes
        self._request_timeout = request_timeout
        self._checkout_timeout = checkout_timeout
        shared_consumer_limit = max(1, max_processes - 1)
        default_limits: dict[MontyConsumer, int] = {
            "mcp": shared_consumer_limit,
            "agent": shared_consumer_limit,
            "evaluator": shared_consumer_limit,
            "validation": 1,
        }
        if consumer_limits:
            unknown_consumers = consumer_limits.keys() - default_limits.keys()
            if unknown_consumers:
                raise ValueError(f"Unknown Monty consumers: {', '.join(sorted(unknown_consumers))}")
        resolved_limits = {**default_limits, **(consumer_limits or {})}
        if any(limit < 1 for limit in resolved_limits.values()):
            raise ValueError("Monty consumer limits must be positive")
        self._consumer_slots = {
            consumer: asyncio.Semaphore(limit) for consumer, limit in resolved_limits.items()
        }
        self._pool: Optional["AsyncMonty"] = None
        self._stack: Optional[AsyncExitStack] = None
        self._lock = asyncio.Lock()
        self._closed = False
        self._pool_closed = False
        self._active_executions = 0
        self._idle = asyncio.Event()
        self._idle.set()

    @property
    def request_timeout(self) -> float:
        return self._request_timeout

    async def __aenter__(self) -> "MontyRuntime":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()

    async def _ensure_pool(self) -> "AsyncMonty":
        if self._pool is not None:
            return self._pool
        async with self._lock:
            if self._pool is not None:
                return self._pool
            if self._pool_closed:
                raise MontyShuttingDown("Monty runtime is shutting down")
            pydantic_monty = import_monty()
            stack = AsyncExitStack()
            try:
                pool: "AsyncMonty" = await stack.enter_async_context(
                    pydantic_monty.AsyncMonty(
                        max_processes=self._max_processes,
                        request_timeout=self._request_timeout,
                        checkout_timeout=self._checkout_timeout,
                    )
                )
            except Exception as exc:
                # Any startup failure is a deployment fault, so catch broadly
                # rather than by type. Binary resolution runs inside this call
                # and does not restrict what it raises: a missing binary is
                # FileNotFoundError, but ``find_monty_binary``'s editable-install
                # probe walks four parent directories unguarded, so a deployment
                # that installs the package nearer the filesystem root raises
                # IndexError. Anything uncaught here would reach the caller as a
                # bare exception, past every mapping onto a MontyServiceError.
                await stack.aclose()
                logger.exception("Failed to start the Monty worker pool.")
                raise MontyUnavailable("The Monty worker pool could not be started") from exc
            self._stack = stack
            self._pool = pool
            logger.debug(
                "Started Monty worker pool (max_processes=%d, request_timeout=%.1fs)",
                self._max_processes,
                self._request_timeout,
            )
            return pool

    async def _feed(
        self,
        pool: "AsyncMonty",
        code: str,
        *,
        limits: Optional["ResourceLimits"],
        inputs: Optional[dict[str, Any]],
        external_functions: Optional[dict[str, Callable[..., Any]]],
        print_callback: Optional["PrintCallback"],
    ) -> Any:
        async with AsyncExitStack() as stack:
            try:
                session = await stack.enter_async_context(pool.checkout(limits=limits))
            except TimeoutError as exc:
                raise MontyBusy("No Monty worker became available") from exc
            except RuntimeError as exc:
                if not self._closed:
                    raise
                raise MontyShuttingDown("Monty runtime is shutting down") from exc
            return await session.feed_run(
                code,
                inputs=inputs or None,
                external_lookup=external_functions or None,
                print_callback=print_callback,
            )

    async def _acquire_and_feed(
        self,
        code: str,
        *,
        consumer: MontyConsumer,
        limits: Optional["ResourceLimits"],
        inputs: Optional[dict[str, Any]],
        external_functions: Optional[dict[str, Callable[..., Any]]],
        print_callback: Optional["PrintCallback"],
    ) -> Any:
        slots = self._consumer_slots[consumer]
        try:
            await asyncio.wait_for(slots.acquire(), timeout=self._checkout_timeout)
        except asyncio.TimeoutError as exc:
            raise MontyBusy(f"Monty {consumer} admission capacity is busy") from exc
        try:
            pool = await self._ensure_pool()
            return await self._feed(
                pool,
                code,
                limits=limits,
                inputs=inputs,
                external_functions=external_functions,
                print_callback=print_callback,
            )
        finally:
            slots.release()

    async def run(
        self,
        code: str,
        *,
        consumer: MontyConsumer,
        limits: Optional["ResourceLimits"],
        inputs: Optional[dict[str, Any]] = None,
        external_functions: Optional[dict[str, Callable[..., Any]]] = None,
        print_callback: Optional["PrintCallback"] = None,
        total_timeout: Optional[float] = None,
    ) -> Any:
        """Execute one isolated block and return its trailing value.

        Consumer admission and pool checkout are separate waits, each bounded
        by ``checkout_timeout``. Guest duration in ``limits`` counts only guest
        execution, while ``request_timeout`` bounds one silent worker turn and
        ``total_timeout`` optionally bounds the complete call.
        """
        if self._closed:
            raise MontyShuttingDown("Monty runtime is shutting down")
        self._active_executions += 1
        self._idle.clear()
        try:
            return await self._run(
                code,
                consumer=consumer,
                limits=limits,
                inputs=inputs,
                external_functions=external_functions,
                print_callback=print_callback,
                total_timeout=total_timeout,
            )
        finally:
            self._active_executions -= 1
            if self._active_executions == 0:
                self._idle.set()

    async def _run(
        self,
        code: str,
        *,
        consumer: MontyConsumer,
        limits: Optional["ResourceLimits"],
        inputs: Optional[dict[str, Any]],
        external_functions: Optional[dict[str, Callable[..., Any]]],
        print_callback: Optional["PrintCallback"],
        total_timeout: Optional[float],
    ) -> Any:
        pydantic_monty = import_monty()
        execution = self._acquire_and_feed(
            code,
            consumer=consumer,
            limits=limits,
            inputs=inputs,
            external_functions=external_functions,
            print_callback=print_callback,
        )
        try:
            if total_timeout is None:
                return await execution
            task = asyncio.ensure_future(execution)
            # ``asyncio.wait`` reports expiry without raising TimeoutError, so a
            # guest- or host-callback TimeoutError cannot be mistaken for this
            # outer deadline on Python versions where timeout types are aliases.
            try:
                done, _ = await asyncio.wait({task}, timeout=total_timeout)
            except BaseException:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
                raise
            if task in done:
                return task.result()
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            raise MontyDeadlineExceeded("Monty execution deadline exceeded")
        except pydantic_monty.MontyCrashedError as exc:
            if exc.timed_out:
                raise MontyWorkerTurnTimedOut(exc.exit_status) from exc
            raise MontyWorkerCrashed(exc.exit_status) from exc

    async def probe_runtime(self) -> bool:
        """Run a bounded throwaway worker probe without warming the shared pool."""
        probe = MontyRuntime(
            max_processes=1,
            request_timeout=self._request_timeout,
            checkout_timeout=self._checkout_timeout,
            consumer_limits={"mcp": 1},
        )
        healthy = False
        try:
            await probe.run(
                "return 1",
                consumer="mcp",
                limits={"max_duration_secs": 10.0},
                total_timeout=STARTUP_CHECK_TIMEOUT,
            )
            healthy = True
        except Exception:
            logger.error("Monty worker pool failed its startup check.", exc_info=True)
        try:
            await probe.aclose()
        except Exception:
            logger.error("Monty startup probe failed during teardown.", exc_info=True)
            healthy = False
        return healthy

    async def aclose(self) -> None:
        """Reject new work, drain accepted executions, then close the pool."""
        if self._pool_closed:
            return
        self._closed = True
        try:
            await asyncio.wait_for(self._idle.wait(), timeout=SHUTDOWN_GRACE_TIMEOUT)
        except asyncio.TimeoutError:
            logger.warning(
                "Closing the Monty worker pool with %d execution(s) still active after %.1fs.",
                self._active_executions,
                SHUTDOWN_GRACE_TIMEOUT,
            )
        async with self._lock:
            self._pool_closed = True
            stack, self._stack, self._pool = self._stack, None, None
        if stack is not None:
            await stack.aclose()
            logger.debug("Stopped Monty worker pool.")
