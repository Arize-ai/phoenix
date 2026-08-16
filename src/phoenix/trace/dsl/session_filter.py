"""SessionFilter — the session-grain sibling of :class:`~phoenix.trace.dsl.filter.SpanFilter`.

Session intrinsics bind to ``ProjectSession`` columns; per-session aggregate names bind to
grouped-by-session subqueries from :mod:`phoenix.db.session_aggregates` that are LEFT JOINed on
demand; ``user.id`` and ``metadata["k"]`` read the session's earliest root span. Comprehensions
(``any(s.status_code == "ERROR" for s in spans)``) range over the iterables catalogued below and
compile over the element table in whichever of the two lowerings the caller asks for.
"""

import ast
import typing
from dataclasses import dataclass, field
from itertools import count
from types import MappingProxyType

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import distinct, func, literal, not_, select
from sqlalchemy.orm import Mapped, aliased
from sqlalchemy.sql.expression import Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models
from phoenix.db.models import LatencyMs, SafeJsonBoolean, SafeJsonFloat
from phoenix.db.session_aggregates import (
    SESSION_ROWID,
    SPAN_ROWID,
    VALUE,
    SessionAggregate,
    apply_session_scope,
    cost_summary_by_session,
    earliest_root_span_by_session,
    num_traces_by_session,
    num_traces_with_error_by_session,
    root_span_attribute_case_insensitive_contains_by_session,
    root_span_io_value_by_session,
    span_kind_count_by_session,
    token_counts_by_session,
)
from phoenix.trace.dsl.filter import (
    COMPREHENSION_NAMES,
    QUANTIFIER_NAMES,
    AliasedAnnotationRelation,
    ComprehensionSpec,
    NameMap,
    _compile_condition,
    _eval_globals,
    _FilterBindings,
    _IterableGrammar,
    _join_annotations,
)

__all__ = ["SessionFilter", "SESSION_BINDINGS", "SESSION_FILTER_DESCRIPTIONS"]

# Which physical shape a predicate takes. "probe" emits one subquery per candidate session row, so
# a statement with a LIMIT stops as soon as it has enough matches; "scan" makes a single pass over
# the element tables, joined once, and is what a statement that must touch every session wants.
FilterLowering: typing.TypeAlias = typing.Literal["scan", "probe"]


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


class _ElementField(typing.NamedTuple):
    """One field a loop variable exposes: the element-model attribute and how it is typed."""

    attribute: str
    kind: typing.Literal["string", "float", "datetime", "boolean"]


class _NestedIterable(typing.NamedTuple):
    """An iterable reached from an element of another one, e.g. ``trace.spans`` for a trace."""

    iterable: str
    correlate: typing.Callable[[typing.Any, typing.Any], typing.Any]


class _IterableSpec(typing.NamedTuple):
    """How one iterable's elements are found, typed, and tied back to a session.

    ``joins`` walks from the element table toward ``Trace``, which is where ``session_key`` and
    ``project_key`` read from for every iterable that is not itself session-keyed.
    """

    model: typing.Any
    fields: typing.Mapping[str, _ElementField]
    joins: tuple[typing.Any, ...]
    session_key: typing.Callable[[typing.Any], typing.Any]
    project_key: typing.Optional[typing.Callable[[typing.Any], typing.Any]] = None
    uppercase_fields: frozenset[str] = frozenset()
    nested: typing.Mapping[str, _NestedIterable] = MappingProxyType({})


