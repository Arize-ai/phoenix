import asyncio
import binascii
import hashlib
import json
import logging
from collections.abc import (
    AsyncGenerator,
    AsyncIterator,
    Awaitable,
    Callable,
    Iterable,
    Sequence,
)
from contextlib import AbstractContextManager, aclosing, nullcontext
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, TypeVar
from uuid import uuid4

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from openinference.instrumentation import using_session, using_user
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry import trace as trace_api
from opentelemetry.context import Context
from opentelemetry.sdk.trace import Event
from opentelemetry.sdk.trace.id_generator import RandomIdGenerator
from opentelemetry.sdk.util.instrumentation import InstrumentationScope
from opentelemetry.semconv.attributes.exception_attributes import EXCEPTION_MESSAGE
from opentelemetry.trace import (
    NonRecordingSpan,
    SpanContext,
    Status,
    StatusCode,
    TraceFlags,
    format_span_id,
    format_trace_id,
    get_current_span,
)
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    model_validator,
)
from pydantic.alias_generators import to_camel
from pydantic_ai import AgentRunResult
from pydantic_ai.messages import ModelMessage
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    SubmitMessage as PydanticAISubmitMessage,
)
from pydantic_ai.ui.vercel_ai.request_types import (
    UIMessage as PydanticAIUIMessage,
)
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    DataChunk,
    ErrorChunk,
    FinishChunk,
    MessageMetadataChunk,
    StartChunk,
    ToolInputAvailableChunk,
    ToolOutputAvailableChunk,
)
from pydantic_ai.usage import RequestUsage
from sqlalchemy import ColumnElement, Insert, exists, func, or_, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from strawberry.relay import GlobalID
from typing_extensions import TypeIs, assert_never

from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_disable_bash,
    get_env_phoenix_agents_force_tracing,
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.data_stream_protocol import (
    AssistantMessageMetadataUsage,
    AssistantMessageMetadataUsageCacheTokenDetails,
    AssistantMessageMetadataUsageTokens,
    DynamicToolApprovalRequestedPart,
    DynamicToolApprovalRespondedPart,
    DynamicToolInputAvailablePart,
    DynamicToolInputStreamingPart,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputErrorPart,
    DynamicToolUIPart,
    MessageMetadata,
    PhoenixAssistantMessageMetadata,
    PhoenixToolCallCallbackProviderMetadata,
    PhoenixToolCallProviderMetadata,
    PhoenixUIMessage,
    PhoenixUserMessageMetadata,
    ProviderMetadata,
    PydanticAIToolCallProviderMetadata,
    TextUIPart,
    ToolApprovalRequestedPart,
    ToolApprovalRespondedPart,
    ToolExecutionEnvironment,
    ToolInputAvailablePart,
    ToolInputStreamingPart,
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    ToolUIPart,
    TurnTraceContext,
    UIMessage,
    UIMessagePart,
)
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import get_external_tool_definition
from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.context import (
    AppContext,
    ChatContext,
    ResolvedContexts,
    resolve_contexts,
)
from phoenix.server.agents.exceptions import AgentError, CompactionError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import AgentModelSelection
from phoenix.server.agents.prompts import AgentPrompts, ServerAgentPrompts
from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.agents.session_titles import (
    MAX_AGENT_SESSION_TITLE_LENGTH,
    truncate_agent_session_title,
    validate_agent_session_title,
)
from phoenix.server.agents.skill_requests import (
    inject_requested_skills,
    iter_requested_skill_response_chunks,
    resolve_requested_skills,
)
from phoenix.server.agents.skills import get_skills_for_contexts
from phoenix.server.agents.summarization import (
    summarize_messages,
    summarize_messages_for_compaction,
)
from phoenix.server.agents.types import (
    AgentDependencies,
    AgentOutput,
    ModelProviderAvailability,
    SandboxAvailability,
)
from phoenix.server.agents.ui_message_stream import (
    AgentErrorChunk,
    finalize_interrupted_ui_message_state,
    iter_chunks_with_error_parts,
)
from phoenix.server.agents.vercel_ui_message_stream import (
    create_streaming_ui_message_state,
    process_ui_message_stream,
)
from phoenix.server.api.helpers.agent_sessions import (
    TURN_LOCK_STALENESS,
    get_agent_session_model,
    get_otel_session_id,
    is_turn_active,
    resolve_model_routing,
    set_session_model,
)
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
    PROVIDER_DEFAULT,
)
from phoenix.server.api.openapi.registry import register_openapi_schema
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
)
from phoenix.server.api.types.SandboxConfig import (
    SandboxBackendStatus,
    get_sandbox_backend_info,
)
from phoenix.server.authorization import (
    insufficient_storage_message,
    is_agent_assistant_enabled,
    is_not_locked,
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import PhoenixUser, is_authenticated
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.sandbox import SecretsContext
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.tracers import (
    Tracer,
    build_synthetic_readable_span,
    detached_otel_context,
    get_cumulative_counts,
)

_PHOENIX_PROVIDER_METADATA_KEY = "phoenix"

_PYDANTIC_AI_PROVIDER_METADATA_KEY = "pydantic_ai"
"""The ``providerMetadata`` namespace ``pydantic_ai.ui.vercel_ai`` reads and writes
(its private ``PROVIDER_METADATA_KEY``); ``load_messages`` restores tool outcomes
recorded under it."""

_PXI_INSTRUMENTATION_SCOPE = InstrumentationScope("phoenix.server.pxi")

register_openapi_schema(PhoenixToolCallProviderMetadata)
register_openapi_schema(PhoenixToolCallCallbackProviderMetadata)
register_openapi_schema(AgentErrorChunk)


def _get_updated_provider_metadata(
    *,
    provider_metadata: ProviderMetadata,
    tool_name: str,
    emitted_at: datetime,
) -> ProviderMetadata:
    """Adds Phoenix-specific fields under the ``"phoenix"`` namespace of Vercel AI
    ``providerMetadata``, the escape hatch the AI SDK reserves for provider-specific
    data that doesn't fit the standard chunk shape.

    See the upstream definition this builds on:
        - Vercel AI SDK ``SharedV3ProviderMetadata``:
          https://github.com/vercel/ai/blob/main/packages/provider/src/shared/v3/shared-v3-provider-metadata.ts
    """
    result: ProviderMetadata = deepcopy(provider_metadata)
    tool_execution_environment: ToolExecutionEnvironment = (
        "client" if get_external_tool_definition(tool_name) is not None else "server"
    )
    new_tool_call_metadata = PhoenixToolCallProviderMetadata(
        tool_execution_environment=tool_execution_environment,
        tool_input_emitted_at=(
            emitted_at.isoformat() if tool_execution_environment == "client" else None
        ),
    )
    existing_tool_call_metadata: dict[str, Any] = result.get(_PHOENIX_PROVIDER_METADATA_KEY, {})
    result[_PHOENIX_PROVIDER_METADATA_KEY] = {
        **existing_tool_call_metadata,
        **new_tool_call_metadata.model_dump(by_alias=True, exclude_none=True),
    }
    return result


class _CamelBaseModel(BaseModel):
    """Base model with camelCase aliases.

    The wire casing under ``/agent_sessions`` is deliberately split: the chat route's
    request body and stream chunks extend this class because they follow the
    Vercel AI SDK data stream protocol, which dictates camelCase, while the
    session CRUD payloads extend ``V1RoutesBaseModel`` and keep the REST API's
    snake_case convention. Do not normalize either side to match the other —
    both casings are external contracts.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# Transient session chunks live in this router rather than ``phoenix.db.types`` because they are
# delivered to the client's ``onData`` callback but never persisted.
@register_openapi_schema
class SessionSummaryChunk(DataChunk):
    """Transient ``data-session-summary`` stream chunk: the LLM-generated
    session title, emitted on any turn that starts with the session still
    untitled. Being transient, it reaches the client's ``onData`` callback
    but is never appended to the message parts.

    See the Vercel AI SDK data stream protocol:
        - Data parts: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-parts
        - Transient parts: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data#transient-data-parts-ephemeral
    """

    type: Literal["data-session-summary"] = "data-session-summary"
    data: str
    transient: Literal[True] = True


class TranscriptPersistedData(_CamelBaseModel):
    message_id: str


@register_openapi_schema
class TranscriptPersistedChunk(DataChunk):
    """Confirms that a streamed assistant message is durable."""

    type: Literal["data-transcript-persisted"] = "data-transcript-persisted"
    data: TranscriptPersistedData
    transient: Literal[True] = True


def _resolve_browser_clock(messages: Sequence[PhoenixUIMessage]) -> AppContext | None:
    """Return the newest user-message browser-clock stamp, if any."""
    for message in reversed(messages):
        if message.role != "user":
            continue
        phoenix_metadata = message.metadata.phoenix if message.metadata is not None else None
        if isinstance(phoenix_metadata, PhoenixUserMessageMetadata):
            return AppContext(
                type="app",
                current_date_time=phoenix_metadata.current_date_time,
                time_zone=phoenix_metadata.time_zone,
            )
    return None


ToolOutputUIPart = (
    ToolOutputAvailablePart
    | ToolOutputErrorPart
    | DynamicToolOutputAvailablePart
    | DynamicToolOutputErrorPart
)

_PhoenixToolCallCallbackProviderMetadataAdapter: TypeAdapter[
    PhoenixToolCallCallbackProviderMetadata
] = TypeAdapter(PhoenixToolCallCallbackProviderMetadata)


def _validate_submitted_tool_outputs(tool_outputs: Sequence[ToolOutputUIPart]) -> None:
    """Validate the wire-level invariants shared by every ``toolOutputs`` payload."""
    tool_call_ids = [tool_output.tool_call_id for tool_output in tool_outputs]
    if len(tool_call_ids) != len(set(tool_call_ids)):
        raise ValueError("Each toolOutputs entry must have a distinct toolCallId")
    for tool_output in tool_outputs:
        call_provider_metadata = tool_output.call_provider_metadata
        if isinstance(call_provider_metadata, dict):
            phoenix_metadata = call_provider_metadata.get(_PHOENIX_PROVIDER_METADATA_KEY)
            if phoenix_metadata is not None:
                _PhoenixToolCallCallbackProviderMetadataAdapter.validate_python(phoenix_metadata)
        result_provider_metadata = tool_output.result_provider_metadata
        if (
            isinstance(result_provider_metadata, dict)
            and result_provider_metadata.get(_PHOENIX_PROVIDER_METADATA_KEY) is not None
        ):
            raise ValueError(
                "toolOutputs resultProviderMetadata has no schema for the "
                f"{_PHOENIX_PROVIDER_METADATA_KEY!r} namespace"
            )


class ChatRequestBody(_CamelBaseModel):
    """Assistant chat submit request payload."""

    headless: bool = Field(
        description=(
            "Whether a headless client (terminal or scripted) is driving the "
            "turn, as opposed to the browser assistant. Selects the agent "
            "configuration the turn runs on."
        ),
    )
    contexts: list[ChatContext] = Field(default_factory=list)
    edit_permission: Literal["manual", "bypass"] = "manual"
    requested_skills: list[str] = Field(
        default_factory=list,
        description=(
            "Skills the user explicitly requested via the prompt's slash-command "
            "affordance. The server force-loads each available skill by injecting a "
            "synthetic load_skill tool call/result at the tail of the message history. "
            "Unknown or context-unavailable names are ignored."
        ),
    )
    model: AgentModelSelection = Field(
        description=(
            "The model the client believes the session is set to. This is a "
            "precondition, not an instruction: the turn always runs on the "
            "session's persisted selection, and a mismatch is rejected with "
            "HTTP 409 and code ``agent_session_model_stale`` rather than "
            "silently running on — or switching to — an unexpected model. "
            "Change the session's model with "
            "``PATCH .../agent_sessions/{session_id}``."
        ),
    )
    trigger: Literal["submit-message"] = "submit-message"
    id: str
    message: PhoenixUIMessage | None = Field(
        default=None,
        description=(
            "The turn's new user message to append. May be omitted for client-tool "
            "continuation, where ``toolOutputs`` resolve the trailing "
            "assistant message's pending tool calls instead."
        ),
    )
    tool_outputs: list[ToolOutputUIPart] = Field(
        default_factory=list,
        description=(
            "Client-executed tool results for pending tool calls on the "
            "transcript's trailing assistant message, matched by "
            "``toolCallId``. Submitted alone they continue the assistant "
            "turn; submitted with ``message`` they resolve dangling tool "
            "calls before the new user turn runs."
        ),
    )
    last_message_id: str | None = Field(
        default=None,
        description=(
            "The id of the last transcript message the client has rendered, "
            "used for optimistic concurrency. Omit when the session has no "
            "messages; required (and validated against the persisted "
            "transcript) once it does. On mismatch the server rejects the "
            "send with HTTP 409 and code ``agent_session_messages_stale`` — the "
            "client should refetch the session before retrying."
        ),
    )
    record_local_traces: bool = False
    export_remote_traces: bool = False
    instrument_user_id: bool = Field(
        default=False,
        description=(
            "When true and the request is authenticated as a PhoenixUser, attaches "
            "the user's email as the OpenInference ``user.id`` span attribute on "
            "all traced work for this request."
        ),
    )

    @model_validator(mode="after")
    def _validate_turn_inputs(self) -> "ChatRequestBody":
        if self.message is None and not self.tool_outputs:
            raise ValueError("A chat submit request requires a message, toolOutputs, or both")
        if self.message is not None and self.message.role != "user":
            raise ValueError("Only user messages can be submitted")
        if (
            self.message is not None
            and self.message.metadata is not None
            and isinstance(self.message.metadata.phoenix, PhoenixUserMessageMetadata)
            and self.message.metadata.phoenix.is_compaction_message
        ):
            raise ValueError(
                "Compaction checkpoints are created by the compact route and cannot be submitted"
            )
        _validate_submitted_tool_outputs(self.tool_outputs)
        return self


class CreateAgentSessionRequestBody(V1RoutesBaseModel):
    """Request body for creating a persisted agent session."""

    model: AgentModelSelection
    title: str = Field(
        default="",
        max_length=MAX_AGENT_SESSION_TITLE_LENGTH,
        description="Optional initial title.",
    )
    is_ephemeral: bool = Field(
        default=False,
        description="Whether the session should expire after a period of inactivity.",
    )


class CreatedAgentSession(V1RoutesBaseModel):
    id: str = Field(
        description="The session's GlobalID — the ``session_id`` the chat route expects."
    )


class CreateAgentSessionResponseBody(ResponseBody[CreatedAgentSession]):
    pass


AgentSessionConflictCode = Literal[
    "agent_session_busy",
    "agent_session_model_stale",
    "agent_session_messages_stale",
    "agent_session_tool_outputs_conflict",
    "agent_session_already_compact",
    "agent_session_compaction_conflict",
]


class AgentSessionConflictError(V1RoutesBaseModel):
    """Body of every HTTP 409 returned by the agent session routes.

    - ``agent_session_busy``: another turn holds the session's turn lock.
    - ``agent_session_model_stale``: the request asserted a model the session
      is no longer set to; refetch the session before retrying.
    - ``agent_session_messages_stale``: the send's ``lastMessageId`` no longer
      matches the persisted transcript — another client appended; refetch the
      transcript and retry.
    - ``agent_session_tool_outputs_conflict``: the submitted ``toolOutputs`` do
      not match the transcript's trailing assistant message (no trailing
      assistant message to continue, an unknown ``toolCallId``, or a tool-name
      mismatch). Unlike ``agent_session_messages_stale`` this is not a
      concurrent-writer race but an inconsistent request; fix the client
      rather than retrying.
    - ``agent_session_already_compact``: there are no complete turns to
      compact — either nothing new has finished since the transcript's latest
      checkpoint, or a concurrent request's checkpoint already covers them.
      Not retryable; the conversation is as compact as it can get.
    - ``agent_session_compaction_conflict``: the conversation changed while it
      was being compacted; retry.
    """

    code: AgentSessionConflictCode = Field(
        description="Machine-readable reason the request conflicted."
    )
    message: str | None = Field(
        default=None,
        description="Optional human-readable elaboration on the conflict.",
    )


class AgentSessionConflict(Exception):
    """Signals a 409 conflict on an agent session route.

    Raising this unwinds any open database transaction, so nothing the
    conflicted request wrote is persisted. The app renders it as an
    ``AgentSessionConflictError`` body via ``agent_session_conflict_handler``.
    """

    def __init__(self, code: AgentSessionConflictCode, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code
        self.message = message


async def agent_session_conflict_handler(
    request: Request,
    exc: AgentSessionConflict,
) -> JSONResponse:
    body = AgentSessionConflictError(code=exc.code, message=exc.message)
    return JSONResponse(
        body.model_dump(mode="json", exclude_none=True),
        status_code=409,
    )


_CONFLICT_RESPONSES: dict[int | str, dict[str, Any]] = {
    409: {
        "model": AgentSessionConflictError,
        "description": (
            "The request conflicts with the session's current state; the body's "
            "``code`` field says how."
        ),
    }
}


class PatchAgentSessionRequestBody(V1RoutesBaseModel):
    """
    Fields to update on a persisted session. Omit a field to leave it unchanged.
    """

    title: str = Field(
        default=UNDEFINED,
        max_length=MAX_AGENT_SESSION_TITLE_LENGTH,
        description="New title for the session",
    )
    model: AgentModelSelection = Field(
        default=UNDEFINED,
        description="New model selection for the session",
    )


class AgentSessionSummary(V1RoutesBaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    is_ephemeral: bool


class AgentSessionData(AgentSessionSummary):
    model: AgentModelSelection
    is_active: bool = Field(
        description=(
            "Whether a response is currently streaming on this session, i.e. its "
            "lock has a live (non-stale) heartbeat."
        ),
    )
    last_message_id: str | None = Field(
        default=None,
        description=(
            "The message ID of the most recently persisted transcript message, or "
            "null for an empty transcript."
        ),
    )


class ListAgentSessionsResponseBody(PaginatedResponseBody[AgentSessionSummary]):
    pass


class GetAgentSessionResponseBody(ResponseBody[AgentSessionData]):
    pass


class PatchAgentSessionResponseBody(ResponseBody[AgentSessionData]):
    pass


class ListAgentSessionMessagesResponseBody(PaginatedResponseBody[PhoenixUIMessage]):
    pass


class CompactAgentSessionRequestBody(V1RoutesBaseModel):
    """Request a model-generated checkpoint for a persisted conversation."""

    model: AgentModelSelection = Field(
        description=(
            "The model the client believes the session is set to. As on the "
            "chat route this is a precondition: the summary is generated with "
            "the session's persisted selection, and a mismatch is rejected "
            "with HTTP 409 and code ``agent_session_model_stale``."
        ),
    )


class CompactAgentSessionResponseBody(ResponseBody[PhoenixUIMessage]):
    """The checkpoint message this request created. A 200 always means a new
    checkpoint was persisted; every other outcome is an HTTP 409 whose body's
    ``code`` says why (see ``AgentSessionConflictError``)."""


class SubmitAgentSessionToolOutputsRequestBody(_CamelBaseModel):
    """Persist resolved client tool outputs without continuing the turn."""

    tool_outputs: list[ToolOutputUIPart] = Field(
        min_length=1,
        description=(
            "Client tool results for pending calls on the trailing assistant "
            "message, matched by ``toolCallId``. Resending a persisted output "
            "verbatim is a no-op; an output that differs from the persisted "
            "result or matches no call is rejected with HTTP 409 and code "
            "``agent_session_tool_outputs_conflict``."
        ),
    )
    last_message_id: str = Field(
        description=(
            "The trailing assistant message's id. On mismatch the submission is rejected with HTTP "
            "409 and code ``agent_session_messages_stale``."
        ),
    )

    @model_validator(mode="after")
    def _validate_tool_outputs(self) -> "SubmitAgentSessionToolOutputsRequestBody":
        _validate_submitted_tool_outputs(self.tool_outputs)
        return self


class SubmitAgentSessionToolOutputsResponseBody(ResponseBody[PhoenixUIMessage]):
    """The trailing assistant message with the submitted outputs applied."""


_PydanticAIUIMessageListAdapter: TypeAdapter[list[PydanticAIUIMessage]] = TypeAdapter(
    list[PydanticAIUIMessage]
)


def _to_pydantic_ai_request_data(
    request_data: ChatRequestBody,
    *,
    messages: Sequence[PhoenixUIMessage],
) -> PydanticAISubmitMessage:
    """Validate wire types into pydantic-ai's runtime request classes."""
    return PydanticAISubmitMessage(
        id=request_data.id,
        messages=_PydanticAIUIMessageListAdapter.validate_python(
            [
                message.model_dump(mode="json", by_alias=True, exclude_none=True)
                for message in messages
            ]
        ),
    )


