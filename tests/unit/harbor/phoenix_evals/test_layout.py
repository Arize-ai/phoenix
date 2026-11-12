"""Layout rules for the `phoenix-evals` Harbor tasks."""

from __future__ import annotations

import json
import os
import tomllib
from pathlib import Path

import pytest

TASKS_DIR = Path(__file__).resolve().parents[4] / "evals" / "harbor" / "tasks" / "phoenix-evals"
TASKS = sorted(path for path in TASKS_DIR.iterdir() if (path / "task.toml").exists())


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_layout(task: Path) -> None:
    config = tomllib.loads((task / "task.toml").read_text())
    assert config["task"]["name"] == f"arize/phoenix-evals-{task.name}"
    assert config["metadata"]["fixture"] == "spec"
    assert config["agent"]["user"] == "agent"
    assert "environment/" in (task / ".gitignore").read_text().splitlines()
    for name in ("tests/test.sh", "solution/solve.sh"):
        assert os.access(task / name, os.X_OK), f"{name} is not executable"
    json.loads((task / "fixture" / "spec.json").read_text())
    instruction = (task / "instruction.md").read_text()
    assert instruction.endswith("\n") and not instruction.endswith("\n\n")
    assert "answer.txt" not in instruction, "the reply is graded, not an answer file"


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_page_quotes_the_instruction(task: Path) -> None:
    """Task.md is the reviewer's single page, so it must show the exact request."""
    page = (task / "Task.md").read_text()
    for paragraph in (task / "instruction.md").read_text().strip().split("\n\n"):
        quoted = "\n".join(f"> {line}" for line in paragraph.splitlines())
        assert quoted in page, f"Task.md doesn't quote this paragraph verbatim:\n{paragraph}"


def test_suite_readme_links_every_task() -> None:
    readme = (TASKS_DIR / "README.md").read_text()
    for task in TASKS:
        assert f"({task.name}/Task.md)" in readme, task.name
