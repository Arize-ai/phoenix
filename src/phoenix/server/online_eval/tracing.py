"""Evaluator tracing for online evaluations.

Every online evaluation is traced into one global ``evaluators`` project so a
user can see what an evaluation actually did. Spans are marked as
evaluator-produced on the way out, and the criteria layer refuses to evaluate
the destination project, so evaluator traces cannot feed the evaluations that
produced them.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Optional

from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SdkSpan
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.util.types import AttributeValue
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

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

PROJECT_EVALUATOR_ID_ATTRIBUTE = "phoenix.project_evaluator_id"
"""The evaluator whose execution produced the span, as its node id."""

PROJECT_EVALUATOR_NAME_ATTRIBUTE = "phoenix.project_evaluator_name"
"""The evaluator's name, as the user gave it."""

_PROJECT_EVALUATOR_NODE_TYPE = "ProjectEvaluator"
# The GraphQL type name is spelled out rather than imported: the API type module
# already imports from this package, so importing it back would be circular.


class _EvaluatorSpanAttributes(SpanProcessor):
    """Stamps identity on every span an evaluator execution emits.

    Marking at span start rather than at each ``start_as_current_span`` site
    covers the whole tree — every evaluator's root span and its children alike —
    without the evaluators having to know they are being traced.
    """

    def __init__(self, attributes: Mapping[str, AttributeValue]) -> None:
        self._attributes = dict(attributes)

    def on_start(self, span: SdkSpan, parent_context: Optional[Context] = None) -> None:
        span.set_attributes(self._attributes)


def marked_evaluator_tracer(
    tracer: Tracer,
    *,
    project_evaluator_rowid: int,
    project_evaluator_name: str,
) -> Tracer:
    """Return the tracer with evaluator marking and identity installed."""
    tracer.tracer_provider.add_span_processor(
        _EvaluatorSpanAttributes(
            {
                EVALUATOR_TRACE_MARKER_ATTRIBUTE: True,
                PROJECT_EVALUATOR_ID_ATTRIBUTE: str(
                    GlobalID(_PROJECT_EVALUATOR_NODE_TYPE, str(project_evaluator_rowid))
                ),
                PROJECT_EVALUATOR_NAME_ATTRIBUTE: project_evaluator_name,
            }
        )
    )
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
