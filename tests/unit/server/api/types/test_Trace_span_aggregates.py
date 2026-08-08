"""GraphQL integration tests for per-trace span aggregate fields on `Trace`.

Covers ``spanCountsByKind``, ``errorCount``, ``errorsByType`` and the new
``filterCondition`` argument on ``Trace.spans``.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

import pytest
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


def _exception_event(exception_type: str) -> dict[str, Any]:
    return {
        "name": "exception",
        "timestamp": "2021-01-01T00:00:00.000+00:00",
        "attributes": {"exception.type": exception_type},
    }


@pytest.fixture
async def trace_with_mixed_spans(db: DbSessionFactory) -> int:
    """A trace with a mix of span kinds and statuses:

    - 2 LLM (1 OK, 1 ERROR with ``ValueError``)
    - 1 TOOL (ERROR with ``KeyError``)
    - 1 CHAIN (OK)
    - 1 CHAIN (ERROR, no exception event) → contributes to the `None` bucket
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="trace_aggregates").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace_aggregates",
                project_rowid=project_id,
                start_time=orig_time,
                end_time=orig_time + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace_rowid is not None

        spans = [
            # (span_id, kind, status, events)
            ("s_llm_ok", "LLM", "OK", []),
            ("s_llm_err", "LLM", "ERROR", [_exception_event("ValueError")]),
            ("s_tool_err", "TOOL", "ERROR", [_exception_event("KeyError")]),
            ("s_chain_ok", "CHAIN", "OK", []),
            ("s_chain_err_no_event", "CHAIN", "ERROR", []),
        ]
        for span_id, kind, status, events in spans:
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name=span_id,
                    span_kind=kind,
                    start_time=orig_time,
                    end_time=orig_time + timedelta(seconds=1),
                    attributes={},
                    events=events,
                    status_code=status,
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=None,
                    llm_token_count_completion=None,
                )
            )
        await session.commit()
    return trace_rowid


async def test_span_counts_by_kind(
    trace_with_mixed_spans: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_mixed_spans)))
    query = """
        query ($traceId: ID!) {
            node(id: $traceId) {
                ... on Trace {
                    spanCountsByKind { spanKind count }
                }
            }
        }
    """
    response = await gql_client.execute(query=query, variables={"traceId": trace_gid})
    assert not response.errors
    assert (data := response.data) is not None

    # Sort deterministically: CHAIN=2, LLM=2, TOOL=1 -> sorted by count desc,
    # then span kind ascending (by string value). The GraphQL `SpanKind` enum
    # serializes to its Python member name (lowercase), not the storage value.
    assert data["node"]["spanCountsByKind"] == [
        {"spanKind": "chain", "count": 2},
        {"spanKind": "llm", "count": 2},
        {"spanKind": "tool", "count": 1},
    ]


async def test_error_count(
    trace_with_mixed_spans: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_mixed_spans)))
    query = """
        query ($traceId: ID!) {
            node(id: $traceId) {
                ... on Trace {
                    errorCount
                }
            }
        }
    """
    response = await gql_client.execute(query=query, variables={"traceId": trace_gid})
    assert not response.errors
    assert (data := response.data) is not None
    assert data["node"]["errorCount"] == 3


async def test_errors_by_type(
    trace_with_mixed_spans: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_mixed_spans)))
    query = """
        query ($traceId: ID!) {
            node(id: $traceId) {
                ... on Trace {
                    errorsByType { exceptionType count }
                }
            }
        }
    """
    response = await gql_client.execute(query=query, variables={"traceId": trace_gid})
    assert not response.errors
    assert (data := response.data) is not None
    # All three errored spans contribute one count each:
    # ValueError (from LLM), KeyError (from TOOL), and `None`
    # (from the errored CHAIN with no exception event). All tie at count=1,
    # sorted with None first, then exception type ascending.
    assert data["node"]["errorsByType"] == [
        {"exceptionType": None, "count": 1},
        {"exceptionType": "KeyError", "count": 1},
        {"exceptionType": "ValueError", "count": 1},
    ]


async def test_spans_filter_condition_narrows_results(
    trace_with_mixed_spans: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_mixed_spans)))
    query = """
        query ($traceId: ID!, $first: Int!, $filter: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, filterCondition: $filter) {
                        edges { node { name } }
                    }
                }
            }
        }
    """
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 10, "filter": "span_kind == 'LLM'"},
    )
    assert not response.errors
    assert (data := response.data) is not None
    edges = data["node"]["spans"]["edges"]
    names = {edge["node"]["name"] for edge in edges}
    assert names == {"s_llm_ok", "s_llm_err"}


async def test_spans_filter_condition_on_status_code(
    trace_with_mixed_spans: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_mixed_spans)))
    query = """
        query ($traceId: ID!, $first: Int!, $filter: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, filterCondition: $filter) {
                        edges { node { name } }
                    }
                }
            }
        }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "traceId": trace_gid,
            "first": 10,
            "filter": "status_code == 'error'",
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    edges = data["node"]["spans"]["edges"]
    names = {edge["node"]["name"] for edge in edges}
    assert names == {"s_llm_err", "s_tool_err", "s_chain_err_no_event"}


async def test_spans_invalid_filter_condition_raises(
    trace_with_mixed_spans: int,
    monkeypatch: pytest.MonkeyPatch,
    gql_client: AsyncGraphQLClient,
) -> None:
    monkeypatch.setenv("PHOENIX_MASK_INTERNAL_SERVER_ERRORS", "false")
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_mixed_spans)))
    query = """
        query ($traceId: ID!, $first: Int!, $filter: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, filterCondition: $filter) {
                        edges { node { name } }
                    }
                }
            }
        }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "traceId": trace_gid,
            "first": 10,
            # Bare identifier — not a valid SpanFilter expression.
            "filter": "span_kind",
        },
    )
    assert response.errors


