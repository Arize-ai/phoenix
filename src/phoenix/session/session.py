import logging
from typing import Optional

import phoenix.config as config
from phoenix.datasets import Dataset
from phoenix.services import AppService

try:
    from IPython.display import IFrame  # type: ignore
except:  # noqa
    pass

logger = logging.getLogger(__name__)


_session: Optional["Session"] = None


class Session:
    "Session that maintains a 1-1 shared state with the Phoenix App."

    def __init__(self, primary: Dataset, reference: Dataset, port: int):
        self.primary = primary
        self.reference = reference
        self.port = port
        # Initialize an app service that keeps the server running
        self._app_service = AppService(port, primary.name, reference.name)

    def view(self) -> "IFrame":
        # Display the app in an iframe
        # TODO(mikeldking) switch this out for different display options for colab
        return IFrame(src=f"http://127.0.0.1:{self.port}", width=500, height=1000)

    def end(self) -> None:
        "Ends the session and closes the app service"
        self._app_service.stop()


# TODO(mikeldking): validate that we really want to require a reference dataset. Leaving it optional
# Provides a level of flexibility
def launch_app(primary: Dataset, reference: Dataset) -> "Session":
    "Launches the phoenix application"
    logger.info("Launching Phoenix App")
    global _session

    # TODO close previous session if it exists
    _session = Session(primary, reference, port=config.port)

    return _session


def close_app() -> None:
    "Closes the phoenix application"
    global _session
    if _session is None:
        print("No active session to close")
        return
    _session.end()
    _session = None
    logger.info("Session closed")
