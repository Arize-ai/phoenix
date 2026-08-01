from typing import Optional

import strawberry


@strawberry.type
class FilterConditionWarning:
    """A non-blocking diagnostic about an otherwise-valid span filter condition.

    Emitted for a bare identifier that resolves to a JSON attribute path rather
    than a span field -- the silent `kind == 'AGENT'` -> `attributes['kind']`
    footgun. The condition is valid and runs; the warning explains why it may
    match nothing and, when a field name is close, suggests one. Advisory only:
    a client may surface it but must not treat it as a validation failure.
    """

    message: str = strawberry.field(
        description="A user-safe explanation of how the identifier is interpreted."
    )
    identifier: str = strawberry.field(
        description="The bare identifier that resolved to an attribute path."
    )
    suggestion: Optional[str] = strawberry.field(
        description=(
            "The closest span field name, if one is close enough to recommend; otherwise null."
        )
    )


@strawberry.type
class SpanFilterConditionAnalysis:
    """
    Structural facts about a span filter condition, derived by parsing it as
    the Python expression the filter DSL is built on.

    This exists so clients can read filter semantics (notably root-span
    scoping) without reimplementing that parsing themselves, which would be a
    second grammar free to drift from the real one.

    The analysis is purely structural and does not validate the condition --
    use `validateSpanFilterCondition` for that. A condition can be reported as
    root-scoped and still be rejected when the query runs, e.g. because it
    references an unsupported construct. Keeping the two separate is what lets
    the analysis stay useful for an expression that is still being edited.
    """

    selects_root_spans_only: bool = strawberry.field(
        description=(
            "Whether a root predicate (`parent_span is None` or `parent_id is None`) "
            "binds every row the condition can match. `true` is a guarantee; `false` "
            "means not established, not that non-root spans are admitted."
        )
    )
    warnings: list[FilterConditionWarning] = strawberry.field(
        default_factory=list,
        description=(
            "Advisory diagnostics for a valid condition -- notably bare identifiers "
            "that resolve to attribute paths (`kind` -> `attributes['kind']`) and so "
            "silently match nothing. Empty for an empty or invalid condition; an "
            "invalid one is reported by `validateSpanFilterCondition` instead."
        ),
    )
