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

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace, _node


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
            span = await _add_span(session, trace, name=f"span-{i}")
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
            span = await _add_span(session, trace, name=f"span-{i}")
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
