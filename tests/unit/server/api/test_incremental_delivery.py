import json
from typing import Any

import httpx2

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

_ACCEPT = "multipart/mixed; deferSpec=20220824, application/json"

_QUERY = """
query {
  projects(first: 10) {
    edges {
      node {
        name
        ... on Project @defer(label: "counts") { traceCount }
      }
    }
  }
}
"""


def _parse_multipart_parts(*, body: str, boundary: str) -> list[dict[str, Any]]:
    delimiter = f"\r\n--{boundary}"
    segments = ("\r\n" + body).split(delimiter)[1:]
    parts = []
    for segment in segments:
        if segment.startswith("--"):
            break
        _, _, payload = segment.partition("\r\n\r\n")
        if payload.strip():
            parts.append(json.loads(payload))
    return parts


async def test_defer_streams_the_deferred_fragment_after_the_initial_data(
    db: DbSessionFactory,
    httpx_client: httpx2.AsyncClient,
) -> None:
    async with db() as session:
        session.add(models.Project(name="deferred"))

    response = await httpx_client.post(
        "/graphql",
        json={"query": _QUERY},
        headers={"Accept": _ACCEPT},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("multipart/mixed")
    initial, *subsequent = _parse_multipart_parts(body=response.text, boundary="-")
    edges = initial["data"]["projects"]["edges"]
    deferred_names = [edge["node"]["name"] for edge in edges]
    assert "deferred" in deferred_names
    assert all("traceCount" not in edge["node"] for edge in edges)
    assert initial["hasNext"] is True
    assert {pending["label"] for pending in initial["pending"]} == {"counts"}
    results = [result for part in subsequent for result in part.get("incremental", [])]
    assert len(results) == len(edges)
    for result in results:
        assert result["label"] == "counts"
        assert result["path"][:2] == ["projects", "edges"]
        assert result["data"] == {"traceCount": 0}
    assert subsequent[-1]["hasNext"] is False


async def test_a_query_without_defer_keeps_its_json_response(
    httpx_client: httpx2.AsyncClient,
) -> None:
    response = await httpx_client.post(
        "/graphql",
        json={"query": "query { projects(first: 1) { edges { node { name } } } }"},
        headers={"Accept": _ACCEPT},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "errors" not in response.json()
