import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pydantic.types import Discriminator
from pydantic_ai import Agent, AgentRunResult, DeferredToolRequests, RunContext
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai.request_types import (
    RegenerateMessage,
    SubmitMessage,
)
from starlette.requests import Request
from starlette.responses import Response

from phoenix.server.agents.capabilities import AgentCapabilities
from phoenix.server.agents.chat_params import ChatSearchParamsModel
from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.toolsets import CHAT_V2_TOOLSETS
from phoenix.server.agents.context import (
    ChatContext,
    resolve_contexts,
)
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_chat_model
from phoenix.server.agents.prompts import (
    AGENT_STATIC_SYSTEM_PROMPT,
    build_agent_dynamic_system_prompt,
)
from phoenix.server.bearer_auth import is_authenticated

ChatOutput = str | DeferredToolRequests


class _ChatMessageMixin(BaseModel):
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


logger = logging.getLogger(__name__)


def _build_dynamic_instructions(ctx: RunContext[ChatDependencies]) -> str | None:
    """Render request-specific PXI instructions from the run's dependencies."""
    return build_agent_dynamic_system_prompt(capabilities=ctx.deps.capabilities)


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

        agent: Agent[ChatDependencies, ChatOutput] = Agent(
            model,
            deps_type=ChatDependencies,
            output_type=[str, DeferredToolRequests],
            instructions=[AGENT_STATIC_SYSTEM_PROMPT, _build_dynamic_instructions],
            toolsets=CHAT_V2_TOOLSETS,
        )
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
        )
        return adapter.streaming_response(
            adapter.run_stream(deps=deps, on_complete=_log_run_complete)
        )

    return router
