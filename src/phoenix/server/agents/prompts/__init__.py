from __future__ import annotations

from pathlib import Path

from phoenix.server.agents.prompts.instructions import AgentInstructions

_PROMPTS_DIR = Path(__file__).parent


def _read(name: str) -> str:
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8").rstrip("\n")


SUMMARIZATION_SYSTEM_PROMPT = _read("SUMMARIZATION_PROMPT_INSTRUCTIONS.xml")

__all__ = ["AgentInstructions", "SUMMARIZATION_SYSTEM_PROMPT"]
