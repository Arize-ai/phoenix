"""Cleanup primitives shared by synchronous setup and asynchronous server lifespans."""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Awaitable, Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from inspect import isawaitable
from typing import Any


def raise_cleanup_errors(message: str, errors: Sequence[Exception]) -> None:
    """Raise a single cleanup ``Exception`` directly or bundle multiple into ``ExceptionGroup``."""
    if not errors:
        return
    if len(errors) == 1:
        raise errors[0]
    raise ExceptionGroup(message, list(errors))


def run_cleanup_sync(callback: Callable[[], None | Awaitable[None]]) -> None:
    """Run ``callback`` to completion, using a worker event loop if an awaitable is returned.

    ``callback`` must construct any coroutine when called rather than returning a
    pre-existing ``Future`` or ``Task`` already bound to another event loop.
    """

    async def _await_awaitable(awaitable: Awaitable[None]) -> None:
        await awaitable

    async def _invoke_and_await() -> None:
        res = callback()
        if isawaitable(res):
            await res

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        result = callback()
        if isawaitable(result):
            asyncio.run(_await_awaitable(result))
    else:
        with ThreadPoolExecutor(max_workers=1, thread_name_prefix="phoenix-cleanup") as executor:
            executor.submit(lambda: asyncio.run(_invoke_and_await())).result()


def dispose_engine_sync_fallback(engine: Any) -> None:
    """Dispose an engine synchronously when its owning event loop is unavailable.

    PostgreSQL ``asyncpg`` connections are bound to the event loop that created
    them, so awaiting ``engine.dispose()`` on a fresh loop raises cross-loop
    errors; ``sync_engine.dispose(close=False)`` releases the pool without
    touching loop-bound sockets. ``aiosqlite`` worker threads are loop-agnostic
    and can be closed via ``run_cleanup_sync``.
    """
    dialect_name = getattr(getattr(engine, "dialect", None), "name", None)
    sync_engine = getattr(engine, "sync_engine", None)
    if dialect_name == "postgresql" and sync_engine is not None:
        sync_engine.dispose(close=False)
        return
    dispose = getattr(engine, "dispose", None)
    if callable(dispose):
        run_cleanup_sync(dispose)


class Cleanup:
    """Run a resource cleanup at most once across async lifespan teardown and sync fallback."""

    def __init__(
        self,
        callback: Callable[[], None | Awaitable[None]],
        *,
        sync_fallback: Callable[[], None] | None = None,
    ) -> None:
        self._callback = callback
        self._sync_fallback = sync_fallback
        self._lock = threading.Lock()
        self._started = False

    def _claim(self) -> bool:
        with self._lock:
            if self._started:
                return False
            self._started = True
            return True

    async def __call__(self) -> None:
        if not self._claim():
            return
        result = self._callback()
        if isawaitable(result):
            await result

    def close(self) -> None:
        """Run synchronous fallback unless cleanup has already started."""
        if not self._claim():
            return
        if self._sync_fallback is not None:
            self._sync_fallback()
        else:
            run_cleanup_sync(self._callback)
