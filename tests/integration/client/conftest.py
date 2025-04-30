import os
from collections.abc import Iterator
from contextlib import ExitStack
from secrets import token_hex
from time import sleep
from typing import Any
from unittest import mock

import pytest
from opentelemetry.sdk.environment_variables import (
    OTEL_EXPORTER_OTLP_TRACES_HEADERS,
)
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id
from typing_extensions import TypeAlias

from .._helpers import _AdminSecret, _gql, _grpc_span_exporter, _server, _start_span


@pytest.fixture(scope="package")
def _admin_secret() -> _AdminSecret:
    return _AdminSecret(token_hex(16))


@pytest.fixture(scope="package")
def _app(
    _ports: Iterator[int],
    _env_phoenix_sql_database_url: Any,
    _admin_secret: _AdminSecret,
) -> Iterator[None]:
    values = (
        ("PHOENIX_ENABLE_AUTH", "true"),
        ("PHOENIX_DISABLE_RATE_LIMIT", "true"),
        ("PHOENIX_SECRET", token_hex(16)),
        ("PHOENIX_ADMIN_SECRET", str(_admin_secret)),
        (OTEL_EXPORTER_OTLP_TRACES_HEADERS, f"Authorization=Bearer {_admin_secret}"),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(_server())
        yield


SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


@pytest.fixture(autouse=True, scope="package")
def _span_ids(
    _app: Any,
    _admin_secret: _AdminSecret,
) -> tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]]:
    memory = InMemorySpanExporter()
    for _ in range(2):
        _start_span(project_name="default", exporter=memory).end()
    assert (spans := memory.get_finished_spans())
    assert _grpc_span_exporter().export(spans) is SpanExportResult.SUCCESS
    sleep(0.1)
    span1, span2 = spans
    assert (sc1 := span1.get_span_context())  # type: ignore[no-untyped-call]
    span_id1 = format_span_id(sc1.span_id)
    assert (sc2 := span2.get_span_context())  # type: ignore[no-untyped-call]
    span_id2 = format_span_id(sc2.span_id)
    res, _ = _gql(_admin_secret, query=QUERY, operation_name="GetSpanIds")
    gids = {e["node"]["spanId"]: e["node"]["id"] for e in res["data"]["node"]["spans"]["edges"]}
    assert span_id1 in gids
    assert span_id2 in gids
    return (span_id1, gids[span_id1]), (span_id2, gids[span_id2])


QUERY = """
query GetSpanIds {
  node(id: "UHJvamVjdDox") {
    ... on Project {
      spans {
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
