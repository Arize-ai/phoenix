import contextlib
import logging
from datetime import datetime
from pathlib import Path
from typing import (
    TYPE_CHECKING,
    Any,
    AsyncContextManager,
    AsyncIterator,
    Callable,
    Dict,
    Iterable,
    List,
    NamedTuple,
    Optional,
    Tuple,
    Union,
    cast,
)

import strawberry
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)
from starlette.applications import Starlette
from starlette.datastructures import QueryParams
from starlette.endpoints import HTTPEndpoint
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import FileResponse, PlainTextResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from starlette.types import Scope, StatefulLifespan
from starlette.websockets import WebSocket
from strawberry.asgi import GraphQL
from strawberry.schema import BaseSchema
from typing_extensions import TypeAlias

import phoenix
import phoenix.trace.v1 as pb
from phoenix.config import (
    DEFAULT_PROJECT_NAME,
    SERVER_DIR,
    server_instrumentation_is_enabled,
)
from phoenix.core.model_schema import Model
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import create_engine
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.exceptions import PhoenixMigrationError
from phoenix.pointcloud.umap_parameters import UMAPParameters
from phoenix.server.api.context import Context, DataLoaders
from phoenix.server.api.dataloaders import (
    AverageExperimentRunLatencyDataLoader,
    CacheForDataLoaders,
    DatasetExampleRevisionsDataLoader,
    DatasetExampleSpansDataLoader,
    DocumentEvaluationsDataLoader,
    DocumentEvaluationSummaryDataLoader,
    DocumentRetrievalMetricsDataLoader,
    EvaluationSummaryDataLoader,
    ExperimentAnnotationSummaryDataLoader,
    ExperimentErrorRatesDataLoader,
    ExperimentRunCountsDataLoader,
    ExperimentSequenceNumberDataLoader,
    LatencyMsQuantileDataLoader,
    MinStartOrMaxEndTimeDataLoader,
    ProjectByNameDataLoader,
    RecordCountDataLoader,
    SpanDescendantsDataLoader,
    SpanEvaluationsDataLoader,
    SpanProjectsDataLoader,
    TokenCountDataLoader,
    TraceEvaluationsDataLoader,
    TraceRowIdsDataLoader,
)
from phoenix.server.api.openapi.schema import OPENAPI_SCHEMA_GENERATOR
from phoenix.server.api.routers.v1 import V1_ROUTES
from phoenix.server.api.schema import schema
from phoenix.server.grpc_server import GrpcServer
from phoenix.server.openapi.docs import get_swagger_ui_html
from phoenix.server.telemetry import initialize_opentelemetry_tracer_provider
from phoenix.trace.schemas import Span

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory=SERVER_DIR / "templates")


class AppConfig(NamedTuple):
    has_inferences: bool
    """ Whether the model has inferences (e.g. a primary dataset) """
    has_corpus: bool
    min_dist: float
    n_neighbors: int
    n_samples: int


class Static(StaticFiles):
    "Static file serving with a fallback to index.html"

    _app_config: AppConfig

    def __init__(self, *, app_config: AppConfig, **kwargs: Any):
        self._app_config = app_config
        super().__init__(**kwargs)

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = None
        try:
            response = await super().get_response(path, scope)
        except HTTPException as e:
            if e.status_code != 404:
                raise e
            # Fallback to to the index.html
            request = Request(scope)

            response = templates.TemplateResponse(
                "index.html",
                context={
                    "has_inferences": self._app_config.has_inferences,
                    "has_corpus": self._app_config.has_corpus,
                    "min_dist": self._app_config.min_dist,
                    "n_neighbors": self._app_config.n_neighbors,
                    "n_samples": self._app_config.n_samples,
                    "basename": request.scope.get("root_path", ""),
                    "platform_version": phoenix.__version__,
                    "request": request,
                },
            )
        except Exception as e:
            raise e
        return response


class HeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)
        response.headers["x-colab-notebook-cache-control"] = "no-cache"
        response.headers["Cache-Control"] = "no-store"
        return response


ProjectRowId: TypeAlias = int


