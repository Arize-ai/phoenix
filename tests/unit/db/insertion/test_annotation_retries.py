import asyncio
from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.db.insertion.document_annotation import DocumentAnnotationQueueInserter
from phoenix.db.insertion.session_annotation import SessionAnnotationQueueInserter
from phoenix.db.insertion.span_annotation import SpanAnnotationQueueInserter
from phoenix.db.insertion.trace_annotation import TraceAnnotationQueueInserter
from phoenix.db.insertion.types import Precursors, QueueInserter
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace

_MISSING_USER_ID = 999_999


async def _span_annotation(span: models.Span, **_: Any) -> Precursors.SpanAnnotation:
    return Precursors.SpanAnnotation(
        updated_at=datetime.now(timezone.utc),
        span_id=span.span_id,
        obj=models.SpanAnnotation(
            name="never-saved",
            annotator_kind="LLM",
            identifier="",
            source="API",
            metadata_={},
            user_id=_MISSING_USER_ID,
        ),
    )


async def _trace_annotation(trace: models.Trace, **_: Any) -> Precursors.TraceAnnotation:
    return Precursors.TraceAnnotation(
        updated_at=datetime.now(timezone.utc),
        trace_id=trace.trace_id,
        obj=models.TraceAnnotation(
            name="never-saved",
            annotator_kind="LLM",
            identifier="",
            source="API",
            metadata_={},
            user_id=_MISSING_USER_ID,
        ),
    )


async def _document_annotation(span: models.Span, **_: Any) -> Precursors.DocumentAnnotation:
    return Precursors.DocumentAnnotation(
        updated_at=datetime.now(timezone.utc),
        span_id=span.span_id,
        document_position=0,
        obj=models.DocumentAnnotation(
            name="never-saved",
            annotator_kind="LLM",
            document_position=0,
            identifier="",
            source="API",
            metadata_={},
            user_id=_MISSING_USER_ID,
        ),
    )


async def _session_annotation(
    project_session: models.ProjectSession, **_: Any
) -> Precursors.SessionAnnotation:
    return Precursors.SessionAnnotation(
        updated_at=datetime.now(timezone.utc),
        session_id=project_session.session_id,
        obj=models.ProjectSessionAnnotation(
            name="never-saved",
            annotator_kind="LLM",
            identifier="",
            source="API",
            metadata_={},
            user_id=_MISSING_USER_ID,
        ),
    )


@pytest.mark.parametrize(
    "inserter_cls,make_precursor,table",
    [
        pytest.param(
            SpanAnnotationQueueInserter, _span_annotation, models.SpanAnnotation, id="span"
        ),
        pytest.param(
            TraceAnnotationQueueInserter, _trace_annotation, models.TraceAnnotation, id="trace"
        ),
        pytest.param(
            DocumentAnnotationQueueInserter,
            _document_annotation,
            models.DocumentAnnotation,
            id="document",
        ),
        pytest.param(
            SessionAnnotationQueueInserter,
            _session_annotation,
            models.ProjectSessionAnnotation,
            id="session",
        ),
    ],
)
async def test_annotation_that_never_inserts_is_dropped_after_retry_allowance(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
    inserter_cls: type[QueueInserter[Any, Any, Any, Any]],
    make_precursor: Any,
    table: type[models.Base],
) -> None:
    # The row's target exists, but the row itself can never be written (here: a
    # foreign key to a user that does not exist), so every insert attempt fails.
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        span = await _add_span(
            session,
            trace,
            attributes={"retrieval": {"documents": [{"document": {"content": "doc"}}]}},
        )
    precursor = await make_precursor(span=span, trace=trace, project_session=project_session)

    retry_allowance = 3
    inserter = inserter_cls(db, retry_delay_sec=0, retry_allowance=retry_allowance)
    await inserter.enqueue(precursor)

    cycles = 0
    while not inserter.empty and cycles < 10 * retry_allowance:
        await inserter.insert()
        await asyncio.sleep(0.01)  # let the zero-delay retry re-queue the parcel
        cycles += 1

    failures = [r for r in caplog.records if r.getMessage().startswith("Failed to insert for")]
    assert inserter.empty, (
        f"row was still queued after {cycles} insert cycles and {len(failures)} failed "
        f"attempts; a retry allowance of {retry_allowance} should have dropped it"
    )
    assert len(failures) <= retry_allowance + 1
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(table)) == 0
