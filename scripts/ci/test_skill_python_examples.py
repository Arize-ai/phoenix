"""Python examples in the public skills type-check against the workspace Phoenix packages.

Every fenced block tagged exactly ```python in ``skills/`` is written to a file and checked by
one ``pyright`` run in basic mode. ``phoenix.client``, ``phoenix.evals`` and ``phoenix.otel``
resolve to ``packages/phoenix-*/src`` in this checkout, so renaming a client function fails
every skill example that still calls it.

Most examples are fragments: they use names that the surrounding prose defines, such as a
``dataset`` or a ``call_llm`` helper. The check handles fragments this way:

- An undefined name isn't an error. A Phoenix export, such as ``register`` or
  ``ClassificationEvaluator``, gets its real type, as if the block imported it. So do a few
  variable names the skills use for Phoenix objects, such as ``dataset`` and ``experiment``.
  ``client`` gets the ``Client`` type only when the block reads a resource such as
  ``client.spans``, because some skills name an OpenAI client ``client``. Every other undefined
  name is ``Unknown``, so calls on it go unchecked.
- An import that doesn't resolve is an error only for ``phoenix`` modules. Third-party
  packages, such as ``langchain``, are the reader's to install.
- A block with top-level ``await`` is checked as the body of an ``async`` function.
- A line holding only ``...`` or ``# ...`` inside a call stands for the arguments the example
  leaves out.
- Lines from a ``# WRONG`` or ``# BAD`` comment up to the next ``# RIGHT``, ``# GOOD`` or
  ``# CORRECT`` comment show a mistake on purpose and aren't checked.
- To skip a whole block, such as a signature without a body, tag it ```python no-check.
  Blocks tagged ```python span-filter (or trace-filter, session-filter) hold filter
  conditions, which ``test_skill_filter_dsl_examples.py`` checks.

Keyword arguments to a function that takes ``**kwargs``, such as ``register``, ``LLM`` and the
optional arguments of ``ClassificationEvaluator``, aren't checked: pyright accepts any keyword.
The check copies ``phoenix.evals`` with two typing gaps closed (see ``_copy_typed_evals``), and
ignores one client typing bug (see ``_is_reported``).

Lives outside tests/ so CI runs it only when a skill or a Python client package changes.
"""

from __future__ import annotations

import ast
import json
import re
import shutil
import subprocess
import sys
import textwrap
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from skill_examples import REPO_ROOT, location, public_skill_dirs

