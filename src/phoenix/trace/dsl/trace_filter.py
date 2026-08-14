"""Trace-grain filter expressions over traces and their member rows."""

import ast
import typing
from dataclasses import dataclass, field
from itertools import count
from types import MappingProxyType

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, distinct, func, literal, not_, select
from sqlalchemy.orm import Mapped, aliased
from sqlalchemy.sql.expression import Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models
from phoenix.db.models import SafeJsonBoolean, SafeJsonFloat
from phoenix.db.trace_aggregates import (
    SPAN_ROWID,
    TRACE_ROWID,
    VALUE,
    TraceAggregate,
    cost_summary_by_trace,
    error_count_by_trace,
    num_spans_by_trace,
    representative_root_span_by_trace,
    span_kind_count_by_trace,
    token_counts_by_trace,
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

__all__ = ["TraceFilter", "TRACE_BINDINGS", "TRACE_FILTER_DESCRIPTIONS"]

FilterLowering: typing.TypeAlias = typing.Literal["scan", "probe"]


class _AggregateSpec(typing.NamedTuple):
    builder_key: str
    builder: typing.Callable[[], TraceAggregate]
    value_column: str


_AGGREGATE_SPECS: typing.Mapping[str, _AggregateSpec] = MappingProxyType(
    {
        "num_spans": _AggregateSpec("num_spans", num_spans_by_trace, "num_spans"),
        "error_count": _AggregateSpec("error_count", error_count_by_trace, "error_count"),
        "token_count_prompt": _AggregateSpec("token_counts", token_counts_by_trace, "prompt"),
        "token_count_completion": _AggregateSpec(
            "token_counts", token_counts_by_trace, "completion"
        ),
        "token_count_total": _AggregateSpec("token_counts", token_counts_by_trace, "total"),
        "prompt_cost": _AggregateSpec("cost_summary", cost_summary_by_trace, "prompt_cost"),
        "completion_cost": _AggregateSpec("cost_summary", cost_summary_by_trace, "completion_cost"),
        "total_cost": _AggregateSpec("cost_summary", cost_summary_by_trace, "total_cost"),
        "tool_span_count": _AggregateSpec(
            "span_kind_tool", lambda: span_kind_count_by_trace("TOOL"), "span_kind_count"
        ),
        "llm_span_count": _AggregateSpec(
            "span_kind_llm", lambda: span_kind_count_by_trace("LLM"), "span_kind_count"
        ),
    }
)

_ROOT_SPAN_ATTRIBUTES = "attributes"
_ROOT_SPAN_IO_NAMES = frozenset({"input", "output"})
_ROOT_SPAN_INPUT_VALUE = tuple(SpanAttributes.INPUT_VALUE.split("."))
_ROOT_SPAN_OUTPUT_VALUE = tuple(SpanAttributes.OUTPUT_VALUE.split("."))

_TRACE_STRING_NAMES: NameMap = MappingProxyType({"trace_id": models.Trace.trace_id})
_TRACE_FLOAT_NAMES: NameMap = MappingProxyType({"latency_ms": models.Trace.latency_ms})
_TRACE_DATETIME_NAMES: NameMap = MappingProxyType(
    {
        "start_time": models.Trace.start_time,
        "end_time": models.Trace.end_time,
    }
)


class _ElementField(typing.NamedTuple):
    attribute: str
    kind: typing.Literal["string", "float", "datetime", "boolean"]


class _NestedIterable(typing.NamedTuple):
    iterable: str
    correlate: typing.Callable[[typing.Mapping[typing.Any, typing.Any], typing.Any], typing.Any]


class _IterableSpec(typing.NamedTuple):
    model: typing.Any
    fields: typing.Mapping[str, _ElementField]
    joins: tuple[typing.Any, ...]
    trace_key_model: typing.Any
    uppercase_fields: frozenset[str] = frozenset()
    nested: typing.Mapping[str, _NestedIterable] = MappingProxyType({})


def _correlate_siblings(
    sources: typing.Mapping[typing.Any, typing.Any], parent: typing.Any
) -> typing.Any:
    element = sources[models.Span]
    stored_parent = aliased(models.Span)
    return and_(
        element.trace_rowid == parent.trace_rowid,
        element.parent_id == parent.parent_id,
        element.id != parent.id,
        select(literal(1))
        .select_from(stored_parent)
        .where(
            stored_parent.trace_rowid == parent.trace_rowid,
            stored_parent.span_id == parent.parent_id,
        )
        .exists(),
    )


_SPAN_ELEMENT_FIELDS: typing.Mapping[str, _ElementField] = MappingProxyType(
    {
        "name": _ElementField("name", "string"),
        "parent_id": _ElementField("parent_id", "string"),
        "span_kind": _ElementField("span_kind", "string"),
        "status_code": _ElementField("status_code", "string"),
        "start_time": _ElementField("start_time", "datetime"),
        "end_time": _ElementField("end_time", "datetime"),
        "latency_ms": _ElementField("latency_ms", "float"),
        "cumulative_error_count": _ElementField("cumulative_error_count", "float"),
        "cumulative_llm_token_count_prompt": _ElementField(
            "cumulative_llm_token_count_prompt", "float"
        ),
        "cumulative_llm_token_count_completion": _ElementField(
            "cumulative_llm_token_count_completion", "float"
        ),
        "cumulative_llm_token_count_total": _ElementField(
            "cumulative_llm_token_count_total", "float"
        ),
        "llm_token_count_prompt": _ElementField("llm_token_count_prompt", "float"),
        "llm_token_count_completion": _ElementField("llm_token_count_completion", "float"),
        "llm_token_count_total": _ElementField("llm_token_count_total", "float"),
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
            joins=(),
            trace_key_model=models.Span,
            uppercase_fields=frozenset({"span_kind", "status_code"}),
            nested=MappingProxyType(
                {
                    "children": _NestedIterable(
                        "spans",
                        lambda sources, parent: and_(
                            sources[models.Span].trace_rowid == parent.trace_rowid,
                            sources[models.Span].parent_id == parent.span_id,
                        ),
                    ),
                    "siblings": _NestedIterable("spans", _correlate_siblings),
                    "annotations": _NestedIterable(
                        "span_annotations",
                        lambda sources, parent: (
                            sources[models.SpanAnnotation].span_rowid == parent.id
                        ),
                    ),
                    "cost_details": _NestedIterable(
                        "span_cost_details",
                        lambda sources, parent: sources[models.SpanCost].span_rowid == parent.id,
                    ),
                }
            ),
        ),
        "trace_annotations": _IterableSpec(
            model=models.TraceAnnotation,
            fields=_ANNOTATION_ELEMENT_FIELDS,
            joins=(),
            trace_key_model=models.TraceAnnotation,
        ),
        "span_annotations": _IterableSpec(
            model=models.SpanAnnotation,
            fields=_ANNOTATION_ELEMENT_FIELDS,
            joins=(models.Span,),
            trace_key_model=models.Span,
        ),
        "span_cost_details": _IterableSpec(
            model=models.SpanCostDetail,
            fields=_COST_DETAIL_ELEMENT_FIELDS,
            joins=(models.SpanCost,),
            trace_key_model=models.SpanCost,
        ),
    }
)


