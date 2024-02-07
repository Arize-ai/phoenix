import json
import logging
import os
from abc import ABC, abstractmethod
from collections import UserList
from datetime import datetime
from enum import Enum
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Set,
    Union,
)

import pandas as pd

from phoenix.config import (
    ENV_NOTEBOOK_ENV,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    get_env_host,
    get_env_port,
    get_exported_files,
)
from phoenix.core.evals import Evals
from phoenix.core.model_schema_adapter import create_model_from_datasets
from phoenix.core.traces import Traces
from phoenix.datasets.dataset import EMPTY_DATASET, Dataset
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import create_app
from phoenix.server.thread_server import ThreadServer
from phoenix.services import AppService
from phoenix.session.client import Client
from phoenix.session.data_extractor import TraceDataExtractor
from phoenix.session.evaluation import encode_evaluations
from phoenix.trace import Evaluations
from phoenix.trace.dsl.query import SpanQuery
from phoenix.trace.otel import encode
from phoenix.trace.trace_dataset import TraceDataset
from phoenix.utilities import query_spans

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


class NotebookEnvironment(Enum):
    COLAB = "colab"
    LOCAL = "local"
    SAGEMAKER = "sagemaker"
    DATABRICKS = "databricks"


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


class Session(TraceDataExtractor, ABC):
    """Session that maintains a 1-1 shared state with the Phoenix App."""

    trace_dataset: Optional[TraceDataset]
    traces: Optional[Traces]
    notebook_env: NotebookEnvironment
    """The notebook environment that the session is running in."""

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
        notebook_env: Optional[NotebookEnvironment] = None,
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
                self.traces.put(encode(span))

        self.evals: Evals = Evals()
        if trace_dataset:
            for evaluations in trace_dataset.evaluations:
                for pb_evaluation in encode_evaluations(evaluations):
                    self.evals.put(pb_evaluation)

        self.host = host or get_env_host()
        self.port = port or get_env_port()
        self.temp_dir = TemporaryDirectory()
        self.export_path = Path(self.temp_dir.name) / "exports"
        self.export_path.mkdir(parents=True, exist_ok=True)
        self.exported_data = ExportedData()
        self.notebook_env = notebook_env or _get_notebook_environment()
        self.root_path = _get_root_path(self.notebook_env, self.port)

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
        return _get_url(self.host, self.port, self.notebook_env)


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
        root_path: Optional[str] = None,
        notebook_env: Optional[NotebookEnvironment] = None,
    ) -> None:
        super().__init__(
            primary_dataset=primary_dataset,
            reference_dataset=reference_dataset,
            corpus_dataset=corpus_dataset,
            trace_dataset=trace_dataset,
            default_umap_parameters=default_umap_parameters,
            host=host,
            port=port,
            notebook_env=notebook_env,
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
            self.root_path,
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
        host = "127.0.0.1" if self.host == "0.0.0.0" else self.host
        self._client = Client(
            endpoint=f"http://{host}:{self.port}",
            use_active_session_if_available=False,
        )

    @property
    def active(self) -> bool:
        return self.app_service.active

    def end(self) -> None:
        self.app_service.stop()
        self.temp_dir.cleanup()

    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]:
        return self._client.query_spans(
            *queries,
            start_time=start_time,
            stop_time=stop_time,
            root_spans_only=root_spans_only,
        )

    def get_evaluations(self) -> List[Evaluations]:
        return self._client.get_evaluations()


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
        root_path: Optional[str] = None,
        notebook_env: Optional[NotebookEnvironment] = None,
    ):
        super().__init__(
            primary_dataset=primary_dataset,
            reference_dataset=reference_dataset,
            corpus_dataset=corpus_dataset,
            trace_dataset=trace_dataset,
            default_umap_parameters=default_umap_parameters,
            host=host,
            port=port,
            notebook_env=notebook_env,
        )
        # Initialize an app service that keeps the server running
        self.app = create_app(
            export_path=self.export_path,
            model=self.model,
            corpus=self.corpus,
            traces=self.traces,
            evals=self.evals,
            umap_params=self.umap_parameters,
        )
        self.server = ThreadServer(
            app=self.app,
            host=self.host,
            port=self.port,
            root_path=self.root_path,
        ).run_in_thread()
        # start the server
        self.server_thread = next(self.server)

    @property
    def active(self) -> bool:
        return self.server_thread.is_alive()

    def end(self) -> None:
        self.server.close()
        self.temp_dir.cleanup()

    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]:
        if (traces := self.traces) is None:
            return None
        if not queries:
            queries = (SpanQuery(),)
        valid_eval_names = self.evals.get_span_evaluation_names() if self.evals else ()
        queries = tuple(
            SpanQuery.from_dict(
                query.to_dict(),
                evals=self.evals,
                valid_eval_names=valid_eval_names,
            )
            for query in queries
        )
        results = query_spans(
            traces,
            *queries,
            start_time=start_time,
            stop_time=stop_time,
            root_spans_only=root_spans_only,
        )
        if len(results) == 1:
            df = results[0]
            return None if df.shape == (0, 0) else df
        return results

    def get_evaluations(self) -> List[Evaluations]:
        return self.evals.export_evaluations()


