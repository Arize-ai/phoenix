"""Tests for SkillsToolset."""

from pathlib import Path
from unittest.mock import Mock

import pytest

from phoenix.server.agents.capabilities.skills import Skill, SkillsToolset
from phoenix.server.agents.capabilities.skills.local import create_file_based_resource


@pytest.fixture
def sample_skills(tmp_path: Path) -> list[Skill]:
    """Build two sample skills, including resources for skill-two."""
    skill1_dir = tmp_path / "skill-one"
    skill1_dir.mkdir()
    (skill1_dir / "SKILL.md").write_text("""---
name: skill-one
description: First test skill for basic operations
---

# Skill One

Use this skill for basic operations.

## Instructions

1. Do something simple
2. Return results
""")

    skill2_dir = tmp_path / "skill-two"
    skill2_dir.mkdir()
    (skill2_dir / "SKILL.md").write_text("""---
name: skill-two
description: Second test skill with resources
---

# Skill Two

Advanced skill with resources.

See FORMS.md for details.
""")
    forms_file = skill2_dir / "FORMS.md"
    forms_file.write_text("# Forms\n\nForm filling guide.")
    reference_file = skill2_dir / "REFERENCE.md"
    reference_file.write_text("# API Reference\n\nDetailed reference.")

    return [
        Skill.from_file(skill1_dir / "SKILL.md"),
        Skill.from_file(
            skill2_dir / "SKILL.md",
            resources=[
                create_file_based_resource(name="FORMS.md", uri=str(forms_file)),
                create_file_based_resource(name="REFERENCE.md", uri=str(reference_file)),
            ],
        ),
    ]


def test_toolset_initialization(sample_skills: list[Skill]) -> None:
    """Test SkillsToolset initialization."""
    toolset = SkillsToolset(skills=sample_skills)

    assert len(toolset.skills) == 2
    assert "skill-one" in toolset.skills
    assert "skill-two" in toolset.skills


def test_toolset_get_skill(sample_skills: list[Skill]) -> None:
    """Test getting a specific skill."""
    toolset = SkillsToolset(skills=sample_skills)

    skill = toolset.get_skill("skill-one")
    assert skill.name == "skill-one"
    assert skill.description == "First test skill for basic operations"


def test_toolset_get_skill_not_found(sample_skills: list[Skill]) -> None:
    """Test getting a non-existent skill."""
    toolset = SkillsToolset(skills=sample_skills)

    with pytest.raises(KeyError, match="Skill 'nonexistent' not found"):
        toolset.get_skill("nonexistent")


@pytest.mark.asyncio
async def test_list_skills_tool(sample_skills: list[Skill]) -> None:
    """Test the list_skills tool by checking skills were loaded."""
    toolset = SkillsToolset(skills=sample_skills)

    # Verify both skills were discovered
    assert len(toolset.skills) == 2
    assert "skill-one" in toolset.skills
    assert "skill-two" in toolset.skills

    # Verify descriptions
    assert toolset.skills["skill-one"].description == "First test skill for basic operations"
    assert toolset.skills["skill-two"].description == "Second test skill with resources"


@pytest.mark.asyncio
async def test_load_skill_tool(sample_skills: list[Skill]) -> None:
    """Test the load_skill tool."""
    toolset = SkillsToolset(skills=sample_skills)

    # The tools are internal, so we test via the public methods
    # We can check that the skills were loaded correctly
    skill = toolset.get_skill("skill-one")
    assert skill is not None
    assert skill.name == "skill-one"
    assert "First test skill for basic operations" in skill.description
    assert "Use this skill for basic operations" in skill.content


@pytest.mark.asyncio
async def test_load_skill_not_found(sample_skills: list[Skill]) -> None:
    """Test loading a non-existent skill."""
    toolset = SkillsToolset(skills=sample_skills)

    # Test that nonexistent skill raises an error
    with pytest.raises(KeyError):
        toolset.get_skill("nonexistent-skill")


@pytest.mark.asyncio
async def test_read_skill_resource_tool(sample_skills: list[Skill]) -> None:
    """Test the read_skill_resource tool."""
    toolset = SkillsToolset(skills=sample_skills)

    # Test that skill-two has the expected resources
    skill = toolset.get_skill("skill-two")
    assert skill.resources is not None
    assert len(skill.resources) == 2

    resource_names = [r.name for r in skill.resources]
    assert "FORMS.md" in resource_names
    assert "REFERENCE.md" in resource_names

    # Check that resources can be read
    for resource in skill.resources:
        assert resource.uri is not None
        resource_path = Path(resource.uri)
        assert resource_path.exists()
        assert resource_path.is_file()


@pytest.mark.asyncio
async def test_read_skill_resource_not_found(sample_skills: list[Skill]) -> None:
    """Test reading a non-existent resource."""
    toolset = SkillsToolset(skills=sample_skills)

    # Test skill with no resources
    skill_one = toolset.get_skill("skill-one")
    assert skill_one.resources is None or len(skill_one.resources) == 0

    # Test skill with resources
    skill_two = toolset.get_skill("skill-two")
    assert skill_two.resources is not None
    resource_names = [r.name for r in skill_two.resources]
    assert "NONEXISTENT.md" not in resource_names


