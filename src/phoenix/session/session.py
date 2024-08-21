import json
import logging
import os
import shutil
import warnings
from abc import ABC, abstractmethod
from collections import UserList
from datetime import datetime
from enum import Enum
from importlib.util import find_spec
from itertools import chain
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
from urllib.parse import urljoin

import pandas as pd

from phoenix.config import (
    ENV_NOTEBOOK_ENV,
    ENV_PHOENIX_COLLECTOR_ENDPOINT,
    ENV_PHOENIX_HOST,
    ENV_PHOENIX_PORT,
    ensure_working_dir,
    get_env_database_connection_str,
    get_env_host,
    get_env_port,
    get_exported_files,
    get_working_dir,
)
from phoenix.core.model_schema_adapter import create_model_from_inferences
from phoenix.inferences.inferences import EMPTY_INFERENCES, Inferences
from phoenix.pointcloud.umap_parameters import get_umap_parameters
from phoenix.server.app import (
    _db,
    create_app,
    create_engine_and_run_migrations,
    instrument_engine_if_enabled,
)
from phoenix.server.thread_server import ThreadServer
from phoenix.server.types import DbSessionFactory
from phoenix.services import AppService
from phoenix.session.client import Client
from phoenix.session.data_extractor import DEFAULT_SPAN_LIMIT, TraceDataExtractor
from phoenix.session.evaluation import encode_evaluations
from phoenix.trace import Evaluations
from phoenix.trace.dsl.query import SpanQuery
from phoenix.trace.trace_dataset import TraceDataset

try:
    from IPython.display import IFrame  # type: ignore
except:  # noqa
    pass

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

# type workaround
# https://github.com/python/mypy/issues/5264#issuecomment-399407428
if TYPE_CHECKING:
    _BaseList = UserList[pd.DataFrame]
else:
    _BaseList = UserList

# Temporary directory for the duration of the session
global _session_working_dir
_session_working_dir: Optional["TemporaryDirectory[str]"] = None


DEFAULT_TIMEOUT_IN_SECONDS = 5


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
    notebook_env: NotebookEnvironment
    """The notebook environment that the session is running in."""

    def __dir__(self) -> List[str]:
        return ["exports", "view", "url"]

    def __init__(
        self,
        database_url: str,
        primary_inferences: Inferences,
        reference_inferences: Optional[Inferences] = None,
        corpus_inferences: Optional[Inferences] = None,
        trace_dataset: Optional[TraceDataset] = None,
        default_umap_parameters: Optional[Mapping[str, Any]] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
        notebook_env: Optional[NotebookEnvironment] = None,
    ):
        self._database_url = database_url
        self.primary_inferences = primary_inferences
        self.reference_inferences = reference_inferences
        self.corpus_inferences = corpus_inferences
        self.trace_dataset = trace_dataset
        self.umap_parameters = get_umap_parameters(default_umap_parameters)
        self.host = host or get_env_host()
        self.port = port or get_env_port()
        self.temp_dir = TemporaryDirectory()
        self.export_path = Path(self.temp_dir.name) / "exports"
        self.export_path.mkdir(parents=True, exist_ok=True)
        self.exported_data = ExportedData()
        self.notebook_env = notebook_env or _get_notebook_environment()
        self.root_path = _get_root_path(self.notebook_env, self.port)
        host = "127.0.0.1" if self.host == "0.0.0.0" else self.host
        self._client = Client(
            endpoint=f"http://{host}:{self.port}", warn_if_server_not_running=False
        )

    def query_spans(
        self,
        *queries: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        project_name: Optional[str] = None,
        # Deprecated fields
        stop_time: Optional[datetime] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]:
        """
        Queries the spans in the project based on the provided parameters.

        Parameters
        ----------
            queries : *SpanQuery
                Variable-length argument list of SpanQuery objects representing
                the queries to be executed.

            start_time : datetime, optional
                 datetime representing the start time of the query.

            end_time : datetime, optional
                datetime representing the end time of the query.

            root_spans_only : boolean, optional
                whether to include only root spans in the results.

            project_name : string, optional
                name of the project to query. Defaults to the project name set
                in the environment variable `PHOENIX_PROJECT_NAME` or 'default' if not set.

        Returns:
            results : DataFrame
                DataFrame or list of DataFrames containing the query results.
        """
        if stop_time is not None:
            warnings.warn(
                "The `stop_time` parameter is deprecated and will be removed in a future release. "
                "Please use `end_time` instead.",
                DeprecationWarning,
            )
            end_time = stop_time
        return self._client.query_spans(
            *queries,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            root_spans_only=root_spans_only,
            project_name=project_name,
        )

    def get_evaluations(
        self,
        project_name: Optional[str] = None,
    ) -> List[Evaluations]:
        """
        Get the evaluations for a project.

        Parameters
        ----------
            project_name :  str, optional
                The name of the project. If not provided, the project name set
                in the environment variable `PHOENIX_PROJECT_NAME` will be used.
                Otherwise, 'default' will be used.

        Returns
        -------
            evaluations : List[Evaluations]
                A list of evaluations for the specified project.

        """
        return self._client.get_evaluations(
            project_name=project_name,
        )

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

    def view(self, *, height: int = 1000, slug: str = "") -> "IFrame":
        """View the session in a notebook embedded iFrame.

        Args:
            slug (str, optional): the path of the app to view
            height (int, optional): the height of the iFrame in px. Defaults to 1000.

        Returns:
            IFrame: the iFrame will be rendered in the notebook
        """
        url_to_view = urljoin(self.url, slug)
        print(f"📺 Opening a view to the Phoenix app. The app is running at {self.url}")
        return IFrame(src=url_to_view, width="100%", height=height)

    @property
    def url(self) -> str:
        """Returns the url for the phoenix app"""
        return _get_url(self.host, self.port, self.notebook_env)

    @property
    def database_url(self) -> str:
        return self._database_url


