"""Tests for SkillsCapability."""

from __future__ import annotations

from pathlib import Path

import pytest

from phoenix.server.agents.capabilities.skills import SkillsCapability, SkillsToolset


def test_skills_capability_get_toolset() -> None:
    """SkillsCapability should expose a SkillsToolset."""
    capability = SkillsCapability(skills=[], directories=[])
    toolset = capability.get_toolset()

    assert isinstance(toolset, SkillsToolset)
    assert capability.toolset is toolset


def test_skills_capability_init_with_minimal_params() -> None:
    """Constructor should work with only skills parameter."""
    capability = SkillsCapability(skills=[])
    assert isinstance(capability.get_toolset(), SkillsToolset)


def test_skills_capability_init_with_directories() -> None:
    """Constructor should accept directories parameter."""
    capability = SkillsCapability(directories=["./skills"])
    assert isinstance(capability.get_toolset(), SkillsToolset)


def test_skills_capability_init_with_all_params(tmp_path: Path) -> None:
    """Constructor should accept all parameters."""
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()

    capability = SkillsCapability(
        skills=[],
        directories=[skills_dir],
        validate=False,
        max_depth=5,
        id="test-toolset",
        instruction_template="Available skills: {skills_list}",
        exclude_tools={"run_skill_script"},
        auto_reload=True,
    )
    assert isinstance(capability.get_toolset(), SkillsToolset)
    toolset = capability.toolset
    assert toolset.id == "test-toolset"


def test_skills_capability_toolset_property_is_same_as_get_toolset() -> None:
    """Toolset property should be the same instance as get_toolset()."""
    capability = SkillsCapability(skills=[])
    toolset_property = capability.toolset
    get_toolset_result = capability.get_toolset()
    assert toolset_property is get_toolset_result


def test_skills_capability_with_exclude_tools_as_list() -> None:
    """Constructor should accept exclude_tools as a list."""
    capability = SkillsCapability(
        skills=[],
        exclude_tools=["load_skill", "run_skill_script"],
    )
    assert isinstance(capability.get_toolset(), SkillsToolset)


def test_skills_capability_init_with_custom_template() -> None:
    """Constructor should accept custom instruction template."""
    template = "Use these skills: {skills_list}"
    capability = SkillsCapability(
        skills=[],
        instruction_template=template,
    )
    assert isinstance(capability.get_toolset(), SkillsToolset)


@pytest.mark.asyncio
async def test_skills_capability_get_instructions_returns_none() -> None:
    """get_instructions returns None — agent extracts instructions natively from the toolset."""
    capability = SkillsCapability(skills=[])
    assert capability.get_instructions() is None