# Tests for exclude_tools feature


def test_exclude_tools_single_string_set(sample_skills: list[Skill]) -> None:
    """Test that tools are correctly excluded when specified as a set."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools={"list_skills"},
    )

    # Verify skills are still loaded
    assert len(toolset.skills) == 2

    # Check that list_skills is not registered
    tool_names = set(toolset.tools.keys())
    assert "list_skills" not in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" in tool_names


def test_exclude_tools_multiple_tools(sample_skills: list[Skill]) -> None:
    """Test excluding multiple tools."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools={"list_skills", "read_skill_resource"},
    )

    # Verify skills are still loaded
    assert len(toolset.skills) == 2

    # Check that specified tools are not registered
    tool_names = set(toolset.tools.keys())
    assert "list_skills" not in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" not in tool_names


def test_exclude_tools_as_list(sample_skills: list[Skill]) -> None:
    """Test that exclude_tools accepts lists in addition to sets."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools=["list_skills", "load_skill"],
    )

    # Check that specified tools are not registered
    tool_names = set(toolset.tools.keys())
    assert "list_skills" not in tool_names
    assert "load_skill" not in tool_names
    assert "read_skill_resource" in tool_names


def test_exclude_tools_invalid_tool_name(sample_skills: list[Skill]) -> None:
    """Test that invalid tool names raise ValueError."""
    with pytest.raises(ValueError, match="Unknown tools.*invalid_tool"):
        SkillsToolset(
            skills=sample_skills,
            exclude_tools={"invalid_tool"},
        )


def test_exclude_tools_multiple_invalid_names(sample_skills: list[Skill]) -> None:
    """Test ValueError with multiple invalid tool names."""
    with pytest.raises(ValueError, match="Unknown tools"):
        SkillsToolset(
            skills=sample_skills,
            exclude_tools={"fake_tool", "another_fake", "list_skills"},
        )


def test_exclude_tools_load_skill_warning(sample_skills: list[Skill]) -> None:
    """Test that a warning is emitted when load_skill is excluded."""
    import warnings

    with warnings.catch_warnings(record=True) as warning_list:
        warnings.simplefilter("always")
        SkillsToolset(
            skills=sample_skills,
            exclude_tools={"load_skill"},
        )

        # Find the warning about load_skill being excluded
        load_skill_warnings = [
            w for w in warning_list if "'load_skill' is a critical tool" in str(w.message)
        ]
        assert len(load_skill_warnings) == 1
        assert issubclass(load_skill_warnings[0].category, UserWarning)


def test_exclude_tools_no_warning_for_other_tools(sample_skills: list[Skill]) -> None:
    """Test that no warning is emitted when other tools are excluded."""
    import warnings

    with warnings.catch_warnings(record=True) as warning_list:
        warnings.simplefilter("always")
        SkillsToolset(
            skills=sample_skills,
            exclude_tools={"list_skills"},
        )

        # Filter out the default skills directory warning if it exists
        relevant_warnings = [
            w
            for w in warning_list
            if "critical tool" in str(w.message) or "load_skill" in str(w.message)
        ]
        assert len(relevant_warnings) == 0


def test_exclude_tools_empty_set(sample_skills: list[Skill]) -> None:
    """Test that an empty exclude_tools set registers all tools."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools=set(),
    )

    # All tools should be registered
    tool_names = set(toolset.tools.keys())
    assert "list_skills" in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" in tool_names


def test_exclude_tools_empty_list(sample_skills: list[Skill]) -> None:
    """Test that an empty exclude_tools list registers all tools."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools=[],
    )

    # All tools should be registered
    tool_names = set(toolset.tools.keys())
    assert "list_skills" in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" in tool_names


def test_exclude_tools_none(sample_skills: list[Skill]) -> None:
    """Test that None (default) registers all tools."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools=None,
    )

    # All tools should be registered
    tool_names = set(toolset.tools.keys())
    assert "list_skills" in tool_names
    assert "load_skill" in tool_names
    assert "read_skill_resource" in tool_names


