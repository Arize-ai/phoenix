import logging
from pathlib import Path
from typing import Optional, Union

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
from starlette.types import Scope
from starlette.websockets import WebSocket
from strawberry.asgi import GraphQL
from strawberry.schema import BaseSchema

from phoenix.config import SERVER_DIR
from phoenix.core.model_schema import Model
from phoenix.core.traces import Traces

from .api.context import Context
from .api.schema import schema

logger = logging.getLogger(__name__)


class Static(StaticFiles):
    "Static file serving with a fallback to index.html"

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = None
        try:
            response = await super().get_response(path, scope)
        except HTTPException as e:
            if e.status_code != 404:
                raise e
            # Fallback to to the index.html
            full_path, stat_result = self.lookup_path("index.html")
            if stat_result is None:
                raise RuntimeError("Failed to find index.html")
            response = self.file_response(full_path, stat_result, scope)
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
        routes=[
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
                    html=True,
                ),
                name="static",
            ),
        ],
    )
