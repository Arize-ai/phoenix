"""The bindable-name vocabulary served for filter DSL autocomplete, agent discovery, and docs."""

import json
from collections.abc import Sequence

import strawberry

from phoenix.trace.dsl.filter import _IterableGrammar
from phoenix.trace.dsl.session_filter import SESSION_BINDINGS, SESSION_FILTER_DESCRIPTIONS
from phoenix.trace.dsl.trace_filter import TRACE_BINDINGS, TRACE_FILTER_DESCRIPTIONS

_STRING = "string"
_NUMBER = "number"
_DATETIME = "datetime"
_BOOLEAN = "boolean"
_ITERABLE_TYPE = "iterable"
_CONTAINMENT_TYPE = "containment"

_INTRINSIC = "session"
_TRACE_INTRINSIC = "trace"
_AGGREGATE = "aggregate"
_ATTRIBUTE = "attribute"
_ANNOTATION = "annotation"
_ITERABLE = "iterable"
_ELEMENT = "element"

_ATTRIBUTE_PROXY_TERMS = ("attributes[...]", "user.id", 'metadata["key"]')


@strawberry.type(
    description="One bindable term in a filter DSL: its name, value type, gloss, and "
    "grouping. Grain-specific resolvers (e.g. Project.sessionFilterVocabulary) serve "
    "these as the single source for UI autocomplete, agent discovery, and docs."
)
class FilterVocabularyTerm:
    name: str = strawberry.field(
        description="The bindable name exactly as written in a filter expression."
    )
    type: str = strawberry.field(
        description="Value-type hint for the comparand: 'string', 'number', 'datetime', "
        "or 'boolean'. Collections carry 'iterable' — they are looped over rather than "
        "compared. 'containment' marks a term that only takes `in` / `not in` against a "
        "string literal and never `==`."
    )
    description: str = strawberry.field(
        description="Human-readable gloss of what the term means and how it evaluates."
    )
    category: str = strawberry.field(
        description="Presentation/discovery grouping: 'session' (intrinsic column), "
        "'aggregate' (per-session aggregate), 'attribute' (root-span attribute path), "
        "'annotation' (session annotation access), 'iterable' (a collection a "
        "comprehension can loop over), or 'element' (a field of one such collection's "
        "elements)."
    )
    iterable_name: str | None = strawberry.field(
        default=None,
        description="Name of the iterable term whose elements expose this name, or null "
        "when the term binds at the top level. An 'element' term is only writable inside "
        "a comprehension over that iterable, qualified by the loop variable — e.g. "
        "latency_ms with iterableName 'spans' is written any(s.latency_ms > 1000 for s in "
        "spans), never bare.",
    )


def session_filter_vocabulary_terms(
    annotation_names: Sequence[str] = (),
    root_span_attribute_paths: Sequence[Sequence[str]] = (),
) -> list[FilterVocabularyTerm]:
    """Build the session-filter vocabulary from compiler bindings and project-observed paths."""
    # Keyed by (iterable, name): element field names repeat across iterables and collide with
    # top-level ones (`start_time` is both a session column and a turn field).
    terms: dict[tuple[str | None, str], FilterVocabularyTerm] = {}

    def add(
        name: str,
        value_type: str,
        category: str,
        description: str | None = None,
        iterable_name: str | None = None,
    ) -> None:
        terms.setdefault(
            (iterable_name, name),
            FilterVocabularyTerm(
                name=name,
                type=value_type,
                description=description or SESSION_FILTER_DESCRIPTIONS[name],
                category=category,
                iterable_name=iterable_name,
            ),
        )

    for name in SESSION_BINDINGS.string_names:
        add(name, _STRING, _INTRINSIC)
    for name in SESSION_BINDINGS.datetime_names:
        add(name, _DATETIME, _INTRINSIC)
    for name in SESSION_BINDINGS.float_names:
        add(name, _NUMBER, _INTRINSIC)
    for name in sorted(SESSION_BINDINGS.aggregate_names):
        add(name, _NUMBER, _AGGREGATE)
    for name in sorted(SESSION_BINDINGS.exists_names):
        add(name, _CONTAINMENT_TYPE, _INTRINSIC)

    for name in _ATTRIBUTE_PROXY_TERMS:
        add(name, _STRING, _ATTRIBUTE)

    for iterable_name, grammar in sorted(SESSION_BINDINGS.iterables.items()):
        add(iterable_name, _ITERABLE_TYPE, _ITERABLE)
        for field_name, field_type in sorted(_element_field_types(grammar).items()):
            add(
                field_name,
                field_type,
                _ELEMENT,
                description=SESSION_FILTER_DESCRIPTIONS[f"{iterable_name}.{field_name}"],
                iterable_name=iterable_name,
            )

    # Observed paths are served in the canonical wire-key spelling — one term per
    # OTel key, however ingestion decomposed it into nested JSON. The nested
    # spelling (attributes["llm"]["model_name"]) remains an accepted synonym in
    # the compiler; serving both would list every key twice.
    for wire_key in sorted({".".join(path) for path in root_span_attribute_paths}):
        subscript = _subscript_literal(wire_key)
        add(
            f"attributes[{subscript}]",
            _STRING,
            _ATTRIBUTE,
            description=(
                f"Observed root-span attribute with OTel key {subscript}; matches the key "
                "however ingestion nested it, reads from the session's earliest root span, "
                "and is string-cast unless explicitly cast."
            ),
        )

    for annotation_name in sorted(set(annotation_names)):
        annotation_subscript = _subscript_literal(annotation_name)
        add(
            name=f"annotations[{annotation_subscript}].score",
            value_type=_NUMBER,
            description=(
                f"Numeric score of the {annotation_subscript} session annotation; null when the "
                "session lacks this annotation, so comparisons exclude those sessions "
                "(target them with `is None`). Here `annotations[...]` reads session "
                "annotations; the same spelling in the span filter reads span annotations."
            ),
            category=_ANNOTATION,
        )
        add(
            name=f"annotations[{annotation_subscript}].label",
            value_type=_STRING,
            description=(
                f"Label of the {annotation_subscript} session annotation; null when the session "
                "lacks this annotation, so `!=` excludes those sessions "
                "(target them with `is None`). Here `annotations[...]` reads session "
                "annotations; the same spelling in the span filter reads span annotations."
            ),
            category=_ANNOTATION,
        )
    return list(terms.values())