def _to_pydantic_ai_messages(messages: Sequence[PhoenixUIMessage]) -> list[ModelMessage]:
    ui_messages = _PydanticAIUIMessageListAdapter.validate_python(
        [message.model_dump(mode="json", by_alias=True, exclude_none=True) for message in messages]
    )
    return VercelAIAdapter.load_messages(ui_messages)


logger = logging.getLogger(__name__)


_AsyncGeneratorType = TypeVar("_AsyncGeneratorType")


def _is_async_generator(
    obj: AsyncIterator[_AsyncGeneratorType],
) -> TypeIs[AsyncGenerator[_AsyncGeneratorType, None]]:
    return all(
        hasattr(obj, name) for name in ("__aiter__", "__anext__", "asend", "athrow", "aclose")
    )


@dataclass
class _TurnTraceIds:
    trace_id: int
    root_span_id: int
    started_at: datetime


def _message_turn_trace_context(
    assistant_message: PhoenixUIMessage | None,
) -> TurnTraceContext | None:
    """The turn identity recorded in a persisted assistant message's metadata."""
    if assistant_message is None:
        return None
    metadata = assistant_message.metadata
    phoenix_metadata = metadata.phoenix if metadata is not None else None
    if not isinstance(phoenix_metadata, PhoenixAssistantMessageMetadata):
        return None
    return phoenix_metadata.turn_trace_context


def _resolve_turn_trace_ids(
    turn_trace_context: TurnTraceContext | None,
    *,
    now: datetime,
) -> _TurnTraceIds:
    """Adopt a valid continued turn trace context or mint a new turn identity."""
    if turn_trace_context is not None:
        trace_id = int(turn_trace_context.trace_id, 16)
        root_span_id = int(turn_trace_context.root_span_id, 16)
        if trace_id and root_span_id:
            continued_started_at = turn_trace_context.started_at
            if continued_started_at.tzinfo is None:
                continued_started_at = continued_started_at.replace(tzinfo=timezone.utc)
            started_at = min(max(continued_started_at, now - timedelta(hours=24)), now)
            return _TurnTraceIds(
                trace_id=trace_id,
                root_span_id=root_span_id,
                started_at=started_at,
            )
    id_generator = RandomIdGenerator()
    return _TurnTraceIds(
        trace_id=id_generator.generate_trace_id(),
        root_span_id=id_generator.generate_span_id(),
        started_at=now,
    )


def _turn_parent_context(ids: _TurnTraceIds) -> Context:
    span_context = SpanContext(
        trace_id=ids.trace_id,
        span_id=ids.root_span_id,
        is_remote=True,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )
    return trace_api.set_span_in_context(NonRecordingSpan(span_context), Context())


def _build_phoenix_assistant_message_metadata(
    *,
    turn_trace_context: TurnTraceContext | None,
    session_id: str,
    usage: RequestUsage | None,
    interrupted: bool = False,
) -> PhoenixAssistantMessageMetadata:
    """Build the metadata payload attached to the turn's assistant message."""
    return PhoenixAssistantMessageMetadata(
        type="assistant",
        session_id=session_id,
        turn_trace_context=turn_trace_context,
        usage=_build_usage_payload(usage) if usage is not None else None,
        interrupted=interrupted,
    )


def _build_message_metadata_chunk(
    *,
    turn_trace_context: TurnTraceContext | None,
    session_id: str,
    usage: RequestUsage,
) -> MessageMetadataChunk:
    """Build the `MessageMetadataChunk` emitted at the end of an agent turn."""
    return MessageMetadataChunk(
        message_metadata=MessageMetadata(
            phoenix=_build_phoenix_assistant_message_metadata(
                session_id=session_id,
                turn_trace_context=turn_trace_context,
                usage=usage,
            )
        )
    )


def _build_usage_payload(usage: RequestUsage) -> AssistantMessageMetadataUsage:
    """Convert the final model request's usage into the current context size."""
    usage_payload = AssistantMessageMetadataUsage(
        tokens=AssistantMessageMetadataUsageTokens(
            prompt=usage.input_tokens,
            completion=usage.output_tokens,
            total=usage.total_tokens,
        )
    )
    if usage.cache_read_tokens or usage.cache_write_tokens:
        usage_payload.prompt_details = AssistantMessageMetadataUsageCacheTokenDetails(
            cache_read=usage.cache_read_tokens,
            cache_write=usage.cache_write_tokens,
        )
    return usage_payload


def _get_current_context_usage(result: AgentRunResult[Any]) -> RequestUsage:
    """Return the tokens retained after the run's final model response."""
    return result.response.usage


def _get_span_context(context: Context | None) -> SpanContext | None:
    if context is None:
        return None
    span_context = get_current_span(context).get_span_context()
    return span_context if span_context.is_valid else None


