from collections.abc import Callable
from pathlib import Path
from unittest.mock import Mock

import pytest

from phoenix.server.agents.capabilities.skills import ContentSkillResource, Skill, SkillsToolset
from phoenix.server.agents.prompts import AgentPrompts


@pytest.fixture
def make_toolset() -> Callable[[list[Skill]], SkillsToolset]:
    prompts = AgentPrompts()

    def _make(skills: list[Skill]) -> SkillsToolset:
        return SkillsToolset(
            skills=skills,
            load_skill_template=prompts.load_skill,
            load_skill_tool_template=prompts.load_skill_tool,
            read_skill_resource_tool_template=prompts.read_skill_resource_tool,
        )

    return _make


@pytest.fixture
def sample_skills(tmp_path: Path) -> list[Skill]:
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
                ContentSkillResource(name="FORMS.md", content=forms_file.read_text()),
                ContentSkillResource(name="REFERENCE.md", content=reference_file.read_text()),
            ],
        ),
    ]


def _by_name(toolset: SkillsToolset) -> dict[str, Skill]:
    return {s.name: s for s in toolset.skills}


def test_skills_toolset_skills_attribute_contains_constructed_skill_names(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    toolset = make_toolset(sample_skills)

    names = {s.name for s in toolset.skills}
    assert names == {"skill-one", "skill-two"}


@pytest.mark.asyncio
async def test_skills_passed_at_construction_are_exposed_with_their_descriptions(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    toolset = make_toolset(sample_skills)
    by_name = _by_name(toolset)

    assert set(by_name) == {"skill-one", "skill-two"}
    assert by_name["skill-one"].description == "First test skill for basic operations"
    assert by_name["skill-two"].description == "Second test skill with resources"


@pytest.mark.asyncio
async def test_skill_loaded_from_file_preserves_name_description_and_content(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    toolset = make_toolset(sample_skills)

    skill = _by_name(toolset)["skill-one"]
    assert skill.name == "skill-one"
    assert "First test skill for basic operations" in skill.description
    assert "Use this skill for basic operations" in skill.content


@pytest.mark.asyncio
async def test_skill_loaded_with_resources_exposes_them_via_resources_attribute(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    toolset = make_toolset(sample_skills)

    skill = _by_name(toolset)["skill-two"]
    assert skill.resources is not None
    assert len(skill.resources) == 2

    resource_names = [r.name for r in skill.resources]
    assert "FORMS.md" in resource_names
    assert "REFERENCE.md" in resource_names

    for resource in skill.resources:
        assert isinstance(resource, ContentSkillResource)
        assert resource.content


@pytest.mark.asyncio
async def test_skill_loaded_without_resources_has_no_resources_and_omits_unknown_names(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    toolset = make_toolset(sample_skills)
    by_name = _by_name(toolset)

    skill_one = by_name["skill-one"]
    assert skill_one.resources is None or len(skill_one.resources) == 0

    skill_two = by_name["skill-two"]
    assert skill_two.resources is not None
    resource_names = [r.name for r in skill_two.resources]
    assert "NONEXISTENT.md" not in resource_names


def test_skills_toolset_is_subclass_of_abstract_toolset() -> None:
    from pydantic_ai.toolsets import AbstractToolset

    assert issubclass(SkillsToolset, AbstractToolset)


@pytest.mark.asyncio
async def test_load_skill_with_unknown_name_raises_model_retry_listing_available_skills(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    from pydantic_ai import ModelRetry

    toolset = make_toolset(sample_skills)
    load_skill = toolset.tools["load_skill"].function

    with pytest.raises(ModelRetry) as exc_info:
        load_skill("does-not-exist")  # type: ignore[call-arg]

    msg = str(exc_info.value)
    assert "does-not-exist" in msg
    assert "skill-one" in msg


@pytest.mark.asyncio
async def test_read_skill_resource_with_unknown_skill_raises_model_retry(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    from pydantic_ai import ModelRetry

    toolset = make_toolset(sample_skills)
    read_skill_resource = toolset.tools["read_skill_resource"].function

    with pytest.raises(ModelRetry, match="Skill 'ghost' not found"):
        await read_skill_resource(Mock(), "ghost", "FORMS.md")


@pytest.mark.asyncio
async def test_read_skill_resource_with_unknown_resource_raises_model_retry_listing_available_resources(
    sample_skills: list[Skill],
    make_toolset: Callable[[list[Skill]], SkillsToolset],
) -> None:
    from pydantic_ai import ModelRetry

    toolset = make_toolset(sample_skills)
    read_skill_resource = toolset.tools["read_skill_resource"].function

    with pytest.raises(ModelRetry) as exc_info:
        await read_skill_resource(Mock(), "skill-two", "NONEXISTENT.md")

    msg = str(exc_info.value)
    assert "NONEXISTENT.md" in msg
    assert "FORMS.md" in msg
