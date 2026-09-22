"""Standalone CI check: the evaluator editor's bound-variable lists match the server.

js/app/src/pages/project/evaluators/evaluatorBoundVariables.ts repeats the names
in phoenix.server.online_eval.bound_variables so the evaluator editor can order
and describe them without asking the server. The frontend's per-grain lookup
tables decide what gets checked, so a name, or a whole grain, added on one side
fails here until the other side is edited to match. Because the check spans
both languages, it runs as its own CI job, not inside the Python unit test
suite, which must never depend on js/ sources.

Exits non-zero listing every list that disagrees.
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MIRROR = (
    REPO_ROOT
    / "js"
    / "app"
    / "src"
    / "pages"
    / "project"
    / "evaluators"
    / "evaluatorBoundVariables.ts"
)

# Each grain a lookup table routes is paired with the `<GRAIN>_<suffix>` server constant.
GRAIN_TABLES = (
    ("BOUND_VARIABLES_BY_GRAIN", "BOUND_VARIABLE_NAMES"),
    ("METADATA_FIELDS_BY_GRAIN", "METADATA_FIELD_NAMES"),
)

STRING_ARRAYS = (
    ("SESSION_TURN_FIELD_NAMES", "SESSION_TURN_FIELDS"),
    ("SPAN_ANNOTATION_ENTRY_FIELD_NAMES", "SPAN_ANNOTATION_FIELDS"),
)


def _block(source: str, pattern: str, declaration: str) -> str:
    match = re.search(pattern, source, re.DOTALL | re.MULTILINE)
    if match is None:
        raise ValueError(
            f"No `{declaration}` declaration in {MIRROR.name}. If it was renamed or "
            "restructured, update this check to read the new shape."
        )
    return match.group(1)


def mirrored_names(source: str, declaration: str) -> set[str]:
    block = _block(
        source, rf"const {declaration}: EvaluatorBoundVariable\[\] = \[(.*?)^\];", declaration
    )
    return set(re.findall(r'name:\s*"([^"]+)"', block))


def mirrored_string_array(source: str, declaration: str) -> set[str]:
    block = _block(source, rf"const {declaration} = \[(.*?)\] as const;", declaration)
    return set(re.findall(r'"([^"]+)"', block))


def mirrored_grain_table(source: str, declaration: str) -> dict[str, str]:
    block = _block(source, rf"const {declaration}: Record<.*?> = \{{(.*?)^\}};", declaration)
    return dict(re.findall(r"^\s*(\w+):\s*(\w+),", block, re.MULTILINE))


def _compare(
    mirrored: set[str], server: frozenset[str], ts_declaration: str, server_constant: str
) -> list[str]:
    if mirrored == server:
        return []
    return [
        f"`{ts_declaration}` does not match `{server_constant}`: "
        f"only in TS {sorted(mirrored - server)}, only on the server {sorted(server - mirrored)}."
    ]


def main() -> int:
    from phoenix.server.online_eval import bound_variables

    source = MIRROR.read_text(encoding="utf-8")
    pairs: list[tuple[str, str]] = [
        (f"{grain.upper()}_{suffix}", ts_declaration)
        for table, suffix in GRAIN_TABLES
        for grain, ts_declaration in mirrored_grain_table(source, table).items()
    ]
    if not pairs:
        print(f"No grains found in the lookup tables of {MIRROR} — check the regex.")
        return 1

    failures: list[str] = []
    for server_constant, ts_declaration in pairs:
        server_names = getattr(bound_variables, server_constant, None)
        if server_names is None:
            failures.append(
                f"`{ts_declaration}` is routed for a grain with no `{server_constant}` in "
                "phoenix.server.online_eval.bound_variables."
            )
        else:
            failures += _compare(
                mirrored_names(source, ts_declaration),
                server_names,
                ts_declaration,
                server_constant,
            )
    for server_constant, ts_declaration in STRING_ARRAYS:
        server_names = getattr(bound_variables, server_constant)
        failures += _compare(
            mirrored_string_array(source, ts_declaration),
            server_names,
            ts_declaration,
            server_constant,
        )

    total = len(pairs) + len(STRING_ARRAYS)
    if failures:
        print(f"{len(failures)}/{total} lists in {MIRROR.name} disagree with the server:")
        for failure in failures:
            print(f"  {failure}")
        return 1

    print(f"All {total} lists in {MIRROR.name} match the server's bound variables.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
