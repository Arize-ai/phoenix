from __future__ import annotations

import re
from pathlib import Path

import pytest

from phoenix.server.agents.prompts import AgentPrompts, ServerAgentPrompts
from phoenix.server.agents.prompts.static_prompts import (
    STATIC_PROMPTS_DIR,
    read_static_prompt,
)
from phoenix.server.agents.prompts.templating import get_template

_TEMPLATE_SYNTAX = re.compile(r"\{\{|\{%|\{#")


def _static_prompt_files() -> list[Path]:
    return sorted(path for path in STATIC_PROMPTS_DIR.rglob("*") if path.is_file())


def test_static_prompts_directory_is_not_empty() -> None:
    assert _static_prompt_files(), f"no static prompts found under {STATIC_PROMPTS_DIR}"


@pytest.mark.parametrize("path", _static_prompt_files(), ids=lambda path: path.name)
def test_static_prompt_contains_no_template_syntax(path: Path) -> None:
    """A static prompt has nothing to interpolate, by construction.

    These files land in the provider's cacheable prefix ahead of every message
    in the conversation. Reintroducing a placeholder here is how per-run state
    gets back into the prefix and starts discarding the cache on every
    navigation, so the directory is checked rather than trusted.
    """
    match = _TEMPLATE_SYNTAX.search(path.read_text(encoding="utf-8"))
    assert match is None, (
        f"{path.relative_to(STATIC_PROMPTS_DIR)} contains template syntax "
        f"{match.group()!r}; move it out of static/ if it needs a variable"
    )


@pytest.mark.parametrize("path", _static_prompt_files(), ids=lambda path: path.name)
def test_static_prompt_is_not_a_jinja_template_file(path: Path) -> None:
    assert path.suffix != ".j2", f"{path.name} is named as a template but lives in static/"


def test_reading_a_static_prompt_strips_exactly_one_trailing_newline() -> None:
    """Matches the engine's ``keep_trailing_newline=False``.

    These prompts were templates until recently and are rendered into the same
    byte-sensitive position; a newline appearing or disappearing here is a
    cache miss for every conversation in flight.
    """
    name = "base/BASE_INSTRUCTIONS.xml"
    on_disk = (STATIC_PROMPTS_DIR / name).read_text(encoding="utf-8")

    assert on_disk.endswith("\n"), "checked-in files keep their trailing newline"
    assert read_static_prompt(name) == on_disk[:-1]


def test_static_prompts_are_unreachable_through_the_template_engine() -> None:
    with pytest.raises(ValueError, match="static prompt"):
        get_template("static/base/BASE_INSTRUCTIONS.xml")


def test_prefix_prompts_are_plain_strings() -> None:
    """Fields that reach the cacheable prefix cannot be templates.

    ``skills`` is the deliberate exception: its only variable is the fixed skill
    catalog, which no longer varies per run.
    """
    for prompts in (AgentPrompts(), ServerAgentPrompts()):
        assert isinstance(prompts.base, str)
        assert isinstance(prompts.docs_tool, str)
