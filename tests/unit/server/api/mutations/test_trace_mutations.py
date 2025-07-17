from datetime import datetime

import pytest
from sqlalchemy import func, insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestTraceMutationMixin:
    DELETE_TRACES_MUTATION = """
      mutation($traceIds: [ID!]!) {
        deleteTraces(traceIds: $traceIds) {
          __typename
        }
      }
    """

    async def test_deleting_a_trace_does_not_delete_the_session_if_it_has_other_traces(
        self,
        gql_client: AsyncGraphQLClient,
        trace_ids_to_delete: tuple[int, ...],
        db: DbSessionFactory,
    ) -> None:
        trace_id = trace_ids_to_delete[0]  # this trace belongs to a session with two traces

        async with db() as session:
            # Verify trace
            trace = await session.get(models.Trace, trace_id)
            assert trace is not None

            # Verify session
            assert (session_id := trace.project_session_rowid) is not None
            project_session = await session.get(models.ProjectSession, session_id)
            assert project_session is not None

            # Verify span
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) == 1

        # Delete the trace
        result = await gql_client.execute(
            self.DELETE_TRACES_MUTATION,
            variables={"traceIds": [str(GlobalID("Trace", str(trace_id)))]},
        )
        assert not result.errors

        async with db() as session:
            # The session should not be deleted because it has other traces
            project_session = await session.get(models.ProjectSession, session_id)
            assert project_session is not None

            # Verify trace was deleted
            trace = await session.get(models.Trace, trace_id)
            assert trace is None

            # Verify no spans remain for the deleted trace
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) == 0

    async def test_deleting_all_traces_in_a_session_also_deletes_the_session(
        self,
        gql_client: AsyncGraphQLClient,
        trace_ids_to_delete: tuple[int, ...],
        db: DbSessionFactory,
    ) -> None:
        trace1_id, trace2_id, _ = trace_ids_to_delete

        async with db() as session:
            trace1 = await session.get(models.Trace, trace1_id)
            trace2 = await session.get(models.Trace, trace2_id)
            assert trace1 is not None
            assert trace2 is not None
            assert trace1.project_rowid == trace2.project_rowid
            session_id = trace1.project_session_rowid
            project_session = await session.get(models.ProjectSession, session_id)
            assert project_session is not None
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid.in_([trace1_id, trace2_id]))
                )
            ).all()
            assert len(spans) == 2

        # Delete both traces from the session
        result = await gql_client.execute(
            self.DELETE_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace1_id))),
                    str(GlobalID("Trace", str(trace2_id))),
                ]
            },
        )
        assert not result.errors

        async with db() as session:
            # Verify session was deleted
            project_session = await session.get(models.ProjectSession, session_id)
            assert project_session is None

            # Verify traces were deleted
            trace1 = await session.get(models.Trace, trace1_id)
            trace2 = await session.get(models.Trace, trace2_id)
            assert trace1 is None
            assert trace2 is None

            # Verify spans were deleted
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid.in_([trace1_id, trace2_id]))
                )
            ).all()
            assert len(spans) == 0

    async def test_delete_traces_fails_with_non_existent_trace_id(
        self,
        gql_client: AsyncGraphQLClient,
        trace_ids_to_delete: tuple[int, ...],
        db: DbSessionFactory,
    ) -> None:
        trace_ids = trace_ids_to_delete
        trace_id = trace_ids[0]

        async with db() as session:
            # Verify trace exists
            trace = await session.get(models.Trace, trace_id)
            assert trace is not None

            # Verify session exists
            assert (session_id := trace.project_session_rowid) is not None
            project_session = await session.get(models.ProjectSession, session_id)
            assert project_session is not None

            # Verify span exists
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) == 1

        # Delete the trace
        result = await gql_client.execute(
            self.DELETE_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace_id))),
                    str(GlobalID("Trace", "1000")),  # non-existent trace id
                ]
            },
        )
        assert result.errors

        async with db() as session:
            # Verify session was not deleted
            project_session = await session.get(models.ProjectSession, session_id)
            assert project_session is not None

            # Verify trace was not deleted
            trace = await session.get(models.Trace, trace_id)
            assert trace is not None

            # Verify spans for the existing trace are not deleted
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) == 1

    async def test_delete_traces_fails_with_traces_from_multiple_projects(
        self,
        gql_client: AsyncGraphQLClient,
        trace_ids_to_delete: tuple[int, ...],
        db: DbSessionFactory,
    ) -> None:
        trace1_id, trace2_id, other_trace_id = trace_ids_to_delete

        async with db() as session:
            # Verify traces
            trace_count = await session.scalar(
                select(func.count())
                .select_from(models.Trace)
                .where(models.Trace.id.in_([trace1_id, trace2_id, other_trace_id]))
            )
            assert trace_count == 3

            # Verify spans
            span_count = await session.scalar(
                select(func.count())
                .select_from(models.Span)
                .where(models.Span.trace_rowid.in_([trace1_id, trace2_id, other_trace_id]))
            )
            assert span_count == 3

            # Verify session
            session_count = await session.scalar(
                select(func.count()).select_from(models.ProjectSession)
            )
            assert session_count == 1

        # Attempt to delete traces from multiple projects
        result = await gql_client.execute(
            self.DELETE_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace1_id))),
                    str(GlobalID("Trace", str(trace2_id))),
                    str(GlobalID("Trace", str(other_trace_id))),
                ]
            },
        )
        assert result.errors

        async with db() as session:
            # Verify traces
            trace_count = await session.scalar(
                select(func.count())
                .select_from(models.Trace)
                .where(models.Trace.id.in_([trace1_id, trace2_id, other_trace_id]))
            )
            assert trace_count == 3

            # Verify spans
            span_count = await session.scalar(
                select(func.count())
                .select_from(models.Span)
                .where(models.Span.trace_rowid.in_([trace1_id, trace2_id, other_trace_id]))
            )
            assert span_count == 3

            # Verify session
            session_count = await session.scalar(
                select(func.count()).select_from(models.ProjectSession)
            )
            assert session_count == 1


