from datetime import datetime

import pytest
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestTraceTransferMutationMixin:
    TRANSFER_TRACES_MUTATION = """
      mutation($traceIds: [ID!]!, $projectId: ID!) {
        transferTracesToProject(traceIds: $traceIds, projectId: $projectId) {
          __typename
        }
      }
    """

    async def test_transfer_traces_to_project_success(
        self,
        gql_client: AsyncGraphQLClient,
        trace_transfer_fixture: dict[str, int],
        db: DbSessionFactory,
    ) -> None:
        source_project_id = trace_transfer_fixture["source_project_id"]
        dest_project_id = trace_transfer_fixture["dest_project_id"]
        trace1_id = trace_transfer_fixture["trace1_id"]
        trace2_id = trace_transfer_fixture["trace2_id"]

        async with db() as session:
            traces = (
                await session.scalars(
                    select(models.Trace).where(models.Trace.id.in_([trace1_id, trace2_id]))
                )
            ).all()
            assert len(traces) == 2
            assert all(trace.project_rowid == source_project_id for trace in traces)

            trace_annotations = (
                await session.scalars(
                    select(models.TraceAnnotation).where(
                        models.TraceAnnotation.trace_rowid.in_([trace1_id, trace2_id])
                    )
                )
            ).all()
            assert len(trace_annotations) == 2

            span_costs = (
                await session.scalars(
                    select(models.SpanCost).where(
                        models.SpanCost.trace_rowid.in_([trace1_id, trace2_id])
                    )
                )
            ).all()
            assert len(span_costs) == 2

        result = await gql_client.execute(
            self.TRANSFER_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace1_id))),
                    str(GlobalID("Trace", str(trace2_id))),
                ],
                "projectId": str(GlobalID("Project", str(dest_project_id))),
            },
        )
        assert not result.errors

        async with db() as session:
            traces = (
                await session.scalars(
                    select(models.Trace).where(models.Trace.id.in_([trace1_id, trace2_id]))
                )
            ).all()
            assert len(traces) == 2
            assert all(trace.project_rowid == dest_project_id for trace in traces)

            trace_annotations = (
                await session.scalars(
                    select(models.TraceAnnotation).where(
                        models.TraceAnnotation.trace_rowid.in_([trace1_id, trace2_id])
                    )
                )
            ).all()
            assert len(trace_annotations) == 2

            span_costs = (
                await session.scalars(
                    select(models.SpanCost).where(
                        models.SpanCost.trace_rowid.in_([trace1_id, trace2_id])
                    )
                )
            ).all()
            assert len(span_costs) == 2

    async def test_transfer_traces_fails_with_non_existent_trace_id(
        self,
        gql_client: AsyncGraphQLClient,
        trace_transfer_fixture: dict[str, int],
        db: DbSessionFactory,
    ) -> None:
        source_project_id = trace_transfer_fixture["source_project_id"]
        dest_project_id = trace_transfer_fixture["dest_project_id"]
        trace1_id = trace_transfer_fixture["trace1_id"]

        async with db() as session:
            trace = await session.get(models.Trace, trace1_id)
            assert trace is not None
            assert trace.project_rowid == source_project_id

        result = await gql_client.execute(
            self.TRANSFER_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace1_id))),
                    str(GlobalID("Trace", "99999")),
                ],
                "projectId": str(GlobalID("Project", str(dest_project_id))),
            },
        )
        assert result.errors

        async with db() as session:
            trace = await session.get(models.Trace, trace1_id)
            assert trace is not None
            assert trace.project_rowid == source_project_id

    async def test_transfer_traces_fails_with_non_existent_project_id(
        self,
        gql_client: AsyncGraphQLClient,
        trace_transfer_fixture: dict[str, int],
        db: DbSessionFactory,
    ) -> None:
        trace1_id = trace_transfer_fixture["trace1_id"]
        trace2_id = trace_transfer_fixture["trace2_id"]

        async with db() as session:
            traces = (
                await session.scalars(
                    select(models.Trace).where(models.Trace.id.in_([trace1_id, trace2_id]))
                )
            ).all()
            assert len(traces) == 2

        result = await gql_client.execute(
            self.TRANSFER_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace1_id))),
                    str(GlobalID("Trace", str(trace2_id))),
                ],
                "projectId": str(GlobalID("Project", "99999")),
            },
        )
        assert result.errors

        async with db() as session:
            traces = (
                await session.scalars(
                    select(models.Trace).where(models.Trace.id.in_([trace1_id, trace2_id]))
                )
            ).all()
            assert len(traces) == 2
            source_project_id = trace_transfer_fixture["source_project_id"]
            assert all(trace.project_rowid == source_project_id for trace in traces)

    async def test_transfer_traces_fails_with_traces_from_multiple_projects(
        self,
        gql_client: AsyncGraphQLClient,
        trace_transfer_fixture: dict[str, int],
        db: DbSessionFactory,
    ) -> None:
        source_project_id = trace_transfer_fixture["source_project_id"]
        other_project_id = trace_transfer_fixture["other_project_id"]
        dest_project_id = trace_transfer_fixture["dest_project_id"]
        trace1_id = trace_transfer_fixture["trace1_id"]
        other_trace_id = trace_transfer_fixture["other_trace_id"]

        async with db() as session:
            trace1 = await session.get(models.Trace, trace1_id)
            other_trace = await session.get(models.Trace, other_trace_id)
            assert trace1 is not None
            assert other_trace is not None
            assert trace1.project_rowid == source_project_id
            assert other_trace.project_rowid == other_project_id

        result = await gql_client.execute(
            self.TRANSFER_TRACES_MUTATION,
            variables={
                "traceIds": [
                    str(GlobalID("Trace", str(trace1_id))),
                    str(GlobalID("Trace", str(other_trace_id))),
                ],
                "projectId": str(GlobalID("Project", str(dest_project_id))),
            },
        )
        assert result.errors

        async with db() as session:
            trace1 = await session.get(models.Trace, trace1_id)
            other_trace = await session.get(models.Trace, other_trace_id)
            assert trace1 is not None
            assert other_trace is not None
            assert trace1.project_rowid == source_project_id
            assert other_trace.project_rowid == other_project_id

    async def test_transfer_traces_fails_with_empty_trace_list(
        self,
        gql_client: AsyncGraphQLClient,
        trace_transfer_fixture: dict[str, int],
        db: DbSessionFactory,
    ) -> None:
        dest_project_id = trace_transfer_fixture["dest_project_id"]

        result = await gql_client.execute(
            self.TRANSFER_TRACES_MUTATION,
            variables={
                "traceIds": [],
                "projectId": str(GlobalID("Project", str(dest_project_id))),
            },
        )
        assert result.errors


