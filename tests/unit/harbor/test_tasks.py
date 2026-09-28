import ast
import importlib.util
import json
import os
import re
import tomllib
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

TASKS_DIR = Path(__file__).resolve().parents[3] / "evals" / "harbor" / "tasks"
TASKS = sorted(path for path in (TASKS_DIR / "trail-benchmark-dev").iterdir() if path.is_dir())
REFERENCE = TASKS[0]
SHARED_TEST_FILES = ("tests/test.sh", "tests/reply.py", "tests/grading_prompt.md")
REPLY_PATH = "/logs/verifier/reply.txt"

TRAJECTORY = {
    "schema_version": "ATIF-v1.7",
    "steps": [
        {"source": "user", "message": "question"},
        {"source": "agent", "tool_calls": [{"tool_call_id": "a"}]},
        {"source": "agent", "is_copied_context": True, "message": "stale"},
        {"source": "system", "message": "compaction"},
        {"source": "agent", "message": "There are **117** traces."},
    ],
}


def _task_config(task: Path) -> tuple[str, str, str]:
    header, metadata, shared = (task / "task.toml").read_text().split("\n\n", 2)
    return header, metadata, shared


def _load_module(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def reply() -> ModuleType:
    return _load_module(REFERENCE / "tests" / "reply.py")


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_layout_matches_the_shared_files(task: Path) -> None:
    for name in (".gitignore", *SHARED_TEST_FILES):
        if (task / name).exists():
            assert (task / name).read_bytes() == (REFERENCE / name).read_bytes(), name
    header, metadata, shared = _task_config(task)
    reference_header, _, reference_shared = _task_config(REFERENCE)
    assert (header, shared) == (reference_header, reference_shared), "task.toml"
    assert metadata.startswith("[task]\n")
    assert f'name = "arize/trail-benchmark-{task.name}"' in metadata
    assert "keywords" not in metadata
    assert 'fixture = "trail"' in shared
    assert 'user = "agent"' in shared
    for name in ("tests/test.sh", "solution/solve.sh"):
        assert os.access(task / name, os.X_OK), f"{name} is not executable"
    assert "environment/" in (task / ".gitignore").read_text().splitlines(), (
        "environment/ must be ignored so staging does not change the task digest"
    )
    for path in (task / "environment").rglob("*") if (task / "environment").exists() else []:
        assert not path.is_symlink(), f"{path} is a symlink; Docker cannot build from one"
    instruction = (task / "instruction.md").read_text()
    assert "answer.txt" not in instruction, "the reply is graded, not an answer file"
    assert instruction.endswith("\n") and not instruction.endswith("\n\n")


@pytest.mark.parametrize("task", TASKS, ids=lambda path: path.name)
def test_task_grades_the_reply_with_one_criteria_file(task: Path) -> None:
    tests = task / "tests"
    criteria = sorted(path.name for path in tests.iterdir() if path.suffix in (".toml", ".py"))
    criteria.remove("reply.py")
    assert criteria in (["judge.toml"], ["check.py"]), criteria
    if criteria == ["check.py"]:
        assert not (tests / "grading_prompt.md").exists()
        assert REPLY_PATH in (tests / "check.py").read_text()
        return
    spec = tomllib.loads((tests / "judge.toml").read_text())
    assert spec["judge"]["files"] == [REPLY_PATH]
    assert spec["judge"]["prompt_template"] == "grading_prompt.md"
    assert "{criteria}" in (tests / "grading_prompt.md").read_text()
    (criterion,) = spec["criterion"]
    assert criterion["name"] == "matches_reference"
    assert criterion["type"] == "binary"
    assert criterion["description"].startswith(
        "The reply's conclusion matches the reference answer: "
    )
    assert criterion["annotations"]["source"], "say how the reference value was derived"


def test_final_reply_is_the_last_agent_message(reply: ModuleType) -> None:
    assert reply.final_reply(TRAJECTORY) == "There are **117** traces."
    parts = {"steps": [{"source": "agent", "message": [{"type": "text", "text": "ok"}]}]}
    assert reply.final_reply(parts) == "ok"
    assert reply.final_reply({"steps": [{"source": "agent", "message": "  "}]}) == ""


def test_reply_comes_from_the_trajectory_then_the_answer_file(
    reply: ModuleType, tmp_path: Path
) -> None:
    trajectory = tmp_path / "trajectory.json"
    answer = tmp_path / "answer.txt"
    answer.write_text("oracle\n")
    assert reply.read_reply(trajectory, answer) == ("oracle\n", answer)
    trajectory.write_text(json.dumps(TRAJECTORY))
    assert reply.read_reply(trajectory, answer) == ("There are **117** traces.", trajectory)
    trajectory.write_text(json.dumps(["not a trajectory"]))
    assert reply.read_reply(trajectory, answer) == ("oracle\n", answer)
    assert reply.read_reply(tmp_path / "none", tmp_path / "none") == ("", None)


def _exact_reply_pattern() -> str:
    tree = ast.parse(
        (TASKS_DIR / "trail-benchmark-dev/noop-surface-cost/tests/check.py").read_text()
    )
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "file_contains_regex"
    ]
    (call,) = calls
    pattern: Any = ast.literal_eval(call.args[1])
    assert isinstance(pattern, str)
    return pattern


@pytest.mark.parametrize(
    "text,matches",
    [
        ("ok", True),
        ("**OK**.\n", True),
        ("`ok`!", True),
        ("okay", False),
        ("ok, done", False),
        ("", False),
    ],
)
def test_exact_reply_pattern_ignores_emphasis_case_and_end_punctuation(
    text: str, matches: bool
) -> None:
    assert (re.search(_exact_reply_pattern(), text) is not None) is matches
