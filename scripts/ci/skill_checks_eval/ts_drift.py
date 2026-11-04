"""Drift injection for the TypeScript example check, on the built type declarations.

Each mutation edits the built ``.d.ts`` files of ``@arizeai/phoenix-{client,evals,otel}`` in
place, as a rebuilt package would after a rename, and restores them afterwards. The oracle is a
regular expression over each example's source, such as a ``getSpans(`` call or a
``projectName:`` key in a ``register({...})`` call. It's a smaller sample than ``drift.py``'s.

Usage: ``uv run python scripts/ci/skill_checks_eval/ts_drift.py`` (needs ``pnpm install`` in
js/ and the three packages built; ``make check-skill-typescript-examples`` builds them)
"""

from __future__ import annotations

import re
import sys
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import test_skill_typescript_examples as check  # noqa: E402


@dataclass(frozen=True)
class Mutation:
    name: str
    package: str
    declaration: str  # a glob under dist/, matched in esm and src
    pattern: str
    replacement: str
    oracle: str


def _call_with_key(function: str, key: str) -> str:
    return rf"\b{function}\s*\(\s*\{{[^;]*?\b{key}\s*:"


MUTATIONS = (
    Mutation(
        "otel register renamed",
        "phoenix-otel",
        "**/*.d.ts",
        r"\bregister\b(?!Instrumentations|\.js)",
        "registerTracing",
        r"\bregister\b(?!Instrumentations)",
    ),
    Mutation(
        "register projectName renamed to project",
        "phoenix-otel",
        "*/register.d.ts",
        r"^(\s+)projectName\?:",
        r"\1project?:",
        _call_with_key("register", "projectName"),
    ),
    Mutation(
        "getSpans renamed to listSpans",
        "phoenix-client",
        "*/spans/*.d.ts",
        r"\bgetSpans\b",
        "listSpans",
        r"\bgetSpans\b",
    ),
    Mutation(
        "getSpans project renamed to projectIdentifier",
        "phoenix-client",
        "*/spans/getSpans.d.ts",
        r"^(\s+)project: ProjectIdentifier;",
        r"\1projectIdentifier: ProjectIdentifier;",
        _call_with_key("getSpans", "project"),
    ),
    Mutation(
        "getTraces renamed to listTraces",
        "phoenix-client",
        "*/traces/*.d.ts",
        r"\bgetTraces\b",
        "listTraces",
        r"\bgetTraces\b",
    ),
    Mutation(
        "runExperiment evaluators renamed to evals",
        "phoenix-client",
        "*/experiments/runExperiment.d.ts",
        r"^(\s+)evaluators\?:",
        r"\1evals?:",
        _call_with_key("runExperiment", "evaluators"),
    ),
    Mutation(
        "classification choices renamed to labels",
        "phoenix-evals",
        "*/types/evals.d.ts",
        r"^(\s+)choices: ClassificationChoicesMap;",
        r"\1labels: ClassificationChoicesMap;",
        _call_with_key("createClassificationEvaluator", "choices"),
    ),
    Mutation(
        "createClient renamed",
        "phoenix-client",
        "**/*.d.ts",
        r"\bcreateClient\b",
        "createPhoenixClient",
        r"\bcreateClient\b",
    ),
)


class _TempPaths:
    def __init__(self, root: Path) -> None:
        self.root = root

    def mktemp(self, name: str) -> Path:
        return Path(tempfile.mkdtemp(prefix=name, dir=self.root))


def _errors(work: Path) -> dict[str, list[str]]:
    run: Any = check.errors_by_example.__wrapped__  # type: ignore[attr-defined]
    return dict(run(_TempPaths(work)))


@contextmanager
def applied(mutation: Mutation) -> Iterator[None]:
    """Edits the built declarations in place and restores them afterwards.

    A copy of the packages doesn't work: phoenix-client depends on phoenix-otel and
    phoenix-evals through workspace links, and tsc dedupes a package by name and version, so
    it would read the unmutated declarations.
    """
    dist = check.JS_ROOT / "packages" / mutation.package / "dist"
    originals: dict[Path, str] = {}
    try:
        for path in dist.glob(mutation.declaration):
            text = path.read_text(encoding="utf-8")
            changed, n = re.subn(mutation.pattern, mutation.replacement, text, flags=re.MULTILINE)
            if n:
                originals[path] = text
                path.write_text(changed, encoding="utf-8")
        if not originals:
            raise ValueError(f"{mutation.name}: nothing matched")
        yield
    finally:
        for path, text in originals.items():
            path.write_text(text, encoding="utf-8")


def main() -> None:
    total_affected = total_caught = 0
    with tempfile.TemporaryDirectory() as work:
        baseline = _errors(Path(work))
        for mutation in MUTATIONS:
            with applied(mutation):
                errors = _errors(Path(work))
            affected = {
                e.id for e in check.EXAMPLES if re.search(mutation.oracle, e.source, re.DOTALL)
            }
            flagged = {i for i, m in errors.items() if set(m) - set(baseline.get(i, []))}
            caught = affected & flagged
            total_affected += len(affected)
            total_caught += len(caught)
            print(
                f"{mutation.name:48} {len(caught):>3}/{len(affected):<3} "
                f"+{len(flagged - affected)} spurious"
            )
            for missed in sorted(affected - flagged):
                print(f"    missed {missed}")
    print(f"recall {total_caught}/{total_affected} = {total_caught / total_affected:.0%}")


if __name__ == "__main__":
    main()
