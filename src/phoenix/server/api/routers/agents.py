import logging
from collections.abc import AsyncGenerator, AsyncIterator, Callable, Iterable
from contextlib import aclosing
from copy import deepcopy
from typing import Annotated, Any, Literal, TypeVar

from fastapi import APIRouter, Depends, HTTPException
from openinference.instrumentation import using_metadata, using_session
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SDKSpan
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.trace import SpanContext, format_span_id, format_trace_id
from pydantic import BaseModel, ConfigDict, Field, RootModel, field_validator
from pydantic.alias_generators import to_camel
from pydantic_ai import AgentRunResult, RunUsage
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
    ToolInputAvailableChunk,
)
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
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import get_external_tool_definition
from phoenix.server.agents.context import (
    ChatContext,
    ResolvedContexts,
    resolve_contexts,
)
from phoenix.server.agents.exceptions import AgentError, SummarizationError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import AgentModelSelection
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
from phoenix.server.sandbox import SecretsContext
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer, detached_otel_context

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


def _build_message_metadata_chunk(
    *,
    span_context: SpanContext | None,
    session_id: str,
    usage: RunUsage,
) -> MessageMetadataChunk:
    """Build the `MessageMetadataChunk` emitted at the end of an agent turn."""
    trace_ids = (
        AssistantMessageMetadataTraceIds(
            trace_id=format_trace_id(span_context.trace_id),
            root_span_id=format_span_id(span_context.span_id),
        )
        if span_context is not None
        else None
    )
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
    return MessageMetadataChunk(
        message_metadata=AssistantMessageMetadata(
            session_id=session_id,
            trace=trace_ids,
            usage=usage_payload,
        )
    )


async def _persist_db_traces(
    *,
    session: AsyncSession,
    db_traces: list[models.Trace],
) -> None:
    project_sessions = [
        db_trace.project_session for db_trace in db_traces if db_trace.project_session is not None
    ]
    persistent_by_session_id = await _upsert_project_sessions(session, project_sessions)
    for db_trace in db_traces:
        project_session = db_trace.project_session
        if project_session is None:
            continue
        # Replace the transient ProjectSession (built by Tracer) with the
        # persistent one loaded from the upsert, so SQLAlchemy resolves the FK
        # from the relationship and doesn't try to cascade-insert a duplicate.
        db_trace.project_session = persistent_by_session_id[project_session.session_id]
    session.add_all(db_traces)


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


def create_agents_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], dependencies=dependencies)

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
        agent = build_agent(
            model=model,
            docs_mcp_server=request.app.state.docs_mcp_server,
            enable_web_access=web_access_enabled,
            tracer_provider=tracer_provider,
        )
        adapter: VercelAIAdapter[AgentDependencies, AgentOutput] = VercelAIAdapter(
            agent=agent,
            run_input=body,
            accept=request.headers.get("accept"),
        )
        is_viewer = False
        if "user" in request.scope:
            user = request.user
            if isinstance(user, PhoenixUser):
                is_viewer = user.is_viewer
        deps = AgentDependencies(
            contexts=resolved_contexts,
            edit_permission=body.edit_permission,
            is_viewer=is_viewer,
            sandbox_availability=sandbox_availability,
            model_provider_availability=model_provider_availability,
        )

        async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
            yield _build_message_metadata_chunk(
                span_context=agent_span_recorder.span_context if agent_span_recorder else None,
                session_id=session_id,
                usage=result.usage(),
            )
            _log_run_complete(result)

        async def _stream_with_session() -> AsyncIterator[BaseChunk]:
            try:
                with detached_otel_context(), using_session(session_id=session_id):
                    raw_stream = adapter.run_stream(deps=deps, on_complete=_on_complete)
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
                        if db_traces:
                            async with request.app.state.db() as session:
                                await _persist_db_traces(session=session, db_traces=db_traces)
                                await session.flush()
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
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        history = VercelAIAdapter.load_messages(body.messages)
        try:
            with detached_otel_context(), using_metadata({"session_id": session_id}):
                result = await summarize_messages(messages=history, model=model)
        except SummarizationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        finally:
            if tracer is not None:
                tracer.tracer_provider.force_flush()
                if ingest_traces:
                    project_id = await _ensure_project_exists(request.app.state.db, project_name)
                    db_traces = tracer.get_db_traces(project_id=project_id)
                    if db_traces:
                        async with request.app.state.db() as session:
                            await _persist_db_traces(session=session, db_traces=db_traces)
                            await session.flush()
                tracer.tracer_provider.shutdown()
        return _SummarizeResponse(summary=result.summary.strip())

    return router
