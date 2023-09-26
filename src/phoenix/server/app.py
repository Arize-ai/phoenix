import logging
from pathlib import Path
from typing import Any, NamedTuple, Optional, Union

from starlette.applications import Starlette
from starlette.datastructures import QueryParams
from starlette.endpoints import HTTPEndpoint
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import FileResponse, Response
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from starlette.types import Scope
from starlette.websockets import WebSocket
from strawberry.asgi import GraphQL
from strawberry.schema import BaseSchema

from phoenix.config import SERVER_DIR
from phoenix.core.model_schema import Model
from phoenix.core.traces import Traces
from phoenix.server.api.context import Context
from phoenix.server.api.schema import schema
from phoenix.server.span_handler import SpanHandler

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory=SERVER_DIR / "templates")


class AppConfig(NamedTuple):
    has_corpus: bool


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
            # TODO(mikeldking): support index.html to change the
            # host and port of the js and css bundles if host is not localhost
            response = templates.TemplateResponse(
                "index.html",
                context={
                    "has_corpus": self._app_config.has_corpus,
                    "request": Request(scope),
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
        return response


class GraphQLWithContext(GraphQL):  # type: ignore
    def __init__(
        self,
        schema: BaseSchema,
        model: Model,
        export_path: Path,
        graphiql: bool = False,
        corpus: Optional[Model] = None,
        traces: Optional[Traces] = None,
    ) -> None:
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
            model=self.model,
            corpus=self.corpus,
            traces=self.traces,
            export_path=self.export_path,
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


def create_app(
    export_path: Path,
    model: Model,
    corpus: Optional[Model] = None,
    traces: Optional[Traces] = None,
    debug: bool = False,
) -> Starlette:
    graphql = GraphQLWithContext(
        schema=schema,
        model=model,
        corpus=corpus,
        traces=traces,
        export_path=export_path,
        graphiql=True,
    )
    return Starlette(
        middleware=[
            Middleware(HeadersMiddleware),
        ],
        debug=debug,
        routes=(
            []
            if traces is None
            else [
                Route(
                    "/v1/spans",
                    type(
                        "SpanEndpoint",
                        (SpanHandler,),
                        {"queue": traces},
                    ),
                ),
            ]
        )
        + [
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
            WebSocketRoute("/graphql", graphql),
            Mount(
                "/",
                app=Static(
                    directory=SERVER_DIR / "static",
                    app_config=AppConfig(
                        has_corpus=corpus is not None,
                    ),
                ),
                name="static",
            ),
        ],
    )