def trace_filter_vocabulary_terms(
    annotation_names: Sequence[str] = (),
    root_span_attribute_paths: Sequence[Sequence[str]] = (),
) -> list[FilterVocabularyTerm]:
    """Build the trace-filter vocabulary from compiler bindings and project-observed paths."""
    terms: dict[tuple[str | None, str], FilterVocabularyTerm] = {}

    def add(
        name: str,
        value_type: str,
        category: str,
        description: str | None = None,
        iterable_name: str | None = None,
    ) -> None:
        terms.setdefault(
            (iterable_name, name),
            FilterVocabularyTerm(
                name=name,
                type=value_type,
                description=description or TRACE_FILTER_DESCRIPTIONS[name],
                category=category,
                iterable_name=iterable_name,
            ),
        )

    for name in TRACE_BINDINGS.string_names:
        add(name, _STRING, _TRACE_INTRINSIC)
    for name in sorted(TRACE_BINDINGS.caller_bound_string_names):
        add(name, _STRING, _TRACE_INTRINSIC)
    for name in TRACE_BINDINGS.datetime_names:
        add(name, _DATETIME, _TRACE_INTRINSIC)
    for name in TRACE_BINDINGS.float_names:
        add(name, _NUMBER, _TRACE_INTRINSIC)
    for name in sorted(TRACE_BINDINGS.aggregate_names):
        add(name, _NUMBER, _AGGREGATE)

    for name in _ATTRIBUTE_PROXY_TERMS:
        add(name, _STRING, _ATTRIBUTE)

    for iterable_name, grammar in sorted(TRACE_BINDINGS.iterables.items()):
        add(iterable_name, _ITERABLE_TYPE, _ITERABLE)
        for field_name, field_type in sorted(_element_field_types(grammar).items()):
            add(
                field_name,
                field_type,
                _ELEMENT,
                description=TRACE_FILTER_DESCRIPTIONS[f"{iterable_name}.{field_name}"],
                iterable_name=iterable_name,
            )

    for wire_key in sorted({".".join(path) for path in root_span_attribute_paths}):
        subscript = _subscript_literal(wire_key)
        add(
            f"attributes[{subscript}]",
            _STRING,
            _ATTRIBUTE,
            description=(
                f"Observed strict-root attribute with OpenTelemetry key {subscript}; "
                "matches the key however ingestion nested it and is string-cast unless "
                "explicitly cast."
            ),
        )

    for annotation_name in sorted(set(annotation_names)):
        annotation_subscript = _subscript_literal(annotation_name)
        add(
            name=f"annotations[{annotation_subscript}].score",
            value_type=_NUMBER,
            description=(
                f"Numeric score of the {annotation_subscript} trace annotation; null when "
                "the trace lacks this annotation, so comparisons exclude those traces "
                "(target them with `is None`)."
            ),
            category=_ANNOTATION,
        )
        add(
            name=f"annotations[{annotation_subscript}].label",
            value_type=_STRING,
            description=(
                f"Label of the {annotation_subscript} trace annotation; null when the trace "
                "lacks this annotation, so `!=` excludes those traces "
                "(target them with `is None`)."
            ),
            category=_ANNOTATION,
        )
    return list(terms.values())


def _element_field_types(grammar: _IterableGrammar) -> dict[str, str]:
    """Name-to-type map for one iterable's element fields, read off the compiler's own bindings.

    Reading the bindings rather than a parallel list is what keeps the served vocabulary from
    drifting from what actually compiles.
    """
    element_bindings = grammar.element_bindings
    return {
        **{name: _STRING for name in element_bindings.string_names},
        **{name: _NUMBER for name in element_bindings.float_names},
        **{name: _DATETIME for name in element_bindings.datetime_names},
        **{name: _BOOLEAN for name in element_bindings.boolean_names},
    }


def _subscript_literal(value: str) -> str:
    return json.dumps(value)
