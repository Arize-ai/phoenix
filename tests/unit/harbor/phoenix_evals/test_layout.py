"""Layout rules for the `phoenix-evals` Harbor tasks."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path

import pytest

from .fakes import TASKS_DIR

TASKS = sorted(path for path in TASKS_DIR.iterdir() if path.is_dir())
FIXTURES = {"prompt-hill-climb", "error-analysis", "trail"}


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_layout(task: Path) -> None:
    config = tomllib.loads((task / "task.toml").read_text())
    assert config["task"]["name"] == f"arize/phoenix-evals-{task.name}"
    assert config["metadata"]["fixture"] in FIXTURES
    assert config["agent"]["user"] == "agent"
    assert "environment/" in (task / ".gitignore").read_text().splitlines()
    for name in ("tests/test.sh", "solution/solve.sh"):
        assert os.access(task / name, os.X_OK), f"{name} is not executable"
    instruction = (task / "instruction.md").read_text()
    assert instruction.endswith("\n") and not instruction.endswith("\n\n")
    assert "answer.txt" not in instruction, "the reply is graded, not an answer file"


def test_verifier_modules_have_unique_names() -> None:
    names = [path.name for task in TASKS for path in (task / "tests").glob("*.py")]
    names += [path.name for task in TASKS for path in (task / "solution").glob("*.py")]
    assert len(names) == len(set(names)), "mypy needs unique module names"
