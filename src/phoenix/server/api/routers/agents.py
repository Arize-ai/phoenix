import logging
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from openinference.instrumentation import using_session
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.context import Context
from opentelemetry.sdk.trace import Span as SDKSpan
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.trace import SpanContext, format_span_id, format_trace_id
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from pydantic.types import Discriminator
from pydantic_ai import AgentRunResult, RunUsage
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    RegenerateMessage,
    SubmitMessage,
    UIMessage,
)
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, MessageMetadataChunk
from sqlalchemy import insert, select
from starlette.requests import Request
from starlette.responses import Response

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.server.agents.agent_factory import ChatOutput, build_agent
from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_params import ChatSearchParamsModel
from phoenix.server.agents.context import (
    ChatContext,
    resolve_contexts,
)
from phoenix.server.agents.dependencies import ChatDependencies
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.summarization import SummarizationError, summarize_messages
from phoenix.server.bearer_auth import is_authenticated
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer


class _ObservabilityMixin(BaseModel):
    """Per-request observability flags"""

    model_config = ConfigDict(populate_by_name=True)

    ingest_traces: bool = Field(default=False, alias="ingestTraces")
    export_remote_traces: bool = Field(default=False, alias="exportRemoteTraces")


class _ChatMessageMixin(_ObservabilityMixin):
    """Phoenix-specific extensions added to Vercel AI request messages."""

    contexts: list[ChatContext] = Field(default_factory=list)
    capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities)


class _SubmitMessage(_ChatMessageMixin, SubmitMessage):
    """Submit message extended with Phoenix-specific fields."""


class _RegenerateMessage(_ChatMessageMixin, RegenerateMessage):
    """Regenerate message extended with Phoenix-specific fields."""


_RequestData = Annotated[
    _SubmitMessage | _RegenerateMessage,
    Discriminator("trigger"),
]


class _SummarizeRequest(_ObservabilityMixin):
    """Body for POST /agent-sessions/{session_id}/summary.

    Carries the Vercel-style messages array; the backend owns the prompt and
    the structured-output tool schema."""

    messages: list[UIMessage]

    @field_validator("messages", mode="before")
    @classmethod
    def _sanitize_raw_inputs(cls, value: Any) -> Any:
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


def _log_run_complete(result: AgentRunResult[Any]) -> None:
    """Log the full message history after an agent run completes."""
    messages = result.all_messages()
    logger.info("agent run complete: %d messages", len(messages))
    for message in messages:
        logger.info("%s", message)


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class _UsageTokens(_CamelModel):
    prompt: int
    completion: int
    total: int


class _UsageTokenDetails(_CamelModel):
    cache_read: int
    cache_write: int


class _Usage(_CamelModel):
    tokens: _UsageTokens
    prompt_details: _UsageTokenDetails | None = None


class _TraceIds(_CamelModel):
    trace_id: str
    root_span_id: str


class _AssistantMessageMetadata(_CamelModel):
    """Wire schema for the chat stream's `message_metadata` payload."""

    session_id: str
    trace: _TraceIds | None = None
    usage: _Usage | None = None


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
        _TraceIds(
            trace_id=format_trace_id(span_context.trace_id),
            root_span_id=format_span_id(span_context.span_id),
        )
        if span_context is not None
        else None
    )
    usage_payload = _Usage(
        tokens=_UsageTokens(
            prompt=usage.input_tokens,
            completion=usage.output_tokens,
            total=usage.total_tokens,
        )
    )
    if usage.cache_read_tokens or usage.cache_write_tokens:
        usage_payload.prompt_details = _UsageTokenDetails(
            cache_read=usage.cache_read_tokens,
            cache_write=usage.cache_write_tokens,
        )
    return MessageMetadataChunk(
        message_metadata=_AssistantMessageMetadata(
            session_id=session_id,
            trace=trace_ids,
            usage=usage_payload,
        )
    )


async def _ensure_project_exists(db: DbSessionFactory, project_name: str) -> int:
    """Resolve project_id by name, creating the project row if missing."""
    async with db() as session:
        project_id = await session.scalar(select(models.Project.id).filter_by(name=project_name))
        if project_id is None:
            project_id = await session.scalar(
                insert(models.Project).values(name=project_name).returning(models.Project.id)
            )
        assert project_id is not None
        return project_id


def create_agents_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post("/agent-sessions/{session_id}/chat")
    async def chat(
        session_id: str,
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
        body: _RequestData,
    ) -> Response:
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

        project_id: int | None = None
        if body.ingest_traces:
            project_id = await _ensure_project_exists(request.app.state.db, project_name)

        try:
            async with request.app.state.db() as session:
                model = await build_model(
                    params.root,
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
            user=request.scope.get("user") if hasattr(request, "scope") else None,
            db=request.app.state.db,
            contexts=resolve_contexts(body.contexts),
            capabilities=body.capabilities,
            docs_mcp_toolset=request.app.state.docs_mcp_toolset,
        )

        async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
            # `trace.get_current_span()` is unusable here: the pydantic-ai
            # adapter invokes `on_complete` after the AGENT span has closed,
            # so the current span has fallen back to the no-op span. The
            # span processor registered above captured the AGENT span's
            # context on its `on_start`, while it was still valid.
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
                    if project_id is not None:
                        db_traces = tracer.get_db_traces(project_id=project_id)
                        if db_traces:
                            async with request.app.state.db() as session:
                                session.add_all(db_traces)
                                await session.flush()
                    tracer.tracer_provider.shutdown()

        return adapter.streaming_response(_stream_with_session())

    @router.post(
        "/agent-sessions/{session_id}/summary",
        response_model=_SummarizeResponse,
    )
    async def summarize_endpoint(
        session_id: str,
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
        body: _SummarizeRequest,
    ) -> _SummarizeResponse:
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

        project_id: int | None = None
        if body.ingest_traces:
            project_id = await _ensure_project_exists(request.app.state.db, project_name)

        try:
            async with request.app.state.db() as session:
                model = await build_model(
                    params.root,
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
                if project_id is not None:
                    db_traces = tracer.get_db_traces(project_id=project_id)
                    if db_traces:
                        async with request.app.state.db() as session:
                            session.add_all(db_traces)
                            await session.flush()
                tracer.tracer_provider.shutdown()
        return _SummarizeResponse(summary=result.summary.strip())

    return router
