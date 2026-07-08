import asyncio
import logging
from collections.abc import (
    AsyncGenerator,
    AsyncIterator,
    Awaitable,
    Callable,
    Iterable,
)
from contextlib import AbstractContextManager, aclosing, nullcontext
from copy import deepcopy
from typing import Annotated, Any, Literal, TypeVar

from fastapi import APIRouter, Depends, HTTPException
from openinference.instrumentation import using_metadata, using_session, using_user
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SDKSpan
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.trace import SpanContext, format_span_id, format_trace_id, get_current_span
from pydantic import BaseModel, ConfigDict, Field, RootModel, field_validator
from pydantic.alias_generators import to_camel
from pydantic_ai import AgentRunResult
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    RegenerateMessage,
    SubmitMessage,
    UIMessage,
)
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    MessageMetadataChunk,
    ProviderMetadata,
    StartChunk,
    ToolInputAvailableChunk,
    ToolOutputAvailableChunk,
)
from pydantic_ai.usage import RunUsage
from sqlalchemy import Insert, exists, func, select
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID
from typing_extensions import TypeIs, assert_never

from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_disable_bash,
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import get_external_tool_definition
from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.context import (
    ChatContext,
    ResolvedContexts,
    resolve_contexts,
)
from phoenix.server.agents.exceptions import AgentError, SummarizationError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import AgentModelSelection
from phoenix.server.agents.prompts import AgentPrompts, ServerAgentPrompts
from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.agents.skill_requests import (
    inject_requested_skills,
    iter_requested_skill_response_chunks,
    resolve_requested_skills,
)
from phoenix.server.agents.skills import get_skills_for_contexts
from phoenix.server.agents.summarization import summarize_messages
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
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.SandboxConfig import (
    SandboxBackendStatus,
    get_sandbox_backend_info,
)
from phoenix.server.bearer_auth import PhoenixUser, is_authenticated
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.sandbox import SecretsContext
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.tracers import (
    Tracer,
    detached_otel_context,
    extract_otel_context,
    get_cumulative_counts,
)

_PHOENIX_PROVIDER_METADATA_KEY = "phoenix"

ToolExecutionEnvironment = Literal["client", "server"]


@register_openapi_schema
class ToolCallProviderMetadata(BaseModel):
    """Payload Phoenix stamps under the ``phoenix`` namespace of Vercel AI
    ``providerMetadata`` on tool-call chunks (``tool-input-start`` and
    ``tool-input-available``)."""

    model_config = ConfigDict(extra="forbid")

    tool_execution_environment: ToolExecutionEnvironment
    """Whether the tool is executed on the client (external toolset) or on the
    Phoenix server (everything else, e.g. MCP tools and function tools)."""


def _get_updated_provider_metadata(
    *,
    provider_metadata: ProviderMetadata,
    tool_name: str,
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
        tool_execution_environment=tool_execution_environment
    )
    existing_tool_call_metadata: dict[str, Any] = result.get(_PHOENIX_PROVIDER_METADATA_KEY, {})
    result[_PHOENIX_PROVIDER_METADATA_KEY] = {
        **existing_tool_call_metadata,
        **new_tool_call_metadata.model_dump(),
    }
    return result


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AssistantMessageMetadataUsageTokens(_CamelModel):
    prompt: int
    completion: int
    total: int


class AssistantMessageMetadataUsageTokenDetails(_CamelModel):
    cache_read: int
    cache_write: int


class AssistantMessageMetadataUsage(_CamelModel):
    tokens: AssistantMessageMetadataUsageTokens
    prompt_details: AssistantMessageMetadataUsageTokenDetails | None = None


class AssistantMessageMetadataTraceIds(_CamelModel):
    trace_id: str
    root_span_id: str


class AssistantMessageMetadata(_CamelModel):
    """Wire schema for the chat stream's `message_metadata` payload."""

    session_id: str
    trace: AssistantMessageMetadataTraceIds | None = None
    usage: AssistantMessageMetadataUsage | None = None