_PYTHON_FENCE = re.compile(r"^[ \t]*```python[ \t]*\n(.*?)^[ \t]*```", re.DOTALL | re.MULTILINE)
_WRONG_START = re.compile(r"^\s*#\s*(WRONG|BAD)\b")
_WRONG_END = re.compile(r"^\s*#\s*(RIGHT|GOOD|CORRECT)\b")
_ELLIPSIS_ARGUMENTS = re.compile(r"^(\s*)\.\.\.,?\s*$", re.MULTILINE)
_COMMENT_ELLIPSIS = re.compile(r"^(\s*)#\s*\.\.\.\s*$", re.MULTILINE)
_FUTURE_IMPORT = re.compile(r"^from __future__ import .*\n", re.MULTILINE)
_CHECKED_PACKAGES = ("client", "evals", "otel")
# Modules whose public exports a fragment may use without importing them.
_EXPORTING_MODULES = (
    "phoenix.client",
    "phoenix.client.experiments",
    "phoenix.evals",
    "phoenix.otel",
)
# Resources on `Client`. A block that uses `client` gets the Phoenix type only when it reads one
# of these, because some skills call an OpenAI client `client` too.
_CLIENT_RESOURCES = frozenset(
    {"annotations", "datasets", "experiments", "projects", "prompts", "sessions", "spans", "traces"}
)
_CLIENT_NAMES = frozenset({"client", "async_client"})
# Variable names the skills use for Phoenix objects, and the type each one holds. `llm` isn't
# here, because some skills use it for a LangChain model.
_VARIABLES = {
    "client": ("phoenix.client", "Client"),
    "px_client": ("phoenix.client", "Client"),
    "phoenix_client": ("phoenix.client", "Client"),
    "async_client": ("phoenix.client", "AsyncClient"),
    "dataset": ("phoenix.client.resources.datasets", "Dataset"),
    "experiment": ("phoenix.client.resources.experiments.types", "RanExperiment"),
    "tracer_provider": ("phoenix.otel", "TracerProvider"),
}
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
    "skills/phoenix-evals/references/experiments-datasets-python.md#2": (
        "datasets.get_dataset takes dataset=, not name="
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
    # A `# ...` line inside a call also stands for left-out arguments.
    without_comment_ellipses = _COMMENT_ELLIPSIS.sub(r"\1**{},", source)
    if without_comment_ellipses != source and _parses(without_comment_ellipses):
        source = without_comment_ellipses
    if _awaits_at_top_level(source):
        return "async def _example():\n" + textwrap.indent(source, "    "), 1
    return source, 0


EXAMPLES = _examples()


def _package_source(package: str) -> Path:
    return REPO_ROOT / "packages" / f"phoenix-{package}" / "src" / "phoenix" / package


def _copy_typed_evals(destination: Path) -> None:
    """Copies ``phoenix.evals`` with two typing gaps closed, so pyright sees its API.

    The module ``__getattr__`` returns ``Any``, which makes every ``from phoenix.evals import X``
    resolve, even for names the package doesn't have. The deprecation decorators in ``utils.py``
    return ``Callable[..., Any]``, which hides the signature of every function they wrap. A
    patch whose code has changed is skipped, so the check keeps working after the package
    closes either gap itself.
    """
    shutil.copytree(
        _package_source("evals"), destination, ignore=shutil.ignore_patterns("__pycache__")
    )
    patches = {
        "__init__.py": [("def __getattr__(", "def _lazy_getattr(")],
        "utils.py": [
            (
                "import pandas as pd\n",
                'import pandas as pd\n\n_F = TypeVar("_F", bound=Callable)\n',
            ),
            ("from typing import Any,", "from typing import TypeVar, Any,"),
            (
                ") -> Callable[[Callable[..., Any]], Callable[..., Any]]:",
                ") -> Callable[[_F], _F]:",
            ),
            (
                "(func: Callable[..., Any]) -> Callable[..., Any]:",
                "(func: _F) -> _F:",
            ),
        ],
    }
    for name, replacements in patches.items():
        path = destination / name
        text = path.read_text(encoding="utf-8")
        if all(old in text for old, _ in replacements):
            for old, new in replacements:
                text = text.replace(old, new)
            path.write_text(text, encoding="utf-8")


def make_project(root: Path) -> None:
    """Lays out the pyright project the examples are checked in, minus the examples."""
    # A regular `phoenix` package at the root shadows the server's `src/phoenix`, which would
    # otherwise hide the client packages' `phoenix` namespace from pyright.
    shim = root / "phoenix"
    shim.mkdir()
    (shim / "__init__.py").touch()
    for package in _CHECKED_PACKAGES:
        if package == "evals":
            _copy_typed_evals(shim / package)
        else:
            (shim / package).symlink_to(_package_source(package), target_is_directory=True)
    (root / "examples").mkdir()


def _exports(shim: Path) -> dict[str, str]:
    """Maps each name that exactly one public Phoenix module exports to that module."""
    owners: dict[str, list[str]] = defaultdict(list)
    for module in _EXPORTING_MODULES:
        package = shim.parent.joinpath(*module.split("."))
        tree = ast.parse((package / "__init__.py").read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(
                isinstance(target, ast.Name) and target.id == "__all__" for target in node.targets
            ):
                for name in ast.literal_eval(node.value):
                    # Submodules such as `phoenix.evals.llm` collide with prose names like `llm`.
                    is_submodule = (package / name).is_dir() or (package / f"{name}.py").exists()
                    if not is_submodule and not name.startswith("_"):
                        owners[name].append(module)
    return {name: modules[0] for name, modules in owners.items() if len(modules) == 1}


def _reads_client_resource(source: str) -> bool:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return False
    return any(
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id in _CLIENT_NAMES
        and node.attr in _CLIENT_RESOURCES
        for node in ast.walk(tree)
    )


def prelude(source: str, undefined: set[str], exports: dict[str, str]) -> str:
    """Returns the imports that give a fragment's undefined Phoenix names their real types."""
    names = {name for name in undefined if name in exports or name in _VARIABLES}
    if not _reads_client_resource(source):
        names -= _CLIENT_NAMES
    lines = []
    for name in sorted(names):
        if name in exports:
            lines.append(f"from {exports[name]} import {name}")
        else:
            module, type_name = _VARIABLES[name]
            lines.append(f"from {module} import {type_name} as _{name}_type")
            lines.append(f"{name} = _cast(_{name}_type, None)")
    if not lines:
        return ""
    return "\n".join(["from typing import cast as _cast", *lines]) + "\n"


def run_pyright(root: Path, **config: object) -> list[dict[str, Any]]:
    (root / "pyrightconfig.json").write_text(
        json.dumps({**_PYRIGHT_CONFIG, **config}), encoding="utf-8"
    )
    result = subprocess.run(
        [sys.executable, "-m", "pyright", "--outputjson", "--pythonpath", sys.executable],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        diagnostics: list[dict[str, Any]] = json.loads(result.stdout)["generalDiagnostics"]
    except json.JSONDecodeError:
        pytest.fail(f"pyright didn't return JSON:\n{result.stdout}\n{result.stderr}")
    return diagnostics


def write_sources(root: Path, sources: Sequence[str]) -> list[tuple[Path, int]]:
    """Writes each source with its prelude; returns each file and the lines the prelude adds."""
    files = []
    for number, source in enumerate(sources):
        file = root / "examples" / f"example_{number}.py"
        file.write_text(source, encoding="utf-8")
        files.append(file.resolve())
    undefined: dict[Path, set[str]] = defaultdict(set)
    for diagnostic in run_pyright(root, reportUndefinedVariable="error"):
        if diagnostic.get("rule") == "reportUndefinedVariable":
            if match := re.search(r'"(.+?)" is not defined', diagnostic["message"]):
                undefined[Path(diagnostic["file"]).resolve()].add(match.group(1))
    exports = _exports(root / "phoenix")
    written = []
    for file, source in zip(files, sources):
        header = prelude(source, undefined[file], exports)
        # A `from __future__` import must stay first.
        future = "".join(_FUTURE_IMPORT.findall(source))
        if header:
            file.write_text(future + header + _FUTURE_IMPORT.sub("\n", source), encoding="utf-8")
        written.append((file, header.count("\n")))
    return written


def _is_reported(diagnostic: dict[str, Any]) -> bool:
    if diagnostic["severity"] != "error":
        return False
    message = str(diagnostic["message"])
    if diagnostic.get("rule") == "reportMissingImports":
        return '"phoenix' in message
    # phoenix-client's `EvalsEvaluator` protocol doesn't match `phoenix.evals.Evaluator`, so
    # pyright rejects a phoenix.evals evaluator passed to `run_experiment`, which works at run time.
    if 'parameter "evaluators"' in message and '"phoenix.evals.evaluators.Evaluator"' in message:
        return False
    return True


@pytest.fixture(scope="module")
def errors_by_example(tmp_path_factory: pytest.TempPathFactory) -> dict[str, list[str]]:
    """Runs pyright over every example and groups its errors by example."""
    root = tmp_path_factory.mktemp("skill_python_examples")
    make_project(root)
    checkable = [checkable_source(example) for example in EXAMPLES]
    written = write_sources(root, [source for source, _ in checkable])
    files = {
        file: (example, offset + prelude_lines)
        for example, (_, offset), (file, prelude_lines) in zip(EXAMPLES, checkable, written)
    }
    errors: dict[str, list[str]] = defaultdict(list)
    for diagnostic in run_pyright(root):
        if not _is_reported(diagnostic):
            continue
        example, offset = files[Path(diagnostic["file"]).resolve()]
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
