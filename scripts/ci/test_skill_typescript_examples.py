"""TypeScript examples in the public skills type-check against the workspace Phoenix packages.

Every fenced block tagged exactly ```typescript or ```ts in ``skills/`` is written to a file and
checked by one ``tsc`` run. ``@arizeai/phoenix-client``, ``@arizeai/phoenix-evals`` and
``@arizeai/phoenix-otel`` resolve to ``js/packages/phoenix-*`` in this checkout, through their
built ``exports``, so renaming a client function fails every skill example that still calls it.

The check handles fragments the way ``test_skill_python_examples.py`` does:

- An undefined name isn't an error. TypeScript treats it as ``any``, so calls on it go
  unchecked, while every name imported from Phoenix is still checked. A block that calls
  ``register`` or ``getSpans`` without importing it gets the import, so those calls are
  checked too.
- An import that doesn't resolve is an error only for ``@arizeai/phoenix-*`` modules. Other
  packages resolve when one of the three Phoenix packages depends on them, such as
  ``@arizeai/openinference-core``; the rest are the reader's to install.
- Each block is its own ES module, so top-level ``await`` works and blocks don't share names.
- ``(...)``, or a line holding only ``...``, stands for the arguments the example leaves out.
- To skip a whole block, tag it ```typescript no-check.

A syntax error in any file stops ``tsc`` from type-checking every file, so the check runs
``tsc`` again without the blocks that don't parse.

Lives outside tests/ so CI runs it only when a skill or a TypeScript client package changes. It
needs ``pnpm install`` in ``js/`` and the three packages built;
``make check-skill-typescript-examples`` builds them.
"""

from __future__ import annotations

import json
import re
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import NamedTuple

import pytest
from skill_examples import REPO_ROOT, location, public_skill_dirs

JS_ROOT = REPO_ROOT / "js"
_TSC = JS_ROOT / "node_modules" / ".bin" / "tsc"
_CHECKED_PACKAGES = ("phoenix-client", "phoenix-evals", "phoenix-otel")
_TYPESCRIPT_FENCE = re.compile(
    r"^[ \t]*```(?:typescript|ts)[ \t]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE
)
_TSCONFIG = {
    "compilerOptions": {
        "target": "es2022",
        "module": "esnext",
        "moduleResolution": "bundler",
        "lib": ["es2023", "dom"],
        "types": ["node"],
        "strict": True,
        "noImplicitAny": False,
        "skipLibCheck": True,
        "noEmit": True,
        "esModuleInterop": True,
    },
}
_DIAGNOSTIC = re.compile(r"^(?P<file>[^\s(][^(]*)\((?P<line>\d+),\d+\): error TS(?P<code>\d+): ")
# Cannot find name 'x' (2304), with a suggestion (2552), for a Node, test or DOM global, or as a
# shorthand property (18004).
_UNDEFINED_NAME_CODES = frozenset({"2304", "2552", "2580", "2581", "2582", "2591", "2592", "18004"})
# Cannot find module 'x' (2307, 2792, 2882), or it has no type declarations (7016).
_MISSING_MODULE_CODES = frozenset({"2307", "2792", "2882", "7016"})
_MODULE_NAME = re.compile(r"(?:module|import of) '([^']+)'")
_OMITTED_ARGUMENTS = re.compile(r"\(\s*\.\.\.\s*\)")
_OMITTED_ARGUMENT_LINE = re.compile(r"^(\s*)\.\.\.,?\s*$", re.MULTILINE)
_SPREAD_ANYTHING = "...([] as any[])"
# Phoenix functions that fragments often call without importing them, and where they live.
_PRELUDE_IMPORTS = {
    "register": "@arizeai/phoenix-otel",
    "getSpans": "@arizeai/phoenix-client/spans",
}

# Examples that fail today, keyed by test ID. Each entry is a bug in the skill; fix the skill
# and delete its entry. The tests are strict, so a fixed example fails until its entry goes.
KNOWN_BROKEN = {
    "skills/phoenix-evals/references/experiments-datasets-typescript.md#0": (
        "the block declares datasetId twice"
    ),
    "skills/phoenix-evals/references/experiments-datasets-typescript.md#3": (
        "@arizeai/phoenix-client/datasets has no listDatasets"
    ),
    "skills/phoenix-evals/references/integrations-vitest-jest.md#2": (
        "test.each names a case with a function that can return undefined"
    ),
    "skills/phoenix-evals/references/observe-sampling-typescript.md#2": (
        "groupBy returns an attribute typed {}, not a string"
    ),
    "skills/phoenix-evals/references/observe-tracing-setup.md#0": (
        "@arizeai/phoenix-otel has no registerPhoenix; use register"
    ),
    "skills/phoenix-evals/references/validation-evaluators-typescript.md#1": (
        "@arizeai/phoenix-client/datasets has no createOrGetDataset"
    ),
}


@dataclass(frozen=True)
class Example:
    """A fenced TypeScript block and where its code starts in the Markdown file."""

    id: str
    source: str
    first_line: int


