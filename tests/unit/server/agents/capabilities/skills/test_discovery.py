"""Tests for skill discovery."""

import sys
from pathlib import Path

import pytest

from phoenix.server.agents.capabilities.skills.directory import SkillsDirectory, discover_skills


def test_discover_skills_single_skill(tmp_path: Path) -> None:
    """Test discovering a single skill."""
    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    skill_md = skill_dir / 'SKILL.md'
    skill_md.write_text("""---
name: test-skill
description: A test skill
---

# Test Skill

Instructions here.
""")

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].name == 'test-skill'
    assert skills[0].description == 'A test skill'
    assert 'Instructions here' in skills[0].content


def test_discover_skills_multiple_skills(tmp_path: Path) -> None:
    """Test discovering multiple skills."""
    # Create first skill
    skill1_dir = tmp_path / 'skill-one'
    skill1_dir.mkdir()
    (skill1_dir / 'SKILL.md').write_text("""---
name: skill-one
description: First skill
---

Content 1.
""")

    # Create second skill
    skill2_dir = tmp_path / 'skill-two'
    skill2_dir.mkdir()
    (skill2_dir / 'SKILL.md').write_text("""---
name: skill-two
description: Second skill
---

Content 2.
""")

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 2
    skill_names = {s.name for s in skills}
    assert skill_names == {'skill-one', 'skill-two'}


def test_discover_skills_with_resources(tmp_path: Path) -> None:
    """Test discovering skills with resource files."""
    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
name: test-skill
description: Skill with resources
---

See FORMS.md for details.
""")

    (skill_dir / 'FORMS.md').write_text('# Forms\n\nForm documentation.')
    (skill_dir / 'REFERENCE.md').write_text('# Reference\n\nAPI reference.')

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].resources is not None
    assert len(skills[0].resources) == 2
    resource_names = {r.name for r in skills[0].resources}
    assert resource_names == {'FORMS.md', 'REFERENCE.md'}


def test_discover_skills_with_scripts(tmp_path: Path) -> None:
    """Test discovering skills with scripts."""
    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
name: test-skill
description: Skill with scripts
---

Use the search script.
""")

    scripts_dir = skill_dir / 'scripts'
    scripts_dir.mkdir()
    (scripts_dir / 'search.py').write_text('#!/usr/bin/env python3\nprint("searching")')
    (scripts_dir / 'process.py').write_text('#!/usr/bin/env python3\nprint("processing")')

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].scripts is not None
    assert len(skills[0].scripts) == 2
    script_names = {s.name for s in skills[0].scripts}
    assert script_names == {'scripts/search.py', 'scripts/process.py'}


def test_discover_skills_with_shell_and_executable_scripts(tmp_path: Path) -> None:
    """Test discovering shell scripts and executable files."""
    if sys.platform == 'win32':
        pytest.skip('Executable-bit semantics differ on Windows')

    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
name: test-skill
description: Skill with mixed script types
---

Use mixed scripts.
""")

    scripts_dir = skill_dir / 'scripts'
    scripts_dir.mkdir()

    shell_script = scripts_dir / 'deploy.sh'
    shell_script.write_text('#!/usr/bin/env bash\necho "deploy"\n')

    executable_script = scripts_dir / 'runner'
    executable_script.write_text('#!/usr/bin/env bash\necho "runner"\n')
    executable_script.chmod(0o755)

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].scripts is not None
    script_names = {s.name for s in skills[0].scripts}
    assert 'scripts/deploy.sh' in script_names
    assert 'scripts/runner' in script_names


def test_discover_skills_with_root_and_custom_executable_scripts(tmp_path: Path) -> None:
    """Test discovering executable scripts in skill root and with custom extension."""
    if sys.platform == 'win32':
        pytest.skip('Executable-bit semantics differ on Windows')

    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
name: test-skill
description: Skill with root and custom executable scripts
---

Use mixed executable scripts.
""")

    root_script = skill_dir / 'bootstrap'
    root_script.write_text('#!/usr/bin/env sh\necho "boot"\n')
    root_script.chmod(0o755)

    scripts_dir = skill_dir / 'scripts'
    scripts_dir.mkdir()

    custom_extension_script = scripts_dir / 'run.custom'
    custom_extension_script.write_text('#!/usr/bin/env sh\necho "custom"\n')
    custom_extension_script.chmod(0o755)

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].scripts is not None
    script_names = {s.name for s in skills[0].scripts}
    assert 'bootstrap' in script_names
    assert 'scripts/run.custom' in script_names


