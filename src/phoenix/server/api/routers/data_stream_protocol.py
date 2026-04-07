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
    from phoenix.server.api.routers.mcp_tools import MintlifyDocsClient

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


def _sanitize_raw_body(raw_body: bytes) -> bytes:
    """Pre-process the raw request JSON to fix dynamic-tool parts that carry
    ``providerExecuted`` — a field the TypeScript AI SDK includes but the
    pydantic-ai ``SubmitMessage`` schema does not define on its
    ``DynamicTool*`` Pydantic models.  Stripping the extra field allows
    Pydantic validation to succeed.
    """
    data = json.loads(raw_body)
    for msg in data.get("messages", []):
        for part in msg.get("parts", []):
            if part.get("type") == "dynamic-tool" and "providerExecuted" in part:
                del part["providerExecuted"]
    return json.dumps(data).encode()


def parse_chat_body(raw_body: bytes) -> ChatBody:
    """Parse the raw request body into a structured ``ChatBody``.

    Separates body parsing from streaming so callers can access fields like
    ``session_id`` and ``ingest_traces`` before entering the generator.
    """
    from pydantic_ai.messages import ModelRequest, SystemPromptPart
    from pydantic_ai.ui.vercel_ai._adapter import VercelAIAdapter

    cls = _get_vercel_request_class()
    body = cls.model_validate_json(_sanitize_raw_body(raw_body))
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
    backend_tool_names: frozenset[str] | None = None,
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
    # Track which part indices correspond to backend tools so we can set
    # provider_executed on subsequent delta/available chunks.
    _backend_parts: set[int] = set()

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
                is_backend = backend_tool_names is not None and part.tool_name in backend_tool_names
                if is_backend:
                    _backend_parts.add(event.index)
                yield _sse(
                    ToolInputStartChunk(
                        tool_call_id=part.tool_call_id,
                        tool_name=part.tool_name,
                        provider_executed=True if is_backend else None,
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
                is_backend = event.index in _backend_parts
                yield _sse(
                    ToolInputAvailableChunk(
                        tool_call_id=part.tool_call_id,
                        tool_name=part.tool_name,
                        input=part.args_as_dict() or {},
                        provider_executed=True if is_backend else None,
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
    mcp_client: "MintlifyDocsClient | None" = None,
) -> StreamingResponse:
    from pydantic_ai.messages import (
        ModelRequest,
        ModelResponse,
        PartDeltaEvent,
        PartEndEvent,
        PartStartEvent,
        TextPart,
        TextPartDelta,
        ThinkingPart,
        ThinkingPartDelta,
        ToolCallPart,
        ToolCallPartDelta,
        ToolReturnPart,
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
        ToolOutputAvailableChunk,
        ToolOutputErrorChunk,
    )

    messages: list[Any] = list(body.messages)

    def _to_tool_defs(tools: list[FrontendTool]) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name=t.name,
                description=t.description,
                parameters_json_schema=t.parameters,
            )
            for t in tools
        ]

    # Resolve backend (MCP) tool definitions, if available.
    backend_tool_defs: list[ToolDefinition] = []
    backend_tool_names: frozenset[str] = frozenset()
    if mcp_client is not None:
        try:
            backend_tool_defs = await mcp_client.get_tool_definitions()
            backend_tool_names = frozenset(td.name for td in backend_tool_defs)
            logger.debug("Backend MCP tools: %s", list(backend_tool_names))
        except Exception:
            logger.exception("Failed to fetch backend MCP tool definitions")

    frontend_tool_defs = _to_tool_defs(body.tools or [])
    output_tool_defs = _to_tool_defs(body.output_tools or [])

    # Merge frontend + backend tools for the model.
    all_function_tools = frontend_tool_defs + backend_tool_defs

    params = ModelRequestParameters(
        function_tools=all_function_tools,
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

    # Also build raw tool dicts for tracing that include backend tools.
    raw_all_tools: list[dict[str, Any]] = list(body.raw_tools or [])
    for td in backend_tool_defs:
        raw_all_tools.append(
            {
                "type": "function",
                "function": {
                    "name": td.name,
                    "description": td.description,
                    "parameters": td.parameters_json_schema,
                },
            }
        )

    ingest_traces = body.ingest_traces

    # Maximum backend tool loop iterations to prevent runaway loops.
    _MAX_BACKEND_TOOL_LOOPS = 5

    from phoenix.config import get_env_phoenix_pxi_project_name
    from phoenix.server.api.routers.chat_tracing import (
        StreamAccumulator,
        create_agent_span,
        create_llm_span,
        create_tool_span,
        ensure_project_exists,
        finalize_llm_span,
        finalize_recent_input_tool_result_spans,
        finalize_tool_span,
    )
    from phoenix.tracers import Tracer

    async def generate() -> AsyncIterator[str]:
        finish_reason: FinishReason = "stop"
        project_id: int | None = None

        # Tracing state — managed across loop iterations.
        tracer: Tracer | None = None
        agent_span: Any = None
        llm_call_count = 0

        # Set up tracing before streaming begins.
        if ingest_traces:
            try:
                tracer = Tracer(
                    span_cost_calculator=request.app.state.span_cost_calculator,
                    enable_remote_export=True,
                    project_name=get_env_phoenix_pxi_project_name(),
                )
                project_id = await ensure_project_exists(request.app.state.db)
                agent_span = create_agent_span(
                    tracer,
                    input_messages=messages,
                    session_id=body.session_id,
                    trace_name_suffix=body.trace_name_suffix,
                )
                finalize_recent_input_tool_result_spans(
                    tracer,
                    parent_span=agent_span,
                    messages=messages,
                    tools=raw_all_tools or None,
                )
            except Exception:
                logger.exception("Failed to set up chat tracing")
                tracer = None
                agent_span = None

        yield _sse(StartChunk())

        # ---------------------------------------------------------------
        # Backend tool execution loop.
        #
        # Each iteration: call the model → stream the response → if the
        # model requested backend tools, execute them server-side, send
        # ToolOutputAvailable chunks, and loop back for the next model
        # call.  Frontend tool calls pass through to the client as usual.
        # ---------------------------------------------------------------
        loop_count = 0
        final_output_text: str | None = None
        try:
            while loop_count < _MAX_BACKEND_TOOL_LOOPS:
                loop_count += 1
                accumulator = StreamAccumulator()

                # Create a tracing LLM span for this model call.
                llm_span: Any = None
                if tracer is not None and agent_span is not None:
                    llm_call_count += 1
                    llm_span = create_llm_span(
                        tracer,
                        parent_span=agent_span,
                        input_messages=messages,
                        tools=raw_all_tools or None,
                        trace_name_suffix=(
                            f"Step {llm_call_count}"
                            if llm_call_count > 1
                            else body.trace_name_suffix
                        ),
                    )

                yield _sse(StartStepChunk())

                try:
                    async with model.request_stream(messages, None, params) as stream:
                        async for chunk in _encode_stream(
                            stream,
                            accumulator=accumulator,
                            backend_tool_names=backend_tool_names if backend_tool_names else None,
                            **chunk_types,
                        ):
                            yield chunk
                        finish_reason = _FINISH_REASON_MAP.get(
                            stream.finish_reason or "stop", "other"
                        )

                        # Capture the text from this iteration — the last
                        # iteration's text becomes the agent span output.
                        iter_text = accumulator.accumulated_text or None
                        if iter_text:
                            final_output_text = iter_text

                        if llm_span is not None:
                            finalize_llm_span(
                                llm_span,
                                output_content=iter_text,
                                tool_calls=accumulator.tool_calls or None,
                                usage=stream.usage(),
                                model_name=getattr(stream, "model_name", None),
                                provider=getattr(stream, "provider_name", None),
                            )
                except Exception as e:
                    logger.exception("Error in model.request_stream()")
                    yield _sse(ErrorChunk(error_text=str(e)))
                    yield _sse(FinishStepChunk())
                    finish_reason = "error"
                    if llm_span is not None:
                        finalize_llm_span(llm_span, error=e)
                    break

                yield _sse(FinishStepChunk())

                # Identify backend and frontend tool calls in this response.
                backend_calls = (
                    [tc for tc in accumulator.tool_calls if tc.get("name") in backend_tool_names]
                    if backend_tool_names
                    else []
                )
                has_frontend_calls = any(
                    tc.get("name") not in (backend_tool_names or frozenset())
                    for tc in accumulator.tool_calls
                )

                if not backend_calls:
                    # No backend tools — we're done (or frontend tools will
                    # be handled client-side via the sendAutomatically loop).
                    break

                # Execute backend tool calls and stream results.
                # Build the ModelResponse (the model's tool-calling output)
                # and ToolReturnParts (our execution results) for the next
                # model call.
                tool_call_parts: list[Any] = []
                tool_return_parts: list[Any] = []

                for tc in backend_calls:
                    tc_id = tc.get("id", "")
                    tc_name = tc.get("name", "")
                    tc_args_str = tc.get("arguments", "{}")
                    try:
                        tc_args = json.loads(tc_args_str) if tc_args_str else {}
                    except json.JSONDecodeError:
                        tc_args = {}

                    # Build the ToolCallPart for the ModelResponse message.
                    tool_call_parts.append(
                        ToolCallPart(
                            tool_name=tc_name,
                            args=tc_args,
                            tool_call_id=tc_id,
                        )
                    )

                    # Execute the backend tool via MCP.
                    assert mcp_client is not None  # noqa: S101
                    try:
                        result_text = await mcp_client.call_tool(tc_name, tc_args)
                        yield _sse(
                            ToolOutputAvailableChunk(
                                tool_call_id=tc_id,
                                output=result_text,
                                provider_executed=True,
                            )
                        )
                        tool_return_parts.append(
                            ToolReturnPart(
                                tool_name=tc_name,
                                content=result_text,
                                tool_call_id=tc_id,
                            )
                        )

                        # Create a tracing TOOL span.
                        if tracer is not None and agent_span is not None:
                            tool_span = create_tool_span(
                                tracer,
                                parent_span=agent_span,
                                tool_name=tc_name,
                                tool_parameters=tc_args_str,
                                tool_output=result_text,
                            )
                            finalize_tool_span(tool_span)

                    except Exception as tool_err:
                        error_text = f"Backend tool error: {tool_err}"
                        yield _sse(
                            ToolOutputErrorChunk(
                                tool_call_id=tc_id,
                                error_text=error_text,
                                provider_executed=True,
                            )
                        )
                        tool_return_parts.append(
                            ToolReturnPart(
                                tool_name=tc_name,
                                content=error_text,
                                tool_call_id=tc_id,
                            )
                        )

                        if tracer is not None and agent_span is not None:
                            tool_span = create_tool_span(
                                tracer,
                                parent_span=agent_span,
                                tool_name=tc_name,
                                tool_parameters=tc_args_str,
                                tool_output=error_text,
                            )
                            finalize_tool_span(tool_span, error=tool_err)

                if has_frontend_calls:
                    # The model also requested frontend tools in this turn.
                    # We've executed and streamed the backend tool results
                    # (so the frontend has them in the conversation), but we
                    # must NOT loop back to the model — the frontend needs
                    # to handle its tools first.  The client's
                    # sendAutomatically loop will resubmit with all results.
                    break

                # Backend-only: append results to messages and loop back for
                # the model's next response.
                messages.append(ModelResponse(parts=tool_call_parts))
                messages.append(ModelRequest(parts=tool_return_parts))

        except Exception as e:
            logger.exception("Unexpected error in generate() loop")
            yield _sse(ErrorChunk(error_text=str(e)))
            finish_reason = "error"
        finally:
            # Finalize the AGENT span with the final model output.
            if agent_span is not None:
                from phoenix.server.api.routers.chat_tracing import finalize_agent_span

                try:
                    finalize_agent_span(agent_span, output_content=final_output_text)
                except Exception:
                    logger.debug("Failed to finalize agent span", exc_info=True)

        yield _sse(FinishChunk(finish_reason=finish_reason))
        yield _sse(DoneChunk())

        # Persist traces and shut down the tracer to release resources.
        if tracer is not None and project_id is not None:
            from phoenix.server.api.routers.chat_tracing import persist_traces

            try:
                await persist_traces(
                    tracer,
                    db=request.app.state.db,
                    project_id=project_id,
                    session_id=body.session_id,
                    event_queue=request.state.event_queue,
                )
            finally:
                try:
                    tracer.shutdown()
                except Exception:
                    logger.debug("Failed to shut down tracer", exc_info=True)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"x-vercel-ai-ui-message-stream": "v1"},
    )
