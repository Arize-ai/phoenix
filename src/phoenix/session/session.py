import json
import logging
from abc import ABC, abstractmethod
from collections import UserList
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    List,
    Mapping,
    Optional,
    Set,
)

import pandas as pd

from phoenix.config import get_env_host, get_env_port, get_exported_files
from phoenix.core.model_schema_adapter import create_model_from_datasets
from phoenix.core.traces import Traces
from phoenix.datasets.dataset import EMPTY_DATASET, Dataset
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import create_app
from phoenix.server.thread_server import ThreadServer
from phoenix.services import AppService
from phoenix.trace.filter import SpanFilter
from phoenix.trace.span_json_encoder import span_to_json
from phoenix.trace.trace_dataset import TraceDataset

try:
    from IPython.display import IFrame  # type: ignore
except:  # noqa
    pass

logger = logging.getLogger(__name__)

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


class Session(ABC):
    """Session that maintains a 1-1 shared state with the Phoenix App."""

    trace_dataset: Optional[TraceDataset]
    traces: Optional[Traces]

    def __dir__(self) -> List[str]:
        return ["exports", "view", "url"]

    def __init__(
        self,
        primary_dataset: Dataset,
        reference_dataset: Optional[Dataset] = None,
        corpus_dataset: Optional[Dataset] = None,
        trace_dataset: Optional[TraceDataset] = None,
        default_umap_parameters: Optional[Mapping[str, Any]] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
    ):
        self.primary_dataset = primary_dataset
        self.reference_dataset = reference_dataset
        self.corpus_dataset = corpus_dataset
        self.trace_dataset = trace_dataset
        self.umap_parameters = get_umap_parameters(default_umap_parameters)
        self.model = create_model_from_datasets(
            primary_dataset,
            reference_dataset,
        )

        self.corpus = (
            create_model_from_datasets(
                corpus_dataset,
            )
            if corpus_dataset is not None
            else None
        )

        self.traces = Traces()
        if trace_dataset:
            for span in trace_dataset.to_spans():
                self.traces.put(span)

        self.host = host or get_env_host()
        self.port = port or get_env_port()
        self.temp_dir = TemporaryDirectory()
        self.export_path = Path(self.temp_dir.name) / "exports"
        self.export_path.mkdir(parents=True, exist_ok=True)
        self.exported_data = ExportedData()
        self.is_colab = _is_colab()

    @abstractmethod
    def end(self) -> None:
        """Ends the session and closes the app service"""

    @property
    @abstractmethod
    def active(self) -> bool:
        """Whether session is active, i.e. whether server still serves"""

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

    @property
    def url(self) -> str:
        """Returns the url for the phoenix app"""
        return _get_url(self.host, self.port, self.is_colab)

    def get_spans_dataframe(
        self,
        filter_condition: Optional[str] = None,
        *,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = None,
    ) -> Optional[pd.DataFrame]:
        if (traces := self.traces) is None:
            return None
        predicate = SpanFilter(filter_condition) if filter_condition else None
        spans = traces.get_spans(
            start_time=start_time,
            stop_time=stop_time,
            root_spans_only=root_spans_only,
        )
        if predicate:
            spans = filter(predicate, spans)
        if not (data := [json.loads(span_to_json(span)) for span in spans]):
            return None
        return pd.json_normalize(data, max_level=1).set_index("context.span_id", drop=False)


_session: Optional[Session] = None


class ProcessSession(Session):
    def __init__(
        self,
        primary_dataset: Dataset,
        reference_dataset: Optional[Dataset] = None,
        corpus_dataset: Optional[Dataset] = None,
        trace_dataset: Optional[TraceDataset] = None,
        default_umap_parameters: Optional[Mapping[str, Any]] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
    ) -> None:
        super().__init__(
            primary_dataset=primary_dataset,
            reference_dataset=reference_dataset,
            corpus_dataset=corpus_dataset,
            trace_dataset=trace_dataset,
            default_umap_parameters=default_umap_parameters,
            host=host,
            port=port,
        )
        primary_dataset.to_disc()
        if isinstance(reference_dataset, Dataset):
            reference_dataset.to_disc()
        if isinstance(corpus_dataset, Dataset):
            corpus_dataset.to_disc()
        if isinstance(trace_dataset, TraceDataset):
            trace_dataset.to_disc()
        umap_params_str = (
            f"{self.umap_parameters.min_dist},"
            f"{self.umap_parameters.n_neighbors},"
            f"{self.umap_parameters.n_samples}"
        )
        # Initialize an app service that keeps the server running
        self.app_service = AppService(
            self.export_path,
            self.host,
            self.port,
            self.primary_dataset.name,
            umap_params_str,
            reference_dataset_name=(
                self.reference_dataset.name if self.reference_dataset is not None else None
            ),
            corpus_dataset_name=(
                self.corpus_dataset.name if self.corpus_dataset is not None else None
            ),
            trace_dataset_name=(
                self.trace_dataset.name if self.trace_dataset is not None else None
            ),
        )

    @property
    def active(self) -> bool:
        return self.app_service.active

    def end(self) -> None:
        self.app_service.stop()
        self.temp_dir.cleanup()


