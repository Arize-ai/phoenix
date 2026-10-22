from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

# The event loop holds only weak references to tasks; this keeps detached ones alive.
_detached: set[asyncio.Task[Any]] = set()


def _forget(task: asyncio.Task[Any]) -> None:
    _detached.discard(task)
    if task.cancelled():
        return
    if (exc := task.exception()) is not None:
        logger.warning("Sandbox call failed after its caller was cancelled", exc_info=exc)


async def run_cancel_once(coro: Coroutine[Any, Any, _T]) -> _T:
    """Await ``coro`` in its own task, cancelling that task at most once.

    Backends delete their sandbox in a ``finally`` that awaits the provider. anyio
    scopes, and ``asyncio.wait_for`` since Python 3.12, cancel again at every await,
    which would cancel that delete before it is sent.
    """
    task = asyncio.get_running_loop().create_task(coro)
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        task.cancel()
        _detached.add(task)
        task.add_done_callback(_forget)
        raise


def detached_teardowns() -> set[asyncio.Task[Any]]:
    loop = asyncio.get_running_loop()
    return {task for task in _detached if not task.done() and task.get_loop() is loop}