class AssistantMetadataUIMessage(UIMessage):
    """`UIMessage` with `metadata` narrowed to `AssistantMessageMetadata`."""

    metadata: AssistantMessageMetadata | None = (
        None  # custom metadata type (provides stronger type in the OpenAPI schema)
    )


class _ObservabilityMixin(BaseModel):
    """Per-request observability flags"""

    model_config = ConfigDict(populate_by_name=True)

    ingest_traces: bool = Field(default=False, alias="ingestTraces")
    export_remote_traces: bool = Field(default=False, alias="exportRemoteTraces")
    attach_user_id: bool = Field(
        default=False,
        alias="attachUserId",
        description=(
            "When true and the request is authenticated as a PhoenixUser, attaches "
            "the user's email as the OpenInference ``user.id`` span attribute on "
            "all traced work for this request."
        ),
    )


class _ChatMessageMixin(_ObservabilityMixin):
    """Phoenix-specific extensions added to Vercel AI request messages."""

    model_config = ConfigDict(
        protected_namespaces=(),  # allow ``model`` field; pydantic reserves ``model_*``
    )

    contexts: list[ChatContext] = Field(default_factory=list)
    edit_permission: Literal["manual", "bypass"] = Field(
        default="manual",
        alias="editPermission",
    )
    requested_skills: list[str] = Field(
        default_factory=list,
        alias="requestedSkills",
        description=(
            "Skills the user explicitly requested via the prompt's slash-command "
            "affordance. The server force-loads each available skill by injecting a "
            "synthetic load_skill tool call/result at the tail of the message history. "
            "Unknown or context-unavailable names are ignored."
        ),
    )
    messages: list[AssistantMetadataUIMessage]
    model: AgentModelSelection


class ChatSubmitMessage(_ChatMessageMixin, SubmitMessage):
    """Submit message extended with Phoenix-specific fields."""


class ChatRegenerateMessage(_ChatMessageMixin, RegenerateMessage):
    """Regenerate message extended with Phoenix-specific fields."""


class ChatRequest(
    RootModel[
        Annotated[
            ChatSubmitMessage | ChatRegenerateMessage,
            Field(discriminator="trigger"),
        ]
    ]
):
    """Discriminated union of chat request payloads."""


class _SummarizeRequest(_ObservabilityMixin):
    """Body for POST /agents/{agent_id}/sessions/{session_id}/summary.

    Carries the Vercel-style messages array; the backend owns the prompt and
    the structured-output tool schema."""

    model_config = ConfigDict(
        protected_namespaces=(),  # allow ``model`` field; pydantic reserves ``model_*``
    )

    messages: list[UIMessage]
    model: AgentModelSelection

    @field_validator("messages", mode="before")
    @classmethod
    def _sanitize_raw_inputs(cls, value: Any) -> Any:
        # Workaround for https://github.com/pydantic/pydantic-ai/issues/5359:
        # `DynamicTool*Part` in pydantic-ai's Vercel schema doesn't declare
        # `providerExecuted`, so spec-compliant payloads from `useChat` fail
        # `extra='forbid'` validation. Strip the field until the upstream fix lands.
        if not isinstance(value, list):
            return value
        for msg in value:
            if not isinstance(msg, dict):
                continue
            for part in msg.get("parts", []) or []:
                if (
                    isinstance(part, dict)
                    and part.get("type") == "dynamic-tool"
                    and "providerExecuted" in part
                ):
                    del part["providerExecuted"]
        return value


class _SummarizeResponse(BaseModel):
    summary: str


logger = logging.getLogger(__name__)

_ASSISTANT_AGENT_ID = "assistant"


def _log_run_complete(result: AgentRunResult[Any]) -> None:
    """Log the full message history after an agent run completes."""
    messages = result.all_messages()
    logger.info("agent run complete: %d messages", len(messages))
    for message in messages:
        logger.info("%s", message)


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


