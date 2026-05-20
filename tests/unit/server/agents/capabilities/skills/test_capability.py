"""Tests for SkillsCapability."""

from __future__ import annotations

from jinja2 import Template

from phoenix.server.agents.capabilities.skills import (
    Skill,
    SkillsCapability,
    SkillsToolset,
)

_TEMPLATE = Template("Available skills:\n{{ skills_list }}")


def test_skills_capability_get_toolset() -> None:
    """SkillsCapability should expose the toolset it was constructed with."""
    toolset = SkillsToolset(skills=[])
    capability = SkillsCapability(toolset=toolset, instructions=_TEMPLATE)

    assert capability.get_toolset() is toolset


def test_get_static_instructions_renders_empty_skills_list() -> None:
    """With no skills, the rendered string still substitutes `{skills_list}` (with empty content)."""
    toolset = SkillsToolset(skills=[])
    capability = SkillsCapability(toolset=toolset, instructions=_TEMPLATE)

    assert capability.get_static_instructions() == "Available skills:\n"


def test_get_static_instructions_renders_skills_xml() -> None:
    """Each skill should appear in the rendered output as a <skill> block, sorted by name."""
    s1 = Skill(name="b-skill", description="second", content="...", uri="skill://b")
    s2 = Skill(name="a-skill", description="first", content="...", uri="skill://a")
    toolset = SkillsToolset(skills=[s1, s2])
    capability = SkillsCapability(toolset=toolset, instructions=_TEMPLATE)

    rendered = capability.get_static_instructions()
    assert "<name>a-skill</name>" in rendered
    assert "<name>b-skill</name>" in rendered
    assert rendered.index("a-skill") < rendered.index("b-skill")  # sorted
    assert "<description>first</description>" in rendered
    assert "<uri>skill://a</uri>" in rendered
