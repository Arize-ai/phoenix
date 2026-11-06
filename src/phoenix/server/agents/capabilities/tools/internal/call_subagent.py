from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from pydantic import BaseModel
from pydantic_ai import AgentRunResult, RunContext, Tool
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.capabilities import AbstractCapability
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
    DataUIPart,
    ReasoningUIPart,
    StepStartUIPart,
    TextUIPart,
    UIMessage,
)
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.agents.ui_message_stream import iter_chunks_with_error_parts
from phoenix.server.agents.vercel_ui_message_stream import read_ui_message_stream

CALL_SUBAGENT_TOOL_DESCRIPTION = """\
Delegate a task to a Phoenix subagent. Use for any self-contained task when you wish to preserve your own context.
The subagent does that work in its own context and returns only the answer you need.
Pass `task`, a single self-contained natural-language description of exactly what you need, along with `name`, a short human-readable name for the subagent. The subagent has no access to your context, so the task must be entirely self-contained and fully specified: explicitly pass along IDs, time ranges, and any other details rather than assuming they will be visible to the subagent.
"""


class CallSubagentOutput(BaseModel):
    summary: str
    message: UIMessage


class CallSubagentOutputChunk(ToolOutputAvailableChunk):
    output: CallSubagentOutput


async def _async_no_op(_: ToolOutputAvailableChunk) -> None:
    return None


def _no_op(_: ToolOutputAvailableChunk) -> None:
    return None


class CallSubAgentToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the main agent's ``call_subagent`` delegation tool.

    The tool delegates a natural-language task to the subagent and
    returns its answer, forwarding ``usage`` so token accounting aggregates into the
    parent run (the pydantic-ai agent-delegation pattern).
    """

    def __init__(
        self,
        *,
        subagent: AbstractAgent[AgentDependencies, AgentOutput],
        publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]]
        | None = None,
        set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None,
    ) -> None:
        publish_message_chunk = publish_subagent_message_chunk or _async_no_op
        set_final_tool_output = set_subagent_final_tool_output or _no_op

        async def call_subagent(ctx: RunContext[AgentDependencies], name: str, task: str) -> str:
            tool_call_id = ctx.tool_call_id
            if tool_call_id is None:
                raise RuntimeError(
                    "Internal error: call_subagent was invoked without a tool_call_id."
                )

            final_summary: str | None = None
            latest_message: UIMessage | None = None

            async def _on_complete(result: AgentRunResult[AgentOutput]) -> None:
                nonlocal final_summary
                assert isinstance(result.output, str), (
                    "headless subagents cannot return deferred tool requests"
                )
                final_summary = result.output

            event_stream = VercelAIEventStream(
                run_input=_get_dummy_request_data(tool_call_id=tool_call_id, task=task),
                sdk_version=7,
            )
            async with subagent.run_stream_events(
                task,
                deps=ctx.deps,
                usage=ctx.usage,
            ) as stream:
                chunks = event_stream.transform_stream(stream, on_complete=_on_complete)
                async for message in read_ui_message_stream(
                    stream=iter_chunks_with_error_parts(chunks)
                ):
                    latest_message = message
                    if not _has_renderable_ui_message_parts(message):
                        continue
                    await publish_message_chunk(
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
            set_final_tool_output(
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
class CallSubAgentCapability(AbstractCapability[AgentDependencies]):
    """Capability that adds the `call_subagent` tool to an agent."""

    subagent: AbstractAgent[AgentDependencies, AgentOutput]
    publish_subagent_message_chunk: Callable[[ToolOutputAvailableChunk], Awaitable[None]] | None = (
        None
    )
    set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return CallSubAgentToolset(
            subagent=self.subagent,
            publish_subagent_message_chunk=self.publish_subagent_message_chunk,
            set_subagent_final_tool_output=self.set_subagent_final_tool_output,
        )


def _has_renderable_ui_message_parts(message: UIMessage) -> bool:
    """Return whether a UI message has content worth publishing as progress."""
    for part in message.parts:
        if isinstance(part, StepStartUIPart):
            continue
        if isinstance(part, TextUIPart | ReasoningUIPart):
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
    text = "".join(part.text for part in message.parts if isinstance(part, TextUIPart)).strip()
    if text:
        return text
    for part in message.parts:
        if (
            isinstance(part, DataUIPart)
            and part.type == "data-error"
            and isinstance(part.data, dict)
        ):
            error_text = part.data.get("errorText")
            if isinstance(error_text, str):
                return error_text
    return ""
