from datetime import datetime, timezone
from secrets import token_hex

import pytest
from sqlalchemy import func, select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

OLD = datetime(2020, 1, 1, tzinfo=timezone.utc)
MID = datetime(2020, 6, 1, tzinfo=timezone.utc)
NEW = datetime(2020, 12, 1, tzinfo=timezone.utc)

PROJECT_ID = str(GlobalID("Project", "1"))

DELETE_SPAN = """
mutation ($input: DeleteProjectAnnotationsInput!) {
  deleteProjectSpanAnnotations(input: $input) {
    deletedAnnotationCount
  }
}
"""

DELETE_TRACE = """
mutation ($input: DeleteProjectAnnotationsInput!) {
  deleteProjectTraceAnnotations(input: $input) {
    deletedAnnotationCount
  }
}
"""

DELETE_SESSION = """
mutation ($input: DeleteProjectAnnotationsInput!) {
  deleteProjectSessionAnnotations(input: $input) {
    deletedAnnotationCount
  }
}
"""


@pytest.fixture(autouse=True)
async def annotation_data(db: DbSessionFactory) -> None:
    """A project with span/trace/session annotations at two distinct timestamps.

    For span annotations, the annotation ``created_at`` is deliberately set to the
    opposite of the source span ``start_time`` so the two time-range fields select
    different rows:

    - span_old: source start_time=OLD, annotation created_at=NEW
    - span_new: source start_time=NEW, annotation created_at=OLD
    """
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()

        trace_old = models.Trace(
            project_rowid=project.id,
            trace_id="trace-old",
            start_time=OLD,
            end_time=OLD,
        )
        trace_new = models.Trace(
            project_rowid=project.id,
            trace_id="trace-new",
            start_time=NEW,
            end_time=NEW,
        )
        session.add_all([trace_old, trace_new])
        await session.flush()

        def _span(trace_rowid: int, span_id: str, start_time: datetime) -> models.Span:
            return models.Span(
                trace_rowid=trace_rowid,
                span_id=span_id,
                name=span_id,
                span_kind="internal",
                start_time=start_time,
                end_time=start_time,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )

        span_old = _span(trace_old.id, "span-old", OLD)
        span_new = _span(trace_new.id, "span-new", NEW)
        session.add_all([span_old, span_new])

        session_old = models.ProjectSession(
            project_id=project.id, session_id="sess-old", start_time=OLD, end_time=OLD
        )
        session_new = models.ProjectSession(
            project_id=project.id, session_id="sess-new", start_time=NEW, end_time=NEW
        )
        session.add_all([session_old, session_new])
        await session.flush()

        def _span_anno(span_rowid: int, name: str, created_at: datetime) -> models.SpanAnnotation:
            return models.SpanAnnotation(
                span_rowid=span_rowid,
                name=name,
                annotator_kind="HUMAN",
                source="APP",
                metadata_={},
                identifier=token_hex(4),
                created_at=created_at,
            )

        # span "quality": created_at opposite of source start_time; plus a "relevance"
        session.add_all(
            [
                _span_anno(span_old.id, "quality", NEW),
                _span_anno(span_new.id, "quality", OLD),
                _span_anno(span_old.id, "relevance", NEW),
            ]
        )

        for trace_rowid, created_at in ((trace_old.id, OLD), (trace_new.id, NEW)):
            session.add(
                models.TraceAnnotation(
                    trace_rowid=trace_rowid,
                    name="quality",
                    annotator_kind="HUMAN",
                    source="APP",
                    metadata_={},
                    identifier=token_hex(4),
                    created_at=created_at,
                )
            )

        for sess_rowid, created_at in ((session_old.id, OLD), (session_new.id, NEW)):
            session.add(
                models.ProjectSessionAnnotation(
                    project_session_id=sess_rowid,
                    name="quality",
                    annotator_kind="HUMAN",
                    source="APP",
                    metadata_={},
                    identifier=token_hex(4),
                    created_at=created_at,
                )
            )

        await session.commit()


