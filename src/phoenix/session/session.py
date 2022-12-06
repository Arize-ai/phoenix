import logging
from typing import Optional

import phoenix.config as config
from phoenix.datasets import Dataset
from phoenix.service import AppService

logger = logging.getLogger(__name__)


class Session:
    "Session that maintains a 1-1 shared state with the Phoenix App."

    def __init__(self, primary: Dataset, reference: Optional[Dataset], port: int):
        self.primary = primary
        self.reference = reference
        # Initialize an app service that keeps the server running
        self._app_service = AppService(port)


# TODO(mikeldking): validate that we really want to require a reference
def launch_app(primary: Dataset, reference: Optional[Dataset] = None) -> "Session":
    "Launches the phoenix application"
    logger.info("Launching Phoenix App")
    global _session  # pylint: disable=global-statement

    # TODO close previous session if it exists
    _session = Session(primary, reference, port=config.port)
    return _session
