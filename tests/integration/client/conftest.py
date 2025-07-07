import asyncio
from typing import Iterator, Mapping, Optional

import pytest
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id
from typing_extensions import TypeAlias

from .._helpers import (
    _AppInfo,
    _get,
    _gql,
    _grpc_span_exporter,
    _server,
    _start_span,
)


@pytest.fixture(scope="package")
def _env(
    _env_ports: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_auth: Mapping[str, str],
    _env_smtp: Mapping[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_ports,
        **_env_database,
        **_env_auth,
        **_env_smtp,
    }


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


@pytest.fixture(autouse=True, scope="package")
def _span_ids(
    _app: _AppInfo,
) -> tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]]:
    memory = InMemorySpanExporter()
    for _ in range(2):
        _start_span(project_name="default", exporter=memory).end()
    assert (spans := memory.get_finished_spans())
    headers = {"authorization": f"Bearer {_app.admin_secret}"}
    assert _grpc_span_exporter(_app, headers=headers).export(spans) is SpanExportResult.SUCCESS
    span1, span2 = spans
    assert (sc1 := span1.get_span_context())  # type: ignore[no-untyped-call]
    span_id1 = format_span_id(sc1.span_id)
    assert (sc2 := span2.get_span_context())  # type: ignore[no-untyped-call]
    span_id2 = format_span_id(sc2.span_id)
    span_ids = [span_id1, span_id2]

    def query_fn() -> Optional[tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]]]:
        res, _ = _gql(
            _app,
            _app.admin_secret,
            query=QUERY,
            operation_name="GetSpanIds",
            variables={"filterCondition": f"span_id in {span_ids}"},
        )
        gids = {e["node"]["spanId"]: e["node"]["id"] for e in res["data"]["node"]["spans"]["edges"]}
        if span_id1 in gids and span_id2 in gids:
            return (span_id1, gids[span_id1]), (span_id2, gids[span_id2])
        return None

    return asyncio.run(_get(query_fn, error_msg="spans not found"))


QUERY = """
query GetSpanIds ($filterCondition: String) {
  node(id: "UHJvamVjdDox") {
    ... on Project {
      spans (filterCondition: $filterCondition) {
        edges {
          node {
            id
            spanId
          }
        }
      }
    }
  }
}
"""
