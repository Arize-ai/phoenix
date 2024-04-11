import contextlib
import logging
from pathlib import Path
from typing import (
    Any,
    AsyncContextManager,
    AsyncIterator,
    Callable,
    Dict,
    Iterable,
    NamedTuple,
    Optional,
    Tuple,
    Union,
)

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

import phoenix
import phoenix.trace.v1 as pb
from phoenix.config import DEFAULT_PROJECT_NAME, SERVER_DIR
from phoenix.core.model_schema import Model
from phoenix.core.traces import Traces
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import create_engine
from phoenix.pointcloud.umap_parameters import UMAPParameters
from phoenix.server.api.context import Context, DataLoaders
from phoenix.server.api.dataloaders import (
    LatencyMsQuantileDataLoader,
    SpanEvaluationsDataLoader,
)
from phoenix.server.api.routers.evaluation_handler import EvaluationHandler
from phoenix.server.api.routers.span_handler import SpanHandler
from phoenix.server.api.routers.trace_handler import TraceHandler
from phoenix.server.api.schema import schema
from phoenix.storage.span_store import SpanStore
from phoenix.trace.schemas import Span

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


class GraphQLWithContext(GraphQL):  # type: ignore
    def __init__(
        self,
        schema: BaseSchema,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        model: Model,
        export_path: Path,
        graphiql: bool = False,
        corpus: Optional[Model] = None,
        traces: Optional[Traces] = None,
    ) -> None:
        self.db = db
        self.model = model
        self.corpus = corpus
        self.traces = traces
        self.export_path = export_path
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
            traces=self.traces,
            export_path=self.export_path,
            data_loaders=DataLoaders(
                latency_ms_quantile=LatencyMsQuantileDataLoader(self.db),
                span_evaluations=SpanEvaluationsDataLoader(self.db),
            ),
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
    db: Callable[[], AsyncContextManager[AsyncSession]],
    initial_batch_of_spans: Optional[Iterable[Tuple[Span, str]]] = None,
    initial_batch_of_evaluations: Optional[Iterable[pb.Evaluation]] = None,
) -> StatefulLifespan[Starlette]:
    @contextlib.asynccontextmanager
    async def lifespan(_: Starlette) -> AsyncIterator[Dict[str, Any]]:
        async with BulkInserter(
            db,
            initial_batch_of_spans=initial_batch_of_spans,
            initial_batch_of_evaluations=initial_batch_of_evaluations,
        ) as (queue_span, queue_evaluation):
            yield {
                "queue_span_for_bulk_insert": queue_span,
                "queue_evaluation_for_bulk_insert": queue_evaluation,
            }

    return lifespan


async def check_healthz(_: Request) -> PlainTextResponse:
    return PlainTextResponse("OK")


def create_app(
    database: str,
    export_path: Path,
    model: Model,
    umap_params: UMAPParameters,
    corpus: Optional[Model] = None,
    traces: Optional[Traces] = None,
    span_store: Optional[SpanStore] = None,
    debug: bool = False,
    read_only: bool = False,
    enable_prometheus: bool = False,
    initial_spans: Optional[Iterable[Union[Span, Tuple[Span, str]]]] = None,
    initial_evaluations: Optional[Iterable[pb.Evaluation]] = None,
) -> Starlette:
    initial_batch_of_spans: Iterable[Tuple[Span, str]] = (
        ()
        if initial_spans is None
        else (
            ((item, DEFAULT_PROJECT_NAME) if isinstance(item, Span) else item)
            for item in initial_spans
        )
    )
    initial_batch_of_evaluations = () if initial_evaluations is None else initial_evaluations
    engine = create_engine(database)
    db = _db(engine)
    graphql = GraphQLWithContext(
        db=db,
        schema=schema,
        model=model,
        corpus=corpus,
        traces=traces,
        export_path=export_path,
        graphiql=True,
    )
    if enable_prometheus:
        from phoenix.server.prometheus import PrometheusMiddleware

        prometheus_middlewares = [Middleware(PrometheusMiddleware)]
    else:
        prometheus_middlewares = []
    return Starlette(
        lifespan=_lifespan(db, initial_batch_of_spans, initial_batch_of_evaluations),
        middleware=[
            Middleware(HeadersMiddleware),
            *prometheus_middlewares,
        ],
        debug=debug,
        routes=(
            []
            if traces is None or read_only
            else [
                Route(
                    "/v1/spans",
                    type("SpanEndpoint", (SpanHandler,), {"traces": traces}),
                ),
                Route(
                    "/v1/traces",
                    type("TraceEndpoint", (TraceHandler,), {"traces": traces, "store": span_store}),
                ),
                Route(
                    "/v1/evaluations",
                    type("EvaluationEndpoint", (EvaluationHandler,), {"traces": traces}),
                ),
            ]
        )
        + [
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
                "/graphql",
                graphql,
            ),
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
        ],
    )
