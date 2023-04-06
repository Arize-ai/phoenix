import logging
from threading import Thread
from time import sleep, time
from typing import Generator

from starlette.applications import Starlette
from uvicorn import Config, Server


class ThreadServer(Server):  # type: ignore  # can't inherit from Any type
    """Server that runs in a (non-daemon) thread"""

    def __init__(
        self,
        app: Starlette,
        port: int,
    ) -> None:
        config = Config(
            app=app,
            port=port,
            # TODO: save logs to file
            log_level=logging.ERROR,
        )
        super().__init__(config=config)

    def install_signal_handlers(self) -> None:
        pass

    def run_in_thread(self) -> Generator[Thread, None, None]:
        """A coroutine to keep the server running in a thread."""
        thread = Thread(target=self.run)
        thread.start()
        time_limit = time() + 5  # 5 seconds
        try:
            while not self.started and thread.is_alive() and time() < time_limit:
                sleep(1e-3)
            if time() > time_limit:
                raise RuntimeError("server took too long to start")
            yield thread
        finally:
            self.should_exit = True
            thread.join(timeout=5)
