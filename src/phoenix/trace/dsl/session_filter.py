"""SessionFilter — the session-grain sibling of :class:`~phoenix.trace.dsl.filter.SpanFilter`.

Session intrinsics bind to ``ProjectSession`` columns; per-session aggregate names bind to
grouped-by-session subqueries from :mod:`phoenix.db.session_aggregates` that are LEFT JOINed on
demand; ``user.id`` and ``metadata["k"]`` read the session's earliest root span.
"""

import ast
import typing
from dataclasses import dataclass, field
from types import MappingProxyType

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Mapped, aliased
from sqlalchemy.sql.expression import Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models
from phoenix.db.models import LatencyMs
from phoenix.db.session_aggregates import (
    SESSION_ROWID,
    SPAN_ROWID,
    VALUE,
    SessionAggregate,
    cost_summary_by_session,
    earliest_root_span_by_session,
    num_traces_by_session,
    num_traces_with_error_by_session,
    root_span_attribute_text_contains_by_session,
    root_span_io_value_by_session,
    span_kind_count_by_session,
    token_counts_by_session,
)
from phoenix.trace.dsl.filter import (
    AliasedAnnotationRelation,
    NameMap,
    _compile_condition,
    _eval_globals,
    _FilterBindings,
    _join_annotations,
)

__all__ = ["SessionFilter", "SESSION_BINDINGS", "SESSION_FILTER_DESCRIPTIONS"]

# Benchmarked in scripts/perf/session_filter_perf.py: "grouped" costs 411ms pg / 1.44s sqlite per
# page at 100k sessions, where "correlated" stays ~2ms flat; "grouped" only wins when every row is
# scanned anyway (counts, sweeps).
AggregateShape: typing.TypeAlias = typing.Literal["grouped", "correlated"]


class _AggregateSpec(typing.NamedTuple):
    """How an aggregate name resolves to a grouped subquery and one of its value columns."""

    builder_key: str
    builder: typing.Callable[[], SessionAggregate]
    value_column: str


_AGGREGATE_SPECS: typing.Mapping[str, _AggregateSpec] = MappingProxyType(
    {
        "num_traces": _AggregateSpec("num_traces", num_traces_by_session, "num_traces"),
        "num_traces_with_error": _AggregateSpec(
            "num_traces_with_error", num_traces_with_error_by_session, "num_traces_with_error"
        ),
        "token_count_prompt": _AggregateSpec("token_counts", token_counts_by_session, "prompt"),
        "token_count_completion": _AggregateSpec(
            "token_counts", token_counts_by_session, "completion"
        ),
        "token_count_total": _AggregateSpec("token_counts", token_counts_by_session, "total"),
        "prompt_cost": _AggregateSpec("cost_summary", cost_summary_by_session, "prompt_cost"),
        "completion_cost": _AggregateSpec(
            "cost_summary", cost_summary_by_session, "completion_cost"
        ),
        "total_cost": _AggregateSpec("cost_summary", cost_summary_by_session, "total_cost"),
        "tool_span_count": _AggregateSpec(
            "span_kind_tool", lambda: span_kind_count_by_session("TOOL"), "span_kind_count"
        ),
        "llm_span_count": _AggregateSpec(
            "span_kind_llm", lambda: span_kind_count_by_session("LLM"), "span_kind_count"
        ),
    }
)

_ROOT_SPAN_ATTRIBUTES = "attributes"
_ROOT_SPAN_INPUT_VALUE = tuple(SpanAttributes.INPUT_VALUE.split("."))
_ROOT_SPAN_OUTPUT_VALUE = tuple(SpanAttributes.OUTPUT_VALUE.split("."))
_EXISTS_ATTRIBUTE_PATHS: typing.Mapping[str, tuple[str, ...]] = MappingProxyType(
    {
        "any_input": _ROOT_SPAN_INPUT_VALUE,
        "any_output": _ROOT_SPAN_OUTPUT_VALUE,
    }
)
_ROOT_SPAN_IO_NAMES: typing.Mapping[str, typing.Literal["first_input", "last_output"]] = (
    MappingProxyType(
        {
            "first_input": "first_input",
            "last_output": "last_output",
        }
    )
)

