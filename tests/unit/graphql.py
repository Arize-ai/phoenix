import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urljoin

import httpx


class GraphQLError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message

    def __repr__(self) -> str:
        return f'GraphQLError(message="{self.message}")'


@dataclass
class GraphQLExecutionResult:
    data: Optional[dict[str, Any]] = None
    errors: list[GraphQLError] = field(default_factory=list)


_MULTIPART_ACCEPT = "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json"


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

    async def subscription(
        self,
        query: str,
        variables: Optional[dict[str, Any]] = None,
        operation_name: Optional[str] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Runs a GraphQL subscription over HTTP using the Apollo multipart
        subscription protocol (multipart/mixed).
        """
        body = {
            "query": query,
            **({"variables": variables} if variables is not None else {}),
            **({"operationName": operation_name} if operation_name is not None else {}),
        }
        async with self._httpx_client.stream(
            "POST",
            self._gql_url,
            json=body,
            headers={
                "Accept": _MULTIPART_ACCEPT,
                "Content-Type": "application/json",
            },
        ) as response:
            response.raise_for_status()
            async for payload in _parse_multipart_response(response):
                inner = payload.get("payload", payload)
                if errors := inner.get("errors"):
                    raise RuntimeError(errors)
                if data := inner.get("data"):
                    yield data


async def _parse_multipart_response(
    response: httpx.Response,
) -> AsyncIterator[dict[str, Any]]:
    """
    Parse an Apollo multipart subscription response
    (multipart/mixed with boundary-delimited JSON parts).
    """
    content_type = response.headers.get("content-type", "")

    # Handle regular JSON response (non-streaming)
    if "application/json" in content_type and "multipart" not in content_type:
        data: dict[str, Any] = json.loads(await response.aread())
        yield data
        return

    # Handle multipart response
    buffer = b""
    boundary: bytes | None = None

    if "boundary=" in content_type:
        boundary = content_type.split("boundary=")[1].split(";")[0].strip().encode()

    async for chunk in response.aiter_bytes():
        buffer += chunk

        while True:
            if boundary is None:
                if b"\r\n" in buffer:
                    first_line = buffer.split(b"\r\n")[0]
                    if first_line.startswith(b"--"):
                        boundary = first_line[2:]

            if boundary is None:
                break

            delimiter = b"--" + boundary
            end_delimiter = delimiter + b"--"

            if end_delimiter in buffer:
                parts = buffer.split(delimiter)
                for part in parts[1:]:
                    if part.strip() and not part.startswith(b"--"):
                        json_data = _extract_json_from_part(part)
                        if json_data:
                            yield json_data
                return

            parts = buffer.split(delimiter)
            if len(parts) > 2:
                for part in parts[1:-1]:
                    json_data = _extract_json_from_part(part)
                    if json_data:
                        yield json_data
                buffer = delimiter + parts[-1]
            else:
                break


def _extract_json_from_part(part: bytes) -> dict[str, Any] | None:
    if b"\r\n\r\n" in part:
        _, body = part.split(b"\r\n\r\n", 1)
    elif b"\n\n" in part:
        _, body = part.split(b"\n\n", 1)
    else:
        body = part

    body = body.strip()
    if not body or body == b"--":
        return None

    try:
        result: dict[str, Any] = json.loads(body.decode("utf-8"))
        return result
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
