"""Every benchmark task keeps the shared layout and grades its own example answers."""

import json
import os
from pathlib import Path
from typing import Any

import pytest

from evals.harbor.lib import grade

TASKS_DIR = Path(__file__).resolve().parents[3] / "evals" / "harbor" / "tasks"
SHARED_COMPOSE = TASKS_DIR.parent / "environment" / "docker-compose.yaml"
TASKS = sorted(
    path for split in ("dev", "test") for path in (TASKS_DIR / split).iterdir() if path.is_dir()
)
REFERENCE = TASKS[0]


def _expected(task: Path) -> dict[str, Any]:
    spec: dict[str, Any] = json.loads((task / "tests" / "expected.json").read_text())
    return spec


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_layout_matches_the_shared_files(task: Path) -> None:
    for name in ("task.toml", "tests/test.sh"):
        assert (task / name).read_bytes() == (REFERENCE / name).read_bytes(), name
    for name in ("tests/test.sh", "solution/solve.sh"):
        assert os.access(task / name, os.X_OK), f"{name} is not executable"
    compose = task / "environment" / "docker-compose.yaml"
    assert compose.is_symlink() and compose.resolve() == SHARED_COMPOSE
    assert (task / "instruction.md").read_text().rstrip().endswith("/workspace/answer.txt.")


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_expected_examples_grade_as_labelled(task: Path) -> None:
    spec = _expected(task)
    assert spec["source"] and spec["accept"] and spec["reject"]
    wrongly_rejected = [text for text in spec["accept"] if not grade.grade_answer(text, spec)]
    wrongly_accepted = [text for text in spec["reject"] if grade.grade_answer(text, spec)]
    assert not wrongly_rejected, f"rejected: {wrongly_rejected}"
    assert not wrongly_accepted, f"accepted: {wrongly_accepted}"
