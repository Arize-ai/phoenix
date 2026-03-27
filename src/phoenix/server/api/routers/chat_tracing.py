"""Custom OpenInference-compliant instrumentation for the /chat endpoint.

Captures agent turns as traces and persists them to the configured PXI project.
Each request produces a two-level span tree whose span names are suffixed to
distinguish chat turns from summarization calls:

    AGENT ("ChatAgent Turn") / ("ChatAgent Summary")
      └─ LLM ("ChatCompletion Turn") / ("ChatCompletion Summary")

This module is intentionally isolated so it can be replaced by
``openinference-instrumentation-pydantic-ai`` or another approach in the future.
"""

from __future__ import annotations

import json
import logging
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
    from collections.abc import Mapping

    from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

# Shorthand constants for readability.
_AGENT = OpenInferenceSpanKindValues.AGENT.value
_LLM = OpenInferenceSpanKindValues.LLM.value
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
        assert project_id is not None
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
        f"ChatAgent {trace_name_suffix}",
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
    """
    attributes: dict[str, Any] = {
        _SPAN_KIND: _LLM,
    }

    # Flatten input messages into OpenInference attributes.
    attributes.update(_flatten_input_messages(input_messages))

    # Flatten tool definitions.
    if tools:
        for i, tool in enumerate(tools):
            attributes[f"llm.tools.{i}.{_TOOL_JSON_SCHEMA}"] = json.dumps(tool)

    # Create a context with the agent span as parent so the LLM span becomes
    # a child (same trace_id, parent_id set to agent's span_id).
    parent_context = set_span_in_context(parent_span, context=OtelContext())

    span = tracer.start_span(
        f"ChatCompletion {trace_name_suffix}",
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
    output_msg_attrs: dict[str, Any] = {}
    output_msg_attrs[f"llm.output_messages.0.{_MESSAGE_ROLE}"] = "assistant"
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
            assert project_session is not None
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
