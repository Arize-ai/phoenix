"""Keep a sandbox's teardown alive when the call that owns it is cancelled.

Every sandbox backend tears its sandbox down in a ``finally`` or ``async with``
that awaits the provider (delete, kill, stop). That survives one cancellation.
It does not survive a caller that cancels again at every ``await``: an anyio
cancel scope does exactly that until the task leaves the scope, and since
Python 3.12 ``asyncio.wait_for`` runs its coroutine in the caller's own task,
so nothing absorbs the repeats. The provider call is cancelled before it is
sent, and the sandbox keeps running on the provider account until it expires.

``run_cancel_once`` gives the call its own task. If the caller is cancelled,
that task is cancelled exactly once, the caller leaves at once, and the
backend's own teardown finishes in the background. ``SandboxSessionManager``
waits for those teardowns at shutdown.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

# Calls still tearing down after their caller was cancelled. The event loop only
# keeps weak references to tasks, so this set is what keeps them alive.
_detached: set[asyncio.Task[Any]] = set()


def _forget(task: asyncio.Task[Any]) -> None:
    _detached.discard(task)
    if task.cancelled():
        return
    # Nobody awaits a detached call, so its outcome is retrieved here, which also
    # keeps asyncio from reporting "Task exception was never retrieved".
    if (exc := task.exception()) is not None:
        logger.warning("Sandbox call failed after its caller was cancelled", exc_info=exc)


async def run_cancel_once(coro: Coroutine[Any, Any, _T]) -> _T:
    """Await ``coro`` in its own task, cancelling that task at most once."""
    task = asyncio.get_running_loop().create_task(coro)
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        task.cancel()
        _detached.add(task)
        task.add_done_callback(_forget)
        raise


def detached_teardowns() -> set[asyncio.Task[Any]]:
    """Teardowns on the running loop that are still finishing after their caller left."""
    loop = asyncio.get_running_loop()
    return {task for task in _detached if not task.done() and task.get_loop() is loop}
