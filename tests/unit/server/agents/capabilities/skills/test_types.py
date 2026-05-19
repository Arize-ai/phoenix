"""Tests for pydantic-ai-skills types."""

from pathlib import Path

import pytest

from phoenix.server.agents.capabilities.skills.types import Skill, SkillResource, SkillScript


def test_skill_creation() -> None:
    """Test creating Skill with required fields."""
    skill = Skill(name='test-skill', description='A test skill', content='Test instructions')

    assert skill.name == 'test-skill'
    assert skill.description == 'A test skill'
    assert skill.content == 'Test instructions'
    assert skill.resources == []
    assert skill.scripts == []
    assert skill.metadata is None


def test_skill_with_metadata() -> None:
    """Test Skill with additional metadata."""
    skill = Skill(
        name='test-skill',
        description='A test skill',
        content='Test instructions',
        metadata={'version': '1.0.0', 'author': 'Test Author'},
    )

    assert skill.metadata is not None
    assert skill.metadata['version'] == '1.0.0'
    assert skill.metadata['author'] == 'Test Author'


def test_skill_resource_creation() -> None:
    """Test creating SkillResource with static content."""
    resource = SkillResource(name='reference', content='Reference documentation here')

    assert resource.name == 'reference'
    assert resource.content == 'Reference documentation here'
    assert resource.function is None
    assert resource.uri is None


def test_skill_script_creation(tmp_path: Path) -> None:
    """Test creating SkillScript with URI (file-based)."""
    script_path = tmp_path / 'skill' / 'scripts' / 'test_script.py'
    script = SkillScript(
        name='test_script',
        uri=str(script_path),
        skill_name='test-skill',
        function=None,
        function_schema=None,
    )

    assert script.name == 'test_script'
    assert script.uri == str(script_path)
    assert script.skill_name == 'test-skill'
    assert script.function is None


def test_skill_uri_auto_assigned_when_none() -> None:
    """Test that Skill auto-assigns a skill:// URI when uri is not provided."""
    skill = Skill(name='my-skill', description='A skill', content='Instructions')

    assert skill.uri == 'skill://my-skill'


def test_skill_explicit_uri_preserved() -> None:
    """Test that an explicitly provided URI is not overwritten by __post_init__."""
    skill = Skill(name='my-skill', description='A skill', content='Instructions', uri='custom://my-uri')

    assert skill.uri == 'custom://my-uri'


def _write_skill_md(directory: Path, content: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'SKILL.md').write_text(content)


def test_from_file_directory_path(tmp_path: Path) -> None:
    """Load a skill by passing the directory that contains SKILL.md."""
    skill_dir = tmp_path / 'my-skill'
    _write_skill_md(skill_dir, '---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n')

    skill = Skill.from_file(skill_dir)

    assert skill.name == 'my-skill'
    assert skill.description == 'A skill'
    assert 'Instructions' in skill.content
    assert skill.uri == str(skill_dir.resolve())


def test_from_file_explicit_skill_md_path(tmp_path: Path) -> None:
    """Load a skill by passing the SKILL.md file path directly."""
    skill_dir = tmp_path / 'my-skill'
    _write_skill_md(skill_dir, '---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n')

    skill = Skill.from_file(skill_dir / 'SKILL.md')

    assert skill.name == 'my-skill'


def test_from_file_missing_skill_md(tmp_path: Path) -> None:
    """A SKILL.md path that does not exist raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError, match='SKILL.md not found'):
        Skill.from_file(tmp_path / 'nonexistent' / 'SKILL.md')


def test_from_file_missing_name_validate_true(tmp_path: Path) -> None:
    """Missing name with validate=True raises ValueError."""
    skill_dir = tmp_path / 'no-name'
    _write_skill_md(skill_dir, '---\ndescription: No name\n---\n\nContent.\n')

    with pytest.raises(ValueError, match='missing the required "name" field'):
        Skill.from_file(skill_dir, validate=True)


def test_from_file_missing_name_validate_false(tmp_path: Path) -> None:
    """Missing name with validate=False falls back to the directory name."""
    skill_dir = tmp_path / 'my-fallback-skill'
    _write_skill_md(skill_dir, '---\ndescription: No name\n---\n\nContent.\n')

    skill = Skill.from_file(skill_dir, validate=False)

    assert skill.name == 'my-fallback-skill'


def test_from_file_with_resources(tmp_path: Path) -> None:
    """Resource files alongside SKILL.md are discovered and populated."""
    skill_dir = tmp_path / 'my-skill'
    _write_skill_md(skill_dir, '---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n')
    (skill_dir / 'schema.json').write_text('{"table": "users"}')

    skill = Skill.from_file(skill_dir)

    assert len(skill.resources) == 1
    assert skill.resources[0].name == 'schema.json'


def test_from_file_wrong_filename_raises(tmp_path: Path) -> None:
    """Passing a file that is not named SKILL.md raises ValueError."""
    other_file = tmp_path / 'README.md'
    other_file.write_text('# not a skill')

    with pytest.raises(ValueError, match='SKILL.md'):
        Skill.from_file(other_file)


def test_from_file_non_dict_frontmatter_raises(tmp_path: Path) -> None:
    """YAML frontmatter that is a list (not a mapping) raises ValueError."""
    skill_dir = tmp_path / 'bad-skill'
    _write_skill_md(skill_dir, '---\n- item1\n- item2\n---\n\nContent.\n')

    with pytest.raises(ValueError, match='mapping'):
        Skill.from_file(skill_dir, validate=False)


def test_from_file_custom_script_executor(tmp_path: Path) -> None:
    """The supplied script_executor is wired into every discovered script."""
    import sys

    from phoenix.server.agents.capabilities.skills.local import (
        FileBasedSkillScript,
        LocalSkillScriptExecutor,
    )

    skill_dir = tmp_path / 'my-skill'
    _write_skill_md(skill_dir, '---\nname: my-skill\ndescription: A skill\n---\n\nInstructions.\n')

    scripts_dir = skill_dir / 'scripts'
    scripts_dir.mkdir()
    script = scripts_dir / 'run.py'
    script.write_text('#!/usr/bin/env python3\nprint("hello")\n')
    if sys.platform != 'win32':
        script.chmod(0o755)

    executor = LocalSkillScriptExecutor(timeout=120)
    skill = Skill.from_file(skill_dir, script_executor=executor)

    assert len(skill.scripts) == 1
    assert skill.scripts[0].name == 'scripts/run.py'
    # Verify the supplied executor is actually stored on the script object
    assert isinstance(skill.scripts[0], FileBasedSkillScript)
    assert skill.scripts[0].executor is executor


def test_from_file_integer_name_field(tmp_path: Path) -> None:
    """A numeric name in YAML (e.g. name: 123) is coerced to str, not TypeError."""
    skill_dir = tmp_path / 'numeric-name'
    _write_skill_md(skill_dir, '---\nname: 123\ndescription: A skill\n---\n\nContent.\n')

    skill = Skill.from_file(skill_dir, validate=False)

    assert skill.name == '123'
