import os
from typing import Optional, Union

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.types import Scope
from starlette.websockets import WebSocket
from strawberry.asgi import GraphQL
from strawberry.schema import BaseSchema

from phoenix.core.model import Model

from .api.schema import schema
from .api.types.context import Context
from .api.types.loader import Loader, create_loaders


class Static(StaticFiles):
    "Static file serving with a fallback to index.html"

    async def get_response(self, path: str, scope: Scope) -> Response:

        response = await super().get_response(path, scope)
        print("code", response.status_code)
        if response.status_code == 404:
            full_path, stat_result = self.lookup_path("index.html")
            if stat_result is None:
                raise RuntimeError("Filed to find index.html")
            return self.file_response(full_path, stat_result, scope)

        return response


class GraphQLWithContext(GraphQL):
    def __init__(
        self, schema: BaseSchema, model: Model, loader: Loader, graphiql: bool = False
    ) -> None:
        self.model = model
        self.loader = loader
        super().__init__(schema, graphiql=graphiql)

    async def get_context(
        self,
        request: Union[Request, WebSocket],
        response: Optional[Response] = None,
    ) -> Context:

        return Context(request=request, response=response, model=self.model, loader=self.loader)


def create_app(
    primary_dataset_name: str,
    reference_dataset_name: str,
    debug: bool = False,
    graphiql: bool = False,
) -> Starlette:
    model = Model(
        primary_dataset_name=primary_dataset_name, reference_dataset_name=reference_dataset_name
    )
    graphql = GraphQLWithContext(
        schema=schema, model=model, loader=create_loaders(model), graphiql=graphiql
    )
    return Starlette(
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
                    directory=os.path.join(
                        os.path.dirname(__file__),
                        "static",
                    ),
                    html=True,
                ),
                name="static",
            ),
        ],
    )
