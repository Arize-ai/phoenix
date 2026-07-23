from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Generic

from pydantic import BaseModel
from pydantic_ai import AgentRunResult, RunContext, Tool
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset, FunctionToolset
from pydantic_ai.ui.vercel_ai import VercelAIEventStream
from pydantic_ai.ui.vercel_ai.request_types import (
    SubmitMessage as PydanticAISubmitMessage,
)
from pydantic_ai.ui.vercel_ai.request_types import (
    TextUIPart as PydanticAITextUIPart,
)
from pydantic_ai.ui.vercel_ai.request_types import UIMessage as PydanticAIUIMessage
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.db.types.data_stream_protocol import (
    UIDataPart,
    UIMessage,
    UIReasoningPart,
    UIStepStartPart,
    UITextPart,
)
from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.data_stream_protocol import (
    accumulate_ui_message_chunks_to_ui_messages,
)

CALL_SUBAGENT_TOOL_DESCRIPTION = """\
Delegate a natural-language task to the Phoenix GraphQL server agent, which queries \
the Phoenix backend and returns a concise answer. Use for any task that requires \
data about projects, traces, spans, datasets, experiments, or evaluations.
"""


class CallSubagentOutput(BaseModel):
    summary: str
    message: UIMessage


class CallSubagentOutputChunk(ToolOutputAvailableChunk):
    output: CallSubagentOutput


class CallSubAgentToolset(FunctionToolset[AgentDepsT], Generic[AgentDepsT]):
    """Toolset exposing the main agent's ``call_subagent`` delegation tool.

    The tool delegates a natural-language task to the GraphQL server agent and
    returns its answer, forwarding ``usage`` so token accounting aggregates into the
    parent run (the pydantic-ai agent-delegation pattern).
    """

    def __init__(
        self,
        *,
        server_agent: AbstractAgent[None, str],
        publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]],
        set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None],
    ) -> None:
        async def call_subagent(ctx: RunContext[AgentDepsT], name: str, task: str) -> str:
            tool_call_id = ctx.tool_call_id
            if tool_call_id is None:
                raise RuntimeError(
                    "Internal error: call_subagent was invoked without a tool_call_id."
                )

            final_summary: str | None = None
            latest_message: UIMessage | None = None

            async def _on_complete(result: AgentRunResult[str]) -> None:
                nonlocal final_summary
                final_summary = result.output

            event_stream = VercelAIEventStream(
                run_input=_get_dummy_request_data(tool_call_id=tool_call_id, task=task)
            )
            async with server_agent.run_stream_events(
                task,
                deps=None,
                usage=ctx.usage,
            ) as stream:
                chunks = event_stream.transform_stream(stream, on_complete=_on_complete)
                async for message in accumulate_ui_message_chunks_to_ui_messages(chunks):
                    latest_message = message
                    if not _has_renderable_ui_message_parts(message):
                        continue
                    await publish_subagent_message_chunk(
                        CallSubagentOutputChunk(
                            tool_call_id=tool_call_id,
                            output=CallSubagentOutput(
                                summary=final_summary or _get_fallback_subagent_summary(message),
                                message=message,
                            ),
                            preliminary=True,
                        )
                    )

            if latest_message is None:
                latest_message = UIMessage(
                    id=f"subagent-{tool_call_id}",
                    role="assistant",
                    parts=[],
                )
            summary = (
                final_summary
                if final_summary is not None
                else _get_fallback_subagent_summary(latest_message)
            )
            set_subagent_final_tool_output(
                CallSubagentOutputChunk(
                    tool_call_id=tool_call_id,
                    output=CallSubagentOutput(summary=summary, message=latest_message),
                )
            )
            return summary

        super().__init__(
            tools=[Tool(call_subagent, takes_ctx=True, description=CALL_SUBAGENT_TOOL_DESCRIPTION)]
        )


@dataclass
class CallSubAgentCapability(AbstractStaticCapability[AgentDepsT], Generic[AgentDepsT]):
    """Capability that adds the `call_subagent` tool to an agent."""

    server_agent: AbstractAgent[None, str]
    instructions: str
    publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]]
    set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None]

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return CallSubAgentToolset[AgentDepsT](
            server_agent=self.server_agent,
            publish_subagent_message_chunk=self.publish_subagent_message_chunk,
            set_subagent_final_tool_output=self.set_subagent_final_tool_output,
        )

    def get_static_instructions(self) -> str:
        return self.instructions


def _has_renderable_ui_message_parts(message: UIMessage) -> bool:
    """Return whether a UI message has content worth publishing as progress."""
    for part in message.parts:
        if isinstance(part, UIStepStartPart):
            continue
        if isinstance(part, UITextPart | UIReasoningPart):
            if part.text:
                return True
            continue
        return True
    return False


def _get_dummy_request_data(*, tool_call_id: str, task: str) -> PydanticAISubmitMessage:
    """Build placeholder request data required by the Vercel event stream."""
    return PydanticAISubmitMessage(
        id=f"subagent-{tool_call_id}",
        messages=[
            PydanticAIUIMessage(
                id=f"subagent-task-{tool_call_id}",
                role="user",
                parts=[PydanticAITextUIPart(text=task)],
            )
        ],
    )


def _get_fallback_subagent_summary(message: UIMessage) -> str:
    """Use streamed text, or a data-error message, when the final result is unavailable."""
    text = "".join(part.text for part in message.parts if isinstance(part, UITextPart)).strip()
    if text:
        return text
    for part in message.parts:
        if (
            isinstance(part, UIDataPart)
            and part.type == "data-error"
            and isinstance(part.data, dict)
        ):
            error_text = part.data.get("errorText")
            if isinstance(error_text, str):
                return error_text
    return ""