def _parse_rfc3339(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def _clamp_datetime(value: datetime, lower: datetime, upper: datetime) -> datetime:
    return min(max(value, lower), upper)


def _get_last_user_text(messages: Iterable[UIMessage]) -> str | None:
    for message in reversed(list(messages)):
        if message.role != "user":
            continue
        for part in reversed(message.parts):
            if isinstance(part, TextUIPart):
                text = part.text.strip()
                return text or None
        return None
    return None


def _build_exception_event(*, message: str, timestamp: datetime) -> Event:
    """OTel semconv ``exception`` event for a synthetic error span. Client
    failures surface as bare messages, so no type or stacktrace is recorded."""
    return Event(
        name="exception",
        attributes={EXCEPTION_MESSAGE: message},
        timestamp=int(timestamp.timestamp() * 1e9),
    )


def _emit_turn_root_span(
    *,
    tracer: Tracer,
    turn_ids: _TurnTraceIds,
    session_id: str,
    input_text: str | None,
    output_text: str | None,
    error_message: str | None,
    end_time: datetime,
    user_email: str | None,
) -> None:
    attributes: dict[str, str] = {
        SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.AGENT.value,
        SpanAttributes.SESSION_ID: session_id,
    }
    if input_text is not None:
        attributes[SpanAttributes.INPUT_VALUE] = input_text
        attributes[SpanAttributes.INPUT_MIME_TYPE] = "text/plain"
    if output_text is not None:
        attributes[SpanAttributes.OUTPUT_VALUE] = output_text
        attributes[SpanAttributes.OUTPUT_MIME_TYPE] = "text/plain"
    if user_email is not None:
        attributes[SpanAttributes.USER_ID] = user_email
    status = (
        Status(StatusCode.ERROR, error_message)
        if error_message is not None
        else Status(StatusCode.OK)
    )
    span_end_time = max(end_time, turn_ids.started_at)
    events = (
        (_build_exception_event(message=error_message, timestamp=span_end_time),)
        if error_message is not None
        else ()
    )
    tracer.record_readable_span(
        build_synthetic_readable_span(
            name="pxi.turn",
            trace_id=turn_ids.trace_id,
            span_id=turn_ids.root_span_id,
            parent_span_id=None,
            start_time=turn_ids.started_at,
            end_time=span_end_time,
            attributes=attributes,
            status=status,
            events=events,
            resource=tracer.resource,
            instrumentation_scope=_PXI_INSTRUMENTATION_SCOPE,
        )
    )


@dataclass
class _ClientToolTimings:
    """Usable timestamps recovered from an echoed ``phoenix`` tool-call
    namespace (wire contract: ``PhoenixToolCallCallbackProviderMetadata``)."""

    emitted_at: datetime
    client_started_at: datetime | None
    client_ended_at: datetime | None


def _extract_client_tool_timings(provider_metadata: object) -> _ClientToolTimings | None:
    """Leniently pull client-tool execution timings out of returned
    ``callProviderMetadata``."""
    if not isinstance(provider_metadata, dict):
        return None
    phoenix_metadata = provider_metadata.get(_PHOENIX_PROVIDER_METADATA_KEY)
    if not isinstance(phoenix_metadata, dict):
        return None
    if phoenix_metadata.get("toolExecutionEnvironment") != "client":
        return None
    emitted_at = _parse_rfc3339(phoenix_metadata.get("toolInputEmittedAt"))
    if emitted_at is None:
        return None
    return _ClientToolTimings(
        emitted_at=emitted_at,
        client_started_at=_parse_rfc3339(phoenix_metadata.get("clientStartedAt")),
        client_ended_at=_parse_rfc3339(phoenix_metadata.get("clientEndedAt")),
    )


def _synthesize_client_tool_spans(
    *,
    tracer: Tracer,
    turn_ids: _TurnTraceIds,
    messages: Iterable[UIMessage],
    received_at: datetime,
    session_id: str,
) -> None:
    message_list = list(messages)
    last_user_index = max(
        (index for index, message in enumerate(message_list) if message.role == "user"),
        default=-1,
    )
    resolved_tool_types = (
        ToolOutputAvailablePart,
        ToolOutputErrorPart,
        DynamicToolOutputAvailablePart,
        DynamicToolOutputErrorPart,
    )
    for message in message_list[last_user_index + 1 :]:
        for part in message.parts:
            if not isinstance(part, resolved_tool_types):
                continue
            timings = _extract_client_tool_timings(part.call_provider_metadata)
            if timings is None:
                continue
            earliest_start_time = _clamp_datetime(
                timings.emitted_at,
                turn_ids.started_at,
                received_at,
            )
            start_time = (
                _clamp_datetime(timings.client_started_at, earliest_start_time, received_at)
                if timings.client_started_at is not None
                else earliest_start_time
            )
            end_time = (
                _clamp_datetime(timings.client_ended_at, start_time, received_at)
                if timings.client_ended_at is not None
                else received_at
            )
            tool_name = (
                part.tool_name
                if isinstance(
                    part,
                    (DynamicToolOutputAvailablePart, DynamicToolOutputErrorPart),
                )
                else part.type.removeprefix("tool-")
            )
            # Later requests may repeat earlier tool parts; deterministic
            # span IDs make persistence and remote ingestion idempotent.
            span_id = (
                int.from_bytes(
                    hashlib.sha256(
                        f"{turn_ids.trace_id:032x}/{part.tool_call_id}".encode()
                    ).digest()[:8],
                    "big",
                )
                or 1
            )
            attributes = {
                SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.TOOL.value,
                SpanAttributes.TOOL_NAME: tool_name,
                SpanAttributes.TOOL_ID: part.tool_call_id,
                SpanAttributes.INPUT_VALUE: json.dumps(part.input),
                SpanAttributes.INPUT_MIME_TYPE: "application/json",
                SpanAttributes.SESSION_ID: session_id,
            }
            events: tuple[Event, ...] = ()
            if isinstance(part, (ToolOutputErrorPart, DynamicToolOutputErrorPart)):
                attributes[SpanAttributes.OUTPUT_VALUE] = part.error_text
                attributes[SpanAttributes.OUTPUT_MIME_TYPE] = "text/plain"
                status = Status(StatusCode.ERROR, part.error_text)
                events = (_build_exception_event(message=part.error_text, timestamp=end_time),)
            else:
                attributes[SpanAttributes.OUTPUT_VALUE] = json.dumps(part.output)
                attributes[SpanAttributes.OUTPUT_MIME_TYPE] = "application/json"
                status = Status(StatusCode.OK)
            tracer.record_readable_span(
                build_synthetic_readable_span(
                    name=tool_name,
                    trace_id=turn_ids.trace_id,
                    span_id=span_id,
                    parent_span_id=turn_ids.root_span_id,
                    start_time=start_time,
                    end_time=end_time,
                    attributes=attributes,
                    status=status,
                    events=events,
                    resource=tracer.resource,
                    instrumentation_scope=_PXI_INSTRUMENTATION_SCOPE,
                )
            )


def _close_superseded_turn_trace(
    *,
    tracer: Tracer,
    turn_trace_context: TurnTraceContext,
    messages: Sequence[PhoenixUIMessage],
    received_at: datetime,
    session_id: str,
    user_email: str | None,
) -> None:
    """Emit the deferred root span of a pending turn this request superseded.

    A turn that ends awaiting client tool outputs defers its ``pxi.turn`` root
    span until a continuation completes the turn. When the next request is a
    new user message instead, that continuation never runs — without this
    close-out the turn's already-ingested child spans reference a root span id
    that is never written and the trace renders as orphaned spans. The tool
    calls the turn was still waiting on were repaired at merge time, so they
    are synthesized as spans first and the root is emitted around them.
    """
    turn_ids = _resolve_turn_trace_ids(turn_trace_context, now=received_at)
    _synthesize_client_tool_spans(
        tracer=tracer,
        turn_ids=turn_ids,
        messages=messages,
        received_at=received_at,
        session_id=session_id,
    )
    trailing_message = messages[-1] if messages else None
    output_text: str | None = None
    if trailing_message is not None and trailing_message.role == "assistant":
        output_text = (
            "".join(
                part.text for part in trailing_message.parts if isinstance(part, TextUIPart)
            ).strip()
            or None
        )
    _emit_turn_root_span(
        tracer=tracer,
        turn_ids=turn_ids,
        session_id=session_id,
        input_text=_get_last_user_text(messages),
        output_text=output_text,
        error_message="The turn was interrupted before its tool calls completed.",
        end_time=received_at,
        user_email=user_email,
    )


async def _persist_db_traces(
    *,
    session: AsyncSession,
    db_traces: list[models.Trace],
) -> tuple[int, ...]:
    project_ids = tuple(dict.fromkeys(db_trace.project_rowid for db_trace in db_traces))
    trace_ids = {db_trace.trace_id for db_trace in db_traces}
    project_sessions = [
        db_trace.project_session for db_trace in db_traces if db_trace.project_session is not None
    ]
    persistent_by_session_id = await _upsert_project_sessions(session, project_sessions)

    existing_traces_by_trace_id = {
        trace.trace_id: trace
        for trace in await session.scalars(
            select(models.Trace).where(
                models.Trace.trace_id.in_({db_trace.trace_id for db_trace in db_traces})
            )
        )
    }
    span_ids = {db_span.span_id for db_trace in db_traces for db_span in db_trace.spans}
    existing_span_ids = (
        set(
            await session.scalars(
                select(models.Span.span_id).where(models.Span.span_id.in_(span_ids))
            )
        )
        if span_ids
        else set()
    )
    traces_to_insert: list[models.Trace] = []
    spans_to_insert: list[models.Span] = []
    for db_trace in db_traces:
        # Only inserted traces should point at the persistent ProjectSession;
        # associating skipped transient traces causes autoflush warnings.
        persistent_project_session = (
            persistent_by_session_id[db_trace.project_session.session_id]
            if db_trace.project_session is not None
            else None
        )
        db_trace.spans = [
            db_span for db_span in db_trace.spans if db_span.span_id not in existing_span_ids
        ]
        existing_trace = existing_traces_by_trace_id.get(db_trace.trace_id)
        if existing_trace is None:
            if db_trace.spans:
                if persistent_project_session is not None:
                    db_trace.project_session = persistent_project_session
                traces_to_insert.append(db_trace)
            continue
        if db_trace.start_time < existing_trace.start_time:
            existing_trace.start_time = db_trace.start_time
        if existing_trace.end_time < db_trace.end_time:
            existing_trace.end_time = db_trace.end_time
        if existing_trace.project_session_rowid is None and persistent_project_session is not None:
            existing_trace.project_session = persistent_project_session
        if existing_trace.project_session is not None:
            if db_trace.start_time < existing_trace.project_session.start_time:
                existing_trace.project_session.start_time = db_trace.start_time
            if existing_trace.project_session.end_time < db_trace.end_time:
                existing_trace.project_session.end_time = db_trace.end_time
        # Copy before iterating: assigning `db_span.trace` back-populates
        # `Trace.spans`, removing the span from `db_trace.spans` mid-iteration
        # and silently skipping every other span in the batch.
        for db_span in list(db_trace.spans):
            db_span.trace = existing_trace
            if db_span.span_cost is not None:
                db_span.span_cost.trace = existing_trace
            spans_to_insert.append(db_span)
    session.add_all([*traces_to_insert, *spans_to_insert])
    await session.flush()
    await _refresh_cumulative_span_counts(session=session, trace_ids=trace_ids)
    return project_ids


async def _persist_db_traces_and_emit_event(
    *,
    db: DbSessionFactory,
    event_queue: CanPutItem[DmlEvent],
    db_traces: list[models.Trace],
) -> None:
    if not db_traces:
        return
    async with db() as session:
        project_ids = await _persist_db_traces(session=session, db_traces=db_traces)
    if project_ids:
        event_queue.put(SpanInsertEvent(project_ids))


async def _refresh_cumulative_span_counts(
    *,
    session: AsyncSession,
    trace_ids: set[str],
) -> None:
    if not trace_ids:
        return
    spans = list(
        await session.scalars(
            select(models.Span).join(models.Trace).where(models.Trace.trace_id.in_(trace_ids))
        )
    )
    counts = get_cumulative_counts(spans)
    for span, count in zip(spans, counts):
        span.cumulative_error_count = count.errors
        span.cumulative_llm_token_count_prompt = count.prompt_tokens
        span.cumulative_llm_token_count_completion = count.completion_tokens


async def _load_available_sandbox_backend_types(
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    runtime: SandboxRuntimeContext,
) -> frozenset[models.SandboxBackendType]:
    backend_info = await get_sandbox_backend_info(
        secrets=SecretsContext(session=session, decrypt=decrypt),
        runtime=runtime,
    )
    return frozenset(
        info.backend_type.value
        for info in backend_info
        if info.status is SandboxBackendStatus.AVAILABLE
    )


async def _load_sandbox_availability(
    session: AsyncSession,
    *,
    available_backend_types: frozenset[models.SandboxBackendType] | None = None,
) -> SandboxAvailability:
    """Compute the pre-turn ``has_usable`` gate for sandbox-backed capabilities.

    ``has_usable`` is true when at least one enabled ``SandboxConfig`` sits
    under an enabled provider. When ``available_backend_types`` is supplied it
    mirrors the code-evaluator form's backend-status filter, so the gate matches
    the set the mounted form can actually select. The selectable inventory is
    fetched on-demand by the agent via ``phoenix-gql``, not loaded here."""
    if available_backend_types is not None and not available_backend_types:
        return SandboxAvailability(has_usable=False)
    condition = (
        models.SandboxConfig.enabled.is_(True)
        & models.SandboxProvider.enabled.is_(True)
        & (models.SandboxProvider.backend_type == models.SandboxConfig.backend_type)
    )
    if available_backend_types is not None:
        condition &= models.SandboxConfig.backend_type.in_(available_backend_types)
    has_usable = bool(await session.scalar(select(exists().where(condition))))
    return SandboxAvailability(has_usable=has_usable)


def _decode_context_node_id(node_id: str | None, expected_type_name: str) -> int | None:
    if node_id is None:
        return None
    try:
        return from_global_id_with_expected_type(
            GlobalID.from_id(node_id),
            expected_type_name,
        )
    except ValueError:
        return None


def _contexts_need_sandbox_availability(contexts: ResolvedContexts) -> bool:
    return contexts.dataset is not None or contexts.code_evaluator is not None


def _subagents_enabled(contexts: ResolvedContexts) -> bool:
    """Whether the server-side subagent should be attached."""
    if get_env_phoenix_agents_disable_bash():
        return False
    return contexts.subagents is not None and contexts.subagents.enabled


def _load_model_provider_availability() -> ModelProviderAvailability:
    """Compute the pre-turn ``has_usable`` gate for model-provider-backed capabilities.

    ``has_usable`` is true when at least one generative provider has its SDK
    installed. This is env-independent (it checks installed packages, not
    credentials), so it is computed over the provider registry rather than the
    database. Per-request credentials can arrive at run time, so the gate
    deliberately ignores ``credentials_set`` to avoid hiding the tool."""
    has_usable = any(
        (client := PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, PROVIDER_DEFAULT))
        is not None
        and client.dependencies_are_installed()
        for provider_key in PLAYGROUND_CLIENT_REGISTRY.list_all_providers()
    )
    return ModelProviderAvailability(has_usable=has_usable)


def _contexts_need_model_provider_availability(contexts: ResolvedContexts) -> bool:
    # ``open_llm_evaluator_form`` gates on model-provider availability with no
    # ``llm_evaluator`` context, so a dataset-backed playground must also trigger the load.
    return contexts.dataset is not None or contexts.llm_evaluator is not None


def _resolve_trace_recording(
    *,
    record_local_traces: bool,
    export_remote_traces: bool,
    allow_local_traces: bool,
    allow_remote_export: bool,
) -> tuple[bool, bool]:
    if get_env_phoenix_agents_force_tracing():
        return True, True
    return (
        record_local_traces and allow_local_traces,
        export_remote_traces and allow_remote_export,
    )


def _resolve_attach_user_id(instrument_user_id: bool) -> bool:
    return get_env_phoenix_agents_force_tracing() or instrument_user_id


class _SubagentMessageChunksClosed:
    """Sentinel marking the subagent message chunk queue as closed."""


_SUBAGENT_MESSAGE_CHUNKS_CLOSED = _SubagentMessageChunksClosed()


