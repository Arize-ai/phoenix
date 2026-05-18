from __future__ import annotations

from dataclasses import KW_ONLY, dataclass
from typing import Any

from opentelemetry.trace import Tracer
from pydantic_ai import RunContext
from pydantic_ai.capabilities import (
    ValidatedToolArgs,
    WrapperCapability,
    WrapToolExecuteHandler,
)
from pydantic_ai.messages import ToolCallPart
from pydantic_ai.tools import AgentDepsT, ToolDefinition

from phoenix.server.agents.pydantic_ai.tool_spans import ToolSpanMixin


@dataclass
class OpenInferenceCapabilityWrapper(WrapperCapability[AgentDepsT], ToolSpanMixin):
    """Pydantic-ai ``Capability`` wrapper that emits an OpenInference ``TOOL`` span per call."""

    _: KW_ONLY
    tracer: Tracer

    async def wrap_tool_execute(
        self,
        ctx: RunContext[AgentDepsT],
        *,
        call: ToolCallPart,
        tool_def: ToolDefinition,
        args: ValidatedToolArgs,
        handler: WrapToolExecuteHandler,
    ) -> Any:
        with self._tool_span(
            tool_def=tool_def,
            tool_args=args,
            tool_call_id=call.tool_call_id,
        ) as set_output:
            result = await super().wrap_tool_execute(
                ctx, call=call, tool_def=tool_def, args=args, handler=handler
            )
            set_output(result)
            return result
