"""Tests for SkillsCapability."""

from __future__ import annotations

from pathlib import Path

from jinja2 import Template

from phoenix.server.agents.capabilities.skills import (
    Skill,
    SkillsCapability,
    SkillsToolset,
)

_TEMPLATE = Template(
    "Available skills:\n"
    "{%- for skill in skills | sort(attribute='name') %}\n"
    "<skill>\n"
    "<name>{{ skill.name }}</name>\n"
    "<description>{{ skill.description }}</description>\n"
    "{%- if skill.path %}\n"
    "<path>{{ skill.path }}</path>\n"
    "{%- endif %}\n"
    "</skill>\n"
    "{%- endfor %}"
)


def test_skills_capability_get_toolset() -> None:
    """SkillsCapability should expose the toolset it was constructed with."""
    skill = Skill(name="only-skill", description="x", content="...", path=Path("/tmp/x"))
    toolset = SkillsToolset(skills=[skill], load_skill_template=Template(""))
    capability = SkillsCapability(toolset=toolset, instructions=_TEMPLATE)

    assert capability.get_toolset() is toolset


def test_get_static_instructions_renders_skills_xml() -> None:
    """Each skill should appear in the rendered output as a <skill> block, sorted by name."""
    s1 = Skill(name="b-skill", description="second", content="...", path=Path("/tmp/b"))
    s2 = Skill(name="a-skill", description="first", content="...", path=Path("/tmp/a"))
    toolset = SkillsToolset(skills=[s1, s2], load_skill_template=Template(""))
    capability = SkillsCapability(toolset=toolset, instructions=_TEMPLATE)

    rendered = capability.get_static_instructions()
    assert "<name>a-skill</name>" in rendered
    assert "<name>b-skill</name>" in rendered
    assert rendered.index("a-skill") < rendered.index("b-skill")  # sorted
    assert "<description>first</description>" in rendered
    assert "<path>/tmp/a</path>" in rendered
