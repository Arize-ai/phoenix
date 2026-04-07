"""Custom OpenInference-compliant instrumentation for the /chat endpoint.

Captures each chat turn as a single trace and persists it to the configured PXI
project. The trace is rooted at an AGENT span and may include one or more live
LLM / TOOL steps when backend tools execute within the same request::

    AGENT ("pxiAgent Turn")
      ├─ LLM  ("pxiCompletion Turn")
      ├─ TOOL ("search_docs")
      └─ LLM  ("pxiCompletion Step 2")

The LLM span records the full conversation history visible to the model as
``llm.input_messages.*`` attributes, including earlier assistant tool calls and
tool returns. Tool results provided by the frontend in the current request are
also emitted as sibling ``TOOL`` spans so they appear alongside backend tool
execution in the trace.

All traces within the same chat session share a ``session.id`` attribute on the
root AGENT span, enabling cross-trace joins for session-level analysis.

This module is intentionally isolated so it can be replaced by
``openinference-instrumentation-pydantic-ai`` or another approach in the future.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Sequence, cast

from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.context import Context as OtelContext
from opentelemetry.trace import Span, Status, StatusCode, set_span_in_context
from sqlalchemy import select

from phoenix.config import get_env_phoenix_pxi_project_name
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.tracers import Tracer

if TYPE_CHECKING:
    from pydantic_ai.messages import ModelResponse

    from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)


@dataclass
class StreamAccumulator:
    """Accumulates text and tool call content during streaming for tracing."""

    text_parts: list[str] = field(default_factory=list)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    _current_tool_args: dict[int, list[str]] = field(default_factory=dict)
    _current_tool_meta: dict[int, dict[str, str]] = field(default_factory=dict)

    @property
    def accumulated_text(self) -> str:
        return "".join(self.text_parts)


class TracingContext:
    """Encapsulates the full tracing lifecycle for a single chat request.

    Manages span creation, finalization, persistence, and tracer shutdown.
    Use :meth:`finalize` in the success path and :meth:`finalize_with_error`
    in the error path.  :meth:`ensure_finalized` should be called in a
    ``finally`` block to guarantee spans are always ended (e.g. on client
    disconnect / ``GeneratorExit``).
    """

    def __init__(
        self,
        tracer: Tracer,
        *,
        agent_span: Span,
        llm_span: Span,
        accumulator: StreamAccumulator,
        tools: Sequence[Mapping[str, Any]] | None = None,
    ) -> None:
        self.tracer = tracer
        self.agent_span = agent_span
        self.llm_span = llm_span
        self.accumulator = accumulator
        self.tools = tools
        self._finalized = False

    def finalize(
        self,
        *,
        usage: Any | None = None,
        model_name: str | None = None,
        provider: str | None = None,
    ) -> None:
        """Finalize both spans on the success path."""
        if self._finalized:
            return
        self._finalized = True

        accumulated_text = self.accumulator.accumulated_text or None
        accumulated_tool_calls = self.accumulator.tool_calls or None

        finalize_llm_span(
            self.llm_span,
            output_content=accumulated_text,
            tool_calls=accumulated_tool_calls,
            usage=usage,
            model_name=model_name,
            provider=provider,
        )
        finalize_tool_call_spans(
            self.tracer,
            parent_span=self.agent_span,
            tool_calls=accumulated_tool_calls,
            tools=self.tools,
        )
        finalize_agent_span(
            self.agent_span,
            output_content=accumulated_text,
        )

    def finalize_with_error(self, error: BaseException) -> None:
        """Finalize both spans on the error path."""
        if self._finalized:
            return
        self._finalized = True

        accumulated_text = self.accumulator.accumulated_text or None
        accumulated_tool_calls = self.accumulator.tool_calls or None

        finalize_llm_span(
            self.llm_span,
            output_content=accumulated_text,
            tool_calls=accumulated_tool_calls,
            error=error,
        )
        finalize_tool_call_spans(
            self.tracer,
            parent_span=self.agent_span,
            tool_calls=accumulated_tool_calls,
            tools=self.tools,
            error=error,
        )
        finalize_agent_span(
            self.agent_span,
            output_content=accumulated_text,
            error=error,
        )

    def ensure_finalized(self) -> None:
        """Safety net — end spans if not already finalized.

        Call this in a ``finally`` block so spans are always ended, even on
        ``GeneratorExit`` (client disconnect) or unexpected ``BaseException``.
        """
        if self._finalized:
            return
        self._finalized = True

        # Best-effort: end spans with error status since we're in an
        # unexpected cleanup path.
        try:
            finalize_llm_span(self.llm_span, error=RuntimeError("stream terminated unexpectedly"))
        except Exception:
            logger.debug("Failed to finalize LLM span during cleanup", exc_info=True)

        try:
            finalize_agent_span(
                self.agent_span, error=RuntimeError("stream terminated unexpectedly")
            )
        except Exception:
            logger.debug("Failed to finalize agent span during cleanup", exc_info=True)

    async def persist_and_shutdown(
        self,
        *,
        db: "DbSessionFactory",
        project_id: int,
        session_id: str | None = None,
        event_queue: Any,
    ) -> list[models.Trace]:
        """Persist traces and shut down the tracer to release resources."""
        try:
            return await persist_traces(
                self.tracer,
                db=db,
                project_id=project_id,
                session_id=session_id,
                event_queue=event_queue,
            )
        finally:
            try:
                self.tracer.shutdown()
            except Exception:
                logger.debug("Failed to shut down tracer", exc_info=True)


# Shorthand constants for readability.
_AGENT = OpenInferenceSpanKindValues.AGENT.value
_LLM = OpenInferenceSpanKindValues.LLM.value
_TOOL = OpenInferenceSpanKindValues.TOOL.value
_TEXT = OpenInferenceMimeTypeValues.TEXT.value
_JSON = OpenInferenceMimeTypeValues.JSON.value

_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
_INPUT_VALUE = SpanAttributes.INPUT_VALUE
_INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
_OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
_OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
_SESSION_ID = SpanAttributes.SESSION_ID
_LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
_LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
_LLM_SYSTEM = SpanAttributes.LLM_SYSTEM
_LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
_LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
_LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
_TOOL_NAME = cast(str, getattr(SpanAttributes, "TOOL_NAME", "tool.name"))
_TOOL_DESCRIPTION = cast(str, getattr(SpanAttributes, "TOOL_DESCRIPTION", "tool.description"))
_TOOL_PARAMETERS = cast(str, getattr(SpanAttributes, "TOOL_PARAMETERS", "tool.parameters"))
_MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
_MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
_MESSAGE_TOOL_CALL_ID = MessageAttributes.MESSAGE_TOOL_CALL_ID
_MESSAGE_NAME = MessageAttributes.MESSAGE_NAME
_MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS
_TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
_TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
_TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON
_TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA


async def ensure_project_exists(db: DbSessionFactory) -> int:
    """Get or create the configured PXI project. Returns the ``project_id``.

    Uses an insert-on-conflict path so concurrent first-time requests do not
    race on the unique project name.
    """
    pxi_project_name = get_env_phoenix_pxi_project_name()
    async with db() as session:
        await session.execute(
            insert_on_conflict(
                {"name": pxi_project_name},
                table=models.Project,
                dialect=db.dialect,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )
        project_id = await session.scalar(
            select(models.Project.id).where(models.Project.name == pxi_project_name)
        )
        if project_id is None:
            raise RuntimeError(f"Failed to resolve PXI project '{pxi_project_name}' after insert")
    return project_id


def create_agent_span(
    tracer: Tracer,
    *,
    input_messages: Sequence[Any],
    session_id: str | None = None,
    trace_name_suffix: str = "Turn",
) -> Span:
    """Create and start the root AGENT span.

    The AGENT span captures high-level input/output and session context.
    LLM-specific attributes (messages, tools, token counts) belong on the
    child LLM span instead.

    Uses ``tracer.start_span()`` (not ``start_as_current_span()``) to avoid
    context-variable issues during async streaming — same pattern as
    ``playground_clients.py``.
    """
    attributes: dict[str, Any] = {
        _SPAN_KIND: _AGENT,
    }

    # Input value: last user message content for quick preview.
    last_user_content = _extract_last_user_content(input_messages)
    if last_user_content:
        attributes[_INPUT_VALUE] = last_user_content
        attributes[_INPUT_MIME_TYPE] = _TEXT

    if session_id:
        attributes[_SESSION_ID] = session_id

    span = tracer.start_span(
        f"pxiAgent {trace_name_suffix}",
        context=OtelContext(),  # isolate from ambient context
        attributes=attributes,
        set_status_on_exception=False,  # we set status manually
    )
    return cast(Span, span)


def create_llm_span(
    tracer: Tracer,
    *,
    parent_span: Span,
    input_messages: Sequence[Any],
    tools: Sequence[Mapping[str, Any]] | None = None,
    trace_name_suffix: str = "Turn",
) -> Span:
    """Create and start a child LLM span under the AGENT parent.

    Per the OpenInference spec, the LLM span carries input/output messages,
    tool definitions, token counts, and model identification.

    Args:
        tracer: The tracer instance used to create spans.
        parent_span: The AGENT span that serves as the parent.
        input_messages: Conversation history (pydantic-ai ``ModelMessage``
            objects) representing the messages the model receives for this
            step.  Flattened as ``llm.input_messages.*`` attributes.
        tools: OpenInference-shaped tool definitions (``{"type": "function", …}``).
        trace_name_suffix: Label appended to the span name.
    """
    attributes = _flatten_input_messages(input_messages)

    # Flatten tool definitions.
    if tools:
        for i, tool in enumerate(tools):
            attributes[f"llm.tools.{i}.{_TOOL_JSON_SCHEMA}"] = json.dumps(tool)

    attributes[_SPAN_KIND] = _LLM

    # Create a context with the agent span as parent so the LLM span becomes
    # a child (same trace_id, parent_id set to agent's span_id).
    parent_context = set_span_in_context(parent_span, context=OtelContext())

    span = tracer.start_span(
        f"pxiCompletion {trace_name_suffix}",
        context=parent_context,
        attributes=attributes,
        set_status_on_exception=False,
    )
    return cast(Span, span)


def create_tool_span(
    tracer: Tracer,
    *,
    parent_span: Span,
    tool_name: str | None,
    tool_parameters: str | None = None,
    tool_output: str | None = None,
    tool_description: str | None = None,
) -> Span:
    """Create and start a TOOL span as a child of the AGENT root.

    Records the tool invocation as a first-class OpenInference ``TOOL`` span
    with ``tool.name``, ``tool.description``, ``tool.parameters``, and
    ``input``/``output`` attributes.

    Args:
        tracer: The tracer instance used to create spans.
        parent_span: The AGENT span that serves as the parent.
        tool_name: Name of the tool being invoked.
        tool_parameters: JSON-serialized arguments passed to the tool.
        tool_output: JSON-serialized return value from the tool.
        tool_description: Human-readable description of the tool's purpose.
    """
    attributes: dict[str, Any] = {
        _SPAN_KIND: _TOOL,
    }
    if tool_name:
        attributes[_TOOL_NAME] = tool_name
    if tool_description:
        attributes[_TOOL_DESCRIPTION] = tool_description
    if tool_parameters:
        attributes[_TOOL_PARAMETERS] = tool_parameters
        attributes[_INPUT_VALUE] = tool_parameters
        attributes[_INPUT_MIME_TYPE] = _JSON
    if tool_output:
        attributes[_OUTPUT_VALUE] = tool_output
        attributes[_OUTPUT_MIME_TYPE] = _JSON

    parent_context = set_span_in_context(parent_span, context=OtelContext())
    span = tracer.start_span(
        tool_name or "tool",
        context=parent_context,
        attributes=attributes,
        set_status_on_exception=False,
    )
    return cast(Span, span)


def finalize_llm_span(
    span: Span,
    *,
    output_content: str | None = None,
    tool_calls: Sequence[dict[str, Any]] | None = None,
    usage: Any | None = None,
    model_name: str | None = None,
    provider: str | None = None,
    error: BaseException | None = None,
) -> None:
    """Set final attributes on the LLM span and end it.

    The LLM span carries output messages, token counts, and model info per
    the OpenInference LLM span spec.
    """
    if error is not None:
        span.set_status(Status(StatusCode.ERROR, str(error)))
        span.record_exception(error)
    else:
        span.set_status(Status(StatusCode.OK))

    # Model identification (available after stream completes).
    if model_name:
        span.set_attribute(_LLM_MODEL_NAME, model_name)
    if provider:
        span.set_attribute(_LLM_PROVIDER, provider)
        # Set llm.system to the well-known value when it matches the provider.
        span.set_attribute(_LLM_SYSTEM, provider)

    # Output messages (flattened per OpenInference spec).
    # Only set output message attributes when there's actual content or tool calls.
    output_msg_attrs: dict[str, Any] = {}
    if output_content:
        output_msg_attrs[f"llm.output_messages.0.{_MESSAGE_CONTENT}"] = output_content
    if tool_calls:
        for j, tc in enumerate(tool_calls):
            tc_prefix = f"llm.output_messages.0.{_MESSAGE_TOOL_CALLS}.{j}"
            if tc.get("id"):
                output_msg_attrs[f"{tc_prefix}.{_TOOL_CALL_ID}"] = tc["id"]
            if tc.get("name"):
                output_msg_attrs[f"{tc_prefix}.{_TOOL_CALL_FUNCTION_NAME}"] = tc["name"]
            if tc.get("arguments"):
                args = tc["arguments"]
                output_msg_attrs[f"{tc_prefix}.{_TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"] = (
                    args if isinstance(args, str) else json.dumps(args)
                )
    if output_msg_attrs:
        output_msg_attrs[f"llm.output_messages.0.{_MESSAGE_ROLE}"] = "assistant"
        span.set_attributes(output_msg_attrs)

    # Token usage.
    if usage is not None:
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        span.set_attribute(_LLM_TOKEN_COUNT_PROMPT, input_tokens)
        span.set_attribute(_LLM_TOKEN_COUNT_COMPLETION, output_tokens)
        span.set_attribute(_LLM_TOKEN_COUNT_TOTAL, input_tokens + output_tokens)

    span.end()


def finalize_agent_span(
    span: Span,
    *,
    output_content: str | None = None,
    error: BaseException | None = None,
) -> None:
    """Set final output attributes on the AGENT span and end it.

    The AGENT span only carries high-level input/output values.
    LLM-specific details live on the child LLM span.
    """
    if error is not None:
        span.set_status(Status(StatusCode.ERROR, str(error)))
        span.record_exception(error)
    else:
        span.set_status(Status(StatusCode.OK))

    if output_content:
        span.set_attribute(_OUTPUT_VALUE, output_content)
        span.set_attribute(_OUTPUT_MIME_TYPE, _TEXT)

    span.end()


def finalize_tool_span(
    span: Span,
    *,
    error: BaseException | None = None,
) -> None:
    """Set status on a TOOL span and end it.

    Tool spans have their content attributes set at creation time (via
    :func:`create_tool_span`) since tool input/output is known upfront for
    replayed history steps.  This function only handles status and ending.
    """
    if error is not None:
        span.set_status(Status(StatusCode.ERROR, str(error)))
        span.record_exception(error)
    else:
        span.set_status(Status(StatusCode.OK))
    span.end()


async def persist_traces(
    tracer: Tracer,
    *,
    db: DbSessionFactory,
    project_id: int,
    session_id: str | None = None,
    event_queue: Any,
) -> list[models.Trace]:
    """Convert captured spans to DB models, persist, and emit events.

    When ``session_id`` is provided, creates or looks up a
    ``ProjectSession`` and links the traces to it — the Tracer persistence
    path does not handle sessions automatically (unlike the bulk inserter).
    """
    db_traces = tracer.get_db_traces(project_id=project_id)
    if not db_traces:
        return []
    async with db() as session:
        # Handle session linking if a session_id was provided.
        if session_id:
            start_time = min(t.start_time for t in db_traces)
            end_time = max(t.end_time for t in db_traces)
            await session.execute(
                insert_on_conflict(
                    {
                        "session_id": session_id,
                        "project_id": project_id,
                        "start_time": start_time,
                        "end_time": end_time,
                    },
                    table=models.ProjectSession,
                    dialect=db.dialect,
                    unique_by=("session_id",),
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
            project_session = await session.scalar(
                select(models.ProjectSession).filter_by(session_id=session_id)
            )
            if project_session is None:
                raise RuntimeError(f"Failed to resolve project session '{session_id}' after insert")
            if start_time < project_session.start_time:
                project_session.start_time = start_time
            if end_time > project_session.end_time:
                project_session.end_time = end_time

            # Link all traces to the session.
            for trace in db_traces:
                trace.project_session_rowid = project_session.id

        session.add_all(db_traces)
        await session.flush()
    event_queue.put(SpanInsertEvent(ids=(project_id,)))
    return db_traces


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _extract_last_user_content(messages: Sequence[Any]) -> str | None:
    """Walk backwards through messages to find the last user text content."""
    from pydantic_ai.messages import ModelRequest, UserPromptPart

    for msg in reversed(messages):
        if isinstance(msg, ModelRequest):
            for part in msg.parts:
                if isinstance(part, UserPromptPart):
                    content = part.content
                    if isinstance(content, str):
                        return content
    return None


def finalize_tool_call_spans(
    tracer: Tracer,
    *,
    parent_span: Span,
    tool_calls: Sequence[dict[str, Any]] | None,
    tools: Sequence[Mapping[str, Any]] | None = None,
    error: BaseException | None = None,
) -> None:
    """Create and immediately finalize ``TOOL`` spans for the current step's tool calls.

    Called after the in-flight LLM span completes with tool-call output.  Each
    tool call gets its own ``TOOL`` span as a sibling of the LLM span under the
    AGENT root.

    Args:
        tracer: The tracer instance used to create spans.
        parent_span: The AGENT span that serves as the parent.
        tool_calls: List of tool-call dicts with ``id``, ``name``, and
            ``arguments`` keys, as accumulated from the streaming response.
        tools: OpenInference-shaped tool definitions for description lookup.
        error: If set, marks each tool span with ``ERROR`` status.
    """
    if not tool_calls:
        return

    tool_definitions = _tool_definitions_by_name(tools)
    for i, tool_call in enumerate(tool_calls):
        tool_name = tool_call.get("name")
        arguments = tool_call.get("arguments")
        tool_parameters = arguments if isinstance(arguments, str) else json.dumps(arguments)
        tool_span = create_tool_span(
            tracer,
            parent_span=parent_span,
            tool_name=tool_name,
            tool_parameters=tool_parameters,
            tool_description=_tool_description(tool_definitions, tool_name),
        )
        finalize_tool_span(tool_span, error=error)


def finalize_recent_input_tool_result_spans(
    tracer: Tracer,
    *,
    parent_span: Span,
    messages: Sequence[Any],
    tools: Sequence[Mapping[str, Any]] | None = None,
) -> None:
    """Emit TOOL spans for tool results included in the current request.

    The AI SDK auto-submits client-side tool results from the last assistant
    step as a trailing suffix of tool-return request messages. We only replay
    that trailing suffix so traces capture frontend-executed tool results
    without re-emitting older tool executions already represented by prior
    spans.
    """
    recent_messages = _recent_tool_result_segment(messages)
    if not recent_messages:
        return

    from pydantic_ai.messages import ModelRequest, ModelResponse, ToolCallPart, ToolReturnPart

    tool_definitions = _tool_definitions_by_name(tools)
    tool_calls_by_id: dict[str, dict[str, str]] = {}

    for message in recent_messages:
        if isinstance(message, ModelResponse):
            for response_part in message.parts:
                if isinstance(response_part, ToolCallPart):
                    tool_calls_by_id[response_part.tool_call_id] = {
                        "name": response_part.tool_name,
                        "arguments": (
                            response_part.args_as_json_str()
                            if response_part.args is not None
                            else ""
                        ),
                    }
        elif isinstance(message, ModelRequest):
            for request_part in message.parts:
                if not isinstance(request_part, ToolReturnPart):
                    continue
                tool_call = tool_calls_by_id.get(request_part.tool_call_id, {})
                tool_output = (
                    request_part.content
                    if isinstance(request_part.content, str)
                    else json.dumps(request_part.content)
                )
                tool_name = request_part.tool_name or tool_call.get("name")
                tool_span = create_tool_span(
                    tracer,
                    parent_span=parent_span,
                    tool_name=tool_name,
                    tool_parameters=tool_call.get("arguments"),
                    tool_output=tool_output,
                    tool_description=_tool_description(tool_definitions, tool_name),
                )
                finalize_tool_span(tool_span)


def _extract_response_content_and_tool_calls(
    message: "ModelResponse",
) -> tuple[str | None, list[dict[str, str]] | None]:
    from pydantic_ai.messages import TextPart, ToolCallPart

    text_parts: list[str] = []
    tool_calls: list[dict[str, str]] = []
    for part in message.parts:
        if isinstance(part, TextPart):
            text_parts.append(part.content)
        elif isinstance(part, ToolCallPart):
            tool_calls.append(
                {
                    "id": part.tool_call_id,
                    "name": part.tool_name,
                    "arguments": part.args_as_json_str() if part.args is not None else "",
                }
            )
    return ("".join(text_parts) or None, tool_calls or None)


def _recent_tool_result_segment(messages: Sequence[Any]) -> list[Any]:
    from pydantic_ai.messages import ModelRequest, ModelResponse, ToolReturnPart

    trailing_requests: list[Any] = []
    start_index = len(messages)
    for index in range(len(messages) - 1, -1, -1):
        message = messages[index]
        if not isinstance(message, ModelRequest):
            break
        # The AI SDK auto-submits completed client-side tool results as one or
        # more trailing ModelRequest messages containing only ToolReturnPart
        # instances. Stop as soon as the suffix no longer matches that shape.
        if not message.parts or not all(isinstance(part, ToolReturnPart) for part in message.parts):
            break
        trailing_requests.append(message)
        start_index = index

    if not trailing_requests:
        return []

    segment_start = start_index
    # Include the immediately preceding assistant response so trailing tool
    # returns can recover their original tool-call arguments by tool_call_id.
    while segment_start > 0 and isinstance(messages[segment_start - 1], ModelResponse):
        segment_start -= 1

    return list(messages[segment_start:])


def _tool_definitions_by_name(
    tools: Sequence[Mapping[str, Any]] | None,
) -> dict[str, Mapping[str, Any]]:
    tool_definitions: dict[str, Mapping[str, Any]] = {}
    for tool in tools or ():
        function = cast(Mapping[str, Any], tool.get("function", tool))
        name = function.get("name")
        if isinstance(name, str):
            tool_definitions[name] = function
    return tool_definitions


def _tool_description(
    tool_definitions: Mapping[str, Mapping[str, Any]],
    tool_name: str | None,
) -> str | None:
    if tool_name is None:
        return None
    description = tool_definitions.get(tool_name, {}).get("description")
    return description if isinstance(description, str) else None


def _flatten_input_messages(messages: Sequence[Any]) -> dict[str, Any]:
    """Flatten a list of ``ModelMessage`` objects into OpenInference span attrs.

    Produces keys like ``llm.input_messages.{i}.message.role``, etc.
    """
    from pydantic_ai.messages import (
        ModelRequest,
        ModelResponse,
        SystemPromptPart,
        TextPart,
        ToolCallPart,
        ToolReturnPart,
        UserPromptPart,
    )

    attrs: dict[str, Any] = {}
    idx = 0

    for msg in messages:
        if isinstance(msg, ModelRequest):
            for part in msg.parts:
                prefix = f"llm.input_messages.{idx}"
                if isinstance(part, SystemPromptPart):
                    attrs[f"{prefix}.{_MESSAGE_ROLE}"] = "system"
                    attrs[f"{prefix}.{_MESSAGE_CONTENT}"] = part.content
                    idx += 1
                elif isinstance(part, UserPromptPart):
                    attrs[f"{prefix}.{_MESSAGE_ROLE}"] = "user"
                    user_content = part.content
                    if isinstance(user_content, str):
                        attrs[f"{prefix}.{_MESSAGE_CONTENT}"] = user_content
                    idx += 1
                elif isinstance(part, ToolReturnPart):
                    attrs[f"{prefix}.{_MESSAGE_ROLE}"] = "tool"
                    attrs[f"{prefix}.{_MESSAGE_TOOL_CALL_ID}"] = part.tool_call_id
                    attrs[f"{prefix}.{_MESSAGE_NAME}"] = part.tool_name
                    tool_content = part.content
                    if isinstance(tool_content, str):
                        attrs[f"{prefix}.{_MESSAGE_CONTENT}"] = tool_content
                    else:
                        attrs[f"{prefix}.{_MESSAGE_CONTENT}"] = json.dumps(tool_content)
                    idx += 1
        elif isinstance(msg, ModelResponse):
            prefix = f"llm.input_messages.{idx}"
            attrs[f"{prefix}.{_MESSAGE_ROLE}"] = "assistant"

            text_parts: list[str] = []
            tc_idx = 0
            for response_part in msg.parts:
                if isinstance(response_part, TextPart):
                    text_parts.append(response_part.content)
                elif isinstance(response_part, ToolCallPart):
                    tc_prefix = f"{prefix}.{_MESSAGE_TOOL_CALLS}.{tc_idx}"
                    attrs[f"{tc_prefix}.{_TOOL_CALL_ID}"] = response_part.tool_call_id
                    attrs[f"{tc_prefix}.{_TOOL_CALL_FUNCTION_NAME}"] = response_part.tool_name
                    args = response_part.args
                    if args is not None:
                        attrs[f"{tc_prefix}.{_TOOL_CALL_FUNCTION_ARGUMENTS_JSON}"] = (
                            args if isinstance(args, str) else json.dumps(args)
                        )
                    tc_idx += 1

            if text_parts:
                attrs[f"{prefix}.{_MESSAGE_CONTENT}"] = "".join(text_parts)
            idx += 1

    return attrs
