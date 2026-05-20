"""Tests for pydantic-ai-skills types."""

from pathlib import Path

import pytest

from phoenix.server.agents.capabilities.skills.skill import Skill
from phoenix.server.agents.capabilities.skills.skill_resource import (
    ContentSkillResource,
    SkillResource,
)


def test_skill_creation() -> None:
    """Test creating Skill with required fields."""
    skill = Skill(
        name="test-skill",
        description="A test skill",
        content="Test instructions",
        path=Path("/tmp/test-skill"),
    )

    assert skill.name == "test-skill"
    assert skill.description == "A test skill"
    assert skill.content == "Test instructions"
    assert skill.path == Path("/tmp/test-skill")
    assert skill.resources == []
    assert skill.metadata is None


def test_skill_with_metadata() -> None:
    """Test Skill with additional metadata."""
    skill = Skill(
        name="test-skill",
        description="A test skill",
        content="Test instructions",
        path=Path("/tmp/test-skill"),
        metadata={"version": "1.0.0", "author": "Test Author"},
    )

    assert skill.metadata is not None
    assert skill.metadata["version"] == "1.0.0"
    assert skill.metadata["author"] == "Test Author"


def test_content_skill_resource_creation() -> None:
    """Test creating ContentSkillResource with static content."""
    resource = ContentSkillResource(name="reference", content="Reference documentation here")

    assert resource.name == "reference"
    assert resource.content == "Reference documentation here"
    assert not hasattr(resource, "function_schema")


def test_skill_resource_is_abstract() -> None:
    """SkillResource is an ABC and cannot be instantiated directly."""
    with pytest.raises(TypeError, match="abstract"):
        SkillResource(name="reference")  # type: ignore[abstract]


def _write_skill_md(directory: Path, content: str) -> Path:
    """Write SKILL.md inside ``directory`` and return the file path."""
    directory.mkdir(parents=True, exist_ok=True)
    skill_file = directory / "SKILL.md"
    skill_file.write_text(content)
    return skill_file


def test_from_file_skill_md_path(tmp_path: Path) -> None:
    """Load a skill by passing the SKILL.md file path directly."""
    skill_dir = tmp_path / "my-skill"
    skill_file = _write_skill_md(
        skill_dir, "---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n"
    )

    skill = Skill.from_file(skill_file)

    assert skill.name == "my-skill"
    assert skill.description == "A skill"
    assert "Instructions" in skill.content
    assert skill.path == skill_dir.resolve()
    assert skill.resources == []


def test_from_file_missing_skill_md(tmp_path: Path) -> None:
    """A SKILL.md path that does not exist raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError, match="SKILL.md not found"):
        Skill.from_file(tmp_path / "nonexistent" / "SKILL.md")


def test_from_file_missing_name_raises(tmp_path: Path) -> None:
    """Missing name raises ValueError."""
    skill_file = _write_skill_md(
        tmp_path / "no-name", "---\ndescription: No name\n---\n\nContent.\n"
    )

    with pytest.raises(ValueError, match='missing the required "name" field'):
        Skill.from_file(skill_file)


def test_from_file_attaches_explicit_resources(tmp_path: Path) -> None:
    """Caller-supplied resources are attached to the loaded Skill."""
    skill_file = _write_skill_md(
        tmp_path / "my-skill", "---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n"
    )

    skill = Skill.from_file(
        skill_file,
        resources=[ContentSkillResource(name="schema.json", content='{"table": "users"}')],
    )

    assert len(skill.resources) == 1
    assert skill.resources[0].name == "schema.json"


def test_from_file_wrong_filename_raises(tmp_path: Path) -> None:
    """Passing a file that is not named SKILL.md raises ValueError."""
    other_file = tmp_path / "README.md"
    other_file.write_text("# not a skill")

    with pytest.raises(ValueError, match="SKILL.md"):
        Skill.from_file(other_file)


def test_from_file_non_dict_frontmatter_raises(tmp_path: Path) -> None:
    """YAML frontmatter that is a list (not a mapping) raises ValueError."""
    skill_file = _write_skill_md(tmp_path / "bad-skill", "---\n- item1\n- item2\n---\n\nContent.\n")

    with pytest.raises(ValueError, match="mapping"):
        Skill.from_file(skill_file)
