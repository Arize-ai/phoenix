"""Construct ``pydantic_ai`` model instances for the chat endpoint.

``build_model`` dispatches on ``AgentModelSelection`` to either a stored
custom-provider record (Anthropic, Azure OpenAI, AWS Bedrock, Google
GenAI, OpenAI-compatible) or to a built-in provider whose credentials
are resolved from the secret store first and the environment second.

This module is **transport-neutral**: it does not import ``fastapi`` or
raise ``HTTPException``. Failures surface as ``AgentError`` subclasses
(see ``phoenix.server.agents.exceptions``) and the REST router maps them
to HTTP responses at the boundary. The only remaining infrastructure
dependency is ``AsyncSession`` for secret-store and provider-record
lookups; the planned next step is to swap that for a small resolver
protocol so this module is fully composable.
"""

from __future__ import annotations

from os import getenv
from typing import Any, Callable, Literal, Protocol, cast

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic import ValidationError
from pydantic_ai.models import Model as PydanticAIModel
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.model_provider import (
    GenerativeModelCustomerProviderConfig,
    ModelProvider,
)
from phoenix.server.agents.exceptions import (
    ProviderConfigError,
    ProviderCredentialsError,
    ProviderDependencyError,
    ProviderNotFoundError,
    ProviderUnsupportedError,
)
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.playground_clients import _resolve_secrets
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.utilities.env_vars import without_env_vars


class _EncryptedProviderRecord(Protocol):
    config: bytes


def _build_openai_model(
    *,
    model_name: str,
    provider: Any,
    openai_api_type: Literal["chat_completions", "responses"],
) -> "PydanticAIModel":
    from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel

    if openai_api_type == "responses":
        return cast("PydanticAIModel", OpenAIResponsesModel(model_name, provider=provider))
    if openai_api_type == "chat_completions":
        return cast("PydanticAIModel", OpenAIChatModel(model_name, provider=provider))
    # ``assert_never`` raises at runtime; the explicit ``raise`` below is
    # unreachable but required to satisfy CodeQL's flow analysis, which
    # does not recognise ``Never``-returning calls. Keep both.
    assert_never(openai_api_type)
    raise ValueError(f"Unsupported OpenAI API type: {openai_api_type}")


def azure_endpoint_to_base_url(azure_endpoint: str) -> str:
    endpoint = azure_endpoint.rstrip("/")
    return (endpoint if endpoint.endswith("/openai/v1") else f"{endpoint}/openai/v1") + "/"


_AZURE_IDENTITY_MISSING_MESSAGE = "Azure identity package not installed."


async def _resolve_secrets_or_env(
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    *keys: str,
) -> dict[str, str | None]:
    """Resolve credentials for ``keys`` in a single DB query.

    For each key, the secret store is consulted first and the process
    environment second; absent keys map to ``None``. A failure to decrypt
    a stored secret surfaces as ``ProviderConfigError`` so callers don't
    need to know about the GraphQL-flavoured exception that
    ``_resolve_secrets`` raises.
    """
    if not keys:
        return {}
    try:
        secrets = await _resolve_secrets(session, decrypt, *keys)
    except BadRequest as exc:
        raise ProviderConfigError(str(exc)) from exc
    return {key: secrets.get(key) or getenv(key) for key in keys}


async def _resolve_secret_or_env(
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    *keys: str,
) -> str | None:
    """First non-empty credential value across ``keys``, in order, with
    secret-store values winning over the environment for any given key.
    """
    resolved = await _resolve_secrets_or_env(session, decrypt, *keys)
    for key in keys:
        if value := resolved.get(key):
            return value
    return None


def _placeholder_or_error_for_openai_compatible_provider(
    *,
    api_key: str | None,
    base_url: str | None,
    default_base_url: str | None,
    missing_credential_message: str,
) -> str:
    if api_key:
        return api_key
    if base_url and base_url != default_base_url:
        return "sk-placeholder"
    raise ProviderCredentialsError(missing_credential_message)


