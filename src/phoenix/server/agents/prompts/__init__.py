from __future__ import annotations

from dataclasses import dataclass

from jinja2 import Template

from phoenix.server.agents.prompts.static_prompts import read_static_prompt
from phoenix.server.agents.prompts.templating import get_template

_BASE_INSTRUCTIONS = read_static_prompt("base/BASE_INSTRUCTIONS.xml")
_BASE_SUBAGENT_INSTRUCTIONS = read_static_prompt("base/BASE_SUBAGENT_INSTRUCTIONS.xml")
_DOCS_TOOL_INSTRUCTIONS = read_static_prompt("tools/DOCS_TOOL_INSTRUCTIONS.xml")

_UI_CONTEXT_PROMPT_NAMES = (
    "context/UI_STATE_INSTRUCTIONS.xml",
    "context/PROJECT_CONTEXT_INSTRUCTIONS.xml",
    "context/TRACE_CONTEXT_INSTRUCTIONS.xml",
    "context/SESSION_CONTEXT_INSTRUCTIONS.xml",
    "context/SPAN_CONTEXT_INSTRUCTIONS.xml",
    "context/PROMPT_CONTEXT_INSTRUCTIONS.xml",
    "context/PROMPT_VERSION_CONTEXT_INSTRUCTIONS.xml",
    "context/DATASET_CONTEXT_INSTRUCTIONS.xml",
    "context/PLAYGROUND_CONTEXT_INSTRUCTIONS.xml",
    "context/CODE_EVALUATOR_CONTEXT_INSTRUCTIONS.xml",
    "context/LLM_EVALUATOR_CONTEXT_INSTRUCTIONS.xml",
    "context/GRAPHQL_MUTATIONS_INSTRUCTIONS.xml",
)
"""Every UI-context prompt, in the order they are concatenated.

The order is spelled out rather than derived from a directory listing: these
bytes sit in the provider's cacheable prefix, and a filesystem-dependent
ordering would let the prefix differ between two deployments of the same
release.
"""

_UI_CONTEXT_INSTRUCTIONS = "\n".join(read_static_prompt(name) for name in _UI_CONTEXT_PROMPT_NAMES)
"""Documentation for every UI context the agent understands, unconditionally.

Each file documents its surface for *every* case rather than selecting one, so
the text never varies with what the user happens to be looking at. Which case
applies is decided by the ``<phoenix_ui_state>`` block on the user's turn — the
data lives at the tail of the message stream, where changing it costs one block
instead of reprocessing the conversation behind it.
"""

_SKILLS_TEMPLATE = get_template("skills/SKILLS_INSTRUCTIONS.xml.j2")
_LOAD_SKILL_TEMPLATE = get_template("skills/LOAD_SKILL.xml.j2")

SUMMARIZATION_INSTRUCTIONS = read_static_prompt(
    "summarization/SUMMARIZATION_PROMPT_INSTRUCTIONS.xml"
)
COMPACTION_INSTRUCTIONS = read_static_prompt("summarization/COMPACTION_PROMPT_INSTRUCTIONS.xml")


@dataclass(frozen=True)
class AgentPrompts:
    """Every prompt the chat agent uses.

    Fields typed ``str`` are static prompts read verbatim from
    ``prompts/static/``; they sit in the cacheable prefix and cannot vary.
    Fields typed ``Template`` render per run — the two that remain are the
    skills prompts, whose only variable is the fixed skill catalog (see
    :func:`phoenix.server.agents.skills.get_all_skills`) and, for
    ``load_skill``, the body of the skill a tool call just asked for.
    """

    base: str = _BASE_INSTRUCTIONS
    docs_tool: str = _DOCS_TOOL_INSTRUCTIONS
    ui_contexts: str = _UI_CONTEXT_INSTRUCTIONS
    skills: Template = _SKILLS_TEMPLATE
    load_skill: Template = _LOAD_SKILL_TEMPLATE


@dataclass(frozen=True)
class ServerAgentPrompts:
    """Every prompt the server agent uses. See :class:`AgentPrompts` for how
    the ``str`` and ``Template`` fields differ."""

    base: str = _BASE_SUBAGENT_INSTRUCTIONS
    docs_tool: str = _DOCS_TOOL_INSTRUCTIONS
    skills: Template = _SKILLS_TEMPLATE
    load_skill: Template = _LOAD_SKILL_TEMPLATE


__all__ = [
    "AgentPrompts",
    "COMPACTION_INSTRUCTIONS",
    "ServerAgentPrompts",
    "SUMMARIZATION_INSTRUCTIONS",
]
