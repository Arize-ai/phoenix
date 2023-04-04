import logging
from collections import UserList
from functools import cached_property
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING, Iterable, List, Optional, Set

import pandas as pd

from phoenix.config import PORT, get_exported_files
from phoenix.datasets import Dataset
from phoenix.services import AppService

try:
    from IPython.display import IFrame  # type: ignore
except:  # noqa
    pass

logger = logging.getLogger(__name__)


_session: Optional["Session"] = None

# type workaround
# https://github.com/python/mypy/issues/5264#issuecomment-399407428
if TYPE_CHECKING:
    _BaseList = UserList[pd.DataFrame]
else:
    _BaseList = UserList


class ExportedData(_BaseList):
    def __init__(self) -> None:
        self.paths: Set[Path] = set()
        self.names: List[str] = []
        super().__init__()

    def __repr__(self) -> str:
        return f"[{', '.join(f'<DataFrame {name}>' for name in self.names)}]"

    def add(self, paths: Iterable[Path]) -> None:
        new_paths = sorted(
            set(paths) - self.paths,
            key=lambda p: p.stat().st_mtime,
        )
        self.paths.update(new_paths)
        self.names.extend(path.stem for path in new_paths)
        self.data.extend(pd.read_parquet(path) for path in new_paths)


class Session:
    "Session that maintains a 1-1 shared state with the Phoenix App."

    def __init__(self, primary: Dataset, reference: Optional[Dataset], port: int):
        self.primary = primary
        self.reference = reference
        self.port = port
        self.temp_dir = TemporaryDirectory()
        self.export_path = Path(self.temp_dir.name) / "exports"
        self.export_path.mkdir(parents=True, exist_ok=True)
        self.exported_data = ExportedData()
        # Initialize an app service that keeps the server running
        self._app_service = AppService(
            self.export_path,
            port,
            primary.name,
            reference_dataset_name=reference.name if reference is not None else None,
        )
        self._is_colab = _is_colab()

    @property
    def exports(self) -> ExportedData:
        """Exported data sorted in descending order by modification date.

        Returns
        -------
        dataframes: list
            List of dataframes
        """
        files = get_exported_files(self.export_path)
        self.exported_data.add(files)
        return self.exported_data

    def view(self, height: int = 1000) -> "IFrame":
        """
        Returns an IFrame that can be displayed in a notebook to view the app.

        Parameters
        ----------
        height : int, optional
            The height of the IFrame in pixels. Defaults to 1000.
        """
        print(f"📺 Opening a view to the Phoenix app. The app is running at {self.url}")
        return IFrame(src=self.url, width="100%", height=height)

    @cached_property
    def url(self) -> str:
        "Returns the url for the phoenix app"
        return _get_url(self.port, self._is_colab)

    def end(self) -> None:
        "Ends the session and closes the app service"
        self._app_service.stop()
        self.temp_dir.cleanup()


def launch_app(primary: Dataset, reference: Optional[Dataset] = None) -> "Session":
    """
    Launches the phoenix application and returns a session to interact with.

    Parameters
    ----------
    primary : Dataset required
        The primary dataset to analyze
    reference : Dataset, optional
        The reference dataset to compare against.
        If not provided, drift analysis will not be available.

    Returns
    -------
    session : Session
        The session object that can be used to view the application

    Examples
    --------
    >>> import phoenix as px
    >>> # construct a dataset to analyze
    >>> dataset = px.Dataset(...)
    >>> session = px.launch_app(dataset)
    """
    global _session

    _session = Session(primary, reference, port=PORT)
    print(f"🌍 To view the Phoenix app in your browser, visit {_session.url}")
    print("📺 To view the Phoenix app in a notebook, run `px.active_session().view()`")
    print("📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix")
    return _session


def active_session() -> Optional["Session"]:
    """
    Returns the active session if one exists, otherwise returns None
    """
    return _session


def close_app() -> None:
    """
    Closes the phoenix application.
    The application server is shut down and will no longer be accessible.
    """
    global _session
    if _session is None:
        print("No active session to close")
        return
    _session.end()
    _session = None
    logger.info("Session closed")


def _get_url(port: int, is_colab: bool) -> str:
    """Determines the iframe url based on whether this is in a colab or in a local notebook"""
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
