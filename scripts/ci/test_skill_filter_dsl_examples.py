"""Filter conditions in shipped skills compile under the Python filters.

Skills teach the span, trace, and session filter languages by example, and an example that
does not compile teaches a hallucination. Two kinds of example are checked:

- string arguments named ``filterCondition``, ``traceFilterCondition`` and
  ``sessionFilterCondition`` inside the GraphQL examples (fenced ```graphql blocks and
  ``px api graphql '...'`` bodies);
- fenced blocks tagged ```python span-filter, ```python trace-filter or
  ```python session-filter, in which every non-blank, non-comment line is one complete
  condition.

Lives outside tests/ so CI runs it only when a skill or the filter DSL changes.
"""

from __future__ import annotations

import re
from typing import Callable

import pytest
from graphql import ArgumentNode, StringValueNode, Visitor, parse, visit
from skill_examples import (
    REPO_ROOT,
    graphql_queries_by_location,
    location,
    shipped_markdown_files,
)

from phoenix.trace.dsl import SpanFilter
from phoenix.trace.dsl.session_filter import SessionFilter
from phoenix.trace.dsl.trace_filter import TraceFilter

_COMPILERS: dict[str, Callable[[str], object]] = {
    "span": SpanFilter,
    "trace": TraceFilter,
    "session": SessionFilter,
}
_GRAIN_BY_ARGUMENT = {
    "filterCondition": "span",
    "traceFilterCondition": "trace",
    "sessionFilterCondition": "session",
}
_FILTER_FENCE = re.compile(
    r"^[ \t]*```python (span|trace|session)-filter[^\n]*\n(.*?)^[ \t]*```",
    re.DOTALL | re.MULTILINE,
)


class _ConditionArguments(Visitor):
    def __init__(self) -> None:
        super().__init__()
        self.conditions: list[tuple[str, str]] = []

    def enter_argument(self, node: ArgumentNode, *_: object) -> None:
        grain = _GRAIN_BY_ARGUMENT.get(node.name.value)
        if grain and isinstance(node.value, StringValueNode):
            self.conditions.append((grain, node.value.value))


def _conditions_by_location() -> dict[str, tuple[str, str]]:
    conditions: dict[str, tuple[str, str]] = {}
    for query_location, query in graphql_queries_by_location().items():
        visitor = _ConditionArguments()
        visit(parse(query), visitor)
        for index, (grain, condition) in enumerate(visitor.conditions):
            conditions[f"{query_location}#{grain}-{index}"] = (grain, condition)
    for path in shipped_markdown_files():
        text = path.read_text(encoding="utf-8")
        for fence_index, match in enumerate(_FILTER_FENCE.finditer(text)):
            grain, body = match.groups()
            lines = [line.strip() for line in body.splitlines()]
            for line_index, condition in enumerate(lines):
                if condition and not condition.startswith("#"):
                    key = f"{location(path)}#{grain}-fence-{fence_index}-{line_index}"
                    conditions[key] = (grain, condition)
    return conditions


CONDITIONS_BY_LOCATION = _conditions_by_location()


@pytest.mark.parametrize("grain", sorted(_COMPILERS))
def test_every_grain_has_examples(grain: str) -> None:
    assert any(g == grain for g, _ in CONDITIONS_BY_LOCATION.values())


@pytest.mark.parametrize(
    ("grain", "condition"),
    CONDITIONS_BY_LOCATION.values(),
    ids=CONDITIONS_BY_LOCATION.keys(),
)
def test_condition_compiles(grain: str, condition: str) -> None:
    _COMPILERS[grain](condition)


def test_filter_reference_copies_are_identical() -> None:
    """One document, shipped in every skill that takes a filter condition."""
    copies = sorted(REPO_ROOT.glob("**/skills/*/references/filter-expressions.md"))
    assert len(copies) >= 3, copies
    texts = {path.read_text(encoding="utf-8") for path in copies}
    assert len(texts) == 1, [location(path) for path in copies]
