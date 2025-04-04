from dataclasses import dataclass, field
from typing import Any, Optional

import httpx


class GraphQLError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message


@dataclass
class GraphQLExecutionResult:
    data: Optional[dict[str, Any]] = None
    errors: list[GraphQLError] = field(default_factory=list)


class AsyncGraphQLClient:
    """
    Async GraphQL client that can execute queries, mutations, and subscriptions.
    """

    def __init__(self, base_url: str, timeout_seconds: Optional[float] = 10) -> None:
        self._httpx_client = httpx.AsyncClient(
            base_url=base_url, timeout=timeout_seconds
        )

    async def execute(
        self,
        query: str,
        variables: dict[str, Any],
    ) -> GraphQLExecutionResult:
        """
        Executes queries and mutations.
        """
        response = await self._httpx_client.post(
            self._gql_url,
            json={
                "query": query,
                **({"variables": variables} if variables is not None else {}),
            },
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        response_json = response.json()
        return GraphQLExecutionResult(
            data=response_json.get("data"),
            errors=[
                GraphQLError(message=error["message"])
                for error in response_json.get("errors", [])
            ],
        )
