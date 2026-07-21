"""The bindable-name vocabulary served for filter DSL autocomplete, agent discovery, and docs."""

import json
from collections.abc import Sequence

import strawberry

from phoenix.trace.dsl.session_filter import SESSION_BINDINGS, SESSION_FILTER_DESCRIPTIONS

# Value-type hints served to clients so they know how to write the comparand.
_STRING = "string"
_NUMBER = "number"
_DATETIME = "datetime"

# Groupings for presentation / discovery.
_INTRINSIC = "session"
_AGGREGATE = "aggregate"
_ATTRIBUTE = "attribute"
_ANNOTATION = "annotation"

_ATTRIBUTE_PROXY_TERMS = ("attributes[...]", "user.id", 'metadata["key"]')


@strawberry.type(
    description="One bindable term in a filter DSL: its name, value type, gloss, and "
    "grouping. Grain-specific resolvers (e.g. Project.sessionFilterVocabulary) serve "
    "these as the single source for UI autocomplete, agent discovery, and docs."
)
class FilterVocabularyTerm:
    """One bindable term in a filter DSL: its name, value type, gloss, and grouping.

    Grain-specific resolvers (e.g. ``Project.sessionFilterVocabulary``) serve these as the single
    source for UI autocomplete, agent discovery, and docs.
    """

    name: str = strawberry.field(
        description="The bindable name exactly as written in a filter expression."
    )
    type: str = strawberry.field(
        description="Value-type hint for the comparand: 'string', 'number', or 'datetime'."
    )
    description: str = strawberry.field(
        description="Human-readable gloss of what the term means and how it evaluates."
    )
    category: str = strawberry.field(
        description="Presentation/discovery grouping: 'session' (intrinsic column), "
        "'aggregate' (per-session aggregate), 'attribute' (root-span attribute path), "
        "or 'annotation' (session annotation access)."
    )


def session_filter_vocabulary_terms(
    annotation_names: Sequence[str] = (),
    root_span_attribute_paths: Sequence[Sequence[str]] = (),
    tool_span_names: Sequence[str] = (),
) -> list[FilterVocabularyTerm]:
    """Build the session-filter vocabulary from compiler bindings and project-observed paths.

    Static term names derive from ``SESSION_BINDINGS.binding_names``, and each description is served
    from ``SESSION_FILTER_DESCRIPTIONS`` — so the vocabulary cannot diverge from what the compiler
    accepts. Accepted attribute proxy patterns and per-project dynamic names are folded in as
    fully-typed terms.
    """
    terms: dict[str, FilterVocabularyTerm] = {}

    def add(
        name: str,
        value_type: str,
        category: str,
        description: str | None = None,
    ) -> None:
        terms.setdefault(
            name,
            FilterVocabularyTerm(
                name=name,
                type=value_type,
                description=description or SESSION_FILTER_DESCRIPTIONS[name],
                category=category,
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
        add(name, _STRING, _INTRINSIC)

    for name in _ATTRIBUTE_PROXY_TERMS:
        add(name, _STRING, _ATTRIBUTE)

    for attribute_path in sorted({tuple(path) for path in root_span_attribute_paths}):
        name = _attribute_path_name(attribute_path)
        add(
            name,
            _STRING,
            _ATTRIBUTE,
            description=(
                f"Observed root-span attribute {name}; reads from the session's earliest "
                "root span and is string-cast unless explicitly cast."
            ),
        )

    for tool_span_name in sorted(set(tool_span_names)):
        tool_name_subscript = _subscript_literal(tool_span_name)
        add(
            name=f"tool_call_count[{tool_name_subscript}]",
            value_type=_NUMBER,
            description=f"Number of TOOL spans named {tool_name_subscript} in the session.",
            category=_AGGREGATE,
        )

    for annotation_name in sorted(set(annotation_names)):
        annotation_subscript = _subscript_literal(annotation_name)
        add(
            name=f"annotations[{annotation_subscript}].score",
            value_type=_NUMBER,
            description=(
                f"Numeric score of the {annotation_subscript} session annotation; null when the "
                "session lacks this annotation, so comparisons exclude those sessions "
                "(target them with `is None`)."
            ),
            category=_ANNOTATION,
        )
        add(
            name=f"annotations[{annotation_subscript}].label",
            value_type=_STRING,
            description=(
                f"Label of the {annotation_subscript} session annotation; null when the session "
                "lacks this annotation, so `!=` excludes those sessions "
                "(target them with `is None`)."
            ),
            category=_ANNOTATION,
        )
    return list(terms.values())


def _attribute_path_name(attribute_path: Sequence[str]) -> str:
    return "attributes" + "".join(
        f"[{_subscript_literal(path_segment)}]" for path_segment in attribute_path
    )


def _subscript_literal(value: str) -> str:
    return json.dumps(value)
