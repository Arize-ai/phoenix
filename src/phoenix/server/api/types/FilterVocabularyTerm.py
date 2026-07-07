"""The bindable-name vocabulary served for filter DSL autocomplete, agent discovery, and docs."""

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


@strawberry.type
class FilterVocabularyTerm:
    """One bindable term in a filter DSL: its name, value type, gloss, and grouping.

    Grain-specific resolvers (e.g. ``Project.sessionFilterVocabulary``) serve these as the single
    source for UI autocomplete, agent discovery, and docs.
    """

    name: str
    type: str
    description: str
    category: str


def session_filter_vocabulary_terms(
    annotation_names: Sequence[str] = (),
) -> list[FilterVocabularyTerm]:
    """Build the session-filter vocabulary from the compiler's frozen name maps and gloss dict.

    The intrinsic and aggregate term names are exactly ``SESSION_BINDINGS.binding_names``, and each
    description is served verbatim from ``SESSION_FILTER_DESCRIPTIONS`` — so the vocabulary cannot
    diverge from what the compiler accepts. ``annotation_names`` (from
    ``Project.session_annotation_names``) are folded in as fully-typed ``annotations[...]`` terms.
    """
    terms: list[FilterVocabularyTerm] = []

    def add(name: str, value_type: str, category: str) -> None:
        terms.append(
            FilterVocabularyTerm(
                name=name,
                type=value_type,
                description=SESSION_FILTER_DESCRIPTIONS[name],
                category=category,
            )
        )

    for name in SESSION_BINDINGS.string_names:
        add(name, _STRING, _INTRINSIC)
    for name in SESSION_BINDINGS.datetime_names:
        add(name, _DATETIME, _INTRINSIC)
    for name in SESSION_BINDINGS.float_names:
        add(name, _NUMBER, _INTRINSIC)
    for name in sorted(SESSION_BINDINGS.aggregate_names):
        add(name, _NUMBER, _AGGREGATE)

    # `user.id` / `metadata["key"]` read the session's earliest root span — documented access
    # patterns rather than bare names, so they are not part of the drift-checked binding surface.
    add("user.id", _STRING, _ATTRIBUTE)
    add('metadata["key"]', _STRING, _ATTRIBUTE)

    for annotation_name in annotation_names:
        terms.append(
            FilterVocabularyTerm(
                name=f'annotations["{annotation_name}"].score',
                type=_NUMBER,
                description=f'Numeric score of the "{annotation_name}" session annotation.',
                category=_ANNOTATION,
            )
        )
        terms.append(
            FilterVocabularyTerm(
                name=f'annotations["{annotation_name}"].label',
                type=_STRING,
                description=f'Label of the "{annotation_name}" session annotation.',
                category=_ANNOTATION,
            )
        )
    return terms
