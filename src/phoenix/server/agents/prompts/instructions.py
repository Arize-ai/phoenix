from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

_INSTRUCTIONS_DIR = Path(__file__).parent


def _read(name: str) -> str:
    return (_INSTRUCTIONS_DIR / name).read_text(encoding="utf-8").rstrip("\n")


_BASE_INSTRUCTIONS = _read("BASE_INSTRUCTIONS.xml")
_DOCS_TOOL_INSTRUCTIONS = _read("DOCS_TOOL_INSTRUCTIONS.xml")
_BASH_TOOL_INSTRUCTIONS = _read("BASH_TOOL_INSTRUCTIONS.xml")
_ASK_USER_TOOL_INSTRUCTIONS = _read("ASK_USER_TOOL_INSTRUCTIONS.xml")
_SET_TIME_RANGE_TOOL_INSTRUCTIONS = _read("SET_TIME_RANGE_TOOL_INSTRUCTIONS.xml")
_SET_SPANS_FILTER_TOOL_INSTRUCTIONS = _read("SET_SPANS_FILTER_TOOL_INSTRUCTIONS.xml")
_READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = _read("READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml")
_CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = _read("CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml")
_EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS = _read("EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS.xml")


@dataclass(frozen=True)
class AgentInstructions:
    base: str = _BASE_INSTRUCTIONS
    docs_tool: str = _DOCS_TOOL_INSTRUCTIONS
    bash_tool: str = _BASH_TOOL_INSTRUCTIONS
    ask_user_tool: str = _ASK_USER_TOOL_INSTRUCTIONS
    set_time_range_tool: str = _SET_TIME_RANGE_TOOL_INSTRUCTIONS
    set_spans_filter_tool: str = _SET_SPANS_FILTER_TOOL_INSTRUCTIONS
    read_prompt_instance_tool: str = _READ_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    clone_prompt_instance_tool: str = _CLONE_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
    edit_prompt_instance_tool: str = _EDIT_PROMPT_INSTANCE_TOOL_INSTRUCTIONS
