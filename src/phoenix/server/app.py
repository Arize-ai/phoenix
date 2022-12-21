import os

from starlette.applications import Starlette
from starlette.responses import Response
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.types import Scope
from strawberry.asgi import GraphQL

from .api.schema import schema


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


app = Starlette(
    debug=True,
    routes=[
        Route(
            "/graphql",
            GraphQL(schema, graphiql=True),
        ),
        WebSocketRoute("/graphql", GraphQL(schema, graphiql=True)),
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
