from __future__ import annotations

import asyncio
import contextvars
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator
from uuid import uuid4

from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    DataChunk,
    ErrorChunk,
    FileChunk,
    FinishChunk,
    FinishStepChunk,
    MessageMetadataChunk,
    ReasoningDeltaChunk,
    ReasoningEndChunk,
    ReasoningStartChunk,
    SourceDocumentChunk,
    SourceUrlChunk,
    StartChunk,
    StartStepChunk,
    TextDeltaChunk,
    TextEndChunk,
    TextStartChunk,
    ToolInputAvailableChunk,
    ToolInputDeltaChunk,
    ToolInputErrorChunk,
    ToolInputStartChunk,
    ToolOutputAvailableChunk,
    ToolOutputDeniedChunk,
    ToolOutputErrorChunk,
)
from pydantic_core import to_jsonable_python

_SUBAGENT_PROGRESS_EMITTER: contextvars.ContextVar[SubagentProgressEmitter | None] = (
    contextvars.ContextVar("phoenix_subagent_progress_emitter", default=None)
)
_MISSING = object()


@dataclass
class SubagentProgressEmitter:
    """Per-request side channel for Vercel tool-output progress chunks."""

    _queue: asyncio.Queue[BaseChunk] = field(default_factory=asyncio.Queue)
    _final_outputs_by_tool_call_id: dict[str, Any] = field(default_factory=dict)

    async def emit(self, chunk: BaseChunk) -> None:
        await self._queue.put(chunk)

    async def get(self) -> BaseChunk:
        return await self._queue.get()

    def get_nowait(self) -> BaseChunk:
        return self._queue.get_nowait()

    def empty(self) -> bool:
        return self._queue.empty()

    def set_final_output(self, *, tool_call_id: str, output: Any) -> None:
        self._final_outputs_by_tool_call_id[tool_call_id] = output

    def get_final_output(self, *, tool_call_id: str) -> Any:
        return self._final_outputs_by_tool_call_id.get(tool_call_id, _MISSING)


@contextmanager
def bind_subagent_progress_emitter(emitter: SubagentProgressEmitter) -> Iterator[None]:
    token = _SUBAGENT_PROGRESS_EMITTER.set(emitter)
    try:
        yield
    finally:
        _SUBAGENT_PROGRESS_EMITTER.reset(token)


def get_subagent_progress_emitter() -> SubagentProgressEmitter | None:
    return _SUBAGENT_PROGRESS_EMITTER.get()


