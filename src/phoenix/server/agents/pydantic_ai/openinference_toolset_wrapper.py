from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from opentelemetry.trace import Tracer
from pydantic_ai._run_context import RunContext
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets.abstract import AbstractToolset, ToolsetTool
from pydantic_ai.toolsets.wrapper import WrapperToolset

from phoenix.server.agents.pydantic_ai.tool_spans import ToolSpanMixin


@dataclass(init=False)
class OpenInferenceToolsetWrapper(WrapperToolset[AgentDepsT], ToolSpanMixin):
    """Pydantic-ai ``Toolset`` wrapper that emits an OpenInference ``TOOL`` span per call.

    Wraps ``call_tool`` — the single seam every tool invocation flows through —
    so the wrapper captures every call regardless of which agent or model
    triggered it.
    """

    def __init__(
        self,
        wrapped: AbstractToolset[AgentDepsT],
        *,
        tracer: Tracer,
    ) -> None:
        super().__init__(wrapped)
        self.tracer = tracer

    async def call_tool(
        self,
        name: str,
        tool_args: dict[str, Any],
        ctx: RunContext[AgentDepsT],
        tool: ToolsetTool[AgentDepsT],
    ) -> Any:
        with self._tool_span(
            tool_def=tool.tool_def,
            tool_args=tool_args,
            tool_call_id=ctx.tool_call_id,
        ) as set_output:
            result = await super().call_tool(name, tool_args, ctx, tool)
            set_output(result)
            return result
