"""Standalone CI check: the traces UI's filter snippets compile under Python.

The trace filter vocabulary is a cross-language contract: TypeScript
(js/app/src/pages/project/traceFilterDSL.ts) offers autocomplete snippets that
the Python TraceFilter DSL must accept. Because the check spans both languages,
it runs as its own CI job — not inside the Python unit test suite, which must
never depend on js/ sources.

Exits non-zero listing every snippet that fails to compile.
"""

import ast
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DSL_SOURCE = REPO_ROOT / "js" / "app" / "src" / "pages" / "project" / "traceFilterDSL.ts"


def extract_snippet_expressions(source: str) -> list[str]:
    """Extract `snippet:` string literals and strip `${...}` placeholder markers."""
    string_literal = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    snippets = [
        ast.literal_eval(match.group(1))
        for match in re.finditer(rf"\bsnippet:\s*{string_literal}", source)
    ]
    if len(snippets) != source.count("snippet:"):
        raise ValueError(
            f"Parsed {len(snippets)} snippet string literals but found "
            f"{source.count('snippet:')} `snippet:` keys in {DSL_SOURCE} — "
            "a snippet is not a plain string literal, so this check can't see it."
        )
    return [re.sub(r"\$\{([^{}]*)\}", r"\1", snippet) for snippet in snippets]


def main() -> int:
    from phoenix.trace.dsl.trace_filter import TraceFilter

    conditions = extract_snippet_expressions(DSL_SOURCE.read_text())
    if not conditions:
        print(f"No snippets found in {DSL_SOURCE} — check the extraction regex.")
        return 1

    failures: list[tuple[str, Exception]] = []
    for condition in conditions:
        try:
            TraceFilter(condition)
        except Exception as exc:  # noqa: BLE001 — report every failure kind
            failures.append((condition, exc))

    if failures:
        print(f"{len(failures)}/{len(conditions)} UI filter snippets fail to compile:")
        for condition, error in failures:
            print(f"  {condition!r}: {error}")
        return 1

    print(f"All {len(conditions)} UI filter snippets compile under TraceFilter.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
