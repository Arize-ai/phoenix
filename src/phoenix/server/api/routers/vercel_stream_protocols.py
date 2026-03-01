"""Python re-implementation of Vercel AI SDK's streamText."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Literal
from uuid import uuid4

from pydantic import BaseModel
from starlette.requests import Request
from starlette.responses import StreamingResponse

if TYPE_CHECKING:
    from pydantic_ai.models import Model
    from pydantic_ai.ui.vercel_ai.response_types import FinishReason

logger = logging.getLogger(__name__)

_FINISH_REASON_MAP: dict[
    str, Literal["stop", "length", "content-filter", "tool-calls", "error"]
] = {
    "stop": "stop",
    "length": "length",
    "content_filter": "content-filter",
    "tool_call": "tool-calls",
    "error": "error",
}


class FrontendTool(BaseModel):
    name: str
    description: str
    parameters: dict[str, Any] = {}


def _sse(chunk: Any) -> str:
    return f"data: {chunk.encode(6)}\n\n"


async def _encode_stream(
    stream: Any,
    *,
    PartDeltaEvent: Any,
    PartEndEvent: Any,
    PartStartEvent: Any,
    TextPart: Any,
    TextPartDelta: Any,
    ThinkingPart: Any,
    ThinkingPartDelta: Any,
    ToolCallPart: Any,
    ToolCallPartDelta: Any,
    TextStartChunk: Any,
    TextDeltaChunk: Any,
    TextEndChunk: Any,
    ReasoningStartChunk: Any,
    ReasoningDeltaChunk: Any,
    ReasoningEndChunk: Any,
    ToolInputStartChunk: Any,
    ToolInputDeltaChunk: Any,
    ToolInputAvailableChunk: Any,
) -> AsyncIterator[str]:
    part_ids: dict[int, str] = {}
    part_tool_ids: dict[int, str] = {}

    async for event in stream:
        if isinstance(event, PartStartEvent):
            part = event.part
            msg_id = str(uuid4())
            part_ids[event.index] = msg_id

            if isinstance(part, TextPart):
                yield _sse(TextStartChunk(id=msg_id))
                if part.content:
                    yield _sse(TextDeltaChunk(id=msg_id, delta=part.content))

            elif isinstance(part, ThinkingPart):
                yield _sse(ReasoningStartChunk(id=msg_id))
                if part.content:
                    yield _sse(ReasoningDeltaChunk(id=msg_id, delta=part.content))

            elif isinstance(part, ToolCallPart):
                part_tool_ids[event.index] = part.tool_call_id
                yield _sse(
                    ToolInputStartChunk(
                        tool_call_id=part.tool_call_id,
                        tool_name=part.tool_name,
                        dynamic=True,
                    )
                )
                if part.args:
                    yield _sse(
                        ToolInputDeltaChunk(
                            tool_call_id=part.tool_call_id,
                            input_text_delta=part.args_as_json_str(),
                        )
                    )

        elif isinstance(event, PartDeltaEvent):
            delta = event.delta
            msg_id = part_ids.get(event.index, "")

            if isinstance(delta, TextPartDelta) and delta.content_delta:
                yield _sse(TextDeltaChunk(id=msg_id, delta=delta.content_delta))

            elif isinstance(delta, ThinkingPartDelta) and delta.content_delta:
                yield _sse(ReasoningDeltaChunk(id=msg_id, delta=delta.content_delta))

            elif isinstance(delta, ToolCallPartDelta) and delta.args_delta is not None:
                tool_call_id = part_tool_ids.get(event.index, "")
                args = delta.args_delta
                delta_str = args if isinstance(args, str) else json.dumps(args)
                yield _sse(
                    ToolInputDeltaChunk(
                        tool_call_id=tool_call_id,
                        input_text_delta=delta_str,
                    )
                )

        elif isinstance(event, PartEndEvent):
            part = event.part
            msg_id = part_ids.get(event.index, "")

            if isinstance(part, TextPart):
                yield _sse(TextEndChunk(id=msg_id))

            elif isinstance(part, ThinkingPart):
                yield _sse(ReasoningEndChunk(id=msg_id))

            elif isinstance(part, ToolCallPart):
                yield _sse(
                    ToolInputAvailableChunk(
                        tool_call_id=part.tool_call_id,
                        tool_name=part.tool_name,
                        input=part.args_as_dict() or {},
                        dynamic=True,
                    )
                )


async def stream_text(request: Request, model: "Model") -> StreamingResponse:
    from pydantic_ai.messages import (
        ModelRequest,
        PartDeltaEvent,
        PartEndEvent,
        PartStartEvent,
        SystemPromptPart,
        TextPart,
        TextPartDelta,
        ThinkingPart,
        ThinkingPartDelta,
        ToolCallPart,
        ToolCallPartDelta,
    )
    from pydantic_ai.models import ModelRequestParameters
    from pydantic_ai.tools import ToolDefinition
    from pydantic_ai.ui.vercel_ai._adapter import VercelAIAdapter
    from pydantic_ai.ui.vercel_ai.request_types import SubmitMessage
    from pydantic_ai.ui.vercel_ai.response_types import (
        DoneChunk,
        ErrorChunk,
        FinishChunk,
        FinishStepChunk,
        ReasoningDeltaChunk,
        ReasoningEndChunk,
        ReasoningStartChunk,
        StartChunk,
        StartStepChunk,
        TextDeltaChunk,
        TextEndChunk,
        TextStartChunk,
        ToolInputAvailableChunk,
        ToolInputDeltaChunk,
        ToolInputStartChunk,
    )

    class _VercelRequest(SubmitMessage):
        tools: list[FrontendTool] | None = None
        system: str | None = None

    body = _VercelRequest.model_validate_json(await request.body())
    logger.warning("system=%r", body.system)
    logger.warning("tools=%r", [t.name for t in (body.tools or [])])
    logger.warning("messages=%r", body.messages)
    messages = VercelAIAdapter.load_messages(body.messages)
    if body.system:
        messages = [ModelRequest(parts=[SystemPromptPart(content=body.system)]), *messages]

    params = ModelRequestParameters(
        function_tools=[
            ToolDefinition(
                name=t.name,
                description=t.description,
                parameters_json_schema=t.parameters,
            )
            for t in (body.tools or [])
        ]
    )

    chunk_types = dict(
        PartDeltaEvent=PartDeltaEvent,
        PartEndEvent=PartEndEvent,
        PartStartEvent=PartStartEvent,
        TextPart=TextPart,
        TextPartDelta=TextPartDelta,
        ThinkingPart=ThinkingPart,
        ThinkingPartDelta=ThinkingPartDelta,
        ToolCallPart=ToolCallPart,
        ToolCallPartDelta=ToolCallPartDelta,
        TextStartChunk=TextStartChunk,
        TextDeltaChunk=TextDeltaChunk,
        TextEndChunk=TextEndChunk,
        ReasoningStartChunk=ReasoningStartChunk,
        ReasoningDeltaChunk=ReasoningDeltaChunk,
        ReasoningEndChunk=ReasoningEndChunk,
        ToolInputStartChunk=ToolInputStartChunk,
        ToolInputDeltaChunk=ToolInputDeltaChunk,
        ToolInputAvailableChunk=ToolInputAvailableChunk,
    )

    async def generate() -> AsyncIterator[str]:
        finish_reason: FinishReason = "stop"
        yield _sse(StartChunk())
        yield _sse(StartStepChunk())
        try:
            async with model.request_stream(messages, None, params) as stream:
                async for chunk in _encode_stream(stream, **chunk_types):
                    yield chunk
                finish_reason = _FINISH_REASON_MAP.get(stream.finish_reason or "stop", "other")
        except Exception as e:
            yield _sse(ErrorChunk(error_text=str(e)))
            finish_reason = "error"
        yield _sse(FinishStepChunk())
        yield _sse(FinishChunk(finish_reason=finish_reason))
        yield _sse(DoneChunk())

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"x-vercel-ai-ui-message-stream": "v1"},
    )