async def build_model(
    model: AgentModelSelection,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceModelWrapper:
    """Build a ``pydantic_ai`` model for a chat request.

    Args:
        model: Discriminated schema selecting either a stored custom
            provider or a built-in provider.
        session: Open async session used for secret-store and provider
            lookups.
        decrypt: Callable that decrypts secret/provider config payloads.
        tracer_provider: Optional provider for OpenInference spans.

    Returns:
        A ready-to-use ``pydantic_ai.models.Model`` instance.

    Raises:
        ProviderNotFoundError: A custom provider record is missing.
        ProviderConfigError: A custom provider's config cannot be
            decrypted or parsed, or a stored secret cannot be decrypted.
        ProviderCredentialsError: A built-in provider's required
            credentials are not available.
        ProviderDependencyError: An optional SDK package required by the
            selected provider is not installed.
        ProviderUnsupportedError: The requested provider type is not
            recognised by this builder.
    """
    if isinstance(model, CustomProviderModelSelection):
        provider_id = from_global_id_with_expected_type(
            GlobalID.from_id(model.provider_id),
            "GenerativeModelCustomProvider",
        )
        provider = await session.get(
            models.GenerativeModelCustomProvider,
            provider_id,
        )
        if provider is None:
            raise ProviderNotFoundError("Custom provider not found.")
        pydantic_ai_model = await _get_pydantic_ai_model_from_generative_model_custom_provider(
            provider_record=provider,
            model_name=model.model_name,
            decrypt=decrypt,
        )
    elif isinstance(model, BuiltInProviderModelSelection):
        pydantic_ai_model = await _get_pydantic_ai_model_from_builtin_provider(
            model,
            session=session,
            decrypt=decrypt,
        )
    else:
        # See ``_build_openai_model`` for why ``assert_never`` and ``raise``
        # both appear.
        assert_never(model)
        raise ValueError(f"Unsupported model selection type: {type(model).__name__}")
    resolved_tracer_provider = tracer_provider or NoOpTracerProvider()
    tracer = OITracer(
        resolved_tracer_provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    return OpenInferenceModelWrapper(pydantic_ai_model, tracer=tracer)


async def _get_pydantic_ai_model_from_generative_model_custom_provider(
    provider_record: _EncryptedProviderRecord,
    model_name: str,
    decrypt: Callable[[bytes], bytes],
) -> "PydanticAIModel":
    import httpx
    from anthropic import AsyncAnthropic
    from openai import AsyncOpenAI
    from pydantic_ai.models.anthropic import AnthropicModel
    from pydantic_ai.models.bedrock import BedrockConverseModel
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.anthropic import AnthropicProvider
    from pydantic_ai.providers.bedrock import BedrockProvider
    from pydantic_ai.providers.google import GoogleProvider
    from pydantic_ai.providers.openai import OpenAIProvider

    try:
        decrypted_data = decrypt(provider_record.config)
    except Exception as exc:
        raise ProviderConfigError("Failed to decrypt custom provider config.") from exc

    try:
        config = GenerativeModelCustomerProviderConfig.model_validate_json(decrypted_data).root
    except ValidationError as exc:
        raise ProviderConfigError("Failed to parse custom provider config.") from exc

    if config.type == "openai":
        openai_kwargs = config.openai_client_kwargs
        headers = openai_kwargs.default_headers if openai_kwargs else None
        with without_env_vars("OPENAI_*"):
            openai_provider = OpenAIProvider(
                openai_client=AsyncOpenAI(
                    api_key=config.openai_authentication_method.api_key,
                    base_url=openai_kwargs.base_url if openai_kwargs else None,
                    organization=openai_kwargs.organization if openai_kwargs else None,
                    project=openai_kwargs.project if openai_kwargs else None,
                    default_headers=headers,
                    max_retries=0,
                )
            )
        return _build_openai_model(
            model_name=model_name,
            provider=openai_provider,
            openai_api_type=config.openai_api_type,
        )
    if config.type == "azure_openai":
        azure_kwargs = config.azure_openai_client_kwargs
        headers = azure_kwargs.default_headers
        base_url = azure_endpoint_to_base_url(azure_kwargs.azure_endpoint)
        azure_method = config.azure_openai_authentication_method

        if azure_method.type == "api_key":
            with without_env_vars("AZURE_*", "OPENAI_*"):
                openai_provider = OpenAIProvider(
                    openai_client=AsyncOpenAI(
                        api_key=azure_method.api_key,
                        base_url=base_url,
                        default_headers=headers,
                        max_retries=0,
                    )
                )
        elif azure_method.type == "azure_ad_token_provider":
            try:
                from azure.identity.aio import ClientSecretCredential, get_bearer_token_provider
            except ImportError as exc:
                raise ProviderDependencyError(_AZURE_IDENTITY_MISSING_MESSAGE) from exc
            credential = ClientSecretCredential(
                tenant_id=azure_method.azure_tenant_id,
                client_id=azure_method.azure_client_id,
                client_secret=azure_method.azure_client_secret,
            )
            token_provider = get_bearer_token_provider(credential, azure_method.scope)
            openai_provider = OpenAIProvider(
                openai_client=AsyncOpenAI(
                    api_key=token_provider,
                    base_url=base_url,
                    default_headers=headers,
                    max_retries=0,
                )
            )
        elif azure_method.type == "default_credentials":
            try:
                from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
            except ImportError as exc:
                raise ProviderDependencyError(_AZURE_IDENTITY_MISSING_MESSAGE) from exc
            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )
            openai_provider = OpenAIProvider(
                openai_client=AsyncOpenAI(
                    api_key=token_provider,
                    base_url=base_url,
                    default_headers=headers,
                    max_retries=0,
                )
            )
        else:
            assert_never(azure_method.type)

        return _build_openai_model(
            model_name=model_name,
            provider=openai_provider,
            openai_api_type=config.openai_api_type,
        )
    if config.type == "anthropic":
        anthropic_kwargs = config.anthropic_client_kwargs
        headers = anthropic_kwargs.default_headers if anthropic_kwargs else None
        with without_env_vars("ANTHROPIC_*"):
            anthropic_provider = AnthropicProvider(
                anthropic_client=AsyncAnthropic(
                    api_key=config.anthropic_authentication_method.api_key,
                    base_url=anthropic_kwargs.base_url if anthropic_kwargs else None,
                    default_headers=headers,
                    max_retries=0,
                )
            )
        return AnthropicModel(model_name, provider=anthropic_provider)
    if config.type == "google_genai":
        google_kwargs = config.google_genai_client_kwargs
        http_options = google_kwargs.http_options if google_kwargs else None
        # TODO(mikeldking): preserve get_client_factory timeout semantics when
        # custom Google provider headers are configured.
        google_provider = GoogleProvider(
            api_key=config.google_genai_authentication_method.api_key,
            base_url=http_options.base_url if http_options else None,
            http_client=(
                httpx.AsyncClient(headers=http_options.headers)
                if http_options and http_options.headers
                else None
            ),
        )
        return GoogleModel(model_name, provider=google_provider)
    if config.type == "aws_bedrock":
        bedrock_kwargs = config.aws_bedrock_client_kwargs
        bedrock_method = config.aws_bedrock_authentication_method
        if bedrock_method.type == "access_keys":
            bedrock_provider = BedrockProvider(
                aws_access_key_id=bedrock_method.aws_access_key_id,
                aws_secret_access_key=bedrock_method.aws_secret_access_key,
                aws_session_token=bedrock_method.aws_session_token,
                region_name=bedrock_kwargs.region_name,
                base_url=bedrock_kwargs.endpoint_url,
            )
        elif bedrock_method.type == "default_credentials":
            bedrock_provider = BedrockProvider(
                region_name=bedrock_kwargs.region_name,
                base_url=bedrock_kwargs.endpoint_url,
            )
        else:
            assert_never(bedrock_method.type)
        return BedrockConverseModel(model_name, provider=bedrock_provider)
    raise ProviderUnsupportedError(f"Unsupported custom provider type: {config.type}")


async def _get_pydantic_ai_model_from_builtin_provider(
    params: BuiltInProviderModelSelection,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
) -> "PydanticAIModel":
    from openai import AsyncOpenAI
    from pydantic_ai.models.anthropic import AnthropicModel
    from pydantic_ai.models.bedrock import BedrockConverseModel
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.anthropic import AnthropicProvider
    from pydantic_ai.providers.bedrock import BedrockProvider
    from pydantic_ai.providers.google import GoogleProvider
    from pydantic_ai.providers.openai import OpenAIProvider

    if params.provider == ModelProvider.OPENAI:
        api_key = await _resolve_secret_or_env(session, decrypt, "OPENAI_API_KEY")
        base_url = getenv("OPENAI_BASE_URL")
        api_key = _placeholder_or_error_for_openai_compatible_provider(
            api_key=api_key,
            base_url=base_url,
            default_base_url=None,
            missing_credential_message=(
                "An API key is required for OpenAI models. "
                "Set the OPENAI_API_KEY environment variable or store it in Phoenix secrets."
            ),
        )
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(api_key=api_key, base_url=base_url)
        )
        return _build_openai_model(
            model_name=params.model_name,
            provider=openai_provider,
            openai_api_type=params.openai_api_type,
        )
    if params.provider == ModelProvider.AZURE_OPENAI:
        api_key = await _resolve_secret_or_env(session, decrypt, "AZURE_OPENAI_API_KEY")
        azure_endpoint = getenv("AZURE_OPENAI_ENDPOINT")
        if not azure_endpoint:
            raise ProviderCredentialsError(
                "An Azure endpoint is required for Azure OpenAI models. "
                "Set the AZURE_OPENAI_ENDPOINT environment variable."
            )
        base_url = azure_endpoint_to_base_url(azure_endpoint)
        if api_key:
            openai_provider = OpenAIProvider(
                openai_client=AsyncOpenAI(api_key=api_key, base_url=base_url)
            )
        else:
            try:
                from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
            except ImportError as exc:
                raise ProviderDependencyError(
                    "Provide an Azure OpenAI API key or install azure-identity "
                    "to use default credentials."
                ) from exc
            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )
            openai_provider = OpenAIProvider(
                openai_client=AsyncOpenAI(api_key=token_provider, base_url=base_url)
            )
        return _build_openai_model(
            model_name=params.model_name,
            provider=openai_provider,
            openai_api_type=params.openai_api_type,
        )
    if params.provider == ModelProvider.ANTHROPIC:
        from anthropic import AsyncAnthropic

        api_key = await _resolve_secret_or_env(session, decrypt, "ANTHROPIC_API_KEY")
        if not api_key:
            raise ProviderCredentialsError(
                "An API key is required for Anthropic models. "
                "Set the ANTHROPIC_API_KEY environment variable or store it in Phoenix secrets."
            )
        anthropic_provider = AnthropicProvider(anthropic_client=AsyncAnthropic(api_key=api_key))
        return AnthropicModel(params.model_name, provider=anthropic_provider)
    if params.provider == ModelProvider.GOOGLE:
        api_key = await _resolve_secret_or_env(session, decrypt, "GEMINI_API_KEY", "GOOGLE_API_KEY")
        if not api_key:
            raise ProviderCredentialsError(
                "An API key is required for Google GenAI models. "
                "Set GEMINI_API_KEY or GOOGLE_API_KEY in the environment or Phoenix secrets."
            )
        google_provider = GoogleProvider(api_key=api_key)
        return GoogleModel(params.model_name, provider=google_provider)
    if params.provider == ModelProvider.AWS:
        aws_creds = await _resolve_secrets_or_env(
            session,
            decrypt,
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_SESSION_TOKEN",
        )
        bedrock_provider = BedrockProvider(
            aws_access_key_id=aws_creds["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=aws_creds["AWS_SECRET_ACCESS_KEY"],
            aws_session_token=aws_creds["AWS_SESSION_TOKEN"],
            region_name=getenv("AWS_REGION") or "us-east-1",
        )
        return BedrockConverseModel(params.model_name, provider=bedrock_provider)
    if params.provider in {
        ModelProvider.DEEPSEEK,
        ModelProvider.XAI,
        ModelProvider.OLLAMA,
        ModelProvider.CEREBRAS,
        ModelProvider.FIREWORKS,
        ModelProvider.GROQ,
        ModelProvider.MOONSHOT,
        ModelProvider.PERPLEXITY,
        ModelProvider.TOGETHER,
    }:
        provider_settings: dict[
            ModelProvider,
            tuple[str | None, str | None, str | None, str],
        ] = {
            ModelProvider.DEEPSEEK: (
                "DEEPSEEK_API_KEY",
                getenv("DEEPSEEK_BASE_URL") or "https://api.deepseek.com",
                "https://api.deepseek.com",
                "An API key is required for DeepSeek models. "
                "Set DEEPSEEK_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.XAI: (
                "XAI_API_KEY",
                getenv("XAI_BASE_URL") or "https://api.x.ai/v1",
                "https://api.x.ai/v1",
                "An API key is required for xAI models. "
                "Set XAI_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.OLLAMA: (
                None,
                getenv("OLLAMA_BASE_URL"),
                None,
                "A base URL is required for Ollama models. Set OLLAMA_BASE_URL (for example http://localhost:11434/v1).",
            ),
            ModelProvider.CEREBRAS: (
                "CEREBRAS_API_KEY",
                getenv("CEREBRAS_BASE_URL") or "https://api.cerebras.ai/v1",
                "https://api.cerebras.ai/v1",
                "An API key is required for Cerebras models. "
                "Set CEREBRAS_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.FIREWORKS: (
                "FIREWORKS_API_KEY",
                getenv("FIREWORKS_BASE_URL") or "https://api.fireworks.ai/inference/v1",
                "https://api.fireworks.ai/inference/v1",
                "An API key is required for Fireworks models. "
                "Set FIREWORKS_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.GROQ: (
                "GROQ_API_KEY",
                getenv("GROQ_BASE_URL") or "https://api.groq.com/openai/v1",
                "https://api.groq.com/openai/v1",
                "An API key is required for Groq models. "
                "Set GROQ_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.MOONSHOT: (
                "MOONSHOT_API_KEY",
                getenv("MOONSHOT_BASE_URL") or "https://api.moonshot.ai/v1",
                "https://api.moonshot.ai/v1",
                "An API key is required for Moonshot models. "
                "Set MOONSHOT_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.PERPLEXITY: (
                "PERPLEXITY_API_KEY",
                getenv("PERPLEXITY_BASE_URL") or "https://api.perplexity.ai",
                "https://api.perplexity.ai",
                "An API key is required for Perplexity models. "
                "Set PERPLEXITY_API_KEY in the environment or Phoenix secrets.",
            ),
            ModelProvider.TOGETHER: (
                "TOGETHER_API_KEY",
                getenv("TOGETHER_BASE_URL") or "https://api.together.xyz/v1",
                "https://api.together.xyz/v1",
                "An API key is required for Together AI models. "
                "Set TOGETHER_API_KEY in the environment or Phoenix secrets.",
            ),
        }
        credential_key, base_url, default_base_url, missing_credential_message = provider_settings[
            params.provider
        ]
        api_key = (
            await _resolve_secret_or_env(session, decrypt, credential_key)
            if credential_key is not None
            else None
        )
        if params.provider == ModelProvider.OLLAMA:
            if not base_url:
                raise ProviderCredentialsError(missing_credential_message)
            api_key = "ollama"
        else:
            api_key = _placeholder_or_error_for_openai_compatible_provider(
                api_key=api_key,
                base_url=base_url,
                default_base_url=default_base_url,
                missing_credential_message=missing_credential_message,
            )
        openai_provider = OpenAIProvider(
            openai_client=AsyncOpenAI(api_key=api_key, base_url=base_url)
        )
        return _build_openai_model(
            model_name=params.model_name,
            provider=openai_provider,
            openai_api_type="chat_completions",
        )
    raise ProviderUnsupportedError(f"Unsupported built-in provider: {params.provider.value}")
