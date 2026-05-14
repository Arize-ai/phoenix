from __future__ import annotations

from pathlib import Path

from pydantic_ai import RunContext

from phoenix.server.agents.dependencies import ChatDependencies

_PROMPTS_DIR = Path(__file__).parent


def _read(name: str) -> str:
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8").rstrip("\n")


AGENT_STATIC_SYSTEM_PROMPT = _read("SYSTEM_PROMPT.xml")
DOCS_TOOL_SYSTEM_PROMPT = _read("DOCS_TOOL.xml")
BASH_TOOL_SYSTEM_PROMPT = _read("BASH_TOOL.xml")
ASK_USER_TOOL_SYSTEM_PROMPT = _read("ASK_USER_TOOL.xml")


def build_static_agent_system_prompt(ctx: RunContext[ChatDependencies]) -> str:
    sections: list[str] = [
        AGENT_STATIC_SYSTEM_PROMPT,
        DOCS_TOOL_SYSTEM_PROMPT,
        BASH_TOOL_SYSTEM_PROMPT,
        ASK_USER_TOOL_SYSTEM_PROMPT,
    ]
    return "\n\n".join(sections)
