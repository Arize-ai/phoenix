import os
import subprocess
import sys

import psutil


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
        service_main_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "service",
            "main.py",
        )

        # TODO(mikeldking) enhance this to allow for more complex command arguments
        # E.g. support
        self.child = psutil.Popen(
            [sys.executable, service_main_path] + self.command,
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

    def __init__(self, port: int):
        self.port = port
        super().__init__()
