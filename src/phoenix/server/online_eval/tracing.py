"""Evaluator tracing for online evaluations.

Every online evaluation is traced so a user can see what an evaluation actually
did, into a project belonging to the evaluator that produced it and to nothing
else -- the way a dataset evaluator's traces are kept. Spans are marked as
evaluator-produced on the way out, and the criteria layer refuses to evaluate a
trace project, so evaluator traces cannot feed the evaluations that produced
them.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from secrets import token_hex
from typing import Optional

from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SdkSpan
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.util.types import AttributeValue
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import CanPutItem, DbSessionFactory
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


def new_trace_project(*, evaluator_name: str, project_name: str) -> models.Project:
    """The project a project evaluator's own executions trace into.

    The name is generated rather than derived from the evaluator: project names
    are unique deployment-wide, so a derived name could collide with a project a
    user already has, and a name nobody would type is a name nobody accidentally
    attaches an evaluator to. Dataset evaluators name theirs the same way. That
    leaves the description as the only place the project explains itself.
    """
    return models.Project(
        name=f"project-evaluator-{token_hex(12)}",
        description=f"Traces for project evaluator: {evaluator_name} on project: {project_name}",
    )


async def evaluator_trace_project_id(
    session: AsyncSession,
    *,
    project_evaluator_rowid: int,
) -> Optional[int]:
    """Resolve the project this evaluator's own traces belong in.

    The project is created with the evaluator, so this normally reads it back.
    It is a real project a user can delete, though, and the foreign key clears
    the reference when they do, so a missing one is replaced rather than treated
    as an error. Returns None when the evaluator itself is gone -- deleted while
    the execution that produced the trace was still running -- since there is
    then nothing the trace belongs to.
    """
    criteria = models.ProjectEvaluatorCriteria
    row = (
        await session.execute(
            select(criteria.trace_project_id, criteria.name, models.Project.name)
            .join(models.Project, models.Project.id == criteria.project_id)
            .where(criteria.id == project_evaluator_rowid)
        )
    ).first()
    if row is None:
        return None
    trace_project_id, evaluator_name, project_name = row
    if trace_project_id is not None:
        return trace_project_id
    return await _create_trace_project(
        session,
        project_evaluator_rowid=project_evaluator_rowid,
        evaluator_name=str(evaluator_name),
        project_name=project_name,
    )


async def _create_trace_project(
    session: AsyncSession,
    *,
    project_evaluator_rowid: int,
    evaluator_name: str,
    project_name: str,
) -> Optional[int]:
    criteria = models.ProjectEvaluatorCriteria
    project = new_trace_project(evaluator_name=evaluator_name, project_name=project_name)
    session.add(project)
    await session.flush()
    claimed = await session.execute(
        update(criteria)
        .where(criteria.id == project_evaluator_rowid, criteria.trace_project_id.is_(None))
        .values(trace_project_id=project.id)
    )
    if claimed.rowcount:
        return project.id
    # Another replica got there first, or the evaluator was deleted. Either way
    # the project just created belongs to nothing, and an evaluator with two
    # trace projects would split its own traces between them.
    await session.delete(project)
    return await session.scalar(
        select(criteria.trace_project_id).where(criteria.id == project_evaluator_rowid)
    )


async def persist_evaluator_traces(
    *,
    db: DbSessionFactory,
    tracer: Tracer,
    project_evaluator_rowid: int,
    event_queue: Optional[CanPutItem[DmlEvent]] = None,
) -> None:
    """Write the tracer's spans into the evaluator's own trace project."""
    if db.should_not_insert_or_update:
        return
    async with db() as session:
        project_id = await evaluator_trace_project_id(
            session,
            project_evaluator_rowid=project_evaluator_rowid,
        )
        if project_id is None:
            return
        db_traces = tracer.get_db_traces(project_id=project_id)
        if not db_traces:
            return
        session.add_all(db_traces)
        await session.flush()
    if event_queue is not None:
        event_queue.put(SpanInsertEvent((project_id,)))