class GraphQLWithContext(GraphQL):  # type: ignore
    def __init__(
        self,
        schema: BaseSchema,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        model: Model,
        export_path: Path,
        graphiql: bool = False,
        corpus: Optional[Model] = None,
        streaming_last_updated_at: Callable[[ProjectRowId], Optional[datetime]] = lambda _: None,
        cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
        read_only: bool = False,
    ) -> None:
        self.db = db
        self.model = model
        self.corpus = corpus
        self.export_path = export_path
        self.streaming_last_updated_at = streaming_last_updated_at
        self.cache_for_dataloaders = cache_for_dataloaders
        self.read_only = read_only
        super().__init__(schema, graphiql=graphiql)

    async def get_context(
        self,
        request: Union[Request, WebSocket],
        response: Optional[Response] = None,
    ) -> Context:
        return Context(
            request=request,
            response=response,
            db=self.db,
            model=self.model,
            corpus=self.corpus,
            export_path=self.export_path,
            streaming_last_updated_at=self.streaming_last_updated_at,
            data_loaders=DataLoaders(
                average_experiment_run_latency=AverageExperimentRunLatencyDataLoader(self.db),
                dataset_example_revisions=DatasetExampleRevisionsDataLoader(self.db),
                dataset_example_spans=DatasetExampleSpansDataLoader(self.db),
                document_evaluation_summaries=DocumentEvaluationSummaryDataLoader(
                    self.db,
                    cache_map=self.cache_for_dataloaders.document_evaluation_summary
                    if self.cache_for_dataloaders
                    else None,
                ),
                document_evaluations=DocumentEvaluationsDataLoader(self.db),
                document_retrieval_metrics=DocumentRetrievalMetricsDataLoader(self.db),
                evaluation_summaries=EvaluationSummaryDataLoader(
                    self.db,
                    cache_map=self.cache_for_dataloaders.evaluation_summary
                    if self.cache_for_dataloaders
                    else None,
                ),
                experiment_annotation_summaries=ExperimentAnnotationSummaryDataLoader(self.db),
                experiment_error_rates=ExperimentErrorRatesDataLoader(self.db),
                experiment_run_counts=ExperimentRunCountsDataLoader(self.db),
                experiment_sequence_number=ExperimentSequenceNumberDataLoader(self.db),
                latency_ms_quantile=LatencyMsQuantileDataLoader(
                    self.db,
                    cache_map=self.cache_for_dataloaders.latency_ms_quantile
                    if self.cache_for_dataloaders
                    else None,
                ),
                min_start_or_max_end_times=MinStartOrMaxEndTimeDataLoader(
                    self.db,
                    cache_map=self.cache_for_dataloaders.min_start_or_max_end_time
                    if self.cache_for_dataloaders
                    else None,
                ),
                record_counts=RecordCountDataLoader(
                    self.db,
                    cache_map=self.cache_for_dataloaders.record_count
                    if self.cache_for_dataloaders
                    else None,
                ),
                span_descendants=SpanDescendantsDataLoader(self.db),
                span_evaluations=SpanEvaluationsDataLoader(self.db),
                span_projects=SpanProjectsDataLoader(self.db),
                token_counts=TokenCountDataLoader(
                    self.db,
                    cache_map=self.cache_for_dataloaders.token_count
                    if self.cache_for_dataloaders
                    else None,
                ),
                trace_evaluations=TraceEvaluationsDataLoader(self.db),
                trace_row_ids=TraceRowIdsDataLoader(self.db),
                project_by_name=ProjectByNameDataLoader(self.db),
            ),
            cache_for_dataloaders=self.cache_for_dataloaders,
            read_only=self.read_only,
        )


class Download(HTTPEndpoint):
    path: Path

    async def get(self, request: Request) -> FileResponse:
        params = QueryParams(request.query_params)
        file = self.path / (params.get("filename", "") + ".parquet")
        if not file.is_file():
            raise HTTPException(status_code=404)
        return FileResponse(
            path=file,
            filename=file.name,
            media_type="application/x-octet-stream",
        )


async def version(_: Request) -> PlainTextResponse:
    return PlainTextResponse(f"{phoenix.__version__}")