@pytest.fixture
async def trace_transfer_fixture(db: DbSessionFactory) -> dict[str, int]:
    async with db() as session:
        source_project_id = await session.scalar(
            insert(models.Project).values(name="source-project").returning(models.Project.id)
        )
        assert source_project_id is not None

        dest_project_id = await session.scalar(
            insert(models.Project).values(name="dest-project").returning(models.Project.id)
        )
        assert dest_project_id is not None

        other_project_id = await session.scalar(
            insert(models.Project).values(name="other-project").returning(models.Project.id)
        )
        assert other_project_id is not None

        session_id = await session.scalar(
            insert(models.ProjectSession)
            .values(
                session_id="test-session-1",
                project_id=source_project_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
            )
            .returning(models.ProjectSession.id)
        )
        assert session_id is not None

        trace1_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-1",
                project_rowid=source_project_id,
                project_session_rowid=session_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert trace1_id is not None

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

        span_cost1_id = await session.scalar(
            insert(models.SpanCost)
            .values(
                span_rowid=span1_id,
                trace_rowid=trace1_id,
                span_start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                total_cost=1.50,
                total_tokens=100,
                prompt_cost=1.00,
                prompt_tokens=80,
                completion_cost=0.50,
                completion_tokens=20,
            )
            .returning(models.SpanCost.id)
        )
        assert span_cost1_id is not None

        trace_annotation1_id = await session.scalar(
            insert(models.TraceAnnotation)
            .values(
                trace_rowid=trace1_id,
                name="test-annotation-1",
                label="good",
                score=0.9,
                explanation="This is a good trace",
                metadata_={},
                annotator_kind="HUMAN",
                identifier="test-1",
                source="APP",
            )
            .returning(models.TraceAnnotation.id)
        )
        assert trace_annotation1_id is not None

        trace2_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-2",
                project_rowid=source_project_id,
                project_session_rowid=session_id,
                start_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert trace2_id is not None

        span2_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace2_id,
                span_id="test-span-id-2",
                parent_id=None,
                name="test span 2",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
                attributes={
                    "input": {"value": "test-input-2", "mime_type": "text/plain"},
                    "output": {"value": "test-output-2", "mime_type": "text/plain"},
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

        span_cost2_id = await session.scalar(
            insert(models.SpanCost)
            .values(
                span_rowid=span2_id,
                trace_rowid=trace2_id,
                span_start_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                total_cost=2.00,
                total_tokens=150,
                prompt_cost=1.50,
                prompt_tokens=120,
                completion_cost=0.50,
                completion_tokens=30,
            )
            .returning(models.SpanCost.id)
        )
        assert span_cost2_id is not None

        trace_annotation2_id = await session.scalar(
            insert(models.TraceAnnotation)
            .values(
                trace_rowid=trace2_id,
                name="test-annotation-2",
                label="excellent",
                score=0.95,
                explanation="This is an excellent trace",
                metadata_={},
                annotator_kind="HUMAN",
                identifier="test-2",
                source="APP",
            )
            .returning(models.TraceAnnotation.id)
        )
        assert trace_annotation2_id is not None

        other_trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-other",
                project_rowid=other_project_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        assert other_trace_id is not None

        return {
            "source_project_id": source_project_id,
            "dest_project_id": dest_project_id,
            "other_project_id": other_project_id,
            "trace1_id": trace1_id,
            "trace2_id": trace2_id,
            "other_trace_id": other_trace_id,
        }
