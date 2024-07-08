import asyncio
import logging
from threading import Thread
from time import sleep, time
from typing import Generator

from fastapi import FastAPI
from uvicorn import Config, Server
from uvicorn.config import LoopSetupType


def _nest_asyncio_applied() -> bool:
    """
    Determines whether nest_asyncio has been applied. This is needed since
    nest_asyncio affects the runtime of the app. If it is applied, the app must use
    the "asyncio" loop.
    see: https://github.com/erdewit/nest_asyncio/blob/a48a68a47e182bd7e1f86c60dfc07d7b8509508b/nest_asyncio.py#L45
    """
    return hasattr(asyncio, "_nest_patched")


class ThreadServer(Server):
    """Server that runs in a (non-daemon) thread"""

    def __init__(
        self,
        app: FastAPI,
        host: str,
        port: int,
        root_path: str,
    ) -> None:
        # Must use asyncio loop if nest_asyncio is applied
        # Otherwise the app crashes when the server is run in a thread
        loop: LoopSetupType = "asyncio" if _nest_asyncio_applied() else "auto"
        config = Config(
            app=app,
            host=host,
            port=port,
            root_path=root_path,
            # TODO: save logs to file
            log_level=logging.ERROR,
            loop=loop,
        )
        super().__init__(config=config)

    def install_signal_handlers(self) -> None:
        pass

    def run_in_thread(self) -> Generator[Thread, None, None]:
        """A coroutine to keep the server running in a thread."""
        thread = Thread(target=self.run, daemon=True)
        thread.start()
        time_limit = time() + 5  # 5 seconds
        try:
            while (
                time() < time_limit
                and thread.is_alive()
                and not self.should_exit
                and not self.started
            ):
                sleep(1e-3)
            if time() >= time_limit and not self.started:
                self.should_exit = True
                raise RuntimeError("server took too long to start")
            yield thread
        finally:
            self.should_exit = True
            thread.join(timeout=5)
