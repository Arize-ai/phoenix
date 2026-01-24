from secrets import token_hex
from typing import Any, NamedTuple, Optional

import httpx
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.pagination import Cursor
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ...._helpers import (
    _add_project,
    _add_project_session,
    _add_span,
    _add_trace,
    _node,
)


class _Data(NamedTuple):
    spans: list[models.Span]
    traces: list[models.Trace]
    project_sessions: list[models.ProjectSession]
    projects: list[models.Project]


class TestTrace:
    @staticmethod
    async def _node(
        field: str,
        trace: models.Trace,
        httpx_client: httpx.AsyncClient,
    ) -> Any:
        return await _node(
            field,
            Trace.__name__,
            trace.id,
            httpx_client,
        )

    @pytest.fixture
    async def _data(self, db: DbSessionFactory) -> _Data:
        traces = []
        spans = []
        async with db() as session:
            project = await _add_project(session)
            project_session = await _add_project_session(session, project)
            traces.append(await _add_trace(session, project))
            traces.append(await _add_trace(session, project, project_session))
            spans.append(await _add_span(session, traces[-1]))
            spans.append(await _add_span(session, traces[-1], parent_span=spans[-1]))
        return _Data(
            spans=spans,
            traces=traces,
            project_sessions=[project_session],
            projects=[project],
        )

    async def test_session(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        traces = _data.traces
        project_session = _data.project_sessions[0]
        field = "session{id sessionId}"
        assert await self._node(field, traces[0], httpx_client) is None
        assert await self._node(field, traces[1], httpx_client) == {
            "id": str(GlobalID(ProjectSession.__name__, str(project_session.id))),
            "sessionId": project_session.session_id,
        }

    async def test_root_span(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        traces = _data.traces
        span = _data.spans[0]
        field = "rootSpan{id name}"
        assert await self._node(field, traces[0], httpx_client) is None
        assert await self._node(field, traces[1], httpx_client) == {
            "id": str(GlobalID(Span.__name__, str(span.id))),
            "name": span.name,
        }


async def test_trace_spans_pagination(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Test pagination for trace spans connection."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = []
        for i in range(10):
            span = await _add_span(session, trace)
            span.name = f"span-{i}"
            spans.append(span)
        await session.commit()

    trace_gid = str(GlobalID(Trace.__name__, str(trace.id)))

    query = """
        query ($traceId: ID!, $first: Int, $after: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, after: $after) {
                        edges {
                            node {
                                id
                                name
                            }
                            cursor
                        }
                        pageInfo {
                            hasNextPage
                            hasPreviousPage
                            startCursor
                            endCursor
                        }
                    }
                }
            }
        }
    """

    # Test 1: First page - request 3 spans
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 3},
    )
    assert not response.errors
    assert (data := response.data) is not None
    spans_connection = data["node"]["spans"]
    edges = spans_connection["edges"]
    page_info = spans_connection["pageInfo"]

    assert len(edges) == 3
    # Verify spans are in descending ID order (highest IDs first)
    assert edges[0]["node"]["name"] == "span-9"
    assert edges[1]["node"]["name"] == "span-8"
    assert edges[2]["node"]["name"] == "span-7"
    assert page_info["hasNextPage"] is True
    assert page_info["hasPreviousPage"] is False

    # Verify cursors
    start_cursor = Cursor.from_string(page_info["startCursor"])
    end_cursor = Cursor.from_string(page_info["endCursor"])
    # Start cursor should be for span-9 (highest id)
    assert start_cursor.rowid == spans[9].id
    # End cursor should be for span-7
    assert end_cursor.rowid == spans[7].id

    # Test 2: Second page - use cursor from first page
    after_cursor = page_info["endCursor"]
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 3, "after": after_cursor},
    )
    assert not response.errors
    assert (data := response.data) is not None
    spans_connection = data["node"]["spans"]
    edges = spans_connection["edges"]
    page_info = spans_connection["pageInfo"]

    assert len(edges) == 3
    assert edges[0]["node"]["name"] == "span-6"
    assert edges[1]["node"]["name"] == "span-5"
    assert edges[2]["node"]["name"] == "span-4"
    assert page_info["hasNextPage"] is True
    assert page_info["hasPreviousPage"] is False

    # Test 3: Third page
    after_cursor = page_info["endCursor"]
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 3, "after": after_cursor},
    )
    assert not response.errors
    assert (data := response.data) is not None
    spans_connection = data["node"]["spans"]
    edges = spans_connection["edges"]
    page_info = spans_connection["pageInfo"]

    assert len(edges) == 3
    assert edges[0]["node"]["name"] == "span-3"
    assert edges[1]["node"]["name"] == "span-2"
    assert edges[2]["node"]["name"] == "span-1"
    assert page_info["hasNextPage"] is True
    assert page_info["hasPreviousPage"] is False

    # Test 4: Final page - should return last span
    after_cursor = page_info["endCursor"]
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 3, "after": after_cursor},
    )
    assert not response.errors
    assert (data := response.data) is not None
    spans_connection = data["node"]["spans"]
    edges = spans_connection["edges"]
    page_info = spans_connection["pageInfo"]

    assert len(edges) == 1
    assert edges[0]["node"]["name"] == "span-0"
    assert page_info["hasNextPage"] is False
    assert page_info["hasPreviousPage"] is False


