import asyncio
import contextlib
import importlib
import json
import logging
import os
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable, Sequence
from contextlib import AbstractAsyncContextManager, AsyncExitStack
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import cached_property
from pathlib import Path
from types import MethodType
from typing import (
    TYPE_CHECKING,
    Any,
    NamedTuple,
    Optional,
    Protocol,
    TypedDict,
    Union,
    cast,
)
from urllib.parse import urlparse

import grpc
import strawberry
from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.utils import is_body_allowed_for_status_code
from grpc.aio import ServerInterceptor
from grpc_interceptor import AsyncServerInterceptor
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from starlette.datastructures import URL, Secret
from starlette.datastructures import State as StarletteState
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.status import HTTP_401_UNAUTHORIZED
from starlette.templating import Jinja2Templates
from starlette.types import Scope, StatefulLifespan
from strawberry.extensions import SchemaExtension
from strawberry.fastapi import GraphQLRouter
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL
from typing_extensions import TypeAlias, override

import phoenix.trace.v1 as pb
from phoenix.config import (
    DEFAULT_PROJECT_NAME,
    ENV_PHOENIX_CSRF_TRUSTED_ORIGINS,
    SERVER_DIR,
    OAuth2ClientConfig,
    get_env_csrf_trusted_origins,
    get_env_fastapi_middleware_paths,
    get_env_gql_extension_paths,
    get_env_grpc_interceptor_paths,
    get_env_host,
    get_env_host_root_path,
    get_env_port,
    server_instrumentation_is_enabled,
    verify_server_environment_variables,
)
from phoenix.core.model_schema import Model
from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import create_engine
from phoenix.db.facilitator import Facilitator
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.exceptions import PhoenixMigrationError
from phoenix.pointcloud.umap_parameters import UMAPParameters
from phoenix.server.api.context import Context, DataLoaders
from phoenix.server.api.dataloaders import (
    AnnotationConfigsByProjectDataLoader,
    AnnotationSummaryDataLoader,
    AverageExperimentRunLatencyDataLoader,
    CacheForDataLoaders,
    DatasetExampleRevisionsDataLoader,
    DatasetExampleSpansDataLoader,
    DocumentEvaluationsDataLoader,
    DocumentEvaluationSummaryDataLoader,
    DocumentRetrievalMetricsDataLoader,
    ExperimentAnnotationSummaryDataLoader,
    ExperimentErrorRatesDataLoader,
    ExperimentRunAnnotations,
    ExperimentRunCountsDataLoader,
    ExperimentSequenceNumberDataLoader,
    LastUsedTimesByGenerativeModelIdDataLoader,
    LatencyMsQuantileDataLoader,
    MinStartOrMaxEndTimeDataLoader,
    NumChildSpansDataLoader,
    NumSpansPerTraceDataLoader,
    ProjectByNameDataLoader,
    ProjectIdsByTraceRetentionPolicyIdDataLoader,
    PromptVersionSequenceNumberDataLoader,
    RecordCountDataLoader,
    SessionIODataLoader,
    SessionNumTracesDataLoader,
    SessionNumTracesWithErrorDataLoader,
    SessionTokenUsagesDataLoader,
    SessionTraceLatencyMsQuantileDataLoader,
    SpanAnnotationsDataLoader,
    SpanByIdDataLoader,
    SpanCostBySpanDataLoader,
    SpanCostDetailsBySpanCostDataLoader,
    SpanCostDetailSummaryEntriesByGenerativeModelDataLoader,
    SpanCostDetailSummaryEntriesByProjectSessionDataLoader,
    SpanCostDetailSummaryEntriesBySpanDataLoader,
    SpanCostDetailSummaryEntriesByTraceDataLoader,
    SpanCostSummaryByExperimentDataLoader,
    SpanCostSummaryByExperimentRunDataLoader,
    SpanCostSummaryByGenerativeModelDataLoader,
    SpanCostSummaryByProjectDataLoader,
    SpanCostSummaryByProjectSessionDataLoader,
    SpanCostSummaryByTraceDataLoader,
    SpanDatasetExamplesDataLoader,
    SpanDescendantsDataLoader,
    SpanProjectsDataLoader,
    TableFieldsDataLoader,
    TokenCountDataLoader,
    TraceByTraceIdsDataLoader,
    TraceRetentionPolicyIdByProjectIdDataLoader,
    TraceRootSpansDataLoader,
    UserRolesDataLoader,
    UsersDataLoader,
)
from phoenix.server.api.routers import (
    auth_router,
    create_embeddings_router,
    create_v1_router,
    oauth2_router,
)
from phoenix.server.api.routers.v1 import REST_API_VERSION
from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.bearer_auth import BearerTokenAuthBackend, is_authenticated
from phoenix.server.daemons.db_disk_usage_monitor import DbDiskUsageMonitor
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.dml_event import DmlEvent
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.email.types import EmailSender
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.jwt_store import JwtStore
from phoenix.server.middleware.gzip import GZipMiddleware
from phoenix.server.oauth2 import OAuth2Clients
from phoenix.server.retention import TraceDataSweeper
from phoenix.server.telemetry import initialize_opentelemetry_tracer_provider
from phoenix.server.types import (
    CanGetLastUpdatedAt,
    CanPutItem,
    DaemonTask,
    DbSessionFactory,
    LastUpdatedAt,
    TokenStore,
)
from phoenix.settings import Settings
from phoenix.trace.fixtures import (
    TracesFixture,
    get_dataset_fixtures,
    get_evals_from_fixture,
    get_trace_fixture_by_name,
    load_example_traces,
    reset_fixture_span_ids_and_timestamps,
    send_dataset_fixtures,
)
from phoenix.trace.otel import decode_otlp_span, encode_span_to_otlp
from phoenix.trace.schemas import Span
from phoenix.utilities.client import PHOENIX_SERVER_VERSION_HEADER
from phoenix.version import __version__ as phoenix_version

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

