import logging
from typing import Optional, Union

from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.types import Scope
from starlette.websockets import WebSocket
from strawberry.asgi import GraphQL
from strawberry.schema import BaseSchema

from phoenix.config import SERVER_DIR
from phoenix.core.model import Model
from phoenix.datasets import Dataset

from .api.context import Context
from .api.loaders import Loaders, create_loaders
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


class GraphQLWithContext(GraphQL):
    def __init__(
        self,
        schema: BaseSchema,
        model: Model,
        loader: Loaders,
        graphiql: bool = False,
    ) -> None:
        self.model = model
        self.loader = loader
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
            loaders=self.loader,
        )


def create_app(
    primary_dataset_name: str,
    reference_dataset_name: Optional[str],
    debug: bool = False,
) -> Starlette:
    model = Model(
        primary_dataset=Dataset.from_name(primary_dataset_name),
        reference_dataset=Dataset.from_name(reference_dataset_name)
        if reference_dataset_name is not None
        else None,
    )
    graphql = GraphQLWithContext(
        schema=schema,
        model=model,
        loader=create_loaders(model),
        graphiql=True,
    )
    return Starlette(
        middleware=[
            Middleware(HeadersMiddleware),
        ],
        debug=debug,
        routes=[
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
