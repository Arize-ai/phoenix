from __future__ import annotations

import re
from pathlib import Path

import pytest

from phoenix.server.agents.prompts import (
    SUMMARIZATION_INSTRUCTIONS_TEMPLATE,
    AgentPrompts,
)
from phoenix.server.agents.prompts.static_prompts import (
    STATIC_PROMPTS_DIR,
    read_static_prompt,
)
from phoenix.server.agents.session_titles import MAX_AGENT_SESSION_TITLE_LENGTH

_TEMPLATE_SYNTAX = re.compile(r"\{\{|\{%|\{#")


def _static_prompt_files() -> list[Path]:
    return sorted(path for path in STATIC_PROMPTS_DIR.rglob("*") if path.is_file())


def test_static_prompts_directory_is_not_empty() -> None:
    assert _static_prompt_files(), f"no static prompts found under {STATIC_PROMPTS_DIR}"


@pytest.mark.parametrize("path", _static_prompt_files(), ids=lambda path: path.name)
def test_static_prompt_contains_no_template_syntax(path: Path) -> None:
    """A static prompt has nothing to interpolate, by construction.

    A placeholder here is how per-run state gets back into the cacheable prefix,
    so the directory is checked rather than trusted.
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

    A newline appearing or disappearing here is a cache miss for every
    conversation in flight.
    """
    name = "base/BASE_INSTRUCTIONS.xml"
    on_disk = (STATIC_PROMPTS_DIR / name).read_text(encoding="utf-8")

    assert on_disk.endswith("\n"), "checked-in files keep their trailing newline"
    assert read_static_prompt(name) == on_disk[:-1]


def test_prefix_prompts_are_plain_strings() -> None:
    """Fields that reach the cacheable prefix cannot be templates.

    ``skills`` is the deliberate exception: its only variable is the fixed skill
    catalog, which no longer varies per run.
    """
    prompts = AgentPrompts()
    assert isinstance(prompts.base, str)
    assert isinstance(prompts.docs_tool, str)
    assert isinstance(prompts.phoenix_mcp_tools, str)
    assert isinstance(AgentPrompts().ui_contexts, str)


def test_every_ui_context_is_documented() -> None:
    """The prose covers every surface, so an undocumented context is a gap."""
    ui_contexts = AgentPrompts().ui_contexts

    for tag in (
        "<phoenix_project_context>",
        "<phoenix_trace_context>",
        "<phoenix_session_context>",
        "<phoenix_span_context>",
        "<phoenix_prompt_context>",
        "<phoenix_prompt_version_context>",
        "<phoenix_dataset_context>",
        "<phoenix_playground_context>",
        "<phoenix_code_evaluator_context>",
        "<phoenix_llm_evaluator_context>",
        "<phoenix_gql_mutations_policy>",
    ):
        assert tag in ui_contexts


def test_summarization_prompt_states_the_real_title_limit() -> None:
    rendered = SUMMARIZATION_INSTRUCTIONS_TEMPLATE.render(
        max_title_length=MAX_AGENT_SESSION_TITLE_LENGTH
    )
    assert f"At most {MAX_AGENT_SESSION_TITLE_LENGTH} characters." in rendered
