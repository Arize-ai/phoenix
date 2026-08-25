from __future__ import annotations

import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk

from phoenix.db.types.data_stream_protocol import UIMessage
from phoenix.server.agents.vercel_ui_message_stream import (
    UIMessageStreamError,
    read_ui_message_stream,
)

_FIXTURES_PATH = Path(__file__).parent / "fixtures" / "ui_message_stream" / "fixtures.json"

UNSUPPORTED_BY_PYDANTIC_AI = {
    "processUIMessageStream > file parts with providerMetadata": (
        "pydantic-ai FileChunk does not model providerMetadata"
    ),
    (
        "processUIMessageStream > provider-executed static tools > "
        "should preserve separate call and result provider metadata for static tools"
    ): "pydantic-ai ToolOutputAvailableChunk does not model providerMetadata",
    (
        "processUIMessageStream > provider-executed dynamic tools > "
        "should preserve separate call and result provider metadata for dynamic tools"
    ): "pydantic-ai ToolOutputErrorChunk does not model providerMetadata",
    (
        "processUIMessageStream > provider-executed dynamic tools > "
        "should preserve tool metadata on dynamic tool parts"
    ): "pydantic-ai tool chunks do not model toolMetadata",
    "processUIMessageStream > tool title support > static tool with title": (
        "pydantic-ai tool chunks do not model title"
    ),
    "processUIMessageStream > tool title support > dynamic tool with title": (
        "pydantic-ai tool chunks do not model title"
    ),
    "processUIMessageStream > tool title support > tool with title in error state": (
        "pydantic-ai tool chunks do not model title"
    ),
    "processUIMessageStream > custom": (
        "pydantic-ai does not model AI SDK v7 custom chunks or parts"
    ),
    # pydantic-ai models the reasoning id on ``ReasoningStartChunk`` but not on the
    # ``ReasoningUIPart`` it materializes, so Phoenix reads the id to correlate the block's
    # deltas and then has nowhere upstream-compatible to persist it. Carrying it locally
    # would fork the vendored part from upstream; these two fixtures are skipped instead.
    "processUIMessageStream > reasoning": "pydantic-ai ReasoningUIPart does not model id",
    "processUIMessageStream > server-side tool roundtrip with multiple assistant reasoning": (
        "pydantic-ai ReasoningUIPart does not model id"
    ),
    # ``reset-step`` arrived with ai@7.0.77. pydantic-ai models ``start-step`` and
    # ``finish-step`` but has no chunk for it, so Phoenix cannot parse the fixture at all.
    (
        "processUIMessageStream > reset-step > "
        "removes parts from the current step and accepts retried parts"
    ): "pydantic-ai does not model reset-step chunks",
}

UNSUPPORTED_APPROVAL_CHUNKS = {
    "processUIMessageStream > tool approval request with signature": (
        "pydantic-ai ToolApprovalRequestChunk does not model signature"
    ),
    "processUIMessageStream > tool approval response with signature": (
        "pydantic-ai does not model tool-approval-response chunks"
    ),
    (
        "processUIMessageStream > automatic tool approval denial (static tool)"
    ): "pydantic-ai does not model automatic approval fields or response chunks",
    "processUIMessageStream > automatic tool approval with execution (dynamic tool)": (
        "pydantic-ai does not model automatic approval fields or response chunks"
    ),
}

_FIXTURES: list[dict[str, Any]] = json.loads(_FIXTURES_PATH.read_text())
_CHUNK_TYPES = {
    chunk_type_field.default: chunk_class
    for chunk_class in BaseChunk.__subclasses__()
    if (chunk_type_field := chunk_class.model_fields.get("type")) is not None
    and isinstance(chunk_type_field.default, str)
}


def _parse_chunk(data: dict[str, Any]) -> BaseChunk:
    chunk_type = data["type"]
    chunk_class = DataChunk if chunk_type.startswith("data-") else _CHUNK_TYPES[chunk_type]
    return chunk_class.model_validate(data)


async def _iter_chunks(chunks: list[dict[str, Any]]) -> AsyncIterator[BaseChunk]:
    for chunk in chunks:
        yield _parse_chunk(chunk)


@pytest.mark.parametrize("fixture", _FIXTURES, ids=lambda fixture: fixture["name"])
async def test_matches_ai_sdk_write_sequence(fixture: dict[str, Any]) -> None:
    name = fixture["name"]
    if reason := UNSUPPORTED_BY_PYDANTIC_AI.get(name):
        pytest.skip(reason)
    if reason := UNSUPPORTED_APPROVAL_CHUNKS.get(name):
        pytest.skip(reason)

    fixture_input = fixture["input"]
    last_message = fixture_input["lastMessage"]
    message = (
        UIMessage.model_validate(last_message)
        if last_message is not None
        else UIMessage(
            id=fixture_input["messageId"],
            role="user",
            parts=[],
        )
    )
    writes: list[dict[str, Any]] = []
    stream_error: UIMessageStreamError | None = None
    try:
        async for snapshot in read_ui_message_stream(
            stream=_iter_chunks(fixture_input["chunks"]),
            message=message,
            terminate_on_error=fixture.get("throws") is not None,
        ):
            writes.append(
                snapshot.model_dump(
                    mode="json",
                    by_alias=True,
                    exclude_none=True,
                )
            )
    except UIMessageStreamError as error:
        stream_error = error

    assert writes == fixture["writes"]
    expected_error = fixture.get("throws")
    if expected_error is None:
        assert stream_error is None
    else:
        assert stream_error is not None
        assert stream_error.chunk_type == expected_error["chunkType"]
        assert stream_error.chunk_id == expected_error["chunkId"]


def test_unsupported_case_list_is_explicit_and_current() -> None:
    fixture_names = {fixture["name"] for fixture in _FIXTURES}
    unsupported_names = set(UNSUPPORTED_BY_PYDANTIC_AI) | set(UNSUPPORTED_APPROVAL_CHUNKS)

    assert len(UNSUPPORTED_BY_PYDANTIC_AI) == 11
    assert len(UNSUPPORTED_APPROVAL_CHUNKS) == 4
    assert unsupported_names <= fixture_names


def test_every_pydantic_ai_chunk_type_has_a_fixture() -> None:
    fixture_chunk_types = {
        chunk["type"] for fixture in _FIXTURES for chunk in fixture["input"]["chunks"]
    }

    assert set(_CHUNK_TYPES) <= fixture_chunk_types


def test_every_phoenix_data_chunk_type_has_a_fixture() -> None:
    from phoenix.server.agents.ui_message_stream import AgentErrorChunk
    from phoenix.server.api.routers.agents import (
        SessionSummaryChunk,
        TranscriptPersistedChunk,
    )

    fixture_chunk_types = {
        chunk["type"] for fixture in _FIXTURES for chunk in fixture["input"]["chunks"]
    }
    phoenix_chunk_types = {
        chunk_class.model_fields["type"].default
        for chunk_class in (
            AgentErrorChunk,
            SessionSummaryChunk,
            TranscriptPersistedChunk,
        )
    }

    assert phoenix_chunk_types <= fixture_chunk_types
