import logging
from threading import Thread
from time import sleep, time
from typing import Generator

from starlette.applications import Starlette
from uvicorn import Config, Server

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


class ThreadServer(Server):
    """Server that runs in a (non-daemon) thread"""

    def __init__(
        self,
        app: Starlette,
        host: str,
        port: int,
    ) -> None:
        config = Config(
            app=app,
            host=host,
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
            while (
                time() < time_limit
                and thread.is_alive()
                and not self.should_exit
                and not self.started
            ):
                sleep(1e-3)
            if time() > time_limit:
                self.should_exit = True
                raise RuntimeError("server took too long to start")
            yield thread
        finally:
            self.should_exit = True
            thread.join(timeout=5)
