from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.messages import ToolCallPart
from pydantic_ai.tools import AgentDepsT, ToolDefinition
from pydantic_core import to_json

# Characters one tool result may carry back to the model. Results in practice stay under
# ~220k; an unfiltered span listing can run to millions and overflow the context window,
# which ends the turn with no answer.
MAX_TOOL_RESULT_CHARS = 400_000


def serialized_length(result: Any) -> int:
    """Characters ``result`` occupies once serialized for the model."""
    if isinstance(result, str):
        return len(result)
    try:
        return len(to_json(result, fallback=str).decode("utf-8", "replace"))
    except Exception:
        # Measure the repr rather than letting an unserializable result skip the limit.
        return len(repr(result))


@dataclass
class ToolResultLimitCapability(AbstractCapability[AgentDepsT]):
    """Withholds any tool result too large for the context window.

    Withheld rather than truncated: a cut-off listing reads as complete data. The
    model is told the size and how to ask for less, so it can retry within the turn.
    """

    max_chars: int = MAX_TOOL_RESULT_CHARS

    async def after_tool_execute(
        self,
        ctx: RunContext[AgentDepsT],
        *,
        call: ToolCallPart,
        tool_def: ToolDefinition,
        args: Any,
        result: Any,
    ) -> Any:
        size = serialized_length(result)
        if size <= self.max_chars:
            return result
        return (
            f"The {call.tool_name} result was withheld: it is {size:,} characters, over "
            f"the {self.max_chars:,}-character limit for one tool result. Nothing from it "
            "reached you. Ask for less: aggregate in executeSql, add filters or a smaller "
            'limit, or select specific spans (parent_id takes the string "null" for root '
            "spans; a JSON null applies no filter)."
        )
