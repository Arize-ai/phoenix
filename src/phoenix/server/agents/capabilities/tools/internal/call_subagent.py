from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import RunContext, Tool
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.toolsets import AgentToolset, FunctionToolset
from pydantic_ai.ui.vercel_ai import VercelAIEventStream
from pydantic_ai.ui.vercel_ai.request_types import SubmitMessage
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.subagent_progress import (
    SubagentUIMessageAccumulator,
    build_subagent_tool_output,
)
from phoenix.server.agents.types import AgentDependencies

CALL_SUBAGENT_TOOL_DESCRIPTION = """\
Delegate a natural-language task to the Phoenix GraphQL server agent, which queries \
the Phoenix backend and returns a concise answer. Use for any task that requires \
data about projects, traces, spans, datasets, experiments, or evaluations.
"""


class CallSubAgentToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the main agent's ``call_subagent`` delegation tool.

    The tool delegates a natural-language task to the GraphQL server agent and
    returns its answer, forwarding ``usage`` so token accounting aggregates into the
    parent run (the pydantic-ai agent-delegation pattern).
    """

    def __init__(
        self,
        *,
        server_agent: AbstractAgent[None, str],
    ) -> None:
        async def call_subagent(ctx: RunContext[AgentDependencies], name: str, task: str) -> str:
            emitter = ctx.deps.subagent_progress_emitter
            if emitter is None or ctx.tool_call_id is None:
                result = await server_agent.run(
                    task,
                    deps=None,
                    usage=ctx.usage,
                )
                return result.output

            tool_call_id = ctx.tool_call_id
            accumulator = SubagentUIMessageAccumulator()
            final_summary: str | None = None

            async def on_complete(result: object) -> None:
                nonlocal final_summary
                final_summary = str(getattr(result, "output", ""))

            event_stream = VercelAIEventStream(
                SubmitMessage(id=f"subagent-{tool_call_id}", messages=[])
            )
            async with server_agent.run_stream_events(
                task,
                deps=None,
                usage=ctx.usage,
            ) as native_stream:
                async for chunk in event_stream.transform_stream(
                    native_stream,
                    on_complete=on_complete,
                ):
                    if not accumulator.ingest(chunk) or not accumulator.has_visible_parts():
                        continue
                    await emitter.emit(
                        ToolOutputAvailableChunk(
                            tool_call_id=tool_call_id,
                            output=build_subagent_tool_output(
                                accumulator=accumulator,
                                summary=final_summary,
                            ),
                            preliminary=True,
                        )
                    )

            if final_summary is None:
                if accumulator.error_text is not None:
                    raise RuntimeError(accumulator.error_text)
                final_summary = accumulator.summary_text()
            emitter.set_final_output(
                tool_call_id=tool_call_id,
                output=build_subagent_tool_output(
                    accumulator=accumulator,
                    summary=final_summary,
                ),
            )
            return final_summary

        super().__init__(
            tools=[Tool(call_subagent, takes_ctx=True, description=CALL_SUBAGENT_TOOL_DESCRIPTION)]
        )


@dataclass
class CallSubAgentCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that adds the `call_subagent` tool to an agent."""

    server_agent: AbstractAgent[None, str]
    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return CallSubAgentToolset(
            server_agent=self.server_agent,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
