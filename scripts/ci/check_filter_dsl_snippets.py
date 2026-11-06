"""Standalone CI check: the UI's filter DSL literals compile under Python.

The filter vocabularies are a cross-language contract: the TypeScript DSL
modules (js/app/src/pages/project/{trace,session}FilterDSL.ts) carry typeahead
snippets (`snippet:`) and AI-query examples (`expression:`) that both reach
users — one through completion, one through the model's prompt — so each must
compile under the real Python filter. Because the check spans both languages,
it runs as its own CI job — not inside the Python unit test suite, which must
never depend on js/ sources.

Exits non-zero listing every literal that fails to compile.
"""

import ast
import re
import sys
from pathlib import Path
from typing import Callable

REPO_ROOT = Path(__file__).resolve().parents[2]
PROJECT_PAGES = REPO_ROOT / "js" / "app" / "src" / "pages" / "project"


def extract_filter_dsl_expressions(path: Path, key: str) -> list[str]:
    """Extract every `<key>: "<literal>"` expression from a frontend DSL module.

    Tab-through placeholders (`${...}`) are reduced to their example text,
    exactly as the typeahead inserts them.
    """
    source = path.read_text()
    string_literal = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    literals = [
        ast.literal_eval(match.group(1))
        for match in re.finditer(rf"\b{key}:\s*{string_literal}", source)
    ]
    if len(literals) != source.count(f"{key}:"):
        raise ValueError(
            f"Parsed {len(literals)} `{key}:` string literals but found "
            f"{source.count(f'{key}:')} `{key}:` keys in {path} — "
            f"a `{key}:` value is not a plain string literal, so this check can't see it."
        )
    return [re.sub(r"\$\{([^{}]*)\}", r"\1", literal) for literal in literals]


def main() -> int:
    from phoenix.trace.dsl.session_filter import SessionFilter
    from phoenix.trace.dsl.trace_filter import TraceFilter

    compilers: list[tuple[Path, Callable[[str], object]]] = [
        (PROJECT_PAGES / "traceFilterDSL.ts", TraceFilter),
        (PROJECT_PAGES / "sessionFilterDSL.ts", SessionFilter),
    ]

    total = 0
    failures: list[tuple[Path, str, Exception]] = []
    for path, compile_filter in compilers:
        conditions = [
            condition
            for key in ("snippet", "expression")
            for condition in extract_filter_dsl_expressions(path, key)
        ]
        if not conditions:
            print(f"No `snippet:`/`expression:` literals found in {path} — check the regex.")
            return 1
        total += len(conditions)
        for condition in conditions:
            try:
                compile_filter(condition)
            except Exception as exc:  # noqa: BLE001 — report every failure kind
                failures.append((path, condition, exc))

    if failures:
        print(f"{len(failures)}/{total} UI filter DSL literals fail to compile:")
        for path, condition, error in failures:
            print(f"  {path.name}: {condition!r}: {error}")
        return 1

    print(f"All {total} UI filter DSL literals compile under the Python filters.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