def _db(engine: AsyncEngine) -> Callable[[], AsyncContextManager[AsyncSession]]:
    Session = async_sessionmaker(engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        async with Session.begin() as session:
            yield session

    return factory


def _lifespan(
    *,
    bulk_inserter: BulkInserter,
    tracer_provider: Optional["TracerProvider"] = None,
    enable_prometheus: bool = False,
    clean_ups: Iterable[Callable[[], None]] = (),
    read_only: bool = False,
) -> StatefulLifespan[Starlette]:
    @contextlib.asynccontextmanager
    async def lifespan(_: Starlette) -> AsyncIterator[Dict[str, Any]]:
        async with bulk_inserter as (
            queue_span,
            queue_evaluation,
            enqueue_operation,
        ), GrpcServer(
            queue_span,
            disabled=read_only,
            tracer_provider=tracer_provider,
            enable_prometheus=enable_prometheus,
        ):
            yield {
                "queue_span_for_bulk_insert": queue_span,
                "queue_evaluation_for_bulk_insert": queue_evaluation,
                "enqueue_operation": enqueue_operation,
            }
        for clean_up in clean_ups:
            clean_up()

    return lifespan


async def check_healthz(_: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")


async def openapi_schema(request: Request) -> Response:
    return OPENAPI_SCHEMA_GENERATOR.OpenAPIResponse(request=request)


async def api_docs(request: Request) -> Response:
    return get_swagger_ui_html(openapi_url="/schema", title="arize-phoenix API")


class SessionFactory:
    def __init__(
        self,
        session_factory: Callable[[], AsyncContextManager[AsyncSession]],
        dialect: str,
    ):
        self.session_factory = session_factory
        self.dialect = SupportedSQLDialect(dialect)

    def __call__(self) -> AsyncContextManager[AsyncSession]:
        return self.session_factory()


def create_engine_and_run_migrations(
    database_url: str,
) -> AsyncEngine:
    try:
        return create_engine(database_url)
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


def instrument_engine_if_enabled(engine: AsyncEngine) -> List[Callable[[], None]]:
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


def create_app(
    db: SessionFactory,
    export_path: Path,
    model: Model,
    umap_params: UMAPParameters,
    corpus: Optional[Model] = None,
    debug: bool = False,
    read_only: bool = False,
    enable_prometheus: bool = False,
    initial_spans: Optional[Iterable[Union[Span, Tuple[Span, str]]]] = None,
    initial_evaluations: Optional[Iterable[pb.Evaluation]] = None,
    serve_ui: bool = True,
    clean_up_callbacks: List[Callable[[], None]] = [],
) -> Starlette:
    clean_ups: List[Callable[[], None]] = clean_up_callbacks  # To be called at app shutdown.
    initial_batch_of_spans: Iterable[Tuple[Span, str]] = (
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

    bulk_inserter = BulkInserter(
        db,
        enable_prometheus=enable_prometheus,
        cache_for_dataloaders=cache_for_dataloaders,
        initial_batch_of_spans=initial_batch_of_spans,
        initial_batch_of_evaluations=initial_batch_of_evaluations,
    )
    tracer_provider = None
    strawberry_extensions = schema.get_extensions()
    if server_instrumentation_is_enabled():
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

        strawberry_extensions.append(_OpenTelemetryExtension)

    graphql = GraphQLWithContext(
        db=db,
        schema=strawberry.Schema(
            query=schema.query,
            mutation=schema.mutation,
            subscription=schema.subscription,
            extensions=strawberry_extensions,
        ),
        model=model,
        corpus=corpus,
        export_path=export_path,
        graphiql=True,
        streaming_last_updated_at=bulk_inserter.last_updated_at,
        cache_for_dataloaders=cache_for_dataloaders,
        read_only=read_only,
    )
    if enable_prometheus:
        from phoenix.server.prometheus import PrometheusMiddleware

        prometheus_middlewares = [Middleware(PrometheusMiddleware)]
    else:
        prometheus_middlewares = []
    app = Starlette(
        lifespan=_lifespan(
            read_only=read_only,
            bulk_inserter=bulk_inserter,
            tracer_provider=tracer_provider,
            enable_prometheus=enable_prometheus,
            clean_ups=clean_ups,
        ),
        middleware=[
            Middleware(HeadersMiddleware),
            *prometheus_middlewares,
        ],
        debug=debug,
        routes=V1_ROUTES
        + [
            Route("/schema", endpoint=openapi_schema, include_in_schema=False),
            Route("/arize_phoenix_version", version),
            Route("/healthz", check_healthz),
            Route(
                "/exports",
                type(
                    "DownloadExports",
                    (Download,),
                    {"path": export_path},
                ),
            ),
            Route(
                "/docs",
                api_docs,
            ),
            Route(
                "/graphql",
                graphql,
            ),
        ]
        + (
            [
                Mount(
                    "/",
                    app=Static(
                        directory=SERVER_DIR / "static",
                        app_config=AppConfig(
                            has_inferences=model.is_empty is not True,
                            has_corpus=corpus is not None,
                            min_dist=umap_params.min_dist,
                            n_neighbors=umap_params.n_neighbors,
                            n_samples=umap_params.n_samples,
                        ),
                    ),
                    name="static",
                ),
            ]
            if serve_ui
            else []
        ),
    )
    app.state.read_only = read_only
    app.state.db = db
    if tracer_provider:
        from opentelemetry.instrumentation.starlette import StarletteInstrumentor

        StarletteInstrumentor().instrument(tracer_provider=tracer_provider)
        StarletteInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        clean_ups.append(StarletteInstrumentor().uninstrument)
    return app
