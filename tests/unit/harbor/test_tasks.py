import json
import os
from pathlib import Path
from typing import Any

import pytest

TASKS_DIR = Path(__file__).resolve().parents[3] / "evals" / "harbor" / "tasks"
# Benchmark datasets of single-reply tasks, with the task name prefix and fixture each uses.
DATASETS = {
    "trail-benchmark-dev": ("arize/trail-benchmark-", "trail"),
    # Harbor requires task names in org/name form, so the bare slug carries a phoenix/ prefix.
    "api-selection-dev": ("phoenix/", "sql-benchmark"),
    "api-selection-test": ("phoenix/", "sql-benchmark"),
}
# The api-selection tasks carry the Phoenix domain they ask about and the API they expect.
API_SELECTION = {"api-selection-dev", "api-selection-test"}
DOMAINS = {
    "annotations",
    "datasets",
    "evaluators",
    "experiments",
    "llm-usage",
    "projects",
    "prompts",
    "sessions",
    "settings",
    "tools",
    "traces",
}
TASKS = sorted(
    path
    for dataset in DATASETS
    for path in (TASKS_DIR / dataset).iterdir()
    if (path / "task.toml").is_file()
)
REFERENCE = TASKS[0]


def _reference_test_script(task: Path) -> bytes:
    """A dataset grades with its own verifier module, so test.sh is shared per dataset."""
    first = min(path for path in TASKS if path.parent == task.parent)
    return (first / "tests" / "test.sh").read_bytes()


def _expected(task: Path) -> dict[str, Any]:
    spec: dict[str, Any] = json.loads((task / "tests" / "expected.json").read_text())
    return spec


def _task_config(task: Path) -> tuple[str, str, str]:
    """The task.toml split into its header, its [task] block, and the shared remainder
    with the fixture name and domain blanked so tasks from different datasets compare equal."""
    header, metadata, shared = (task / "task.toml").read_text().split("\n\n", 2)
    _, fixture = DATASETS[task.parent.name]
    shared = shared.replace(f'fixture = "{fixture}"', 'fixture = ""')
    shared = shared.replace(
        f'reference_output_path = "{_reference_file(task)}"', 'reference_output_path = ""'
    )
    if task.parent.name in API_SELECTION:
        domain = _domain(task)
        shared = shared.replace(f'fixture = ""\ndomain = "{domain}"\n', 'fixture = ""\n')
        shared = shared.replace('fixture = ""\nverifiers = "api-selection-dev"\n', 'fixture = ""\n')
    return header, metadata, shared


def _reference_file(task: Path) -> str:
    """The file the Phoenix example output comes from: the bare reference for the
    api-selection tasks, the whole expected.json for the TRAIL tasks."""
    return "tests/reference.json" if task.parent.name in API_SELECTION else "tests/expected.json"


def _domain(task: Path) -> str:
    lines = (task / "task.toml").read_text().splitlines()
    domains = [
        line.removeprefix("domain = ").strip('"') for line in lines if line.startswith("domain = ")
    ]
    assert len(domains) == 1, "api-selection tasks name exactly one domain"
    return domains[0]


@pytest.mark.parametrize("task", TASKS, ids=lambda path: f"{path.parent.name}/{path.name}")
def test_task_layout_matches_the_shared_files(task: Path) -> None:
    assert (task / ".gitignore").read_bytes() == (REFERENCE / ".gitignore").read_bytes()
    assert (task / "tests" / "test.sh").read_bytes() == _reference_test_script(task)
    header, metadata, shared = _task_config(task)
    reference_header, _, reference_shared = _task_config(REFERENCE)
    assert (header, shared) == (reference_header, reference_shared), "task.toml"
    assert metadata.startswith("[task]\n")
    prefix, fixture = DATASETS[task.parent.name]
    assert f'name = "{prefix}{task.name}"' in metadata
    assert "keywords" not in metadata
    assert f'fixture = "{fixture}"' in (task / "task.toml").read_text()
    assert (
        f'[metadata.arize-phoenix]\nreference_output_path = "{_reference_file(task)}"'
        in (task / "task.toml").read_text()
    )
    assert 'user = "agent"' in shared
    if task.parent.name in API_SELECTION:
        assert _domain(task) in DOMAINS
        assert b"api_selection_verifiers.verify" in (task / "tests" / "test.sh").read_bytes()
    if task.parent.name == "api-selection-test":
        assert 'verifiers = "api-selection-dev"' in (task / "task.toml").read_text(), (
            "the test split grades with the dev split's verifier package"
        )
    for name in ("tests/test.sh", "solution/solve.sh"):
        assert os.access(task / name, os.X_OK), f"{name} is not executable"
    assert "environment/" in (task / ".gitignore").read_text().splitlines(), (
        "the staged environment/ must stay out of git and out of the task digest"
    )
    for path in (task / "environment").rglob("*") if (task / "environment").exists() else []:
        assert not path.is_symlink(), f"{path} is a symlink; Docker cannot build from one"
    instruction = (task / "instruction.md").read_text()
    assert "answer.txt" not in instruction, "the reply is graded, not an answer file"
    assert instruction.endswith("\n") and not instruction.endswith("\n\n")


@pytest.mark.parametrize("task", TASKS, ids=lambda path: f"{path.parent.name}/{path.name}")
def test_expected_answer_is_well_formed(task: Path) -> None:
    spec = _expected(task)
    assert spec["source"], "say how the reference value was derived"
    kinds = [key for key in ("exact", "reference") if key in spec]
    assert len(kinds) == 1, "expected.json needs exactly one of 'exact' or 'reference'"
    assert isinstance(spec[kinds[0]], str) and spec[kinds[0]].strip()
    assert set(spec) <= {"exact", "reference", "notes", "expected_api", "source"}, "unknown keys"
    if task.parent.name in API_SELECTION:
        assert spec.get("expected_api") in {"sql", "http"}, "name the API the question expects"
        reference = json.loads((task / "tests" / "reference.json").read_text())
        assert reference == spec["reference"], "reference.json is the bare reference Phoenix shows"
    else:
        assert "expected_api" not in spec


def test_api_selection_slugs_are_unique_across_splits() -> None:
    slugs = [task.name for task in TASKS if task.parent.name in API_SELECTION]
    assert len(slugs) == len(set(slugs)), "a slug may appear in only one split"
