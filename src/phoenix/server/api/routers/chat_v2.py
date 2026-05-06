import logging
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from openinference.instrumentation import using_session
from pydantic import BaseModel, Field, field_validator
from pydantic.types import Discriminator
from pydantic_ai import AgentRunResult
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    RegenerateMessage,
    SubmitMessage,
    UIMessage,
)
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk
from starlette.requests import Request
from starlette.responses import Response

from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_collector_api_key,
    get_env_phoenix_agents_collector_endpoint,
)
from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_params import ChatSearchParamsModel
from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.pxi_agent import ChatOutput, create_pxi_agent
from phoenix.server.agents.context import (
    ChatContext,
    resolve_contexts,
)
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.instrumentation import get_tracer_provider
from phoenix.server.agents.model_factory import build_chat_model
from phoenix.server.agents.summarization import SummarizationError, summarize_messages
from phoenix.server.bearer_auth import is_authenticated


class _ChatMessageMixin(BaseModel):
    """Phoenix-specific extensions added to Vercel AI request messages."""

    contexts: list[ChatContext] = Field(default_factory=list)
    capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities)
    session_id: str


class _SubmitMessage(_ChatMessageMixin, SubmitMessage):
    """Submit message extended with Phoenix-specific fields."""


class _RegenerateMessage(_ChatMessageMixin, RegenerateMessage):
    """Regenerate message extended with Phoenix-specific fields."""


_RequestData = Annotated[
    _SubmitMessage | _RegenerateMessage,
    Discriminator("trigger"),
]


class _SummarizeRequest(BaseModel):
    """Body for POST /summarize.

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
    """Log the full message history after a chat-v2 agent run completes."""
    messages = result.all_messages()
    logger.info("chat-v2 run complete: %d messages", len(messages))
    for message in messages:
        logger.info("%s", message)


def create_chat_v2_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], dependencies=dependencies)

    @router.post("/chat-v2")
    async def chat_v2(
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
        body: _RequestData,
    ) -> Response:
        try:
            async with request.app.state.db() as session:
                model = await build_chat_model(
                    params.root,
                    session=session,
                    decrypt=request.app.state.decrypt,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        logger.info(
            "chat-v2 model: %s.%s settings=%r",
            type(model).__module__,
            type(model).__qualname__,
            getattr(model, "settings", None),
        )

        tracer_provider = get_tracer_provider(
            collector_endpoint=get_env_phoenix_agents_collector_endpoint(),
            collector_api_key=get_env_phoenix_agents_collector_api_key(),
            project_name=get_env_phoenix_agents_assistant_project_name(),
        )
        agent = create_pxi_agent(model, tracer_provider=tracer_provider)
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

        async def _stream_with_session() -> AsyncIterator[BaseChunk]:
            with using_session(session_id=body.session_id):
                async for chunk in adapter.run_stream(deps=deps, on_complete=_log_run_complete):
                    yield chunk

        return adapter.streaming_response(_stream_with_session())

    @router.post("/summarize", response_model=_SummarizeResponse)
    async def summarize_endpoint(
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
        body: _SummarizeRequest,
    ) -> _SummarizeResponse:
        try:
            async with request.app.state.db() as session:
                model = await build_chat_model(
                    params.root,
                    session=session,
                    decrypt=request.app.state.decrypt,
                )
        except AgentError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

        history = VercelAIAdapter.load_messages(body.messages)
        try:
            result = await summarize_messages(messages=history, model=model)
        except SummarizationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return _SummarizeResponse(summary=result.summary.strip())

    return router
