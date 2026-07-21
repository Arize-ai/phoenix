"""Deprecated ``/agents/server/sessions/{session_id}/chat`` route.

Preserves the pre-session-persistence chat contract for published CLI clients
(``@arizeai/phoenix-cli`` <= 1.10.x): the client mints its own session id and
POSTs the full Vercel-AI ``messages`` transcript each turn. The handler is
fully stateless — nothing is persisted, old clients own their transcripts.

New clients should create an ``AgentSession`` via the ``createAgentSession``
GraphQL mutation and POST single-message turns to
``/agents/assistant/sessions/{session_id}/chat`` instead.

This module (and its route) is scheduled for removal once the deprecation
window closes; see the ``Deprecation`` response header.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import aclosing
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from openinference.instrumentation import using_session
from pydantic import BaseModel, ConfigDict, Field, RootModel
from pydantic_ai import AgentRunResult
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    RegenerateMessage,
    SubmitMessage,
    UIMessage,
)
from pydantic_ai.ui.vercel_ai.response_types import (
    BaseChunk,
    ToolInputAvailableChunk,
)
from starlette.requests import Request
from starlette.responses import Response

from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_disable_bash,
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.db.types.data_stream_protocol import AssistantMessageMetadata
from phoenix.server.agents.context import ChatContext, resolve_contexts
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import AgentModelSelection
from phoenix.server.agents.prompts import AgentPrompts, ServerAgentPrompts
from phoenix.server.agents.server_agents import build_server_agent
from phoenix.server.api.routers.agents import (
    _AgentSpanContextRecorder,
    _build_message_metadata_chunk,
    _ensure_project_exists,
    _get_updated_provider_metadata,
    _is_async_generator,
    _persist_db_traces_and_emit_event,
    _subagents_enabled,
)
from phoenix.server.bearer_auth import PhoenixUser, is_authenticated
from phoenix.tracers import Tracer, detached_otel_context

logger = logging.getLogger(__name__)

_DEPRECATION_HEADER = "Deprecation"
# RFC 9745 boolean form: the route is deprecated with no sunset date chosen yet.
_DEPRECATION_HEADER_VALUE = "true"


class LegacyAssistantMetadataUIMessage(UIMessage):
    """``UIMessage`` with ``metadata`` narrowed to ``AssistantMessageMetadata``."""

    metadata: AssistantMessageMetadata | None = None


class _LegacyObservabilityMixin(BaseModel):
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


class _LegacyChatMessageMixin(_LegacyObservabilityMixin):
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
            "affordance. Ignored by this legacy route."
        ),
    )
    messages: list[LegacyAssistantMetadataUIMessage]
    model: AgentModelSelection


class LegacyChatSubmitMessage(_LegacyChatMessageMixin, SubmitMessage):
    """Submit message extended with Phoenix-specific fields."""


class LegacyChatRegenerateMessage(_LegacyChatMessageMixin, RegenerateMessage):
    """Regenerate message extended with Phoenix-specific fields."""


class LegacyChatRequest(
    RootModel[
        Annotated[
            LegacyChatSubmitMessage | LegacyChatRegenerateMessage,
            Field(discriminator="trigger"),
        ]
    ]
):
    """Discriminated union of legacy chat request payloads."""


def _log_run_complete(result: AgentRunResult[Any]) -> None:
    """Log the full message history after an agent run completes."""
    messages = result.all_messages()
    logger.info("agent run complete: %d messages", len(messages))
    for message in messages:
        logger.info("%s", message)


def create_legacy_agents_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post(
        "/agents/server/sessions/{session_id}/chat",
        deprecated=True,
    )
    async def run_server_agent(
        session_id: str,
        request: Request,
        request_body: LegacyChatRequest,
    ) -> Response:
        """Stream a chat turn from the GraphQL server agent (deprecated).

        Deprecated transcript-in/stream-out contract kept for published CLI
        clients (``@arizeai/phoenix-cli`` <= 1.10.x): the caller supplies the
        full ``messages`` transcript and a self-minted session id, and the
        server builds a fresh agent per request without persisting anything.

        New clients should create an ``AgentSession`` via the
        ``createAgentSession`` GraphQL mutation and POST single-message turns
        to ``/agents/assistant/sessions/{session_id}/chat`` instead.

        The request contexts gate capabilities — GraphQL mutations, web access,
        and subagents — and mutations are refused for viewer users. When trace
        recording is enabled (and permitted by system settings), the run is
        traced; locally ingested traces are persisted to the agent's project
        once the stream completes.

        Returns ``403`` if agents or the server agent are disabled, or if a
        viewer requests mutations.
        """
        logger.warning(
            "Deprecated route POST /agents/server/sessions/%s/chat was called; "
            "clients should migrate to POST /agents/assistant/sessions/{session_id}/chat "
            "with a session created via the createAgentSession GraphQL mutation.",
            session_id,
        )
        if not request.app.state.system_settings.agent_assistant_enabled.enabled:
            raise HTTPException(status_code=403, detail="Agents are disabled")
        if get_env_phoenix_agents_disable_bash():
            raise HTTPException(status_code=403, detail="Server agent is disabled")

        body = request_body.root
        resolved_contexts = resolve_contexts(body.contexts)
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        user_id = int(phoenix_user.identity) if phoenix_user is not None else None
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
            db=request.app.state.db,
            event_queue=request.state.event_queue,
            prompts=ServerAgentPrompts(base=AgentPrompts().base),
            docs_mcp_server=request.app.state.docs_mcp_server,
            enable_web_access=web_access_enabled,
            allow_mutations=graphql_mutations_enabled,
            read_only=request.app.state.read_only,
            auth_enabled=request.app.state.authentication_enabled,
            user_id=user_id,
            is_viewer=is_viewer,
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
                turn_trace_context=None,
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
                                    emitted_at=datetime.now(timezone.utc),
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

        response = adapter.streaming_response(_stream_with_session())
        response.headers[_DEPRECATION_HEADER] = _DEPRECATION_HEADER_VALUE
        return response

    return router
