"""Cleanup callbacks shared by synchronous setup and asynchronous server lifespans."""

import asyncio
from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from inspect import isawaitable


def run_cleanup_sync(callback: Callable[[], None | Awaitable[None]]) -> None:
    """Run cleanup to completion, propagating failures from a worker event loop."""

    async def run() -> None:
        result = callback()
        if isawaitable(result):
            await result

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(run())
    else:
        with ThreadPoolExecutor(max_workers=1, thread_name_prefix="phoenix-cleanup") as executor:
            executor.submit(lambda: asyncio.run(run())).result()


class Cleanup:
    """Share successful cleanup between lifespan shutdown and setup failure handling."""

    def __init__(self, callback: Callable[[], None | Awaitable[None]]) -> None:
        self._callback = callback
        self._completed = False

    async def __call__(self) -> None:
        if self._completed:
            return
        result = self._callback()
        if isawaitable(result):
            await result
        self._completed = True

    def close(self) -> None:
        """Run cleanup synchronously unless it has already succeeded."""
        if not self._completed:
            run_cleanup_sync(self)