# Leaf per-span token counts, never the cumulative_* rollups: summing cumulative counts over a
# session multi-counts tokens through wrapping agent/tool spans (#12768).
_SPAN_ELEMENT_FIELDS: typing.Mapping[str, _ElementField] = MappingProxyType(
    {
        "name": _ElementField("name", "string"),
        "span_kind": _ElementField("span_kind", "string"),
        "status_code": _ElementField("status_code", "string"),
        "latency_ms": _ElementField("latency_ms", "float"),
        "llm_token_count_prompt": _ElementField("llm_token_count_prompt", "float"),
        "llm_token_count_completion": _ElementField("llm_token_count_completion", "float"),
        "llm_token_count_total": _ElementField("llm_token_count_total", "float"),
    }
)
_TRACE_ELEMENT_FIELDS: typing.Mapping[str, _ElementField] = MappingProxyType(
    {
        "start_time": _ElementField("start_time", "datetime"),
        "end_time": _ElementField("end_time", "datetime"),
        "latency_ms": _ElementField("latency_ms", "float"),
    }
)
_ANNOTATION_ELEMENT_FIELDS: typing.Mapping[str, _ElementField] = MappingProxyType(
    {
        "name": _ElementField("name", "string"),
        "label": _ElementField("label", "string"),
        "score": _ElementField("score", "float"),
    }
)
_COST_DETAIL_ELEMENT_FIELDS: typing.Mapping[str, _ElementField] = MappingProxyType(
    {
        "token_type": _ElementField("token_type", "string"),
        "is_prompt": _ElementField("is_prompt", "boolean"),
        "cost": _ElementField("cost", "float"),
        "tokens": _ElementField("tokens", "float"),
        "cost_per_token": _ElementField("cost_per_token", "float"),
    }
)

_ITERABLE_SPECS: typing.Mapping[str, _IterableSpec] = MappingProxyType(
    {
        "spans": _IterableSpec(
            model=models.Span,
            fields=_SPAN_ELEMENT_FIELDS,
            joins=(models.Trace,),
            session_key=lambda element: models.Trace.project_session_rowid,
            project_key=lambda element: models.Trace.project_rowid,
            uppercase_fields=frozenset({"span_kind", "status_code"}),
        ),
        "traces": _IterableSpec(
            model=models.Trace,
            fields=_TRACE_ELEMENT_FIELDS,
            joins=(),
            session_key=lambda element: element.project_session_rowid,
            project_key=lambda element: element.project_rowid,
            nested=MappingProxyType(
                {
                    "spans": _NestedIterable(
                        "spans", lambda element, parent: element.trace_rowid == parent.id
                    ),
                }
            ),
        ),
        "session_annotations": _IterableSpec(
            model=models.ProjectSessionAnnotation,
            fields=_ANNOTATION_ELEMENT_FIELDS,
            joins=(),
            session_key=lambda element: element.project_session_id,
        ),
        "span_annotations": _IterableSpec(
            model=models.SpanAnnotation,
            fields=_ANNOTATION_ELEMENT_FIELDS,
            joins=(models.Span, models.Trace),
            session_key=lambda element: models.Trace.project_session_rowid,
            project_key=lambda element: models.Trace.project_rowid,
        ),
        "span_cost_details": _IterableSpec(
            model=models.SpanCostDetail,
            fields=_COST_DETAIL_ELEMENT_FIELDS,
            joins=(models.SpanCost, models.Trace),
            session_key=lambda element: models.Trace.project_session_rowid,
            project_key=lambda element: models.Trace.project_rowid,
        ),
    }
)


def _element_column(source: typing.Any, name: str, spec: _IterableSpec) -> typing.Any:
    """What a loop variable's field compiles to on ``source`` — the element model or an alias."""
    return getattr(source, spec.fields[name].attribute)


def _element_bindings(spec: _IterableSpec) -> _FilterBindings:
    """The language a predicate written against one iterable's loop variable compiles in."""

    def columns(kind: str) -> NameMap:
        return MappingProxyType(
            {
                name: _element_column(spec.model, name, spec)
                for name, field in spec.fields.items()
                if field.kind == kind
            }
        )

    return _FilterBindings(
        string_names=columns("string"),
        float_names=columns("float"),
        datetime_names=columns("datetime"),
        boolean_names=columns("boolean"),
        extra_names=MappingProxyType({}),
        aggregate_names=frozenset(),
        legacy_replacements=MappingProxyType({}),
        uppercase_names=spec.uppercase_fields,
        # Annotations are not reachable from inside a comprehension, so the annotation-join
        # surface below is never consulted for element bindings.
        annotation_model=models.SpanAnnotation,
        annotation_fk="span_rowid",
        entity_id=models.Span.id,
        annotation_table_prefix="span_annotation",
        reject_unbound_names=True,
        case_insensitive_containment=True,
        strict_semantics=True,
    )


