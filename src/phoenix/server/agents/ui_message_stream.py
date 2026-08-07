"""Phoenix-specific adapters for Vercel UI-message streams.

This module exists to keep Phoenix's protocol extensions out of
``vercel_ui_message_stream``, which is a faithful port of the AI SDK reducer
pinned by conformance fixtures and must not accumulate Phoenix behavior.
Extensions to the standard chunk stream live here instead.
"""

from collections.abc import AsyncIterator
from typing import Literal

from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk, ErrorChunk

from phoenix.db.types.data_stream_protocol import (
    AgentErrorData,
    StepStartUIPart,
    UIMessagePart,
)
from phoenix.server.agents.vercel_ui_message_stream import StreamingUIMessageState


class AgentErrorChunk(DataChunk):
    """Durable data part paired with a standard protocol ``error`` chunk.

    Standard ``error`` chunks are transient: the reducer routes them to error
    callbacks without adding a message part, so they vanish from persisted
    transcripts. Pairing each one with this ``data-error`` part records the
    error durably in the message for persistence, reload, and subagents.
    """

    type: Literal["data-error"] = "data-error"
    data: AgentErrorData


async def iter_chunks_with_error_parts(
    chunks: AsyncIterator[BaseChunk],
) -> AsyncIterator[BaseChunk]:
    """Pair standard error chunks with durable Phoenix ``data-error`` parts."""
    async for chunk in chunks:
        if isinstance(chunk, ErrorChunk):
            yield AgentErrorChunk(data=AgentErrorData(error_text=chunk.error_text))
        yield chunk


def finalize_interrupted_ui_message_state(state: StreamingUIMessageState) -> None:
    """Close out in-flight parts after the chunk stream is interrupted mid-turn."""
    message = state.message
    dropped_parts: list[UIMessagePart] = []
    for text_part in state.active_text_parts.values():
        if text_part.text:
            text_part.state = "done"
        else:
            dropped_parts.append(text_part)
    for reasoning_part in state.active_reasoning_parts.values():
        if reasoning_part.text:
            reasoning_part.state = "done"
        else:
            dropped_parts.append(reasoning_part)
    if dropped_parts:
        dropped_ids = {id(part) for part in dropped_parts}
        message.parts = [part for part in message.parts if id(part) not in dropped_ids]
    while message.parts:
        trailing_part = message.parts[-1]
        if not isinstance(trailing_part, StepStartUIPart):
            break
        message.parts.pop()
    state.active_text_parts.clear()
    state.active_reasoning_parts.clear()
    state.partial_tool_calls.clear()
