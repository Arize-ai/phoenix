"""Standalone CI check: the evaluator path field previews what the server binds.

js/app/src/components/evaluators/__tests__/evaluatorPathParity.json lists mapping
paths, the context each is read against, and the outcome the path field's reader
reports for it. A vitest test holds the reader to the same fixture, so a path that
previews one value in the editor and binds another at evaluation time fails one
side or the other, as does a path one side accepts and the other rejects. Because
the check spans both languages, it runs as its own CI job, not inside the Python
unit test suite, which must never depend on js/ sources.

Exits non-zero listing every row whose server outcome differs from the fixture.
"""

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE = (
    REPO_ROOT
    / "js"
    / "app"
    / "src"
    / "components"
    / "evaluators"
    / "__tests__"
    / "evaluatorPathParity.json"
)
MAPPED_KEY = "value"


def _canonical(value: Any) -> str:
    # Strict: Python's `True == 1` and `1 == 1.0` would hide a type mismatch.
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def main() -> int:
    from pydantic import ValidationError

    from phoenix.db.types.evaluators import InputMapping
    from phoenix.server.api.evaluators import apply_input_mapping

    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    contexts: dict[str, dict[str, Any]] = fixture["contexts"]
    checked = 0
    failures: list[str] = []
    for case in fixture["cases"]:
        outcome = case["outcome"]
        checked += 1
        path = case["path"]
        try:
            mapping = InputMapping(literal_mapping={}, path_mapping={MAPPED_KEY: path})
        except ValidationError as error:
            if outcome != "invalid":
                failures.append(f"{path!r}: the server rejects this path: {error}")
            continue
        if outcome == "invalid":
            failures.append(f"{path!r}: expected the server to reject this path")
            continue
        try:
            value = apply_input_mapping(
                input_schema={}, input_mapping=mapping, context=contexts[case["context"]]
            )[MAPPED_KEY]
        except Exception as error:
            if outcome != "unresolved":
                failures.append(
                    f"{path!r}: expected {_canonical(case['value'])}, "
                    f"the server raised {type(error).__name__}: {error}"
                )
            continue
        if outcome == "unresolved":
            failures.append(f"{path!r}: expected no match, the server bound {_canonical(value)}")
        elif _canonical(value) != _canonical(case["value"]):
            failures.append(
                f"{path!r}: expected {_canonical(case['value'])}, "
                f"the server bound {_canonical(value)}"
            )

    if checked == 0:
        print(f"No checkable rows in {FIXTURE} — check the fixture's shape.")
        return 1
    if failures:
        print(f"{len(failures)}/{checked} rows in {FIXTURE.name} disagree with the server:")
        for failure in failures:
            print(f"  {failure}")
        return 1

    print(f"All {checked} rows in {FIXTURE.name} match what the server binds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
