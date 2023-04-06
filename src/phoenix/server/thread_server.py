import logging
from threading import Thread
from time import sleep
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
        thread = Thread(target=self.run)
        thread.start()
        try:
            while not self.started and thread.is_alive():
                sleep(1e-3)
            yield thread
        finally:
            self.should_exit = True
            thread.join()