@pytest.mark.parametrize(
    "variables, start_cursor, end_cursor, has_next_page",
    [
        pytest.param(
            {
                "traceId": "PLACEHOLDER",
                "first": 2,
            },
            None,  # Will be set based on actual span IDs
            None,  # Will be set based on actual span IDs
            True,
            id="basic-query-first-page",
        ),
        pytest.param(
            {
                "traceId": "PLACEHOLDER",
                "after": "PLACEHOLDER_CURSOR",
                "first": 2,
            },
            None,
            None,
            False,
            id="page-ends-on-last-record",
        ),
    ],
)
async def test_trace_spans_pagination_parametrized(
    variables: dict[str, Any],
    start_cursor: Optional[Cursor],
    end_cursor: Optional[Cursor],
    has_next_page: bool,
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Parametrized test for trace spans pagination edge cases."""
    # Create a trace with 5 spans
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = []
        for i in range(5):
            span = await _add_span(session, trace)
            span.name = f"span-{i}"
            spans.append(span)
        await session.commit()

    trace_gid = str(GlobalID(Trace.__name__, str(trace.id)))
    variables["traceId"] = trace_gid

    # For the second test case, set the cursor to skip first 2 spans
    if "after" in variables and variables["after"] == "PLACEHOLDER_CURSOR":
        # Cursor for span-2 (3rd span, 0-indexed)
        cursor = Cursor(rowid=spans[2].id)
        variables["after"] = str(cursor)

    query = """
        query ($traceId: ID!, $first: Int, $after: String) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, after: $after) {
                        edges {
                            node {
                                id
                                name
                            }
                            cursor
                        }
                        pageInfo {
                            hasNextPage
                            hasPreviousPage
                            startCursor
                            endCursor
                        }
                    }
                }
            }
        }
    """

    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    spans_connection = data["node"]["spans"]
    page_info = spans_connection["pageInfo"]
    edges = spans_connection["edges"]

    assert page_info["hasNextPage"] == has_next_page
    assert page_info["hasPreviousPage"] is False

    if len(edges) > 0:
        # Verify cursors match
        actual_start_cursor = Cursor.from_string(page_info["startCursor"])
        actual_end_cursor = Cursor.from_string(page_info["endCursor"])
        # For basic query, verify we get spans in descending order
        if "after" not in variables or variables.get("after") is None:
            # Should get span-4 and span-3 (highest IDs first)
            assert len(edges) == 2
            assert edges[0]["node"]["name"] == "span-4"
            assert edges[1]["node"]["name"] == "span-3"
            assert actual_start_cursor.rowid == spans[4].id
            assert actual_end_cursor.rowid == spans[3].id
        else:
            # Should get remaining spans (span-1 and span-0)
            assert len(edges) == 2
            assert edges[0]["node"]["name"] == "span-1"
            assert edges[1]["node"]["name"] == "span-0"
            assert actual_start_cursor.rowid == spans[1].id
            assert actual_end_cursor.rowid == spans[0].id


async def test_trace_spans_root_spans_only(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Test root_spans_only parameter for trace spans connection."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)

        # Create spans with different parent relationships:
        # - root_span_1: parent_id=None (true root span)
        # - child_span_1: parent_id=root_span_1.span_id (child span)
        # - orphan_span_1: parent_id=non_existent_span_id (orphan span)
        # - root_span_2: parent_id=None (true root span)

        root_span_1 = await _add_span(session, trace)
        root_span_1.name = "root-span-1"
        root_span_1.parent_id = None

        child_span_1 = await _add_span(session, trace, parent_span=root_span_1)
        child_span_1.name = "child-span-1"

        orphan_span_1 = await _add_span(session, trace)
        orphan_span_1.name = "orphan-span-1"
        orphan_span_1.parent_id = token_hex(8)  # Non-existent parent ID

        root_span_2 = await _add_span(session, trace)
        root_span_2.name = "root-span-2"
        root_span_2.parent_id = None

        await session.commit()

    trace_gid = str(GlobalID(Trace.__name__, str(trace.id)))

    query = """
        query ($traceId: ID!, $first: Int, $rootSpansOnly: Boolean, $orphanSpanAsRootSpan: Boolean) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, rootSpansOnly: $rootSpansOnly, orphanSpanAsRootSpan: $orphanSpanAsRootSpan) {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    """

    # Test 1: root_spans_only=False (default) - should return all spans
    response = await gql_client.execute(
        query=query,
        variables={"traceId": trace_gid, "first": 10, "rootSpansOnly": False},
    )
    assert not response.errors
    assert (data := response.data) is not None
    edges = data["node"]["spans"]["edges"]
    assert len(edges) == 4
    span_names = {edge["node"]["name"] for edge in edges}
    assert span_names == {"root-span-1", "child-span-1", "orphan-span-1", "root-span-2"}

    # Test 2: root_spans_only=True, orphan_span_as_root_span=True - should include both NULL and orphan spans
    response = await gql_client.execute(
        query=query,
        variables={
            "traceId": trace_gid,
            "first": 10,
            "rootSpansOnly": True,
            "orphanSpanAsRootSpan": True,
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    edges = data["node"]["spans"]["edges"]
    assert len(edges) == 3
    span_names = {edge["node"]["name"] for edge in edges}
    assert span_names == {"root-span-1", "orphan-span-1", "root-span-2"}
    # Child span should not be included
    assert "child-span-1" not in span_names

    # Test 3: root_spans_only=True, orphan_span_as_root_span=False - should only include NULL parent_id spans
    response = await gql_client.execute(
        query=query,
        variables={
            "traceId": trace_gid,
            "first": 10,
            "rootSpansOnly": True,
            "orphanSpanAsRootSpan": False,
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    edges = data["node"]["spans"]["edges"]
    assert len(edges) == 2
    span_names = {edge["node"]["name"] for edge in edges}
    assert span_names == {"root-span-1", "root-span-2"}
    # Orphan span and child span should not be included
    assert "orphan-span-1" not in span_names
    assert "child-span-1" not in span_names


async def test_trace_spans_root_spans_only_cross_trace_parent(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Test that orphan span detection correctly filters by trace.

    This test verifies that a span with a parent_id from a different trace
    is correctly identified as an orphan (root span) in the current trace.
    """
    async with db() as session:
        project = await _add_project(session)

        # Create first trace with a span
        trace_1 = await _add_trace(session, project)
        span_in_trace_1 = await _add_span(session, trace_1)
        span_in_trace_1.name = "span-in-trace-1"
        span_in_trace_1.parent_id = None

        # Create second trace with a span that has parent_id from trace_1
        trace_2 = await _add_trace(session, project)
        span_in_trace_2 = await _add_span(session, trace_2)
        span_in_trace_2.name = "span-in-trace-2"
        # This span's parent_id exists in trace_1, but not in trace_2
        # So it should be considered an orphan (root span) in trace_2
        span_in_trace_2.parent_id = span_in_trace_1.span_id

        await session.commit()

    trace_2_gid = str(GlobalID(Trace.__name__, str(trace_2.id)))

    query = """
        query ($traceId: ID!, $first: Int, $rootSpansOnly: Boolean, $orphanSpanAsRootSpan: Boolean) {
            node(id: $traceId) {
                ... on Trace {
                    spans(first: $first, rootSpansOnly: $rootSpansOnly, orphanSpanAsRootSpan: $orphanSpanAsRootSpan) {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    """

    # Test: root_spans_only=True, orphan_span_as_root_span=True
    # The span_in_trace_2 should be identified as an orphan (root span)
    # because its parent_id doesn't exist in trace_2, even though it exists in trace_1
    response = await gql_client.execute(
        query=query,
        variables={
            "traceId": trace_2_gid,
            "first": 10,
            "rootSpansOnly": True,
            "orphanSpanAsRootSpan": True,
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    edges = data["node"]["spans"]["edges"]
    assert len(edges) == 1
    assert edges[0]["node"]["name"] == "span-in-trace-2"
    # Verify it's correctly identified as a root span (orphan)
    # because its parent exists in a different trace