_SESSION_STRING_NAMES: NameMap = MappingProxyType(
    {
        "session_id": models.ProjectSession.session_id,
        "first_input": models.ProjectSession.session_id,
        "last_output": models.ProjectSession.session_id,
    }
)
_SESSION_FLOAT_NAMES: NameMap = MappingProxyType(
    {
        "duration_ms": LatencyMs(models.ProjectSession.start_time, models.ProjectSession.end_time),
    }
)
_SESSION_DATETIME_NAMES: NameMap = MappingProxyType(
    {
        "start_time": models.ProjectSession.start_time,
        "end_time": models.ProjectSession.end_time,
    }
)

SESSION_BINDINGS = _FilterBindings(
    string_names=_SESSION_STRING_NAMES,
    float_names=_SESSION_FLOAT_NAMES,
    datetime_names=_SESSION_DATETIME_NAMES,
    # `attributes` is bound per-instance to the earliest root span, not to a static column.
    extra_names=MappingProxyType({}),
    aggregate_names=frozenset(_AGGREGATE_SPECS),
    legacy_replacements=MappingProxyType({}),
    uppercase_names=frozenset(),
    annotation_model=models.ProjectSessionAnnotation,
    annotation_fk="project_session_id",
    entity_id=models.ProjectSession.id,
    annotation_table_prefix="project_session_annotation",
    reject_unbound_names=True,
    quantifiers=frozenset(),
    exists_names=frozenset(_EXISTS_ATTRIBUTE_PATHS),
)

SESSION_FILTER_DESCRIPTIONS: typing.Mapping[str, str] = MappingProxyType(
    {
        "session_id": "Session identifier string.",
        "start_time": (
            "Session start timestamp (earliest trace). Compare against ISO 8601 strings, "
            "e.g. start_time > '2026-07-01'; values without a timezone are read as UTC."
        ),
        "end_time": (
            "Session end timestamp (latest trace). Compare against ISO 8601 strings, "
            "e.g. end_time < '2026-07-04T12:00:00+00:00'; values without a timezone are "
            "read as UTC."
        ),
        "duration_ms": "Session wall-clock duration in milliseconds (end_time - start_time).",
        "num_traces": (
            "Number of traces in the session — ≈ conversation turns (one trace records one "
            "exchange: an input and the response produced for it); 0 when absent, never null."
        ),
        "num_traces_with_error": (
            "Number of traces in the session containing an errored span; 0 when absent, never null."
        ),
        "token_count_prompt": (
            "Total LLM prompt tokens across the session's spans; 0 when absent, never null."
        ),
        "token_count_completion": (
            "Total LLM completion tokens across the session's spans; 0 when absent, never null."
        ),
        "token_count_total": (
            "Total LLM tokens (prompt + completion) across the session's spans; "
            "0 when absent, never null."
        ),
        "prompt_cost": (
            "Total prompt cost across the session's spans; "
            "0 when no cost is configured, never null."
        ),
        "completion_cost": (
            "Total completion cost across the session's spans; "
            "0 when no cost is configured, never null."
        ),
        "total_cost": (
            "Total cost across the session's spans; 0 when no cost is configured, never null."
        ),
        "tool_span_count": "Number of TOOL spans in the session; 0 when absent, never null.",
        "llm_span_count": "Number of LLM spans in the session; 0 when absent, never null.",
        "any_input": (
            "Case-sensitive containment in some root span's input payload; "
            "instrumentation-shaped, not a user-role message. "
            "`'x' not in any_input` also matches sessions with no input (NOT EXISTS)."
        ),
        "any_output": (
            "Case-sensitive containment in some root span's output payload; "
            "instrumentation-shaped, not an agent-role message. "
            "`'x' not in any_output` also matches sessions with no output (NOT EXISTS)."
        ),
        "first_input": (
            "Case-sensitive turn-1-only root span input.value string — the input of the "
            "session's first trace; a session with no first input is SQL null, so `not in` and "
            "comparisons exclude it (target it with `is None`). For containment anywhere in "
            "the session, prefer the cheaper any_input."
        ),
        "last_output": (
            "Case-sensitive final-turn-only root span output.value string — the output of the "
            "session's last trace; a session with no last output is SQL null, so `not in "
            "last_output` excludes it (target it with `is None`). For containment anywhere in "
            "the session, prefer the cheaper any_output."
        ),
        "attributes[...]": (
            "Open root-span attribute access. Use canonical bracket paths such as "
            'attributes["input"]["value"]; values are read from the session\'s earliest root span '
            "and are string-cast unless explicitly cast. A missing attribute is SQL null, so "
            "comparisons and `not in` exclude those sessions (target them with `is None`)."
        ),
        "user.id": (
            'Accepted proxy for attributes["user"]["id"]; reads from the session\'s earliest '
            "root span. Missing on that span is SQL null (target it with `is None`)."
        ),
        'metadata["key"]': (
            'Accepted proxy for attributes["metadata"]["key"]; reads from the session\'s '
            "earliest root span. Missing on that span is SQL null (target it with `is None`)."
        ),
    }
)


