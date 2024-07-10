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

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from starlette.types import Scope, StatefulLifespan
from strawberry.fastapi import GraphQLRouter
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
from phoenix.server.api.routers.v1 import router as v1_router
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
) -> StatefulLifespan[FastAPI]:
    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[Dict[str, Any]]:
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


def create_graphql_router(
    schema: BaseSchema,
    db: Callable[[], AsyncContextManager[AsyncSession]],
    model: Model,
    export_path: Path,
    corpus: Optional[Model] = None,
    streaming_last_updated_at: Callable[[ProjectRowId], Optional[datetime]] = lambda _: None,
    cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
    read_only: bool = False,
) -> GraphQLRouter:  # type: ignore[type-arg]
    context = Context(
        db=db,
        model=model,
        corpus=corpus,
        export_path=export_path,
        streaming_last_updated_at=streaming_last_updated_at,
        data_loaders=DataLoaders(
            average_experiment_run_latency=AverageExperimentRunLatencyDataLoader(db),
            dataset_example_revisions=DatasetExampleRevisionsDataLoader(db),
            dataset_example_spans=DatasetExampleSpansDataLoader(db),
            document_evaluation_summaries=DocumentEvaluationSummaryDataLoader(
                db,
                cache_map=cache_for_dataloaders.document_evaluation_summary
                if cache_for_dataloaders
                else None,
            ),
            document_evaluations=DocumentEvaluationsDataLoader(db),
            document_retrieval_metrics=DocumentRetrievalMetricsDataLoader(db),
            evaluation_summaries=EvaluationSummaryDataLoader(
                db,
                cache_map=cache_for_dataloaders.evaluation_summary
                if cache_for_dataloaders
                else None,
            ),
            experiment_annotation_summaries=ExperimentAnnotationSummaryDataLoader(db),
            experiment_error_rates=ExperimentErrorRatesDataLoader(db),
            experiment_run_counts=ExperimentRunCountsDataLoader(db),
            experiment_sequence_number=ExperimentSequenceNumberDataLoader(db),
            latency_ms_quantile=LatencyMsQuantileDataLoader(
                db,
                cache_map=cache_for_dataloaders.latency_ms_quantile
                if cache_for_dataloaders
                else None,
            ),
            min_start_or_max_end_times=MinStartOrMaxEndTimeDataLoader(
                db,
                cache_map=cache_for_dataloaders.min_start_or_max_end_time
                if cache_for_dataloaders
                else None,
            ),
            record_counts=RecordCountDataLoader(
                db,
                cache_map=cache_for_dataloaders.record_count if cache_for_dataloaders else None,
            ),
            span_descendants=SpanDescendantsDataLoader(db),
            span_evaluations=SpanEvaluationsDataLoader(db),
            span_projects=SpanProjectsDataLoader(db),
            token_counts=TokenCountDataLoader(
                db,
                cache_map=cache_for_dataloaders.token_count if cache_for_dataloaders else None,
            ),
            trace_evaluations=TraceEvaluationsDataLoader(db),
            trace_row_ids=TraceRowIdsDataLoader(db),
            project_by_name=ProjectByNameDataLoader(db),
        ),
        cache_for_dataloaders=cache_for_dataloaders,
        read_only=read_only,
    )

    async def get_context() -> Context:
        return context

    return GraphQLRouter(schema, graphiql=True, context_getter=get_context)


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
) -> FastAPI:
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

    graphql_router = create_graphql_router(
        schema=schema,
        db=db,
        model=model,
        export_path=export_path,
        cache_for_dataloaders=cache_for_dataloaders,
        corpus=corpus,
        streaming_last_updated_at=bulk_inserter.last_updated_at,
        read_only=read_only,
    )
    if enable_prometheus:
        from phoenix.server.prometheus import PrometheusMiddleware

        prometheus_middlewares = [Middleware(PrometheusMiddleware)]
    else:
        prometheus_middlewares = []
    app = FastAPI(
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
    )
    app.state.read_only = read_only
    app.include_router(v1_router)
    app.add_api_route("/schema", openapi_schema, methods=["GET"], include_in_schema=False)
    app.add_api_route("/arize_phoenix_version", version, methods=["GET"])
    app.add_api_route("/healthz", check_healthz, methods=["GET"])
    app.add_api_route("/docs", api_docs, methods=["GET"])
    app.include_router(graphql_router, prefix="/graphql")
    if serve_ui:
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
                ),
            ),
            name="static",
        )

    app.state.db = db
    if tracer_provider:
        from opentelemetry.instrumentation.starlette import StarletteInstrumentor

        StarletteInstrumentor().instrument(tracer_provider=tracer_provider)
        StarletteInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        clean_ups.append(StarletteInstrumentor().uninstrument)
    return app