logger = logging.getLogger(__name__)

router = APIRouter(include_in_schema=False)

templates = Jinja2Templates(directory=SERVER_DIR / "templates")

"""
Threshold (in minutes) to determine if database is booted up for the first time.

Used to assess whether the `default` project was created recently.
If so, demo data is automatically ingested upon initial boot up to populate the database.
"""
NEW_DB_AGE_THRESHOLD_MINUTES = 2

ProjectName: TypeAlias = str
_Callback: TypeAlias = Callable[[], Union[None, Awaitable[None]]]


def import_object_from_file(file_path: str, object_name: str) -> Any:
    """Import an object (class or function) from a Python file."""
    try:
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File '{file_path}' does not exist.")
        module_name = f"custom_module_{hash(file_path)}"
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None:
            raise ImportError(f"Could not load spec for '{file_path}'")
        module = importlib.util.module_from_spec(spec)
        loader = spec.loader
        if loader is None:
            raise ImportError(f"No loader found for '{file_path}'")
        loader.exec_module(module)
        try:
            return getattr(module, object_name)
        except AttributeError:
            raise ImportError(f"Module '{file_path}' does not have an object '{object_name}'.")
    except Exception as e:
        raise ImportError(f"Could not import '{object_name}' from '{file_path}': {e}")


class OAuth2Idp(TypedDict):
    name: str
    displayName: str


class AppConfig(NamedTuple):
    has_inferences: bool
    """ Whether the model has inferences (e.g. a primary dataset) """
    has_corpus: bool
    min_dist: float
    n_neighbors: int
    n_samples: int
    is_development: bool
    web_manifest_path: Path
    authentication_enabled: bool
    """ Whether authentication is enabled """
    oauth2_idps: Sequence[OAuth2Idp]
    basic_auth_disabled: bool = False
    auto_login_idp_name: Optional[str] = None
    fullstory_org: Optional[str] = None
    """ FullStory organization ID for web analytics tracking """
    management_url: Optional[str] = None
    """ URL for a phoenix management interface, only visible to management users """


class Static(StaticFiles):
    "Static file serving with a fallback to index.html"

    _app_config: AppConfig

    def __init__(self, *, app_config: AppConfig, **kwargs: Any):
        self._app_config = app_config
        super().__init__(**kwargs)

    @cached_property
    def _web_manifest(self) -> dict[str, Any]:
        try:
            with open(self._app_config.web_manifest_path, "r") as f:
                return cast(dict[str, Any], json.load(f))
        except FileNotFoundError as e:
            if self._app_config.is_development:
                return {}
            raise e

    def _sanitize_basename(self, basename: str) -> str:
        return basename[:-1] if basename.endswith("/") else basename

    async def get_response(self, path: str, scope: Scope) -> Response:
        # Redirect to the oauth2 login page if basic auth is disabled and auto_login is enabled
        # TODO: this needs to be refactored to be cleaner
        if (
            path == "login"
            and self._app_config.basic_auth_disabled
            and self._app_config.auto_login_idp_name
        ):
            request = Request(scope)
            url = URL(
                str(
                    Path(get_env_host_root_path())
                    / f"oauth2/{self._app_config.auto_login_idp_name}/login"
                )
            )
            url = url.include_query_params(**request.query_params)
            return RedirectResponse(url=url)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as e:
            if e.status_code != 404:
                raise e
            # Fallback to the index.html
            request = Request(scope)
            response = templates.TemplateResponse(
                "index.html",
                context={
                    "has_inferences": self._app_config.has_inferences,
                    "has_corpus": self._app_config.has_corpus,
                    "min_dist": self._app_config.min_dist,
                    "n_neighbors": self._app_config.n_neighbors,
                    "n_samples": self._app_config.n_samples,
                    "basename": self._sanitize_basename(request.scope.get("root_path", "")),
                    "platform_version": phoenix_version,
                    "request": request,
                    "is_development": self._app_config.is_development,
                    "manifest": self._web_manifest,
                    "authentication_enabled": self._app_config.authentication_enabled,
                    "oauth2_idps": self._app_config.oauth2_idps,
                    "basic_auth_disabled": self._app_config.basic_auth_disabled,
                    "auto_login_idp_name": self._app_config.auto_login_idp_name,
                    "fullstory_org": self._app_config.fullstory_org,
                    "management_url": self._app_config.management_url,
                },
            )
        except Exception as e:
            raise e
        return response


