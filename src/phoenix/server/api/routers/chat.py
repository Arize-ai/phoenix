from typing import TYPE_CHECKING, Annotated, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, RootModel
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.model_provider import (
    GenerativeModelCustomerProviderConfig,
    ModelProvider,
)
from phoenix.server.bearer_auth import is_authenticated

if TYPE_CHECKING:
    from pydantic_ai.models import Model as PydanticAIModel

    from phoenix.server.api.routers.mcp_tools import MintlifyDocsClient


class CustomProviderChatSearchParams(BaseModel):
    provider_type: Literal["custom"]
    provider_id: str
    model_name: str


class BuiltInProviderChatSearchParams(BaseModel):
    provider_type: Literal["builtin"]
    provider: ModelProvider
    model_name: str
    base_url: str | None = None
    endpoint: str | None = None
    region: str | None = None
    custom_headers: dict[str, str] | None = None
    openai_api_type: Literal["chat_completions", "responses"] = "responses"


ChatSearchParams = Annotated[
    CustomProviderChatSearchParams | BuiltInProviderChatSearchParams,
    Field(..., discriminator="provider_type"),
]


class ChatSearchParamsModel(RootModel[ChatSearchParams]):
    root: ChatSearchParams


async def _get_pydantic_ai_model_from_generative_model_custom_provider(
    provider: models.GenerativeModelCustomProvider,
    model_name: str,
    decrypt: Callable[[bytes], bytes],
) -> "PydanticAIModel":
    from pydantic_ai.models.anthropic import AnthropicModel
    from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
    from pydantic_ai.providers.anthropic import AnthropicProvider
    from pydantic_ai.providers.openai import OpenAIProvider

    decrypted_data = decrypt(provider.config)
    config = GenerativeModelCustomerProviderConfig.model_validate_json(decrypted_data).root

    if config.type == "openai":
        openai_client_factory = config.get_client_factory()()
        async with openai_client_factory as openai_client:
            openai_provider = OpenAIProvider(openai_client=openai_client)
        if config.openai_api_type == "responses":
            return OpenAIResponsesModel(model_name, provider=openai_provider)
        if config.openai_api_type == "chat_completions":
            return OpenAIChatModel(model_name, provider=openai_provider)
        assert_never(config.openai_api_type)
    elif config.type == "anthropic":
        anthropic_client_factory = config.get_client_factory()()
        async with anthropic_client_factory as anthropic_client:
            anthropic_provider = AnthropicProvider(anthropic_client=anthropic_client)
        return AnthropicModel(model_name, provider=anthropic_provider)
    raise NotImplementedError(f"Unsupported config type: {config.type}")


def _get_pydantic_ai_model_from_builtin_provider(
    params: BuiltInProviderChatSearchParams,
) -> "PydanticAIModel":
    from anthropic import AsyncAnthropic
    from openai import AsyncOpenAI
    from pydantic_ai.models.anthropic import AnthropicModel
    from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
    from pydantic_ai.providers.anthropic import AnthropicProvider
    from pydantic_ai.providers.openai import OpenAIProvider

    if params.provider == ModelProvider.OPENAI:
        openai_client = AsyncOpenAI(
            base_url=params.base_url,
            default_headers=params.custom_headers,
        )
        openai_provider = OpenAIProvider(openai_client=openai_client)
        if params.openai_api_type == "responses":
            return OpenAIResponsesModel(params.model_name, provider=openai_provider)
        elif params.openai_api_type == "chat_completions":
            return OpenAIChatModel(params.model_name, provider=openai_provider)
        else:
            assert_never(params.openai_api_type)
    if params.provider == ModelProvider.ANTHROPIC:
        anthropic_client = AsyncAnthropic(
            base_url=params.base_url,
            default_headers=params.custom_headers,
        )
        anthropic_provider = AnthropicProvider(anthropic_client=anthropic_client)
        return AnthropicModel(params.model_name, provider=anthropic_provider)
    raise NotImplementedError(f"Unsupported built-in provider: {params.provider}")


def create_chat_router(authentication_enabled: bool) -> APIRouter:
    dependencies = [Depends(is_authenticated)] if authentication_enabled else []
    router = APIRouter(tags=["chat"], include_in_schema=False, dependencies=dependencies)

    @router.post("/chat")
    async def chat(
        request: Request,
        params: Annotated[ChatSearchParamsModel, Query()],
    ) -> Response:
        from phoenix.server.api.routers.data_stream_protocol import (
            parse_chat_body,
            stream_text,
        )

        params_ = params.root
        model: "PydanticAIModel"
        if isinstance(params_, CustomProviderChatSearchParams):
            custom_provider_id = int(GlobalID.from_id(params_.provider_id).node_id)
            async with request.app.state.db() as session:
                provider = await session.get(
                    models.GenerativeModelCustomProvider,
                    custom_provider_id,
                )
            if provider is None:
                raise HTTPException(status_code=404, detail="Custom provider not found.")
            model = await _get_pydantic_ai_model_from_generative_model_custom_provider(
                provider=provider,
                model_name=params_.model_name,
                decrypt=request.app.state.decrypt,
            )
        elif isinstance(params_, BuiltInProviderChatSearchParams):
            model = _get_pydantic_ai_model_from_builtin_provider(params_)
        else:
            assert_never(params_)

        # Get the MCP client from app state (lazily initialised).
        mcp_client = _get_mcp_client(request)

        body = parse_chat_body(await request.body())
        return await stream_text(
            request,
            model,
            body=body,
            mcp_client=mcp_client,
        )

    return router


def _get_mcp_client(request: Request) -> "MintlifyDocsClient | None":
    """Return the shared MCP client from app state, creating it on first use.

    Returns ``None`` when external networking is disabled
    (``PHOENIX_ALLOW_EXTERNAL_RESOURCES=false``) or if the client fails to
    initialise, so the chat endpoint degrades gracefully (backend tools
    simply won't be available).
    """
    from phoenix.config import get_env_allow_external_resources
    from phoenix.server.api.routers.mcp_tools import MintlifyDocsClient

    state = request.app.state
    if not hasattr(state, "_mcp_client"):
        if not get_env_allow_external_resources():
            state._mcp_client = None
        else:
            try:
                client = MintlifyDocsClient()
                state._mcp_client = client

                # Register cleanup so the HTTP transport and MCP session are
                # closed on server shutdown rather than abandoned.
                async def _close_mcp_client() -> None:
                    try:
                        await client.close()
                    except Exception:
                        pass

                request.app.router.on_shutdown.append(_close_mcp_client)
            except Exception:
                import logging

                logging.getLogger(__name__).exception("Failed to create MCP client")
                state._mcp_client = None
    result: MintlifyDocsClient | None = state._mcp_client
    return result
