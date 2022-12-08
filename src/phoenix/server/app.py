from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from strawberry.asgi import GraphQL

from .api.schema import schema


async def homepage(request: Request) -> JSONResponse:
    return JSONResponse({"hello": "world"})


app = Starlette(
    debug=True,
    routes=[
        Route("/", homepage),
        Route(
            "/graphql",
            GraphQL(schema, graphiql=True),
        ),
        WebSocketRoute("/graphql", GraphQL(schema, graphiql=True)),
    ],
)
