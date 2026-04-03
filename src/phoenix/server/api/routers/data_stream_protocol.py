"""Data stream protocol implementation for AI SDK's streamText."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal
from uuid import uuid4

from pydantic import BaseModel
from starlette.requests import Request
from starlette.responses import StreamingResponse

if TYPE_CHECKING:
    from pydantic_ai.messages import ModelMessage
    from pydantic_ai.models import Model
    from pydantic_ai.ui.vercel_ai.response_types import FinishReason

    from phoenix.server.api.routers.chat_tracing import StreamAccumulator

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
    """Tool descriptor sent by the frontend alongside chat requests."""

    name: str
    description: str
    parameters: dict[str, Any] = {}


# Lazy-initialized Pydantic model cached at module level to avoid re-creating
# the schema on every request.  Typed as ``Any`` because the concrete class
# (a subclass of ``SubmitMessage``) is built lazily and mypy cannot see its
# dynamic attributes.
_VercelRequestCls: Any = None


def _get_vercel_request_class() -> Any:
    global _VercelRequestCls
    if _VercelRequestCls is None:
        from pydantic_ai.ui.vercel_ai.request_types import SubmitMessage

        class _VercelRequest(SubmitMessage):
            tools: list[FrontendTool] | None = None
            output_tools: list[FrontendTool] | None = None
            system: str | None = None
            session_id: str | None = None
            ingest_traces: bool = True
            trace_name_suffix: str = "Turn"

        _VercelRequestCls = _VercelRequest
    return _VercelRequestCls


@dataclass
class ChatBody:
    """Parsed chat request body with all the data needed for streaming and tracing."""

    messages: list[ModelMessage]
    tools: list[FrontendTool] | None = None
    output_tools: list[FrontendTool] | None = None
    system: str | None = None
    session_id: str | None = None
    ingest_traces: bool = True
    trace_name_suffix: str = "Turn"
    raw_tools: list[dict[str, Any]] = field(default_factory=list)


def parse_chat_body(raw_body: bytes) -> ChatBody:
    """Parse the raw request body into a structured ``ChatBody``.

    Separates body parsing from streaming so callers can access fields like
    ``session_id`` and ``ingest_traces`` before entering the generator.
    """
    from pydantic_ai.messages import ModelRequest, SystemPromptPart
    from pydantic_ai.ui.vercel_ai._adapter import VercelAIAdapter

    cls = _get_vercel_request_class()
    body = cls.model_validate_json(raw_body)
    logger.debug("system=%r", body.system)
    logger.debug("tools=%r", [t.name for t in (body.tools or [])])
    logger.debug("messages=%r", body.messages)

    messages: list[Any] = VercelAIAdapter.load_messages(body.messages)
    if body.system:
        messages = [ModelRequest(parts=[SystemPromptPart(content=body.system)]), *messages]

    # Build raw tool dicts for tracing (OpenInference tool json_schema).
    raw_tools: list[dict[str, Any]] = []
    for t in body.tools or []:
        function: dict[str, Any] = {
            "name": t.name,
            "parameters": t.parameters,
        }
        if t.description is not None:
            function["description"] = t.description
        raw_tools.append({"type": "function", "function": function})

    return ChatBody(
        messages=messages,
        tools=body.tools,
        output_tools=body.output_tools,
        system=body.system,
        session_id=body.session_id,
        ingest_traces=body.ingest_traces,
        trace_name_suffix=body.trace_name_suffix,
        raw_tools=raw_tools,
    )


def _sse(chunk: Any) -> str:
    return f"data: {chunk.encode(6)}\n\n"


async def _encode_stream(
    stream: Any,
    *,
    accumulator: "StreamAccumulator | None" = None,
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
                    if accumulator is not None:
                        accumulator.text_parts.append(part.content)

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
                if accumulator is not None:
                    accumulator._current_tool_meta[event.index] = {
                        "id": part.tool_call_id,
                        "name": part.tool_name,
                    }
                    accumulator._current_tool_args[event.index] = []
                if part.args:
                    args_str = part.args_as_json_str()
                    yield _sse(
                        ToolInputDeltaChunk(
                            tool_call_id=part.tool_call_id,
                            input_text_delta=args_str,
                        )
                    )
                    if accumulator is not None:
                        accumulator._current_tool_args[event.index].append(args_str)

        elif isinstance(event, PartDeltaEvent):
            delta = event.delta
            msg_id = part_ids.get(event.index, "")

            if isinstance(delta, TextPartDelta) and delta.content_delta:
                yield _sse(TextDeltaChunk(id=msg_id, delta=delta.content_delta))
                if accumulator is not None:
                    accumulator.text_parts.append(delta.content_delta)

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
                if accumulator is not None:
                    accumulator._current_tool_args.setdefault(event.index, []).append(delta_str)

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
                if accumulator is not None:
                    meta = accumulator._current_tool_meta.pop(event.index, {})
                    args_parts = accumulator._current_tool_args.pop(event.index, [])
                    accumulator.tool_calls.append(
                        {
                            "id": meta.get("id", part.tool_call_id),
                            "name": meta.get("name", part.tool_name),
                            "arguments": "".join(args_parts),
                        }
                    )


async def stream_text(
    request: Request,
    model: "Model",
    *,
    body: ChatBody,
) -> StreamingResponse:
    from pydantic_ai.messages import (
        PartDeltaEvent,
        PartEndEvent,
        PartStartEvent,
        TextPart,
        TextPartDelta,
        ThinkingPart,
        ThinkingPartDelta,
        ToolCallPart,
        ToolCallPartDelta,
    )
    from pydantic_ai.models import ModelRequestParameters
    from pydantic_ai.tools import ToolDefinition
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

    messages = body.messages

    def _to_tool_defs(tools: list[FrontendTool]) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name=t.name,
                description=t.description,
                parameters_json_schema=t.parameters,
            )
            for t in tools
        ]

    output_tool_defs = _to_tool_defs(body.output_tools or [])
    params = ModelRequestParameters(
        function_tools=_to_tool_defs(body.tools or []),
        output_tools=output_tool_defs,
        output_mode="tool" if output_tool_defs else "text",
        allow_text_output=not output_tool_defs,
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

    ingest_traces = body.ingest_traces

    from phoenix.config import get_env_phoenix_pxi_project_name
    from phoenix.server.api.routers.chat_tracing import (
        StreamAccumulator,
        TracingContext,
        create_agent_span,
        create_llm_span,
        ensure_project_exists,
        replay_history_spans,
    )
    from phoenix.tracers import Tracer

    async def generate() -> AsyncIterator[str]:
        finish_reason: FinishReason = "stop"
        tracing_ctx: TracingContext | None = None
        accumulator: StreamAccumulator | None = None
        project_id: int | None = None

        # Set up tracing before streaming begins.
        if ingest_traces:
            try:
                tracer = Tracer(
                    span_cost_calculator=request.app.state.span_cost_calculator,
                    enable_remote_export=True,
                    project_name=get_env_phoenix_pxi_project_name(),
                )
                project_id = await ensure_project_exists(request.app.state.db)
                accumulator = StreamAccumulator()
                agent_span = create_agent_span(
                    tracer,
                    input_messages=messages,
                    session_id=body.session_id,
                    trace_name_suffix=body.trace_name_suffix,
                )
                completed_llm_steps, next_step_index = replay_history_spans(
                    tracer,
                    parent_span=agent_span,
                    messages=messages,
                    tools=body.raw_tools or None,
                )
                llm_span = create_llm_span(
                    tracer,
                    parent_span=agent_span,
                    input_messages=messages,
                    tools=body.raw_tools or None,
                    trace_name_suffix=(
                        f"Step {completed_llm_steps + 1}"
                        if completed_llm_steps
                        else body.trace_name_suffix
                    ),
                    step_index=next_step_index,
                )
                # Tool-call spans created during finalization start one past
                # the current LLM span's index.
                tracing_ctx = TracingContext(
                    tracer,
                    agent_span=agent_span,
                    llm_span=llm_span,
                    accumulator=accumulator,
                    tools=body.raw_tools or None,
                    tool_call_step_index=next_step_index + 1,
                )
            except Exception:
                logger.exception("Failed to set up chat tracing")
                tracing_ctx = None
                accumulator = None

        yield _sse(StartChunk())
        yield _sse(StartStepChunk())
        try:
            async with model.request_stream(messages, None, params) as stream:
                async for chunk in _encode_stream(stream, accumulator=accumulator, **chunk_types):
                    yield chunk
                finish_reason = _FINISH_REASON_MAP.get(stream.finish_reason or "stop", "other")

                if tracing_ctx is not None:
                    tracing_ctx.finalize(
                        usage=stream.usage(),
                        model_name=getattr(stream, "model_name", None),
                        provider=getattr(stream, "provider_name", None),
                    )
        except Exception as e:
            yield _sse(ErrorChunk(error_text=str(e)))
            finish_reason = "error"
            if tracing_ctx is not None:
                tracing_ctx.finalize_with_error(e)
        finally:
            # Safety net: ensure spans are always ended, even on GeneratorExit
            # (client disconnect) or unexpected BaseException.
            if tracing_ctx is not None:
                tracing_ctx.ensure_finalized()

        yield _sse(FinishStepChunk())
        yield _sse(FinishChunk(finish_reason=finish_reason))
        yield _sse(DoneChunk())

        # Persist traces and shut down the tracer to release resources.
        if tracing_ctx is not None and project_id is not None:
            try:
                await tracing_ctx.persist_and_shutdown(
                    db=request.app.state.db,
                    project_id=project_id,
                    session_id=body.session_id,
                    event_queue=request.state.event_queue,
                )
            except Exception:
                logger.exception("Failed to persist chat traces")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"x-vercel-ai-ui-message-stream": "v1"},
    )
