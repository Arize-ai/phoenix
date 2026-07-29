"""Phoenix-specific adapters for Vercel UI-message streams.

This module exists to keep Phoenix's protocol extensions out of
``vercel_ui_message_stream``, which is a faithful port of the AI SDK reducer
pinned by conformance fixtures and must not accumulate Phoenix behavior.
Extensions to the standard chunk stream live here instead.
"""

from collections.abc import AsyncIterator
from typing import Literal

from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk, ErrorChunk

from phoenix.db.types.data_stream_protocol import AgentErrorData


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

