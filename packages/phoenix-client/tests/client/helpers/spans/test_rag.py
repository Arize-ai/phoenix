from typing import Callable

import httpx

from phoenix.client import AsyncClient, Client
from phoenix.client.helpers.spans import (
    async_get_input_output_context,
    async_get_retrieved_documents,
    get_input_output_context,
    get_retrieved_documents,
)

_PROJECT_ID = "UHJvamVjdDoy"
_PROJECT_NAME = "rag-app"


def _record_span_query_project_names(
    queried_project_names: list[str],
) -> Callable[[httpx.Request], httpx.Response]:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == f"/v1/projects/{_PROJECT_ID}":
            return httpx.Response(200, json={"data": {"id": _PROJECT_ID, "name": _PROJECT_NAME}})
        assert request.url.path == "/v1/spans"
        queried_project_names.append(request.url.params["project_name"])
        return httpx.Response(
            200,
            headers={"Content-Type": "multipart/mixed; boundary=end"},
            text="--end--\r\n",
        )

    return handle


def test_rag_helpers_query_the_project_a_project_id_identifies() -> None:
    queried_project_names: list[str] = []
    transport = httpx.MockTransport(_record_span_query_project_names(queried_project_names))
    with httpx.Client(transport=transport, base_url="http://test") as http_client:
        client = Client(http_client=http_client)
        get_retrieved_documents(client, project_identifier=_PROJECT_ID)
        get_input_output_context(client, project_identifier=_PROJECT_ID)

    assert queried_project_names == [_PROJECT_NAME] * 3


async def test_async_rag_helpers_query_the_project_a_project_id_identifies() -> None:
    queried_project_names: list[str] = []
    transport = httpx.MockTransport(_record_span_query_project_names(queried_project_names))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
        client = AsyncClient(http_client=http_client)
        await async_get_retrieved_documents(client, project_identifier=_PROJECT_ID)
        await async_get_input_output_context(client, project_identifier=_PROJECT_ID)

    assert queried_project_names == [_PROJECT_NAME] * 3