def test_exclude_tools_exclude_all(sample_skills: list[Skill]) -> None:
    """Test excluding all tools."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools={"list_skills", "load_skill", "read_skill_resource"},
    )

    # No tools should be registered
    tool_names = set(toolset.tools.keys())
    assert len(tool_names) == 0
    assert "list_skills" not in tool_names
    assert "load_skill" not in tool_names
    assert "read_skill_resource" not in tool_names


def test_exclude_tools_skills_still_loaded(sample_skills: list[Skill]) -> None:
    """Test that skills are still loaded when tools are excluded."""
    toolset = SkillsToolset(
        skills=sample_skills,
        exclude_tools={"list_skills", "read_skill_resource"},
    )

    # Skills should still be loaded and accessible
    assert len(toolset.skills) == 2
    assert "skill-one" in toolset.skills
    assert "skill-two" in toolset.skills

    # get_skill should still work
    skill = toolset.get_skill("skill-one")
    assert skill.name == "skill-one"


def test_exclude_tools_programmatic_skills(sample_skills: list[Skill]) -> None:
    """Test exclude_tools with programmatic skills."""
    from phoenix.server.agents.capabilities.skills import Skill

    custom_skill = Skill(name="custom-skill", description="Custom skill", content="Content")

    toolset = SkillsToolset(
        skills=[custom_skill],
        exclude_tools={"list_skills"},
    )

    # Custom skill should be loaded
    assert "custom-skill" in toolset.skills

    # list_skills should be excluded
    tool_names = set(toolset.tools.keys())
    assert "list_skills" not in tool_names
    assert "load_skill" in tool_names


def test_exclude_tools_mixed_valid_invalid(sample_skills: list[Skill]) -> None:
    """Test that invalid tool names in a mixed set raise ValueError."""
    with pytest.raises(ValueError, match="Unknown tools"):
        SkillsToolset(
            skills=sample_skills,
            exclude_tools={"list_skills", "invalid_tool", "load_skill"},
        )


def test_skills_toolset_is_subclass_of_abstract_toolset() -> None:
    """SkillsToolset must be a subclass of AbstractToolset (which is Generic[AgentDepsT])."""
    from pydantic_ai.toolsets import AbstractToolset

    assert issubclass(SkillsToolset, AbstractToolset)


def test_skills_toolset_works_without_deps() -> None:
    """SkillsToolset works with an Agent that has no custom deps."""
    from pydantic_ai import Agent
    from pydantic_ai.models.test import TestModel

    toolset = SkillsToolset(skills=[])
    assert isinstance(toolset, SkillsToolset)
    agent = Agent(TestModel(), toolsets=[toolset])
    assert agent is not None


def test_skills_toolset_accepted_by_agent_with_custom_deps() -> None:
    """SkillsToolset (pinned to Any) must be accepted by Agent with custom deps — same pattern as MCPServer."""
    from dataclasses import dataclass

    from pydantic_ai import Agent
    from pydantic_ai.models.test import TestModel

    @dataclass
    class MyDeps:
        api_key: str

    # No type annotation needed — FunctionToolset[Any] is compatible with any deps
    toolset = SkillsToolset(skills=[])
    agent = Agent(TestModel(), deps_type=MyDeps, toolsets=[toolset])
    assert agent is not None


# ============================================================================
# ModelRetry behavior — tools raise ModelRetry for unknown skill/resource/script
# ============================================================================


@pytest.mark.asyncio
async def test_load_skill_unknown_raises_model_retry(sample_skills: list[Skill]) -> None:
    """load_skill raises ModelRetry with the available skill list when the name is wrong."""
    from pydantic_ai import ModelRetry

    toolset = SkillsToolset(skills=sample_skills)
    load_skill = toolset.tools["load_skill"].function

    with pytest.raises(ModelRetry) as exc_info:
        await load_skill(Mock(), "does-not-exist")

    msg = str(exc_info.value)
    assert "does-not-exist" in msg
    assert "skill-one" in msg


@pytest.mark.asyncio
async def test_read_skill_resource_unknown_skill_raises_model_retry(
    sample_skills: list[Skill],
) -> None:
    """read_skill_resource raises ModelRetry when the skill name is unknown."""
    from pydantic_ai import ModelRetry

    toolset = SkillsToolset(skills=sample_skills)
    read_skill_resource = toolset.tools["read_skill_resource"].function

    with pytest.raises(ModelRetry, match="Skill 'ghost' not found"):
        await read_skill_resource(Mock(), "ghost", "FORMS.md")


@pytest.mark.asyncio
async def test_read_skill_resource_unknown_resource_raises_model_retry(
    sample_skills: list[Skill],
) -> None:
    """read_skill_resource raises ModelRetry when the resource name is unknown."""
    from pydantic_ai import ModelRetry

    toolset = SkillsToolset(skills=sample_skills)
    read_skill_resource = toolset.tools["read_skill_resource"].function

    with pytest.raises(ModelRetry) as exc_info:
        await read_skill_resource(Mock(), "skill-two", "NONEXISTENT.md")

    msg = str(exc_info.value)
    assert "NONEXISTENT.md" in msg
    assert "FORMS.md" in msg  # available list


# ============================================================================
# max_retries configuration — propagates to FunctionToolset
# ============================================================================


def test_max_retries_default_matches_pydantic_ai(sample_skills: list[Skill]) -> None:
    """When max_retries is not provided, defaults to FunctionToolset's default of 1."""
    toolset = SkillsToolset(skills=sample_skills)
    assert toolset.max_retries == 1
    for name in ("list_skills", "load_skill", "read_skill_resource"):
        assert toolset.tools[name].max_retries == 1, name


def test_max_retries_propagates_to_each_tool(sample_skills: list[Skill]) -> None:
    """max_retries=N is forwarded to FunctionToolset and inherited by every registered tool."""
    toolset = SkillsToolset(skills=sample_skills, max_retries=3)
    assert toolset.max_retries == 3
    for name in ("list_skills", "load_skill", "read_skill_resource"):
        assert toolset.tools[name].max_retries == 3, name
