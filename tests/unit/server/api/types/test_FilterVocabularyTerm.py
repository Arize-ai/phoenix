import ast
import re
from pathlib import Path

import pytest

from phoenix.trace.dsl.session_filter import SessionFilter
from phoenix.trace.dsl.trace_filter import TraceFilter

_REPO_ROOT = Path(__file__).parents[5]
_TRACE_DSL_PATH = _REPO_ROOT / "js/app/src/pages/project/traceFilterDSL.ts"
_SESSION_DSL_PATH = _REPO_ROOT / "js/app/src/pages/project/sessionFilterDSL.ts"


def _filter_dsl_expressions(path: Path, key: str) -> list[str]:
    """Extracts every `<key>: "<literal>"` filter expression from a frontend DSL module.

    The typeahead snippets (`snippet:`) and the AI-query examples (`expression:`)
    both reach users — one through completion, one through the model's prompt —
    so each must compile under the real filter. Tab-through placeholders
    (`${...}`) are reduced to their example text, exactly as the typeahead
    inserts them.
    """
    source = path.read_text()
    string_literal = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    literals = [
        ast.literal_eval(match.group(1))
        for match in re.finditer(rf"\b{key}:\s*{string_literal}", source)
    ]
    assert len(literals) == source.count(f"{key}:")
    return [re.sub(r"\$\{([^{}]*)\}", r"\1", literal) for literal in literals]


@pytest.mark.parametrize(
    "condition",
    _filter_dsl_expressions(_TRACE_DSL_PATH, "snippet")
    + _filter_dsl_expressions(_TRACE_DSL_PATH, "expression"),
)
def test_trace_filter_dsl_expressions_compile(condition: str) -> None:
    TraceFilter(condition)


@pytest.mark.parametrize(
    "condition",
    _filter_dsl_expressions(_SESSION_DSL_PATH, "snippet")
    + _filter_dsl_expressions(_SESSION_DSL_PATH, "expression"),
)
def test_session_filter_dsl_expressions_compile(condition: str) -> None:
    SessionFilter(condition)
