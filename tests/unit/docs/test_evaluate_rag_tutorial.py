"""The Evaluate RAG tutorial installs every package that its code imports.

The tutorial once installed `arize-phoenix[experimental,llama-index]`, an extra that no
longer exists, so none of the LlamaIndex packages that its cells import were installed,
and its imports used the module layout that LlamaIndex removed in 0.10.
"""

import ast
import re
import sys
from importlib.metadata import requires
from pathlib import Path

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

TUTORIAL = (
    Path(__file__).resolve().parents[3]
    / "docs"
    / "phoenix"
    / "cookbook"
    / "evaluation"
    / "evaluate-rag.mdx"
)

# The distribution that provides each non-standard-library module the tutorial imports.
# Modules from the LlamaIndex layout removed in 0.10 (`llama_index`, `llama_index.llms`,
# `llama_index.node_parser`) are left out on purpose, so importing them fails the test.
MODULE_DISTRIBUTIONS = {
    "llama_index.core": "llama-index",
    "llama_index.llms.openai": "llama-index-llms-openai",
    "nest_asyncio": "nest-asyncio",
    "numpy": "numpy",
    "openinference.instrumentation.llama_index": "openinference-instrumentation-llama-index",
    "opentelemetry.exporter.otlp.proto.http": "opentelemetry-exporter-otlp",
    "opentelemetry.sdk": "opentelemetry-sdk",
    "pandas": "pandas",
    "phoenix": "arize-phoenix",
    "sklearn": "scikit-learn",
}


def _python_cells() -> list[str]:
    text = TUTORIAL.read_text(encoding="utf-8")
    return re.findall(r"^```python[^\n]*\n(.*?)^```\s*$", text, flags=re.MULTILINE | re.DOTALL)


def _installed_distributions(cells: list[str]) -> set[str]:
    names: set[str] = set()
    for cell in cells:
        for line in cell.splitlines():
            if match := re.match(r"\s*!pip install (.*)", line):
                names.update(
                    canonicalize_name(Requirement(arg.strip("'\"")).name)
                    for arg in match.group(1).split()
                    if not arg.startswith("-")
                )
    if "arize-phoenix" in names:
        names.update(
            canonicalize_name(requirement.name)
            for requirement in map(Requirement, requires("arize-phoenix") or [])
            if requirement.marker is None
        )
    return names


def _imported_modules(cell: str) -> set[str]:
    source = "\n".join("" if line.lstrip().startswith("!") else line for line in cell.splitlines())
    tree = compile(source, "<cell>", "exec", ast.PyCF_ONLY_AST | ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            modules.add(node.module)
    return modules


def _distribution(module: str) -> str | None:
    for prefix, distribution in MODULE_DISTRIBUTIONS.items():
        if module == prefix or module.startswith(prefix + "."):
            return distribution
    return None


def test_install_line_covers_every_import() -> None:
    cells = _python_cells()
    installed = _installed_distributions(cells)
    assert installed, "the tutorial has no `!pip install` line in a python code block"
    problems = []
    for cell in cells:
        for module in sorted(_imported_modules(cell)):
            if module.split(".")[0] in sys.stdlib_module_names:
                continue
            distribution = _distribution(module)
            if distribution is None:
                problems.append(f"{module}: no known distribution provides it")
            elif canonicalize_name(distribution) not in installed:
                problems.append(f"{module}: {distribution} is not installed by the tutorial")
    assert not problems, problems