async def _interleave_agent_and_subagent_message_chunks(
    *,
    agent_message_chunks: AsyncIterator[BaseChunk],
    subagent_message_chunks: asyncio.Queue[BaseChunk | _SubagentMessageChunksClosed],
    final_tool_outputs_by_tool_call_id: dict[str, ToolOutputAvailableChunk],
) -> AsyncIterator[BaseChunk]:
    async def _next_agent_message_chunk() -> BaseChunk:
        return await anext(agent_message_chunks)

    agent_task: asyncio.Task[BaseChunk] | None = asyncio.create_task(_next_agent_message_chunk())
    subagent_task: asyncio.Task[BaseChunk | _SubagentMessageChunksClosed] | None = (
        asyncio.create_task(subagent_message_chunks.get())
    )
    completed_tool_call_ids: set[str] = set()
    try:
        while agent_task is not None or subagent_task is not None:
            pending_tasks = {task for task in (agent_task, subagent_task) if task is not None}
            done_tasks, _ = await asyncio.wait(
                pending_tasks,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if agent_task is not None and agent_task in done_tasks:
                try:
                    agent_message_chunk = agent_task.result()
                except StopAsyncIteration:
                    agent_task = None
                    await subagent_message_chunks.put(_SUBAGENT_MESSAGE_CHUNKS_CLOSED)
                else:
                    if isinstance(agent_message_chunk, ToolOutputAvailableChunk):
                        final_tool_output = final_tool_outputs_by_tool_call_id.pop(
                            agent_message_chunk.tool_call_id,
                            None,
                        )
                        if final_tool_output is not None:
                            agent_message_chunk = agent_message_chunk.model_copy(
                                update={"output": final_tool_output.output}
                            )
                        if agent_message_chunk.preliminary is not True:
                            completed_tool_call_ids.add(agent_message_chunk.tool_call_id)
                    yield agent_message_chunk
                    agent_task = asyncio.create_task(_next_agent_message_chunk())

            if subagent_task is not None and subagent_task in done_tasks:
                subagent_message_chunk = subagent_task.result()
                if isinstance(subagent_message_chunk, _SubagentMessageChunksClosed):
                    subagent_task = None
                else:
                    # A queued progress chunk can arrive after the parent stream
                    # has emitted the terminal tool output. Do not let stale
                    # preliminary state overwrite the completed tool part.
                    if not (
                        isinstance(subagent_message_chunk, ToolOutputAvailableChunk)
                        and subagent_message_chunk.preliminary is True
                        and subagent_message_chunk.tool_call_id in completed_tool_call_ids
                    ):
                        yield subagent_message_chunk
                    subagent_task = asyncio.create_task(subagent_message_chunks.get())
    finally:
        tasks_to_cancel: list[asyncio.Task[Any]] = []
        if agent_task is not None:
            tasks_to_cancel.append(agent_task)
        if subagent_task is not None:
            tasks_to_cancel.append(subagent_task)
        for task in tasks_to_cancel:
            task.cancel()
        if tasks_to_cancel:
            await asyncio.gather(*tasks_to_cancel, return_exceptions=True)


async def _merge_session_summary_chunk(
    *,
    message_chunks: AsyncIterator[BaseChunk],
    summary_task: asyncio.Task[str | None],
) -> AsyncIterator[BaseChunk]:
    """Merge the session-summary chunk into the stream as soon as it is ready."""

    summary_settled = False

    async def _next_message_chunk() -> BaseChunk:
        return await anext(message_chunks)

    chunk_task: asyncio.Task[BaseChunk] | None = asyncio.create_task(_next_message_chunk())
    try:
        while chunk_task is not None and not summary_settled:
            done_tasks, _ = await asyncio.wait(
                {chunk_task, summary_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if summary_task in done_tasks:
                summary_settled = True
                if summary := summary_task.result():
                    yield SessionSummaryChunk(data=summary)
            if chunk_task in done_tasks:
                try:
                    message_chunk = chunk_task.result()
                except StopAsyncIteration:
                    chunk_task = None
                else:
                    if isinstance(message_chunk, FinishChunk) and not summary_settled:
                        # Hold the stream's closing chunk until the summary
                        # settles so the data chunk lands before `finish`.
                        summary_settled = True
                        if summary := await summary_task:
                            yield SessionSummaryChunk(data=summary)
                    yield message_chunk
                    chunk_task = (
                        asyncio.create_task(_next_message_chunk()) if not summary_settled else None
                    )
        if chunk_task is not None:
            try:
                message_chunk = await chunk_task
            except StopAsyncIteration:
                return
            finally:
                chunk_task = None
            yield message_chunk
        # The summary has settled or the stream is over: no more racing, so
        # pass the remaining chunks straight through.
        async for message_chunk in message_chunks:
            yield message_chunk
    finally:
        if chunk_task is not None:
            chunk_task.cancel()
            await asyncio.gather(chunk_task, return_exceptions=True)


async def _ensure_project_exists(db: DbSessionFactory, project_name: str) -> int:
    """Resolve project_id by name, creating the project row if missing."""
    async with db() as session:
        await session.execute(
            insert_on_conflict(
                {"name": project_name},
                table=models.Project,
                dialect=db.dialect,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )
        project_id = await session.scalar(select(models.Project.id).filter_by(name=project_name))
        assert project_id is not None
        return project_id


async def _upsert_project_sessions(
    session: AsyncSession,
    project_sessions: Iterable[models.ProjectSession],
) -> dict[str, models.ProjectSession]:
    """
    Upsert ProjectSession rows keyed by session_id, returning a
    {session_id: ProjectSession} map of persistent ORM objects (loaded into the
    session's identity map). Duplicates in the input are merged by session_id,
    widening the start/end time range across duplicates.
    """
    project_sessions_by_session_id: dict[str, models.ProjectSession] = {}
    for project_session in project_sessions:
        existing = project_sessions_by_session_id.get(project_session.session_id)
        if existing is None:
            project_sessions_by_session_id[project_session.session_id] = project_session
        else:
            if project_session.start_time < existing.start_time:
                existing.start_time = project_session.start_time
            if existing.end_time < project_session.end_time:
                existing.end_time = project_session.end_time

    if not project_sessions_by_session_id:
        return {}

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    records = [
        {
            "session_id": project_session.session_id,
            "project_id": project_session.project_id,
            "start_time": project_session.start_time,
            "end_time": project_session.end_time,
        }
        for project_session in project_sessions_by_session_id.values()
    ]
    upsert: Insert
    if dialect is SupportedSQLDialect.POSTGRESQL:
        pg_insert = insert_postgresql(models.ProjectSession).values(records)
        upsert = pg_insert.on_conflict_do_update(
            index_elements=["session_id"],
            set_={
                "start_time": func.least(
                    models.ProjectSession.start_time, pg_insert.excluded.start_time
                ),
                "end_time": func.greatest(
                    models.ProjectSession.end_time, pg_insert.excluded.end_time
                ),
            },
        )
    elif dialect is SupportedSQLDialect.SQLITE:
        # SQLite has no LEAST/GREATEST; min(a, b) / max(a, b) as scalar
        # functions (i.e. with >1 argument) are the equivalent.
        sqlite_insert = insert_sqlite(models.ProjectSession).values(records)
        upsert = sqlite_insert.on_conflict_do_update(
            index_elements=["session_id"],
            set_={
                "start_time": func.min(
                    models.ProjectSession.start_time, sqlite_insert.excluded.start_time
                ),
                "end_time": func.max(
                    models.ProjectSession.end_time, sqlite_insert.excluded.end_time
                ),
            },
        )
    else:
        assert_never(dialect)
    returned_rows = await session.scalars(upsert.returning(models.ProjectSession))
    return {row.session_id: row for row in returned_rows}


def _maybe_using_user(
    instrument_user_id: bool,
    phoenix_user_email: str | None,
) -> AbstractContextManager[Any]:
    """Return a ``using_user`` context manager when the opt-in is set and the
    authenticated PhoenixUser has an email; otherwise return a no-op.

    Attaches the Phoenix user email as the ``user.id`` OpenInference attribute
    to all spans created inside the context so traces can be filtered by user.
    """
    if instrument_user_id and phoenix_user_email:
        return using_user(phoenix_user_email)
    return nullcontext()


async def _load_phoenix_user_email(
    *,
    session: AsyncSession,
    phoenix_user: PhoenixUser | None,
) -> str | None:
    if phoenix_user is None:
        return None
    return await session.scalar(
        select(models.User.email).where(models.User.id == int(phoenix_user.identity))
    )


_UNRESOLVED_TOOL_PART_TYPES = (
    ToolInputStreamingPart,
    ToolInputAvailablePart,
    ToolApprovalRequestedPart,
    ToolApprovalRespondedPart,
    DynamicToolInputStreamingPart,
    DynamicToolInputAvailablePart,
    DynamicToolApprovalRequestedPart,
    DynamicToolApprovalRespondedPart,
)
"""Tool parts that have not reached a terminal output state."""

_DYNAMIC_UNRESOLVED_TOOL_PART_TYPES = (
    DynamicToolInputStreamingPart,
    DynamicToolInputAvailablePart,
    DynamicToolApprovalRequestedPart,
    DynamicToolApprovalRespondedPart,
)

_STATIC_UNRESOLVED_TOOL_PART_TYPES = (
    ToolInputStreamingPart,
    ToolInputAvailablePart,
    ToolApprovalRequestedPart,
    ToolApprovalRespondedPart,
)

_UnresolvedToolUIPart = (
    ToolInputStreamingPart
    | ToolInputAvailablePart
    | ToolApprovalRequestedPart
    | ToolApprovalRespondedPart
    | DynamicToolInputStreamingPart
    | DynamicToolInputAvailablePart
    | DynamicToolApprovalRequestedPart
    | DynamicToolApprovalRespondedPart
)


def _get_tool_execution_environment(
    part: _UnresolvedToolUIPart,
) -> ToolExecutionEnvironment | None:
    """Read the server-stamped execution environment off a tool part, if any."""
    if part.call_provider_metadata is None:
        return None
    phoenix_metadata = part.call_provider_metadata.get(_PHOENIX_PROVIDER_METADATA_KEY)
    if phoenix_metadata is None:
        return None
    metadata = _PhoenixToolCallCallbackProviderMetadataAdapter.validate_python(phoenix_metadata)
    return metadata.tool_execution_environment


def _interrupted_tool_output_text(part: _UnresolvedToolUIPart) -> str:
    environment = _get_tool_execution_environment(part)
    if environment is not None:
        return (
            "The tool call was interrupted before a result was produced: the "
            f"{environment} environment that executes this tool did not "
            "complete it."
        )
    return "The tool call was interrupted before a result was produced."


def _metadata_with_interrupted_outcome(
    provider_metadata: ProviderMetadata | None,
) -> ProviderMetadata:
    """Record pydantic-ai's ``'interrupted'`` tool outcome in ``callProviderMetadata``.

    The Vercel AI part states have no way to express an interrupted outcome, so
    ``VercelAIAdapter`` rides it on the ``pydantic_ai`` metadata namespace of a
    neutral ``output-available`` part; ``load_messages`` reads it back and
    restores ``ToolReturnPart(outcome='interrupted')`` for the model-facing
    transcript instead of degrading the outcome to a success or failure.
    """
    result: ProviderMetadata = deepcopy(provider_metadata) if provider_metadata else {}
    metadata = PydanticAIToolCallProviderMetadata.model_validate(
        result.get(_PYDANTIC_AI_PROVIDER_METADATA_KEY, {})
    )
    metadata.outcome = "interrupted"
    result[_PYDANTIC_AI_PROVIDER_METADATA_KEY] = metadata.model_dump(exclude_none=True)
    phoenix_payload = result.get(_PHOENIX_PROVIDER_METADATA_KEY)
    if phoenix_payload is not None:
        phoenix_metadata = _PhoenixToolCallCallbackProviderMetadataAdapter.validate_python(
            phoenix_payload
        )
        phoenix_metadata.outcome = "interrupted"
        result[_PHOENIX_PROVIDER_METADATA_KEY] = phoenix_metadata.model_dump(
            by_alias=True, exclude_none=True
        )
    return result


def _build_interrupted_tool_output(
    part: _UnresolvedToolUIPart,
) -> ToolOutputAvailablePart | DynamicToolOutputAvailablePart:
    """Close out an unresolved tool part as interrupted.

    An interruption is not a tool failure, so the part is resolved as a neutral
    ``output-available`` whose output text describes the interruption, with the
    ``'interrupted'`` outcome recorded in the metadata channel — the same
    representation ``VercelAIAdapter.dump_messages`` uses for a synthesized
    interrupted return.
    """
    output_text = _interrupted_tool_output_text(part)
    call_provider_metadata = _metadata_with_interrupted_outcome(part.call_provider_metadata)
    if isinstance(part, _DYNAMIC_UNRESOLVED_TOOL_PART_TYPES):
        return DynamicToolOutputAvailablePart(
            state="output-available",
            type="dynamic-tool",
            tool_name=part.tool_name,
            tool_call_id=part.tool_call_id,
            title=part.title,
            input=part.input,
            output=output_text,
            provider_executed=part.provider_executed,
            call_provider_metadata=call_provider_metadata,
            approval=part.approval,
        )
    if isinstance(part, _STATIC_UNRESOLVED_TOOL_PART_TYPES):
        return ToolOutputAvailablePart(
            state="output-available",
            type=part.type,
            tool_call_id=part.tool_call_id,
            title=part.title,
            input=part.input,
            output=output_text,
            provider_executed=part.provider_executed,
            call_provider_metadata=call_provider_metadata,
            approval=part.approval,
        )
    assert_never(part)


def _resolve_interrupted_tool_parts(message: PhoenixUIMessage) -> PhoenixUIMessage | None:
    """Rewrite an assistant message's unresolved tool parts as interrupted.

    Returns the rewritten message, or None when nothing was unresolved.
    """
    if message.role != "assistant":
        return None
    changed = False
    parts: list[UIMessagePart] = []
    for part in message.parts:
        if isinstance(part, _UNRESOLVED_TOOL_PART_TYPES):
            parts.append(_build_interrupted_tool_output(part))
            changed = True
        else:
            parts.append(part)
    if not changed:
        return None
    return message.model_copy(update={"parts": parts})


def _tool_output_matches_call(
    call: ToolUIPart | DynamicToolUIPart,
    output: ToolOutputUIPart,
) -> bool:
    """Whether a submitted output names the same tool as its persisted call."""
    if isinstance(output, DynamicToolOutputAvailablePart | DynamicToolOutputErrorPart):
        return isinstance(call, DynamicToolUIPart) and call.tool_name == output.tool_name
    if isinstance(output, ToolOutputAvailablePart | ToolOutputErrorPart):
        return isinstance(call, ToolUIPart) and call.type == output.type
    assert_never(output)


_ToolCallId = str
_MessageId = str
_PartIndex = int
"""A tool part's position within its message's ``parts`` list."""


def _apply_tool_outputs(
    message: PhoenixUIMessage,
    tool_outputs: Sequence[ToolOutputUIPart],
) -> PhoenixUIMessage | None:
    """Resolve the assistant message's pending tool calls with submitted outputs."""
    tool_calls_by_id: dict[_ToolCallId, tuple[_PartIndex, ToolUIPart | DynamicToolUIPart]] = {}
    for index, part in enumerate(message.parts):
        if isinstance(part, ToolUIPart | DynamicToolUIPart):
            tool_calls_by_id[part.tool_call_id] = (index, part)
    parts = list(message.parts)
    changed = False
    for tool_output in tool_outputs:
        matched_call = tool_calls_by_id.get(tool_output.tool_call_id)
        if matched_call is None:
            raise AgentSessionConflict(
                "agent_session_tool_outputs_conflict",
                (
                    f"Tool output {tool_output.tool_call_id!r} does not match a "
                    "tool call on the session's latest assistant message; "
                    "reload the conversation"
                ),
            )
        matched_index, call_part = matched_call
        if not _tool_output_matches_call(call_part, tool_output):
            raise AgentSessionConflict(
                "agent_session_tool_outputs_conflict",
                (
                    f"Tool output {tool_output.tool_call_id!r} names a different "
                    "tool than the persisted tool call; reload the conversation"
                ),
            )
        if not isinstance(call_part, _UNRESOLVED_TOOL_PART_TYPES):
            if call_part != tool_output:
                raise AgentSessionConflict(
                    "agent_session_tool_outputs_conflict",
                    (
                        f"Tool output {tool_output.tool_call_id!r} differs from "
                        "the persisted result for its already-resolved call; "
                        "reload the conversation"
                    ),
                )
            continue
        parts[matched_index] = tool_output
        changed = True
    if not changed:
        return None
    return message.model_copy(update={"parts": parts})


@dataclass
class _MergedTranscript:
    """A submit request merged into the persisted transcript."""

    messages: list[PhoenixUIMessage]
    """The model-facing transcript for this turn."""

    updated_messages: dict[_MessageId, PhoenixUIMessage]
    """Persisted messages rewritten by the merge (applied ``toolOutputs`` and
    interrupted-tool repairs); persist under the turn lock before the model runs."""

    continued_assistant_message: PhoenixUIMessage | None
    """The trailing assistant message this turn continues when the request
    carried only ``toolOutputs``; None for a new user turn."""

    superseded_assistant_message: PhoenixUIMessage | None
    """The trailing assistant message of a turn this request superseded.

    A turn that stops on unresolved client tool calls stays open: only a
    ``toolOutputs``-only request continues it, finishing the turn and emitting
    its deferred ``pxi.turn`` root span. A request carrying a new user message
    starts a new turn instead, superseding the open one — its dangling calls
    are resolved at merge time (by ``toolOutputs`` sent alongside the message,
    or repaired as interrupted without them), but the continuation that would
    have emitted the root span never runs. None when the request continues
    the turn or the tail had nothing pending."""


def _merge_messages(
    *,
    old_messages: Sequence[PhoenixUIMessage],
    new_message: PhoenixUIMessage | None,
    tool_outputs: Sequence[ToolOutputUIPart] = (),
) -> _MergedTranscript:
    messages = list(old_messages)
    updated_messages: dict[_MessageId, PhoenixUIMessage] = {}
    if tool_outputs:
        if not messages or messages[-1].role != "assistant":
            raise AgentSessionConflict(
                "agent_session_tool_outputs_conflict",
                (
                    "Tool outputs were submitted but the session's latest "
                    "transcript message is not an assistant message; reload "
                    "the conversation"
                ),
            )
        merged_tail = _apply_tool_outputs(messages[-1], tool_outputs)
        if merged_tail is not None:
            updated_messages[merged_tail.id] = merged_tail
            messages[-1] = merged_tail
    for index, message in enumerate(messages):
        repaired_message = _resolve_interrupted_tool_parts(message)
        if repaired_message is not None:
            updated_messages[repaired_message.id] = repaired_message
            messages[index] = repaired_message
    if new_message is not None:
        assert new_message.role == "user", "request validation rejects non-user messages"
        # A rewritten assistant tail means it still had pending tool calls —
        # a turn that ended awaiting outputs and is now superseded by the new
        # user message instead of continued.
        last_message = messages[-1] if messages else None
        last_message_had_pending_tool_calls = (
            last_message is not None
            and last_message.role == "assistant"
            and last_message.id in updated_messages
        )
        superseded_assistant_message = last_message if last_message_had_pending_tool_calls else None
        return _MergedTranscript(
            messages=[*messages, new_message],
            updated_messages=updated_messages,
            continued_assistant_message=None,
            superseded_assistant_message=superseded_assistant_message,
        )
    assert tool_outputs, "request validation requires a message, toolOutputs, or both"
    assert messages[-1].role == "assistant", "the tool-output branch guarantees an assistant tail"
    return _MergedTranscript(
        messages=messages,
        updated_messages=updated_messages,
        continued_assistant_message=messages[-1],
        superseded_assistant_message=None,
    )


async def _refresh_and_load_agent_session(
    session: AsyncSession,
    *,
    agent_session_id: str,
    user_id: int | None,
    for_update: bool = False,
) -> models.AgentSession:
    """Load and optionally lock an owner-qualified session, refreshing its activity."""
    try:
        agent_session_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(agent_session_id),
            models.AgentSession.__name__,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found") from None
    session_owner_filter = (
        models.AgentSession.user_id.is_(None)
        if user_id is None
        else models.AgentSession.user_id == user_id
    )
    statement = select(models.AgentSession).where(
        models.AgentSession.id == agent_session_rowid,
        session_owner_filter,
    )
    if for_update:
        statement = statement.with_for_update()
    if await session.scalar(statement) is None:
        raise HTTPException(status_code=404, detail="Session not found")
    # Bumping updated_at slides an ephemeral session's TTL window.
    refreshed_agent_session = await session.scalar(
        update(models.AgentSession)
        .where(models.AgentSession.id == agent_session_rowid)
        .values(updated_at=func.now())
        .returning(models.AgentSession)
    )
    if refreshed_agent_session is None:
        # An unlocked read can lose the row to a sweep before the bump lands.
        raise HTTPException(status_code=404, detail="Session not found")
    return refreshed_agent_session


_TURN_LOCK_HEARTBEAT_INTERVAL_SECONDS = 15
"""How often a streaming turn refreshes its turn lock heartbeat."""


async def _claim_agent_session_turn_lock(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> bool:
    """Atomically claim the session's turn lock.

    The conditional UPDATE succeeds only when no other turn holds a live
    heartbeat; a lock whose heartbeat is older than the staleness window is
    treated as abandoned and taken over.
    """
    now = datetime.now(timezone.utc)
    claimed_rowid = await session.scalar(
        update(models.AgentSession)
        .where(
            models.AgentSession.id == agent_session_rowid,
            or_(
                models.AgentSession.heartbeat_at.is_(None),
                models.AgentSession.heartbeat_at < now - TURN_LOCK_STALENESS,
            ),
        )
        .values(heartbeat_at=now)
        .returning(models.AgentSession.id)
    )
    return claimed_rowid is not None


async def _clear_agent_session_turn_lock(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> None:
    """Release the session's turn lock inside the caller's transaction."""
    await session.execute(
        update(models.AgentSession)
        .where(models.AgentSession.id == agent_session_rowid)
        .values(heartbeat_at=None)
    )


async def _claim_agent_session_turn_lock_for_model(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    session_model: AgentModelSelection,
    requested_model: AgentModelSelection,
) -> None:
    """Claim the session's turn lock while enforcing the request's model
    precondition.

    Raises ``AgentSessionConflict`` on failure; the raise rolls back the
    caller's transaction, so a claim taken before a stale-model rejection is
    never committed.
    """
    if not await _claim_agent_session_turn_lock(
        session,
        agent_session_rowid=agent_session_rowid,
    ):
        raise AgentSessionConflict("agent_session_busy")
    if requested_model != session_model:
        raise AgentSessionConflict("agent_session_model_stale")


async def _release_agent_session_turn_lock(
    db: DbSessionFactory,
    *,
    agent_session_rowid: int,
) -> None:
    """Unconditionally release the session's turn lock (single-owner semantics).

    Swallows and logs its own errors so callers (notably the stream generator's
    ``finally``, which also flushes traces) are never disrupted by the release.
    """
    try:
        async with db() as session:
            await _clear_agent_session_turn_lock(session, agent_session_rowid=agent_session_rowid)
    except Exception:
        logger.exception(
            "Failed to release turn lock for agent session %r",
            str(GlobalID("AgentSession", str(agent_session_rowid))),
        )


async def _heartbeat_agent_session_turn_lock(
    db: DbSessionFactory,
    *,
    agent_session_rowid: int,
) -> None:
    """Refresh the turn lock heartbeat periodically while a turn is streaming.

    Runs as an ``asyncio`` task and loops until cancelled.
    """
    while True:
        await asyncio.sleep(_TURN_LOCK_HEARTBEAT_INTERVAL_SECONDS)
        try:
            async with db() as session:
                await session.execute(
                    update(models.AgentSession)
                    .where(models.AgentSession.id == agent_session_rowid)
                    .values(heartbeat_at=datetime.now(timezone.utc))
                )
        except Exception:
            logger.exception(
                "Failed to refresh turn lock heartbeat for agent session %r",
                str(GlobalID("AgentSession", str(agent_session_rowid))),
            )


def _session_owner_filter(user_id: int | None) -> ColumnElement[bool]:
    return (
        models.AgentSession.user_id.is_(None)
        if user_id is None
        else models.AgentSession.user_id == user_id
    )


async def _refresh_agent_session(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    user_id: int | None,
) -> int | None:
    """Bump ``updated_at``; returns ``None`` if the session is gone or not owned."""
    return await session.scalar(
        update(models.AgentSession)
        .where(
            models.AgentSession.id == agent_session_rowid,
            _session_owner_filter(user_id),
        )
        .values(updated_at=func.now())
        .returning(models.AgentSession.id)
    )


async def _set_session_title_if_untitled(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    user_id: int | None,
    title: str,
) -> bool:
    title_was_applied = (
        await session.scalar(
            update(models.AgentSession)
            .where(
                models.AgentSession.id == agent_session_rowid,
                _session_owner_filter(user_id),
                models.AgentSession.title == "",  # do not clobber existing titles
            )
            .values(title=title)
            .returning(models.AgentSession.id)
        )
        is not None
    )
    return title_was_applied


async def _persist_agent_session_title(
    db: DbSessionFactory,
    *,
    agent_session_rowid: int,
    user_id: int | None,
    title: str,
) -> bool:
    try:
        async with db() as session:
            title_was_applied = await _set_session_title_if_untitled(
                session,
                agent_session_rowid=agent_session_rowid,
                user_id=user_id,
                title=truncate_agent_session_title(title),
            )
    except Exception:
        logger.exception(
            "Failed to persist title for agent session %r",
            str(GlobalID("AgentSession", str(agent_session_rowid))),
        )
        return False
    return title_was_applied


async def _upsert_agent_session_snapshot(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    bashkit_snapshot: bytes,
) -> None:
    await session.execute(
        insert_on_conflict(
            {
                "agent_session_id": agent_session_rowid,
                "bashkit_snapshot": bashkit_snapshot,
            },
            table=models.AgentSessionSnapshot,
            dialect=SupportedSQLDialect(session.bind.dialect.name),
            unique_by=("agent_session_id",),
            on_conflict=OnConflict.DO_UPDATE,
            set_={"bashkit_snapshot": bashkit_snapshot, "updated_at": func.now()},
        )
    )


async def _update_trailing_assistant_message(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    message: PhoenixUIMessage,
) -> None:
    """Replace the matching trailing assistant message or reject a stale continuation."""
    latest_message_rowid = (
        select(func.max(models.AgentSessionMessage.id))
        .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
        .scalar_subquery()
    )
    updated_message_rowid = await session.scalar(
        update(models.AgentSessionMessage)
        .where(
            models.AgentSessionMessage.agent_session_id == agent_session_rowid,
            models.AgentSessionMessage.id == latest_message_rowid,
            models.AgentSessionMessage.message_id == message.id,
        )
        .values(message=message)
        .returning(models.AgentSessionMessage.id)
    )
    if updated_message_rowid is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "The submitted assistant message is no longer the session's "
                "latest transcript message; reload the conversation"
            ),
        )


async def _persist_agent_session_turn(
    db: DbSessionFactory,
    *,
    agent_session_rowid: int,
    user_id: int | None,
    new_messages: list[PhoenixUIMessage],
    bashkit_snapshot: bytes | None,
) -> None:
    if not new_messages:
        return
    async with db() as session:
        refreshed_agent_session_rowid = await _refresh_agent_session(
            session,
            agent_session_rowid=agent_session_rowid,
            user_id=user_id,
        )
        if refreshed_agent_session_rowid is None:
            raise RuntimeError(
                f"Agent session {GlobalID('AgentSession', str(agent_session_rowid))!s} "
                "no longer exists"
            )
        if new_messages[0].role == "assistant":
            # Client-tool continuations replace the persisted assistant message.
            await _update_trailing_assistant_message(
                session,
                agent_session_rowid=agent_session_rowid,
                message=new_messages[0],
            )
            new_messages = new_messages[1:]
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                message=message,
            )
            for message in new_messages
        )
        if bashkit_snapshot is not None:
            await _upsert_agent_session_snapshot(
                session,
                agent_session_rowid=agent_session_rowid,
                bashkit_snapshot=bashkit_snapshot,
            )


def _transcript_persistence_error(db: DbSessionFactory) -> Exception:
    """The error shown when a turn ran but its transcript could not be written."""
    message = (
        "The assistant replied, but the conversation could not be saved, "
        "so this turn will be missing when you reload."
    )
    if db.should_not_insert_or_update:
        message += f" {insufficient_storage_message()}"
    return RuntimeError(message)


async def _load_bash_snapshot(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> bytes | None:
    return await session.scalar(
        select(models.AgentSessionSnapshot.bashkit_snapshot).where(
            models.AgentSessionSnapshot.agent_session_id == agent_session_rowid
        )
    )


async def _load_agent_session_history(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> list[models.AgentSessionMessage]:
    """Load messages from the latest surviving compaction point onward."""
    latest_compaction_rowid = (
        select(models.AgentSessionMessage.id)
        .where(
            models.AgentSessionMessage.agent_session_id == agent_session_rowid,
            models.AgentSessionMessage.is_compaction_message,
        )
        .order_by(models.AgentSessionMessage.id.desc())
        .limit(1)
        .scalar_subquery()
    )
    return list(
        await session.scalars(
            select(models.AgentSessionMessage)
            .where(
                models.AgentSessionMessage.agent_session_id == agent_session_rowid,
                models.AgentSessionMessage.id >= func.coalesce(latest_compaction_rowid, 0),
            )
            .order_by(models.AgentSessionMessage.id)
        )
    )


def _build_compaction_message(*, message_id: str, summary: str) -> PhoenixUIMessage:
    """Build the durable user-role message used as a compaction checkpoint."""
    return PhoenixUIMessage(
        id=message_id,
        role="user",
        metadata=MessageMetadata(
            phoenix=PhoenixUserMessageMetadata(
                type="user",
                current_date_time=datetime.now(timezone.utc).isoformat(),
                time_zone="UTC",
                is_compaction_message=True,
            )
        ),
        parts=[TextUIPart(type="text", text=summary)],
    )


def _get_request_user_id(request: Request) -> int | None:
    if not request.app.state.authentication_enabled:
        return None
    user = request.user if "user" in request.scope else None
    if not isinstance(user, PhoenixUser):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return int(user.identity)


def _parse_agent_session_cursor(cursor: str) -> Cursor:
    try:
        parsed_cursor = Cursor.from_string(cursor)
    except (binascii.Error, KeyError, UnicodeDecodeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Invalid cursor format") from error
    sort_column = parsed_cursor.sort_column
    if (
        sort_column is None
        or sort_column.type is not CursorSortColumnDataType.DATETIME
        or not isinstance(sort_column.value, datetime)
    ):
        raise HTTPException(status_code=422, detail="Invalid cursor format")
    return parsed_cursor


def _parse_agent_session_message_cursor(cursor: str) -> Cursor:
    """Parse a rowid-only keyset cursor for the session transcript."""
    try:
        return Cursor.from_string(cursor)
    except (binascii.Error, KeyError, UnicodeDecodeError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Invalid cursor format") from error


def _to_agent_session_summary(agent_session: models.AgentSession) -> AgentSessionSummary:
    return AgentSessionSummary(
        id=str(GlobalID(models.AgentSession.__name__, str(agent_session.id))),
        title=agent_session.title,
        created_at=agent_session.created_at,
        updated_at=agent_session.updated_at,
        is_ephemeral=agent_session.is_ephemeral,
    )


def create_agents_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [
        Depends(is_agent_assistant_enabled),
        Depends(prevent_access_in_read_only_mode),
        Depends(restrict_access_by_viewers),
        Depends(is_not_locked),
    ]
    if authentication_enabled:
        dependencies.append(Depends(is_authenticated))
    router = APIRouter(prefix="/v1", tags=["chat"], dependencies=dependencies)

    @router.post(
        "/agent_sessions",
        operation_id="createAgentSession",
        status_code=201,
        response_model_by_alias=True,
        response_model_exclude_unset=True,
        responses=add_errors_to_responses([400, 401, 403, 404, 422, 507]),
    )
    async def create_session(
        request: Request,
        request_body: CreateAgentSessionRequestBody,
    ) -> CreateAgentSessionResponseBody:
        """Create a persisted agent session owned by the requesting user."""
        try:
            title = validate_agent_session_title(request_body.title, allow_empty=True)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        try:
            async with request.app.state.db() as session:
                routing = await resolve_model_routing(session, request_body.model)
                agent_session = models.AgentSession(
                    user_id=int(phoenix_user.identity) if phoenix_user is not None else None,
                    title=title,
                    project_name=get_env_phoenix_agents_assistant_project_name(),
                    is_ephemeral=request_body.is_ephemeral,
                    model_provider=routing.model_provider,
                    model_name=routing.model_name,
                    custom_provider_id=routing.custom_provider_id,
                )
                session.add(agent_session)
                await session.flush()
                agent_session_rowid = agent_session.id
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        return CreateAgentSessionResponseBody(
            data=CreatedAgentSession(
                id=str(GlobalID(models.AgentSession.__name__, str(agent_session_rowid)))
            )
        )

    @router.patch(
        "/agent_sessions/{session_id}",
        operation_id="patchAgentSession",
        response_model=PatchAgentSessionResponseBody,
        response_model_by_alias=True,
        response_model_exclude_unset=True,
        responses=add_errors_to_responses(
            [400, 401, 403, 404, 422, 507],
            responses=dict(_CONFLICT_RESPONSES),
        ),
    )
    async def patch_session(
        session_id: str,
        request: Request,
        request_body: PatchAgentSessionRequestBody,
    ) -> PatchAgentSessionResponseBody:
        """Update a persisted session's mutable fields."""
        if request_body.title is UNDEFINED and request_body.model is UNDEFINED:
            raise HTTPException(status_code=422, detail="No fields to update")
        title: str | None = None
        if request_body.title is not UNDEFINED:
            try:
                title = validate_agent_session_title(request_body.title, allow_empty=False)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
        try:
            async with request.app.state.db() as session:
                agent_session = await _refresh_and_load_agent_session(
                    session,
                    agent_session_id=session_id,
                    user_id=_get_request_user_id(request),
                    for_update=True,
                )
                if title is not None:
                    agent_session.title = title
                if request_body.model is not UNDEFINED:
                    if is_turn_active(
                        agent_session.heartbeat_at,
                        now=datetime.now(timezone.utc),
                    ):
                        raise AgentSessionConflict("agent_session_busy")
                    await set_session_model(
                        session,
                        agent_session=agent_session,
                        model=request_body.model,
                    )
                await session.flush()
                await session.refresh(agent_session)
                summary = _to_agent_session_summary(agent_session)
                data = AgentSessionData(
                    **summary.model_dump(),
                    model=get_agent_session_model(agent_session),
                    is_active=False,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        return PatchAgentSessionResponseBody(data=data)

    @router.get(
        "/agent_sessions",
        operation_id="listAgentSessions",
        response_model_by_alias=True,
        response_model_exclude_unset=True,
        response_model_exclude_defaults=True,
        responses=add_errors_to_responses([401, 403, 404, 422]),
    )
    async def list_sessions(
        request: Request,
        cursor: str | None = Query(default=None, description="Opaque pagination cursor."),
        limit: int = Query(default=20, gt=0, le=100),
    ) -> ListAgentSessionsResponseBody:
        """List the viewer's persisted sessions, most recently active first."""
        statement = select(models.AgentSession).where(models.AgentSession.is_ephemeral.is_(False))
        if (user_id := _get_request_user_id(request)) is not None:
            statement = statement.where(models.AgentSession.user_id == user_id)
        if cursor is not None:
            parsed_cursor = _parse_agent_session_cursor(cursor)
            assert parsed_cursor.sort_column is not None
            statement = statement.where(
                tuple_(models.AgentSession.updated_at, models.AgentSession.id)
                < (parsed_cursor.sort_column.value, parsed_cursor.rowid)
            )
        statement = statement.order_by(
            models.AgentSession.updated_at.desc(),
            models.AgentSession.id.desc(),
        ).limit(limit + 1)
        async with request.app.state.db() as session:
            agent_sessions = list((await session.scalars(statement)).all())

        has_next_page = len(agent_sessions) > limit
        agent_sessions = agent_sessions[:limit]
        next_cursor = None
        if has_next_page and agent_sessions:
            last_session = agent_sessions[-1]
            next_cursor = str(
                Cursor(
                    rowid=last_session.id,
                    sort_column=CursorSortColumn(
                        type=CursorSortColumnDataType.DATETIME,
                        value=last_session.updated_at,
                    ),
                )
            )
        return ListAgentSessionsResponseBody(
            data=[_to_agent_session_summary(agent_session) for agent_session in agent_sessions],
            next_cursor=next_cursor,
        )

    @router.get(
        "/agent_sessions/{session_id}",
        operation_id="getAgentSession",
        response_model_by_alias=True,
        response_model_exclude_unset=True,
        responses=add_errors_to_responses([401, 403, 404]),
    )
    async def get_session(
        session_id: str,
        request: Request,
    ) -> GetAgentSessionResponseBody:
        """Retrieve an owned session's metadata."""
        try:
            session_rowid = from_global_id_with_expected_type(
                GlobalID.from_id(session_id), models.AgentSession.__name__
            )
        except ValueError as error:
            raise HTTPException(status_code=404, detail="Agent session not found") from error

        statement = select(models.AgentSession).where(models.AgentSession.id == session_rowid)
        if (user_id := _get_request_user_id(request)) is not None:
            statement = statement.where(models.AgentSession.user_id == user_id)
        async with request.app.state.db() as session:
            agent_session = await session.scalar(statement)
            if agent_session is None:
                raise HTTPException(status_code=404, detail="Agent session not found")
            last_message_id = await session.scalar(
                select(models.AgentSessionMessage.message_id)
                .where(models.AgentSessionMessage.agent_session_id == session_rowid)
                .order_by(models.AgentSessionMessage.id.desc())
                .limit(1)
            )

        summary = _to_agent_session_summary(agent_session)
        return GetAgentSessionResponseBody(
            data=AgentSessionData(
                **summary.model_dump(),
                model=get_agent_session_model(agent_session),
                is_active=is_turn_active(
                    agent_session.heartbeat_at,
                    now=datetime.now(timezone.utc),
                ),
                last_message_id=last_message_id,
            )
        )

    @router.get(
        "/agent_sessions/{session_id}/messages",
        operation_id="listAgentSessionMessages",
        response_model_by_alias=True,
        response_model_exclude_unset=True,
        # AI SDK part types and tool states are required on the wire but modeled as defaults.
        # Do not set response_model_exclude_defaults=True here.
        responses=add_errors_to_responses([401, 403, 404, 422]),
    )
    async def list_session_messages(
        session_id: str,
        request: Request,
        cursor: str | None = Query(default=None, description="Opaque pagination cursor."),
        limit: int = Query(default=100, gt=0, le=1000),
    ) -> ListAgentSessionMessagesResponseBody:
        """Page through an owned session's persisted transcript, oldest first."""
        try:
            session_rowid = from_global_id_with_expected_type(
                GlobalID.from_id(session_id), models.AgentSession.__name__
            )
        except ValueError as error:
            raise HTTPException(status_code=404, detail="Agent session not found") from error

        session_statement = select(models.AgentSession.id).where(
            models.AgentSession.id == session_rowid
        )
        if (user_id := _get_request_user_id(request)) is not None:
            session_statement = session_statement.where(models.AgentSession.user_id == user_id)
        statement = select(models.AgentSessionMessage).where(
            models.AgentSessionMessage.agent_session_id == session_rowid
        )
        if cursor is not None:
            parsed_cursor = _parse_agent_session_message_cursor(cursor)
            statement = statement.where(models.AgentSessionMessage.id > parsed_cursor.rowid)
        statement = statement.order_by(models.AgentSessionMessage.id).limit(limit + 1)
        async with request.app.state.db() as session:
            if await session.scalar(session_statement) is None:
                raise HTTPException(status_code=404, detail="Agent session not found")
            message_rows = list((await session.scalars(statement)).all())

        has_next_page = len(message_rows) > limit
        message_rows = message_rows[:limit]
        next_cursor = None
        if has_next_page and message_rows:
            next_cursor = str(Cursor(rowid=message_rows[-1].id))
        return ListAgentSessionMessagesResponseBody(
            data=[message_row.message for message_row in message_rows],
            next_cursor=next_cursor,
        )

    @router.post(
        "/agent_sessions/{session_id}/compact",
        operation_id="compactAgentSession",
        response_model=CompactAgentSessionResponseBody,
        response_model_exclude_none=True,
        responses=add_errors_to_responses(
            [400, 401, 403, 404, 502, 507],
            responses=dict(_CONFLICT_RESPONSES),
        ),
    )
    async def compact_agent_session(
        session_id: str,
        request: Request,
        request_body: CompactAgentSessionRequestBody,
    ) -> CompactAgentSessionResponseBody:
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        request_user_id = int(phoenix_user.identity) if phoenix_user is not None else None
        db_session_factory: DbSessionFactory = request.app.state.db

        async with db_session_factory() as session:
            agent_session = await _refresh_and_load_agent_session(
                session,
                agent_session_id=session_id,
                user_id=request_user_id,
            )
            agent_session_rowid = agent_session.id
            session_model = get_agent_session_model(agent_session)
            await _claim_agent_session_turn_lock_for_model(
                session,
                agent_session_rowid=agent_session_rowid,
                session_model=session_model,
                requested_model=request_body.model,
            )

        heartbeat_task = asyncio.create_task(
            _heartbeat_agent_session_turn_lock(
                db_session_factory,
                agent_session_rowid=agent_session_rowid,
            )
        )
        try:
            async with db_session_factory() as session:
                message_rows = await _load_agent_session_history(
                    session,
                    agent_session_rowid=agent_session_rowid,
                )
                first_row = message_rows[0] if message_rows else None
                latest_compaction = (
                    first_row if first_row is not None and first_row.is_compaction_message else None
                )
                latest_row = message_rows[-1] if message_rows else None
                if latest_row is None or latest_row.message.role != "assistant":
                    raise AgentSessionConflict(
                        "agent_session_already_compact",
                        "No complete turns have finished since the last checkpoint",
                    )
                boundary_row = latest_row
                messages_to_summarize = [row.message for row in message_rows]

            model = await build_model(
                session_model,
                db=db_session_factory,
                decrypt=request.app.state.decrypt,
            )
            summary_messages = _to_pydantic_ai_messages(messages_to_summarize)
            summary = await summarize_messages_for_compaction(
                messages=summary_messages,
                model=model,
            )

            async with db_session_factory() as session:
                await _refresh_and_load_agent_session(
                    session,
                    agent_session_id=session_id,
                    user_id=request_user_id,
                    for_update=True,
                )
                current_history = await _load_agent_session_history(
                    session,
                    agent_session_rowid=agent_session_rowid,
                )
                current_first_row = current_history[0] if current_history else None
                current_compaction = (
                    current_first_row
                    if current_first_row is not None and current_first_row.is_compaction_message
                    else None
                )
                if current_compaction is not None and (
                    latest_compaction is None or current_compaction.id != latest_compaction.id
                ):
                    # A concurrent request's checkpoint landed while this one
                    # was summarizing; its checkpoint already covers these
                    # turns, so the conversation is already compact.
                    raise AgentSessionConflict(
                        "agent_session_already_compact",
                        "The conversation was compacted by a concurrent request",
                    )
                current_latest_row = current_history[-1] if current_history else None
                if (
                    current_latest_row is None
                    or current_latest_row.id != boundary_row.id
                    or current_latest_row.message != boundary_row.message
                ):
                    raise AgentSessionConflict(
                        "agent_session_compaction_conflict",
                        "The conversation changed while it was being compacted; try again",
                    )
                compaction_message = _build_compaction_message(
                    message_id=str(uuid4()),
                    summary=summary,
                )
                compaction_message_row = models.AgentSessionMessage(
                    agent_session_id=agent_session_rowid,
                    message=compaction_message,
                )
                session.add(compaction_message_row)
            return CompactAgentSessionResponseBody(data=compaction_message)
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        except CompactionError as exc:
            raise HTTPException(
                status_code=502, detail=f"Conversation compaction failed: {exc}"
            ) from exc
        finally:
            heartbeat_task.cancel()
            await _release_agent_session_turn_lock(
                db_session_factory,
                agent_session_rowid=agent_session_rowid,
            )

    @router.post(
        "/agent_sessions/{session_id}/tool_outputs",
        operation_id="submitAgentSessionToolOutputs",
        response_model_by_alias=True,
        response_model_exclude_unset=True,
        responses=add_errors_to_responses(
            [400, 401, 403, 404, 507],
            responses=dict(_CONFLICT_RESPONSES),
        ),
    )
    async def submit_agent_session_tool_outputs(
        session_id: str,
        request: Request,
        request_body: SubmitAgentSessionToolOutputsRequestBody,
    ) -> SubmitAgentSessionToolOutputsResponseBody:
        """Persist resolved client tool outputs for the session's open turn."""
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        request_user_id = int(phoenix_user.identity) if phoenix_user is not None else None
        db_session_factory: DbSessionFactory = request.app.state.db
        async with db_session_factory() as session:
            agent_session = await _refresh_and_load_agent_session(
                session,
                agent_session_id=session_id,
                user_id=request_user_id,
            )
            agent_session_rowid = agent_session.id
            # Claim the turn lock before reading the trailing message so
            # concurrent submissions serialize instead of overwriting each
            # other's outputs.
            if not await _claim_agent_session_turn_lock(
                session,
                agent_session_rowid=agent_session_rowid,
            ):
                raise AgentSessionConflict("agent_session_busy")
            latest_row = await session.scalar(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
                .order_by(models.AgentSessionMessage.id.desc())
                .limit(1)
            )
            if latest_row is None or latest_row.message_id != request_body.last_message_id:
                raise AgentSessionConflict("agent_session_messages_stale")
            latest_message = latest_row.message
            if latest_message.role != "assistant":
                raise AgentSessionConflict(
                    "agent_session_tool_outputs_conflict",
                    (
                        "Tool outputs were submitted but the session's latest "
                        "transcript message is not an assistant message; reload "
                        "the conversation"
                    ),
                )
            updated_message = _apply_tool_outputs(latest_message, request_body.tool_outputs)
            if updated_message is not None:
                latest_row.message = updated_message
            await _clear_agent_session_turn_lock(
                session,
                agent_session_rowid=agent_session_rowid,
            )
        return SubmitAgentSessionToolOutputsResponseBody(
            data=updated_message if updated_message is not None else latest_message
        )

    @router.post(
        "/agent_sessions/{session_id}/chat",
        operation_id="agentSessionChat",
        responses=add_errors_to_responses(
            [400, 401, 403, 404, 507],
            responses=dict(_CONFLICT_RESPONSES),
        ),
    )
    async def chat(
        session_id: str,
        request: Request,
        request_body: ChatRequestBody,
    ) -> Response:
        if request_body.headless and get_env_phoenix_agents_disable_bash():
            raise HTTPException(status_code=403, detail="Headless agent is disabled")
        body = request_body
        db_session_factory: DbSessionFactory = request.app.state.db
        request_received_at = datetime.now(timezone.utc)
        instrument_user_id = _resolve_attach_user_id(body.instrument_user_id)
        recording = request.app.state.system_settings.agent_trace_recording
        record_local_traces, export_remote_traces = _resolve_trace_recording(
            record_local_traces=body.record_local_traces,
            export_remote_traces=body.export_remote_traces,
            allow_local_traces=recording.allow_local_traces,
            allow_remote_export=recording.allow_remote_export,
        )
        resolved_contexts = resolve_contexts(body.contexts)
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        request_user_id = int(phoenix_user.identity) if phoenix_user is not None else None
        is_viewer = phoenix_user.is_viewer if phoenix_user is not None else False
        subagents_enabled = _subagents_enabled(resolved_contexts)
        graphql_mutations_enabled = (
            resolved_contexts.graphql is not None and resolved_contexts.graphql.mutations_enabled
        )
        phoenix_user_email: str | None = None
        initial_bash_snapshot: bytes | None = None
        try:
            async with request.app.state.db() as session:
                agent_session = await _refresh_and_load_agent_session(
                    session,
                    agent_session_id=session_id,
                    user_id=request_user_id,
                )
                session_history = await _load_agent_session_history(
                    session,
                    agent_session_rowid=agent_session.id,
                )
                expected_last_message_id = (
                    session_history[-1].message_id if session_history else None
                )
                if body.last_message_id != expected_last_message_id:
                    raise AgentSessionConflict("agent_session_messages_stale")
                merged_transcript = _merge_messages(
                    old_messages=[row.message for row in session_history],
                    new_message=body.message,
                    tool_outputs=body.tool_outputs,
                )
                transcript_messages = merged_transcript.messages
                session_model = get_agent_session_model(agent_session)
                await _claim_agent_session_turn_lock_for_model(
                    session,
                    agent_session_rowid=agent_session.id,
                    session_model=session_model,
                    requested_model=body.model,
                )
                # Persist merge rewrites under the turn lock, before the model
                # runs, so the transcript stays accurate even if the turn fails.
                for message_row in session_history:
                    updated_message = merged_transcript.updated_messages.get(message_row.message_id)
                    if updated_message is not None:
                        message_row.message = updated_message
                project_name = agent_session.project_name
                session_needs_title = not agent_session.title
                agent_session_rowid = agent_session.id
                otel_session_id = get_otel_session_id(
                    project_name=project_name,
                    agent_session_rowid=agent_session_rowid,
                    agent_session_created_at=agent_session.created_at,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        try:
            try:
                tracer = (
                    Tracer(
                        span_cost_calculator=request.app.state.span_cost_calculator,
                        enable_remote_export=export_remote_traces,
                        project_name=project_name,
                    )
                    if (record_local_traces or export_remote_traces)
                    else None
                )
                tracer_provider = tracer.tracer_provider if tracer is not None else None
                sandbox_availability = SandboxAvailability()
                model_provider_availability = ModelProviderAvailability()
                agent_supports_availability_gate = not body.headless
                async with request.app.state.db() as session:
                    if agent_supports_availability_gate:
                        if _contexts_need_sandbox_availability(resolved_contexts):
                            available_backend_types = await _load_available_sandbox_backend_types(
                                session=session,
                                decrypt=request.app.state.decrypt,
                                runtime=request.app.state.sandbox_runtime,
                            )
                            sandbox_availability = await _load_sandbox_availability(
                                session,
                                available_backend_types=available_backend_types,
                            )
                        if _contexts_need_model_provider_availability(resolved_contexts):
                            model_provider_availability = _load_model_provider_availability()
                    phoenix_user_email = await _load_phoenix_user_email(
                        session=session,
                        phoenix_user=phoenix_user,
                    )
                    initial_bash_snapshot = await _load_bash_snapshot(
                        session,
                        agent_session_rowid=agent_session_rowid,
                    )
                model = await build_model(
                    session_model,
                    db=db_session_factory,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
            except AgentError as exc:
                raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

            if (browser_clock := _resolve_browser_clock(transcript_messages)) is not None:
                resolved_contexts.app = browser_clock

            web_access_enabled = (
                resolved_contexts.web_access is not None
                and resolved_contexts.web_access.enabled
                and get_env_phoenix_agents_web_access_enabled()
            )
            subagent_message_chunks: asyncio.Queue[BaseChunk | _SubagentMessageChunksClosed] = (
                asyncio.Queue()
            )
            final_tool_outputs_by_tool_call_id: dict[str, ToolOutputAvailableChunk] = {}

            bash_enabled = not get_env_phoenix_agents_disable_bash()
            bash_snapshot_to_persist: bytes | None = None

            def _capture_bash_snapshot(snapshot: bytes) -> None:
                nonlocal bash_snapshot_to_persist
                bash_snapshot_to_persist = snapshot

            agent_prompts = AgentPrompts()
            forced_skills: list[Skill] = []
            continued_assistant_message = merged_transcript.continued_assistant_message
            server_message_id = (
                continued_assistant_message.id
                if continued_assistant_message is not None
                else str(uuid4())
            )
            model_transcript_messages = transcript_messages
            compaction_history: list[ModelMessage] = []

            adapter: VercelAIAdapter[AgentDependencies, AgentOutput] | VercelAIAdapter[None, str]
            run_agent_stream: Callable[
                [Callable[[AgentRunResult[Any]], AsyncIterator[BaseChunk]]],
                AsyncIterator[BaseChunk],
            ]
            if body.headless:
                server_agent = build_server_agent(
                    model=model,
                    schema=request.app.state.graphql_schema,
                    build_graphql_context=lambda: request.app.state.build_graphql_context(
                        phoenix_user
                    ),
                    db=request.app.state.db,
                    event_queue=request.state.event_queue,
                    prompts=ServerAgentPrompts(base=agent_prompts.base),
                    docs_mcp_server=request.app.state.docs_mcp_server,
                    enable_web_access=web_access_enabled,
                    allow_mutations=graphql_mutations_enabled,
                    read_only=request.app.state.read_only,
                    auth_enabled=request.app.state.authentication_enabled,
                    user_id=request_user_id,
                    is_viewer=is_viewer,
                    tracer_provider=tracer_provider,
                    enable_subagents=subagents_enabled,
                    initial_bash_snapshot=initial_bash_snapshot,
                    on_bash_snapshot=_capture_bash_snapshot,
                )
                server_agent_adapter: VercelAIAdapter[None, str] = VercelAIAdapter(
                    agent=server_agent,
                    run_input=_to_pydantic_ai_request_data(
                        body, messages=model_transcript_messages
                    ),
                    accept=request.headers.get("accept"),
                    sdk_version=7,
                    server_message_id=server_message_id,
                )

                def _run_server_agent_stream(
                    on_complete: Callable[[AgentRunResult[Any]], AsyncIterator[BaseChunk]],
                ) -> AsyncIterator[BaseChunk]:
                    return server_agent_adapter.run_stream(
                        deps=None,
                        message_history=compaction_history,
                        on_complete=on_complete,
                    )

                adapter = server_agent_adapter
                run_agent_stream = _run_server_agent_stream
            else:
                subagent = (
                    build_server_agent(
                        model=model,
                        schema=request.app.state.graphql_schema,
                        build_graphql_context=lambda: request.app.state.build_graphql_context(
                            phoenix_user
                        ),
                        db=request.app.state.db,
                        event_queue=request.state.event_queue,
                        docs_mcp_server=request.app.state.docs_mcp_server,
                        enable_web_access=web_access_enabled,
                        allow_mutations=graphql_mutations_enabled,
                        read_only=request.app.state.read_only,
                        auth_enabled=request.app.state.authentication_enabled,
                        user_id=request_user_id,
                        is_viewer=is_viewer,
                        tracer_provider=tracer_provider,
                        enable_subagents=False,
                    )
                    if subagents_enabled
                    else None
                )
                publish_subagent_message_chunk: (
                    Callable[[ToolOutputAvailableChunk], Awaitable[None]] | None
                ) = None
                set_subagent_final_tool_output: (
                    Callable[[ToolOutputAvailableChunk], None] | None
                ) = None

                if subagent is not None:

                    async def _publish_subagent_message_chunk(
                        subagent_message_chunk: ToolOutputAvailableChunk,
                    ) -> None:
                        await subagent_message_chunks.put(subagent_message_chunk)

                    def _set_subagent_final_tool_output(
                        final_tool_output: ToolOutputAvailableChunk,
                    ) -> None:
                        final_tool_outputs_by_tool_call_id[final_tool_output.tool_call_id] = (
                            final_tool_output
                        )

                    publish_subagent_message_chunk = _publish_subagent_message_chunk
                    set_subagent_final_tool_output = _set_subagent_final_tool_output

                agent = build_agent(
                    model=model,
                    docs_mcp_server=request.app.state.docs_mcp_server,
                    enable_web_access=web_access_enabled,
                    tracer_provider=tracer_provider,
                    server_agent=subagent,
                    publish_subagent_message_chunk=publish_subagent_message_chunk,
                    set_subagent_final_tool_output=set_subagent_final_tool_output,
                    db=request.app.state.db,
                    event_queue=request.state.event_queue,
                    read_only=request.app.state.read_only,
                    auth_enabled=request.app.state.authentication_enabled,
                    user_id=request_user_id,
                    is_viewer=is_viewer,
                    schema=request.app.state.graphql_schema if bash_enabled else None,
                    build_graphql_context=(
                        (lambda: request.app.state.build_graphql_context(phoenix_user))
                        if bash_enabled
                        else None
                    ),
                    allow_mutations=graphql_mutations_enabled,
                    initial_bash_snapshot=initial_bash_snapshot,
                    on_bash_snapshot=_capture_bash_snapshot,
                )
                if body.requested_skills:
                    available_skills = get_skills_for_contexts(resolved_contexts)
                    forced_skills = resolve_requested_skills(
                        messages=model_transcript_messages,
                        requested_skill_names=body.requested_skills,
                        available_skills=available_skills,
                    )
                    if forced_skills:
                        model_transcript_messages = inject_requested_skills(
                            messages=model_transcript_messages,
                            requested_skill_names=body.requested_skills,
                            available_skills=available_skills,
                            load_skill_template=agent_prompts.load_skill,
                            message_factory=PhoenixUIMessage,
                        )
                assistant_adapter: VercelAIAdapter[AgentDependencies, AgentOutput] = (
                    VercelAIAdapter(
                        agent=agent,
                        run_input=_to_pydantic_ai_request_data(
                            body, messages=model_transcript_messages
                        ),
                        accept=request.headers.get("accept"),
                        sdk_version=7,
                        server_message_id=server_message_id,
                    )
                )
                deps = AgentDependencies(
                    contexts=resolved_contexts,
                    edit_permission=body.edit_permission,
                    is_viewer=is_viewer,
                    sandbox_availability=sandbox_availability,
                    model_provider_availability=model_provider_availability,
                )

                def _run_assistant_agent_stream(
                    on_complete: Callable[[AgentRunResult[Any]], AsyncIterator[BaseChunk]],
                ) -> AsyncIterator[BaseChunk]:
                    return assistant_adapter.run_stream(
                        deps=deps,
                        message_history=compaction_history,
                        on_complete=on_complete,
                    )

                adapter = assistant_adapter
                run_agent_stream = _run_assistant_agent_stream

            continued_turn_trace_context = _message_turn_trace_context(continued_assistant_message)
            superseded_turn_trace_context = _message_turn_trace_context(
                merged_transcript.superseded_assistant_message
            )
            turn_ids = _resolve_turn_trace_ids(
                continued_turn_trace_context, now=request_received_at
            )
            parent_context = _turn_parent_context(turn_ids)
            resolved_turn_trace_context = (
                TurnTraceContext(
                    trace_id=format_trace_id(turn_ids.trace_id),
                    root_span_id=format_span_id(turn_ids.root_span_id),
                    started_at=turn_ids.started_at,
                )
                if tracer is not None or continued_turn_trace_context is not None
                else None
            )

            async def _summarize_untitled_session() -> str | None:
                try:
                    with (
                        detached_otel_context(parent_context),
                        using_session(session_id=otel_session_id),
                        _maybe_using_user(instrument_user_id, phoenix_user_email),
                    ):
                        summary = await summarize_messages(
                            messages=adapter.messages,
                            model=model,
                        )
                except Exception:
                    logger.exception(
                        "Failed to summarize new agent session %r",
                        str(GlobalID("AgentSession", str(agent_session_rowid))),
                    )
                    return None
                if summary is not None:
                    title_was_applied = await _persist_agent_session_title(
                        request.app.state.db,
                        agent_session_rowid=agent_session_rowid,
                        user_id=request_user_id,
                        title=summary,
                    )
                    if not title_was_applied:
                        # The title was not persisted due to a race condition.
                        # Discard it so the client never shows a title the database does not have.
                        return None
                return summary

            turn_final_output_text: str | None = None
            turn_is_terminal = False

            async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
                nonlocal turn_final_output_text, turn_is_terminal
                if isinstance(result.output, str):
                    turn_is_terminal = True
                    turn_final_output_text = result.output.strip() or None
                yield _build_message_metadata_chunk(
                    turn_trace_context=resolved_turn_trace_context,
                    session_id=otel_session_id,
                    usage=_get_current_context_usage(result),
                )

            async def _stream_with_session() -> AsyncIterator[BaseChunk]:
                # The turn lock was claimed before this generator was built; keep
                # its heartbeat fresh for as long as the turn is streaming.
                heartbeat_task = asyncio.create_task(
                    _heartbeat_agent_session_turn_lock(
                        db_session_factory,
                        agent_session_rowid=agent_session_rowid,
                    )
                )
                stream_error: BaseException | None = None
                turn_interrupted = False
                turn_persisted = False
                summary_task: asyncio.Task[str | None] | None = None
                message_state = create_streaming_ui_message_state(
                    message_id=server_message_id,
                    last_message=continued_assistant_message,
                )

                async def _persist_turn() -> TranscriptPersistedChunk:
                    generated_assistant_message = PhoenixUIMessage.model_validate(
                        message_state.message.model_dump(
                            mode="json",
                            by_alias=True,
                            exclude_unset=True,
                        )
                    )
                    if continued_assistant_message is not None:
                        # Continue the trailing assistant message with the generated response.
                        turn_messages = [generated_assistant_message]
                    else:
                        # Persist the submitted user message and its generated response.
                        assert body.message is not None, (
                            "request validation requires a message or toolOutputs, and "
                            "the merge continues the assistant turn for toolOutputs-only"
                        )
                        turn_messages = [body.message, generated_assistant_message]
                    try:
                        await _persist_agent_session_turn(
                            request.app.state.db,
                            agent_session_rowid=agent_session_rowid,
                            user_id=request_user_id,
                            new_messages=turn_messages,
                            bashkit_snapshot=bash_snapshot_to_persist,
                        )
                    except Exception as exc:
                        logger.exception(
                            "Failed to persist the transcript for agent session %r",
                            str(GlobalID("AgentSession", str(agent_session_rowid))),
                        )
                        raise _transcript_persistence_error(request.app.state.db) from exc
                    return TranscriptPersistedChunk(
                        data=TranscriptPersistedData(message_id=turn_messages[-1].id)
                    )

                async def _persist_interrupted_turn() -> None:
                    """Best-effort persistence of a partial turn after an interruption.

                    Client disconnects cancel the stream before ``_persist_turn``
                    runs, so without this the turn would silently vanish and the
                    client's next transcript poll would snap back to the pre-turn
                    state. Finalize what accumulated so far — streaming
                    text/reasoning is marked done and unresolved tool calls are
                    closed out as interrupted — and persist it so clients can
                    reload the transcript and resume with a follow-up message.
                    Never raises: the client is already gone, so there is no one
                    left to notify.
                    """
                    try:
                        finalize_interrupted_ui_message_state(message_state)
                        generated_assistant_message = PhoenixUIMessage.model_validate(
                            message_state.message.model_dump(
                                mode="json",
                                by_alias=True,
                                exclude_unset=True,
                            )
                        )
                        resolved_assistant_message = _resolve_interrupted_tool_parts(
                            generated_assistant_message
                        )
                        if resolved_assistant_message is not None:
                            generated_assistant_message = resolved_assistant_message
                        existing_metadata = generated_assistant_message.metadata
                        if existing_metadata is not None and isinstance(
                            existing_metadata.phoenix, PhoenixAssistantMessageMetadata
                        ):
                            interrupted_metadata = existing_metadata.model_copy(
                                update={
                                    "phoenix": existing_metadata.phoenix.model_copy(
                                        update={"interrupted": True}
                                    )
                                }
                            )
                        else:
                            interrupted_metadata = MessageMetadata(
                                phoenix=_build_phoenix_assistant_message_metadata(
                                    session_id=otel_session_id,
                                    turn_trace_context=resolved_turn_trace_context,
                                    usage=None,
                                    interrupted=True,
                                ),
                                pydantic_ai=(
                                    existing_metadata.pydantic_ai
                                    if existing_metadata is not None
                                    else None
                                ),
                            )
                        generated_assistant_message = generated_assistant_message.model_copy(
                            update={"metadata": interrupted_metadata}
                        )
                        if continued_assistant_message is not None:
                            # Rewrite the trailing assistant message with everything
                            # generated before the interruption.
                            turn_messages = [generated_assistant_message]
                        else:
                            assert body.message is not None, (
                                "request validation requires a message or toolOutputs, and "
                                "the merge continues the assistant turn for toolOutputs-only"
                            )
                            # An empty assistant message is still persisted so the
                            # client's `lastMessageId` staleness check stays aligned on
                            # the next submit; message loading keeps empty assistant
                            # messages out of the model-facing transcript.
                            turn_messages = [body.message, generated_assistant_message]
                        await _persist_agent_session_turn(
                            request.app.state.db,
                            agent_session_rowid=agent_session_rowid,
                            user_id=request_user_id,
                            new_messages=turn_messages,
                            bashkit_snapshot=bash_snapshot_to_persist,
                        )
                    except Exception:
                        logger.exception(
                            "Failed to persist the interrupted turn for agent session %r",
                            str(GlobalID("AgentSession", str(agent_session_rowid))),
                        )

                try:
                    if tracer is not None and continued_turn_trace_context is not None:
                        _synthesize_client_tool_spans(
                            tracer=tracer,
                            turn_ids=turn_ids,
                            messages=transcript_messages,
                            received_at=request_received_at,
                            session_id=otel_session_id,
                        )
                    if tracer is not None and superseded_turn_trace_context is not None:
                        # This new user turn superseded a pending turn whose root
                        # span was deferred; close that trace out (excluding the
                        # new user message) so its spans don't stay orphaned.
                        _close_superseded_turn_trace(
                            tracer=tracer,
                            turn_trace_context=superseded_turn_trace_context,
                            messages=transcript_messages[:-1],
                            received_at=request_received_at,
                            session_id=otel_session_id,
                            user_email=phoenix_user_email if instrument_user_id else None,
                        )
                    if session_needs_title:
                        summary_task = asyncio.create_task(_summarize_untitled_session())
                    with (
                        detached_otel_context(parent_context),
                        using_session(session_id=otel_session_id),
                        _maybe_using_user(instrument_user_id, phoenix_user_email),
                    ):
                        raw_stream = run_agent_stream(_on_complete)
                        assert _is_async_generator(raw_stream)

                        async def _agent_message_chunks() -> AsyncIterator[BaseChunk]:
                            # Forced skills are streamed as their own `load_skill` steps so
                            # the browser transcript matches what the model received. They
                            # are emitted once, right after the stream's opening `start`
                            # message chunk and before the model's own output.
                            forced_skills_streamed = not forced_skills
                            async with aclosing(raw_stream) as stream:
                                async for agent_message_chunk in stream:
                                    if isinstance(agent_message_chunk, ToolInputAvailableChunk):
                                        chunk = agent_message_chunk
                                        chunk.provider_metadata = _get_updated_provider_metadata(
                                            provider_metadata=chunk.provider_metadata or {},
                                            tool_name=chunk.tool_name,
                                            emitted_at=datetime.now(timezone.utc),
                                        )
                                    yield agent_message_chunk
                                    if not forced_skills_streamed and isinstance(
                                        agent_message_chunk,
                                        StartChunk,
                                    ):
                                        forced_skill_message_chunks = (
                                            iter_requested_skill_response_chunks(
                                                skills=forced_skills,
                                                load_skill_template=agent_prompts.load_skill,
                                            )
                                        )
                                        for (
                                            forced_skill_message_chunk
                                        ) in forced_skill_message_chunks:
                                            if isinstance(
                                                forced_skill_message_chunk, ToolInputAvailableChunk
                                            ):
                                                provider_metadata = _get_updated_provider_metadata(
                                                    provider_metadata=forced_skill_message_chunk.provider_metadata
                                                    or {},
                                                    tool_name=forced_skill_message_chunk.tool_name,
                                                    emitted_at=datetime.now(timezone.utc),
                                                )
                                                forced_skill_message_chunk.provider_metadata = (
                                                    provider_metadata
                                                )
                                            yield forced_skill_message_chunk
                                        forced_skills_streamed = True

                        message_chunk_stream: AsyncIterator[BaseChunk] = (
                            _interleave_agent_and_subagent_message_chunks(
                                agent_message_chunks=_agent_message_chunks(),
                                subagent_message_chunks=subagent_message_chunks,
                                final_tool_outputs_by_tool_call_id=final_tool_outputs_by_tool_call_id,
                            )
                        )
                        if summary_task is not None:
                            message_chunk_stream = _merge_session_summary_chunk(
                                message_chunks=message_chunk_stream,
                                summary_task=summary_task,
                            )
                        async for message_chunk in process_ui_message_stream(
                            stream=iter_chunks_with_error_parts(message_chunk_stream),
                            state=message_state,
                        ):
                            yield message_chunk
                        transcript_persisted_chunk = await _persist_turn()
                        turn_persisted = True
                        yield transcript_persisted_chunk
                except Exception as exc:
                    stream_error = exc
                    logger.exception("Agent chat stream failed for session %s", session_id)
                    yield ErrorChunk(error_text=str(exc).strip() or type(exc).__name__)
                except (asyncio.CancelledError, GeneratorExit) as exc:
                    # A client disconnect (e.g., the UI stop button, a CLI interrupt,
                    # or a dropped SSE connection) cancels this generator (or
                    # closes it) mid-stream.
                    stream_error = exc
                    turn_interrupted = True
                    raise
                except BaseException as exc:
                    stream_error = exc
                    raise
                finally:
                    heartbeat_task.cancel()
                    # Disconnect cancellation re-fires at every await; shield so cleanup completes.
                    with anyio.CancelScope(shield=turn_interrupted):
                        if turn_interrupted and not turn_persisted:
                            await _persist_interrupted_turn()
                        await _release_agent_session_turn_lock(
                            db_session_factory,
                            agent_session_rowid=agent_session_rowid,
                        )
                        if summary_task is not None:
                            if not summary_task.done():
                                summary_task.cancel()
                        if tracer is not None:
                            if turn_is_terminal or stream_error is not None:
                                _emit_turn_root_span(
                                    tracer=tracer,
                                    turn_ids=turn_ids,
                                    session_id=otel_session_id,
                                    input_text=_get_last_user_text(transcript_messages),
                                    output_text=turn_final_output_text,
                                    error_message=(
                                        None
                                        if stream_error is None
                                        else (str(stream_error) or type(stream_error).__name__)
                                    ),
                                    end_time=datetime.now(timezone.utc),
                                    user_email=phoenix_user_email if instrument_user_id else None,
                                )
                            tracer.tracer_provider.force_flush()
                            if record_local_traces:
                                project_id = await _ensure_project_exists(
                                    request.app.state.db, project_name
                                )
                                db_traces = tracer.get_db_traces(project_id=project_id)
                                await _persist_db_traces_and_emit_event(
                                    db=request.app.state.db,
                                    event_queue=request.state.event_queue,
                                    db_traces=db_traces,
                                )
                            tracer.tracer_provider.shutdown()

            return adapter.streaming_response(_stream_with_session())
        except BaseException:
            await _release_agent_session_turn_lock(
                db_session_factory,
                agent_session_rowid=agent_session_rowid,
            )
            raise

    return router
