"""The warn-only skill lint in ``scripts/sync_skills.py`` flags what it should."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest
from skill_examples import REPO_ROOT


@pytest.fixture(scope="module")
def sync_skills() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "sync_skills", REPO_ROOT / "scripts" / "sync_skills.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    # Dataclasses look their module up in sys.modules.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _skill(sync_skills: ModuleType, root: Path, description: str, body: str) -> object:
    directory = root / "example-skill"
    (directory / "references").mkdir(parents=True)
    (directory / "references" / "present.md").write_text("Present.\n", encoding="utf-8")
    (directory / "SKILL.md").write_text(
        f"---\nname: example-skill\ndescription: {description}\n---\n{body}", encoding="utf-8"
    )
    return sync_skills.Skill(
        name="example-skill", path=directory, targets=frozenset({"agents", "mcp"})
    )


def _add_cases(sync_skills: ModuleType, root: Path, task_skill: str) -> None:
    routing_root = root / "evals" / "skills"
    tasks_root = root / "evals" / "harbor" / "tasks" / "skills"
    (routing_root / "example-skill").mkdir(parents=True)
    (routing_root / "example-skill" / "routing.yaml").write_text("cases: []\n", encoding="utf-8")
    task_dir = tasks_root / "example-skill" / "smoke"
    task_dir.mkdir(parents=True)
    (task_dir / "task.toml").write_text(
        f'version = "1.0"\n\n[metadata]\nskill = "{task_skill}"\nkind = "smoke"\n\n'
        '[verifier]\nskill = "not-this-one"\n',
        encoding="utf-8",
    )
    sync_skills.ROUTING_ROOT = routing_root
    sync_skills.HARBOR_SKILL_TASKS_ROOT = tasks_root


def test_clean_skill_has_no_warnings(
    sync_skills: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sync_skills, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(sync_skills, "ROUTING_ROOT", sync_skills.ROUTING_ROOT)
    monkeypatch.setattr(sync_skills, "HARBOR_SKILL_TASKS_ROOT", sync_skills.HARBOR_SKILL_TASKS_ROOT)
    _add_cases(sync_skills, tmp_path, "example-skill")
    body = "See [present](references/present.md#top) and `references/present.md`.\n"
    skill = _skill(sync_skills, tmp_path, "Does one thing.", body)
    assert sync_skills.lint([skill]) == []


def test_lint_flags_each_rule(
    sync_skills: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sync_skills, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(sync_skills, "MAX_DESCRIPTION_BYTES_PER_TARGET", 10)
    monkeypatch.setattr(sync_skills, "ROUTING_ROOT", tmp_path / "evals" / "skills")
    monkeypatch.setattr(
        sync_skills, "HARBOR_SKILL_TASKS_ROOT", tmp_path / "evals" / "harbor" / "tasks" / "skills"
    )
    body = "line\n" * 501 + "[gone](references/gone.md) and `references/also-gone.md`\n"
    skill = _skill(sync_skills, tmp_path, "x" * 1025, body)
    warnings = sync_skills.lint([skill])
    assert any("description is 1025 characters" in warning for warning in warnings)
    assert any("body is 502 lines" in warning for warning in warnings)
    assert any("link to missing file references/gone.md" in warning for warning in warnings)
    assert any("mentions missing file references/also-gone.md" in warning for warning in warnings)
    assert any("target 'agents' total 1025 bytes" in warning for warning in warnings)
    assert any("target 'mcp' total 1025 bytes" in warning for warning in warnings)
    assert any("no routing file at evals/skills/example-skill" in warning for warning in warnings)
    assert any("no Harbor task under" in warning for warning in warnings)


def test_task_for_another_skill_does_not_count(
    sync_skills: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sync_skills, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(sync_skills, "ROUTING_ROOT", sync_skills.ROUTING_ROOT)
    monkeypatch.setattr(sync_skills, "HARBOR_SKILL_TASKS_ROOT", sync_skills.HARBOR_SKILL_TASKS_ROOT)
    _add_cases(sync_skills, tmp_path, "phoenix-evals")
    skill = _skill(sync_skills, tmp_path, "Does one thing.", "Body.\n")
    warnings = sync_skills.lint([skill])
    assert [warning.split(": ", 1)[1].split(" ", 3)[:3] for warning in warnings] == [
        ["no", "Harbor", "task"]
    ]
