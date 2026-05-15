from __future__ import annotations

import pytest
from pydantic_ai.messages import ToolCallPart
from pydantic_ai.ui.vercel_ai.request_types import SubmitMessage
from pydantic_ai.ui.vercel_ai.response_types import (
    ToolInputAvailableChunk,
    ToolInputStartChunk,
)

from phoenix.server.agents.pydantic_ai.vercel_ai_adapter import (
    PHOENIX_PROVIDER_METADATA_KEY,
    PhoenixToolCallProviderMetadata,
    PhoenixVercelAIEventStream,
)


def _make_event_stream() -> PhoenixVercelAIEventStream:
    run_input = SubmitMessage(id="chat-1", messages=[])
    return PhoenixVercelAIEventStream(run_input=run_input)


@pytest.mark.parametrize(
    "tool_name,expected_environment",
    [
        ("bash", "client"),
        ("ask_user", "client"),
        ("set_time_range", "client"),
        ("search_docs", "server"),
        ("unknown_tool", "server"),
    ],
)
async def test_tool_input_start_chunk_carries_tool_execution_environment(
    tool_name: str, expected_environment: str
) -> None:
    event_stream = _make_event_stream()
    part = ToolCallPart(tool_name=tool_name, tool_call_id="call-1", args={})

    chunks = [chunk async for chunk in event_stream._handle_tool_call_start(part)]

    start_chunks = [chunk for chunk in chunks if isinstance(chunk, ToolInputStartChunk)]
    assert len(start_chunks) == 1
    phoenix_metadata = (start_chunks[0].provider_metadata or {}).get(PHOENIX_PROVIDER_METADATA_KEY)
    assert phoenix_metadata is not None
    parsed = PhoenixToolCallProviderMetadata.model_validate(phoenix_metadata)
    assert parsed.tool_execution_environment == expected_environment


@pytest.mark.parametrize(
    "tool_name,expected_environment",
    [
        ("bash", "client"),
        ("search_docs", "server"),
    ],
)
async def test_tool_input_available_chunk_carries_tool_execution_environment(
    tool_name: str, expected_environment: str
) -> None:
    event_stream = _make_event_stream()
    part = ToolCallPart(tool_name=tool_name, tool_call_id="call-1", args={"q": "hi"})

    chunks = [chunk async for chunk in event_stream.handle_tool_call_end(part)]

    available_chunks = [chunk for chunk in chunks if isinstance(chunk, ToolInputAvailableChunk)]
    assert len(available_chunks) == 1
    phoenix_metadata = (available_chunks[0].provider_metadata or {}).get(
        PHOENIX_PROVIDER_METADATA_KEY
    )
    assert phoenix_metadata is not None
    parsed = PhoenixToolCallProviderMetadata.model_validate(phoenix_metadata)
    assert parsed.tool_execution_environment == expected_environment


async def test_existing_pydantic_ai_provider_metadata_is_preserved() -> None:
    """The pydantic-ai-stamped `pydantic_ai` namespace must coexist with `phoenix`."""
    event_stream = _make_event_stream()
    part = ToolCallPart(
        tool_name="bash",
        tool_call_id="call-1",
        args={},
        id="provider-id-123",
        provider_name="anthropic",
    )

    chunks = [chunk async for chunk in event_stream._handle_tool_call_start(part)]

    start_chunk = next(chunk for chunk in chunks if isinstance(chunk, ToolInputStartChunk))
    provider_metadata = start_chunk.provider_metadata or {}
    assert provider_metadata.get("pydantic_ai") == {
        "id": "provider-id-123",
        "provider_name": "anthropic",
    }
    assert (
        PhoenixToolCallProviderMetadata.model_validate(
            provider_metadata[PHOENIX_PROVIDER_METADATA_KEY]
        ).tool_execution_environment
        == "client"
    )
