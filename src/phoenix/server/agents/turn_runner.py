"""Detached execution for prepared agent-session turns."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable, Sequence
from dataclasses import dataclass
from typing import Literal

from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    ReasoningEndChunk,
    ReasoningStartChunk,
    TextEndChunk,
    TextStartChunk,
    ToolInputAvailableChunk,
    ToolInputStartChunk,
    ToolOutputAvailableChunk,
    ToolOutputDeniedChunk,
    ToolOutputErrorChunk,
)

from phoenix.db.types.data_stream_protocol import (
    AssistantMessageMetadata,
    PhoenixUIMessage,
    ReasoningUIPart,
    TextUIPart,
)
from phoenix.server.agents.event_bus import AgentSessionEventBus, SessionChannel

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PreparedTurn:
    agent_session_id: int
    turn_id: str
    stream: Callable[[], AsyncIterator[BaseChunk]]
    is_awaiting_client_tool: Callable[[], bool]
    mark_stopped: Callable[[], None]


def resolve_dangling_chunks(
    chunks: Sequence[BaseChunk],
    *,
    error_text: str,
) -> list[BaseChunk]:
    """Close partial text/reasoning parts and fail unresolved tool calls."""
    open_text_ids: set[str] = set()
    open_reasoning_ids: set[str] = set()
    pending_tool_call_ids: set[str] = set()
    for chunk in chunks:
        if isinstance(chunk, TextStartChunk):
            open_text_ids.add(chunk.id)
        elif isinstance(chunk, TextEndChunk):
            open_text_ids.discard(chunk.id)
        elif isinstance(chunk, ReasoningStartChunk):
            open_reasoning_ids.add(chunk.id)
        elif isinstance(chunk, ReasoningEndChunk):
            open_reasoning_ids.discard(chunk.id)
        elif isinstance(chunk, (ToolInputStartChunk, ToolInputAvailableChunk)):
            pending_tool_call_ids.add(chunk.tool_call_id)
        elif isinstance(
            chunk,
            (ToolOutputAvailableChunk, ToolOutputErrorChunk, ToolOutputDeniedChunk),
        ):
            pending_tool_call_ids.discard(chunk.tool_call_id)
    resolved: list[BaseChunk] = [
        ToolOutputErrorChunk(tool_call_id=tool_call_id, error_text=error_text)
        for tool_call_id in pending_tool_call_ids
    ]
    resolved.extend(TextEndChunk(id=text_id) for text_id in open_text_ids)
    resolved.extend(ReasoningEndChunk(id=reasoning_id) for reasoning_id in open_reasoning_ids)
    return resolved


def resolve_dangling_message(
    message: PhoenixUIMessage,
    *,
    interrupted: Literal["stopped", "errored"],
    error_text: str,
) -> PhoenixUIMessage:
    """Resolve incomplete parts on an already-persisted assistant message."""
    part_payloads: list[dict[str, object]] = []
    terminal_tool_states = {"output-available", "output-error", "output-denied"}
    for part in message.parts:
        payload = part.model_dump(mode="json", by_alias=True, exclude_none=True)
        if isinstance(part, (TextUIPart, ReasoningUIPart)) and part.state == "streaming":
            payload["state"] = "done"
        state = getattr(part, "state", None)
        tool_call_id = getattr(part, "tool_call_id", None)
        if tool_call_id is not None and state not in terminal_tool_states:
            payload["state"] = "output-error"
            payload["errorText"] = error_text
            payload.pop("approval", None)
            payload.pop("output", None)
            payload.pop("preliminary", None)
        part_payloads.append(payload)
    metadata = message.metadata
    if isinstance(metadata, AssistantMessageMetadata):
        metadata = metadata.model_copy(update={"interrupted": interrupted})
    return PhoenixUIMessage.model_validate(
        {
            **message.model_dump(mode="json", by_alias=True, exclude={"parts"}),
            "metadata": (
                metadata.model_dump(mode="json", by_alias=True, exclude_none=True)
                if metadata is not None
                else None
            ),
            "parts": part_payloads,
        }
    )


class TurnRunner:
    def __init__(
        self,
        *,
        bus: AgentSessionEventBus,
        channel: SessionChannel,
        prepared_turn: PreparedTurn,
    ) -> None:
        self._bus = bus
        self._channel = channel
        self._prepared_turn = prepared_turn
        self._consume_task: asyncio.Task[None] | None = None
        self._stop_requested = False

    def request_stop(self) -> None:
        self._stop_requested = True
        self._prepared_turn.mark_stopped()
        if self._consume_task is not None and not self._consume_task.done():
            self._consume_task.cancel()

    async def run(self) -> None:
        stream_failed = False

        async def consume() -> None:
            # INVARIANT: the only suspension points in this loop must be the
            # stream's __anext__ awaits. That guarantees a stop cancellation is
            # thrown *inside* the stream generator, whose except/finally blocks
            # perform the partial persist and trace flush. Publishing is
            # synchronous on purpose — do not add awaits here.
            async for chunk in self._prepared_turn.stream():
                self._channel.publish(chunk)

        self._consume_task = asyncio.create_task(consume())
        try:
            await self._consume_task
        except asyncio.CancelledError:
            if not self._stop_requested:
                stream_failed = True
                logger.exception("Agent-session turn was unexpectedly cancelled")
        except BaseException:
            stream_failed = True
            logger.exception("Agent-session turn failed")
        finally:
            try:
                await self._bus.complete_turn(
                    agent_session_id=self._prepared_turn.agent_session_id,
                    turn_id=self._prepared_turn.turn_id,
                    awaiting_client_tool=(
                        not self._stop_requested
                        and not stream_failed
                        and self._prepared_turn.is_awaiting_client_tool()
                    ),
                )
            except Exception:
                logger.exception("Failed to complete agent-session turn bookkeeping")
