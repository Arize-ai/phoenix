from datetime import datetime

import pytest
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def trace_to_delete(db: DbSessionFactory) -> tuple[int, ...]:
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="test-project").returning(models.Project.id)
        )
        assert project_row_id is not None

        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert trace_id is not None

        span_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="test-span-id",
                parent_id=None,
                name="test span",
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
        assert span_id is not None

        return (trace_id,)


class TestTraceMutationMixin:
    DELETE_TRACES_MUTATION = """
      mutation($traceIds: [GlobalID!]!) {
        deleteTraces(traceIds: $traceIds) {
          __typename
        }
      }
    """

    async def test_delete_traces_from_single_project(
        self,
        gql_client: AsyncGraphQLClient,
        trace_to_delete: tuple[int, int],
        db: DbSessionFactory,
    ) -> None:
        trace_ids = trace_to_delete
        trace_id = trace_ids[0]

        async with db() as session:
            trace = await session.get(models.Trace, trace_id)
            assert trace is not None
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) > 0

        # Delete the trace
        result = await gql_client.execute(
            self.DELETE_TRACES_MUTATION,
            variables={"traceIds": [str(GlobalID("Trace", str(trace_id)))]},
        )
        assert not result.errors

        async with db() as session:
            # Verify trace was deleted
            trace = await session.scalar(select(models.Trace).filter_by(id=trace_id))
            assert trace is None

            # Verify no spans remain for the deleted trace
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) == 0

    async def test_delete_traces_fails_with_non_existent_trace_id(
        self,
        gql_client: AsyncGraphQLClient,
        trace_to_delete: tuple[int, int],
        db: DbSessionFactory,
    ) -> None:
        trace_ids = trace_to_delete
        trace_id = trace_ids[0]

        async with db() as session:
            trace = await session.get(models.Trace, trace_id)
            assert trace is not None
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) > 0

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
            # Verify trace was not deleted
            trace = await session.scalar(select(models.Trace).filter_by(id=trace_id))
            assert trace is not None

            # Verify spans for the existing trace are not deleted
            spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_id)
                )
            ).all()
            assert len(spans) > 0
