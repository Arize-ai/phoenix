from __future__ import annotations

from dataclasses import dataclass

from phoenix.server.agents.prompts.static_prompts import read_static_prompt
from phoenix.server.agents.prompts.templating import get_template

_BASE_INSTRUCTIONS = read_static_prompt("base/BASE_INSTRUCTIONS.xml")
_VIEWER_ACCESS_INSTRUCTIONS = read_static_prompt("base/VIEWER_ACCESS_INSTRUCTIONS.xml")
_SUBAGENT_INSTRUCTIONS = read_static_prompt("base/SUBAGENT_INSTRUCTIONS.xml")
_DOCS_TOOL_INSTRUCTIONS = read_static_prompt("tools/DOCS_TOOL_INSTRUCTIONS.xml")
_PHOENIX_MCP_TOOL_INSTRUCTIONS = read_static_prompt("tools/PHOENIX_MCP_TOOL_INSTRUCTIONS.xml")
_GITHUB_TOOL_INSTRUCTIONS = read_static_prompt("tools/GITHUB_TOOL_INSTRUCTIONS.xml")

_UI_CONTEXT_PROMPT_NAMES = (
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

_UI_CONTEXT_INSTRUCTIONS = "\n".join(read_static_prompt(name) for name in _UI_CONTEXT_PROMPT_NAMES)

SUMMARIZATION_INSTRUCTIONS_TEMPLATE = get_template(
    "summarization/SUMMARIZATION_PROMPT_INSTRUCTIONS.xml.j2"
)
COMPACTION_INSTRUCTIONS_TEMPLATE = get_template(
    "summarization/COMPACTION_PROMPT_INSTRUCTIONS.xml.j2"
)
COMPACTION_MESSAGE_TEMPLATE = get_template("summarization/COMPACTION_MESSAGE.xml.j2")
UI_STATE_TEMPLATE = get_template("ui_state/UI_STATE.xml.j2")


@dataclass(frozen=True)
class AgentPrompts:
    base: str = _BASE_INSTRUCTIONS
    viewer_access: str = _VIEWER_ACCESS_INSTRUCTIONS
    subagent: str = _SUBAGENT_INSTRUCTIONS
    docs_tool: str = _DOCS_TOOL_INSTRUCTIONS
    phoenix_mcp_tools: str = _PHOENIX_MCP_TOOL_INSTRUCTIONS
    github_tools: str = _GITHUB_TOOL_INSTRUCTIONS
    ui_contexts: str = _UI_CONTEXT_INSTRUCTIONS


__all__ = [
    "AgentPrompts",
    "COMPACTION_INSTRUCTIONS_TEMPLATE",
    "COMPACTION_MESSAGE_TEMPLATE",
    "SUMMARIZATION_INSTRUCTIONS_TEMPLATE",
    "UI_STATE_TEMPLATE",
]
