import logging
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from openinference.instrumentation import using_session
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
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, MessageMetadataChunk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.agents.agent_factory import ChatOutput, build_agent
from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_params import ChatSearchParams, parse_chat_search_params
from phoenix.server.agents.context import (
    ChatContext,
    resolve_contexts,
)
from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.exceptions import AgentError, SummarizationError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.summarization import summarize_messages
from phoenix.server.bearer_auth import is_authenticated
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer


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

    contexts: list[ChatContext] = Field(default_factory=list)
    capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities)
    messages: list[AssistantMetadataUIMessage]


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

    messages: list[UIMessage]

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
            self.span_context = span.get_span_context()  # type: ignore[no-untyped-call]

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
    db_traces: list[models.Trace],
) -> None:
    """
    Upsert any ProjectSession rows attached to ``db_traces`` (keyed by session_id),
    then re-point each trace at the resolved rowid. Does NOT persist the traces
    themselves — the caller is responsible for adding them to the session.
    """
    sessions_by_session_id: dict[str, models.ProjectSession] = {}
    for db_trace in db_traces:
        ps = db_trace.project_session
        if ps is None:
            continue
        existing = sessions_by_session_id.get(ps.session_id)
        if existing is None:
            sessions_by_session_id[ps.session_id] = ps
        else:
            if ps.start_time < existing.start_time:
                existing.start_time = ps.start_time
            if existing.end_time < ps.end_time:
                existing.end_time = ps.end_time

    if not sessions_by_session_id:
        return

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    records = [
        {
            "session_id": ps.session_id,
            "project_id": ps.project_id,
            "start_time": ps.start_time,
            "end_time": ps.end_time,
        }
        for ps in sessions_by_session_id.values()
    ]
    await session.execute(
        insert_on_conflict(
            *records,
            table=models.ProjectSession,
            dialect=dialect,
            unique_by=("session_id",),
            on_conflict=OnConflict.DO_UPDATE,
        )
    )
    id_rows = await session.execute(
        select(models.ProjectSession.id, models.ProjectSession.session_id).where(
            models.ProjectSession.session_id.in_(sessions_by_session_id.keys())
        )
    )
    session_id_to_rowid = {session_id: id_ for id_, session_id in id_rows.all()}
    for db_trace in db_traces:
        ps = db_trace.project_session
        if ps is None:
            continue
        # detach in-memory ProjectSession to avoid cascading insert; use the
        # resolved rowid from the upsert instead.
        db_trace.project_session = None  # type: ignore[assignment]
        db_trace.project_session_rowid = session_id_to_rowid[ps.session_id]


def create_agents_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post(
        "/agents/{agent_id}/sessions/{session_id}/chat",
        responses={
            200: {
                "model": AssistantMessageMetadata,
                "description": (
                    "Vercel-AI-style SSE stream. The turn ends with a "
                    "`message-metadata` chunk whose `messageMetadata` payload "
                    "matches `AssistantMessageMetadata`. Declared here so the "
                    "model is included in the generated OpenAPI components."
                ),
            }
        },
    )
    async def chat(
        agent_id: str,
        session_id: str,
        request: Request,
        params: Annotated[ChatSearchParams, Depends(parse_chat_search_params)],
        request_body: ChatRequest,
    ) -> Response:
        if agent_id != _ASSISTANT_AGENT_ID:
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        body = request_body.root
        project_name = get_env_phoenix_agents_assistant_project_name()
        tracer = (
            Tracer(
                span_cost_calculator=request.app.state.span_cost_calculator,
                enable_remote_export=body.export_remote_traces,
                project_name=project_name,
            )
            if (body.ingest_traces or body.export_remote_traces)
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
                    params,
                    session=session,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        logger.info(
            "agent model: %s.%s settings=%r",
            type(model).__module__,
            type(model).__qualname__,
            getattr(model, "settings", None),
        )

        agent = build_agent(model, tracer_provider=tracer_provider)
        adapter: VercelAIAdapter[ChatDependencies, ChatOutput] = VercelAIAdapter(
            agent=agent,
            run_input=body,
            accept=request.headers.get("accept"),
        )
        deps = ChatDependencies(
            contexts=resolve_contexts(body.contexts),
            capabilities=body.capabilities,
            docs_mcp_toolset=request.app.state.docs_mcp_toolset,
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
                with using_session(session_id=session_id):
                    async for chunk in adapter.run_stream(deps=deps, on_complete=_on_complete):
                        yield chunk
            finally:
                if tracer is not None:
                    tracer.tracer_provider.force_flush()
                    if body.ingest_traces:
                        project_id = await _ensure_project_exists(
                            request.app.state.db, project_name
                        )
                        db_traces = tracer.get_db_traces(project_id=project_id)
                        if db_traces:
                            async with request.app.state.db() as session:
                                await _upsert_project_sessions(session, db_traces)
                                session.add_all(db_traces)
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
        params: Annotated[ChatSearchParams, Depends(parse_chat_search_params)],
        body: _SummarizeRequest,
    ) -> _SummarizeResponse:
        if agent_id != _ASSISTANT_AGENT_ID:
            raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id!r}")
        project_name = get_env_phoenix_agents_assistant_project_name()
        tracer = (
            Tracer(
                span_cost_calculator=request.app.state.span_cost_calculator,
                enable_remote_export=body.export_remote_traces,
                project_name=project_name,
            )
            if (body.ingest_traces or body.export_remote_traces)
            else None
        )
        tracer_provider = tracer.tracer_provider if tracer is not None else None

        try:
            async with request.app.state.db() as session:
                model = await build_model(
                    params,
                    session=session,
                    decrypt=request.app.state.decrypt,
                    tracer_provider=tracer_provider,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        history = VercelAIAdapter.load_messages(body.messages)
        try:
            with using_session(session_id=session_id):
                result = await summarize_messages(messages=history, model=model)
        except SummarizationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        finally:
            if tracer is not None:
                tracer.tracer_provider.force_flush()
                if body.ingest_traces:
                    project_id = await _ensure_project_exists(request.app.state.db, project_name)
                    db_traces = tracer.get_db_traces(project_id=project_id)
                    if db_traces:
                        async with request.app.state.db() as session:
                            await _upsert_project_sessions(session, db_traces)
                            session.add_all(db_traces)
                            await session.flush()
                tracer.tracer_provider.shutdown()
        return _SummarizeResponse(summary=result.summary.strip())

    return router