@pytest.fixture
async def trace_ids_to_delete(db: DbSessionFactory) -> tuple[int, ...]:
    """
    Creates two projects. The first project has two traces belonging to the same
    session, and the second project has one trace.
    """
    async with db() as session:
        # Create first project
        project1_id = await session.scalar(
            insert(models.Project).values(name="test-project-1").returning(models.Project.id)
        )
        assert project1_id is not None

        # Create a session
        session_id = await session.scalar(
            insert(models.ProjectSession)
            .values(
                session_id="test-session-1",
                project_id=project1_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
            )
            .returning(models.ProjectSession.id)
        )
        assert session_id is not None

        # Create first trace in session
        trace1_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-1",
                project_rowid=project1_id,
                project_session_rowid=session_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert trace1_id is not None

        # Create a span for the first trace
        span1_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace1_id,
                span_id="test-span-id-1",
                parent_id=None,
                name="test span 1",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                attributes={
                    "input": {"value": "test-input", "mime_type": "text/plain"},
                    "output": {"value": "test-output", "mime_type": "text/plain"},
                },
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
        assert span1_id is not None

        # Create second trace in same session
        trace2_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-2",
                project_rowid=project1_id,
                project_session_rowid=session_id,
                start_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert trace2_id is not None

        # Create a span for the second trace
        span2_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace2_id,
                span_id="test-span-id-2",
                parent_id=None,
                name="test span 2",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={
                    "input": {"value": "test-input", "mime_type": "text/plain"},
                    "output": {"value": "test-output", "mime_type": "text/plain"},
                },
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
        assert span2_id is not None

        # Create second project and trace
        project2_id = await session.scalar(
            insert(models.Project).values(name="test-project-2").returning(models.Project.id)
        )
        assert project2_id is not None

        # Create third trace in second project
        trace3_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-3",
                project_rowid=project2_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert trace3_id is not None

        # Create a span for the third trace
        span3_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace3_id,
                span_id="test-span-id-3",
                parent_id=None,
                name="test span 3",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={
                    "input": {"value": "test-input", "mime_type": "text/plain"},
                    "output": {"value": "test-output", "mime_type": "text/plain"},
                },
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
        assert span3_id is not None

        return (trace1_id, trace2_id, trace3_id)