async def _span_count(db: DbSessionFactory, name: str) -> int:
    async with db() as session:
        return await session.scalar(  # type: ignore[return-value]
            select(func.count())
            .select_from(models.SpanAnnotation)
            .where(models.SpanAnnotation.name == name)
        )


class TestProjectAnnotationMutations:
    async def test_delete_all_span_annotations_by_name(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        result = await gql_client.execute(
            DELETE_SPAN,
            {"input": {"projectId": PROJECT_ID, "annotationName": "quality"}},
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteProjectSpanAnnotations"]["deletedAnnotationCount"] == 2
        # The matching annotations are gone; other names are untouched.
        assert await _span_count(db, "quality") == 0
        assert await _span_count(db, "relevance") == 1

    async def test_delete_span_annotations_filters_by_created_at(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        # Range [MID, inf) over created_at selects span_old's annotation (created NEW).
        result = await gql_client.execute(
            DELETE_SPAN,
            {
                "input": {
                    "projectId": PROJECT_ID,
                    "annotationName": "quality",
                    "timeRange": {"start": MID.isoformat()},
                    "timeRangeField": "ANNOTATION_CREATED_AT",
                }
            },
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteProjectSpanAnnotations"]["deletedAnnotationCount"] == 1
        # Only one "quality" remains (the one created OLD on span_new).
        assert await _span_count(db, "quality") == 1

    async def test_delete_span_annotations_filters_by_source_start_time(
        self, db: DbSessionFactory, gql_client: AsyncGraphQLClient
    ) -> None:
        # Range [MID, inf) over source start_time selects span_new's annotation.
        result = await gql_client.execute(
            DELETE_SPAN,
            {
                "input": {
                    "projectId": PROJECT_ID,
                    "annotationName": "quality",
                    "timeRange": {"start": MID.isoformat()},
                    "timeRangeField": "SOURCE_START_TIME",
                }
            },
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteProjectSpanAnnotations"]["deletedAnnotationCount"] == 1
        assert await _span_count(db, "quality") == 1

    async def test_delete_trace_annotations_by_name(self, gql_client: AsyncGraphQLClient) -> None:
        result = await gql_client.execute(
            DELETE_TRACE,
            {"input": {"projectId": PROJECT_ID, "annotationName": "quality"}},
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteProjectTraceAnnotations"]["deletedAnnotationCount"] == 2

    async def test_delete_session_annotations_by_name(self, gql_client: AsyncGraphQLClient) -> None:
        result = await gql_client.execute(
            DELETE_SESSION,
            {"input": {"projectId": PROJECT_ID, "annotationName": "quality"}},
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteProjectSessionAnnotations"]["deletedAnnotationCount"] == 2

    async def test_delete_with_no_matches_returns_zero(
        self, gql_client: AsyncGraphQLClient
    ) -> None:
        result = await gql_client.execute(
            DELETE_SPAN,
            {"input": {"projectId": PROJECT_ID, "annotationName": "does-not-exist"}},
        )
        assert not result.errors
        assert result.data is not None
        assert result.data["deleteProjectSpanAnnotations"]["deletedAnnotationCount"] == 0

    async def test_delete_with_invalid_time_range_errors(
        self, gql_client: AsyncGraphQLClient
    ) -> None:
        result = await gql_client.execute(
            DELETE_SPAN,
            {
                "input": {
                    "projectId": PROJECT_ID,
                    "annotationName": "quality",
                    "timeRange": {"start": NEW.isoformat(), "end": OLD.isoformat()},
                }
            },
        )
        assert result.errors
        assert "Invalid time range" in result.errors[0].message

    async def test_delete_with_invalid_project_id_errors(
        self, gql_client: AsyncGraphQLClient
    ) -> None:
        # A well-formed global ID of the wrong node type is rejected by the resolver.
        result = await gql_client.execute(
            DELETE_SPAN,
            {
                "input": {
                    "projectId": str(GlobalID("Span", "1")),
                    "annotationName": "quality",
                }
            },
        )
        assert result.errors
        assert "Invalid project ID" in result.errors[0].message
