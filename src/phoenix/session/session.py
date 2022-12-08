import logging
from typing import Optional

import phoenix.config as config
from phoenix.datasets import Dataset
from phoenix.services import AppService

logger = logging.getLogger(__name__)


class Session:
    "Session that maintains a 1-1 shared state with the Phoenix App."

    def __init__(self, primary: Dataset, reference: Optional[Dataset], port: int):
        self.primary = primary
        self.reference = reference
        # Initialize an app service that keeps the server running
        self._app_service = AppService(port)

    def end(self):
        "Ends the session and closes the app service"
        self._app_service.stop()


# TODO(mikeldking): validate that we really want to require a reference dataset. Leaving it optional
# Provides a level of flexibility
def launch_app(primary: Dataset, reference: Optional[Dataset] = None) -> "Session":
    "Launches the phoenix application"
    logger.info("Launching Phoenix App")
    global _session

    # TODO close previous session if it exists
    _session = Session(primary, reference, port=config.port)
    return _session


def close_app():
    "Closes the phoenix application"
    global _session
    if _session is None:
        print("No active session to close")
        return
    _session.end()
    _session = None
    logger.info("Session closed")
