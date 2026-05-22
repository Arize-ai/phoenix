from pathlib import Path

import pytest

from phoenix.server.agents.capabilities.skills.skill import Skill
from phoenix.server.agents.capabilities.skills.skill_resource import (
    ContentSkillResource,
    SkillResource,
)


def test_skill_with_required_fields_defaults_resources_and_metadata() -> None:
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


def test_skill_with_metadata_stores_metadata_fields() -> None:
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


def test_content_skill_resource_holds_static_content_without_function_schema() -> None:
    resource = ContentSkillResource(name="reference", content="Reference documentation here")

    assert resource.name == "reference"
    assert resource.content == "Reference documentation here"
    assert not hasattr(resource, "function_schema")


def test_skill_resource_direct_instantiation_raises_type_error() -> None:
    with pytest.raises(TypeError, match="abstract"):
        SkillResource(name="reference")  # type: ignore[abstract]


def _write_skill_md(directory: Path, content: str) -> Path:
    """Write SKILL.md inside ``directory`` and return the file path."""
    directory.mkdir(parents=True, exist_ok=True)
    skill_file = directory / "SKILL.md"
    skill_file.write_text(content)
    return skill_file


def test_from_file_with_skill_md_path_loads_skill_with_resolved_directory(tmp_path: Path) -> None:
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


def test_from_file_with_missing_skill_md_path_raises_file_not_found_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="SKILL.md not found"):
        Skill.from_file(tmp_path / "nonexistent" / "SKILL.md")


def test_from_file_with_missing_name_field_raises_value_error(tmp_path: Path) -> None:
    skill_file = _write_skill_md(
        tmp_path / "no-name", "---\ndescription: No name\n---\n\nContent.\n"
    )

    with pytest.raises(ValueError, match='missing the required "name" field'):
        Skill.from_file(skill_file)


def test_from_file_with_explicit_resources_attaches_them_to_loaded_skill(tmp_path: Path) -> None:
    skill_file = _write_skill_md(
        tmp_path / "my-skill", "---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n"
    )

    skill = Skill.from_file(
        skill_file,
        resources=[ContentSkillResource(name="schema.json", content='{"table": "users"}')],
    )

    assert len(skill.resources) == 1
    assert skill.resources[0].name == "schema.json"


def test_from_file_with_wrong_filename_raises_value_error(tmp_path: Path) -> None:
    other_file = tmp_path / "README.md"
    other_file.write_text("# not a skill")

    with pytest.raises(ValueError, match="SKILL.md"):
        Skill.from_file(other_file)


def test_from_file_with_non_mapping_frontmatter_raises_value_error(tmp_path: Path) -> None:
    skill_file = _write_skill_md(tmp_path / "bad-skill", "---\n- item1\n- item2\n---\n\nContent.\n")

    with pytest.raises(ValueError, match="mapping"):
        Skill.from_file(skill_file)
