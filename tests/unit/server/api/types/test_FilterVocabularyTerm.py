import ast
import re
from pathlib import Path

import pytest

from phoenix.trace.dsl.trace_filter import TraceFilter


def _trace_filter_snippet_expressions() -> list[str]:
    repo_root = Path(__file__).parents[5]
    source = (repo_root / "js/app/src/pages/project/traceFilterDSL.ts").read_text()
    string_literal = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    snippets = [
        ast.literal_eval(match.group(1))
        for match in re.finditer(rf"\bsnippet:\s*{string_literal}", source)
    ]
    assert len(snippets) == source.count("snippet:")
    return [re.sub(r"\$\{([^{}]*)\}", r"\1", snippet) for snippet in snippets]


@pytest.mark.parametrize("condition", _trace_filter_snippet_expressions())
def test_trace_filter_snippets_compile(condition: str) -> None:
    TraceFilter(condition)