def _examples() -> list[Example]:
    examples = []
    for skill_dir in public_skill_dirs():
        for path in sorted(skill_dir.rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            for index, match in enumerate(_TYPESCRIPT_FENCE.finditer(text)):
                examples.append(
                    Example(
                        id=f"{location(path)}#{index}",
                        source=match.group(1),
                        first_line=text.count("\n", 0, match.start(1)) + 1,
                    )
                )
    return examples


EXAMPLES = _examples()


def _link_node_modules(node_modules: Path) -> None:
    """Links the Phoenix packages and their own dependencies, Phoenix's copies first."""
    linked: set[str] = set()

    def link(name: str, target: Path) -> None:
        if name in linked:
            return
        linked.add(name)
        destination = node_modules / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.symlink_to(target.resolve(), target_is_directory=True)

    for package in _CHECKED_PACKAGES:
        link(f"@arizeai/{package}", JS_ROOT / "packages" / package)
    for package in _CHECKED_PACKAGES:
        dependencies = JS_ROOT / "packages" / package / "node_modules"
        for entry in sorted(dependencies.iterdir()):
            if entry.name.startswith("."):
                continue
            if entry.name.startswith("@"):
                for scoped in sorted(entry.iterdir()):
                    link(f"{entry.name}/{scoped.name}", scoped)
            else:
                link(entry.name, entry)


def _prelude(source: str) -> str:
    """Returns imports for the Phoenix functions a fragment calls without importing them."""
    lines = []
    for name, module in _PRELUDE_IMPORTS.items():
        calls = re.search(rf"(?<![.\w]){name}\s*\(", source)
        imports = re.search(rf"\bimport\b[^;]*?\b{name}\b[^;]*?\bfrom\b", source, re.DOTALL)
        declares = re.search(rf"\b(function|const|let|var)\s+{name}\b", source)
        if calls and not (imports or declares):
            lines.append(f'import {{ {name} }} from "{module}";\n')
    return "".join(lines)


def checkable_source(example: Example) -> tuple[str, int]:
    """Returns the code tsc checks and how many lines it adds before the example."""
    source = _OMITTED_ARGUMENTS.sub(f"({_SPREAD_ANYTHING})", example.source)
    source = _OMITTED_ARGUMENT_LINE.sub(rf"\1{_SPREAD_ANYTHING},", source)
    prelude = _prelude(source)
    # The trailing export makes each block a module, so top-level await is allowed.
    return prelude + source + "\nexport {};\n", prelude.count("\n")


def _is_syntax_error(code: str) -> bool:
    return code.startswith("1") and len(code) == 4


def _is_reported(code: str, message: str) -> bool:
    if code in _UNDEFINED_NAME_CODES:
        return False
    if code in _MISSING_MODULE_CODES:
        module = _MODULE_NAME.search(message)
        return bool(module and module.group(1).startswith("@arizeai/phoenix-"))
    return True


class Diagnostic(NamedTuple):
    file: str
    code: str
    line: int
    message: str


def _run_tsc(root: Path, files: list[str]) -> list[Diagnostic]:
    config = {**_TSCONFIG, "files": files}
    (root / "tsconfig.json").write_text(json.dumps(config), encoding="utf-8")
    result = subprocess.run(
        [str(_TSC), "--project", "tsconfig.json", "--pretty", "false"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    diagnostics = []
    for output_line in result.stdout.splitlines():
        if output_line.startswith(" "):
            continue  # The rest of a multi-line message.
        diagnostic = _DIAGNOSTIC.match(output_line)
        if diagnostic is None:
            pytest.fail(f"Couldn't parse tsc output:\n{result.stdout}\n{result.stderr}")
        message = output_line[diagnostic.end() :]
        diagnostics.append(
            Diagnostic(diagnostic["file"], diagnostic["code"], int(diagnostic["line"]), message)
        )
    return diagnostics


@pytest.fixture(scope="module")
def errors_by_example(tmp_path_factory: pytest.TempPathFactory) -> dict[str, list[str]]:
    """Runs tsc over every example and groups its errors by example."""
    if not _TSC.exists():
        pytest.fail(f"{_TSC} is missing. Run `pnpm install` in js/.")
    root = tmp_path_factory.mktemp("skill_typescript_examples")
    _link_node_modules(root / "node_modules")
    examples_dir = root / "examples"
    examples_dir.mkdir()
    files: dict[str, tuple[Example, int]] = {}
    for number, example in enumerate(EXAMPLES):
        path = examples_dir / f"example_{number}.ts"
        source, offset = checkable_source(example)
        path.write_text(source, encoding="utf-8")
        files[f"examples/{path.name}"] = (example, offset)

    errors: dict[str, list[str]] = defaultdict(list)
    remaining = sorted(files)
    while True:
        syntax_errors = False
        for file, code, line, message in _run_tsc(root, remaining):
            if file not in files:
                pytest.fail(f"tsc reported an error outside the examples: {file}: {message}")
            if not _is_reported(code, message):
                continue
            if _is_syntax_error(code) and file in remaining:
                remaining.remove(file)
                syntax_errors = True
            example, offset = files[file]
            markdown_line = example.first_line + line - 1 - offset
            errors[example.id].append(f"{example.id.split('#')[0]}:{markdown_line}: {message}")
        if not syntax_errors:
            break
        for file in remaining:
            errors.pop(files[file][0].id, None)  # Rerun with the files that parse.
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
