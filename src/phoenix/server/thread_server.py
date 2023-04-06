from threading import Thread
from time import sleep
from typing import Generator

import uvicorn


class ThreadServer(uvicorn.Server):  # type: ignore  # can't inherit from Any type
    """Server that runs in a (non-daemon) thread"""

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
