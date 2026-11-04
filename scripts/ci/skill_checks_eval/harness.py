"""Runs the skill Python-example check the way CI does, with swappable packages and sources.

The functions here reuse ``test_skill_python_examples`` so the evaluation measures the real
check: the same fence parsing, fragment rules, pyright config and error filter. They add two
things the check doesn't need: pointing ``phoenix.*`` at a mutated copy of the packages, and
checking any set of sources in one pyright run.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import test_skill_python_examples as check  # noqa: E402

REPO_ROOT = check.REPO_ROOT
PACKAGES = check._CHECKED_PACKAGES
EXAMPLES = check.EXAMPLES
Diagnostic = dict[str, Any]


def package_source(package: str, root: Path = REPO_ROOT) -> Path:
    return root / "packages" / f"phoenix-{package}" / "src" / "phoenix" / package


def copy_packages(destination: Path) -> Path:
    """Copies the checked packages so a mutation never touches the checkout."""
    for package in PACKAGES:
        shutil.copytree(
            package_source(package),
            package_source(package, destination),
            ignore=shutil.ignore_patterns("__pycache__"),
        )
    return destination


def build_root(
    sources: Mapping[str, str],
    packages_root: Path = REPO_ROOT,
    config_overrides: Mapping[str, Any] | None = None,
) -> tuple[Path, dict[str, str]]:
    """Lays out a pyright project like the check's fixture; returns it and file -> source id."""
    root = Path(tempfile.mkdtemp(prefix="skill_checks_eval_"))
    shim = root / "phoenix"
    shim.mkdir()
    (shim / "__init__.py").touch()
    for package in PACKAGES:
        (shim / package).symlink_to(
            package_source(package, packages_root), target_is_directory=True
        )
    config = {**check._PYRIGHT_CONFIG, **(config_overrides or {})}
    (root / "pyrightconfig.json").write_text(json.dumps(config), encoding="utf-8")
    (root / "examples").mkdir()
    files: dict[str, str] = {}
    for number, (source_id, source) in enumerate(sources.items()):
        file = root / "examples" / f"example_{number}.py"
        file.write_text(source, encoding="utf-8")
        files[str(file.resolve())] = source_id
    return root, files


def run_pyright(root: Path) -> list[Diagnostic]:
    result = subprocess.run(
        [sys.executable, "-m", "pyright", "--outputjson", "--pythonpath", sys.executable],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    return list(json.loads(result.stdout)["generalDiagnostics"])


def errors_by_source(
    sources: Mapping[str, str],
    packages_root: Path = REPO_ROOT,
    config_overrides: Mapping[str, Any] | None = None,
    is_reported: Callable[[Diagnostic], bool] = check._is_reported,
) -> dict[str, list[str]]:
    """Type-checks every source in one run and returns the reported errors for each."""
    root, files = build_root(sources, packages_root, config_overrides)
    try:
        errors: dict[str, list[str]] = defaultdict(list)
        for diagnostic in run_pyright(root):
            if is_reported(diagnostic):
                line = diagnostic["range"]["start"]["line"]
                errors[files[str(Path(diagnostic["file"]).resolve())]].append(
                    f"{line}: {diagnostic['message']}"
                )
        return dict(errors)
    finally:
        shutil.rmtree(root, ignore_errors=True)


def checkable_sources() -> dict[str, str]:
    """Every skill example as the check sees it."""
    return {example.id: check.checkable_source(example)[0] for example in EXAMPLES}


def failing(errors: Mapping[str, list[str]]) -> set[str]:
    return {source_id for source_id, messages in errors.items() if messages}
