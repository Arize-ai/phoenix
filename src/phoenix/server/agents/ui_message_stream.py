"""Phoenix-specific adapters for Vercel UI-message streams."""

from collections.abc import AsyncIterator
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk, ErrorChunk


class _CamelBaseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AgentErrorData(_CamelBaseModel):
    error_text: str


class AgentErrorChunk(DataChunk):
    """Durable data part paired with a standard protocol error chunk."""

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
