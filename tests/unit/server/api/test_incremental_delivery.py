import json
import logging
from typing import Any

import httpx2
import pytest

from phoenix.config import ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS
from phoenix.db import models
from phoenix.server.api.dataloaders.min_start_or_max_end_times import (
    MinStartOrMaxEndTimeDataLoader,
)
from phoenix.server.api.dataloaders.record_counts import RecordCountDataLoader
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


_INTERNAL_DETAIL = "internal detail: SELECT secret FROM spans"

_FAILING_QUERY = """
query Deferred {
  projects(first: 1) {
    edges {
      node {
        name
        ... on Project @defer(label: "failing") { DEFERRED_FIELD }
      }
    }
  }
}
"""


@pytest.mark.parametrize(
    "deferred_field, failing_loader, errors_key",
    [
        pytest.param("traceCount", RecordCountDataLoader, "completed", id="failed-fragment"),
        pytest.param(
            "startTime", MinStartOrMaxEndTimeDataLoader, "incremental", id="failed-nullable-field"
        ),
    ],
)
async def test_errors_in_deferred_payloads_are_masked(
    db: DbSessionFactory,
    httpx_client: httpx2.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    deferred_field: str,
    failing_loader: type,
    errors_key: str,
) -> None:
    async def raise_internal_error(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError(_INTERNAL_DETAIL)

    monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
    monkeypatch.setattr(failing_loader, "load", raise_internal_error)
    caplog.set_level(logging.ERROR, logger="phoenix.server.api.schema")
    async with db() as session:
        session.add(models.Project(name="deferred"))

    response = await httpx_client.post(
        "/graphql",
        json={"query": _FAILING_QUERY.replace("DEFERRED_FIELD", deferred_field)},
        headers={"Accept": _ACCEPT},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("multipart/mixed")
    assert _INTERNAL_DETAIL not in response.text
    _, *subsequent = _parse_multipart_parts(body=response.text, boundary="-")
    errors = [
        error
        for part in subsequent
        for entry in part.get(errors_key, [])
        for error in entry.get("errors", [])
    ]
    assert [error["message"] for error in errors] == ["an unexpected error occurred"]
    (record,) = caplog.records
    assert record.getMessage().startswith("GraphQL operation Deferred failed at path")
    assert record.exc_info is not None and str(record.exc_info[1]) == _INTERNAL_DETAIL
