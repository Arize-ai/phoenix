"""Evaluator tracing for online evaluations."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Optional

from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SdkSpan
from opentelemetry.sdk.trace import SpanProcessor
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.trace.attributes import AttributeValue
from phoenix.tracers import Tracer

logger = logging.getLogger(__name__)

EVALUATOR_TRACE_MARKER_ATTRIBUTE = "phoenix.evaluator_trace"
"""Marks a span as produced by a Phoenix evaluator rather than by an application."""

PROJECT_EVALUATOR_ID_ATTRIBUTE = "phoenix.project_evaluator_id"
"""The evaluator whose execution produced the span, as its node id."""

PROJECT_EVALUATOR_ID_ATTRIBUTE_PATH = PROJECT_EVALUATOR_ID_ATTRIBUTE.split(".")
"""The same attribute as a key path, which is how attributes are stored on a span."""

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


async def persist_evaluator_traces(
    *,
    db: DbSessionFactory,
    tracer: Tracer,
    project_evaluator_id: int,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
) -> None:
    """Write the tracer's spans into the evaluator's own trace project."""
    if db.should_not_insert_or_update:
        return
    async with db() as session:
        binding_row = (
            await session.execute(
                select(
                    models.ProjectEvaluator.trace_project_id,
                    models.ProjectEvaluator.deleted_at,
                    models.ProjectEvaluator.tracing_enabled,
                )
                .where(models.ProjectEvaluator.id == project_evaluator_id)
                .with_for_update(read=True)
            )
        ).one_or_none()
        if (
            binding_row is None
            or binding_row.deleted_at is not None
            or not binding_row.tracing_enabled
        ):
            logger.info(
                "Dropping evaluator trace: project evaluator %s is deleted, missing, or untraced",
                project_evaluator_id,
            )
            return
        project_id = int(binding_row.trace_project_id)
        trace_project_deleted_at = await session.scalar(
            select(models.Project.deleted_at).where(models.Project.id == project_id)
        )
        if trace_project_deleted_at is not None:
            return
        db_traces = tracer.get_db_traces(project_id=project_id)
        if not db_traces:
            return
        session.add_all(db_traces)
        await session.flush()
    if event_queue is not None:
        event_queue.put(SpanInsertEvent((project_id,)))