@dataclass
class SubagentUIMessageAccumulator:
    """Build an accumulated UIMessage from Vercel stream chunks."""

    message_id: str = field(default_factory=lambda: str(uuid4()))
    metadata: Any | None = None
    error_text: str | None = None
    _parts: list[dict[str, Any]] = field(default_factory=list)
    _text_part_indexes: dict[str, int] = field(default_factory=dict)
    _reasoning_part_indexes: dict[str, int] = field(default_factory=dict)
    _tool_part_indexes: dict[str, int] = field(default_factory=dict)

    def has_visible_parts(self) -> bool:
        return any(part.get("type") != "step-start" for part in self._parts)

    def summary_text(self) -> str:
        return "".join(
            part.get("text", "")
            for part in self._parts
            if part.get("type") == "text" and isinstance(part.get("text"), str)
        )

    def output(self, *, summary: str | None = None) -> dict[str, Any]:
        message: dict[str, Any] = {
            "id": self.message_id,
            "role": "assistant",
            "parts": to_jsonable_python(self._parts),
        }
        if self.metadata is not None:
            message["metadata"] = to_jsonable_python(self.metadata)
        return {
            "summary": summary if summary is not None else self.summary_text(),
            "message": message,
        }

    def ingest(self, chunk: BaseChunk) -> bool:  # noqa: C901
        if isinstance(chunk, StartChunk):
            if chunk.message_id:
                self.message_id = chunk.message_id
            if chunk.message_metadata is not None:
                self.metadata = chunk.message_metadata
            return False
        if isinstance(chunk, StartStepChunk):
            self._parts.append({"type": "step-start"})
            return True
        if isinstance(chunk, FinishStepChunk | FinishChunk):
            return False
        if isinstance(chunk, MessageMetadataChunk):
            self.metadata = chunk.message_metadata
            return True
        if isinstance(chunk, TextStartChunk):
            part = self._append_indexed_part(
                indexes=self._text_part_indexes,
                part_id=chunk.id,
                part={"type": "text", "text": "", "state": "streaming"},
            )
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, TextDeltaChunk):
            part = self._ensure_text_part(chunk.id)
            part["text"] = f"{part.get('text', '')}{chunk.delta}"
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, TextEndChunk):
            part = self._ensure_text_part(chunk.id)
            part["state"] = "done"
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ReasoningStartChunk):
            part = self._append_indexed_part(
                indexes=self._reasoning_part_indexes,
                part_id=chunk.id,
                part={"type": "reasoning", "text": "", "state": "streaming"},
            )
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ReasoningDeltaChunk):
            part = self._ensure_reasoning_part(chunk.id)
            part["text"] = f"{part.get('text', '')}{chunk.delta}"
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ReasoningEndChunk):
            part = self._ensure_reasoning_part(chunk.id)
            part["state"] = "done"
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ToolInputStartChunk):
            part = self._ensure_tool_part(
                tool_call_id=chunk.tool_call_id,
                tool_name=chunk.tool_name,
                dynamic=chunk.dynamic,
            )
            part["state"] = "input-streaming"
            part["input"] = ""
            _set_if_not_none(part, "providerExecuted", chunk.provider_executed)
            _set_if_not_none(part, "callProviderMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ToolInputDeltaChunk):
            part = self._ensure_tool_part(tool_call_id=chunk.tool_call_id)
            existing_input = part.get("input")
            part["input"] = (
                chunk.input_text_delta
                if existing_input is None
                else f"{existing_input}{chunk.input_text_delta}"
            )
            return True
        if isinstance(chunk, ToolInputAvailableChunk):
            part = self._ensure_tool_part(
                tool_call_id=chunk.tool_call_id,
                tool_name=chunk.tool_name,
                dynamic=chunk.dynamic,
            )
            part["state"] = "input-available"
            part["input"] = to_jsonable_python(chunk.input)
            _set_if_not_none(part, "providerExecuted", chunk.provider_executed)
            _set_if_not_none(part, "callProviderMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ToolInputErrorChunk):
            part = self._ensure_tool_part(
                tool_call_id=chunk.tool_call_id,
                tool_name=chunk.tool_name,
                dynamic=chunk.dynamic,
            )
            part["state"] = "output-error"
            part["input"] = to_jsonable_python(chunk.input)
            part["errorText"] = chunk.error_text
            _set_if_not_none(part, "providerExecuted", chunk.provider_executed)
            _set_if_not_none(part, "callProviderMetadata", chunk.provider_metadata)
            return True
        if isinstance(chunk, ToolOutputAvailableChunk):
            part = self._ensure_tool_part(
                tool_call_id=chunk.tool_call_id,
                dynamic=chunk.dynamic,
            )
            part["state"] = "output-available"
            part["output"] = to_jsonable_python(chunk.output)
            _set_if_not_none(part, "providerExecuted", chunk.provider_executed)
            _set_if_not_none(part, "preliminary", chunk.preliminary)
            return True
        if isinstance(chunk, ToolOutputErrorChunk):
            part = self._ensure_tool_part(
                tool_call_id=chunk.tool_call_id,
                dynamic=chunk.dynamic,
            )
            part["state"] = "output-error"
            part["errorText"] = chunk.error_text
            _set_if_not_none(part, "providerExecuted", chunk.provider_executed)
            return True
        if isinstance(chunk, ToolOutputDeniedChunk):
            part = self._ensure_tool_part(tool_call_id=chunk.tool_call_id)
            part["state"] = "output-denied"
            return True
        if isinstance(chunk, SourceUrlChunk):
            part = {
                "type": "source-url",
                "sourceId": chunk.source_id,
                "url": chunk.url,
            }
            _set_if_not_none(part, "title", chunk.title)
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            self._parts.append(part)
            return True
        if isinstance(chunk, SourceDocumentChunk):
            part = {
                "type": "source-document",
                "sourceId": chunk.source_id,
                "mediaType": chunk.media_type,
                "title": chunk.title,
            }
            _set_if_not_none(part, "filename", chunk.filename)
            _set_if_not_none(part, "providerMetadata", chunk.provider_metadata)
            self._parts.append(part)
            return True
        if isinstance(chunk, FileChunk):
            self._parts.append({"type": "file", "url": chunk.url, "mediaType": chunk.media_type})
            return True
        if isinstance(chunk, DataChunk):
            part = {"type": chunk.type, "data": to_jsonable_python(chunk.data)}
            _set_if_not_none(part, "id", chunk.id)
            _set_if_not_none(part, "transient", chunk.transient)
            self._parts.append(part)
            return True
        if isinstance(chunk, ErrorChunk):
            self.error_text = chunk.error_text
            self._parts.append(
                {
                    "type": "text",
                    "text": f"Subagent error: {chunk.error_text}",
                    "state": "done",
                }
            )
            return True
        return False

    def _append_indexed_part(
        self,
        *,
        indexes: dict[str, int],
        part_id: str,
        part: dict[str, Any],
    ) -> dict[str, Any]:
        indexes[part_id] = len(self._parts)
        self._parts.append(part)
        return part

    def _ensure_text_part(self, part_id: str) -> dict[str, Any]:
        index = self._text_part_indexes.get(part_id)
        if index is not None:
            return self._parts[index]
        return self._append_indexed_part(
            indexes=self._text_part_indexes,
            part_id=part_id,
            part={"type": "text", "text": "", "state": "streaming"},
        )

    def _ensure_reasoning_part(self, part_id: str) -> dict[str, Any]:
        index = self._reasoning_part_indexes.get(part_id)
        if index is not None:
            return self._parts[index]
        return self._append_indexed_part(
            indexes=self._reasoning_part_indexes,
            part_id=part_id,
            part={"type": "reasoning", "text": "", "state": "streaming"},
        )

    def _ensure_tool_part(
        self,
        *,
        tool_call_id: str,
        tool_name: str | None = None,
        dynamic: bool | None = None,
    ) -> dict[str, Any]:
        index = self._tool_part_indexes.get(tool_call_id)
        if index is not None:
            existing_part = self._parts[index]
            if tool_name is not None and existing_part.get("type") == "dynamic-tool":
                existing_part["toolName"] = tool_name
            return existing_part
        new_part: dict[str, Any] = {
            "type": "dynamic-tool" if dynamic else f"tool-{tool_name or 'unknown'}",
            "toolCallId": tool_call_id,
            "state": "input-streaming",
        }
        if dynamic and tool_name is not None:
            new_part["toolName"] = tool_name
        self._tool_part_indexes[tool_call_id] = len(self._parts)
        self._parts.append(new_part)
        return new_part


def build_subagent_tool_output(
    *,
    accumulator: SubagentUIMessageAccumulator,
    summary: str | None = None,
) -> dict[str, Any]:
    return accumulator.output(summary=summary)


def replace_subagent_final_output(
    *,
    emitter: SubagentProgressEmitter,
    chunk: ToolOutputAvailableChunk,
) -> ToolOutputAvailableChunk:
    final_output = emitter.get_final_output(tool_call_id=chunk.tool_call_id)
    if final_output is _MISSING:
        return chunk
    return chunk.model_copy(update={"output": final_output, "preliminary": None})


def _set_if_not_none(target: dict[str, Any], key: str, value: Any) -> None:
    if value is not None:
        target[key] = to_jsonable_python(value)
