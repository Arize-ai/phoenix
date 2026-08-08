import strawberry


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
