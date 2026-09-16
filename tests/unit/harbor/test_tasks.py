"""Every tool benchmark task keeps the shared layout and grades its own example answers."""

import json
import os
from pathlib import Path
from typing import Any

import pytest

from evals.harbor.lib import grade

TASKS_DIR = Path(__file__).resolve().parents[3] / "evals" / "harbor" / "tasks"
SPLITS = ("phoenix-tools-dev", "phoenix-tools-test")
TASKS = sorted(path for split in SPLITS for path in (TASKS_DIR / split).iterdir() if path.is_dir())
REFERENCE = TASKS[0]


def _expected(task: Path) -> dict[str, Any]:
    spec: dict[str, Any] = json.loads((task / "tests" / "expected.json").read_text())
    return spec


def _task_config(task: Path) -> tuple[str, str, str]:
    """The header, the ``[task]`` table, and everything after it."""
    header, metadata, shared = (task / "task.toml").read_text().split("\n\n", 2)
    return header, metadata, shared


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_layout_matches_the_shared_files(task: Path) -> None:
    for name in (".gitignore", "tests/test.sh"):
        assert (task / name).read_bytes() == (REFERENCE / name).read_bytes(), name
    header, metadata, shared = _task_config(task)
    reference_header, _, reference_shared = _task_config(REFERENCE)
    assert (header, shared) == (reference_header, reference_shared), "task.toml"
    assert metadata.startswith("[task]\n")
    assert f'name = "arize/phoenix-tools-{task.name}"' in metadata
    for name in ("tests/test.sh", "solution/solve.sh"):
        assert os.access(task / name, os.X_OK), f"{name} is not executable"
    # environment/ is staged from evals/harbor/environment and never committed: the
    # task-level .gitignore keeps it out of git and out of the task digest.
    assert "environment/" in (task / ".gitignore").read_text().splitlines()
    for path in (task / "environment").rglob("*") if (task / "environment").exists() else []:
        assert not path.is_symlink(), f"{path} is a symlink; Docker cannot build from one"
    instruction = (task / "instruction.md").read_text()
    assert "answer.txt" not in instruction, "the reply is graded, not an answer file"
    assert instruction.endswith("\n") and not instruction.endswith("\n\n")


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_expected_examples_grade_as_labelled(task: Path) -> None:
    spec = _expected(task)
    assert spec["source"] and spec["accept"] and spec["reject"]
    wrongly_rejected = [text for text in spec["accept"] if not grade.grade_answer(text, spec)]
    wrongly_accepted = [text for text in spec["reject"] if grade.grade_answer(text, spec)]
    assert not wrongly_rejected, f"rejected: {wrongly_rejected}"
    assert not wrongly_accepted, f"accepted: {wrongly_accepted}"
