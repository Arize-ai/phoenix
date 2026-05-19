"""Tests for validation functionality."""

import warnings

from phoenix.server.agents.capabilities.skills.directory import validate_skill_metadata


def test_validate_skill_metadata_valid() -> None:
    """Test validation with valid metadata."""
    frontmatter = {
        'name': 'test-skill',
        'description': 'A valid test skill',
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, 'Content here.')
        assert is_valid is True
        assert len(w) == 0


def test_validate_skill_metadata_name_too_long() -> None:
    """Test validation with name exceeding 64 characters."""
    frontmatter = {
        'name': 'a' * 65,
        'description': 'Test',
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, 'Content')
        assert is_valid is False
        assert len(w) == 1
        assert '64 characters' in str(w[0].message)


def test_validate_skill_metadata_invalid_name_format() -> None:
    """Test validation with invalid name format."""
    frontmatter = {
        'name': 'Invalid_Name_With_Underscores',
        'description': 'Test',
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, 'Content')
        assert is_valid is False
        assert len(w) >= 1
        assert any('lowercase letters, numbers, and hyphens' in str(msg.message) for msg in w)


def test_validate_skill_metadata_reserved_word() -> None:
    """Test validation with reserved words in name."""
    frontmatter = {
        'name': 'anthropic-helper',
        'description': 'Test',
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, 'Content')
        assert is_valid is False
        assert len(w) >= 1
        assert any('reserved word' in str(msg.message) for msg in w)


def test_validate_skill_metadata_description_too_long() -> None:
    """Test validation with description exceeding 1024 characters."""
    frontmatter = {
        'name': 'test-skill',
        'description': 'x' * 1025,
    }
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, 'Content')
        assert is_valid is False
        assert len(w) >= 1
        assert any('1024 characters' in str(msg.message) for msg in w)


def test_validate_skill_metadata_instructions_too_long() -> None:
    """Test validation with instructions exceeding 500 lines."""
    frontmatter = {
        'name': 'test-skill',
        'description': 'Test',
    }
    # Create content with 501 lines
    instructions = '\n'.join([f'Line {i}' for i in range(501)])

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, instructions)
        assert is_valid is False
        assert len(w) >= 1
        assert any('500 lines' in str(msg.message) for msg in w)


def test_validate_skill_metadata_multiple_issues() -> None:
    """Test validation with multiple issues."""
    frontmatter = {
        'name': 'A' * 65,  # Too long
        'description': 'x' * 1025,  # Too long
    }
    instructions = '\n'.join([f'Line {i}' for i in range(501)])  # Too many lines

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        is_valid = validate_skill_metadata(frontmatter, instructions)
        assert is_valid is False
        # Should have warnings for name, description, and instructions
        assert len(w) >= 3


def test_validate_skill_metadata_good_naming_conventions() -> None:
    """Test validation with valid naming conventions."""
    good_names = [
        'processing-pdfs',
        'analyzing-spreadsheets',
        'test-skill-123',
        'pdf-processing',
        'skill-1',
    ]

    for name in good_names:
        frontmatter = {'name': name, 'description': 'Test'}
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter('always')
            is_valid = validate_skill_metadata(frontmatter, 'Content')
            assert is_valid is True, f"Name '{name}' should be valid"
            assert len(w) == 0, f"Name '{name}' should not emit warnings"


def test_validate_skill_metadata_bad_naming_conventions() -> None:
    """Test validation with invalid naming conventions."""
    bad_names = [
        'Invalid_Name',  # Underscores
        'InvalidName',  # Capital letters
        'invalid name',  # Spaces
        'invalid.name',  # Periods
        'claude-tools',  # Reserved word
    ]

    for name in bad_names:
        frontmatter = {'name': name, 'description': 'Test'}
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter('always')
            is_valid = validate_skill_metadata(frontmatter, 'Content')
            assert is_valid is False, f"Name '{name}' should be invalid"
            assert len(w) > 0, f"Name '{name}' should trigger warnings"