class RequestOriginHostnameValidator(BaseHTTPMiddleware):
    def __init__(self, *args: Any, trusted_hostnames: list[str], **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._trusted_hostnames = trusted_hostnames

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        headers = request.headers
        for key in "origin", "referer":
            if not (url := headers.get(key)):
                continue
            if urlparse(url).hostname not in self._trusted_hostnames:
                return Response(f"untrusted {key}", status_code=HTTP_401_UNAUTHORIZED)
        return await call_next(request)


class HeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        from phoenix.version import __version__ as phoenix_version

        response = await call_next(request)
        response.headers["x-colab-notebook-cache-control"] = "no-cache"
        response.headers[PHOENIX_SERVER_VERSION_HEADER] = phoenix_version
        return response


def user_fastapi_middlewares() -> list[Middleware]:
    paths = get_env_fastapi_middleware_paths()
    middlewares = []
    for file_path, object_name in paths:
        middleware_class = import_object_from_file(file_path, object_name)
        if not issubclass(middleware_class, BaseHTTPMiddleware):
            raise TypeError(f"{middleware_class} is not a subclass of BaseHTTPMiddleware")
        middlewares.append(Middleware(middleware_class))
    return middlewares


def user_gql_extensions() -> list[Union[type[SchemaExtension], SchemaExtension]]:
    paths = get_env_gql_extension_paths()
    extensions = []
    for file_path, object_name in paths:
        extension_class = import_object_from_file(file_path, object_name)
        if not issubclass(extension_class, SchemaExtension):
            raise TypeError(f"{extension_class} is not a subclass of SchemaExtension")
        extensions.append(extension_class)
    return extensions


def user_grpc_interceptors() -> list[ServerInterceptor]:
    paths = get_env_grpc_interceptor_paths()
    interceptors = []
    for file_path, object_name in paths:
        interceptor_class = import_object_from_file(file_path, object_name)
        if not issubclass(interceptor_class, ServerInterceptor):
            raise TypeError(f"{interceptor_class} is not a subclass of ServerInterceptor")
        interceptors.append(interceptor_class)
    return interceptors


ProjectRowId: TypeAlias = int


@router.get("/arize_phoenix_version")
async def version() -> PlainTextResponse:
    return PlainTextResponse(f"{phoenix_version}")


def _db(
    engine: AsyncEngine,
) -> Callable[[Optional[asyncio.Lock]], AbstractAsyncContextManager[AsyncSession]]:
    Session = async_sessionmaker(engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory(lock: Optional[asyncio.Lock] = None) -> AsyncIterator[AsyncSession]:
        async with contextlib.AsyncExitStack() as stack:
            if lock:
                await stack.enter_async_context(lock)
            yield await stack.enter_async_context(Session.begin())

    return factory


@dataclass(frozen=True)
class ScaffolderConfig:
    db: DbSessionFactory
    tracing_fixture_names: Iterable[str] = field(default_factory=list)
    force_fixture_ingestion: bool = False
    scaffold_datasets: bool = False
    phoenix_url: str = f"http://{get_env_host()}:{get_env_port()}"


class Scaffolder(DaemonTask):
    def __init__(
        self,
        config: ScaffolderConfig,
        queue_span: Callable[[Span, ProjectName], Awaitable[None]],
        queue_evaluation: Callable[[pb.Evaluation], Awaitable[None]],
    ) -> None:
        super().__init__()
        self._db = config.db
        self._queue_span = queue_span
        self._queue_evaluation = queue_evaluation
        self._tracing_fixtures = [
            get_trace_fixture_by_name(name) for name in set(config.tracing_fixture_names)
        ]
        self._force_fixture_ingestion = config.force_fixture_ingestion
        self._scaffold_datasets = config.scaffold_datasets
        self._phoenix_url = config.phoenix_url

    async def __aenter__(self) -> None:
        if not self._tracing_fixtures:
            return
        await self.start()

    async def _run(self) -> None:
        """
        Main entry point for Scaffolder.
        Determines whether to load fixtures and handles them.
        """
        if await self._should_load_fixtures():
            logger.info("Loading trace fixtures...")
            await self._handle_tracing_fixtures()
            logger.info("Finished loading fixtures.")
        else:
            logger.info("DB is not new, avoid loading demo fixtures.")

    async def _should_load_fixtures(self) -> bool:
        if self._force_fixture_ingestion:
            return True

        async with self._db() as session:
            created_at = await session.scalar(
                select(models.Project.created_at).where(models.Project.name == "default")
            )
        if created_at is None:
            return False

        is_new_db = datetime.now(timezone.utc) - created_at < timedelta(
            minutes=NEW_DB_AGE_THRESHOLD_MINUTES
        )
        return is_new_db

    async def _handle_tracing_fixtures(self) -> None:
        """
        Main handler for processing trace fixtures. Process each fixture by
        loading its trace dataframe, gettting and processings its
        spans and evals, and queuing.
        """
        loop = asyncio.get_running_loop()
        for fixture in self._tracing_fixtures:
            try:
                trace_ds = await loop.run_in_executor(None, load_example_traces, fixture.name)

                fixture_spans, fixture_evals = await loop.run_in_executor(
                    None,
                    reset_fixture_span_ids_and_timestamps,
                    (
                        # Apply `encode` here because legacy jsonl files contains UUIDs as strings.
                        # `encode` removes the hyphens in the UUIDs.
                        decode_otlp_span(encode_span_to_otlp(span))
                        for span in trace_ds.to_spans()
                    ),
                    get_evals_from_fixture(fixture.name),
                )

                # Ingest dataset fixtures
                if self._scaffold_datasets:
                    await self._handle_dataset_fixtures(fixture)

                project_name = fixture.project_name or fixture.name
                logger.info(f"Loading '{project_name}' fixtures...")
                for span in fixture_spans:
                    await self._queue_span(span, project_name)
                for evaluation in fixture_evals:
                    await self._queue_evaluation(evaluation)

            except FileNotFoundError:
                logger.warning(f"Fixture file not found for '{fixture.name}'")
            except ValueError as e:
                logger.error(f"Error processing fixture '{fixture.name}': {e}")
            except Exception as e:
                logger.error(f"Unexpected error processing fixture '{fixture.name}': {e}")

    async def _handle_dataset_fixtures(self, fixture: TracesFixture) -> None:
        loop = asyncio.get_running_loop()
        try:
            dataset_fixtures = await loop.run_in_executor(None, get_dataset_fixtures, fixture.name)
            await loop.run_in_executor(
                None,
                send_dataset_fixtures,
                self._phoenix_url,
                dataset_fixtures,
            )
        except Exception as e:
            logger.error(f"Error processing dataset fixture: {e}")


def _lifespan(
    *,
    db: DbSessionFactory,
    bulk_inserter: BulkInserter,
    dml_event_handler: DmlEventHandler,
    trace_data_sweeper: Optional[TraceDataSweeper],
    span_cost_calculator: SpanCostCalculator,
    generative_model_store: GenerativeModelStore,
    db_disk_usage_monitor: DbDiskUsageMonitor,
    token_store: Optional[TokenStore] = None,
    tracer_provider: Optional["TracerProvider"] = None,
    enable_prometheus: bool = False,
    startup_callbacks: Iterable[_Callback] = (),
    shutdown_callbacks: Iterable[_Callback] = (),
    read_only: bool = False,
    scaffolder_config: Optional[ScaffolderConfig] = None,
    grpc_interceptors: Iterable[AsyncServerInterceptor] = (),
) -> StatefulLifespan[FastAPI]:
    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[dict[str, Any]]:
        for callback in startup_callbacks:
            if isinstance((res := callback()), Awaitable):
                await res
        db.lock = asyncio.Lock() if db.dialect is SupportedSQLDialect.SQLITE else None
        async with AsyncExitStack() as stack:
            (
                enqueue,
                queue_span,
                queue_evaluation,
                enqueue_operation,
            ) = await stack.enter_async_context(bulk_inserter)
            grpc_server = GrpcServer(
                queue_span,
                disabled=read_only,
                tracer_provider=tracer_provider,
                enable_prometheus=enable_prometheus,
                token_store=token_store,
                interceptors=user_grpc_interceptors() + list(grpc_interceptors),
            )
            await stack.enter_async_context(grpc_server)
            await stack.enter_async_context(dml_event_handler)
            if trace_data_sweeper:
                await stack.enter_async_context(trace_data_sweeper)
            await stack.enter_async_context(span_cost_calculator)
            await stack.enter_async_context(generative_model_store)
            await stack.enter_async_context(db_disk_usage_monitor)
            if scaffolder_config:
                scaffolder = Scaffolder(
                    config=scaffolder_config,
                    queue_span=queue_span,
                    queue_evaluation=queue_evaluation,
                )
                await stack.enter_async_context(scaffolder)
            if isinstance(token_store, AbstractAsyncContextManager):
                await stack.enter_async_context(token_store)
            yield {
                "event_queue": dml_event_handler,
                "enqueue": enqueue,
                "queue_span_for_bulk_insert": queue_span,
                "queue_evaluation_for_bulk_insert": queue_evaluation,
                "enqueue_operation": enqueue_operation,
            }
        for callback in shutdown_callbacks:
            if isinstance((res := callback()), Awaitable):
                await res

    return lifespan


@router.get("/healthz")
async def check_healthz(_: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")


@router.get("/readyz")
async def check_readyz(request: Request) -> JSONResponse:
    try:
        async with request.app.state.db() as session:
            await session.execute(select(1))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(status_code=503, detail="database unreachable")
    return JSONResponse({})


def create_graphql_router(
    *,
    graphql_schema: strawberry.Schema,
    db: DbSessionFactory,
    model: Model,
    export_path: Path,
    last_updated_at: CanGetLastUpdatedAt,
    authentication_enabled: bool,
    span_cost_calculator: SpanCostCalculator,
    corpus: Optional[Model] = None,
    cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
    event_queue: CanPutItem[DmlEvent],
    read_only: bool = False,
    secret: Optional[Secret] = None,
    token_store: Optional[TokenStore] = None,
    email_sender: Optional[EmailSender] = None,
) -> GraphQLRouter[Context, None]:
    """Creates the GraphQL router.

    Args:
        schema (BaseSchema): The GraphQL schema.
        db (DbSessionFactory): The database session factory pointing to a SQL database.
        model (Model): The Model representing inferences (legacy)
        export_path (Path): the file path to export data to for download (legacy)
        last_updated_at (CanGetLastUpdatedAt): How to get the last updated timestamp for updates.
        authentication_enabled (bool): Whether authentication is enabled.
        span_cost_calculator (SpanCostCalculator): The span cost calculator for calculating costs.
        event_queue (CanPutItem[DmlEvent]): The event queue for DML events.
        corpus (Optional[Model], optional): the corpus for UMAP projection. Defaults to None.
        cache_for_dataloaders (Optional[CacheForDataLoaders], optional): GraphQL data loaders.
        read_only (bool, optional): Marks the app as read-only. Defaults to False.
        secret (Optional[Secret], optional): The application secret for auth. Defaults to None.
        token_store (Optional[TokenStore], optional): The token store for auth. Defaults to None.
        email_sender (Optional[EmailSender], optional): The email sender. Defaults to None.

    Returns:
        GraphQLRouter: The router mounted at /graphql
    """

    def get_context() -> Context:
        return Context(
            db=db,
            model=model,
            corpus=corpus,
            export_path=export_path,
            last_updated_at=last_updated_at,
            event_queue=event_queue,
            data_loaders=DataLoaders(
                annotation_configs_by_project=AnnotationConfigsByProjectDataLoader(db),
                average_experiment_run_latency=AverageExperimentRunLatencyDataLoader(db),
                dataset_example_revisions=DatasetExampleRevisionsDataLoader(db),
                dataset_example_spans=DatasetExampleSpansDataLoader(db),
                document_evaluation_summaries=DocumentEvaluationSummaryDataLoader(
                    db,
                    cache_map=(
                        cache_for_dataloaders.document_evaluation_summary
                        if cache_for_dataloaders
                        else None
                    ),
                ),
                document_evaluations=DocumentEvaluationsDataLoader(db),
                document_retrieval_metrics=DocumentRetrievalMetricsDataLoader(db),
                annotation_summaries=AnnotationSummaryDataLoader(
                    db,
                    cache_map=(
                        cache_for_dataloaders.annotation_summary if cache_for_dataloaders else None
                    ),
                ),
                experiment_annotation_summaries=ExperimentAnnotationSummaryDataLoader(db),
                experiment_error_rates=ExperimentErrorRatesDataLoader(db),
                experiment_run_annotations=ExperimentRunAnnotations(db),
                experiment_run_counts=ExperimentRunCountsDataLoader(db),
                experiment_sequence_number=ExperimentSequenceNumberDataLoader(db),
                last_used_times_by_generative_model_id=LastUsedTimesByGenerativeModelIdDataLoader(
                    db
                ),
                latency_ms_quantile=LatencyMsQuantileDataLoader(
                    db,
                    cache_map=(
                        cache_for_dataloaders.latency_ms_quantile if cache_for_dataloaders else None
                    ),
                ),
                min_start_or_max_end_times=MinStartOrMaxEndTimeDataLoader(
                    db,
                    cache_map=(
                        cache_for_dataloaders.min_start_or_max_end_time
                        if cache_for_dataloaders
                        else None
                    ),
                ),
                num_child_spans=NumChildSpansDataLoader(db),
                num_spans_per_trace=NumSpansPerTraceDataLoader(db),
                project_fields=TableFieldsDataLoader(db, models.Project),
                projects_by_trace_retention_policy_id=ProjectIdsByTraceRetentionPolicyIdDataLoader(
                    db
                ),
                prompt_version_sequence_number=PromptVersionSequenceNumberDataLoader(db),
                record_counts=RecordCountDataLoader(
                    db,
                    cache_map=cache_for_dataloaders.record_count if cache_for_dataloaders else None,
                ),
                session_first_inputs=SessionIODataLoader(db, "first_input"),
                session_last_outputs=SessionIODataLoader(db, "last_output"),
                session_num_traces=SessionNumTracesDataLoader(db),
                session_num_traces_with_error=SessionNumTracesWithErrorDataLoader(db),
                session_token_usages=SessionTokenUsagesDataLoader(db),
                session_trace_latency_ms_quantile=SessionTraceLatencyMsQuantileDataLoader(db),
                span_annotations=SpanAnnotationsDataLoader(db),
                span_fields=TableFieldsDataLoader(db, models.Span),
                span_by_id=SpanByIdDataLoader(db),
                span_cost_by_span=SpanCostBySpanDataLoader(db),
                span_cost_detail_summary_entries_by_generative_model=SpanCostDetailSummaryEntriesByGenerativeModelDataLoader(
                    db
                ),
                span_cost_detail_summary_entries_by_project_session=SpanCostDetailSummaryEntriesByProjectSessionDataLoader(
                    db
                ),
                span_cost_detail_summary_entries_by_span=SpanCostDetailSummaryEntriesBySpanDataLoader(
                    db
                ),
                span_cost_detail_summary_entries_by_trace=SpanCostDetailSummaryEntriesByTraceDataLoader(
                    db
                ),
                span_cost_details_by_span_cost=SpanCostDetailsBySpanCostDataLoader(db),
                span_cost_detail_fields=TableFieldsDataLoader(db, models.SpanCostDetail),
                span_cost_fields=TableFieldsDataLoader(db, models.SpanCost),
                span_cost_summary_by_generative_model=SpanCostSummaryByGenerativeModelDataLoader(
                    db
                ),
                span_cost_summary_by_project=SpanCostSummaryByProjectDataLoader(
                    db,
                    cache_map=cache_for_dataloaders.token_cost if cache_for_dataloaders else None,
                ),
                span_cost_summary_by_project_session=SpanCostSummaryByProjectSessionDataLoader(db),
                span_cost_summary_by_trace=SpanCostSummaryByTraceDataLoader(db),
                span_dataset_examples=SpanDatasetExamplesDataLoader(db),
                span_descendants=SpanDescendantsDataLoader(db),
                span_projects=SpanProjectsDataLoader(db),
                token_counts=TokenCountDataLoader(
                    db,
                    cache_map=cache_for_dataloaders.token_count if cache_for_dataloaders else None,
                ),
                trace_by_trace_ids=TraceByTraceIdsDataLoader(db),
                trace_fields=TableFieldsDataLoader(db, models.Trace),
                trace_retention_policy_id_by_project_id=TraceRetentionPolicyIdByProjectIdDataLoader(
                    db
                ),
                project_trace_retention_policy_fields=TableFieldsDataLoader(
                    db, models.ProjectTraceRetentionPolicy
                ),
                trace_root_spans=TraceRootSpansDataLoader(db),
                project_by_name=ProjectByNameDataLoader(db),
                users=UsersDataLoader(db),
                user_roles=UserRolesDataLoader(db),
                span_cost_summary_by_experiment=SpanCostSummaryByExperimentDataLoader(db),
                span_cost_summary_by_experiment_run=SpanCostSummaryByExperimentRunDataLoader(db),
            ),
            cache_for_dataloaders=cache_for_dataloaders,
            read_only=read_only,
            auth_enabled=authentication_enabled,
            secret=secret,
            token_store=token_store,
            email_sender=email_sender,
            span_cost_calculator=span_cost_calculator,
        )

    return GraphQLRouter(
        graphql_schema,
        graphql_ide="graphiql",
        context_getter=get_context,
        include_in_schema=False,
        prefix="/graphql",
        dependencies=(Depends(is_authenticated),) if authentication_enabled else (),
        subscription_protocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL],
    )


def create_engine_and_run_migrations(
    database_url: str,
) -> AsyncEngine:
    try:
        return create_engine(
            connection_str=database_url,
            migrate=not Settings.disable_migrations,
            log_to_stdout=False,
        )
    except PhoenixMigrationError as e:
        msg = (
            "\n\n⚠️⚠️ Phoenix failed to migrate the database to the latest version. ⚠️⚠️\n\n"
            "The database may be in a dirty state. To resolve this, the Alembic CLI can be used\n"
            "from the `src/phoenix/db` directory inside the Phoenix project root. From here,\n"
            "revert any partial migrations and run `alembic stamp` to reset the migration state,\n"
            "then try starting Phoenix again.\n\n"
            "If issues persist, please reach out for support in the Arize community Slack:\n"
            "https://arize-ai.slack.com\n\n"
            "You can also refer to the Alembic documentation for more information:\n"
            "https://alembic.sqlalchemy.org/en/latest/tutorial.html\n\n"
            ""
        )
        raise PhoenixMigrationError(msg) from e


def instrument_engine_if_enabled(engine: AsyncEngine) -> list[Callable[[], None]]:
    instrumentation_cleanups = []
    if server_instrumentation_is_enabled():
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        tracer_provider = initialize_opentelemetry_tracer_provider()
        SQLAlchemyInstrumentor().instrument(
            engine=engine.sync_engine,
            tracer_provider=tracer_provider,
        )
        instrumentation_cleanups.append(SQLAlchemyInstrumentor().uninstrument)
    return instrumentation_cleanups


async def plain_text_http_exception_handler(request: Request, exc: HTTPException) -> Response:
    """
    Overrides the default handler for HTTPExceptions to return a plain text
    response instead of a JSON response. For the original source code, see
    https://github.com/tiangolo/fastapi/blob/d3cdd3bbd14109f3b268df7ca496e24bb64593aa/fastapi/exception_handlers.py#L11
    """
    headers = getattr(exc, "headers", None)
    if not is_body_allowed_for_status_code(exc.status_code):
        return Response(status_code=exc.status_code, headers=headers)
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code, headers=headers)


class _HasDbStatus(Protocol):
    @property
    def should_not_insert_or_update(self) -> bool: ...


class DbDiskUsageInterceptor(AsyncServerInterceptor):
    def __init__(self, db: _HasDbStatus) -> None:
        self._db = db

    @override
    async def intercept(
        self,
        method: Callable[[Any, grpc.aio.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        if (
            method_name.endswith("trace.v1.TraceService/Export")
            and self._db.should_not_insert_or_update
        ):
            await context.abort(
                grpc.StatusCode.RESOURCE_EXHAUSTED,
                "Database disk usage threshold exceeded",
            )
        return await method(request_or_iterator, context)


def create_app(
    db: DbSessionFactory,
    export_path: Path,
    model: Model,
    authentication_enabled: bool,
    umap_params: UMAPParameters,
    corpus: Optional[Model] = None,
    debug: bool = False,
    dev: bool = False,
    read_only: bool = False,
    enable_prometheus: bool = False,
    initial_spans: Optional[Iterable[Union[Span, tuple[Span, str]]]] = None,
    initial_evaluations: Optional[Iterable[pb.Evaluation]] = None,
    serve_ui: bool = True,
    startup_callbacks: Iterable[_Callback] = (),
    shutdown_callbacks: Iterable[_Callback] = (),
    secret: Optional[Secret] = None,
    password_reset_token_expiry: Optional[timedelta] = None,
    access_token_expiry: Optional[timedelta] = None,
    refresh_token_expiry: Optional[timedelta] = None,
    scaffolder_config: Optional[ScaffolderConfig] = None,
    email_sender: Optional[EmailSender] = None,
    oauth2_client_configs: Optional[list[OAuth2ClientConfig]] = None,
    basic_auth_disabled: bool = False,
    bulk_inserter_factory: Optional[Callable[..., BulkInserter]] = None,
    allowed_origins: Optional[list[str]] = None,
    management_url: Optional[str] = None,
) -> FastAPI:
    verify_server_environment_variables()
    if model.embedding_dimensions:
        try:
            import fast_hdbscan  # noqa: F401
            import umap  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "To visualize embeddings, please install `umap-learn` and `fast-hdbscan` "
                "via `pip install arize-phoenix[embeddings]`"
            ) from exc
    logger.info(f"Server umap params: {umap_params}")
    bulk_inserter_factory = bulk_inserter_factory or BulkInserter
    startup_callbacks_list: list[_Callback] = list(startup_callbacks)
    shutdown_callbacks_list: list[_Callback] = list(shutdown_callbacks)
    startup_callbacks_list.append(Facilitator(db=db))
    initial_batch_of_spans: Iterable[tuple[Span, str]] = (
        ()
        if initial_spans is None
        else (
            ((item, DEFAULT_PROJECT_NAME) if isinstance(item, Span) else item)
            for item in initial_spans
        )
    )
    initial_batch_of_evaluations = () if initial_evaluations is None else initial_evaluations
    cache_for_dataloaders = (
        CacheForDataLoaders() if db.dialect is SupportedSQLDialect.SQLITE else None
    )
    last_updated_at = LastUpdatedAt()
    middlewares: list[Middleware] = [Middleware(HeadersMiddleware)]
    middlewares.extend(user_fastapi_middlewares())
    if origins := get_env_csrf_trusted_origins():
        trusted_hostnames = [h for o in origins if o and (h := urlparse(o).hostname)]
        middlewares.append(
            Middleware(
                RequestOriginHostnameValidator,
                trusted_hostnames=trusted_hostnames,
            )
        )
    elif email_sender or oauth2_client_configs:
        logger.warning(
            "CSRF protection can be enabled by listing trusted origins via "
            f"the `{ENV_PHOENIX_CSRF_TRUSTED_ORIGINS}` environment variable. "
            "This is recommended when setting up OAuth2 clients or sending "
            "password reset emails."
        )
    if authentication_enabled and secret:
        token_store = JwtStore(db, secret)
        middlewares.append(
            Middleware(
                AuthenticationMiddleware,
                backend=BearerTokenAuthBackend(token_store),
            )
        )
    else:
        token_store = None
    dml_event_handler = DmlEventHandler(
        db=db,
        cache_for_dataloaders=cache_for_dataloaders,
        last_updated_at=last_updated_at,
    )
    trace_data_sweeper = TraceDataSweeper(
        db=db,
        dml_event_handler=dml_event_handler,
    )
    generative_model_store = GenerativeModelStore(db)
    span_cost_calculator = SpanCostCalculator(db, generative_model_store)
    bulk_inserter = bulk_inserter_factory(
        db,
        enable_prometheus=enable_prometheus,
        span_cost_calculator=span_cost_calculator,
        event_queue=dml_event_handler,
        initial_batch_of_spans=initial_batch_of_spans,
        initial_batch_of_evaluations=initial_batch_of_evaluations,
    )
    tracer_provider = None
    graphql_schema_extensions: list[Union[type[SchemaExtension], SchemaExtension]] = []
    graphql_schema_extensions.extend(user_gql_extensions())

    if server_instrumentation_is_enabled():
        tracer_provider = initialize_opentelemetry_tracer_provider()
        from opentelemetry.trace import TracerProvider
        from strawberry.extensions.tracing import OpenTelemetryExtension

        if TYPE_CHECKING:
            # Type-check the class before monkey-patching its private attribute.
            assert OpenTelemetryExtension._tracer

        class _OpenTelemetryExtension(OpenTelemetryExtension):
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                super().__init__(*args, **kwargs)
                # Monkey-patch its private tracer to eliminate usage of the global
                # TracerProvider, which in a notebook setting could be the one
                # used by OpenInference.
                self._tracer = cast(TracerProvider, tracer_provider).get_tracer("strawberry")

        graphql_schema_extensions.append(_OpenTelemetryExtension)

    graphql_router = create_graphql_router(
        db=db,
        graphql_schema=build_graphql_schema(graphql_schema_extensions),
        model=model,
        corpus=corpus,
        authentication_enabled=authentication_enabled,
        export_path=export_path,
        last_updated_at=last_updated_at,
        event_queue=dml_event_handler,
        cache_for_dataloaders=cache_for_dataloaders,
        read_only=read_only,
        secret=secret,
        token_store=token_store,
        email_sender=email_sender,
        span_cost_calculator=span_cost_calculator,
    )
    if enable_prometheus:
        from phoenix.server.prometheus import PrometheusMiddleware

        middlewares.append(Middleware(PrometheusMiddleware))
    grpc_interceptors: list[AsyncServerInterceptor] = []
    grpc_interceptors.append(DbDiskUsageInterceptor(db))
    app = FastAPI(
        title="Arize-Phoenix REST API",
        version=REST_API_VERSION,
        lifespan=_lifespan(
            db=db,
            read_only=read_only,
            bulk_inserter=bulk_inserter,
            dml_event_handler=dml_event_handler,
            trace_data_sweeper=trace_data_sweeper,
            span_cost_calculator=span_cost_calculator,
            generative_model_store=generative_model_store,
            db_disk_usage_monitor=DbDiskUsageMonitor(db, email_sender),
            grpc_interceptors=grpc_interceptors,
            token_store=token_store,
            tracer_provider=tracer_provider,
            enable_prometheus=enable_prometheus,
            shutdown_callbacks=shutdown_callbacks_list,
            startup_callbacks=startup_callbacks_list,
            scaffolder_config=scaffolder_config,
        ),
        middleware=middlewares,
        exception_handlers={
            HTTPException: plain_text_http_exception_handler,
        },
        debug=debug,
        swagger_ui_parameters={
            "defaultModelsExpandDepth": -1,  # hides the schema section in the Swagger UI
        },
    )
    app.include_router(create_v1_router(authentication_enabled))
    app.include_router(create_embeddings_router(authentication_enabled))
    app.include_router(router)
    app.include_router(graphql_router)
    if authentication_enabled:
        app.include_router(auth_router)
        app.include_router(oauth2_router)
    app.add_middleware(GZipMiddleware)
    web_manifest_path = SERVER_DIR / "static" / ".vite" / "manifest.json"
    if serve_ui and web_manifest_path.is_file():
        oauth2_idps = [
            OAuth2Idp(name=config.idp_name, displayName=config.idp_display_name)
            for config in oauth2_client_configs or []
        ]
        auto_login_idp_name = next(
            (config.idp_name for config in (oauth2_client_configs or []) if config.auto_login), None
        )
        app.mount(
            "/",
            app=Static(
                directory=SERVER_DIR / "static",
                app_config=AppConfig(
                    has_inferences=model.is_empty is not True,
                    has_corpus=corpus is not None,
                    min_dist=umap_params.min_dist,
                    n_neighbors=umap_params.n_neighbors,
                    n_samples=umap_params.n_samples,
                    is_development=dev,
                    authentication_enabled=authentication_enabled,
                    web_manifest_path=web_manifest_path,
                    oauth2_idps=oauth2_idps,
                    basic_auth_disabled=basic_auth_disabled,
                    auto_login_idp_name=auto_login_idp_name,
                    fullstory_org=Settings.fullstory_org,
                    management_url=management_url,
                ),
            ),
            name="static",
        )
    app.state.authentication_enabled = authentication_enabled
    app.state.read_only = read_only
    app.state.export_path = export_path
    app.state.password_reset_token_expiry = password_reset_token_expiry
    app.state.access_token_expiry = access_token_expiry
    app.state.refresh_token_expiry = refresh_token_expiry
    app.state.oauth2_clients = OAuth2Clients.from_configs(oauth2_client_configs or [])
    app.state.db = db
    app.state.email_sender = email_sender
    app.state.span_cost_calculator = span_cost_calculator
    app = _add_get_secret_method(app=app, secret=secret)
    app = _add_get_token_store_method(app=app, token_store=token_store)
    if tracer_provider:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor().instrument(tracer_provider=tracer_provider)
        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        shutdown_callbacks_list.append(FastAPIInstrumentor().uninstrument)
    if allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    return app


def _add_get_secret_method(*, app: FastAPI, secret: Optional[Secret]) -> FastAPI:
    """
    Dynamically adds a `get_secret` method to the app's `state`.
    """
    app.state._secret = secret

    def get_secret(self: StarletteState) -> Secret:
        if (secret := self._secret) is None:
            raise ValueError("app secret is not set")
        assert isinstance(secret, Secret)
        return secret

    app.state.get_secret = MethodType(get_secret, app.state)
    return app


def _add_get_token_store_method(*, app: FastAPI, token_store: Optional[JwtStore]) -> FastAPI:
    """
    Dynamically adds a `get_token_store` method to the app's `state`.
    """
    app.state._token_store = token_store

    def get_token_store(self: StarletteState) -> JwtStore:
        if (token_store := self._token_store) is None:
            raise ValueError("token store is not set on the app")
        assert isinstance(token_store, JwtStore)
        return token_store

    app.state.get_token_store = MethodType(get_token_store, app.state)
    return app
