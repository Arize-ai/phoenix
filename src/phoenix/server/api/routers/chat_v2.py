from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic_ai import Agent
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from starlette.requests import Request
from starlette.responses import Response

from phoenix.server.agents.chat_params import ChatSearchParamsModel
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_chat_model
from phoenix.server.bearer_auth import is_authenticated


def create_chat_v2_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], include_in_schema=False, dependencies=dependencies)

    @router.post("/chat-v2")
    async def chat_v2(
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
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

        agent = Agent(model)
        return await VercelAIAdapter.dispatch_request(request, agent=agent)

    return router
