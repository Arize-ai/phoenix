"""Values an online evaluator binds by name without an input mapping.

The vocabulary is the filter language's own scalar names for each grain, so a
name that works in a project's filter condition also works as a template
variable or a code-evaluator parameter. Values come from the same builders the
filter language compiles against, which is what keeps a preview, a filter, and
an evaluation agreeing on what ``first_input`` or ``num_traces`` means.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from itertools import chain
from typing import Any, Collection, Iterable, Mapping

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
from phoenix.db.types.evaluators import InputMapping
from phoenix.trace.dsl.filter import SPAN_BINDINGS
from phoenix.trace.dsl.session_filter import _AGGREGATE_SPECS, SESSION_BINDINGS

INTERFACE_SLOT_NAMES = frozenset({"input", "output"})
"""The context's own slots, which an evaluator already binds from the context."""

_ROOT_SPAN_IO_NAMES: tuple[RootSpanIOKind, ...] = ("first_input", "last_output")
_USER_ID = "user_id"
_SESSION_ROW_NAMES = frozenset({"session_id", "duration_ms"})


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
BOUND_VARIABLE_NAMES = SPAN_BOUND_VARIABLE_NAMES | SESSION_BOUND_VARIABLE_NAMES


def unmapped_bound_variable_names(
    *,
    input_schema: Mapping[str, Any],
    input_mapping: InputMapping,
    evaluation_target: str,
) -> frozenset[str]:
    """Variables an evaluator declares that this grain can supply and nothing else binds.

    An explicit mapping entry wins, then the context slot of the same name, and
    only what neither of those covers is bound from the grain vocabulary.
    """
    if evaluation_target == "SPAN":
        vocabulary = SPAN_BOUND_VARIABLE_NAMES
    elif evaluation_target == "SESSION":
        vocabulary = SESSION_BOUND_VARIABLE_NAMES
    else:
        return frozenset()
    mapped = set(input_mapping.path_mapping or {}) | set(input_mapping.literal_mapping or {})
    return frozenset(
        name
        for name in input_schema.get("properties", {})
        if name in vocabulary and name not in mapped and name not in INTERFACE_SLOT_NAMES
    )


def span_bound_variables(entity: Mapping[str, Any]) -> dict[str, Any]:
    """The span vocabulary, read from the ``span`` entity document of a span context."""
    return {name: entity[name] for name in sorted(SPAN_BOUND_VARIABLE_NAMES)}


def bind_context_bound_variables(
    *,
    context: Mapping[str, Any],
    input_schema: Mapping[str, Any],
    input_mapping: InputMapping,
) -> InputMapping:
    """Bind declared-but-unmapped vocabulary names from the entity document itself.

    The preview path's counterpart of the executor's hydration-time binding: the
    entity documents a preview receives already carry the vocabulary values the
    online path computes (the span document holds its scalars; the session
    document is materialized with its aggregates), so unmapped names are read
    from the document rather than recomputed. A name the document does not hold
    stays unbound and fails the same way it would online.
    """
    if isinstance(context.get("span"), Mapping):
        evaluation_target, entity = "SPAN", context["span"]
    elif isinstance(context.get("session"), Mapping):
        evaluation_target, entity = "SESSION", context["session"]
    else:
        return input_mapping
    names = unmapped_bound_variable_names(
        input_schema=input_schema,
        input_mapping=input_mapping,
        evaluation_target=evaluation_target,
    )
    available = {name: entity[name] for name in sorted(names) if name in entity}
    if not available:
        return input_mapping
    return InputMapping(
        path_mapping=dict(input_mapping.path_mapping or {}),
        literal_mapping={**available, **(input_mapping.literal_mapping or {})},
    )


def session_duration_ms(start_time: datetime, end_time: datetime) -> float:
    """A session's wall-clock duration, rounded the way the filter language rounds it."""
    return round((end_time - start_time).total_seconds() * 1000, 1)


async def load_session_bound_variables(
    session: AsyncSession,
    *,
    project_session_rowids: Collection[int],
    names: Collection[str],
) -> dict[int, dict[str, Any]]:
    """Session vocabulary values for a batch of sessions, keyed by session row id.

    Only requested names are queried, and every aggregate sharing one builder is
    answered for the whole batch in a single statement.
    """
    rowids = sorted(set(project_session_rowids))
    requested = frozenset(names) & SESSION_BOUND_VARIABLE_NAMES
    resolved: dict[int, dict[str, Any]] = {rowid: {} for rowid in rowids}
    if not rowids or not requested:
        return resolved
    if requested & _SESSION_ROW_NAMES:
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
            resolved[rowid]["duration_ms"] = session_duration_ms(start_time, end_time)
    for io_name in _ROOT_SPAN_IO_NAMES:
        if io_name not in requested:
            continue
        io_rows = await session.execute(root_span_io_value_by_session(io_name, keys=rowids))
        for rowid, value in io_rows:
            resolved[rowid][io_name] = value
    grouped_aggregates: dict[str, list[str]] = defaultdict(list)
    for name in sorted(requested & SESSION_BINDINGS.aggregate_names):
        grouped_aggregates[_AGGREGATE_SPECS[name].builder_key].append(name)
    for group in grouped_aggregates.values():
        specs = [_AGGREGATE_SPECS[name] for name in group]
        aggregate_rows = await session.execute(
            specs[0]
            .builder()
            .as_grouped_subquery(keys=rowids, values=[spec.value_column for spec in specs])
        )
        for aggregate_row in aggregate_rows.mappings():
            values = resolved[aggregate_row[SESSION_ROWID]]
            for name, spec in zip(group, specs):
                values[name] = aggregate_row[spec.value_column]
    if _USER_ID in requested:
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
        for name in requested:
            values.setdefault(name, 0 if name in SESSION_BINDINGS.aggregate_names else None)
    return resolved
