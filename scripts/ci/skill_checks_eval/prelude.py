"""A candidate fragment rule: give undefined Phoenix names their real types.

The check treats every name a fragment doesn't define as ``Unknown``, so a block that calls
``client.datasets.get_dataset(...)`` without constructing ``client`` is never checked. This
variant prepends a typed prelude for undefined names that the skills use for Phoenix objects:
the public exports of the client, evals and otel packages, plus a few conventional variable
names. Everything else stays ``Unknown``, as in the check.
"""

from __future__ import annotations

import ast
import importlib
import re
import types
from collections import defaultdict
from collections.abc import Mapping

from harness import Diagnostic, errors_by_source

# Public exports to import when a fragment uses them without importing them. A name that more
# than one module exports, such as ``create_evaluator``, is left out because it's ambiguous.
_EXPORTING_MODULES = (
    "phoenix.client",
    "phoenix.client.experiments",
    "phoenix.evals",
    "phoenix.otel",
)

# Resources on ``Client``. A block that uses ``client`` gets the Phoenix type only when it reads
# one of these, because some skills call an OpenAI client ``client`` too.
CLIENT_RESOURCES = frozenset(
    {"annotations", "datasets", "experiments", "projects", "prompts", "sessions", "spans", "traces"}
)
_CLIENT_NAMES = frozenset({"client", "async_client"})

# Conventional variable names in the skills and the Phoenix type each one holds.
VARIABLES = {
    "client": ("phoenix.client", "Client"),
    "px_client": ("phoenix.client", "Client"),
    "phoenix_client": ("phoenix.client", "Client"),
    "async_client": ("phoenix.client", "AsyncClient"),
    "dataset": ("phoenix.client.resources.datasets", "Dataset"),
    "experiment": ("phoenix.client.resources.experiments.types", "RanExperiment"),
    "tracer_provider": ("phoenix.otel", "TracerProvider"),
}


def _exports() -> dict[str, str]:
    owners: dict[str, list[str]] = defaultdict(list)
    for module_name in _EXPORTING_MODULES:
        module = importlib.import_module(module_name)
        for name in getattr(module, "__all__", []):
            # Submodules such as ``phoenix.evals.llm`` collide with prose names like ``llm``.
            if not isinstance(getattr(module, name, None), types.ModuleType):
                owners[name].append(module_name)
    return {name: modules[0] for name, modules in owners.items() if len(modules) == 1}


EXPORTS = _exports()


def undefined_names(sources: Mapping[str, str]) -> dict[str, set[str]]:
    """Returns the names each source uses but never defines, as pyright sees them."""
    found: dict[str, set[str]] = defaultdict(set)

    def is_undefined(diagnostic: Diagnostic) -> bool:
        return diagnostic.get("rule") == "reportUndefinedVariable"

    errors = errors_by_source(
        sources, config_overrides={"reportUndefinedVariable": "error"}, is_reported=is_undefined
    )
    for source_id, messages in errors.items():
        for message in messages:
            if match := re.search(r'"(.+?)" is not defined', message):
                found[source_id].add(match.group(1))
    return found


def _reads_client_resource(source: str) -> bool:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return False
    return any(
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id in _CLIENT_NAMES
        and node.attr in CLIENT_RESOURCES
        for node in ast.walk(tree)
    )


_COMMENT_ELLIPSIS = re.compile(r"^(\s*)#\s*\.\.\.\s*$", re.MULTILINE)


def _elide_comment_ellipses(source: str) -> str:
    """Treats a ``# ...`` line inside a call like the check treats a ``...`` line."""
    replaced = _COMMENT_ELLIPSIS.sub(r"\1**{},", source)
    try:
        ast.parse(replaced)
    except SyntaxError:
        return source
    return replaced


def prelude(names: set[str]) -> str:
    lines = ["from typing import cast as _cast"]
    for name in sorted(names):
        if name in EXPORTS:
            lines.append(f"from {EXPORTS[name]} import {name}")
        elif name in VARIABLES:
            module, type_name = VARIABLES[name]
            lines.append(f"from {module} import {type_name} as _{name}_type")
            lines.append(f"{name} = _cast(_{name}_type, None)")
    return "\n".join(lines) + "\n"


def with_preludes(sources: Mapping[str, str]) -> dict[str, str]:
    """Prepends each source's prelude; sources that need none are unchanged."""
    undefined = undefined_names(sources)
    result = {}
    for source_id, source in sources.items():
        source = _elide_comment_ellipses(source)
        names = {
            name for name in undefined.get(source_id, set()) if name in EXPORTS or name in VARIABLES
        }
        if not _reads_client_resource(source):
            names -= _CLIENT_NAMES
        if not names:
            result[source_id] = source
            continue
        # A `from __future__` import must stay first.
        future = re.findall(r"^from __future__ import .*\n", source, re.MULTILINE)
        body = re.sub(r"^from __future__ import .*\n", "\n", source, flags=re.MULTILINE)
        result[source_id] = "".join(future) + prelude(names) + body
    return result
