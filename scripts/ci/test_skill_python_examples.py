"""Python examples in the public skills type-check against the workspace Phoenix packages.

Every fenced block tagged exactly ```python in ``skills/`` is written to a file and checked by
one ``pyright`` run in basic mode. ``phoenix.client``, ``phoenix.evals`` and ``phoenix.otel``
resolve to ``packages/phoenix-*/src`` in this checkout, so renaming a client function fails
every skill example that still calls it.

Most examples are fragments: they use names that the surrounding prose defines, such as a
``dataset`` or a ``call_llm`` helper. The check handles fragments this way:

- An undefined name isn't an error. Pyright treats it as ``Unknown``, so calls on it go
  unchecked, while every name imported from Phoenix is still checked.
- An import that doesn't resolve is an error only for ``phoenix`` modules. Third-party
  packages, such as ``langchain``, are the reader's to install.
- A block with top-level ``await`` is checked as the body of an ``async`` function.
- A line holding only ``...`` inside a call stands for the arguments the example leaves out.
- Lines from a ``# WRONG`` or ``# BAD`` comment up to the next ``# RIGHT``, ``# GOOD`` or
  ``# CORRECT`` comment show a mistake on purpose and aren't checked.
- To skip a whole block, such as a signature without a body, tag it ```python no-check.
  Blocks tagged ```python span-filter (or trace-filter, session-filter) hold filter
  conditions, which ``test_skill_filter_dsl_examples.py`` checks.

Lives outside tests/ so CI runs it only when a skill or a Python client package changes.
"""

from __future__ import annotations

import ast
import json
import re
import subprocess
import sys
import textwrap
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import pytest
from skill_examples import REPO_ROOT, location, public_skill_dirs