_session: Optional[Session] = None


class ProcessSession(Session):
    def __init__(
        self,
        database_url: str,
        primary_inferences: Inferences,
        reference_inferences: Optional[Inferences] = None,
        corpus_inferences: Optional[Inferences] = None,
        trace_dataset: Optional[TraceDataset] = None,
        default_umap_parameters: Optional[Mapping[str, Any]] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
        root_path: Optional[str] = None,
        notebook_env: Optional[NotebookEnvironment] = None,
    ) -> None:
        super().__init__(
            database_url=database_url,
            primary_inferences=primary_inferences,
            reference_inferences=reference_inferences,
            corpus_inferences=corpus_inferences,
            trace_dataset=trace_dataset,
            default_umap_parameters=default_umap_parameters,
            host=host,
            port=port,
            notebook_env=notebook_env,
        )
        primary_inferences.to_disc()
        if isinstance(reference_inferences, Inferences):
            reference_inferences.to_disc()
        if isinstance(corpus_inferences, Inferences):
            corpus_inferences.to_disc()
        if isinstance(trace_dataset, TraceDataset):
            trace_dataset.to_disc()
        umap_params_str = (
            f"{self.umap_parameters.min_dist},"
            f"{self.umap_parameters.n_neighbors},"
            f"{self.umap_parameters.n_samples}"
        )
        # Initialize an app service that keeps the server running
        self.app_service = AppService(
            database_url=database_url,
            export_path=self.export_path,
            host=self.host,
            port=self.port,
            root_path=self.root_path,
            primary_inferences_name=self.primary_inferences.name,
            umap_params=umap_params_str,
            reference_inferences_name=(
                self.reference_inferences.name if self.reference_inferences is not None else None
            ),
            corpus_inferences_name=(
                self.corpus_inferences.name if self.corpus_inferences is not None else None
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
        database_url: str,
        primary_inferences: Inferences,
        reference_inferences: Optional[Inferences] = None,
        corpus_inferences: Optional[Inferences] = None,
        trace_dataset: Optional[TraceDataset] = None,
        default_umap_parameters: Optional[Mapping[str, Any]] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
        root_path: Optional[str] = None,
        notebook_env: Optional[NotebookEnvironment] = None,
    ):
        super().__init__(
            database_url=database_url,
            primary_inferences=primary_inferences,
            reference_inferences=reference_inferences,
            corpus_inferences=corpus_inferences,
            trace_dataset=trace_dataset,
            default_umap_parameters=default_umap_parameters,
            host=host,
            port=port,
            notebook_env=notebook_env,
        )
        self.model = create_model_from_inferences(
            primary_inferences,
            reference_inferences,
        )
        self.corpus = (
            create_model_from_inferences(
                corpus_inferences,
            )
            if corpus_inferences is not None
            else None
        )
        # Initialize an app service that keeps the server running
        engine = create_engine_and_run_migrations(database_url)
        instrumentation_cleanups = instrument_engine_if_enabled(engine)
        factory = DbSessionFactory(db=_db(engine), dialect=engine.dialect.name)
        self.app = create_app(
            db=factory,
            export_path=self.export_path,
            model=self.model,
            authentication_enabled=False,
            corpus=self.corpus,
            umap_params=self.umap_parameters,
            initial_spans=trace_dataset.to_spans() if trace_dataset else None,
            initial_evaluations=(
                chain.from_iterable(map(encode_evaluations, initial_evaluations))
                if (trace_dataset and (initial_evaluations := trace_dataset.evaluations))
                else None
            ),
            shutdown_callbacks=instrumentation_cleanups,
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


def delete_all(prompt_before_delete: Optional[bool] = True) -> None:
    """
    Deletes the entire contents of the working directory. This will delete, traces, evaluations,
    and any other data stored in the working directory.
    """
    global _session_working_dir
    working_dir = get_working_dir()
    directories_to_delete = []
    if working_dir.exists():
        directories_to_delete.append(working_dir)
    if _session_working_dir is not None:
        directories_to_delete.append(Path(_session_working_dir.name))

    # Loop through directories to delete
    for directory in directories_to_delete:
        if prompt_before_delete:
            input(
                f"You have data at {directory}. Are you sure you want to delete?"
                + " This cannot be undone. Press Enter to delete, Escape to cancel."
            )
        shutil.rmtree(directory)
    _session_working_dir = None


def launch_app(
    primary: Optional[Inferences] = None,
    reference: Optional[Inferences] = None,
    corpus: Optional[Inferences] = None,
    trace: Optional[TraceDataset] = None,
    default_umap_parameters: Optional[Mapping[str, Any]] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    run_in_thread: bool = True,
    notebook_environment: Optional[Union[NotebookEnvironment, str]] = None,
    use_temp_dir: bool = True,
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
        The trace dataset containing the trace data.
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
    use_temp_dir: bool, optional, default=True
        Whether to use a temporary directory to store the data. If set to False, the data will be
        stored in the directory specified by PHOENIX_WORKING_DIR environment variable via SQLite.


    Returns
    -------
    session : Session
        The session object that can be used to view the application

    Examples
    --------
    >>> import phoenix as px
    >>> # construct an inference set to analyze
    >>> inferences = px.Inferences(...)
    >>> session = px.launch_app(inferences)
    """
    global _session

    # First we must ensure that the working directory is setup
    # NB: this is because the working directory can be deleted by the user
    ensure_working_dir()

    # Stopgap solution to allow the app to run without a primary dataset
    if primary is None:
        # Dummy inferences
        # TODO: pass through the lack of a primary inferences to the app
        primary = EMPTY_INFERENCES

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

    if port is not None:
        warning_message = (
            "❗️ The launch_app `port` parameter is deprecated and "
            "will be removed in a future release. "
            f"Use the `{ENV_PHOENIX_PORT}` environment variable instead."
        )
        print(warning_message)
        warnings.warn(
            warning_message,
            DeprecationWarning,
        )
    if host is not None:
        warning_message = (
            "❗️ The launch_app `host` parameter is deprecated and "
            "will be removed in a future release. "
            f"Use the `{ENV_PHOENIX_HOST}` environment variable instead."
        )
        print(warning_message)
        warnings.warn(
            warning_message,
            DeprecationWarning,
        )

    host = host or get_env_host()
    port = port or get_env_port()
    if use_temp_dir:
        global _session_working_dir
        _session_working_dir = _session_working_dir or TemporaryDirectory()
        database_url = f"sqlite:///{_session_working_dir.name}/phoenix.db"
    else:
        database_url = get_env_database_connection_str()

    if run_in_thread:
        _session = ThreadSession(
            database_url,
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
            database_url,
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
        _session = None
        return None

    print(f"🌍 To view the Phoenix app in your browser, visit {_session.url}")
    if not use_temp_dir:
        print(f"💽 Your data is being persisted to {database_url}")
    print("📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix")
    return _session


def active_session() -> Optional[Session]:
    """
    Returns the active session if one exists, otherwise returns None
    """
    if _session and _session.active:
        return _session
    return None


def close_app(delete_data: bool = False) -> None:
    """
    Closes the phoenix application.
    The application server is shut down and will no longer be accessible.

    Parameters
    ----------
    delete_data : bool, optional
        If set to true, all stored phoenix data, including traces and evaluations. Default False.
    """
    global _session
    if _session is None:
        print("No active session to close")
        return
    _session.end()
    _session = None
    logger.info("Session closed")
    if delete_data:
        logger.info("Deleting all data")
        delete_all(prompt_before_delete=False)


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
    if find_spec("sagemaker") is None:
        return False
    try:
        _get_sagemaker_notebook_base_url()
    except Exception:
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
