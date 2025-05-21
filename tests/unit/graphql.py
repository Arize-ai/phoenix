import contextlib
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urljoin
from uuid import uuid4

import httpx
from httpx_ws import AsyncWebSocketSession, aconnect_ws
from strawberry.subscriptions import GRAPHQL_TRANSPORT_WS_PROTOCOL


class GraphQLError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message

    def __repr__(self) -> str:
        return f'GraphQLError(message="{self.message}")'


@dataclass
class GraphQLExecutionResult:
    data: Optional[dict[str, Any]] = None
    errors: list[GraphQLError] = field(default_factory=list)


class AsyncGraphQLClient:
    """
    Async GraphQL client that can execute queries, mutations, and subscriptions.
    """

    def __init__(
        self, httpx_client: httpx.AsyncClient, timeout_seconds: Optional[float] = 10
    ) -> None:
        self._httpx_client = httpx_client
        self._timeout_seconds = timeout_seconds
        self._gql_url = urljoin(str(httpx_client.base_url), "/graphql")

    async def execute(
        self,
        query: str,
        variables: Optional[dict[str, Any]] = None,
        operation_name: Optional[str] = None,
    ) -> GraphQLExecutionResult:
        """
        Executes queries and mutations.
        """
        response = await self._httpx_client.post(
            self._gql_url,
            json={
                "query": query,
                **({"variables": variables} if variables is not None else {}),
                **({"operationName": operation_name} if operation_name is not None else {}),
            },
        )
        response.raise_for_status()
        response_json = response.json()
        return GraphQLExecutionResult(
            data=response_json.get("data"),
            errors=[
                GraphQLError(message=error["message"]) for error in response_json.get("errors", [])
            ],
        )

    @contextlib.asynccontextmanager
    async def subscription(
        self,
        query: str,
        variables: Optional[dict[str, Any]] = None,
        operation_name: Optional[str] = None,
    ) -> AsyncIterator["GraphQLSubscription"]:
        """
        Starts a GraphQL subscription session.
        """
        async with aconnect_ws(  # type: ignore[var-annotated,unused-ignore]
            self._gql_url,
            self._httpx_client,
            subprotocols=[GRAPHQL_TRANSPORT_WS_PROTOCOL],
        ) as session:
            await session.send_json({"type": "connection_init"})
            message = await session.receive_json(timeout=self._timeout_seconds)
            if message.get("type") != "connection_ack":
                raise RuntimeError("Websocket connection failed")
            yield GraphQLSubscription(
                session=session,
                query=query,
                variables=variables,
                operation_name=operation_name,
                timeout_seconds=self._timeout_seconds,
            )


class GraphQLSubscription:
    """
    A session for a GraphQL subscription.
    """

    def __init__(
        self,
        *,
        session: AsyncWebSocketSession,
        query: str,
        variables: Optional[dict[str, Any]] = None,
        operation_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> None:
        self._session = session
        self._query = query
        self._variables = variables
        self._operation_name = operation_name
        self._timeout_seconds = timeout_seconds

    async def stream(
        self,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Streams subscription payloads.
        """
        connection_id = str(uuid4())
        await self._session.send_json(
            {
                "id": connection_id,
                "type": "subscribe",
                "payload": {
                    "query": self._query,
                    **({"variables": self._variables} if self._variables is not None else {}),
                    **(
                        {"operationName": self._operation_name}
                        if self._operation_name is not None
                        else {}
                    ),
                },
            }
        )
        while True:
            message = await self._session.receive_json(timeout=self._timeout_seconds)
            message_type = message.get("type")
            assert message.get("id") == connection_id
            if message_type == "complete":
                break
            elif message_type == "next":
                if (data := message["payload"]["data"]) is not None:
                    yield data
            elif message_type == "error":
                raise RuntimeError(message["payload"])
            else:
                assert False, f"Unexpected message type: {message_type}"