def _referenced_names(translated: ast.Expression) -> set[str]:
    return {node.id for node in ast.walk(translated) if isinstance(node, ast.Name)}


CandidateRowids: typing.TypeAlias = typing.Optional[typing.Collection[int]]


def _exists_bindings(
    referenced_exists_names: typing.Iterable[str],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
) -> dict[str, typing.Callable[[typing.Any], typing.Any]]:
    bindings_map: dict[str, typing.Callable[[typing.Any], typing.Any]] = {}
    for name in referenced_exists_names:
        attribute_path = _EXISTS_ATTRIBUTE_PATHS[name]

        def contains(
            substring: typing.Any,
            attribute_path: tuple[str, ...] = attribute_path,
        ) -> typing.Any:
            return root_span_attribute_text_contains_by_session(
                attribute_path,
                substring,
                models.ProjectSession.id,
                keys=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            )

        bindings_map[name] = contains
    return bindings_map


@dataclass(frozen=True)
class SessionFilter:
    """Compiles a session filter condition and applies it as a ``Select -> Select`` transform."""

    condition: str = ""
    valid_annotation_names: typing.Optional[typing.Sequence[str]] = None
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    _aliased_annotation_relations: tuple[AliasedAnnotationRelation, ...] = field(
        init=False, repr=False
    )
    _aliased_annotation_attributes: dict[str, Mapped[typing.Any]] = field(init=False, repr=False)
    _referenced_aggregates: frozenset[str] = field(init=False, repr=False)
    _referenced_exists_names: frozenset[str] = field(init=False, repr=False)
    _referenced_root_span_io_names: frozenset[str] = field(init=False, repr=False)
    _references_root_span: bool = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        if not (source := self.condition):
            return
        compiled_condition = _compile_condition(
            source, SESSION_BINDINGS, self.valid_annotation_names
        )
        referenced = _referenced_names(compiled_condition.translated)
        object.__setattr__(self, "translated", compiled_condition.translated)
        object.__setattr__(self, "compiled", compiled_condition.compiled)
        object.__setattr__(
            self, "_aliased_annotation_relations", compiled_condition.aliased_annotation_relations
        )
        object.__setattr__(
            self, "_aliased_annotation_attributes", compiled_condition.aliased_annotation_attributes
        )
        object.__setattr__(
            self, "_referenced_aggregates", frozenset(referenced & set(_AGGREGATE_SPECS))
        )
        object.__setattr__(
            self, "_referenced_exists_names", frozenset(referenced & set(_EXISTS_ATTRIBUTE_PATHS))
        )
        object.__setattr__(
            self,
            "_referenced_root_span_io_names",
            frozenset(referenced & set(_ROOT_SPAN_IO_NAMES)),
        )
        object.__setattr__(self, "_references_root_span", _ROOT_SPAN_ATTRIBUTES in referenced)

    def __call__(
        self,
        stmt: Select[typing.Any],
        candidate_session_rowids: CandidateRowids = None,
        project_rowids: typing.Optional[typing.Sequence[int]] = None,
        start_time: typing.Optional[typing.Any] = None,
        end_time: typing.Optional[typing.Any] = None,
        aggregate_shape: AggregateShape = "grouped",
    ) -> Select[typing.Any]:
        """Join the referenced aggregate / annotation / root-span relations and apply the predicate.

        ``stmt`` must select from ``ProjectSession`` — the joins key on ``ProjectSession.id``.
        """
        if not self.condition:
            return stmt
        extra_bindings: dict[str, typing.Any] = {}
        stmt, aggregate_bindings = _join_aggregates(
            stmt,
            self._referenced_aggregates,
            candidate_session_rowids=candidate_session_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
            aggregate_shape=aggregate_shape,
        )
        extra_bindings.update(aggregate_bindings)
        extra_bindings.update(
            _exists_bindings(
                self._referenced_exists_names,
                candidate_session_rowids=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            )
        )
        stmt, root_span_io_bindings = _join_root_span_io_values(
            stmt,
            self._referenced_root_span_io_names,
            candidate_session_rowids=candidate_session_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
        )
        extra_bindings.update(root_span_io_bindings)
        if self._references_root_span:
            stmt, root_span_attributes = _join_root_span(
                stmt,
                candidate_session_rowids=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            )
            extra_bindings[_ROOT_SPAN_ATTRIBUTES] = root_span_attributes
        stmt = _join_annotations(stmt, SESSION_BINDINGS, self._aliased_annotation_relations)
        return stmt.where(
            eval(
                self.compiled,
                _eval_globals(
                    SESSION_BINDINGS, self._aliased_annotation_attributes, extra_bindings
                ),
            )
        )

    def as_session_rowids_subquery(
        self,
        project_rowids: typing.Optional[typing.Sequence[int]] = None,
        start_time: typing.Optional[typing.Any] = None,
        end_time: typing.Optional[typing.Any] = None,
        candidate_session_rowids: CandidateRowids = None,
        aggregate_shape: AggregateShape = "grouped",
    ) -> ScalarSelect[int]:
        stmt: Select[typing.Any] = select(distinct(models.ProjectSession.id))
        if project_rowids is not None:
            stmt = stmt.where(models.ProjectSession.project_id.in_(project_rowids))
        if candidate_session_rowids is not None:
            stmt = stmt.where(models.ProjectSession.id.in_(candidate_session_rowids))
        # Interval-overlap time scoping, matching the sessions connection's time range filter.
        if start_time is not None:
            stmt = stmt.where(start_time <= models.ProjectSession.end_time)
        if end_time is not None:
            stmt = stmt.where(models.ProjectSession.start_time < end_time)
        stmt = self(
            stmt,
            candidate_session_rowids=candidate_session_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
            aggregate_shape=aggregate_shape,
        )
        return stmt.scalar_subquery()


