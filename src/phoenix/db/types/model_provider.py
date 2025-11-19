from enum import Enum
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    Awaitable,
    Callable,
    Literal,
    Mapping,
    Union,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    RootModel,
    model_validator,
)
from typing_extensions import Self, assert_never

from phoenix.duck_types import CanGetString

if TYPE_CHECKING:
    from anthropic import AsyncAnthropic
    from google import genai
    from openai import AsyncAzureOpenAI, AsyncOpenAI


class ModelProvider(Enum):
    OPENAI = "OPENAI"
    AZURE_OPENAI = "AZURE_OPENAI"
    ANTHROPIC = "ANTHROPIC"
    GOOGLE = "GOOGLE"
    DEEPSEEK = "DEEPSEEK"
    XAI = "XAI"
    OLLAMA = "OLLAMA"
    AWS = "AWS"


class StringValueLookup(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    type: Literal["string_value_lookup"] = "string_value_lookup"
    string_value_lookup_key: str = Field(
        description="The key to lookup the value in the environment variables",
    )


class StringValue(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    type: Literal["string_value"] = "string_value"
    string_value: str = Field(description="The value to use directly")


StringValueLookupOrStringValue = Annotated[
    Union[StringValueLookup, StringValue],
    Field(discriminator="type"),
]


def _resolve_value(value: StringValueLookupOrStringValue | None, store: CanGetString) -> str | None:
    """Resolve a value that might be a string, StringValueLookup, StringValue, or None.

    Args:
        value: The value to resolve - can be a direct string value, a lookup key, or None
        store: The store to use for looking up values (e.g., environment variables, secrets)

    Returns:
        The resolved string value, or None if value was None

    Raises:
        TypeError: If value is not one of the expected types
    """
    if value is None:
        return None
    if isinstance(value, StringValue):
        return value.string_value
    if isinstance(value, StringValueLookup):
        return store.get(value.string_value_lookup_key)
    assert_never(value)


class OpenAIAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_key: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="OpenAI API key",
    )


class OpenAIClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    base_url: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Base URL for the API",
    )
    organization: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Organization ID",
    )
    project: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Project ID",
    )
    default_headers: Mapping[str, str] | None = Field(
        default=None,
        description="HTTP headers",
    )


class OpenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["openai"] = "openai"
    supports_streaming: bool = True
    openai_authentication_method: OpenAIAuthenticationMethod = Field(
        description="OpenAI authentication method"
    )
    openai_client_interface: Literal["chat"] = "chat"
    openai_client_kwargs: OpenAIClientKwargs | None = Field(
        default=None, description="OpenAI client kwargs"
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["AsyncOpenAI"]]:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        method = self.openai_authentication_method
        api_key = _resolve_value(method.api_key, store)

        kwargs = self.openai_client_kwargs
        base_url = _resolve_value(kwargs.base_url if kwargs else None, store)
        organization = _resolve_value(kwargs.organization if kwargs else None, store)
        project = _resolve_value(kwargs.project if kwargs else None, store)
        default_headers = kwargs.default_headers if kwargs else None

        async def _() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                organization=organization,
                project=project,
                default_headers=default_headers,
            )

        return _


class AzureADTokenProvider(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    azure_tenant_id: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure tenant ID",
    )
    azure_client_id: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure client ID",
    )
    azure_client_secret: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure client secret",
    )
    scope: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure scope",
    )


class AzureOpenAIAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_key: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure API key",
    )
    azure_ad_token: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure AD authentication token",
    )
    azure_ad_token_provider: AzureADTokenProvider | None = Field(
        default=None,
        description="Azure AD token provider",
    )

    @model_validator(mode="after")
    def validate_authentication_method(self) -> Self:
        if sum(map(bool, [self.api_key, self.azure_ad_token, self.azure_ad_token_provider])) != 1:
            raise ValueError("Exactly one authentication method must be provided")
        return self


class AzureOpenAIClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_version: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure OpenAI API version",
    )
    azure_endpoint: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Azure endpoint URL",
    )
    azure_deployment: StringValueLookupOrStringValue | None = Field(
        default=None, description="Azure deployment name"
    )
    default_headers: Mapping[str, str] | None = Field(
        default=None,
        description="HTTP headers",
    )


class AzureOpenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["azure_openai"] = "azure_openai"
    supports_streaming: bool = True
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethod = Field(
        description="Azure OpenAI authentication method"
    )
    azure_openai_client_interface: Literal["chat"] = "chat"
    azure_openai_client_kwargs: AzureOpenAIClientKwargs | None = Field(
        default=None,
        description="Azure OpenAI client kwargs",
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["AsyncAzureOpenAI"]]:
        try:
            from openai import AsyncAzureOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        method = self.azure_openai_authentication_method
        kwargs = self.azure_openai_client_kwargs

        # Extract common client kwargs
        azure_endpoint = _resolve_value(kwargs.azure_endpoint if kwargs else None, store)
        if not azure_endpoint:
            raise ValueError("Azure endpoint is required")
        azure_deployment = _resolve_value(kwargs.azure_deployment if kwargs else None, store)
        if not azure_deployment:
            raise ValueError("Azure deployment is required")
        api_version = _resolve_value(kwargs.api_version if kwargs else None, store)
        if not api_version:
            raise ValueError("API version is required")
        default_headers = kwargs.default_headers if kwargs else None

        async def _() -> AsyncAzureOpenAI:
            if method.api_key:
                return AsyncAzureOpenAI(
                    api_key=_resolve_value(method.api_key, store),
                    azure_endpoint=azure_endpoint,
                    azure_deployment=azure_deployment,
                    api_version=api_version,
                    default_headers=default_headers,
                )

            if method.azure_ad_token:
                return AsyncAzureOpenAI(
                    azure_ad_token=_resolve_value(method.azure_ad_token, store),
                    azure_endpoint=azure_endpoint,
                    azure_deployment=azure_deployment,
                    api_version=api_version,
                    default_headers=default_headers,
                )

            if method.azure_ad_token_provider:
                try:
                    from azure.identity import ClientSecretCredential
                except ImportError:
                    raise ImportError(
                        "Azure identity package not installed. Run: pip install azure-identity"
                    )

                provider = method.azure_ad_token_provider
                tenant_id = _resolve_value(provider.azure_tenant_id, store)
                if not tenant_id:
                    raise ValueError("Azure tenant ID is required")
                client_id = _resolve_value(provider.azure_client_id, store)
                if not client_id:
                    raise ValueError("Azure client ID is required")
                client_secret = _resolve_value(provider.azure_client_secret, store)
                if not client_secret:
                    raise ValueError("Azure client secret is required")
                scope = (
                    _resolve_value(provider.scope, store)
                    or "https://cognitiveservices.azure.com/.default"
                )

                if not all([tenant_id, client_id, client_secret]):
                    raise ValueError(
                        "Azure AD token provider requires tenant_id, client_id, and client_secret"
                    )

                cred = ClientSecretCredential(
                    tenant_id=tenant_id,
                    client_id=client_id,
                    client_secret=client_secret,
                )

                def azure_ad_token_provider() -> str:
                    token = cred.get_token(scope)
                    return token.token

                return AsyncAzureOpenAI(
                    azure_ad_token_provider=azure_ad_token_provider,
                    azure_endpoint=azure_endpoint,
                    azure_deployment=azure_deployment,
                    api_version=api_version,
                    default_headers=default_headers,
                )
            raise ValueError("No authentication method provided")

        return _


class AnthropicAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_key: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Anthropic API key",
    )


class AnthropicClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    base_url: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Base URL for the API",
    )
    default_headers: Mapping[str, str] | None = Field(
        default=None,
        description="HTTP headers",
    )


class AnthropicCustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["anthropic"] = "anthropic"
    supports_streaming: bool = True
    anthropic_authentication_method: AnthropicAuthenticationMethod = Field(
        description="Anthropic authentication method"
    )
    anthropic_client_interface: Literal["chat"] = "chat"
    anthropic_client_kwargs: AnthropicClientKwargs | None = Field(
        default=None,
        description="Anthropic client kwargs",
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["AsyncAnthropic"]]:
        try:
            from anthropic import AsyncAnthropic
        except ImportError:
            raise ImportError("Anthropic package not installed. Run: pip install anthropic")

        method = self.anthropic_authentication_method
        api_key = _resolve_value(method.api_key, store)

        kwargs = self.anthropic_client_kwargs
        base_url = _resolve_value(kwargs.base_url if kwargs else None, store)
        default_headers = kwargs.default_headers if kwargs else None

        async def _() -> AsyncAnthropic:
            return AsyncAnthropic(
                api_key=api_key,
                base_url=base_url,
                default_headers=default_headers,
            )

        return _


class AWSBedrockAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    aws_access_key_id: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="AWS access key ID",
    )
    aws_secret_access_key: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="AWS secret access key",
    )
    aws_session_token: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="AWS session token (optional)",
    )


class AWSBedrockClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    region_name: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="AWS region name",
    )
    endpoint_url: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="AWS endpoint URL",
    )


class AWSBedrockCustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["aws_bedrock"] = "aws_bedrock"
    supports_streaming: bool = True
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethod = Field(
        description="AWS Bedrock authentication method"
    )
    aws_bedrock_client_interface: Literal["converse"] = "converse"
    aws_bedrock_client_kwargs: AWSBedrockClientKwargs | None = Field(
        default=None,
        description="AWS Bedrock client kwargs",
    )

    async def get_client_factory(self, store: CanGetString) -> Callable[..., Awaitable[Any]]:
        try:
            import boto3  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError("boto3 package not installed. Run: pip install boto3")

        method = self.aws_bedrock_authentication_method
        kwargs = self.aws_bedrock_client_kwargs

        # Extract and validate region name (required)
        region_name = _resolve_value(kwargs.region_name if kwargs else None, store)
        if not region_name:
            raise ValueError("AWS region name is required")

        # Extract optional endpoint URL
        endpoint_url = _resolve_value(kwargs.endpoint_url if kwargs else None, store)

        # Extract AWS credentials (all optional - boto3 can use IAM role, env vars, etc.)
        aws_access_key_id = _resolve_value(method.aws_access_key_id, store)
        aws_secret_access_key = _resolve_value(method.aws_secret_access_key, store)
        aws_session_token = _resolve_value(method.aws_session_token, store)

        # Validate credential consistency: if access key is provided, secret key must be too
        if aws_access_key_id and not aws_secret_access_key:
            raise ValueError("AWS secret access key is required when access key ID is provided")
        if aws_secret_access_key and not aws_access_key_id:
            raise ValueError("AWS access key ID is required when secret access key is provided")

        async def _() -> Any:
            client_kwargs: dict[str, Any] = {
                "service_name": "bedrock-runtime",
                "region_name": region_name,
            }
            if endpoint_url:
                client_kwargs["endpoint_url"] = endpoint_url
            if aws_access_key_id:
                client_kwargs["aws_access_key_id"] = aws_access_key_id
            if aws_secret_access_key:
                client_kwargs["aws_secret_access_key"] = aws_secret_access_key
            if aws_session_token:
                client_kwargs["aws_session_token"] = aws_session_token
            return boto3.client(**client_kwargs)

        return _


class GoogleGenAIAuthenticationMethod(BaseModel):
    """Authentication for Google GenAI (AI Studio)."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_key: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Google AI Studio API key",
    )


class GoogleGenAIHttpOptions(BaseModel):
    """HTTP options to be used in each of the requests."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    base_url: StringValueLookupOrStringValue | None = Field(
        default=None,
        description="Base URL for the API",
    )
    headers: Mapping[str, str] | None = Field(
        default=None,
        description="HTTP headers",
    )


class GoogleGenAIClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
    )
    http_options: GoogleGenAIHttpOptions | None = Field(
        default=None,
        description="HTTP options",
    )


class GoogleGenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["google_genai"] = "google_genai"
    supports_streaming: bool = True
    google_genai_authentication_method: GoogleGenAIAuthenticationMethod = Field(
        description="Google GenAI authentication method"
    )
    google_genai_client_interface: Literal["chat"] = "chat"
    google_genai_client_kwargs: GoogleGenAIClientKwargs | None = Field(
        default=None,
        description="Google GenAI client kwargs",
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["genai.client.AsyncClient"]]:
        try:
            from google.genai.client import AsyncClient, Client
            from google.genai.types import HttpOptions
        except ImportError:
            raise ImportError("Google genai package not installed. Run: pip install google-genai")

        method = self.google_genai_authentication_method
        api_key = _resolve_value(method.api_key, store)

        http_options = None
        if self.google_genai_client_kwargs and self.google_genai_client_kwargs.http_options:
            ho = self.google_genai_client_kwargs.http_options
            base_url = _resolve_value(ho.base_url, store)
            http_options = HttpOptions(
                base_url=base_url,
                headers=dict(ho.headers) if ho.headers else None,
            )

        async def _() -> AsyncClient:
            client = Client(
                api_key=api_key,
                http_options=http_options,
            )
            return client.aio  # Return async interface

        return _


class OllamaCustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["ollama"] = "ollama"
    supports_streaming: bool = True
    openai_client_interface: Literal["chat"] = "chat"
    openai_client_kwargs: OpenAIClientKwargs | None = Field(
        default=None,
        description="OpenAI client kwargs",
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["AsyncOpenAI"]]:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        kwargs = self.openai_client_kwargs
        base_url = _resolve_value(kwargs.base_url if kwargs else None, store)
        organization = _resolve_value(kwargs.organization if kwargs else None, store)
        project = _resolve_value(kwargs.project if kwargs else None, store)
        default_headers = kwargs.default_headers if kwargs else None

        async def _() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key="ollama",
                base_url=base_url,
                organization=organization,
                project=project,
                default_headers=default_headers,
            )

        return _


class DeepSeekAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_key: StringValueLookupOrStringValue = Field(
        default=StringValueLookup(string_value_lookup_key="DEEPSEEK_API_KEY"),
        description="DeepSeek API key",
    )


class DeepSeekCustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["deepseek"] = "deepseek"
    supports_streaming: bool = True
    deepseek_authentication_method: DeepSeekAuthenticationMethod = Field(
        description="DeepSeek authentication method"
    )
    openai_client_interface: Literal["chat"] = "chat"
    openai_client_kwargs: OpenAIClientKwargs | None = Field(
        default=None,
        description="OpenAI client kwargs",
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["AsyncOpenAI"]]:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        method = self.deepseek_authentication_method
        api_key = _resolve_value(method.api_key, store)

        kwargs = self.openai_client_kwargs
        base_url = _resolve_value(kwargs.base_url if kwargs else None, store)
        organization = _resolve_value(kwargs.organization if kwargs else None, store)
        project = _resolve_value(kwargs.project if kwargs else None, store)
        default_headers = kwargs.default_headers if kwargs else None

        async def _() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                organization=organization,
                project=project,
                default_headers=default_headers,
            )

        return _


class XAIAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_min_length=1,
        str_strip_whitespace=True,
    )
    api_key: StringValueLookupOrStringValue = Field(
        default=StringValueLookup(string_value_lookup_key="XAI_API_KEY"),
        description="xAI API key",
    )


class XAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
    )
    type: Literal["xai"] = "xai"
    supports_streaming: bool = True
    xai_authentication_method: XAIAuthenticationMethod = Field(
        description="xAI authentication method"
    )
    openai_client_interface: Literal["chat"] = "chat"
    openai_client_kwargs: OpenAIClientKwargs | None = Field(
        default=None,
        description="OpenAI client kwargs",
    )

    async def get_client_factory(
        self, store: CanGetString
    ) -> Callable[..., Awaitable["AsyncOpenAI"]]:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        method = self.xai_authentication_method
        api_key = _resolve_value(method.api_key, store)

        kwargs = self.openai_client_kwargs
        base_url = _resolve_value(kwargs.base_url if kwargs else None, store)
        organization = _resolve_value(kwargs.organization if kwargs else None, store)
        project = _resolve_value(kwargs.project if kwargs else None, store)
        default_headers = kwargs.default_headers if kwargs else None

        async def _() -> AsyncOpenAI:
            return AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                organization=organization,
                project=project,
                default_headers=default_headers,
            )

        return _


GenerativeModelCustomerProviderConfigType = Annotated[
    Union[
        OpenAICustomProviderConfig,
        AzureOpenAICustomProviderConfig,
        AnthropicCustomProviderConfig,
        AWSBedrockCustomProviderConfig,
        GoogleGenAICustomProviderConfig,
        OllamaCustomProviderConfig,
        DeepSeekCustomProviderConfig,
        XAICustomProviderConfig,
    ],
    Field(discriminator="type"),
]


class GenerativeModelCustomerProviderConfig(RootModel[GenerativeModelCustomerProviderConfigType]):
    root: GenerativeModelCustomerProviderConfigType