def _build_assistant_message_metadata(
    *,
    span_context: SpanContext | None,
    session_id: str,
    usage: RunUsage,
) -> AssistantMessageMetadata:
    """Build the metadata payload attached to the turn's assistant message."""
    trace_ids = (
        AssistantMessageMetadataTraceIds(
            trace_id=format_trace_id(span_context.trace_id),
            root_span_id=format_span_id(span_context.span_id),
        )
        if span_context is not None
        else None
    )
    return AssistantMessageMetadata(
        session_id=session_id,
        trace=trace_ids,
        usage=_build_usage_payload(usage),
    )


def _build_message_metadata_chunk(
    *,
    span_context: SpanContext | None,
    session_id: str,
    usage: RunUsage,
) -> MessageMetadataChunk:
    """Build the `MessageMetadataChunk` emitted at the end of an agent turn."""
    return MessageMetadataChunk(
        message_metadata=_build_assistant_message_metadata(
            span_context=span_context,
            session_id=session_id,
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


_SESSION_TITLE_MAX_LENGTH = 50


def _derive_session_title(messages: list[dict[str, Any]]) -> str:
    """Initial title for a session row: the first user message's text,
    truncated like the frontend's display-name fallback. The LLM-generated
    summary overwrites it via the summary endpoint."""
    for message in messages:
        if message.get("role") != "user":
            continue
        text = " ".join(
            stripped
            for part in message.get("parts") or []
            if isinstance(part, dict)
            and part.get("type") == "text"
            and (stripped := str(part.get("text") or "").strip())
        ).strip()
        if text:
            if len(text) > _SESSION_TITLE_MAX_LENGTH:
                return f"{text[:_SESSION_TITLE_MAX_LENGTH]}..."
            return text
    return ""


async def _upsert_agent_session(
    session: AsyncSession,
    *,
    session_uuid: str,
    user_id: int | None,
    title: str,
    update_title_on_conflict: bool = False,
) -> int:
    """Insert the ``agent_sessions`` row if missing and return its rowid.

    An existing row keeps its owner; ``updated_at`` is always bumped so the
    session list orders by recency. The title is only overwritten when
    ``update_title_on_conflict`` is set (LLM summaries win over the derived
    first-message title).
    """
    set_: dict[str, Any] = {"updated_at": func.now()}
    if update_title_on_conflict:
        set_["title"] = title
    await session.execute(
        insert_on_conflict(
            {"session_uuid": session_uuid, "user_id": user_id, "title": title},
            table=models.AgentSession,
            dialect=SupportedSQLDialect(session.bind.dialect.name),
            unique_by=("session_uuid",),
            on_conflict=OnConflict.DO_UPDATE,
            set_=set_,
        )
    )
    rowid = await session.scalar(
        select(models.AgentSession.id).where(models.AgentSession.session_uuid == session_uuid)
    )
    assert rowid is not None
    return rowid


async def _persist_agent_session_turn(
    db: DbSessionFactory,
    *,
    session_uuid: str,
    user_id: int | None,
    messages: list[dict[str, Any]],
    bashkit_snapshot: bytes | None,
) -> None:
    """Persist a chat turn as a point-in-time session snapshot.

    Sessions live only in the database — there is no in-memory or
    browser-local copy — so this also runs when the stream ends early: the
    incoming transcript (and any bash state captured before the interruption)
    stays durable.
    """
    if not messages:
        return
    async with db() as session:
        agent_session_rowid = await _upsert_agent_session(
            session,
            session_uuid=session_uuid,
            user_id=user_id,
            title=_derive_session_title(messages),
        )
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=agent_session_rowid,
                messages=messages,
                bashkit_snapshot=bashkit_snapshot,
            )
        )


async def _load_latest_bash_snapshot(
    session: AsyncSession,
    *,
    agent_session_rowid: int,
) -> bytes | None:
    """Latest persisted shell state for the session; turns without bash
    activity store ``NULL`` and are skipped."""
    return await session.scalar(
        select(models.AgentSessionSnapshot.bashkit_snapshot)
        .where(
            models.AgentSessionSnapshot.agent_session_id == agent_session_rowid,
            models.AgentSessionSnapshot.bashkit_snapshot.is_not(None),
        )
        .order_by(models.AgentSessionSnapshot.id.desc())
        .limit(1)
    )


