import asyncio
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

from fastapi import APIRouter, Depends, HTTPException
from openinference.instrumentation import using_session, using_user
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry import trace as trace_api
from opentelemetry.context import Context
from opentelemetry.sdk.trace import Event, SpanProcessor
from opentelemetry.sdk.trace import Span as SDKSpan
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
)
from pydantic.alias_generators import to_camel
from pydantic_ai import AgentRunResult
from pydantic_ai.messages import ModelMessage
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    RequestData as PydanticAIRequestData,
)
from pydantic_ai.ui.vercel_ai.request_types import (
    UIMessage as PydanticAIUIMessage,
)
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    DataChunk,
    FinishChunk,
    MessageMetadataChunk,
    StartChunk,
    ToolInputAvailableChunk,
    ToolOutputAvailableChunk,
)
from pydantic_ai.usage import RunUsage
from sqlalchemy import Insert, exists, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID
from typing_extensions import TypeIs, assert_never

from phoenix.config import (
    TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS,
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_disable_bash,
    get_env_phoenix_agents_force_tracing,
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.data_stream_protocol import (
    AssistantMessageMetadata,
    AssistantMessageMetadataTraceIds,
    AssistantMessageMetadataUsage,
    AssistantMessageMetadataUsageTokenDetails,
    AssistantMessageMetadataUsageTokens,
    DynamicToolOutputAvailablePart,
    DynamicToolOutputErrorPart,
    PhoenixUIMessage,
    ProviderMetadata,
    TextUIPart,
    ToolCallCallbackProviderMetadata,
    ToolCallProviderMetadata,
    ToolExecutionEnvironment,
    ToolOutputAvailablePart,
    ToolOutputErrorPart,
    TurnTraceContext,
    UIMessage,
    UserMessageMetadata,
)
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import get_external_tool_definition
from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.context import (
    AppContext,
    ChatContext,
    ResolvedContexts,
    resolve_contexts,
)
from phoenix.server.agents.data_stream_protocol import (
    accumulate_ui_message_chunks_to_ui_messages,
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
from phoenix.server.api.helpers.playground_registry import (
    PLAYGROUND_CLIENT_REGISTRY,
    PROVIDER_DEFAULT,
)
from phoenix.server.api.openapi.registry import register_openapi_schema
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SandboxConfig import (
    SandboxBackendStatus,
    get_sandbox_backend_info,
)
from phoenix.server.authorization import (
    is_agent_assistant_enabled,
    is_not_locked,
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import PhoenixUser, is_authenticated
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.sandbox import SecretsContext
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.tracers import (
    Tracer,
    build_synthetic_readable_span,
    detached_otel_context,
    get_cumulative_counts,
)

_PHOENIX_PROVIDER_METADATA_KEY = "phoenix"

_PXI_INSTRUMENTATION_SCOPE = InstrumentationScope("phoenix.server.pxi")

register_openapi_schema(ToolCallProviderMetadata)
register_openapi_schema(ToolCallCallbackProviderMetadata)


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
    new_tool_call_metadata = ToolCallProviderMetadata(
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
    """Base model with camelCase aliases."""

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
        if isinstance(message.metadata, UserMessageMetadata):
            return AppContext(
                type="app",
                current_date_time=message.metadata.current_date_time,
                time_zone=message.metadata.time_zone,
            )
    return None


class _ObservabilityMixin(_CamelBaseModel):
    """Per-request observability flags"""

    ingest_traces: bool = False
    export_remote_traces: bool = False
    attach_user_id: bool = Field(
        default=False,
        description=(
            "When true and the request is authenticated as a PhoenixUser, attaches "
            "the user's email as the OpenInference ``user.id`` span attribute on "
            "all traced work for this request."
        ),
    )


class _ChatRequestMixin(_ObservabilityMixin):
    """Phoenix-specific extensions added to Vercel AI request messages."""

    model_config = ConfigDict(
        protected_namespaces=(),  # allow ``model`` field; pydantic reserves ``model_*``
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
    model: AgentModelSelection
    turn_trace_context: TurnTraceContext | None = None


class ChatSubmitMessage(_ChatRequestMixin):
    """Assistant chat submit request carrying only the turn's new message."""

    trigger: Literal["submit-message"] = "submit-message"
    id: str
    message: PhoenixUIMessage = Field(
        description=(
            "The turn's new message: a user message to append, or the "
            "transcript's trailing assistant message updated with "
            "client-executed tool results."
        ),
    )


class ChatRequest(ChatSubmitMessage):
    """Assistant chat submit request payload."""


class CreateAgentSessionRequestBody(V1RoutesBaseModel):
    """Request body for creating a persisted agent session."""

    title: str = Field(
        default="",
        max_length=MAX_AGENT_SESSION_TITLE_LENGTH,
        description="Optional initial title.",
    )
    temporary: bool = Field(
        default=False,
        description="Whether the session should expire after a period of inactivity.",
    )


class AgentSession(V1RoutesBaseModel):
    id: str = Field(
        description="The session's GlobalID — the ``session_id`` the chat route expects."
    )


class CreateAgentSessionResponseBody(ResponseBody[AgentSession]):
    pass


class CompactAgentSessionRequest(V1RoutesBaseModel):
    """Request a model-generated checkpoint for a persisted conversation."""

    model: AgentModelSelection


class CompactAgentSessionResponseData(V1RoutesBaseModel):
    """Result of compacting the older complete turns in a conversation."""

    compacted: bool
    compaction_message: PhoenixUIMessage | None = None


class CompactAgentSessionResponse(ResponseBody[CompactAgentSessionResponseData]):
    pass


_PydanticAIRequestDataAdapter: TypeAdapter[PydanticAIRequestData] = TypeAdapter(
    PydanticAIRequestData
)
_PydanticAIUIMessageListAdapter: TypeAdapter[list[PydanticAIUIMessage]] = TypeAdapter(
    list[PydanticAIUIMessage]
)


def _to_pydantic_ai_request_data(
    request_data: ChatSubmitMessage,
    *,
    messages: Sequence[PhoenixUIMessage] | None = None,
) -> PydanticAIRequestData:
    """Validate wire types into pydantic-ai's runtime request classes.

    ``messages`` supplies the server-merged transcript for assistant chat
    requests, whose wire shape carries a single message rather than the full
    history pydantic-ai expects.
    """
    payload = request_data.model_dump(mode="json", by_alias=True, exclude_none=True)
    if messages is not None:
        payload.pop("message", None)
        payload["messages"] = [
            message.model_dump(mode="json", by_alias=True, exclude_none=True)
            for message in messages
        ]
    return _PydanticAIRequestDataAdapter.validate_python(payload)


def _to_pydantic_ai_messages(messages: Sequence[PhoenixUIMessage]) -> list[ModelMessage]:
    ui_messages = _PydanticAIUIMessageListAdapter.validate_python(
        [message.model_dump(mode="json", by_alias=True, exclude_none=True) for message in messages]
    )
    return VercelAIAdapter.load_messages(ui_messages)


logger = logging.getLogger(__name__)

_ASSISTANT_AGENT_ID = "assistant"
_SERVER_AGENT_ID = "server"


_AsyncGeneratorType = TypeVar("_AsyncGeneratorType")


def _is_async_generator(
    obj: AsyncIterator[_AsyncGeneratorType],
) -> TypeIs[AsyncGenerator[_AsyncGeneratorType, None]]:
    return all(
        hasattr(obj, name) for name in ("__aiter__", "__anext__", "asend", "athrow", "aclose")
    )


class _AgentSpanContextRecorder(SpanProcessor):
    """Records the `SpanContext` of the current agent turn's AGENT span as
    it starts."""

    span_context: SpanContext | None

    def __init__(self) -> None:
        self.span_context = None

    def on_start(self, span: SDKSpan, parent_context: Context | None = None) -> None:
        attrs = span.attributes or {}
        if (
            attrs.get(SpanAttributes.OPENINFERENCE_SPAN_KIND)
            == OpenInferenceSpanKindValues.AGENT.value
        ):
            self.span_context = span.get_span_context()

    def on_end(self, span: SDKSpan) -> None:  # type: ignore[override]
        pass

    def shutdown(self) -> None:
        pass

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True


@dataclass
class _TurnTraceIds:
    trace_id: int
    root_span_id: int
    started_at: datetime


def _resolve_turn_trace_ids(
    turn_trace_context: TurnTraceContext | None,
    *,
    now: datetime,
) -> _TurnTraceIds:
    """Adopt a valid echoed turn trace context or mint a new turn identity."""
    if turn_trace_context is not None:
        trace_id = int(turn_trace_context.trace_id, 16)
        root_span_id = int(turn_trace_context.root_span_id, 16)
        if trace_id and root_span_id:
            echoed_started_at = turn_trace_context.started_at
            if echoed_started_at.tzinfo is None:
                echoed_started_at = echoed_started_at.replace(tzinfo=timezone.utc)
            started_at = min(max(echoed_started_at, now - timedelta(hours=24)), now)
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


def _build_assistant_message_metadata(
    *,
    span_context: SpanContext | None,
    turn_trace_context: TurnTraceContext | None,
    session_id: str,
    usage: RunUsage,
) -> AssistantMessageMetadata:
    """Build the metadata payload attached to the turn's assistant message."""
    trace_ids = (
        AssistantMessageMetadataTraceIds(
            trace_id=turn_trace_context.trace_id,
            root_span_id=turn_trace_context.root_span_id,
        )
        if turn_trace_context is not None
        else (
            AssistantMessageMetadataTraceIds(
                trace_id=format_trace_id(span_context.trace_id),
                root_span_id=format_span_id(span_context.span_id),
            )
            if span_context is not None
            else None
        )
    )
    return AssistantMessageMetadata(
        session_id=session_id,
        trace=trace_ids,
        turn_trace_context=turn_trace_context,
        usage=_build_usage_payload(usage),
    )


def _build_message_metadata_chunk(
    *,
    span_context: SpanContext | None,
    turn_trace_context: TurnTraceContext | None,
    session_id: str,
    usage: RunUsage,
) -> MessageMetadataChunk:
    """Build the `MessageMetadataChunk` emitted at the end of an agent turn."""
    return MessageMetadataChunk(
        message_metadata=_build_assistant_message_metadata(
            span_context=span_context,
            session_id=session_id,
            turn_trace_context=turn_trace_context,
            usage=usage,
        )
    )


def _build_usage_payload(usage: RunUsage) -> AssistantMessageMetadataUsage:
    """Convert a run's token usage into the metadata payload, including cache
    read/write details only when the run actually used the prompt cache."""
    usage_payload = AssistantMessageMetadataUsage(
        tokens=AssistantMessageMetadataUsageTokens(
            prompt=usage.input_tokens,
            completion=usage.output_tokens,
            total=usage.total_tokens,
        )
    )
    if usage.cache_read_tokens or usage.cache_write_tokens:
        usage_payload.prompt_details = AssistantMessageMetadataUsageTokenDetails(
            cache_read=usage.cache_read_tokens,
            cache_write=usage.cache_write_tokens,
        )
    return usage_payload


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
    namespace (wire contract: ``ToolCallCallbackProviderMetadata``)."""

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
) -> frozenset[models.SandboxBackendType]:
    backend_info = await get_sandbox_backend_info(
        secrets=SecretsContext(session=session, decrypt=decrypt),
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
    ingest_traces: bool,
    export_remote_traces: bool,
    allow_local_traces: bool,
    allow_remote_export: bool,
) -> tuple[bool, bool]:
    if get_env_phoenix_agents_force_tracing():
        return True, True
    return (
        ingest_traces and allow_local_traces,
        export_remote_traces and allow_remote_export,
    )


def _resolve_attach_user_id(attach_user_id: bool) -> bool:
    return get_env_phoenix_agents_force_tracing() or attach_user_id


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
    attach_user_id: bool,
    phoenix_user_email: str | None,
) -> AbstractContextManager[Any]:
    """Return a ``using_user`` context manager when the opt-in is set and the
    authenticated PhoenixUser has an email; otherwise return a no-op.

    Attaches the Phoenix user email as the ``user.id`` OpenInference attribute
    to all spans created inside the context so traces can be filtered by user.
    """
    if attach_user_id and phoenix_user_email:
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


def _merge_messages(
    *,
    old_messages: Sequence[PhoenixUIMessage],
    new_message: PhoenixUIMessage,
) -> list[PhoenixUIMessage]:
    """Merge a submit request's single message into the persisted transcript.

    - A **user** message is appended.
    - An **assistant** message replaces the transcript's trailing message with
      the same id — the continuation path for client-executed tool results.
    """
    if new_message.role == "user":
        return [*old_messages, new_message]
    if new_message.role == "assistant":
        if not old_messages or old_messages[-1].id != new_message.id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "The submitted assistant message does not match the session's "
                    "latest transcript message; reload the conversation"
                ),
            )
        # Client tool results extend this assistant message rather than create a new one.
        return [*old_messages[:-1], new_message]
    raise HTTPException(status_code=400, detail="Only user or assistant messages can be submitted")


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
    now = datetime.now(timezone.utc)
    session_owner_filter = (
        models.AgentSession.user_id.is_(None)
        if user_id is None
        else models.AgentSession.user_id == user_id
    )
    statement = select(models.AgentSession).where(
        models.AgentSession.id == agent_session_rowid,
        session_owner_filter,
        or_(
            models.AgentSession.expires_at.is_(None),
            models.AgentSession.expires_at > now,
        ),
    )
    if for_update:
        statement = statement.with_for_update()
    loaded_agent_session = await session.scalar(statement)
    if loaded_agent_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if loaded_agent_session.expires_at is None:
        refreshed_agent_session = await session.scalar(
            update(models.AgentSession)
            .where(
                models.AgentSession.id == agent_session_rowid,
                models.AgentSession.expires_at.is_(None),
            )
            .values(updated_at=func.now())
            .returning(models.AgentSession)
        )
        if refreshed_agent_session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return refreshed_agent_session
    refreshed_expiry = now + timedelta(hours=TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS)
    refreshed_agent_session = await session.scalar(
        update(models.AgentSession)
        .where(
            models.AgentSession.id == agent_session_rowid,
            models.AgentSession.expires_at.is_not(None),
            models.AgentSession.expires_at > now,
        )
        .values(expires_at=refreshed_expiry, updated_at=func.now())
        .returning(models.AgentSession)
    )
    if refreshed_agent_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return refreshed_agent_session


async def _update_agent_session(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
    user_id: int | None,
    title: str,
) -> int | None:
    values: dict[str, Any] = {"updated_at": func.now()}
    if title:
        values["title"] = title
    session_owner_filter = (
        models.AgentSession.user_id.is_(None)
        if user_id is None
        else models.AgentSession.user_id == user_id
    )
    return await session.scalar(
        update(models.AgentSession)
        .where(
            models.AgentSession.id == agent_session_rowid,
            session_owner_filter,
        )
        .values(**values)
        .returning(models.AgentSession.id)
    )


async def _persist_agent_session_title(
    db: DbSessionFactory,
    *,
    agent_session_rowid: int,
    user_id: int | None,
    title: str,
) -> None:
    try:
        async with db() as session:
            await _update_agent_session(
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
    position: int,
    message: PhoenixUIMessage,
) -> None:
    """Replace the matching trailing assistant message or reject a stale continuation."""
    updated_message_rowid = await session.scalar(
        update(models.AgentSessionMessage)
        .where(
            models.AgentSessionMessage.agent_session_id == agent_session_rowid,
            models.AgentSessionMessage.position == position,
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
    title: str | None = None,
) -> None:
    if not new_messages:
        return
    async with db() as session:
        updated_agent_session_rowid = await _update_agent_session(
            session,
            agent_session_rowid=agent_session_rowid,
            user_id=user_id,
            title=title or "",
        )
        if updated_agent_session_rowid is None:
            logger.error(
                "Agent session %r no longer exists; discarding %d generated message(s). ",
                str(GlobalID("AgentSession", str(agent_session_rowid))),
                len(new_messages),
            )
            return
        next_position = await session.scalar(
            select(func.coalesce(func.max(models.AgentSessionMessage.position), -1) + 1).where(
                models.AgentSessionMessage.agent_session_id == agent_session_rowid
            )
        )
        assert next_position is not None
        if new_messages[0].role == "assistant":
            # Client-tool continuations replace the persisted assistant message.
            await _update_trailing_assistant_message(
                session,
                agent_session_rowid=agent_session_rowid,
                position=next_position - 1,
                message=new_messages[0],
            )
            new_messages = new_messages[1:]
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                position=position,
                message=message,
            )
            for position, message in enumerate(new_messages, start=next_position)
        )
        if bashkit_snapshot is not None:
            await _upsert_agent_session_snapshot(
                session,
                agent_session_rowid=agent_session_rowid,
                bashkit_snapshot=bashkit_snapshot,
            )


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


async def _build_generated_assistant_message(
    *,
    message_chunks: Sequence[BaseChunk],
    session_id: str,
    initial_message: PhoenixUIMessage | None = None,
) -> PhoenixUIMessage | None:
    """Assemble the generated assistant message from chunks sent to the client."""
    latest_assistant_message: UIMessage | None = None

    async def _iter_message_chunks() -> AsyncIterator[BaseChunk]:
        for chunk in message_chunks:
            yield chunk

    try:
        async for message in accumulate_ui_message_chunks_to_ui_messages(
            _iter_message_chunks(),
            initial_message=initial_message,
        ):
            latest_assistant_message = message
        if latest_assistant_message is None:
            return initial_message.model_copy(deep=True) if initial_message is not None else None
        return PhoenixUIMessage.model_validate(
            latest_assistant_message.model_dump(mode="json", by_alias=True, exclude_none=True)
        )
    except Exception:
        logger.exception(
            "Failed to accumulate the turn's streamed messages for session %r; "
            "persisting the incoming message only",
            session_id,
        )
        return None


async def _load_agent_session_history(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> list[models.AgentSessionMessage]:
    """Load messages from the latest surviving compaction point onward."""
    latest_compaction_position = (
        select(models.AgentSessionMessage.position)
        .where(
            models.AgentSessionMessage.agent_session_id == agent_session_rowid,
            models.AgentSessionMessage.is_compaction_message,
        )
        .order_by(models.AgentSessionMessage.position.desc())
        .limit(1)
        .scalar_subquery()
    )
    return list(
        await session.scalars(
            select(models.AgentSessionMessage)
            .where(
                models.AgentSessionMessage.agent_session_id == agent_session_rowid,
                models.AgentSessionMessage.position >= func.coalesce(latest_compaction_position, 0),
            )
            .order_by(models.AgentSessionMessage.position)
        )
    )


def _build_compaction_message(*, message_id: str, summary: str) -> PhoenixUIMessage:
    """Build the durable user-role message used as a compaction checkpoint."""
    return PhoenixUIMessage(
        id=message_id,
        role="user",
        metadata=UserMessageMetadata(
            current_date_time=datetime.now(timezone.utc).isoformat(),
            time_zone="UTC",
            is_compaction_message=True,
        ),
        parts=[TextUIPart(type="text", text=summary)],
    )


def create_agents_router(
    authentication_enabled: bool,
) -> tuple[APIRouter, Callable[[str, str, Request, ChatRequest], Awaitable[Response]]]:
    dependencies = [
        Depends(is_agent_assistant_enabled),
        Depends(prevent_access_in_read_only_mode),
        Depends(restrict_access_by_viewers),
        Depends(is_not_locked),
    ]
    if authentication_enabled:
        dependencies.append(Depends(is_authenticated))
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post("/agents/{agent_id}/sessions", status_code=201)
    async def create_session(
        agent_id: str,
        request: Request,
        request_body: CreateAgentSessionRequestBody,
    ) -> CreateAgentSessionResponseBody:
        """Create a persisted agent session owned by the requesting user."""
        if agent_id not in (_ASSISTANT_AGENT_ID, _SERVER_AGENT_ID):
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        if agent_id == _SERVER_AGENT_ID and get_env_phoenix_agents_disable_bash():
            raise HTTPException(status_code=403, detail="Server agent is disabled")
        try:
            title = validate_agent_session_title(request_body.title, allow_empty=True)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        async with request.app.state.db() as session:
            agent_session = models.AgentSession(
                project_session_id=str(uuid4()),
                user_id=int(phoenix_user.identity) if phoenix_user is not None else None,
                title=title,
                project_name=get_env_phoenix_agents_assistant_project_name(),
                expires_at=(
                    datetime.now(timezone.utc)
                    + timedelta(hours=TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS)
                    if request_body.temporary
                    else None
                ),
            )
            session.add(agent_session)
            await session.flush()
            agent_session_rowid = agent_session.id
        return CreateAgentSessionResponseBody(
            data=AgentSession(
                id=str(GlobalID(models.AgentSession.__name__, str(agent_session_rowid)))
            )
        )

    @router.post(
        "/agents/{agent_id}/sessions/{session_id}/compact",
        response_model=CompactAgentSessionResponse,
        response_model_exclude_none=True,
    )
    async def compact_agent_session(
        agent_id: str,
        session_id: str,
        request: Request,
        request_body: CompactAgentSessionRequest,
    ) -> CompactAgentSessionResponse:
        if agent_id != _ASSISTANT_AGENT_ID:
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        request_user_id = int(phoenix_user.identity) if phoenix_user is not None else None

        try:
            async with request.app.state.db() as session:
                agent_session = await _refresh_and_load_agent_session(
                    session,
                    agent_session_id=session_id,
                    user_id=request_user_id,
                )
                message_rows = await _load_agent_session_history(
                    session,
                    agent_session_rowid=agent_session.id,
                )
                first_row = message_rows[0] if message_rows else None
                latest_compaction = (
                    first_row if first_row is not None and first_row.is_compaction_point else None
                )
                latest_row = message_rows[-1] if message_rows else None
                if latest_row is None or latest_row.message.role != "assistant":
                    return CompactAgentSessionResponse(
                        data=CompactAgentSessionResponseData(
                            compacted=False,
                            compaction_message=(
                                latest_compaction.message if latest_compaction is not None else None
                            ),
                        ),
                    )
                boundary_row = latest_row
                messages_to_summarize = [row.message for row in message_rows]
                model = await build_model(
                    request_body.model,
                    session=session,
                    decrypt=request.app.state.decrypt,
                )
                agent_session_rowid = agent_session.id
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        summary_messages = _to_pydantic_ai_messages(messages_to_summarize)
        try:
            summary = await summarize_messages_for_compaction(
                messages=summary_messages,
                model=model,
            )
        except CompactionError as exc:
            raise HTTPException(
                status_code=502, detail=f"Conversation compaction failed: {exc}"
            ) from exc

        async with request.app.state.db() as session:
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
                if current_first_row is not None and current_first_row.is_compaction_point
                else None
            )
            if current_compaction is not None and (
                latest_compaction is None or current_compaction.id != latest_compaction.id
            ):
                return CompactAgentSessionResponse(
                    data=CompactAgentSessionResponseData(
                        compacted=False,
                        compaction_message=current_compaction.message,
                    ),
                )
            current_latest_row = current_history[-1] if current_history else None
            if (
                current_latest_row is None
                or current_latest_row.id != boundary_row.id
                or current_latest_row.message != boundary_row.message
            ):
                raise HTTPException(
                    status_code=409,
                    detail="The conversation changed while it was being compacted; try again",
                )
            compaction_message = _build_compaction_message(
                message_id=str(uuid4()),
                summary=summary,
            )
            compaction_message_row = models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                position=boundary_row.position + 1,
                message=compaction_message,
            )
            session.add(compaction_message_row)
        return CompactAgentSessionResponse(
            data=CompactAgentSessionResponseData(
                compacted=True,
                compaction_message=compaction_message,
            ),
        )

    @router.post("/agents/{agent_id}/sessions/{session_id}/chat")
    async def chat(
        agent_id: str,
        session_id: str,
        request: Request,
        request_body: ChatRequest,
    ) -> Response:
        if agent_id not in (_ASSISTANT_AGENT_ID, _SERVER_AGENT_ID):
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        if agent_id == _SERVER_AGENT_ID and get_env_phoenix_agents_disable_bash():
            raise HTTPException(status_code=403, detail="Server agent is disabled")
        body = request_body
        request_received_at = datetime.now(timezone.utc)
        attach_user_id = _resolve_attach_user_id(body.attach_user_id)
        recording = request.app.state.system_settings.agent_trace_recording
        ingest_traces, export_remote_traces = _resolve_trace_recording(
            ingest_traces=body.ingest_traces,
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
                transcript_messages = _merge_messages(
                    old_messages=[row.message for row in session_history],
                    new_message=body.message,
                )
                project_name = agent_session.project_name
                tracer = (
                    Tracer(
                        span_cost_calculator=request.app.state.span_cost_calculator,
                        enable_remote_export=export_remote_traces,
                        project_name=project_name,
                    )
                    if (ingest_traces or export_remote_traces)
                    else None
                )
                tracer_provider = tracer.tracer_provider if tracer is not None else None
                agent_span_recorder: _AgentSpanContextRecorder | None = None
                if tracer is not None:
                    agent_span_recorder = _AgentSpanContextRecorder()
                    tracer.tracer_provider.add_span_processor(agent_span_recorder)
                model = await build_model(
                    body.model,
                    session=session,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
                sandbox_availability = SandboxAvailability()
                model_provider_availability = ModelProviderAvailability()
                agent_supports_availability_gate = agent_id == _ASSISTANT_AGENT_ID
                if agent_supports_availability_gate:
                    if _contexts_need_sandbox_availability(resolved_contexts):
                        available_backend_types = await _load_available_sandbox_backend_types(
                            session=session,
                            decrypt=request.app.state.decrypt,
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
                session_needs_title = not agent_session.title
                agent_session_rowid = agent_session.id
                otel_session_id = agent_session.project_session_id
                initial_bash_snapshot = await _load_bash_snapshot(
                    session,
                    agent_session_rowid=agent_session.id,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        if (browser_clock := _resolve_browser_clock(transcript_messages)) is not None:
            resolved_contexts.app = browser_clock

        logger.info(
            "agent model: %s.%s settings=%r",
            type(model).__module__,
            type(model).__qualname__,
            getattr(model, "settings", None),
        )

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
        server_message_id = body.message.id if body.message.role == "assistant" else str(uuid4())
        model_transcript_messages = transcript_messages
        compaction_history: list[ModelMessage] = []

        adapter: VercelAIAdapter[AgentDependencies, AgentOutput] | VercelAIAdapter[None, str]
        run_agent_stream: Callable[
            [Callable[[AgentRunResult[Any]], AsyncIterator[BaseChunk]]],
            AsyncIterator[BaseChunk],
        ]
        if agent_id == _SERVER_AGENT_ID:
            server_agent = build_server_agent(
                model=model,
                schema=request.app.state.graphql_schema,
                build_graphql_context=lambda: request.app.state.build_graphql_context(phoenix_user),
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
                run_input=_to_pydantic_ai_request_data(body, messages=model_transcript_messages),
                accept=request.headers.get("accept"),
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
            set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None

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
            assistant_adapter: VercelAIAdapter[AgentDependencies, AgentOutput] = VercelAIAdapter(
                agent=agent,
                run_input=_to_pydantic_ai_request_data(body, messages=model_transcript_messages),
                accept=request.headers.get("accept"),
                server_message_id=server_message_id,
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

        turn_ids = _resolve_turn_trace_ids(body.turn_trace_context, now=request_received_at)
        parent_context = _turn_parent_context(turn_ids)
        request_parent_span_context = _get_span_context(parent_context)
        resolved_turn_trace_context = (
            TurnTraceContext(
                trace_id=format_trace_id(turn_ids.trace_id),
                root_span_id=format_span_id(turn_ids.root_span_id),
                started_at=turn_ids.started_at,
            )
            if tracer is not None
            else None
        )

        async def _summarize_untitled_session() -> str | None:
            try:
                with (
                    detached_otel_context(parent_context),
                    using_session(session_id=otel_session_id),
                    _maybe_using_user(attach_user_id, phoenix_user_email),
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
                await _persist_agent_session_title(
                    request.app.state.db,
                    agent_session_rowid=agent_session_rowid,
                    user_id=request_user_id,
                    title=summary,
                )
            return summary

        turn_final_output_text: str | None = None
        turn_is_terminal = False

        async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
            nonlocal turn_final_output_text, turn_is_terminal
            if isinstance(result.output, str):
                turn_is_terminal = True
                turn_final_output_text = result.output.strip() or None
            span_context = (
                agent_span_recorder.span_context
                if agent_span_recorder and agent_span_recorder.span_context is not None
                else request_parent_span_context
            )
            yield _build_message_metadata_chunk(
                span_context=span_context,
                turn_trace_context=resolved_turn_trace_context,
                session_id=otel_session_id,
                usage=result.usage,
            )

        async def _stream_with_session() -> AsyncIterator[BaseChunk]:
            stream_error: BaseException | None = None
            summary_task: asyncio.Task[str | None] | None = None
            emitted_message_chunks: list[BaseChunk] = []

            async def _persist_turn() -> TranscriptPersistedChunk:
                session_title = (
                    summary_task.result()
                    if summary_task is not None
                    and summary_task.done()
                    and not summary_task.cancelled()
                    else None
                )
                generated_assistant_message = await _build_generated_assistant_message(
                    message_chunks=emitted_message_chunks,
                    session_id=otel_session_id,
                    initial_message=(body.message if body.message.role == "assistant" else None),
                )
                if generated_assistant_message is None:
                    raise RuntimeError("Failed to assemble the streamed assistant message")
                if body.message.role == "assistant":
                    # Continue the submitted assistant message with the generated response.
                    turn_messages = [generated_assistant_message]
                else:
                    # Persist the submitted user message and its generated response.
                    turn_messages = [body.message, generated_assistant_message]
                await _persist_agent_session_turn(
                    request.app.state.db,
                    agent_session_rowid=agent_session_rowid,
                    user_id=request_user_id,
                    new_messages=turn_messages,
                    bashkit_snapshot=bash_snapshot_to_persist,
                    title=session_title,
                )
                return TranscriptPersistedChunk(
                    data=TranscriptPersistedData(message_id=turn_messages[-1].id)
                )

            try:
                if tracer is not None and body.turn_trace_context is not None:
                    _synthesize_client_tool_spans(
                        tracer=tracer,
                        turn_ids=turn_ids,
                        messages=transcript_messages,
                        received_at=request_received_at,
                        session_id=otel_session_id,
                    )
                if session_needs_title:
                    summary_task = asyncio.create_task(_summarize_untitled_session())
                with (
                    detached_otel_context(parent_context),
                    using_session(session_id=otel_session_id),
                    _maybe_using_user(attach_user_id, phoenix_user_email),
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
                                    agent_message_chunk.provider_metadata = (
                                        _get_updated_provider_metadata(
                                            provider_metadata=agent_message_chunk.provider_metadata
                                            or {},
                                            tool_name=agent_message_chunk.tool_name,
                                            emitted_at=datetime.now(timezone.utc),
                                        )
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
                                    for forced_skill_message_chunk in forced_skill_message_chunks:
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
                    async for message_chunk in message_chunk_stream:
                        emitted_message_chunks.append(message_chunk)
                        yield message_chunk
                    yield await _persist_turn()
            except BaseException as exc:
                stream_error = exc
                raise
            finally:
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
                            user_email=phoenix_user_email if attach_user_id else None,
                        )
                    tracer.tracer_provider.force_flush()
                    if ingest_traces:
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

    return router, chat