_SESSION_ITERABLES: typing.Mapping[str, _IterableGrammar] = MappingProxyType(
    {
        name: _IterableGrammar(
            element_bindings=_element_bindings(spec),
            nested=MappingProxyType(
                {attribute: nested.iterable for attribute, nested in spec.nested.items()}
            ),
        )
        for name, spec in _ITERABLE_SPECS.items()
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
    quantifiers=frozenset(COMPREHENSION_NAMES),
    exists_names=frozenset(_EXISTS_ATTRIBUTE_PATHS),
    iterables=_SESSION_ITERABLES,
    annotation_iterable="session_annotations",
    case_insensitive_containment=True,
    strict_semantics=True,
    attribute_proxies=frozenset({"user.id"}),
)

SESSION_FILTER_DESCRIPTIONS: typing.Mapping[str, str] = MappingProxyType(
    {
        "session_id": (
            "Session identifier string. `in` containment ignores case, `==` matches exactly."
        ),
        "start_time": (
            "Session start timestamp (earliest trace) — a point comparison against the "
            "session's own bound, unlike the view's time range, which selects sessions that "
            "overlap a window. Compare against ISO 8601 strings, e.g. "
            "start_time > '2026-07-01T00:00:00+00:00'; a literal without a timezone offset is "
            "rejected, so include one (e.g. a trailing 'Z')."
        ),
        "end_time": (
            "Session end timestamp (latest trace) — a point comparison against the session's "
            "own bound, unlike the view's time range, which selects sessions that overlap a "
            "window. Compare against ISO 8601 strings, e.g. "
            "end_time < '2026-07-04T12:00:00+00:00'; a literal without a timezone offset is "
            "rejected, so include one (e.g. a trailing 'Z')."
        ),
        "duration_ms": "Session wall-clock duration in milliseconds (end_time - start_time).",
        "num_traces": (
            "Number of traces in the session; 0 when absent, never null. Instrumentation that "
            "starts one trace per exchange makes this an approximate conversation-turn count, "
            "but Phoenix does not enforce that shape."
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
            "Whether ANY root span in the session has an input.value containing the given text, "
            "ignoring case — an existential test over root spans, not a value. Containment "
            "only: write `'x' in any_input`, never `any_input == 'x'`. `'x' not in any_input` "
            "also matches sessions with no root-span input at all. Payloads are "
            "instrumentation-shaped, not user-role messages."
        ),
        "any_output": (
            "Whether ANY root span in the session has an output.value containing the given "
            "text, ignoring case — an existential test over root spans, not a value. "
            "Containment only: write `'x' in any_output`, never `any_output == 'x'`. "
            "`'x' not in any_output` also matches sessions with no root-span output at all. "
            "Payloads are instrumentation-shaped, not agent-role messages."
        ),
        "first_input": (
            "The input.value string of the session's earliest root span, ordered by trace "
            "start time, then trace id, then span id. `in` containment ignores case, `==` is "
            "exact; a session with no such value is SQL null, so `not in` and comparisons "
            "exclude it (target it with `is None`). To search every root span rather than the "
            "earliest one, use the cheaper any_input."
        ),
        "last_output": (
            "The output.value string of the session's latest root span, ordered by trace "
            "start time, then trace id, then span id, descending. `in` containment ignores "
            "case, `==` is exact; a session with no such value is SQL null, so "
            "`not in last_output` excludes it (target it with `is None`). To search every "
            "root span rather than the latest one, use the cheaper any_output."
        ),
        "attributes[...]": (
            "Root-span attribute access by OTel wire key: string subscripts are joined with dots, "
            'so attributes["llm.model_name"] and attributes["llm"]["model_name"] name the same '
            "key and match it however ingestion nested it (the fully dot-split shape wins if "
            "several coexist). Numeric subscripts address the stored JSON literally. Values are "
            "read from the session's earliest root span and are string-cast unless explicitly "
            "cast. `in` containment ignores case, `==` matches exactly. A missing key is SQL "
            "null, so comparisons and `not in` exclude those sessions (target them with "
            "`is None`)."
        ),
        "user.id": (
            'Accepted proxy for attributes["user.id"]; reads from the session\'s earliest '
            "root span. Missing on that span is SQL null (target it with `is None`)."
        ),
        'metadata["key"]': (
            'Accepted proxy for attributes["metadata.key"]; reads from the session\'s '
            "earliest root span. Missing on that span is SQL null (target it with `is None`)."
        ),
        "spans": (
            "Every span in the session. Iterate it with any/all/len/max/min/sum, e.g. "
            'any(span.status_code == "ERROR" for span in spans).'
        ),
        "traces": (
            "The session's traces, ordered by start time. A trace element also iterates its "
            'spans, e.g. any(any(span.span_kind == "TOOL" for span in trace.spans) for trace '
            "in traces). Instrumentation that starts one trace per exchange makes a trace an "
            "approximate conversation turn, but Phoenix does not enforce that shape."
        ),
        "session_annotations": (
            "Annotations attached to the session itself, e.g. "
            'any(annotation.name == "Quality" and annotation.score > 0.8 '
            "for annotation in session_annotations)."
        ),
        "span_annotations": (
            "Every annotation on any span in the session, flattened to session scope, e.g. "
            'any(annotation.label == "hallucinated" for annotation in span_annotations).'
        ),
        "span_cost_details": (
            "The per-token-type cost rows of every span in the session, flattened to session "
            "scope (not rolled up per session), e.g. sum(cost_detail.tokens for cost_detail "
            'in span_cost_details if cost_detail.token_type == "cache_read").'
        ),
        "spans.name": "Span name.",
        "spans.span_kind": "Span kind, e.g. LLM, TOOL, RETRIEVER; casing is ignored.",
        "spans.status_code": "Span status: OK, ERROR, or UNSET; casing is ignored.",
        "spans.latency_ms": "Span duration in milliseconds.",
        "spans.llm_token_count_prompt": (
            "Prompt tokens recorded on this span; null on spans that record none."
        ),
        "spans.llm_token_count_completion": (
            "Completion tokens recorded on this span; null on spans that record none."
        ),
        "spans.llm_token_count_total": (
            "Prompt plus completion tokens recorded on this span; 0 when it records none."
        ),
        "traces.start_time": "Trace start timestamp. Compare against ISO 8601 strings.",
        "traces.end_time": "Trace end timestamp. Compare against ISO 8601 strings.",
        "traces.latency_ms": "Trace duration in milliseconds.",
        "session_annotations.name": "Annotation name.",
        "session_annotations.label": "Annotation label; null when the annotation has none.",
        "session_annotations.score": "Annotation score; null when the annotation has none.",
        "span_annotations.name": "Annotation name.",
        "span_annotations.label": "Annotation label; null when the annotation has none.",
        "span_annotations.score": "Annotation score; null when the annotation has none.",
        "span_cost_details.token_type": (
            "Token type this cost row covers, e.g. input, output, audio."
        ),
        "span_cost_details.is_prompt": "Whether this cost row counts toward the prompt side.",
        "span_cost_details.cost": "Cost of this row; null when no cost is configured.",
        "span_cost_details.tokens": "Token count for this row; null when unrecorded.",
        "span_cost_details.cost_per_token": "Cost per token for this row; null when unrecorded.",
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
            return root_span_attribute_case_insensitive_contains_by_session(
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


_REDUCTION_FUNCTIONS: typing.Mapping[str, typing.Any] = MappingProxyType(
    {
        "sum": func.sum,
        "max": func.max,
        "min": func.min,
    }
)


def _comprehension_bindings(
    stmt: Select[typing.Any],
    specs: typing.Iterable[ComprehensionSpec],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
    lowering: FilterLowering,
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    """Build each comprehension's subquery, keyed by the name it was extracted to."""
    aliases = count()

    def element_scope(
        spec: ComprehensionSpec,
    ) -> tuple[_IterableSpec, typing.Any, dict[str, typing.Any], typing.Any]:
        """Alias the element table and evaluate the spec's predicate in the element's language."""
        iterable = _ITERABLE_SPECS[spec.iterable]
        element = aliased(iterable.model, name=f"{spec.iterable}_{next(aliases)}")
        columns = {name: _element_column(element, name, iterable) for name in iterable.fields}
        nested_bindings = {child.name: build(child, spec, element) for child in spec.children}
        element_globals = _eval_globals(
            _SESSION_ITERABLES[spec.iterable].element_bindings,
            {},
            {**spec.literal_bindings, **columns, **nested_bindings},
        )
        predicate: typing.Any = (
            None if spec.predicate is None else eval(spec.predicate, element_globals)
        )
        return iterable, element, element_globals, predicate

    def build(
        spec: ComprehensionSpec,
        parent: typing.Optional[ComprehensionSpec] = None,
        parent_element: typing.Optional[typing.Any] = None,
    ) -> typing.Any:
        iterable, element, element_globals, predicate = element_scope(spec)
        if spec.kind in QUANTIFIER_NAMES:
            stmt = select(literal(1))
        elif spec.kind == "len":
            stmt = select(func.count())
        else:
            stmt = select(_REDUCTION_FUNCTIONS[spec.kind](predicate))
        stmt = stmt.select_from(element)
        if parent is None:
            for target in iterable.joins:
                stmt = stmt.join(target)
            session_key = iterable.session_key(element)
            stmt = stmt.where(session_key == models.ProjectSession.id)
            stmt = apply_session_scope(
                stmt,
                session_key,
                project_key=None if iterable.project_key is None else iterable.project_key(element),
                keys=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            )
        else:
            # A nested comprehension is correlated to the enclosing element, which the enclosing
            # subquery has already scoped to the session.
            nested = _ITERABLE_SPECS[parent.iterable].nested[
                typing.cast(str, spec.nested_attribute)
            ]
            stmt = stmt.where(nested.correlate(element, parent_element))
        if spec.condition is not None:
            stmt = stmt.where(eval(spec.condition, element_globals))
        if spec.kind == "any":
            return stmt.where(predicate).exists()
        if spec.kind == "all":
            # A missing field fails every comparison, so an element whose predicate is NULL has
            # to count as a counterexample: `IS NOT TRUE`, never `NOT`.
            return not_(stmt.where(predicate.is_not(True)).exists())
        if spec.kind in ("len", "sum"):
            return func.coalesce(stmt.scalar_subquery(), 0)
        # `max`/`min` over nothing is SQL NULL, which reads as missing and fails every comparison.
        return stmt.scalar_subquery()

    def build_scan(spec: ComprehensionSpec) -> typing.Any:
        """The outermost comprehension as one uncorrelated pass over the element table.

        `any` becomes a semi-join on the session rowid; reductions become a grouped subquery
        the caller LEFT JOINs. `all` never takes this shape — see the dispatch below — and
        nested comprehensions keep the correlated shape.
        """
        iterable, element, element_globals, predicate = element_scope(spec)
        session_key = iterable.session_key(element)

        def scan(*columns: typing.Any) -> Select[typing.Any]:
            stmt = select(*columns).select_from(element)
            for target in iterable.joins:
                stmt = stmt.join(target)
            stmt = apply_session_scope(
                stmt,
                session_key,
                project_key=None if iterable.project_key is None else iterable.project_key(element),
                keys=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            )
            if spec.condition is not None:
                stmt = stmt.where(eval(spec.condition, element_globals))
            return stmt

        if spec.kind == "any":
            return models.ProjectSession.id.in_(scan(session_key).where(predicate))
        value = func.count() if spec.kind == "len" else _REDUCTION_FUNCTIONS[spec.kind](predicate)
        return scan(session_key.label(SESSION_ROWID), value.label(VALUE)).group_by(session_key)

    bindings_map: dict[str, typing.Any] = {}
    for spec in specs:
        if lowering == "probe":
            bindings_map[spec.name] = build(spec)
            continue
        if lowering != "scan":
            raise ValueError(f"Unknown filter lowering: {lowering}")
        if spec.kind == "all":
            # `all` keeps the correlated NOT EXISTS shape under both lowerings. The uncorrelated
            # alternative — `id NOT IN (SELECT session_key … WHERE predicate IS NOT TRUE)` — puts
            # every element that fails the test in the anti-set, which is most of the element
            # table whenever the predicate is selective (i.e. whenever someone is actually
            # filtering), and `NOT IN` over a set that size degrades past statement timeouts
            # where the correlated form plans as a per-session anti-join probe. Measured on a
            # 3M-span corpus: >90 s uncorrelated vs. under a second correlated. The correlated
            # shape is also immune to the `NOT IN` NULL trap (a nullable session key never
            # matches the correlation, where one NULL in a `NOT IN` set empties the result).
            bindings_map[spec.name] = build(spec)
            continue
        lowered = build_scan(spec)
        if spec.kind in QUANTIFIER_NAMES:
            bindings_map[spec.name] = lowered
            continue
        subquery = lowered.subquery()
        stmt = stmt.outerjoin(subquery, models.ProjectSession.id == subquery.c[SESSION_ROWID])
        column = subquery.c[VALUE]
        # `max`/`min` over nothing is SQL NULL, which reads as missing and fails every comparison.
        bindings_map[spec.name] = (
            func.coalesce(column, 0) if spec.kind in ("len", "sum") else column
        )
    return stmt, bindings_map


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
    _literal_bindings: dict[str, typing.Any] = field(init=False, repr=False)
    _referenced_aggregates: frozenset[str] = field(init=False, repr=False)
    _referenced_exists_names: frozenset[str] = field(init=False, repr=False)
    _referenced_root_span_io_names: frozenset[str] = field(init=False, repr=False)
    _references_root_span: bool = field(init=False, repr=False)
    _comprehensions: tuple[ComprehensionSpec, ...] = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    @property
    def can_duplicate_sessions(self) -> bool:
        """Whether applying this condition to a session query can emit several rows per session.

        Annotation access is the only relation that joins a table keyed on more than the session
        — ``ProjectSessionAnnotation`` is unique on ``(name, project_session_id, identifier)``, so
        one session can carry several rows under one name. Every other relation the compiler joins
        contributes at most one row per session.
        """
        return bool(self.condition) and bool(self._aliased_annotation_relations)

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
        object.__setattr__(self, "_literal_bindings", compiled_condition.literal_bindings)
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
        object.__setattr__(self, "_comprehensions", compiled_condition.comprehensions)

    def __call__(
        self,
        stmt: Select[typing.Any],
        candidate_session_rowids: CandidateRowids = None,
        project_rowids: typing.Optional[typing.Sequence[int]] = None,
        start_time: typing.Optional[typing.Any] = None,
        end_time: typing.Optional[typing.Any] = None,
        lowering: FilterLowering = "scan",
        prejoined_aggregate: typing.Optional[tuple[str, typing.Any]] = None,
    ) -> Select[typing.Any]:
        """Join the referenced aggregate / annotation / root-span relations and apply the predicate.

        ``stmt`` must select from ``ProjectSession`` — the joins key on ``ProjectSession.id``.
        ``prejoined_aggregate`` is a ``(builder key, subquery)`` pair already joined onto ``stmt``
        by the caller; aggregate names from that family bind to its columns instead of emitting
        another subquery.
        """
        if not self.condition:
            return stmt
        extra_bindings: dict[str, typing.Any] = {
            **self._literal_bindings,
            "SafeJsonFloat": _safe_json_float,
            "SafeJsonBoolean": _safe_json_boolean,
        }
        stmt, aggregate_bindings = _join_aggregates(
            stmt,
            self._referenced_aggregates,
            candidate_session_rowids=candidate_session_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
            lowering=lowering,
            prejoined_aggregate=prejoined_aggregate,
        )
        extra_bindings.update(aggregate_bindings)
        stmt, comprehension_bindings = _comprehension_bindings(
            stmt,
            self._comprehensions,
            candidate_session_rowids=candidate_session_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
            lowering=lowering,
        )
        extra_bindings.update(comprehension_bindings)
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
        lowering: FilterLowering = "scan",
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
            lowering=lowering,
        )
        return stmt.scalar_subquery()


def _join_aggregates(
    stmt: Select[typing.Any],
    referenced_aggregates: typing.Iterable[str],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
    lowering: FilterLowering,
    prejoined_aggregate: typing.Optional[tuple[str, typing.Any]] = None,
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    grouped: dict[str, tuple[typing.Callable[[], SessionAggregate], list[tuple[str, str]]]] = {}
    for name in referenced_aggregates:
        spec = _AGGREGATE_SPECS[name]
        grouped.setdefault(spec.builder_key, (spec.builder, []))[1].append(
            (name, spec.value_column)
        )
    prejoined_key, prejoined_subquery = prejoined_aggregate or (None, None)
    bindings_map: dict[str, typing.Any] = {}
    for builder_key, (builder, names) in grouped.items():
        if (
            prejoined_subquery is not None
            and builder_key == prejoined_key
            and all(value_column in prejoined_subquery.c for _, value_column in names)
        ):
            for name, value_column in names:
                bindings_map[name] = func.coalesce(prejoined_subquery.c[value_column], 0)
            continue
        aggregate = builder()
        if lowering == "scan":
            subquery = aggregate.as_grouped_subquery(
                keys=candidate_session_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            ).subquery()
            stmt = stmt.outerjoin(subquery, models.ProjectSession.id == subquery.c[SESSION_ROWID])
            for name, value_column in names:
                bindings_map[name] = func.coalesce(subquery.c[value_column], 0)
        elif lowering == "probe":
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
            raise ValueError(f"Unknown filter lowering: {lowering}")
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


def _wire_key_candidate_paths(keys: typing.Sequence[str]) -> tuple[tuple[str, ...], ...]:
    """Candidate storage paths for one OTel wire key, fully dot-split path first.

    Ingestion's unflatten trie either splits every dot or, on a prefix collision, leaves the
    remainder from one boundary onward as a single literal segment — so those are the only shapes
    probed, in that order, and the fully split path wins when several coexist.
    """
    segments = ".".join(keys).split(".")
    paths = [tuple(segments)]
    for j in range(len(segments) - 1, -1, -1):
        candidate = (*segments[:j], ".".join(segments[j:]))
        if candidate != paths[0]:
            paths.append(candidate)
    return tuple(paths)


class _RootSpanAttributeValue:
    """One ``attributes[...]`` chain, resolved against every candidate storage path at cast time."""

    def __init__(self, column: typing.Any, keys: typing.Sequence[typing.Any]) -> None:
        self._column = column
        self._keys = tuple(keys)

    def _cast(self, cast: typing.Callable[[typing.Any], typing.Any]) -> typing.Any:
        if not all(isinstance(key, str) for key in self._keys):
            return cast(self._column[list(self._keys)])
        casted = [cast(self._column[list(path)]) for path in _wire_key_candidate_paths(self._keys)]
        return casted[0] if len(casted) == 1 else func.coalesce(*casted)

    def as_string(self) -> typing.Any:
        return self._cast(lambda value: value.as_string())

    def as_float(self) -> typing.Any:
        return self._cast(lambda value: value.as_float())

    def as_boolean(self) -> typing.Any:
        return self._cast(lambda value: value.as_boolean())


def _safe_json_float(value: typing.Any) -> typing.Any:
    """``SafeJsonFloat`` for the session grain: a root-span attribute read is
    resolved against every candidate storage path before the safe cast wraps
    each real JSON element (a raw reader object cannot be bound as SQL)."""
    if isinstance(value, _RootSpanAttributeValue):
        return value._cast(SafeJsonFloat)
    return SafeJsonFloat(value)


def _safe_json_boolean(value: typing.Any) -> typing.Any:
    """``SafeJsonBoolean`` with the same root-span attribute routing as above."""
    if isinstance(value, _RootSpanAttributeValue):
        return value._cast(SafeJsonBoolean)
    return SafeJsonBoolean(value)


class _RootSpanAttributes:
    """The session-grain ``attributes`` binding: wire-key access to the earliest root span."""

    def __init__(self, column: typing.Any) -> None:
        self._column = column

    def __getitem__(self, keys: typing.Sequence[typing.Any]) -> _RootSpanAttributeValue:
        return _RootSpanAttributeValue(self._column, keys)


def _join_root_span(
    stmt: Select[typing.Any],
    candidate_session_rowids: CandidateRowids,
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
) -> tuple[Select[typing.Any], _RootSpanAttributes]:
    root_span = earliest_root_span_by_session(
        keys=candidate_session_rowids,
        project_rowids=project_rowids,
        start_time=start_time,
        end_time=end_time,
    ).subquery()
    aliased_root_span = aliased(models.Span, name="session_root_span")
    stmt = stmt.outerjoin(root_span, models.ProjectSession.id == root_span.c[SESSION_ROWID])
    stmt = stmt.outerjoin(aliased_root_span, aliased_root_span.id == root_span.c[SPAN_ROWID])
    return stmt, _RootSpanAttributes(aliased_root_span.attributes)