def _build_post_turn_transcript(
    *,
    request_messages: list[AssistantMetadataUIMessage],
    result: AgentRunResult[Any] | None,
    session_id: str,
    span_context: SpanContext | None,
) -> list[dict[str, Any]]:
    """Assemble the post-turn transcript as Vercel AI UIMessage JSON.

    The incoming messages are the client-assembled history (authoritative up
    to this turn, including client-executed tool outputs); the run result
    contributes this turn's new assistant messages. When the run failed or
    was interrupted, the incoming history alone is persisted.
    """
    transcript = [
        message.model_dump(mode="json", by_alias=True, exclude_none=True)
        for message in request_messages
    ]
    if result is None:
        return transcript
    try:
        new_ui_messages = VercelAIAdapter.dump_messages(result.new_messages())
        # Replace dump_messages' internal metadata: a resumed session sends
        # these messages back through AssistantMetadataUIMessage validation,
        # which requires the Phoenix metadata shape or None. The turn's final
        # assistant message carries the same payload the client received as a
        # MessageMetadataChunk, so usage and trace ids survive a reload.
        for message in new_ui_messages:
            message.metadata = None
        metadata = _build_assistant_message_metadata(
            span_context=span_context,
            session_id=session_id,
            usage=result.usage,
        ).model_dump(mode="json", by_alias=True, exclude_none=True)
        for message in reversed(new_ui_messages):
            if message.role == "assistant":
                message.metadata = metadata
                break
        new_messages = [
            message.model_dump(mode="json", by_alias=True, exclude_none=True)
            for message in new_ui_messages
        ]
    except Exception:
        logger.exception(
            "Failed to serialize the turn's new messages for session %r; "
            "persisting the incoming history only",
            session_id,
        )
        return transcript
    return [*transcript, *new_messages]


