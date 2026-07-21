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
            "Whether the condition is established to match only root spans -- that "
            "is, whether a root predicate (`parent_span is None` or `parent_id is "
            "None`) binds every row the condition can match. A conjunct qualifies; a "
            "branch of an `or` qualifies only if every other branch is root-scoped "
            "too, since a row need satisfy just one of them."
            "\n\n"
            "`false` means this could not be established, not that the condition "
            "admits non-root spans. Recognition covers the boolean structure of the "
            "expression, so a root-only condition written in a form that would "
            "require reasoning about the predicates themselves -- a branch that "
            "silently contradicts itself, say -- reports `false`. `true` is always a "
            "guarantee; `false` is the absence of one."
        )
    )
