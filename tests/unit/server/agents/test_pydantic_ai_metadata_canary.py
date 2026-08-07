"""Drift canaries for the ``pydantic_ai`` provider-metadata namespace.

The namespace is pydantic-ai's round-trip channel for ``ModelMessage`` data the
Vercel part shapes can't express (thinking signatures, interrupted tool
outcomes, tool-kind claims, provider part ids). Its keys are an unversioned
wire convention of the installed pydantic-ai release, and persisted rows
outlive the release that wrote them — so these tests pin both sides of the
contract against the installed package:

- the write side streams real parts through the installed ``VercelAIEventStream``
  and asserts the persisted result still matches the golden fixture;
- the read side loads the golden fixture — rows exactly as written today —
  through the installed ``load_messages`` and asserts every metadata-borne
  field is restored.

A pydantic-ai bump that renames, adds, or drops a key fails here, in the bump
PR, instead of silently corrupting session replays in production. When a test
fails at a bump: update the typed models in
``phoenix.db.types.data_stream_protocol.provider_metadata``, regenerate the
fixture with the new writer, and — because old rows still carry the previous
dialect — add a load-time compat shim for any renamed key before shipping.
"""

import json
from collections.abc import AsyncIterator, Sequence
from pathlib import Path
from typing import Any, get_args

from pydantic_ai.messages import (
    FunctionToolResultEvent,
    ModelMessage,
    NativeToolCallPart,
    NativeToolReturnPart,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolPartKind,
    ToolReturnPart,
    ToolSearchCallPart,
    ToolSearchReturnPart,
)
from pydantic_ai.ui.vercel_ai import VercelAIEventStream
from pydantic_ai.ui.vercel_ai.request_types import SubmitMessage
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk

from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    PydanticAIToolPartKind,
)
from phoenix.server.agents.vercel_ui_message_stream import read_ui_message_stream
from phoenix.server.api.routers.agents import (
    _resolve_interrupted_tool_parts,
    _to_pydantic_ai_messages,
)

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "pydantic_ai_provider_metadata.json"


def test_tool_kind_vocabulary_matches_installed_pydantic_ai() -> None:
    """Phoenix pins the ``tool_kind`` vocabulary locally so persisted rows
    validate without importing pydantic-ai; hold the pin to the installed
    package's ``ToolPartKind``."""
    assert set(get_args(PydanticAIToolPartKind)) == set(get_args(ToolPartKind))


_THINKING = ThinkingPart(
    content="I should search the web and the toolbox.",
    id="think_1",
    signature="c2lnbmF0dXJl",
    provider_name="anthropic",
    provider_details={"cache_hint": "ephemeral"},
)
_TEXT = TextPart(
    content="Here is what I found.",
    id="txt_1",
    provider_name="anthropic",
    provider_details={"stop_reason": "end_turn"},
)
_NATIVE_CALL = NativeToolCallPart(
    tool_name="web_search",
    args={"query": "phoenix observability"},
    tool_call_id="srvtoolu_1",
    id="srvtoolu_1",
    provider_name="anthropic",
)
_NATIVE_RETURN = NativeToolReturnPart(
    tool_name="web_search",
    content={"results": []},
    tool_call_id="srvtoolu_1",
    provider_name="anthropic",
)
_SEARCH_CALL = ToolSearchCallPart(
    args={"queries": ["dataset tools"]},
    tool_call_id="toolu_search",
    id="toolu_search",
    provider_name="anthropic",
)
_SEARCH_RETURN = ToolSearchReturnPart(
    content={"discovered_tools": []},
    tool_call_id="toolu_search",
)
_FUNCTION_CALL = ToolCallPart(
    tool_name="run_project_query",
    args={"project": "default"},
    tool_call_id="toolu_1",
    id="toolu_1",
    provider_name="anthropic",
)
_FUNCTION_RETURN = ToolReturnPart(
    tool_name="run_project_query",
    content={"rows": 3},
    tool_call_id="toolu_1",
)
_UNRESOLVED_CALL = ToolCallPart(
    tool_name="run_project_query",
    args={"project": "slow"},
    tool_call_id="toolu_2",
    id="toolu_2",
    provider_name="anthropic",
)


