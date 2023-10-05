import logging
import os
import signal
import subprocess
import sys
from pathlib import Path
from time import sleep, time
from typing import Callable, List, Optional

import psutil

from phoenix.config import SERVER_DIR, get_pids_path, get_running_pid

logger = logging.getLogger(__name__)


class Service:
    """Interface for phoenix services.
    All services must define a ``command`` property.
    """

    working_dir = Path.cwd()

    def __init__(self) -> None:
        self.child = self.start()
        self._wait_until(
            lambda: get_running_pid() is not None,
            # Not sure why, but the process can take a very long time
            # to get going, e.g. 15+ seconds in Colab.
            up_to_seconds=60,
        )

    @property
    def command(self) -> List[str]:
        raise NotImplementedError(f"{type(self)} must define `command`")

    def start(self) -> psutil.Popen:
        """Starts the service."""

        if get_running_pid():
            # Currently, only one instance of Phoenix can be running at any given time.
            # Support for multiple concurrently running instances may be supported in the future.
            logger.warning(
                "Existing running Phoenix instance detected! Shutting "
                "it down and starting a new instance..."
            )
            Service.stop_any()

        process = psutil.Popen(
            self.command,
            cwd=self.working_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
            text=True,
            env={**os.environ},
        )
        return process

    @property
    def active(self) -> bool:
        # Not sure why, but the process can remain in a zombie state
        # indefinitely, e.g. in Colab.
        return self.child.is_running() and self.child.status() != psutil.STATUS_ZOMBIE

    def stop(self) -> None:
        """Stops the service."""
        self.child.terminate()
        self._wait_until(lambda: get_running_pid() is None)

    @staticmethod
    def stop_any() -> None:
        """Stops any running instance of the service, whether the instance is being run
        within the current session or if it is being run in a separate process on the
        same host machine. In either case, the instance will be forcibly stopped.
        """
        for file in get_pids_path().iterdir():
            if not file.name.isnumeric():
                continue
            try:
                os.kill(int(file.name), signal.SIGKILL)
            except ProcessLookupError:
                pass
            file.unlink(missing_ok=True)

    def _wait_until(
        self,
        predicate: Callable[[], bool],
        up_to_seconds: float = 5,
        sleep_seconds: float = 1e-3,
    ) -> None:
        time_limit = time() + up_to_seconds
        while not predicate() and time() < time_limit and self.active:
            sleep(sleep_seconds)


class AppService(Service):
    """Service that controls the phoenix application."""

    working_dir = SERVER_DIR

    # Internal references to the name / directory of the dataset(s)
    __primary_dataset_name: str
    __reference_dataset_name: Optional[str]
    __corpus_dataset_name: Optional[str]
    __trace_dataset_name: Optional[str]

    def __init__(
        self,
        export_path: Path,
        host: str,
        port: int,
        primary_dataset_name: str,
        umap_params: str,
        reference_dataset_name: Optional[str],
        corpus_dataset_name: Optional[str],
        trace_dataset_name: Optional[str],
    ):
        self.export_path = export_path
        self.host = host
        self.port = port
        self.__primary_dataset_name = primary_dataset_name
        self.__umap_params = umap_params
        self.__reference_dataset_name = reference_dataset_name
        self.__corpus_dataset_name = corpus_dataset_name
        self.__trace_dataset_name = trace_dataset_name
        super().__init__()

    @property
    def command(self) -> List[str]:
        command = [
            sys.executable,
            "main.py",
            "--export_path",
            str(self.export_path),
            "--host",
            str(self.host),
            "--port",
            str(self.port),
            "datasets",
            "--primary",
            str(self.__primary_dataset_name),
            "--umap_params",
            self.__umap_params,
        ]
        if self.__reference_dataset_name is not None:
            command.extend(["--reference", str(self.__reference_dataset_name)])
        if self.__corpus_dataset_name is not None:
            command.extend(["--corpus", str(self.__corpus_dataset_name)])
        if self.__trace_dataset_name is not None:
            command.extend(["--trace", str(self.__trace_dataset_name)])
        logger.info(f"command: {command}")
        return command
