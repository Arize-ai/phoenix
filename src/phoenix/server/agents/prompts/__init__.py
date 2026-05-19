from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent


def _read(relpath: str) -> str:
    return (_PROMPTS_DIR / relpath).read_text(encoding="utf-8").rstrip("\n")


_BASE_INSTRUCTIONS = _read("base/BASE_INSTRUCTIONS.xml")
_DOCS_TOOL_INSTRUCTIONS = _read("tools/DOCS_TOOL_INSTRUCTIONS.xml")
_BASH_TOOL_INSTRUCTIONS = _read("tools/BASH_TOOL_INSTRUCTIONS.xml")
_ASK_USER_TOOL_INSTRUCTIONS = _read("tools/ASK_USER_TOOL_INSTRUCTIONS.xml")
_SET_TIME_RANGE_TOOL_INSTRUCTIONS = _read("tools/SET_TIME_RANGE_TOOL_INSTRUCTIONS.xml")
_RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS = _read("tools/RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS.xml")
_SET_SPANS_FILTER_TOOL_INSTRUCTIONS = _read("tools/SET_SPANS_FILTER_TOOL_INSTRUCTIONS.xml")
_READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = _read("tools/READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml")
_CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = _read(
    "tools/CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml"
)
_EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = _read("tools/EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml")
_GRAPHQL_MUTATIONS_ENABLED_INSTRUCTIONS = _read(
    "context/GRAPHQL_MUTATIONS_ENABLED_INSTRUCTIONS.xml"
)
_GRAPHQL_MUTATIONS_DISABLED_INSTRUCTIONS = _read(
    "context/GRAPHQL_MUTATIONS_DISABLED_INSTRUCTIONS.xml"
)
_APP_CONTEXT_INSTRUCTIONS = _read("context/APP_CONTEXT_INSTRUCTIONS.xml")
_PROJECT_CONTEXT_INSTRUCTIONS = _read("context/PROJECT_CONTEXT_INSTRUCTIONS.xml")
_TRACE_CONTEXT_INSTRUCTIONS = _read("context/TRACE_CONTEXT_INSTRUCTIONS.xml")
_SPAN_CONTEXT_INSTRUCTIONS = _read("context/SPAN_CONTEXT_INSTRUCTIONS.xml")
_PLAYGROUND_CONTEXT_INSTRUCTIONS = _read("context/PLAYGROUND_CONTEXT_INSTRUCTIONS.xml")

SUMMARIZATION_SYSTEM_PROMPT = _read("summarization/SUMMARIZATION_PROMPT_INSTRUCTIONS.xml")


@dataclass(frozen=True)
class AgentInstructions:
    """Typed bundle of every prompt template the chat agent uses."""

    base: str = _BASE_INSTRUCTIONS
    docs_tool: str = _DOCS_TOOL_INSTRUCTIONS
    bash_tool: str = _BASH_TOOL_INSTRUCTIONS
    ask_user_tool: str = _ASK_USER_TOOL_INSTRUCTIONS
    set_time_range_tool: str = _SET_TIME_RANGE_TOOL_INSTRUCTIONS
    render_generative_ui_tool: str = _RENDER_GENERATIVE_UI_TOOL_INSTRUCTIONS
    set_spans_filter_tool: str = _SET_SPANS_FILTER_TOOL_INSTRUCTIONS
    read_prompt_instance_tool: str = _READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    clone_prompt_instance_tool: str = _CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    edit_prompt_instance_tool: str = _EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    graphql_mutations_enabled: str = _GRAPHQL_MUTATIONS_ENABLED_INSTRUCTIONS
    graphql_mutations_disabled: str = _GRAPHQL_MUTATIONS_DISABLED_INSTRUCTIONS
    app_context: str = _APP_CONTEXT_INSTRUCTIONS
    project_context: str = _PROJECT_CONTEXT_INSTRUCTIONS
    trace_context: str = _TRACE_CONTEXT_INSTRUCTIONS
    span_context: str = _SPAN_CONTEXT_INSTRUCTIONS
    playground_context: str = _PLAYGROUND_CONTEXT_INSTRUCTIONS


__all__ = [
    "AgentInstructions",
    "SUMMARIZATION_SYSTEM_PROMPT",
]