def create_agents_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post("/agents/server/sessions/{session_id}/chat")
    async def run_server_agent(
        session_id: str,
        request: Request,
        request_body: ChatRequest,
    ) -> Response:
        """Stream a chat turn from the GraphQL server agent.

        This is the endpoint the PXI CLI talks to directly (no pre-configured
        agent record): it builds a fresh server agent per request from the
        caller-supplied model and contexts, then streams the reply back as
        Vercel-AI chunks.

        The request contexts gate capabilities — GraphQL mutations, web access,
        and subagents — and mutations are refused for viewer users. When trace
        recording is enabled (and permitted by system settings), the run is
        traced; locally ingested traces are persisted to the agent's project
        once the stream completes.

        Returns ``403`` if agents or the server agent are disabled, or if a
        viewer requests mutations.
        """
        if not request.app.state.system_settings.agent_assistant_enabled.enabled:
            raise HTTPException(status_code=403, detail="Agents are disabled")
        if get_env_phoenix_agents_disable_bash():
            raise HTTPException(status_code=403, detail="Server agent is disabled")

        body = request_body.root
        resolved_contexts = resolve_contexts(body.contexts)
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        is_viewer = phoenix_user.is_viewer if phoenix_user is not None else False
        graphql_mutations_enabled = (
            resolved_contexts.graphql is not None and resolved_contexts.graphql.mutations_enabled
        )
        if graphql_mutations_enabled and is_viewer:
            raise HTTPException(status_code=403, detail="Viewer users cannot enable mutations")

        recording = request.app.state.system_settings.agent_trace_recording
        ingest_traces = bool(body.ingest_traces and recording.allow_local_traces)
        export_remote_traces = bool(body.export_remote_traces and recording.allow_remote_export)
        project_name = get_env_phoenix_agents_assistant_project_name()
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

        try:
            async with request.app.state.db() as session:
                model = await build_model(
                    body.model,
                    session=session,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        web_access_enabled = (
            resolved_contexts.web_access is not None
            and resolved_contexts.web_access.enabled
            and get_env_phoenix_agents_web_access_enabled()
        )
        subagents_enabled = _subagents_enabled(resolved_contexts)
        server_agent = build_server_agent(
            model=model,
            schema=request.app.state.graphql_schema,
            build_graphql_context=lambda: request.app.state.build_graphql_context(phoenix_user),
            prompts=ServerAgentPrompts(base=AgentPrompts().base),
            docs_mcp_server=request.app.state.docs_mcp_server,
            enable_web_access=web_access_enabled,
            allow_mutations=graphql_mutations_enabled,
            tracer_provider=tracer_provider,
            enable_subagents=subagents_enabled,
        )
        adapter: VercelAIAdapter[None, str] = VercelAIAdapter(
            agent=server_agent,
            run_input=body,
            accept=request.headers.get("accept"),
        )

        async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
            yield _build_message_metadata_chunk(
                span_context=agent_span_recorder.span_context if agent_span_recorder else None,
                session_id=session_id,
                usage=result.usage,
            )
            _log_run_complete(result)

        async def _stream_with_session() -> AsyncIterator[BaseChunk]:
            try:
                with detached_otel_context(), using_session(session_id=session_id):
                    raw_stream = adapter.run_stream(deps=None, on_complete=_on_complete)
                    assert _is_async_generator(raw_stream)
                    async with aclosing(raw_stream) as stream:
                        async for chunk in stream:
                            if isinstance(chunk, ToolInputAvailableChunk):
                                chunk.provider_metadata = _get_updated_provider_metadata(
                                    provider_metadata=chunk.provider_metadata or {},
                                    tool_name=chunk.tool_name,
                                )
                            yield chunk
            finally:
                if tracer is not None:
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

    @router.post("/agents/{agent_id}/sessions/{session_id}/chat")
    async def chat(
        agent_id: str,
        session_id: str,
        request: Request,
        request_body: ChatRequest,
    ) -> Response:
        if agent_id != _ASSISTANT_AGENT_ID:
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        if not request.app.state.system_settings.agent_assistant_enabled.enabled:
            raise HTTPException(status_code=403, detail="Agents are disabled")
        body = request_body.root
        recording = request.app.state.system_settings.agent_trace_recording
        ingest_traces = bool(body.ingest_traces and recording.allow_local_traces)
        export_remote_traces = bool(body.export_remote_traces and recording.allow_remote_export)
        project_name = get_env_phoenix_agents_assistant_project_name()
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

        resolved_contexts = resolve_contexts(body.contexts)
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        request_user_id = int(phoenix_user.identity) if phoenix_user is not None else None
        phoenix_user_email: str | None = None
        initial_bash_snapshot: bytes | None = None
        try:
            async with request.app.state.db() as session:
                model = await build_model(
                    body.model,
                    session=session,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
                sandbox_availability = SandboxAvailability()
                if _contexts_need_sandbox_availability(resolved_contexts):
                    available_backend_types = await _load_available_sandbox_backend_types(
                        session=session,
                        decrypt=request.app.state.decrypt,
                    )
                    sandbox_availability = await _load_sandbox_availability(
                        session,
                        available_backend_types=available_backend_types,
                    )
                model_provider_availability = ModelProviderAvailability()
                if _contexts_need_model_provider_availability(resolved_contexts):
                    model_provider_availability = _load_model_provider_availability()
                phoenix_user_email = await _load_phoenix_user_email(
                    session=session,
                    phoenix_user=phoenix_user,
                )
                existing_session_row = (
                    await session.execute(
                        select(models.AgentSession.id, models.AgentSession.user_id).where(
                            models.AgentSession.session_uuid == session_id
                        )
                    )
                ).first()
                if existing_session_row is not None:
                    agent_session_rowid, session_owner_id = existing_session_row
                    # A persisted session is only usable by its owner: a foreign
                    # session id must neither restore another user's shell state
                    # nor append snapshots to their transcript.
                    if phoenix_user is not None and session_owner_id != request_user_id:
                        raise HTTPException(status_code=404, detail="Session not found")
                    initial_bash_snapshot = await _load_latest_bash_snapshot(
                        session,
                        agent_session_rowid=agent_session_rowid,
                    )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

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
        is_viewer = phoenix_user.is_viewer if phoenix_user is not None else False
        subagents_enabled = _subagents_enabled(resolved_contexts)
        graphql_mutations_enabled = (
            resolved_contexts.graphql is not None and resolved_contexts.graphql.mutations_enabled
        )
        if graphql_mutations_enabled and is_viewer:
            raise HTTPException(status_code=403, detail="Viewer users cannot enable mutations")
        server_agent = (
            build_server_agent(
                model=model,
                schema=request.app.state.graphql_schema,
                build_graphql_context=lambda: request.app.state.build_graphql_context(phoenix_user),
                docs_mcp_server=request.app.state.docs_mcp_server,
                enable_web_access=web_access_enabled,
                allow_mutations=graphql_mutations_enabled,
                tracer_provider=tracer_provider,
                enable_subagents=False,
            )
            if subagents_enabled
            else None
        )
        subagent_message_chunks: asyncio.Queue[BaseChunk | _SubagentMessageChunksClosed] = (
            asyncio.Queue()
        )
        final_tool_outputs_by_tool_call_id: dict[str, ToolOutputAvailableChunk] = {}
        publish_subagent_message_chunk: (
            Callable[[ToolOutputAvailableChunk], Awaitable[None]] | None
        ) = None
        set_subagent_final_tool_output: Callable[[ToolOutputAvailableChunk], None] | None = None

        if server_agent is not None:

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

        bash_enabled = not get_env_phoenix_agents_disable_bash()
        captured_bash_snapshot: list[bytes] = []

        def _capture_bash_snapshot(snapshot: bytes) -> None:
            # Held until turn end and persisted with the transcript in a
            # single agent_session_snapshots row.
            captured_bash_snapshot[:] = [snapshot]

        agent = build_agent(
            model=model,
            docs_mcp_server=request.app.state.docs_mcp_server,
            enable_web_access=web_access_enabled,
            tracer_provider=tracer_provider,
            server_agent=server_agent,
            publish_subagent_message_chunk=publish_subagent_message_chunk,
            set_subagent_final_tool_output=set_subagent_final_tool_output,
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
        agent_prompts = AgentPrompts()
        forced_skills: list[Skill] = []
        if body.requested_skills:
            available_skills = get_skills_for_contexts(resolved_contexts)
            forced_skills = resolve_requested_skills(
                messages=body.messages,
                requested_skill_names=body.requested_skills,
                available_skills=available_skills,
            )
            if forced_skills:
                body.messages = inject_requested_skills(
                    messages=body.messages,
                    requested_skill_names=body.requested_skills,
                    available_skills=available_skills,
                    load_skill_template=agent_prompts.load_skill,
                    message_factory=AssistantMetadataUIMessage,
                )
        adapter: VercelAIAdapter[AgentDependencies, AgentOutput] = VercelAIAdapter(
            agent=agent,
            run_input=body,
            accept=request.headers.get("accept"),
        )
        deps = AgentDependencies(
            contexts=resolved_contexts,
            edit_permission=body.edit_permission,
            is_viewer=is_viewer,
            sandbox_availability=sandbox_availability,
            model_provider_availability=model_provider_availability,
        )

        parent_context = extract_otel_context(dict(request.headers))
        request_parent_span_context = _get_span_context(parent_context)
        completed_run: list[tuple[AgentRunResult[Any], SpanContext | None]] = []

        async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
            span_context = (
                agent_span_recorder.span_context
                if agent_span_recorder and agent_span_recorder.span_context is not None
                else request_parent_span_context
            )
            completed_run[:] = [(result, span_context)]
            yield _build_message_metadata_chunk(
                span_context=span_context,
                session_id=session_id,
                usage=result.usage,
            )
            _log_run_complete(result)

        async def _stream_with_session() -> AsyncIterator[BaseChunk]:
            try:
                with (
                    detached_otel_context(parent_context),
                    using_session(session_id=session_id),
                    _maybe_using_user(body.attach_user_id, phoenix_user_email),
                ):
                    raw_stream = adapter.run_stream(deps=deps, on_complete=_on_complete)
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
                                            )
                                            forced_skill_message_chunk.provider_metadata = (
                                                provider_metadata
                                            )
                                        yield forced_skill_message_chunk
                                    forced_skills_streamed = True

                    async for message_chunk in _interleave_agent_and_subagent_message_chunks(
                        agent_message_chunks=_agent_message_chunks(),
                        subagent_message_chunks=subagent_message_chunks,
                        final_tool_outputs_by_tool_call_id=final_tool_outputs_by_tool_call_id,
                    ):
                        yield message_chunk
            finally:
                result, span_context = completed_run[0] if completed_run else (None, None)
                try:
                    await _persist_agent_session_turn(
                        request.app.state.db,
                        session_uuid=session_id,
                        user_id=request_user_id,
                        messages=_build_post_turn_transcript(
                            request_messages=body.messages,
                            result=result,
                            session_id=session_id,
                            span_context=span_context,
                        ),
                        bashkit_snapshot=(
                            captured_bash_snapshot[0] if captured_bash_snapshot else None
                        ),
                    )
                except Exception:
                    logger.exception("Failed to persist agent session %r", session_id)
                if tracer is not None:
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

    @router.post(
        "/agents/{agent_id}/sessions/{session_id}/summary",
        response_model=_SummarizeResponse,
    )
    async def summarize_endpoint(
        agent_id: str,
        session_id: str,
        request: Request,
        body: _SummarizeRequest,
    ) -> _SummarizeResponse:
        if agent_id != _ASSISTANT_AGENT_ID:
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        if not request.app.state.system_settings.agent_assistant_enabled.enabled:
            raise HTTPException(status_code=403, detail="Agents are disabled")
        recording = request.app.state.system_settings.agent_trace_recording
        ingest_traces = bool(body.ingest_traces and recording.allow_local_traces)
        export_remote_traces = bool(body.export_remote_traces and recording.allow_remote_export)
        project_name = get_env_phoenix_agents_assistant_project_name()
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

        try:
            async with request.app.state.db() as session:
                model = await build_model(
                    body.model,
                    session=session,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
                user = request.user if "user" in request.scope else None
                phoenix_user = user if isinstance(user, PhoenixUser) else None
                phoenix_user_email = await _load_phoenix_user_email(
                    session=session,
                    phoenix_user=phoenix_user,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        history = VercelAIAdapter.load_messages(body.messages)
        parent_context = extract_otel_context(dict(request.headers))
        try:
            with (
                detached_otel_context(parent_context),
                using_metadata({"session_id": session_id}),
                _maybe_using_user(body.attach_user_id, phoenix_user_email),
            ):
                result = await summarize_messages(messages=history, model=model)
        except SummarizationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        finally:
            if tracer is not None:
                tracer.tracer_provider.force_flush()
                if ingest_traces:
                    project_id = await _ensure_project_exists(request.app.state.db, project_name)
                    db_traces = tracer.get_db_traces(project_id=project_id)
                    await _persist_db_traces_and_emit_event(
                        db=request.app.state.db,
                        event_queue=request.state.event_queue,
                        db_traces=db_traces,
                    )
                tracer.tracer_provider.shutdown()
        summary = result.summary.strip()
        if summary:
            # The summary doubles as the persisted session title. Skip the
            # write when the session row belongs to someone else.
            request_user_id = int(phoenix_user.identity) if phoenix_user is not None else None
            try:
                async with request.app.state.db() as session:
                    owner_row = (
                        await session.execute(
                            select(models.AgentSession.user_id).where(
                                models.AgentSession.session_uuid == session_id
                            )
                        )
                    ).first()
                    if owner_row is None or phoenix_user is None or owner_row[0] == request_user_id:
                        await _upsert_agent_session(
                            session,
                            session_uuid=session_id,
                            user_id=request_user_id,
                            title=summary,
                            update_title_on_conflict=True,
                        )
            except Exception:
                logger.exception("Failed to persist agent session title %r", session_id)
        return _SummarizeResponse(summary=summary)

    return router
