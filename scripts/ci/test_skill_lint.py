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


def test_clean_skill_has_no_warnings(
    sync_skills: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sync_skills, "REPO_ROOT", tmp_path)
    body = "See [present](references/present.md#top) and `references/present.md`.\n"
    skill = _skill(sync_skills, tmp_path, "Does one thing.", body)
    assert sync_skills.lint([skill]) == []


def test_lint_flags_each_rule(
    sync_skills: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sync_skills, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(sync_skills, "MAX_DESCRIPTION_BYTES_PER_TARGET", 10)
    body = "line\n" * 501 + "[gone](references/gone.md) and `references/also-gone.md`\n"
    skill = _skill(sync_skills, tmp_path, "x" * 1025, body)
    warnings = sync_skills.lint([skill])
    assert any("description is 1025 characters" in warning for warning in warnings)
    assert any("body is 502 lines" in warning for warning in warnings)
    assert any("link to missing file references/gone.md" in warning for warning in warnings)
    assert any("mentions missing file references/also-gone.md" in warning for warning in warnings)
    assert any("target 'agents' total 1025 bytes" in warning for warning in warnings)
    assert any("target 'mcp' total 1025 bytes" in warning for warning in warnings)
