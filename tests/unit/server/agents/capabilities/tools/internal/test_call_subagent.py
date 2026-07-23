from __future__ import annotations

import pytest
from pydantic_ai import Agent, RunContext, RunUsage
from pydantic_ai.models.test import TestModel
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.db.types.data_stream_protocol import UITextPart
from phoenix.server.agents.capabilities.tools.internal.call_subagent import (
    CallSubagentOutput,
    CallSubAgentToolset,
)
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.types import AgentDependencies


def _run_context(tool_call_id: str | None) -> RunContext[AgentDependencies]:
    return RunContext(
        deps=AgentDependencies(contexts=ResolvedContexts()),
        model=TestModel(),
        usage=RunUsage(),
        tool_call_id=tool_call_id,
    )


async def _call_subagent_tool(
    *,
    toolset: CallSubAgentToolset[AgentDependencies],
    ctx: RunContext[AgentDependencies],
) -> str:
    tools = await toolset.get_tools(ctx)
    result = await toolset.call_tool(
        "call_subagent",
        {"name": "Phoenix data", "task": "Summarize latency"},
        ctx,
        tools["call_subagent"],
    )
    assert isinstance(result, str)
    return result


class TestCallSubAgentToolset:
    async def test_publishes_progress_sets_final_output_and_returns_summary(self) -> None:
        published_chunks: list[ToolOutputAvailableChunk] = []
        final_chunks: list[ToolOutputAvailableChunk] = []

        async def publish_subagent_message_chunk(chunk: ToolOutputAvailableChunk) -> None:
            published_chunks.append(chunk)

        def set_subagent_final_tool_output(chunk: ToolOutputAvailableChunk) -> None:
            final_chunks.append(chunk)

        toolset = CallSubAgentToolset[AgentDependencies](
            server_agent=Agent(TestModel(custom_output_text="subagent summary")),
            publish_subagent_message_chunk=publish_subagent_message_chunk,
            set_subagent_final_tool_output=set_subagent_final_tool_output,
        )

        result = await _call_subagent_tool(
            toolset=toolset,
            ctx=_run_context(tool_call_id="parent-tool-call-1"),
        )

        assert result == "subagent summary"
        assert published_chunks
        assert all(chunk.tool_call_id == "parent-tool-call-1" for chunk in published_chunks)
        assert all(chunk.preliminary is True for chunk in published_chunks)
        assert len(final_chunks) == 1
        [final_chunk] = final_chunks
        assert final_chunk.tool_call_id == "parent-tool-call-1"
        assert final_chunk.preliminary is None
        assert isinstance(final_chunk.output, CallSubagentOutput)
        assert final_chunk.output.summary == "subagent summary"
        message = final_chunk.output.message
        assert message.role == "assistant"
        assert any(
            isinstance(part, UITextPart) and part.text == "subagent summary"
            for part in message.parts
        )
        dumped_chunk = final_chunk.model_dump(by_alias=True, exclude_none=True)
        assert dumped_chunk["output"]["summary"] == "subagent summary"
        assert dumped_chunk["output"]["message"]["role"] == "assistant"

    async def test_errors_clearly_when_tool_call_id_is_missing(self) -> None:
        published_chunks: list[ToolOutputAvailableChunk] = []
        final_chunks: list[ToolOutputAvailableChunk] = []

        async def publish_subagent_message_chunk(chunk: ToolOutputAvailableChunk) -> None:
            published_chunks.append(chunk)

        def set_subagent_final_tool_output(chunk: ToolOutputAvailableChunk) -> None:
            final_chunks.append(chunk)

        toolset = CallSubAgentToolset[AgentDependencies](
            server_agent=Agent(TestModel(custom_output_text="subagent summary")),
            publish_subagent_message_chunk=publish_subagent_message_chunk,
            set_subagent_final_tool_output=set_subagent_final_tool_output,
        )

        with pytest.raises(RuntimeError, match="without a tool_call_id"):
            await _call_subagent_tool(
                toolset=toolset,
                ctx=_run_context(tool_call_id=None),
            )
        assert published_chunks == []
        assert final_chunks == []
