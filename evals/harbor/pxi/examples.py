"""Per-example records derived from the PXI dataset YAML files.

The YAML under ``evals/harbor/pxi/datasets`` stays the source of truth. Each example becomes
one Harbor task whose ``instruction.md`` carries this record; see ``render_instruction``.
"""

from __future__ import annotations

import json
import re
from typing import Any

_STEP_NAME_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


def step_name(example_id: str) -> str:
    return _STEP_NAME_CHARS.sub("-", example_id).strip("-") or "example"


def user_instruction(example: dict[str, Any]) -> str:
    """The newest user text in the example, for the step's ``instruction.md``."""
    messages = example["input"].get("messages") or []
    for message in reversed(messages):
        if message.get("role") != "user":
            continue
        if isinstance(content := message.get("content"), str):
            return content
        texts = [
            part.get("text", "")
            for part in message.get("parts") or []
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        if texts:
            return "".join(texts)
    return ""


_EXAMPLE_FENCE = re.compile(r"```json\n(?P<body>.*?)\n```\s*$", re.DOTALL)


def render_instruction(example: dict[str, Any]) -> str:
    """The task's ``instruction.md``: the user's request, then the example as JSON.

    Harbor hands the agent only this text at run time, so the example travels inside it.
    The request comes first so the file and the Phoenix dataset entry read naturally.
    """
    request = user_instruction(example).rstrip()
    body = json.dumps(example, indent=2, ensure_ascii=False)
    return f"{request}\n\n```json\n{body}\n```\n"


def parse_instruction(text: str) -> dict[str, Any]:
    match = _EXAMPLE_FENCE.search(text)
    if match is None:
        raise ValueError("the instruction carries no ```json example block")
    example = json.loads(match.group("body"))
    if not isinstance(example, dict):
        raise ValueError("the instruction's example block must be a JSON object")
    return example
