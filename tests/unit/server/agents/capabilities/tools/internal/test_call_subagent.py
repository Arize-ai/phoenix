from __future__ import annotations

import pytest
from pydantic_ai import Agent, DeferredToolRequests, RunContext, RunUsage
from pydantic_ai.models.test import TestModel
from pydantic_ai.ui.vercel_ai.response_types import ToolOutputAvailableChunk

from phoenix.db.types.data_stream_protocol import TextUIPart
from phoenix.server.agents.capabilities.tools.internal.call_subagent import (
    CALL_SUBAGENT_TASK_CONTRACT,
    CallSubagentOutput,
    CallSubAgentToolset,
)
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.types import AgentDependencies, AgentOutput


def _run_context(tool_call_id: str | None) -> RunContext[AgentDependencies]:
    return RunContext(
        deps=AgentDependencies(contexts=ResolvedContexts()),
        model=TestModel(),
        usage=RunUsage(),
        tool_call_id=tool_call_id,
    )


async def _call_subagent_tool(
    *,
    toolset: CallSubAgentToolset,
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


def _subagent(*, output: str = "subagent summary") -> Agent[AgentDependencies, AgentOutput]:
    return Agent(
        TestModel(custom_output_text=output),
        deps_type=AgentDependencies,
        output_type=[str, DeferredToolRequests],
    )


class TestCallSubAgentToolset:
    async def test_publishes_progress_sets_final_output_and_returns_summary(self) -> None:
        published_chunks: list[ToolOutputAvailableChunk] = []
        final_chunks: list[ToolOutputAvailableChunk] = []

        async def publish_subagent_message_chunk(chunk: ToolOutputAvailableChunk) -> None:
            published_chunks.append(chunk)

        def set_subagent_final_tool_output(chunk: ToolOutputAvailableChunk) -> None:
            final_chunks.append(chunk)

        toolset = CallSubAgentToolset(
            subagent=_subagent(),
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
            isinstance(part, TextUIPart) and part.text == "subagent summary"
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

        toolset = CallSubAgentToolset(
            subagent=_subagent(),
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

    async def test_prefixes_the_task_with_the_return_value_contract(self) -> None:
        seen_prompts: list[object] = []

        def capture_prompt(ctx: RunContext[AgentDependencies]) -> str:
            seen_prompts.append(ctx.prompt)
            return ""

        subagent: Agent[AgentDependencies, AgentOutput] = Agent(
            TestModel(custom_output_text="subagent summary"),
            deps_type=AgentDependencies,
            output_type=[str, DeferredToolRequests],
            instructions=capture_prompt,
        )
        toolset = CallSubAgentToolset(subagent=subagent)

        await _call_subagent_tool(
            toolset=toolset,
            ctx=_run_context(tool_call_id="parent-tool-call-1"),
        )

        assert seen_prompts == [f"{CALL_SUBAGENT_TASK_CONTRACT}\nSummarize latency"]

    async def test_passes_parent_dependencies_to_the_subagent(self) -> None:
        seen_dependencies: list[AgentDependencies] = []

        def capture_dependencies(ctx: RunContext[AgentDependencies]) -> str:
            seen_dependencies.append(ctx.deps)
            return ""

        subagent: Agent[AgentDependencies, AgentOutput] = Agent(
            TestModel(custom_output_text="subagent summary"),
            deps_type=AgentDependencies,
            output_type=[str, DeferredToolRequests],
            instructions=capture_dependencies,
        )
        toolset = CallSubAgentToolset(subagent=subagent)
        ctx = _run_context(tool_call_id="parent-tool-call-1")

        await _call_subagent_tool(toolset=toolset, ctx=ctx)

        assert seen_dependencies == [ctx.deps]