async def _write_pipeline_message() -> PhoenixUIMessage:
    """Persist a turn the way production does: installed event stream ->
    Phoenix reducer -> strict validation -> interrupted-tool repair.

    The final tool call is deliberately left unresolved so the repair path
    (and its ``outcome: 'interrupted'`` claim) is exercised.
    """
    event_stream = VercelAIEventStream(run_input=SubmitMessage(id="run", messages=[]))

    async def collect(chunk_iterator: AsyncIterator[BaseChunk]) -> list[BaseChunk]:
        return [chunk async for chunk in chunk_iterator]

    chunks: list[BaseChunk] = []
    chunks += await collect(event_stream.handle_thinking_start(_THINKING))
    chunks += await collect(event_stream.handle_thinking_end(_THINKING))
    chunks += await collect(event_stream.handle_builtin_tool_call_start(_NATIVE_CALL))
    chunks += await collect(event_stream.handle_builtin_tool_call_end(_NATIVE_CALL))
    chunks += await collect(event_stream.handle_builtin_tool_return(_NATIVE_RETURN))
    chunks += await collect(event_stream.handle_tool_call_start(_SEARCH_CALL))
    chunks += await collect(event_stream.handle_tool_call_end(_SEARCH_CALL))
    chunks += await collect(
        event_stream.handle_function_tool_result(FunctionToolResultEvent(_SEARCH_RETURN))
    )
    chunks += await collect(event_stream.handle_tool_call_start(_FUNCTION_CALL))
    chunks += await collect(event_stream.handle_tool_call_end(_FUNCTION_CALL))
    chunks += await collect(
        event_stream.handle_function_tool_result(FunctionToolResultEvent(_FUNCTION_RETURN))
    )
    chunks += await collect(event_stream.handle_text_start(_TEXT))
    chunks += await collect(event_stream.handle_text_end(_TEXT))
    chunks += await collect(event_stream.handle_tool_call_start(_UNRESOLVED_CALL))

    async def stream() -> AsyncIterator[BaseChunk]:
        for chunk in chunks:
            yield chunk

    reduced = None
    async for snapshot in read_ui_message_stream(stream=stream()):
        reduced = snapshot
    assert reduced is not None
    dumped = reduced.model_dump(mode="json", by_alias=True, exclude_unset=True)
    dumped["id"] = "assistant-1"
    message = PhoenixUIMessage.model_validate(dumped)
    repaired = _resolve_interrupted_tool_parts(message)
    assert repaired is not None, "the unresolved tool call should trigger repair"
    return repaired


def _fixture_messages() -> list[dict[str, Any]]:
    messages = json.loads(_FIXTURE_PATH.read_text())
    assert isinstance(messages, list)
    return messages


async def test_write_pipeline_still_produces_the_golden_dialect() -> None:
    """Write-side canary: if the installed event stream starts stamping
    different keys (rename, addition, removal), the persisted shape diverges
    from the fixture and this fails at the dependency bump."""
    persisted = await _write_pipeline_message()
    assert (
        persisted.model_dump(mode="json", by_alias=True, exclude_none=True)
        == _fixture_messages()[1]
    )


def test_golden_fixture_loads_with_full_fidelity() -> None:
    """Read-side canary: rows written with today's dialect must keep restoring
    every metadata-borne field through the installed ``load_messages``, even
    after the writer moves on — persisted rows outlive the release that wrote
    them."""
    messages = [PhoenixUIMessage.model_validate(message) for message in _fixture_messages()]
    _assert_full_fidelity(_to_pydantic_ai_messages(messages))


def _assert_full_fidelity(loaded: Sequence[ModelMessage]) -> None:
    parts = [part for message in loaded for part in message.parts]

    thinking = next(part for part in parts if isinstance(part, ThinkingPart))
    assert thinking.signature == "c2lnbmF0dXJl"
    assert thinking.provider_name == "anthropic"
    assert thinking.id == "think_1"
    assert thinking.provider_details == {"cache_hint": "ephemeral"}

    text = next(part for part in parts if isinstance(part, TextPart))
    assert text.id == "txt_1"
    assert text.provider_name == "anthropic"
    assert text.provider_details == {"stop_reason": "end_turn"}

    native_call = next(part for part in parts if isinstance(part, NativeToolCallPart))
    assert native_call.tool_call_id == "srvtoolu_1"
    assert native_call.provider_name == "anthropic"
    assert native_call.id == "srvtoolu_1"
    native_return = next(part for part in parts if isinstance(part, NativeToolReturnPart))
    assert native_return.outcome == "success"
    assert native_return.provider_name == "anthropic"

    search_call = next(part for part in parts if isinstance(part, ToolSearchCallPart))
    assert search_call.tool_kind == "tool-search"
    search_return = next(part for part in parts if isinstance(part, ToolSearchReturnPart))
    assert search_return.tool_kind == "tool-search"
    assert search_return.outcome == "success"

    tool_returns = {
        part.tool_call_id: part
        for part in parts
        if isinstance(part, ToolReturnPart) and not isinstance(part, ToolSearchReturnPart)
    }
    assert tool_returns["toolu_1"].outcome == "success"
    assert tool_returns["toolu_2"].outcome == "interrupted"
