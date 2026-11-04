"""Coverage: what share of the Phoenix calls in skill examples does the check actually check?

A call site counts as a Phoenix call when it calls a name that the client, evals or otel
packages define and that isn't a generic name such as ``get`` or ``create``. Each call site gets
two mutants, and a mutant the check flags means the check sees that part of the call:

- Name: the called name gets a suffix. For ``register(...)`` the import is renamed too, as a
  library rename would.
- Arguments: the call gets an extra ``drift_kwarg__=0`` keyword. Pyright flags it only when it
  knows the signature and the signature has no ``**kwargs``.

Usage: ``uv run python scripts/ci/skill_checks_eval/coverage.py``
"""

from __future__ import annotations

import ast
import re
import tempfile
from collections import Counter
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from drift import type_evals
from harness import (
    PACKAGES,
    REPO_ROOT,
    checkable_sources,
    copy_packages,
    errors_by_source,
    package_source,
)
from prelude import with_preludes

_GENERIC = frozenset(
    {"get", "create", "list", "delete", "update", "add", "run", "invoke", "query", "search"}
    | set(dir(str))
    | set(dir(dict))
    | set(dir(list))
    | set(dir(pd.DataFrame))
    | set(dir(pd.Series))
)


def phoenix_names() -> frozenset[str]:
    """Public function, method and class names that the checked packages define."""
    names = set()
    for package in PACKAGES:
        for path in package_source(package).rglob("*.py"):
            if "__generated__" in path.parts:
                continue
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    if not node.name.startswith("_"):
                        names.add(node.name)
    return frozenset(names - _GENERIC)


PHOENIX_NAMES = phoenix_names()


@dataclass(frozen=True)
class CallSite:
    source_id: str
    name: str
    callee: str  # "attribute" or "name"
    line: int  # 1-based, in the source the variant checks
    name_col: int
    end_line: int
    end_col: int  # just past the closing parenthesis


def call_sites(source_id: str, source: str) -> Iterator[CallSite]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or node.end_lineno is None:
            continue
        if isinstance(node.func, ast.Attribute):
            name, callee = node.func.attr, "attribute"
            name_line = node.func.end_lineno or node.func.lineno
            name_col = (node.func.end_col_offset or 0) - len(name)
        elif isinstance(node.func, ast.Name):
            name, callee = node.func.id, "name"
            name_line, name_col = node.func.lineno, node.func.col_offset
        else:
            continue
        if name in PHOENIX_NAMES:
            yield CallSite(
                source_id,
                name,
                callee,
                name_line,
                name_col,
                node.end_lineno,
                node.end_col_offset or 0,
            )


def _replace_at(source: str, line: int, col: int, length: int, text: str) -> str:
    lines = source.split("\n")
    target = lines[line - 1]
    lines[line - 1] = target[:col] + text + target[col + length :]
    return "\n".join(lines)


def rename_mutant(source: str, site: CallSite) -> str:
    if site.callee == "name":
        return re.sub(rf"\b{site.name}\b", f"{site.name}__drift", source)
    return _replace_at(source, site.line, site.name_col, len(site.name), f"{site.name}__drift")


def keyword_mutant(source: str, site: CallSite) -> str:
    lines = source.split("\n")
    before = "\n".join(lines[: site.end_line - 1] + [lines[site.end_line - 1][: site.end_col - 1]])
    separator = "" if before.rstrip().endswith(("(", ",")) else ", "
    return _replace_at(source, site.end_line, site.end_col - 1, 0, f"{separator}drift_kwarg__=0")


def measure(sources: Mapping[str, str], packages_root: Path) -> dict[str, Counter[str]]:
    sites = [
        site for source_id, source in sources.items() for site in call_sites(source_id, source)
    ]
    mutants: dict[str, str] = {}
    for number, site in enumerate(sites):
        source = sources[site.source_id]
        mutants[f"{number}:name"] = rename_mutant(source, site)
        mutants[f"{number}:args"] = keyword_mutant(source, site)
    baseline = errors_by_source(sources, packages_root)
    errors = errors_by_source(mutants, packages_root)
    counts: dict[str, Counter[str]] = {"name": Counter(), "args": Counter()}
    for number, site in enumerate(sites):
        for kind in ("name", "args"):
            new = set(errors.get(f"{number}:{kind}", [])) - set(baseline.get(site.source_id, []))
            counts[kind]["checked" if new else "unchecked"] += 1
            counts[kind][f"{'checked' if new else 'unchecked'}:{site.name}"] += 1
    counts["sites"] = Counter({"total": len(sites)})
    return counts


def main() -> None:
    sources = checkable_sources()
    preluded = with_preludes(sources)
    with tempfile.TemporaryDirectory() as directory:
        typed = type_evals_copy(Path(directory))
        for label, variant, packages_root in (
            ("check", sources, REPO_ROOT),
            ("+typed-evals", sources, typed),
            ("+prelude", preluded, REPO_ROOT),
            ("+both", preluded, typed),
        ):
            counts = measure(variant, packages_root)
            total = counts["sites"]["total"]
            print(f"{label}: {total} Phoenix call sites")
            for kind in ("name", "args"):
                checked = counts[kind]["checked"]
                print(f"  {kind:5} checked {checked}/{total} = {checked / total:.0%}")
            unchecked = Counter(
                {
                    k.split(":", 1)[1]: v
                    for k, v in counts["args"].items()
                    if k.startswith("unchecked:")
                }
            )
            print(f"  arguments unchecked, by callee: {unchecked.most_common(10)}")


def type_evals_copy(directory: Path) -> Path:
    packages_root = copy_packages(directory)
    type_evals(packages_root)
    return packages_root


if __name__ == "__main__":
    main()
