"""The scalar values an evaluation context carries under ``metadata``.

The vocabulary is the filter language's own scalar names for each grain, so a
name that works in a project's filter condition also names a value the
evaluator receives. Values come from the same builders the filter language
compiles against, which is what keeps a preview, a filter, and an evaluation
agreeing on what ``first_input`` or ``num_traces`` means.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from itertools import chain
from typing import Any, Collection, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.session_aggregates import (
    SESSION_ROWID,
    SPAN_ROWID,
    RootSpanIOKind,
    earliest_root_span_by_session,
    root_span_io_value_by_session,
)
from phoenix.db.trace_aggregates import (
    SPAN_ROWID as TRACE_ROOT_SPAN_ROWID,
)
from phoenix.db.trace_aggregates import (
    TRACE_ROWID,
    representative_root_span_by_trace,
)
from phoenix.trace.dsl.filter import SPAN_BINDINGS
from phoenix.trace.dsl.session_filter import _AGGREGATE_SPECS as _SESSION_AGGREGATE_SPECS
from phoenix.trace.dsl.session_filter import SESSION_BINDINGS
from phoenix.trace.dsl.trace_filter import _AGGREGATE_SPECS as _TRACE_AGGREGATE_SPECS
from phoenix.trace.dsl.trace_filter import TRACE_BINDINGS

_ROOT_SPAN_IO_NAMES: tuple[RootSpanIOKind, ...] = ("first_input", "last_output")
_USER_ID = "user_id"


def _bindable(names: Iterable[str]) -> frozenset[str]:
    """The filter language also accepts dotted spellings such as ``context.span_id``,
    which cannot name a template variable or a function parameter."""
    return frozenset(name for name in names if name.isidentifier())


SPAN_BOUND_VARIABLE_NAMES = _bindable(chain(SPAN_BINDINGS.string_names, SPAN_BINDINGS.float_names))
SESSION_BOUND_VARIABLE_NAMES = _bindable(
    chain(
        SESSION_BINDINGS.string_names,
        SESSION_BINDINGS.float_names,
        SESSION_BINDINGS.aggregate_names,
        # The filter language spells this `user.id`, a proxy for the session's
        # earliest root span attribute; a variable name has to be an identifier.
        (_USER_ID,),
    )
)
TRACE_BOUND_VARIABLE_NAMES = _bindable(
    chain(
        TRACE_BINDINGS.string_names,
        TRACE_BINDINGS.float_names,
        TRACE_BINDINGS.aggregate_names,
    )
)
BOUND_VARIABLE_NAMES = (
    SPAN_BOUND_VARIABLE_NAMES | SESSION_BOUND_VARIABLE_NAMES | TRACE_BOUND_VARIABLE_NAMES
)

# The trace filter's names for the displayed root span's input and output. A trace
# context binds them at its top level, so they are loaded with the vocabulary but
# left out of `metadata`, where they would be a second spelling of one concept.
TRACE_ROOT_IO_NAMES = TRACE_BINDINGS.caller_bound_string_names

# Mirrored by the frontend's SPAN/SESSION_METADATA_FIELDS via test_bound_variables.py.
SPAN_METADATA_FIELD_NAMES = frozenset(
    {"start_time", "end_time", "attributes", "events", "annotations"}
)
SESSION_METADATA_FIELD_NAMES = frozenset({"start_time", "end_time", "turns"})
TRACE_METADATA_FIELD_NAMES = frozenset(
    {"start_time", "end_time", "attributes", "events", "trace_annotations"}
)

# Entry shapes inside two of the containers above, mirrored the same way.
SPAN_ANNOTATION_ENTRY_FIELD_NAMES = frozenset(
    {"label", "score", "explanation", "metadata", "annotator_kind", "user_id", "username", "email"}
)
SESSION_TURN_FIELD_NAMES = frozenset({"input", "output", "metadata", "event_time", "span_id"})


def _duration_ms(start_time: datetime, end_time: datetime) -> float:
    """Wall-clock duration, rounded the way the filter language rounds it."""
    return round((end_time - start_time).total_seconds() * 1000, 1)


async def load_session_bound_variables(
    session: AsyncSession,
    project_session_rowids: Collection[int],
) -> dict[int, dict[str, Any]]:
    """Session vocabulary values for a batch of sessions, keyed by session row id.

    Every name in ``SESSION_BOUND_VARIABLE_NAMES`` is loaded, plus the session's
    ``start_time``/``end_time`` record fields, so a caller cannot hand a context
    builder a vocabulary short of the names it binds. Aggregates sharing one
    builder are answered for the whole batch in a single statement.
    """
    rowids = sorted(set(project_session_rowids))
    resolved: dict[int, dict[str, Any]] = {rowid: {} for rowid in rowids}
    if not rowids:
        return resolved
    session_rows = await session.execute(
        select(
            models.ProjectSession.id,
            models.ProjectSession.session_id,
            models.ProjectSession.start_time,
            models.ProjectSession.end_time,
        ).where(models.ProjectSession.id.in_(rowids))
    )
    for rowid, session_id, start_time, end_time in session_rows:
        resolved[rowid]["session_id"] = session_id
        resolved[rowid]["duration_ms"] = _duration_ms(start_time, end_time)
        resolved[rowid]["start_time"] = start_time.isoformat()
        resolved[rowid]["end_time"] = end_time.isoformat()
    for io_name in _ROOT_SPAN_IO_NAMES:
        io_rows = await session.execute(root_span_io_value_by_session(io_name, keys=rowids))
        for rowid, value in io_rows:
            resolved[rowid][io_name] = value
    grouped_aggregates: dict[str, list[str]] = defaultdict(list)
    for name in sorted(SESSION_BINDINGS.aggregate_names):
        grouped_aggregates[_SESSION_AGGREGATE_SPECS[name].builder_key].append(name)
    for group in grouped_aggregates.values():
        specs = [_SESSION_AGGREGATE_SPECS[name] for name in group]
        aggregate_rows = await session.execute(
            specs[0]
            .builder()
            .as_grouped_subquery(keys=rowids, values=[spec.value_column for spec in specs])
        )
        for aggregate_row in aggregate_rows.mappings():
            values = resolved[aggregate_row[SESSION_ROWID]]
            for name, spec in zip(group, specs):
                values[name] = aggregate_row[spec.value_column]
    root_spans = earliest_root_span_by_session(keys=rowids).subquery()
    user_id_rows = await session.execute(
        select(
            root_spans.c[SESSION_ROWID],
            models.Span.attributes[models.USER_ID].as_string(),
        ).join_from(root_spans, models.Span, models.Span.id == root_spans.c[SPAN_ROWID])
    )
    for rowid, value in user_id_rows:
        resolved[rowid][_USER_ID] = value
    # A session with nothing to aggregate reads as it does in a filter condition,
    # where every aggregate is coalesced to zero.
    for values in resolved.values():
        for name in SESSION_BOUND_VARIABLE_NAMES:
            values.setdefault(name, 0 if name in SESSION_BINDINGS.aggregate_names else None)
    return resolved


async def load_trace_bound_variables(
    session: AsyncSession,
    trace_rowids: Collection[int],
) -> dict[int, dict[str, Any]]:
    """Trace vocabulary values for a batch of traces, keyed by trace row id.

    Every name in ``TRACE_BOUND_VARIABLE_NAMES`` is loaded, plus the trace's
    ``start_time``/``end_time`` record fields and the displayed root span's
    ``input``/``output``, so a caller cannot hand a context builder a vocabulary
    short of the names it binds. Aggregates sharing one builder are answered for
    the whole batch in a single statement.
    """
    rowids = sorted(set(trace_rowids))
    resolved: dict[int, dict[str, Any]] = {rowid: {} for rowid in rowids}
    if not rowids:
        return resolved
    trace_rows = await session.execute(
        select(
            models.Trace.id,
            models.Trace.trace_id,
            models.Trace.start_time,
            models.Trace.end_time,
        ).where(models.Trace.id.in_(rowids))
    )
    for rowid, trace_id, start_time, end_time in trace_rows:
        resolved[rowid]["trace_id"] = trace_id
        resolved[rowid]["latency_ms"] = _duration_ms(start_time, end_time)
        resolved[rowid]["start_time"] = start_time.isoformat()
        resolved[rowid]["end_time"] = end_time.isoformat()
    root_spans = representative_root_span_by_trace(keys=rowids).subquery()
    root_io_rows = await session.execute(
        select(
            root_spans.c[TRACE_ROWID],
            models.Span.attributes[models.INPUT_VALUE].as_string(),
            models.Span.attributes[models.OUTPUT_VALUE].as_string(),
        ).join_from(
            root_spans,
            models.Span,
            models.Span.id == root_spans.c[TRACE_ROOT_SPAN_ROWID],
        )
    )
    for rowid, input_value, output_value in root_io_rows:
        resolved[rowid]["input"] = input_value
        resolved[rowid]["output"] = output_value
    grouped_aggregates: dict[str, list[str]] = defaultdict(list)
    for name in sorted(TRACE_BINDINGS.aggregate_names):
        grouped_aggregates[_TRACE_AGGREGATE_SPECS[name].builder_key].append(name)
    for group in grouped_aggregates.values():
        specs = [_TRACE_AGGREGATE_SPECS[name] for name in group]
        aggregate_rows = await session.execute(
            specs[0]
            .builder()
            .as_grouped_subquery(keys=rowids, values=[spec.value_column for spec in specs])
        )
        for aggregate_row in aggregate_rows.mappings():
            values = resolved[aggregate_row[TRACE_ROWID]]
            for name, spec in zip(group, specs):
                values[name] = aggregate_row[spec.value_column]
    # A trace with nothing to aggregate reads as it does in a filter condition,
    # where every aggregate is coalesced to zero.
    for values in resolved.values():
        for name in chain(TRACE_BOUND_VARIABLE_NAMES, TRACE_ROOT_IO_NAMES):
            values.setdefault(name, 0 if name in TRACE_BINDINGS.aggregate_names else None)
    return resolved
