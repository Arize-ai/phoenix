import pytest

from phoenix.server.agents.capabilities.skills import parse_skill_md


def test_parse_skill_md_with_valid_frontmatter_returns_parsed_fields_and_instructions() -> None:
    content = """---
name: test-skill
description: A test skill for testing
version: 1.0.0
---

# Test Skill

This is the main content.
"""

    frontmatter, instructions = parse_skill_md(content)

    assert frontmatter["name"] == "test-skill"
    assert frontmatter["description"] == "A test skill for testing"
    assert frontmatter["version"] == "1.0.0"
    assert instructions.startswith("# Test Skill")


def test_parse_skill_md_without_frontmatter_fence_raises_value_error() -> None:
    content = """# Test Skill

This skill has no frontmatter.
"""

    with pytest.raises(ValueError, match="frontmatter fence"):
        parse_skill_md(content)


def test_parse_skill_md_without_closing_fence_raises_value_error() -> None:
    content = """---
name: test-skill
description: A test skill

# Test Skill

Content here, but the frontmatter was never closed.
"""

    with pytest.raises(ValueError, match="closing fence"):
        parse_skill_md(content)


def test_parse_skill_md_with_empty_frontmatter_returns_empty_dict_and_instructions() -> None:
    content = """---
---

# Test Skill

Content here.
"""

    frontmatter, instructions = parse_skill_md(content)

    assert frontmatter == {}
    assert instructions.startswith("# Test Skill")


def test_parse_skill_md_with_invalid_yaml_raises_value_error() -> None:
    content = """---
name: test-skill
description: [unclosed array
---

Content.
"""

    with pytest.raises(ValueError, match="Failed to parse YAML frontmatter"):
        parse_skill_md(content)


def test_parse_skill_md_with_multiline_description_preserves_all_lines() -> None:
    content = """---
name: test-skill
description: |
  This is a multiline
  description for testing
---

# Content
"""

    frontmatter, _ = parse_skill_md(content)

    assert "multiline" in frontmatter["description"]
    assert "description for testing" in frontmatter["description"]


def test_parse_skill_md_with_complex_frontmatter_returns_nested_structures() -> None:
    content = """---
name: complex-skill
description: Complex skill with metadata
version: 2.0.0
author: Test Author
tags:
  - testing
  - example
metadata:
  category: test
  priority: high
---

# Complex Skill
"""

    frontmatter, _ = parse_skill_md(content)

    assert frontmatter["name"] == "complex-skill"
    assert frontmatter["tags"] == ["testing", "example"]
    assert frontmatter["metadata"]["category"] == "test"
