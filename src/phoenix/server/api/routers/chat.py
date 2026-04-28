from typing import Annotated

from fastapi import APIRouter, Depends, Query
from starlette.requests import Request
from starlette.responses import Response

from phoenix.server.agents.chat_params import ChatSearchParamsModel
from phoenix.server.agents.context import (
    ToolExecutionEnv,
    build_phoenix_context_user_message_content,
    insert_context_user_message,
)
from phoenix.server.agents.mcp import get_mcp_client
from phoenix.server.agents.model_factory import build_chat_model
from phoenix.server.agents.tools import resolve_contextual_tools
from phoenix.server.api.routers.data_stream_protocol import parse_chat_body, stream_text
from phoenix.server.bearer_auth import is_authenticated


def create_chat_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], include_in_schema=False, dependencies=dependencies)

    @router.post("/chat")
    async def chat(
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
    ) -> Response:
        async with request.app.state.db() as session:
            model = await build_chat_model(
                params.root,
                session=session,
                decrypt=request.app.state.decrypt,
            )

        body = parse_chat_body(await request.body())
        body.messages = insert_context_user_message(
            body.messages,
            build_phoenix_context_user_message_content(body.resolved),
        )

        return await stream_text(
            request,
            model,
            body=body,
            mcp_client=get_mcp_client(request),
            contextual_tools=resolve_contextual_tools(
                body.resolved,
                ToolExecutionEnv(
                    user=request.scope.get("user") if hasattr(request, "scope") else None,
                    db=request.app.state.db,
                ),
            ),
        )

    return router
