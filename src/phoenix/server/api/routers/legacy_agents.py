"""Deprecated ``/agents/server/sessions/{session_id}/chat`` route.
Preserved for compatibility between old clients and new servers.
To be removed.
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
    ErrorChunk,
    MessageMetadataChunk,
    ToolInputAvailableChunk,
)
from starlette.requests import Request
from starlette.responses import Response

from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_disable_bash,
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.db.types.data_stream_protocol import PhoenixAssistantMessageMetadata
from phoenix.server.agents.agent_factory import build_agent, build_agent_tracer
from phoenix.server.agents.config import AgentsEnvConfig
from phoenix.server.agents.context import ChatContext, resolve_contexts
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.github import GitHubMCPConfig, resolve_github_mcp_config
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import AgentModelSelection
from phoenix.server.agents.pydantic_ai import OpenInferenceAgentWrapper
from phoenix.server.agents.types import AgentDependencies, AgentOutput
from phoenix.server.api.routers.agents import (
    _build_phoenix_assistant_message_metadata,
    _ensure_project_exists,
    _get_current_context_usage,
    _get_updated_provider_metadata,
    _is_async_generator,
    _persist_db_traces_and_emit_event,
    _resolve_trace_recording,
    _subagents_enabled,
)
from phoenix.server.api.routers.v1.utils import add_errors_to_responses
from phoenix.server.authorization import (
    is_agent_assistant_enabled,
    is_not_locked,
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import PhoenixUser, is_authenticated
from phoenix.tracers import Tracer, detached_otel_context

logger = logging.getLogger(__name__)

_DEPRECATION_HEADER = "Deprecation"
# RFC 9745 boolean form: the route is deprecated with no sunset date chosen yet.
_DEPRECATION_HEADER_VALUE = "true"


class LegacyAssistantMessageMetadata(PhoenixAssistantMessageMetadata):
    """Legacy transcripts predate the ``type`` discriminator, so default it here."""

    model_config = ConfigDict(extra="allow")

    type: Literal["assistant"] = "assistant"


class LegacyAssistantMetadataUIMessage(UIMessage):
    """``UIMessage`` with ``metadata`` narrowed to ``PhoenixAssistantMessageMetadata``."""

    metadata: LegacyAssistantMessageMetadata | None = None


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
    dependencies = [
        Depends(is_agent_assistant_enabled),
        Depends(prevent_access_in_read_only_mode),
        Depends(restrict_access_by_viewers),
        Depends(is_not_locked),
    ]
    if authentication_enabled:
        dependencies.append(Depends(is_authenticated))
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post(
        "/agents/server/sessions/{session_id}/chat",
        operation_id="legacyServerAgentChat",
        deprecated=True,
        responses=add_errors_to_responses([400, 401, 403, 404, 507]),
    )
    async def run_headless_agent(
        session_id: str,
        request: Request,
        request_body: LegacyChatRequest,
    ) -> Response:
        if get_env_phoenix_agents_disable_bash():
            raise HTTPException(status_code=403, detail="Headless agent is disabled")

        body = request_body.root
        resolved_contexts = resolve_contexts(body.contexts)
        user = request.user if "user" in request.scope else None
        phoenix_user = user if isinstance(user, PhoenixUser) else None
        is_viewer = phoenix_user.is_viewer if phoenix_user is not None else False
        graphql_mutations_enabled = resolved_contexts.graphql_mutations_enabled
        recording = request.app.state.system_settings.agent_trace_recording
        ingest_traces, export_remote_traces = _resolve_trace_recording(
            record_local_traces=body.ingest_traces,
            export_remote_traces=body.export_remote_traces,
            allow_local_traces=recording.allow_local_traces,
            allow_remote_export=recording.allow_remote_export,
        )
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
            model = await build_model(
                body.model,
                db=request.app.state.db,
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
        # The legacy body is fed wholesale to the adapter as run_input, so it
        # deliberately carries no request credentials; only the workspace
        # secret or environment token applies here. Writes stay unavailable
        # unless edit permission is "bypass" (this route is always headless).
        github_mcp_config: GitHubMCPConfig | None = None
        if AgentsEnvConfig.from_env().allows_github(request.app.state.system_settings.agent_github):
            async with request.app.state.db.read() as session:
                github_mcp_config = await resolve_github_mcp_config(
                    session, request.app.state.decrypt, {}
                )
        agent = build_agent(
            name="PXIAgent",
            headless=True,
            model=model,
            schema=request.app.state.graphql_schema,
            build_graphql_context=lambda: request.app.state.build_graphql_context(phoenix_user),
            db=request.app.state.db,
            event_queue=request.state.event_queue,
            docs_mcp_server=request.app.state.docs_mcp_server,
            phoenix_mcp_server=request.app.state.pxi_mcp_server,
            github_mcp_config=github_mcp_config,
            principal=phoenix_user,
            enable_web_access=web_access_enabled,
            edit_permission=body.edit_permission,
            graphql_mutations_enabled=graphql_mutations_enabled,
            read_only=request.app.state.read_only,
            auth_enabled=request.app.state.authentication_enabled,
            tracer_provider=tracer_provider,
            enable_subagents=subagents_enabled,
        )
        adapter: VercelAIAdapter[AgentDependencies, AgentOutput] = VercelAIAdapter(
            agent=OpenInferenceAgentWrapper(agent, tracer=build_agent_tracer(tracer_provider)),
            run_input=body,
            accept=request.headers.get("accept"),
            sdk_version=7,
        )

        async def _on_complete(result: AgentRunResult[Any]) -> AsyncIterator[BaseChunk]:
            yield MessageMetadataChunk(
                message_metadata=_build_phoenix_assistant_message_metadata(
                    turn_trace_context=None,
                    session_id=session_id,
                    usage=_get_current_context_usage(result),
                )
            )
            _log_run_complete(result)

        async def _stream_with_session() -> AsyncIterator[BaseChunk]:
            try:
                with detached_otel_context(), using_session(session_id=session_id):
                    raw_stream = adapter.run_stream(
                        deps=AgentDependencies(
                            contexts=resolved_contexts,
                            edit_permission=body.edit_permission,
                            is_viewer=is_viewer,
                        ),
                        on_complete=_on_complete,
                    )
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
            except Exception as exc:
                logger.exception("Headless agent chat stream failed for session %s", session_id)
                yield ErrorChunk(error_text=str(exc).strip() or type(exc).__name__)
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