@pytest.fixture
async def trace_with_non_canonical_kinds(db: DbSessionFactory) -> int:
    """A trace with two spans whose ``span_kind`` values both collapse to
    ``SpanKind.unknown`` via the enum's ``_missing_`` hook.

    Exercises the resolver-side dedup that protects the GraphQL response
    from emitting multiple entries keyed by the same enum member when the
    DB contains non-canonical values.
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project)
            .values(name="trace_non_canonical_kinds")
            .returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace_non_canonical",
                project_rowid=project_id,
                start_time=orig_time,
                end_time=orig_time + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace_rowid is not None

        # Both kinds resolve to SpanKind.unknown: the first directly, the
        # second via the enum's `_missing_` fallback for unrecognized strings.
        for span_id, kind in [("s_canonical_unknown", "UNKNOWN"), ("s_legacy_kind", "CUSTOM")]:
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name=span_id,
                    span_kind=kind,
                    start_time=orig_time,
                    end_time=orig_time + timedelta(seconds=1),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=None,
                    llm_token_count_completion=None,
                )
            )
        await session.commit()
    return trace_rowid


async def test_span_counts_by_kind_dedupes_non_canonical(
    trace_with_non_canonical_kinds: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Two DB rows that both collapse to ``SpanKind.unknown`` must produce a
    single ``unknown`` bucket summing both counts, not two separate entries.
    """
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_non_canonical_kinds)))
    query = """
        query ($traceId: ID!) {
            node(id: $traceId) {
                ... on Trace {
                    spanCountsByKind { spanKind count }
                }
            }
        }
    """
    response = await gql_client.execute(query=query, variables={"traceId": trace_gid})
    assert not response.errors
    assert (data := response.data) is not None
    assert data["node"]["spanCountsByKind"] == [{"spanKind": "unknown", "count": 2}]


@pytest.fixture
async def trace_with_hierarchy(db: DbSessionFactory) -> int:
    """A trace with parent/child structure so root-span filtering is meaningful.

    - ``s_root_llm_ok``: LLM, no parent (root), OK
    - ``s_child_llm_err``: LLM, child of ``s_root_llm_ok``, ERROR
    - ``s_root_tool_err``: TOOL, no parent (root), ERROR
    - ``s_root_tool_err_2``: TOOL, no parent (root), ERROR (second root for pagination)
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="trace_hierarchy").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace_hierarchy",
                project_rowid=project_id,
                start_time=orig_time,
                end_time=orig_time + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace_rowid is not None

        spans = [
            # (span_id, parent_id, kind, status)
            ("s_root_llm_ok", None, "LLM", "OK"),
            ("s_child_llm_err", "s_root_llm_ok", "LLM", "ERROR"),
            ("s_root_tool_err", None, "TOOL", "ERROR"),
            ("s_root_tool_err_2", None, "TOOL", "ERROR"),
        ]
        for span_id, parent_id, kind, status in spans:
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=parent_id,
                    name=span_id,
                    span_kind=kind,
                    start_time=orig_time,
                    end_time=orig_time + timedelta(seconds=1),
                    attributes={},
                    events=[],
                    status_code=status,
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=None,
                    llm_token_count_completion=None,
                )
            )
        await session.commit()
    return trace_rowid


async def test_spans_filter_with_root_spans_only(
    trace_with_hierarchy: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Filter must apply to the candidate set before root-span narrowing.

    With ``span_kind == 'LLM'`` + ``rootSpansOnly: true`` we expect only
    the LLM root span — the LLM child should be excluded by the root
    narrowing, and the TOOL roots should be excluded by the kind filter.
    """
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_hierarchy)))
    query = """
        query ($traceId: ID!, $first: Int!, $filter: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, rootSpansOnly: true, filterCondition: $filter) {
                        edges { node { name } }
                    }
                }
            }
        }
    """
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 10, "filter": "span_kind == 'LLM'"},
    )
    assert not response.errors
    assert (data := response.data) is not None
    names = {edge["node"]["name"] for edge in data["node"]["spans"]["edges"]}
    assert names == {"s_root_llm_ok"}


async def test_spans_filter_paginates(
    trace_with_hierarchy: int,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Filter must compose with forward-cursor pagination.

    Three errored spans exist in the trace. Asking for one at a time with an
    ``after`` cursor must return all three across two pages without skipping
    or duplicating.
    """
    trace_gid = str(GlobalID(Trace.__name__, str(trace_with_hierarchy)))
    query = """
        query ($traceId: ID!, $first: Int!, $after: String, $filter: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, after: $after, filterCondition: $filter) {
                        edges { cursor node { name } }
                        pageInfo { hasNextPage endCursor }
                    }
                }
            }
        }
    """
    seen: set[str] = set()
    after: Optional[str] = None
    # Two pages of 2 spans each is enough to exhaust three matches and observe
    # `hasNextPage` flipping to false. Guard against infinite loops.
    for _ in range(4):
        response = await gql_client.execute(
            query=query,
            variables={
                "traceId": trace_gid,
                "first": 2,
                "after": after,
                "filter": "status_code == 'ERROR'",
            },
        )
        assert not response.errors
        assert (data := response.data) is not None
        conn = data["node"]["spans"]
        for edge in conn["edges"]:
            name = edge["node"]["name"]
            assert name not in seen, f"duplicate span across pages: {name}"
            seen.add(name)
        if not conn["pageInfo"]["hasNextPage"]:
            break
        after = conn["pageInfo"]["endCursor"]
    assert seen == {"s_child_llm_err", "s_root_tool_err", "s_root_tool_err_2"}
