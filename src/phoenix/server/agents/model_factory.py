"""Construct ``pydantic_ai`` model instances."""

from __future__ import annotations

from collections.abc import Mapping
from os import getenv
from typing import Any, Callable, Literal, Protocol, cast

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic import ValidationError
from pydantic_ai.models import Model as PydanticAIModel
from pydantic_ai.settings import ModelSettings
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import assert_never

from phoenix.db.types.model_provider import (
    GenerativeModelCustomerProviderConfig,
    ModelProvider,
)
from phoenix.server.agents.exceptions import (
    ProviderConfigError,
    ProviderCredentialsError,
    ProviderDependencyError,
    ProviderUnsupportedError,
)
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.agent_sessions import get_custom_provider
from phoenix.server.api.helpers.playground_clients import _resolve_secrets
from phoenix.server.types import DbSessionFactory
from phoenix.utilities.env_vars import without_env_vars


class _EncryptedProviderRecord(Protocol):
    config: bytes


# Output-token cap policy: a cap that binds mid-tool-call truncates the streamed
# argument JSON, and the turn dies (reproduced identically on Anthropic, OpenAI, and
# Google). Per provider:
#   - Anthropic: the API requires max_tokens and pydantic-ai defaults it to 4096, which
#     Opus-class models exhaust mid-tool-call (adaptive thinking counts against it) when
#     emitting bulk tool arguments, e.g. create_dataset examples. All Anthropic models
#     offered for the assistant support >=64k output, so set the cap well clear of
#     realistic single-response payloads.
#   - OpenAI and Google: max_tokens is deliberately left unset. pydantic-ai omits the
#     field, and both APIs then default to the model's maximum output — any explicit
#     value could only introduce truncation.
_ANTHROPIC_MAX_TOKENS = 32_000


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


def _first_credential(credentials: Mapping[str, str | None], *keys: str) -> str | None:
    """First non-empty credential value across ``keys``, in order."""
    for key in keys:
        if value := credentials.get(key):
            return value
    return None


def _builtin_provider_credential_env_vars(provider: ModelProvider) -> tuple[str, ...]:
    """Env-var names whose values are resolved (secrets first, then environment)
    before building a model for a built-in provider."""
    if provider is ModelProvider.OPENAI:
        return ("OPENAI_API_KEY",)
    if provider is ModelProvider.AZURE_OPENAI:
        return ("AZURE_OPENAI_API_KEY",)
    if provider is ModelProvider.ANTHROPIC:
        return ("ANTHROPIC_API_KEY",)
    if provider is ModelProvider.GOOGLE:
        return ("GEMINI_API_KEY", "GOOGLE_API_KEY")
    if provider is ModelProvider.AWS:
        return ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN")
    if provider is ModelProvider.DEEPSEEK:
        return ("DEEPSEEK_API_KEY",)
    if provider is ModelProvider.XAI:
        return ("XAI_API_KEY",)
    if provider is ModelProvider.OLLAMA:
        return ()
    if provider is ModelProvider.CEREBRAS:
        return ("CEREBRAS_API_KEY",)
    if provider is ModelProvider.FIREWORKS:
        return ("FIREWORKS_API_KEY",)
    if provider is ModelProvider.GROQ:
        return ("GROQ_API_KEY",)
    if provider is ModelProvider.MOONSHOT:
        return ("MOONSHOT_API_KEY",)
    if provider is ModelProvider.PERPLEXITY:
        return ("PERPLEXITY_API_KEY",)
    if provider is ModelProvider.TOGETHER:
        return ("TOGETHER_API_KEY",)
    if provider is ModelProvider.ZAI:
        return ("ZAI_API_KEY",)
    assert_never(provider)


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
    db: DbSessionFactory,
    decrypt: Callable[[bytes], bytes],
    tracer_provider: TracerProvider | None = None,
) -> OpenInferenceModelWrapper:
    """Build a ``pydantic_ai`` model."""
    if isinstance(model, CustomProviderModelSelection):
        async with db() as session:
            provider = await get_custom_provider(session, model.provider_id)
        pydantic_ai_model = await _get_pydantic_ai_model_from_generative_model_custom_provider(
            provider_record=provider,
            model_name=model.model_name,
            decrypt=decrypt,
        )
    elif isinstance(model, BuiltInProviderModelSelection):
        async with db() as session:
            credentials = await _resolve_secrets_or_env(
                session,
                decrypt,
                *_builtin_provider_credential_env_vars(model.provider),
            )
        pydantic_ai_model = _get_pydantic_ai_model_from_builtin_provider(
            model,
            credentials=credentials,
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
        return AnthropicModel(
            model_name,
            provider=anthropic_provider,
            settings=ModelSettings(max_tokens=_ANTHROPIC_MAX_TOKENS),
        )
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


def _get_pydantic_ai_model_from_builtin_provider(
    params: BuiltInProviderModelSelection,
    *,
    credentials: Mapping[str, str | None],
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
        api_key = _first_credential(credentials, "OPENAI_API_KEY")
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
            openai_api_type="responses",
        )
    if params.provider == ModelProvider.AZURE_OPENAI:
        api_key = _first_credential(credentials, "AZURE_OPENAI_API_KEY")
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
            openai_api_type="responses",
        )
    if params.provider == ModelProvider.ANTHROPIC:
        from anthropic import AsyncAnthropic

        api_key = _first_credential(credentials, "ANTHROPIC_API_KEY")
        if not api_key:
            raise ProviderCredentialsError(
                "An API key is required for Anthropic models. "
                "Set the ANTHROPIC_API_KEY environment variable or store it in Phoenix secrets."
            )
        anthropic_provider = AnthropicProvider(anthropic_client=AsyncAnthropic(api_key=api_key))
        return AnthropicModel(
            params.model_name,
            provider=anthropic_provider,
            settings=ModelSettings(max_tokens=_ANTHROPIC_MAX_TOKENS),
        )
    if params.provider == ModelProvider.GOOGLE:
        api_key = _first_credential(credentials, "GEMINI_API_KEY", "GOOGLE_API_KEY")
        if not api_key:
            raise ProviderCredentialsError(
                "An API key is required for Google GenAI models. "
                "Set GEMINI_API_KEY or GOOGLE_API_KEY in the environment or Phoenix secrets."
            )
        google_provider = GoogleProvider(api_key=api_key)
        return GoogleModel(params.model_name, provider=google_provider)
    if params.provider == ModelProvider.AWS:
        bedrock_provider = BedrockProvider(
            aws_access_key_id=credentials.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=credentials.get("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=credentials.get("AWS_SESSION_TOKEN"),
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
        ModelProvider.ZAI,
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
            ModelProvider.ZAI: (
                "ZAI_API_KEY",
                getenv("ZAI_BASE_URL") or "https://api.z.ai/api/paas/v4",
                "https://api.z.ai/api/paas/v4",
                "An API key is required for Z.ai models. "
                "Set ZAI_API_KEY in the environment or Phoenix secrets.",
            ),
        }
        credential_key, base_url, default_base_url, missing_credential_message = provider_settings[
            params.provider
        ]
        api_key = (
            _first_credential(credentials, credential_key) if credential_key is not None else None
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