_PYTHON_FENCE = re.compile(r"^[ \t]*```python[ \t]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)
_WRONG_START = re.compile(r"^\s*#\s*(WRONG|BAD)\b")
_WRONG_END = re.compile(r"^\s*#\s*(RIGHT|GOOD|CORRECT)\b")
_ELLIPSIS_ARGUMENTS = re.compile(r"^(\s*)\.\.\.,?\s*$", re.MULTILINE)
_CHECKED_PACKAGES = ("client", "evals", "otel")
_PYRIGHT_CONFIG = {
    "include": ["examples"],
    "typeCheckingMode": "basic",
    "reportUndefinedVariable": "none",
    "reportUnusedExpression": "none",
    "reportMissingModuleSource": "none",
}

# Examples that fail today, keyed by test ID. Each entry is a bug in the skill; fix the skill
# and delete its entry. The tests are strict, so a fixed example fails until its entry goes.
KNOWN_BROKEN = {
    "skills/phoenix-evals/references/experiments-overview.md#0": (
        "RanExperiment has no aggregate_scores"
    ),
    "skills/phoenix-evals/references/fundamentals.md#3": "RanExperiment has no aggregate_scores",
    "skills/phoenix-evals/references/fundamentals-anti-patterns.md#0": (
        "RanExperiment has no pass_rate"
    ),
    "skills/phoenix-evals/references/experiments-running-python.md#0": (
        "datasets.get_dataset takes dataset=, not name="
    ),
    "skills/phoenix-tracing/references/instrumentation-atif-python.md#1": (
        "a signature without a body doesn't parse; tag it python no-check"
    ),
    "skills/phoenix-tracing/references/instrumentation-manual-python.md#4": (
        "log_spans needs Span objects; annotate the list as list[Span]"
    ),
}


@dataclass(frozen=True)
class Example:
    """A fenced Python block and where its code starts in the Markdown file."""

    id: str
    source: str
    first_line: int


def _examples() -> list[Example]:
    examples = []
    for skill_dir in public_skill_dirs():
        for path in sorted(skill_dir.rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            for index, match in enumerate(_PYTHON_FENCE.finditer(text)):
                examples.append(
                    Example(
                        id=f"{location(path)}#{index}",
                        source=textwrap.dedent(match.group(1)),
                        first_line=text.count("\n", 0, match.start(1)) + 1,
                    )
                )
    return examples


def _blank_wrong_examples(source: str) -> str:
    """Blanks deliberate mistakes, keeping line numbers."""
    lines = source.splitlines()
    in_wrong = False
    for index, line in enumerate(lines):
        if _WRONG_START.match(line):
            in_wrong = True
        elif _WRONG_END.match(line):
            in_wrong = False
        if in_wrong:
            lines[index] = ""
    return "\n".join(lines) + "\n"


def _parses(source: str) -> bool:
    try:
        ast.parse(source)
    except SyntaxError:
        return False
    return True


def _awaits_at_top_level(source: str) -> bool:
    """Checks whether the code awaits outside a function, as a notebook cell can."""
    pending: list[ast.AST] = [ast.parse(source)]
    while pending:
        node = pending.pop()
        if isinstance(node, (ast.Await, ast.AsyncFor, ast.AsyncWith)):
            return True
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            pending.extend(ast.iter_child_nodes(node))
    return False


def checkable_source(example: Example) -> tuple[str, int]:
    """Returns the code pyright checks and how many lines it adds before the example."""
    source = _blank_wrong_examples(example.source)
    if not _parses(source):
        without_ellipses = _ELLIPSIS_ARGUMENTS.sub(r"\1**{},", source)
        if not _parses(without_ellipses):
            return source, 0  # Pyright reports the syntax error.
        source = without_ellipses
    if _awaits_at_top_level(source):
        return "async def _example():\n" + textwrap.indent(source, "    "), 1
    return source, 0


EXAMPLES = _examples()


def _is_reported(diagnostic: dict[str, object]) -> bool:
    if diagnostic["severity"] != "error":
        return False
    if diagnostic.get("rule") == "reportMissingImports":
        return '"phoenix' in str(diagnostic["message"])
    return True


@pytest.fixture(scope="module")
def errors_by_example(tmp_path_factory: pytest.TempPathFactory) -> dict[str, list[str]]:
    """Runs pyright once over every example and groups its errors by example."""
    root = tmp_path_factory.mktemp("skill_python_examples")
    # A regular `phoenix` package at the root shadows the server's `src/phoenix`, which would
    # otherwise hide the client packages' `phoenix` namespace from pyright.
    shim = root / "phoenix"
    shim.mkdir()
    (shim / "__init__.py").touch()
    for package in _CHECKED_PACKAGES:
        (shim / package).symlink_to(
            REPO_ROOT / "packages" / f"phoenix-{package}" / "src" / "phoenix" / package,
            target_is_directory=True,
        )
    (root / "pyrightconfig.json").write_text(json.dumps(_PYRIGHT_CONFIG), encoding="utf-8")
    examples_dir = root / "examples"
    examples_dir.mkdir()
    files: dict[str, tuple[Example, int]] = {}
    for number, example in enumerate(EXAMPLES):
        source, offset = checkable_source(example)
        file = examples_dir / f"example_{number}.py"
        file.write_text(source, encoding="utf-8")
        files[str(file.resolve())] = (example, offset)

    result = subprocess.run(
        [sys.executable, "-m", "pyright", "--outputjson", "--pythonpath", sys.executable],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"pyright didn't return JSON:\n{result.stdout}\n{result.stderr}")

    errors: dict[str, list[str]] = defaultdict(list)
    for diagnostic in report["generalDiagnostics"]:
        if not _is_reported(diagnostic):
            continue
        example, offset = files[str(Path(diagnostic["file"]).resolve())]
        line = example.first_line + diagnostic["range"]["start"]["line"] - offset
        markdown_file = example.id.split("#")[0]
        errors[example.id].append(f"{markdown_file}:{line}: {diagnostic['message']}")
    return errors


def test_fence_pattern_finds_examples() -> None:
    assert EXAMPLES


def test_known_broken_examples_exist() -> None:
    assert not set(KNOWN_BROKEN) - {example.id for example in EXAMPLES}


@pytest.mark.parametrize(
    "example",
    [
        pytest.param(
            example,
            id=example.id,
            marks=[pytest.mark.xfail(reason=KNOWN_BROKEN[example.id], strict=True)]
            if example.id in KNOWN_BROKEN
            else [],
        )
        for example in EXAMPLES
    ],
)
def test_example_type_checks(errors_by_example: dict[str, list[str]], example: Example) -> None:
    assert not errors_by_example.get(example.id), "\n".join(errors_by_example[example.id])
