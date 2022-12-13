import logging
import os
import subprocess
import sys
from typing import List

import psutil

import phoenix.config as config

logger = logging.getLogger(__name__)


class Service:
    """Interface for phoenix services.

    All services must define a ``command`` property.
    """

    working_dir = "."

    def __init__(self) -> None:
        self.start()

    @property
    def command(self) -> List[str]:
        raise NotImplementedError(f"{type(self)} must define `command`")

    def start(self) -> None:
        """Starts the service."""

        self.child = psutil.Popen(
            self.command,
            cwd=self.working_dir,
            stdin=subprocess.PIPE,
            env={**os.environ},
        )

    def stop(self) -> None:
        """Stops the service."""
        self.child.stdin.close()
        try:
            # TODO(mikeldking) make this reliable
            self.child.wait(timeout=100)
        except TypeError:
            pass


class AppService(Service):
    """Service that controls the phoenix application."""

    working_dir = config.server_dir

    def __init__(self, port: int, primary_dataset_name: str, reference_dataset_name: str):
        self.port = port
        self.__primary_dataset_name = primary_dataset_name
        self.__reference_dataset_name = reference_dataset_name
        super().__init__()

    @property
    def command(self) -> List[str]:

        command = [
            sys.executable,
            "main.py",
            "--port",
            str(self.port),
            "--primary",
            str(self.__primary_dataset_name),
            "--reference",
            str(self.__reference_dataset_name),
        ]
        logger.info(f"command: {command}")
        return command
