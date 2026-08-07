"""Every filter expression shown in the public docs must actually compile.

The page ``docs/phoenix/tracing/how-to-tracing/filter-expressions.mdx`` is the single source of
these examples. Each validated example is a code fence immediately preceded by an MDX comment
marker naming its grain::

    {/* filter-example: span */}
    ```python
    span_kind == 'RETRIEVER'
    ```

This test parses those markers, treats every non-blank line of a marked fence as one condition, and
compiles it through the same path the GraphQL ``validate*FilterCondition`` resolvers use: construct
the filter, apply it to the grain's select, and render the statement under **both** the SQLite and
PostgreSQL dialects (some failures only surface at SQL generation, not at construction). A docs
example that stops compiling fails the build.

Scope: this asserts the examples *compile and generate SQL on both backends*. It does not assert
they return rows — a session filter naming an annotation the project has never recorded compiles
and simply matches nothing, so the docs should not present such examples as guaranteed-populated.
"""

import re
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite

from phoenix.db import models
from phoenix.server.session_filters import compile_session_filter
from phoenix.trace.dsl.filter import SpanFilter

_DOCS_PAGE = (
    Path(__file__).parents[4]
    / "docs"
    / "phoenix"
    / "tracing"
    / "how-to-tracing"
    / "filter-expressions.mdx"
)

# A marker comment followed by the next fenced code block.
_MARKED_FENCE = re.compile(
    r"\{/\*\s*filter-example:\s*(?P<grain>span|session)\s*\*/\}\s*\n"
    r"```[^\n]*\n(?P<body>.*?)\n```",
    re.DOTALL,
)


def _iter_examples() -> list[tuple[str, str]]:
    text = _DOCS_PAGE.read_text(encoding="utf-8")
    examples: list[tuple[str, str]] = []
    for match in _MARKED_FENCE.finditer(text):
        grain = match.group("grain")
        for line in match.group("body").splitlines():
            condition = line.strip()
            if condition:
                examples.append((grain, condition))
    return examples


_EXAMPLES = _iter_examples()


def test_doc_examples_were_found() -> None:
    """Fail loudly if the marker format drifts, so a broken parser can't silently pass."""
    assert _DOCS_PAGE.exists(), f"docs page not found at {_DOCS_PAGE}"
    grains = {grain for grain, _ in _EXAMPLES}
    assert grains == {"span", "session"}, (
        f"expected both span and session examples, found grains {grains} "
        f"in {len(_EXAMPLES)} example(s)"
    )


def _compile_and_render(grain: str, condition: str) -> None:
    if grain == "span":
        stmt = SpanFilter(condition)(select(models.Span))
    else:
        stmt = compile_session_filter(condition)(select(models.ProjectSession))
    str(stmt.compile(dialect=sqlite.dialect()))
    str(stmt.compile(dialect=postgresql.dialect()))  # type: ignore[no-untyped-call]


@pytest.mark.parametrize(
    "grain,condition",
    _EXAMPLES,
    ids=[f"{grain}:{condition}" for grain, condition in _EXAMPLES],
)
def test_doc_filter_example_compiles(grain: str, condition: str) -> None:
    _compile_and_render(grain, condition)