def test_discover_skills_nested_directories(tmp_path: Path) -> None:
    """Test discovering skills in nested directories."""
    nested_dir = tmp_path / 'category' / 'subcategory' / 'test-skill'
    nested_dir.mkdir(parents=True)

    (nested_dir / 'SKILL.md').write_text("""---
name: nested-skill
description: Nested skill
---

Content.
""")

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].name == 'nested-skill'


def test_discover_skills_missing_name_with_validation(tmp_path: Path) -> None:
    """Test discovering skill missing name field with validation enabled."""
    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
description: Missing name field
---

Content.
""")

    # With validation, missing name is an error
    with pytest.raises(ValueError, match='missing the required "name" field'):
        discover_skills(tmp_path, validate=True)


def test_discover_skills_missing_name_without_validation(tmp_path: Path) -> None:
    """Test discovering skill missing name field without validation."""
    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
description: Missing name field
---

Content.
""")

    # Without validation, uses folder name
    skills = discover_skills(tmp_path, validate=False)
    assert len(skills) == 1
    assert skills[0].name == 'test-skill'  # Uses folder name


def test_discover_skills_nonexistent_directory(tmp_path: Path) -> None:
    """Test discovering skills from non-existent directory."""
    nonexistent = tmp_path / 'does-not-exist'

    # Should not raise, just log warning
    skills = discover_skills(nonexistent, validate=True)
    assert len(skills) == 0


def test_discover_skills_resources_subdirectory(tmp_path: Path) -> None:
    """Test discovering resources in resources/ subdirectory."""
    skill_dir = tmp_path / 'test-skill'
    skill_dir.mkdir()

    (skill_dir / 'SKILL.md').write_text("""---
name: test-skill
description: Skill with resources subdirectory
---

Content.
""")

    resources_dir = skill_dir / 'resources'
    resources_dir.mkdir()
    (resources_dir / 'schema.json').write_text('{}')
    (resources_dir / 'template.txt').write_text('template')

    nested_dir = resources_dir / 'nested'
    nested_dir.mkdir()
    (nested_dir / 'data.csv').write_text('col1,col2')

    skills = discover_skills(tmp_path, validate=True)

    assert len(skills) == 1
    assert skills[0].resources is not None
    assert len(skills[0].resources) == 3

    resource_names = {r.name for r in skills[0].resources}
    assert 'resources/schema.json' in resource_names
    assert 'resources/template.txt' in resource_names
    assert 'resources/nested/data.csv' in resource_names


def test_skills_directory_missing_name_with_validation(tmp_path: Path) -> None:
    """SkillsDirectory with validate=True raises on a skill missing its name."""
    skill_dir = tmp_path / 'nameless'
    skill_dir.mkdir()
    (skill_dir / 'SKILL.md').write_text('---\ndescription: No name\n---\n\nContent.\n')

    with pytest.raises(ValueError, match='missing the required "name" field'):
        SkillsDirectory(path=tmp_path, validate=True)


def test_skills_directory_missing_name_without_validation(tmp_path: Path) -> None:
    """SkillsDirectory with validate=False falls back to the directory name."""
    skill_dir = tmp_path / 'my-skill'
    skill_dir.mkdir()
    (skill_dir / 'SKILL.md').write_text('---\ndescription: No name\n---\n\nContent.\n')

    sd = SkillsDirectory(path=tmp_path, validate=False)
    skills = list(sd.get_skills().values())

    assert len(skills) == 1
    assert skills[0].name == 'my-skill'