def _element_column(source: typing.Any, name: str, spec: _IterableSpec) -> typing.Any:
    column = getattr(source, spec.fields[name].attribute)
    return func.upper(column) if name in spec.uppercase_fields else column


def _element_bindings(spec: _IterableSpec) -> _FilterBindings:
    def columns(kind: str) -> NameMap:
        return MappingProxyType(
            {
                name: _element_column(spec.model, name, spec)
                for name, element_field in spec.fields.items()
                if element_field.kind == kind
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
        annotation_model=models.SpanAnnotation,
        annotation_fk="span_rowid",
        entity_id=models.Span.id,
        annotation_table_prefix="span_annotation",
        reject_unbound_names=True,
        case_insensitive_containment=True,
        strict_semantics=True,
    )


_TRACE_ITERABLES: typing.Mapping[str, _IterableGrammar] = MappingProxyType(
    {
        name: _IterableGrammar(
            element_bindings=_element_bindings(spec),
            nested=MappingProxyType(
                {attribute: nested.iterable for attribute, nested in spec.nested.items()}
            ),
            related=MappingProxyType(
                {"parent_span": _element_bindings(spec)} if name == "spans" else {}
            ),
        )
        for name, spec in _ITERABLE_SPECS.items()
    }
)

TRACE_BINDINGS = _FilterBindings(
    string_names=_TRACE_STRING_NAMES,
    float_names=_TRACE_FLOAT_NAMES,
    datetime_names=_TRACE_DATETIME_NAMES,
    extra_names=MappingProxyType({}),
    aggregate_names=frozenset(_AGGREGATE_SPECS),
    legacy_replacements=MappingProxyType({}),
    uppercase_names=frozenset(),
    annotation_model=models.TraceAnnotation,
    annotation_fk="trace_rowid",
    entity_id=models.Trace.id,
    annotation_table_prefix="trace_annotation",
    reject_unbound_names=True,
    caller_bound_string_names=_ROOT_SPAN_IO_NAMES,
    quantifiers=frozenset(COMPREHENSION_NAMES),
    iterables=_TRACE_ITERABLES,
    annotation_accessors=frozenset({"trace_annotations"}),
    annotation_accessor_errors=MappingProxyType(
        {
            "annotations": (
                "`annotations[...]` is not available in the trace filter; use "
                "`trace_annotations[...]` for trace annotations, or iterate "
                "`span_annotations` for span-level annotations"
            ),
            "evals": (
                "`evals[...]` is not available in the trace filter; use "
                "`trace_annotations[...]` for trace annotations, or iterate "
                "`span_annotations` for span-level annotations"
            ),
        }
    ),
    annotation_iterable="trace_annotations",
    case_insensitive_containment=True,
    strict_semantics=True,
    attribute_proxies=frozenset({"user.id"}),
    allow_outer_element_references=True,
    allow_datetime_reductions=True,
)

TRACE_FILTER_DESCRIPTIONS: typing.Mapping[str, str] = MappingProxyType(
    {
        "trace_id": "The trace's OpenTelemetry identifier. `in` ignores case; `==` is exact.",
        "start_time": (
            "The trace's start timestamp. Compare against an ISO 8601 string with an explicit "
            "offset, e.g. `2026-07-01T00:00:00Z` or `2026-07-01T00:00:00+00:00`."
        ),
        "end_time": (
            "The trace's end timestamp. Compare against an ISO 8601 string with an explicit "
            "offset, e.g. `2026-07-01T00:00:00Z` or `2026-07-01T00:00:00+00:00`."
        ),
        "latency_ms": "The trace's duration in milliseconds, rounded to one decimal place.",
        "num_spans": "Number of spans in the trace; 0 when absent, never null.",
        "error_count": (
            "Number of spans with ERROR status in the trace; 0 when absent, never null."
        ),
        "token_count_prompt": (
            "Prompt tokens summed across all LLM spans in the trace; 0 when absent, never null."
        ),
        "token_count_completion": (
            "Completion tokens summed across all LLM spans in the trace; 0 when absent, never null."
        ),
        "token_count_total": (
            "Prompt and completion tokens summed across all LLM spans in the trace; 0 when "
            "absent, never null."
        ),
        "prompt_cost": (
            "Prompt cost summed across all span cost rows in the trace; 0 when no cost is "
            "configured, never null."
        ),
        "completion_cost": (
            "Completion cost summed across all span cost rows in the trace; 0 when no cost is "
            "configured, never null."
        ),
        "total_cost": (
            "Total cost summed across all span cost rows in the trace; 0 when no cost is "
            "configured, never null."
        ),
        "tool_span_count": "Number of TOOL spans in the trace; 0 when absent, never null.",
        "llm_span_count": "Number of LLM spans in the trace; 0 when absent, never null.",
        "input": (
            "The trace's root span's input.value string; if orphan spans are treated as roots, "
            "they also participate in choosing the earliest root span. `in` ignores case; `==` "
            "is exact; missing when there is no selected root span or input value."
        ),
        "output": (
            "The trace's root span's output.value string; if orphan spans are treated as roots, "
            "they also participate in choosing the earliest root span. `in` ignores case; `==` "
            "is exact; missing when there is no selected root span or output value."
        ),
        "attributes[...]": (
            "The trace's root span's attribute by OpenTelemetry wire key; if orphan spans are "
            "treated as roots, they also participate in choosing the earliest root span. String "
            "subscripts are joined with dots; values are string-cast unless explicitly cast."
        ),
        "user.id": (
            "The trace's root span's attributes[\"user.id\"] value; user.id is an accepted proxy. "
            "If orphan spans are treated as roots, they also participate in choosing the "
            "earliest root span."
        ),
        'metadata["key"]': (
            'The trace\'s root span\'s attributes["metadata.key"] value; metadata["key"] is an '
            "accepted proxy. If orphan spans are treated as roots, they also participate in "
            "choosing the earliest root span."
        ),
        "spans": (
            "All spans in the trace. Iterate with any/all/len/max/min/sum, e.g. "
            'any(span.status_code == "ERROR" for span in spans).'
        ),
        "trace_annotations": "All annotations attached directly to the trace.",
        "span_annotations": "All annotations attached to spans in the trace.",
        "span_cost_details": "All per-token-type cost rows attached to spans in the trace.",
        "spans.name": "Name of a span in the trace.",
        "spans.parent_id": (
            "A span's parent OpenTelemetry span ID; absent on the trace's root span."
        ),
        "spans.span_kind": (
            "A span's kind in the trace, e.g. LLM, TOOL, or RETRIEVER; casing is ignored."
        ),
        "spans.status_code": (
            "A span's status in the trace: OK, ERROR, or UNSET; casing is ignored."
        ),
        "spans.start_time": (
            "A span's start timestamp in the trace. Compare against an ISO 8601 string with an "
            "explicit offset, e.g. `2026-07-01T00:00:00Z` or "
            "`2026-07-01T00:00:00+00:00`."
        ),
        "spans.end_time": (
            "A span's end timestamp in the trace. Compare against an ISO 8601 string with an "
            "explicit offset, e.g. `2026-07-01T00:00:00Z` or "
            "`2026-07-01T00:00:00+00:00`."
        ),
        "spans.latency_ms": "A span's duration in milliseconds within the trace.",
        "spans.cumulative_error_count": (
            "Number of ERROR spans at or under a span in the trace, including that span."
        ),
        "spans.cumulative_llm_token_count_prompt": (
            "Prompt tokens recorded at or under a span in the trace, including that span."
        ),
        "spans.cumulative_llm_token_count_completion": (
            "Completion tokens recorded at or under a span in the trace, including that span."
        ),
        "spans.cumulative_llm_token_count_total": (
            "Total tokens recorded at or under a span in the trace, including that span."
        ),
        "spans.llm_token_count_prompt": ("Prompt tokens recorded on a span in the trace."),
        "spans.llm_token_count_completion": ("Completion tokens recorded on a span in the trace."),
        "spans.llm_token_count_total": (
            "Prompt plus completion tokens recorded on a span in the trace."
        ),
        "spans.children": ("A span's children in the trace: spans whose parent edge points to it."),
        "spans.siblings": (
            "A span's siblings in the trace: other spans with the same non-null parent edge."
        ),
        "spans.annotations": "Annotations attached to a span in the trace.",
        "spans.cost_details": "Per-token-type cost rows attached to a span in the trace.",
        "spans.parent_span": (
            "A span's direct parent in the trace; null when no parent row is stored."
        ),
        "spans.parent_span.name": (
            "A span's direct parent's name in the trace; missing when no parent row is stored."
        ),
        "spans.parent_span.parent_id": (
            "A span's direct parent's parent OpenTelemetry span ID; absent when the direct "
            "parent is the trace's root span or no parent row is stored."
        ),
        "spans.parent_span.span_kind": (
            "A span's direct parent's kind in the trace; missing when no parent row is stored."
        ),
        "spans.parent_span.status_code": (
            "A span's direct parent's status in the trace; missing when no parent row is stored."
        ),
        "spans.parent_span.start_time": (
            "A span's direct parent's start timestamp in the trace; missing when no parent row is "
            "stored. Compare against an ISO 8601 string with an explicit offset, e.g. "
            "`2026-07-01T00:00:00Z`."
        ),
        "spans.parent_span.end_time": (
            "A span's direct parent's end timestamp in the trace; missing when no parent row is "
            "stored. Compare against an ISO 8601 string with an explicit offset, e.g. "
            "`2026-07-01T00:00:00Z`."
        ),
        "spans.parent_span.latency_ms": (
            "A span's direct parent's duration in milliseconds within the trace; missing when "
            "no parent row is stored."
        ),
        "spans.parent_span.cumulative_error_count": (
            "ERROR spans at or under a span's direct parent in the trace, including the parent; "
            "missing when no parent row is stored."
        ),
        "spans.parent_span.cumulative_llm_token_count_prompt": (
            "Prompt tokens at or under a span's direct parent in the trace, including the parent; "
            "missing when no parent row is stored."
        ),
        "spans.parent_span.cumulative_llm_token_count_completion": (
            "Completion tokens at or under a span's direct parent in the trace, including the "
            "parent; missing when no parent row is stored."
        ),
        "spans.parent_span.cumulative_llm_token_count_total": (
            "Total tokens at or under a span's direct parent in the trace, including the parent; "
            "missing when no parent row is stored."
        ),
        "spans.parent_span.llm_token_count_prompt": (
            "Prompt tokens recorded on a span's direct parent in the trace; missing when no "
            "parent row is stored."
        ),
        "spans.parent_span.llm_token_count_completion": (
            "Completion tokens recorded on a span's direct parent in the trace; missing when no "
            "parent row is stored."
        ),
        "spans.parent_span.llm_token_count_total": (
            "Total tokens recorded on a span's direct parent in the trace; missing when no parent "
            "row is stored."
        ),
        "trace_annotations.name": "A trace annotation's name.",
        "trace_annotations.label": "A trace annotation's label; null when absent.",
        "trace_annotations.score": "A trace annotation's score; null when absent.",
        "span_annotations.name": "A span annotation's name.",
        "span_annotations.label": "A span annotation's label; null when absent.",
        "span_annotations.score": "A span annotation's score; null when absent.",
        "span_cost_details.token_type": "Token type covered by a span cost row in the trace.",
        "span_cost_details.is_prompt": (
            "Whether a span cost row in the trace counts toward the prompt side."
        ),
        "span_cost_details.cost": (
            "Cost recorded by a span cost row in the trace; null when not configured."
        ),
        "span_cost_details.tokens": (
            "Token count recorded by a span cost row in the trace; null when unrecorded."
        ),
        "span_cost_details.cost_per_token": (
            "Cost per token recorded by a span cost row in the trace; null when unrecorded."
        ),
    }
)


def _referenced_names(translated: ast.Expression) -> set[str]:
    return {node.id for node in ast.walk(translated) if isinstance(node, ast.Name)}


_REDUCTION_FUNCTIONS: typing.Mapping[str, typing.Any] = MappingProxyType(
    {"sum": func.sum, "max": func.max, "min": func.min}
)


def _comprehension_bindings(
    stmt: Select[typing.Any],
    specs: typing.Iterable[ComprehensionSpec],
    lowering: FilterLowering,
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    aliases = count()

    class _Scope(typing.NamedTuple):
        spec: ComprehensionSpec
        element: typing.Any
        sources: typing.Mapping[typing.Any, typing.Any]
        parent: typing.Optional[typing.Any]

    def needs_parent(spec: ComprehensionSpec) -> bool:
        return any(
            reference.path[0] == "parent_span" and reference.scope_depth == 0
            for reference in spec.element_references.values()
        ) or any(
            reference.path[0] == "parent_span" and reference.scope_depth == 1
            for child in spec.children
            for reference in child.element_references.values()
        )

    def reference_column(
        reference: typing.Any,
        current: _Scope,
        ancestors: tuple[_Scope, ...],
    ) -> typing.Any:
        scope = current if reference.scope_depth == 0 else ancestors[-reference.scope_depth]
        source = scope.element
        if reference.path[0] == "parent_span":
            assert scope.parent is not None
            source = scope.parent
            if len(reference.path) == 1:
                return source.id
        return _element_column(
            source,
            reference.path[-1],
            _ITERABLE_SPECS[reference.source_iterable],
        )

    def element_scope(
        spec: ComprehensionSpec,
        ancestors: tuple[_Scope, ...],
    ) -> tuple[_IterableSpec, _Scope, dict[str, typing.Any], typing.Any]:
        iterable = _ITERABLE_SPECS[spec.iterable]
        element = aliased(iterable.model, name=f"{spec.iterable}_{next(aliases)}")
        sources = {
            iterable.model: element,
            **{
                target: aliased(
                    target,
                    name=f"{spec.iterable}_{target.__tablename__}_{next(aliases)}",
                )
                for target in iterable.joins
            },
        }
        parent = (
            aliased(models.Span, name=f"parent_{next(aliases)}") if needs_parent(spec) else None
        )
        current = _Scope(spec, element, sources, parent)
        columns = {name: _element_column(element, name, iterable) for name in iterable.fields}
        nested_bindings = {
            child.name: build(child, spec, element, (*ancestors, current))
            for child in spec.children
        }
        reference_bindings = {
            name: reference_column(reference, current, ancestors)
            for name, reference in spec.element_references.items()
        }
        element_globals = _eval_globals(
            _TRACE_ITERABLES[spec.iterable].element_bindings,
            {},
            {
                **spec.literal_bindings,
                **columns,
                **nested_bindings,
                **reference_bindings,
            },
        )
        predicate: typing.Any = (
            None if spec.predicate is None else eval(spec.predicate, element_globals)
        )
        return iterable, current, element_globals, predicate

    def apply_joins(
        element_stmt: Select[typing.Any],
        iterable: _IterableSpec,
        scope: _Scope,
    ) -> Select[typing.Any]:
        for target in iterable.joins:
            element_stmt = element_stmt.join(scope.sources[target])
        if scope.parent is not None:
            element_stmt = element_stmt.outerjoin(
                scope.parent,
                and_(
                    scope.parent.trace_rowid == scope.element.trace_rowid,
                    scope.parent.span_id == scope.element.parent_id,
                ),
            )
        return element_stmt

    def trace_key(iterable: _IterableSpec, scope: _Scope) -> typing.Any:
        return scope.sources[iterable.trace_key_model].trace_rowid

    def build(
        spec: ComprehensionSpec,
        parent_spec: typing.Optional[ComprehensionSpec] = None,
        parent_element: typing.Optional[typing.Any] = None,
        ancestors: tuple[_Scope, ...] = (),
    ) -> typing.Any:
        iterable, scope, element_globals, predicate = element_scope(spec, ancestors)
        if spec.kind in QUANTIFIER_NAMES:
            element_stmt = select(literal(1))
        elif spec.kind == "len":
            element_stmt = select(func.count())
        else:
            element_stmt = select(_REDUCTION_FUNCTIONS[spec.kind](predicate))
        element_stmt = apply_joins(element_stmt.select_from(scope.element), iterable, scope)
        if parent_spec is None:
            element_stmt = element_stmt.where(trace_key(iterable, scope) == models.Trace.id)
        elif spec.nested_attribute is None:
            assert parent_element is not None
            parent_iterable = _ITERABLE_SPECS[parent_spec.iterable]
            parent_scope = ancestors[-1]
            element_stmt = element_stmt.where(
                trace_key(iterable, scope) == trace_key(parent_iterable, parent_scope)
            )
        else:
            assert parent_element is not None
            nested = _ITERABLE_SPECS[parent_spec.iterable].nested[spec.nested_attribute]
            element_stmt = element_stmt.where(nested.correlate(scope.sources, parent_element))
        if spec.condition is not None:
            element_stmt = element_stmt.where(eval(spec.condition, element_globals))
        if spec.kind == "any":
            return element_stmt.where(predicate).exists()
        if spec.kind == "all":
            return not_(element_stmt.where(predicate.is_not(True)).exists())
        if spec.kind in ("len", "sum"):
            return func.coalesce(element_stmt.scalar_subquery(), 0)
        return element_stmt.scalar_subquery()

    def build_scan(spec: ComprehensionSpec) -> typing.Any:
        iterable, scope, element_globals, predicate = element_scope(spec, ())
        element_trace_key = trace_key(iterable, scope)

        def scan(*columns: typing.Any) -> Select[typing.Any]:
            element_stmt = apply_joins(select(*columns).select_from(scope.element), iterable, scope)
            if spec.condition is not None:
                element_stmt = element_stmt.where(eval(spec.condition, element_globals))
            return element_stmt

        if spec.kind == "any":
            return models.Trace.id.in_(scan(element_trace_key).where(predicate))
        if spec.kind == "all":
            # Every trace correlation key is non-null, so no nullable-key guard is needed.
            return models.Trace.id.not_in(scan(element_trace_key).where(predicate.is_not(True)))
        value = func.count() if spec.kind == "len" else _REDUCTION_FUNCTIONS[spec.kind](predicate)
        return scan(element_trace_key.label(TRACE_ROWID), value.label(VALUE)).group_by(
            element_trace_key
        )

    bindings_map: dict[str, typing.Any] = {}
    for spec in specs:
        if lowering == "probe":
            bindings_map[spec.name] = build(spec)
            continue
        if lowering != "scan":
            raise ValueError(f"Unknown filter lowering: {lowering}")
        lowered = build_scan(spec)
        if spec.kind in QUANTIFIER_NAMES:
            bindings_map[spec.name] = lowered
            continue
        subquery = lowered.subquery()
        stmt = stmt.outerjoin(subquery, models.Trace.id == subquery.c[TRACE_ROWID])
        column = subquery.c[VALUE]
        bindings_map[spec.name] = (
            func.coalesce(column, 0) if spec.kind in ("len", "sum") else column
        )
    return stmt, bindings_map


@dataclass(frozen=True)
class TraceFilter:
    """Compile and apply one trace filter condition."""

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
    _referenced_root_span_io_names: frozenset[str] = field(init=False, repr=False)
    _references_root_span: bool = field(init=False, repr=False)
    _comprehensions: tuple[ComprehensionSpec, ...] = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    @property
    def can_duplicate_traces(self) -> bool:
        """Whether annotation access can emit several rows for one trace."""
        return bool(self.condition) and bool(self._aliased_annotation_relations)

    def __post_init__(self) -> None:
        if not (source := self.condition):
            return
        compiled_condition = _compile_condition(
            source,
            TRACE_BINDINGS,
            self.valid_annotation_names,
        )
        referenced = _referenced_names(compiled_condition.translated)
        object.__setattr__(self, "translated", compiled_condition.translated)
        object.__setattr__(self, "compiled", compiled_condition.compiled)
        object.__setattr__(
            self,
            "_aliased_annotation_relations",
            compiled_condition.aliased_annotation_relations,
        )
        object.__setattr__(
            self,
            "_aliased_annotation_attributes",
            compiled_condition.aliased_annotation_attributes,
        )
        object.__setattr__(self, "_literal_bindings", compiled_condition.literal_bindings)
        object.__setattr__(
            self,
            "_referenced_aggregates",
            frozenset(referenced & set(_AGGREGATE_SPECS)),
        )
        object.__setattr__(
            self,
            "_referenced_root_span_io_names",
            frozenset(referenced & _ROOT_SPAN_IO_NAMES),
        )
        object.__setattr__(self, "_references_root_span", _ROOT_SPAN_ATTRIBUTES in referenced)
        object.__setattr__(self, "_comprehensions", compiled_condition.comprehensions)

    def __call__(
        self,
        stmt: Select[typing.Any],
        *,
        candidate_trace_rowids: typing.Optional[typing.Collection[int]] = None,
        project_rowids: typing.Optional[typing.Sequence[int]] = None,
        start_time: typing.Optional[typing.Any] = None,
        end_time: typing.Optional[typing.Any] = None,
        lowering: FilterLowering = "scan",
        orphan_span_as_root_span: bool = True,
    ) -> Select[typing.Any]:
        """Apply the condition to a statement selecting from ``Trace``."""
        if not self.condition:
            return stmt
        if lowering not in ("scan", "probe"):
            raise ValueError(f"Unknown filter lowering: {lowering}")
        stmt, aggregate_bindings = _join_aggregates(
            stmt,
            self._referenced_aggregates,
            candidate_trace_rowids=candidate_trace_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
            lowering=lowering,
        )
        stmt, comprehension_bindings = _comprehension_bindings(
            stmt,
            self._comprehensions,
            lowering,
        )
        extra_bindings = {
            **self._literal_bindings,
            **aggregate_bindings,
            **comprehension_bindings,
            "SafeJsonFloat": _safe_json_float,
            "SafeJsonBoolean": _safe_json_boolean,
        }
        if self._referenced_root_span_io_names or self._references_root_span:
            stmt, root_span_bindings = _join_root_span(
                stmt,
                self._referenced_root_span_io_names,
                self._references_root_span,
                candidate_trace_rowids=candidate_trace_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
                orphan_span_as_root_span=orphan_span_as_root_span,
            )
            extra_bindings.update(root_span_bindings)
        stmt = _join_annotations(stmt, TRACE_BINDINGS, self._aliased_annotation_relations)
        return stmt.where(
            eval(
                self.compiled,
                _eval_globals(
                    TRACE_BINDINGS,
                    self._aliased_annotation_attributes,
                    extra_bindings,
                ),
            )
        )

    def as_trace_rowids_subquery(
        self,
        project_rowids: typing.Optional[typing.Sequence[int]] = None,
        start_time: typing.Optional[typing.Any] = None,
        end_time: typing.Optional[typing.Any] = None,
        candidate_trace_rowids: typing.Optional[typing.Collection[int]] = None,
        lowering: FilterLowering = "scan",
        orphan_span_as_root_span: bool = True,
    ) -> ScalarSelect[int]:
        """Return matching trace row ids under optional project, time, and candidate scopes."""
        stmt: Select[typing.Any] = select(distinct(models.Trace.id))
        if project_rowids is not None:
            stmt = stmt.where(models.Trace.project_rowid.in_(project_rowids))
        if candidate_trace_rowids is not None:
            stmt = stmt.where(models.Trace.id.in_(candidate_trace_rowids))
        if start_time is not None:
            stmt = stmt.where(models.Trace.start_time >= start_time)
        if end_time is not None:
            stmt = stmt.where(models.Trace.start_time < end_time)
        return self(
            stmt,
            candidate_trace_rowids=candidate_trace_rowids,
            project_rowids=project_rowids,
            start_time=start_time,
            end_time=end_time,
            lowering=lowering,
            orphan_span_as_root_span=orphan_span_as_root_span,
        ).scalar_subquery()


def _join_aggregates(
    stmt: Select[typing.Any],
    referenced_aggregates: typing.Iterable[str],
    candidate_trace_rowids: typing.Optional[typing.Collection[int]],
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
    lowering: FilterLowering,
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    grouped: dict[str, tuple[typing.Callable[[], TraceAggregate], list[tuple[str, str]]]] = {}
    for name in referenced_aggregates:
        spec = _AGGREGATE_SPECS[name]
        grouped.setdefault(spec.builder_key, (spec.builder, []))[1].append(
            (name, spec.value_column)
        )
    bindings_map: dict[str, typing.Any] = {}
    for builder, names in grouped.values():
        aggregate = builder()
        if lowering == "scan":
            subquery = aggregate.as_grouped_subquery(
                keys=candidate_trace_rowids,
                project_rowids=project_rowids,
                start_time=start_time,
                end_time=end_time,
            ).subquery()
            stmt = stmt.outerjoin(subquery, models.Trace.id == subquery.c[TRACE_ROWID])
            for name, value_column in names:
                bindings_map[name] = func.coalesce(subquery.c[value_column], 0)
        elif lowering == "probe":
            for name, value_column in names:
                bindings_map[name] = func.coalesce(
                    aggregate.as_correlated_scalar(
                        models.Trace.id,
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


def _wire_key_candidate_paths(keys: typing.Sequence[str]) -> tuple[tuple[str, ...], ...]:
    segments = ".".join(keys).split(".")
    paths = [tuple(segments)]
    for index in range(len(segments) - 1, -1, -1):
        candidate = (*segments[:index], ".".join(segments[index:]))
        if candidate != paths[0]:
            paths.append(candidate)
    return tuple(paths)


class _RootSpanAttributeValue:
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


class _RootSpanAttributes:
    def __init__(self, column: typing.Any) -> None:
        self._column = column

    def __getitem__(self, keys: typing.Sequence[typing.Any]) -> _RootSpanAttributeValue:
        return _RootSpanAttributeValue(self._column, keys)


def _safe_json_float(value: typing.Any) -> typing.Any:
    if isinstance(value, _RootSpanAttributeValue):
        return value._cast(SafeJsonFloat)
    return SafeJsonFloat(value)


def _safe_json_boolean(value: typing.Any) -> typing.Any:
    if isinstance(value, _RootSpanAttributeValue):
        return value._cast(SafeJsonBoolean)
    return SafeJsonBoolean(value)


def _join_root_span(
    stmt: Select[typing.Any],
    referenced_io_names: typing.Iterable[str],
    references_attributes: bool,
    candidate_trace_rowids: typing.Optional[typing.Collection[int]],
    project_rowids: typing.Optional[typing.Sequence[int]],
    start_time: typing.Optional[typing.Any],
    end_time: typing.Optional[typing.Any],
    orphan_span_as_root_span: bool,
) -> tuple[Select[typing.Any], dict[str, typing.Any]]:
    representative_root_spans = representative_root_span_by_trace(
        keys=candidate_trace_rowids,
        project_rowids=project_rowids,
        start_time=start_time,
        end_time=end_time,
        orphan_span_as_root_span=orphan_span_as_root_span,
    ).subquery()
    root_span = aliased(models.Span, name="trace_root_span")
    stmt = stmt.outerjoin(
        representative_root_spans,
        representative_root_spans.c[TRACE_ROWID] == models.Trace.id,
    )
    stmt = stmt.outerjoin(root_span, root_span.id == representative_root_spans.c[SPAN_ROWID])
    bindings_map: dict[str, typing.Any] = {}
    for name in referenced_io_names:
        path = _ROOT_SPAN_INPUT_VALUE if name == "input" else _ROOT_SPAN_OUTPUT_VALUE
        bindings_map[name] = _RootSpanAttributeValue(root_span.attributes, path).as_string()
    if references_attributes:
        bindings_map[_ROOT_SPAN_ATTRIBUTES] = _RootSpanAttributes(root_span.attributes)
    return stmt, bindings_map