def _join_aggregates(
    stmt: Select[typing.Any],
    referenced_aggregates: typing.Iterable[str],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
    aggregate_shape: AggregateShape,
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    grouped: dict[str, tuple[typing.Callable[[], SessionAggregate], list[tuple[str, str]]]] = {}
    for name in referenced_aggregates:
        spec = _AGGREGATE_SPECS[name]
        grouped.setdefault(spec.builder_key, (spec.builder, []))[1].append(
            (name, spec.value_column)
        )
    bindings_map: dict[str, typing.Any] = {}
    for builder, names in grouped.values():
        aggregate = builder()
        if aggregate_shape == "grouped":
            subquery = aggregate.as_grouped_subquery(
                keys=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            ).subquery()
            stmt = stmt.outerjoin(subquery, models.ProjectSession.id == subquery.c[SESSION_ROWID])
            for name, value_column in names:
                bindings_map[name] = func.coalesce(subquery.c[value_column], 0)
        elif aggregate_shape == "correlated":
            for name, value_column in names:
                bindings_map[name] = func.coalesce(
                    aggregate.as_correlated_scalar(
                        models.ProjectSession.id,
                        value=value_column,
                        project_rowids=project_rowids,
                        start_time=start_time,
                        end_time=end_time,
                    ),
                    0,
                )
        else:
            raise ValueError(f"Unknown aggregate shape: {aggregate_shape}")
    return stmt, bindings_map


def _join_root_span_io_values(
    stmt: Select[typing.Any],
    referenced_io_names: typing.Iterable[str],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    bindings_map: dict[str, typing.Any] = {}
    for name in referenced_io_names:
        subquery = root_span_io_value_by_session(
            _ROOT_SPAN_IO_NAMES[name],
            keys=candidate_session_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
        ).subquery()
        stmt = stmt.outerjoin(subquery, models.ProjectSession.id == subquery.c[SESSION_ROWID])
        bindings_map[name] = subquery.c[VALUE]
    return stmt, bindings_map


def _join_root_span(
    stmt: Select[typing.Any],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
) -> tuple[Select[typing.Any], typing.Any]:
    root_span = earliest_root_span_by_session(
        keys=candidate_session_rowids,
        project_rowids=project_rowids,
        start_time=start_time,
        end_time=end_time,
    ).subquery()
    aliased_root_span = aliased(models.Span, name="session_root_span")
    stmt = stmt.outerjoin(root_span, models.ProjectSession.id == root_span.c[SESSION_ROWID])
    stmt = stmt.outerjoin(aliased_root_span, aliased_root_span.id == root_span.c[SPAN_ROWID])
    return stmt, aliased_root_span.attributes
