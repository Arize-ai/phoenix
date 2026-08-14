"""Evaluator tracing for online evaluations.

Every online evaluation is traced into one global ``evaluators`` project so a
user can see what an evaluation actually did. Spans are marked as
evaluator-produced on the way out, and the criteria layer refuses to evaluate
the destination project, so evaluator traces cannot feed the evaluations that
produced them.
"""

from __future__ import annotations

import logging
from typing import Optional

from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SdkSpan
from opentelemetry.sdk.trace import SpanProcessor
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import EVALUATORS_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.tracers import Tracer

logger = logging.getLogger(__name__)

EVALUATOR_TRACE_MARKER_ATTRIBUTE = "phoenix.evaluator_trace"
"""Marks a span as produced by a Phoenix evaluator rather than by an application."""


class _EvaluatorTraceMarker(SpanProcessor):
    """Stamps the evaluator marker on every span the evaluator emits."""

    def on_start(self, span: SdkSpan, parent_context: Optional[Context] = None) -> None:
        span.set_attribute(EVALUATOR_TRACE_MARKER_ATTRIBUTE, True)


def marked_evaluator_tracer(tracer: Tracer) -> Tracer:
    """Return the tracer with evaluator marking installed."""
    tracer.tracer_provider.add_span_processor(_EvaluatorTraceMarker())
    return tracer


async def evaluators_project_id(session: AsyncSession, dialect: SupportedSQLDialect) -> int:
    """Resolve the evaluator-trace project, creating it if it does not exist."""
    await session.execute(
        insert_on_conflict(
            {
                "name": EVALUATORS_PROJECT_NAME,
                "description": "Traces from evaluator executions",
            },
            table=models.Project,
            dialect=dialect,
            unique_by=("name",),
            on_conflict=OnConflict.DO_NOTHING,
        )
    )
    project_id = await session.scalar(
        select(models.Project.id).where(models.Project.name == EVALUATORS_PROJECT_NAME)
    )
    assert project_id is not None
    return project_id


async def persist_evaluator_traces(
    *,
    db: DbSessionFactory,
    tracer: Tracer,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
) -> None:
    """Write the tracer's spans into the evaluators project."""
    if db.should_not_insert_or_update:
        return
    async with db() as session:
        project_id = await evaluators_project_id(session, db.dialect)
        db_traces = tracer.get_db_traces(project_id=project_id)
        if not db_traces:
            return
        session.add_all(db_traces)
        await session.flush()
    if event_queue is not None:
        event_queue.put(SpanInsertEvent((project_id,)))
