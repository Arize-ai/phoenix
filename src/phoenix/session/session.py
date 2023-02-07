import logging
from functools import cached_property
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

    def __init__(self, primary: Dataset, reference: Optional[Dataset], port: int):
        self.primary = primary
        self.reference = reference
        self.port = port
        # Initialize an app service that keeps the server running
        self._app_service = AppService(
            port,
            primary.name,
            reference_dataset_name=reference.name if reference is not None else None,
        )
        self._is_colab = _is_colab()

    def view(self, height: int = 500) -> "IFrame":
        # Display the app in an iframe
        return IFrame(src=self.url, width="100%", height=height)

    @cached_property
    def url(self) -> str:
        "Returns the url for the phoenix app"
        return _get_url(self.port, self._is_colab)

    def end(self) -> None:
        "Ends the session and closes the app service"
        self._app_service.stop()


# Provides a level of flexibility
def launch_app(primary: Dataset, reference: Optional[Dataset]) -> "Session":
    "Launches the phoenix application"
    logger.info("Launching Phoenix App")
    global _session

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


def _get_url(port: int, is_colab: bool) -> str:
    """Determines the iframe url based on whether this is in a Colab"""
    if is_colab:
        from google.colab.output import eval_js  # type: ignore

        return str(eval_js(f"google.colab.kernel.proxyPort({port}, {{'cache': true}})"))

    return f"http://localhost:{port}/"


def _is_colab() -> bool:
    """Determines whether this is in a Colab"""
    try:
        import google.colab  # type: ignore # noqa: F401
        import IPython  # type: ignore
    except ImportError:
        return False

    return IPython.get_ipython() is not None