def launch_app(
    primary: Optional[Dataset] = None,
    reference: Optional[Dataset] = None,
    corpus: Optional[Dataset] = None,
    trace: Optional[TraceDataset] = None,
    default_umap_parameters: Optional[Mapping[str, Any]] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    run_in_thread: bool = True,
    notebook_environment: Optional[Union[NotebookEnvironment, str]] = None,
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
        The port on which the server listens. When using traces this should not be
        used and should instead set the environment variable `PHOENIX_PORT`.
        Defaults to 6006.
    run_in_thread: bool, optional, default=True
        Whether the server should run in a Thread or Process.
    default_umap_parameters: Dict[str, Union[int, float]], optional, default=None
        User specified default UMAP parameters
        eg: {"n_neighbors": 10, "n_samples": 5, "min_dist": 0.5}
    notebook_environment: str, optional, default=None
        The environment the notebook is running in. This is either 'local', 'colab', or 'sagemaker'.
        If not provided, phoenix will try to infer the environment. This is only needed if
        there is a failure to infer the environment.

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

    # Detect mis-configurations and provide warnings
    if (env_collector_endpoint := os.getenv(ENV_PHOENIX_COLLECTOR_ENDPOINT)) is not None:
        logger.warning(
            f"⚠️ {ENV_PHOENIX_COLLECTOR_ENDPOINT} is set to {env_collector_endpoint}.\n"
            "⚠️ This means that traces will be sent to the collector endpoint and not this app.\n"
            "⚠️ If you would like to use this app to view traces, please unset this environment"
            f"variable via e.g. `del os.environ['{ENV_PHOENIX_COLLECTOR_ENDPOINT}']` \n"
            "⚠️ You will need to restart your notebook to apply this change."
        )

    # Normalize notebook environment
    if isinstance(notebook_environment, str):
        nb_env: Optional[NotebookEnvironment] = NotebookEnvironment(notebook_environment.lower())
    else:
        nb_env = notebook_environment

    host = host or get_env_host()
    port = port or get_env_port()

    if run_in_thread:
        _session = ThreadSession(
            primary,
            reference,
            corpus,
            trace,
            default_umap_parameters,
            host=host,
            port=port,
            notebook_env=nb_env,
        )
        # TODO: catch exceptions from thread
    else:
        _session = ProcessSession(
            primary,
            reference,
            corpus,
            trace,
            default_umap_parameters,
            host=host,
            port=port,
            notebook_env=nb_env,
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


def _get_url(host: str, port: int, notebook_env: NotebookEnvironment) -> str:
    """Determines the IFrame URL based on whether this is in a Colab or in a local notebook"""
    if notebook_env == NotebookEnvironment.COLAB:
        from google.colab.output import eval_js  # type: ignore

        return str(eval_js(f"google.colab.kernel.proxyPort({port}, {{'cache': true}})"))
    if notebook_env == NotebookEnvironment.SAGEMAKER:
        # NB: Sagemaker notebooks only work with port 6006 - which is used by tensorboard
        return f"{_get_sagemaker_notebook_base_url()}/proxy/{port}/"
    if notebook_env == NotebookEnvironment.DATABRICKS:
        context = _get_databricks_context()
        return f"{_get_databricks_notebook_base_url(context)}/{port}/"
    if host == "0.0.0.0" or host == "127.0.0.1":
        # The app is running locally, so use localhost
        return f"http://localhost:{port}/"
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


def _is_sagemaker() -> bool:
    """Determines whether this is in a SageMaker notebook"""
    try:
        import sagemaker  # type: ignore # noqa: F401
    except ImportError:
        return False
    try:
        from IPython.core.getipython import get_ipython
    except ImportError:
        return False
    return get_ipython() is not None


def _is_databricks() -> bool:
    """Determines whether this is in a Databricks notebook"""
    try:
        import IPython  # type: ignore
    except ImportError:
        return False
    if (shell := IPython.get_ipython()) is None:
        return False
    try:
        dbutils = shell.user_ns["dbutils"]
    except KeyError:
        return False
    return dbutils is not None


def _get_notebook_environment() -> NotebookEnvironment:
    """Determines the notebook environment"""
    if (notebook_env := os.getenv(ENV_NOTEBOOK_ENV)) is not None:
        return NotebookEnvironment(notebook_env.lower())
    return _infer_notebook_environment()


def _infer_notebook_environment() -> NotebookEnvironment:
    """Use feature detection to determine the notebook environment"""
    if _is_databricks():
        return NotebookEnvironment.DATABRICKS
    if _is_colab():
        return NotebookEnvironment.COLAB
    if _is_sagemaker():
        return NotebookEnvironment.SAGEMAKER
    return NotebookEnvironment.LOCAL


def _get_sagemaker_notebook_base_url() -> str:
    """
    Returns base url of the sagemaker notebook by parsing the Arn
    src: https://github.com/aws-samples/amazon-sagemaker-notebook-instance-lifecycle-config-samples/blob/62c44aa5e69f4266955476f24647b99d9b597aaf/scripts/auto-stop-idle/autostop.py#L79
    """
    log_path = "/opt/ml/metadata/resource-metadata.json"
    with open(log_path, "r") as logs:
        logs = json.load(logs)
    arn = logs["ResourceArn"]  # type: ignore

    # Parse the ARN to get the region and notebook instance name
    # E.x. arn:aws:sagemaker:us-east-2:802164118598:notebook-instance/my-notebook-instance
    parts = arn.split(":")
    region = parts[3]
    notebook_instance_name = parts[5].split("/")[1]

    return f"https://{notebook_instance_name}.notebook.{region}.sagemaker.aws"


def _get_root_path(environment: NotebookEnvironment, port: int) -> str:
    """
    Returns the base path for the app if the app is running behind a proxy
    """
    if environment == NotebookEnvironment.SAGEMAKER:
        return f"/proxy/{port}/"
    if environment == NotebookEnvironment.DATABRICKS:
        context = _get_databricks_context()
        return f"/driver-proxy/o/{context.org_id}/{context.cluster_id}/{port}/"
    return ""


class DatabricksContext(NamedTuple):
    host: str
    org_id: str
    cluster_id: str


def _get_databricks_context() -> DatabricksContext:
    """
    Returns the databricks context for constructing the base url
    and the root_path for the app
    """
    import IPython

    shell = IPython.get_ipython()
    dbutils = shell.user_ns["dbutils"]
    notebook_context = json.loads(
        dbutils.entry_point.getDbutils().notebook().getContext().toJson()
    )["tags"]

    return DatabricksContext(
        host=notebook_context["browserHostName"],
        org_id=notebook_context["orgId"],
        cluster_id=notebook_context["clusterId"],
    )


def _get_databricks_notebook_base_url(context: DatabricksContext) -> str:
    """
    Returns base url of the databricks notebook by parsing the tags
    """
    return f"https://{context.host}/driver-proxy/o/{context.org_id}/{context.cluster_id}"
