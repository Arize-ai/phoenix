import logging
import os
import subprocess
import sys

import psutil

import phoenix.config as config

logger = logging.getLogger(__name__)


class Service:
    """Interface for phoenix services.

    All services must define a ``command`` property.
    """

    working_dir = "."

    def __init__(self):
        self.start()

    @property
    def command(self):
        raise NotImplementedError(f"{type(self)} must define `command`")

    def start(self):
        """Starts the service."""
        # Retrieve the directory to the main.py file
        # service_main_path = os.path.join(
        #     os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        #     "service",
        #     "main.py",
        # )

        # TODO(mikeldking) enhance this to allow for more complex command arguments
        # E.g. support
        args = self.command
        logger.info(f"Starting service: {args}")
        self.child = psutil.Popen(
            args,
            cwd=self.working_dir,
            stdin=subprocess.PIPE,
            env={**os.environ},
        )

    def stop(self):
        """Stops the service."""
        self.child.stdin.close()
        try:
            self.child.wait()
        except TypeError:
            pass


class AppService(Service):
    """Service that controls the phoenix application."""

    working_dir = config.server_dir

    def __init__(self, port: int):
        self.port = port
        super().__init__()

    @property
    def command(self):

        command = [
            sys.executable,
            "main.py",
            "--port",
            str(self.port),
        ]
        logger.info(f"command: {command}")
        return command