class ThreadSession(Session):
    def __init__(
        self,
        primary_dataset: Dataset,
        reference_dataset: Optional[Dataset] = None,
        corpus_dataset: Optional[Dataset] = None,
        trace_dataset: Optional[TraceDataset] = None,
        default_umap_parameters: Optional[Mapping[str, Any]] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
    ):
        super().__init__(
            primary_dataset=primary_dataset,
            reference_dataset=reference_dataset,
            corpus_dataset=corpus_dataset,
            trace_dataset=trace_dataset,
            default_umap_parameters=default_umap_parameters,
            host=host,
            port=port,
        )
        # Initialize an app service that keeps the server running
        self.app = create_app(
            export_path=self.export_path,
            model=self.model,
            corpus=self.corpus,
            traces=self.traces,
            umap_params=self.umap_parameters,
        )
        self.server = ThreadServer(
            app=self.app,
            host=self.host,
            port=self.port,
        ).run_in_thread()
        # start the server
        self.server_thread = next(self.server)

    @property
    def active(self) -> bool:
        return self.server_thread.is_alive()

    def end(self) -> None:
        self.server.close()
        self.temp_dir.cleanup()


def launch_app(
    primary: Optional[Dataset] = None,
    reference: Optional[Dataset] = None,
    corpus: Optional[Dataset] = None,
    trace: Optional[TraceDataset] = None,
    default_umap_parameters: Optional[Mapping[str, Any]] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    run_in_thread: bool = True,
) -> Optional[Session]:
    """
    Launches the phoenix application and returns a session to interact with.

    Parameters
    ----------
    primary : Dataset, optional
        The primary dataset to analyze
    reference : Dataset, optional
        The reference dataset to compare against.
        If not provided, drift analysis will not be available.
    corpus : Dataset, optional
        The dataset containing corpus for LLM context retrieval.
    trace: TraceDataset, optional
        **Experimental** The trace dataset containing the trace data.
    host: str, optional
        The host on which the server runs. It can also be set using environment
        variable `PHOENIX_HOST`, otherwise it defaults to `127.0.0.1`.
    port: int, optional
        The port on which the server listens. It can also be set using environment
        variable `PHOENIX_PORT`, otherwise it defaults to 6060.
    run_in_thread: bool, optional, default=True
        Whether the server should run in a Thread or Process.
    default_umap_parameters: Dict[str, Union[int, float]], optional, default=None
        User specified default UMAP parameters
        eg: {"n_neighbors": 10, "n_samples": 5, "min_dist": 0.5}

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

    # Stopgap solution to allow the app to run without a primary dataset
    if primary is None:
        # Dummy dataset
        # TODO: pass through the lack of a primary dataset to the app
        primary = EMPTY_DATASET

    if _session is not None and _session.active:
        logger.warning(
            "Existing running Phoenix instance detected! Shutting "
            "it down and starting a new instance..."
        )
        _session.end()

    host = host or get_env_host()
    port = port or get_env_port()

    if run_in_thread:
        _session = ThreadSession(
            primary, reference, corpus, trace, default_umap_parameters, host=host, port=port
        )
        # TODO: catch exceptions from thread
    else:
        _session = ProcessSession(
            primary, reference, corpus, trace, default_umap_parameters, host=host, port=port
        )

    if not _session.active:
        logger.error(
            f"💥 Phoenix failed to start. Please try again (making sure that "
            f"port {port} is not occupied by another process) or file an issue "
            f"with us at https://github.com/Arize-ai/phoenix"
        )
        return None

    print(f"🌍 To view the Phoenix app in your browser, visit {_session.url}")
    print("📺 To view the Phoenix app in a notebook, run `px.active_session().view()`")
    print("📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix")
    return _session


def active_session() -> Optional[Session]:
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


def _get_url(host: str, port: int, is_colab: bool) -> str:
    """Determines the IFrame URL based on whether this is in a Colab or in a local notebook"""
    if is_colab:
        from google.colab.output import eval_js  # type: ignore

        return str(eval_js(f"google.colab.kernel.proxyPort({port}, {{'cache': true}})"))

    return f"http://{host}:{port}/"


def _is_colab() -> bool:
    """Determines whether this is in a Colab"""
    try:
        import google.colab  # type: ignore # noqa: F401
    except ImportError:
        return False
    try:
        from IPython.core.getipython import get_ipython  # type: ignore
    except ImportError:
        return False
    return get_ipython() is not None
