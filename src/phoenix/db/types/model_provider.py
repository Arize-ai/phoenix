from contextlib import AbstractAsyncContextManager, asynccontextmanager
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    AsyncIterator,
    Callable,
    Literal,
    Mapping,
    TypeVar,
    Union,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    RootModel,
)
from typing_extensions import TypeAlias, assert_never

from phoenix.utilities.env_vars import without_env_vars

if TYPE_CHECKING:
    from anthropic import AsyncAnthropic
    from google.genai.client import AsyncClient as GoogleAsyncClient
    from openai import AsyncOpenAI
    from types_aiobotocore_bedrock_runtime import BedrockRuntimeClient

    from phoenix.db.models import GenerativeModelSDK

# Generic type for client factory
ClientT = TypeVar("ClientT")
ClientFactory: TypeAlias = Callable[[], AbstractAsyncContextManager[ClientT]]


@asynccontextmanager
async def _bedrock_client_with_headers(
    client_context: AbstractAsyncContextManager["BedrockRuntimeClient"],
    extra_headers: Mapping[str, str] | None,
) -> AsyncIterator["BedrockRuntimeClient"]:
    """
    Wrapper that adds custom headers to a Bedrock client via the event system.

    aiobotocore clients inherit boto3's event system via ``client.meta.events``:
    https://github.com/aio-libs/aiobotocore/blob/93af53a8cd8faead9747561abcff4f6631afa732/aiobotocore/client.py#L208-L210
    """
    async with client_context as client:
        if extra_headers:

            def add_custom_headers(request: Any, **kwargs: Any) -> None:
                request.headers.update(extra_headers)

            client.meta.events.register("before-send.*", add_custom_headers)
        yield client


class ModelProvider(Enum):
    OPENAI = "OPENAI"
    AZURE_OPENAI = "AZURE_OPENAI"
    ANTHROPIC = "ANTHROPIC"
    GOOGLE = "GOOGLE"
    DEEPSEEK = "DEEPSEEK"
    XAI = "XAI"
    OLLAMA = "OLLAMA"
    AWS = "AWS"


def is_sdk_compatible_with_model_provider(
    sdk: "GenerativeModelSDK",
    model_provider: ModelProvider,
) -> bool:
    """
    Check if a custom provider's SDK can be used with a prompt's model provider.

    This prevents misconfigurations like using an AWS Bedrock custom provider
    with an OpenAI prompt.
    """
    if sdk == "openai" or sdk == "azure_openai":
        # openai and azure_openai SDKs are compatible with OpenAI-family providers
        return model_provider in (
            ModelProvider.OPENAI,
            ModelProvider.AZURE_OPENAI,
            ModelProvider.DEEPSEEK,
            ModelProvider.XAI,
            ModelProvider.OLLAMA,
        )
    if sdk == "anthropic":
        return model_provider is ModelProvider.ANTHROPIC
    if sdk == "google_genai":
        return model_provider is ModelProvider.GOOGLE
    if sdk == "aws_bedrock":
        return model_provider is ModelProvider.AWS
    else:
        assert_never(sdk)


class AuthenticationMethodApiKey(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    type: Literal["api_key"] = "api_key"
    api_key: str = Field(
        ...,
        description="API key",
    )


class AuthenticationMethodDefaultCredentials(BaseModel):
    """
    Authentication method that delegates to the SDK's default credential chain.

    For AWS: boto3 credential chain (IAM role, env vars, ~/.aws/credentials)
    For Azure: DefaultAzureCredential (Managed Identity, Azure CLI, env vars)
    """

    model_config = ConfigDict(frozen=True)
    type: Literal["default_credentials"] = "default_credentials"


OpenAIAuthenticationMethod: TypeAlias = AuthenticationMethodApiKey


class OpenAIClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    base_url: str | None = Field(
        default=None,
        description="Base URL for the API",
    )
    organization: str | None = Field(
        default=None,
        description="Organization ID",
    )
    project: str | None = Field(
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
        str_strip_whitespace=True,
    )
    type: Literal["openai"] = "openai"
    openai_authentication_method: OpenAIAuthenticationMethod = Field(
        ...,
        description="OpenAI authentication method",
    )
    openai_client_kwargs: OpenAIClientKwargs | None = Field(
        default=None,
        description="OpenAI client kwargs",
    )

    def get_client_factory(
        self,
        extra_headers: Mapping[str, str] | None = None,
    ) -> "ClientFactory[AsyncOpenAI]":
        """
        Returns a factory that creates fresh AsyncOpenAI clients.

        The factory returns an async context manager for proper resource cleanup.
        """
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        kwargs = self.openai_client_kwargs
        base_url = kwargs.base_url if kwargs else None
        organization = kwargs.organization if kwargs else None
        project = kwargs.project if kwargs else None
        default_headers = kwargs.default_headers if kwargs else None

        method = self.openai_authentication_method
        api_key = method.api_key

        headers = dict(default_headers) if default_headers else {}
        if extra_headers:
            headers.update(extra_headers)
        merged_headers = headers or None

        def create_client() -> AsyncOpenAI:
            with without_env_vars("OPENAI_*"):
                return AsyncOpenAI(
                    api_key=api_key,
                    base_url=base_url,
                    organization=organization,
                    project=project,
                    default_headers=merged_headers,
                )

        return create_client


class AuthenticationMethodAzureADTokenProvider(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    type: Literal["azure_ad_token_provider"] = "azure_ad_token_provider"
    azure_client_id: str = Field(
        ...,
        description="Azure client ID",
    )
    azure_client_secret: str = Field(
        ...,
        description="Azure client secret",
    )
    azure_tenant_id: str = Field(
        ...,
        description="Azure tenant ID",
    )
    scope: str = Field(
        default="https://cognitiveservices.azure.com/.default",
        description="Azure scope",
    )


AzureOpenAIAuthenticationMethod = Annotated[
    AuthenticationMethodApiKey
    | AuthenticationMethodAzureADTokenProvider
    | AuthenticationMethodDefaultCredentials,
    Field(discriminator="type"),
]


class AzureOpenAIClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    azure_endpoint: str = Field(
        ...,
        description="Azure endpoint URL (e.g., https://myresource.openai.azure.com)",
    )
    default_headers: Mapping[str, str] | None = Field(
        default=None,
        description="HTTP headers",
    )


class AzureOpenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_strip_whitespace=True,
    )
    type: Literal["azure_openai"] = "azure_openai"
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethod = Field(
        ...,
        description="Azure OpenAI authentication method",
    )
    azure_openai_client_kwargs: AzureOpenAIClientKwargs = Field(
        ...,
        description="Azure OpenAI client kwargs",
    )

    def get_client_factory(
        self,
        extra_headers: Mapping[str, str] | None = None,
    ) -> "ClientFactory[AsyncOpenAI]":
        """
        Returns a factory that creates fresh AsyncOpenAI clients for Azure.

        The factory returns an async context manager for proper resource cleanup.
        """
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        kwargs = self.azure_openai_client_kwargs

        default_headers = kwargs.default_headers

        # Construct the v1 API base URL
        azure_endpoint = kwargs.azure_endpoint.rstrip("/")
        base_url = (
            azure_endpoint
            if azure_endpoint.endswith("/openai/v1")
            else f"{azure_endpoint}/openai/v1"
        ) + "/"

        headers = dict(default_headers) if default_headers else {}
        if extra_headers:
            headers.update(extra_headers)
        merged_headers = headers or None

        method = self.azure_openai_authentication_method

        if method.type == "api_key":
            api_key = method.api_key

            def create_client_with_api_key() -> AsyncOpenAI:
                with without_env_vars("AZURE_*", "OPENAI_*"):
                    return AsyncOpenAI(
                        api_key=api_key,
                        base_url=base_url,
                        default_headers=merged_headers,
                    )

            return create_client_with_api_key

        elif method.type == "azure_ad_token_provider":
            try:
                from azure.identity.aio import ClientSecretCredential, get_bearer_token_provider
            except ImportError:
                raise ImportError(
                    "Azure identity package not installed. Run: pip install azure-identity"
                )
            scope = method.scope
            tenant_id = method.azure_tenant_id
            client_id = method.azure_client_id
            client_secret = method.azure_client_secret
            cred = ClientSecretCredential(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret,
            )
            token_provider = get_bearer_token_provider(cred, scope)

            def create_client_with_token() -> AsyncOpenAI:
                with without_env_vars("AZURE_*", "OPENAI_*"):
                    # Passing token_provider as api_key requires openai>=1.106.0
                    return AsyncOpenAI(
                        api_key=token_provider,
                        base_url=base_url,
                        default_headers=merged_headers,
                    )

            return create_client_with_token

        elif method.type == "default_credentials":
            # Use DefaultAzureCredential for Managed Identity, Azure CLI, env vars, etc.
            try:
                from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
            except ImportError:
                raise ImportError(
                    "Azure identity package not installed. Run: pip install azure-identity"
                )
            scope = "https://cognitiveservices.azure.com/.default"
            default_cred = DefaultAzureCredential()
            token_provider = get_bearer_token_provider(default_cred, scope)

            def create_client_with_default_cred() -> AsyncOpenAI:
                # No env var isolation needed - credentials are already resolved via token_provider
                return AsyncOpenAI(
                    api_key=token_provider,
                    base_url=base_url,
                    default_headers=merged_headers,
                )

            return create_client_with_default_cred

        else:
            assert_never(method.type)


AnthropicAuthenticationMethod: TypeAlias = AuthenticationMethodApiKey


class AnthropicClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    base_url: str | None = Field(
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
        str_strip_whitespace=True,
    )
    type: Literal["anthropic"] = "anthropic"
    anthropic_authentication_method: AnthropicAuthenticationMethod = Field(
        ...,
        description="Anthropic authentication method",
    )
    anthropic_client_kwargs: AnthropicClientKwargs | None = Field(
        default=None,
        description="Anthropic client kwargs",
    )

    def get_client_factory(
        self,
        extra_headers: Mapping[str, str] | None = None,
    ) -> "ClientFactory[AsyncAnthropic]":
        """
        Returns a factory that creates fresh AsyncAnthropic clients.

        The factory returns an async context manager for proper resource cleanup.
        """
        try:
            from anthropic import AsyncAnthropic
        except ImportError:
            raise ImportError("Anthropic package not installed. Run: pip install anthropic")

        kwargs = self.anthropic_client_kwargs

        base_url = kwargs.base_url if kwargs else None
        default_headers = kwargs.default_headers if kwargs else None

        method = self.anthropic_authentication_method
        api_key = method.api_key

        headers = dict(default_headers) if default_headers else {}
        if extra_headers:
            headers.update(extra_headers)
        merged_headers = headers or None

        def create_client() -> AsyncAnthropic:
            with without_env_vars("ANTHROPIC_*"):
                return AsyncAnthropic(
                    api_key=api_key,
                    base_url=base_url,
                    default_headers=merged_headers,
                )

        return create_client


class AWSBedrockAuthenticationMethodAccessKeys(BaseModel):
    """Authentication using explicit AWS access keys."""

    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    type: Literal["access_keys"] = "access_keys"
    aws_access_key_id: str = Field(
        ...,
        description="AWS access key ID",
    )
    aws_secret_access_key: str = Field(
        ...,
        description="AWS secret access key",
    )
    aws_session_token: str | None = Field(
        default=None,
        description="AWS session token (optional)",
    )


AWSBedrockAuthenticationMethod = Annotated[
    AWSBedrockAuthenticationMethodAccessKeys | AuthenticationMethodDefaultCredentials,
    Field(discriminator="type"),
]


class AWSBedrockClientKwargs(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    region_name: str = Field(
        ...,
        description="AWS region name",
    )
    endpoint_url: str | None = Field(
        default=None,
        description="AWS endpoint URL",
    )


class AWSBedrockCustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_strip_whitespace=True,
    )
    type: Literal["aws_bedrock"] = "aws_bedrock"
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethod = Field(
        ...,
        description="AWS Bedrock authentication method",
    )
    aws_bedrock_client_kwargs: AWSBedrockClientKwargs = Field(
        ...,
        description="AWS Bedrock client kwargs",
    )

    def get_client_factory(
        self,
        extra_headers: Mapping[str, str] | None = None,
    ) -> "ClientFactory[BedrockRuntimeClient]":
        """
        Returns a factory that creates fresh Bedrock runtime clients.

        The factory returns an async context manager wrapping aioboto3's client.
        Custom headers are supported via the boto3 event system.

        Usage::

            client_factory = config.get_client_factory(extra_headers={"X-Custom": "value"})
            async with client_factory() as client:
                response = await client.converse_stream(...)
        """
        try:
            import aioboto3  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError("aioboto3 package not installed. Run: pip install aioboto3")

        kwargs = self.aws_bedrock_client_kwargs

        region_name = kwargs.region_name
        endpoint_url = kwargs.endpoint_url

        method = self.aws_bedrock_authentication_method

        # Capture extra_headers in closure for use in factory
        headers = extra_headers

        if method.type == "access_keys":
            # Explicit credentials provided
            aws_access_key_id = method.aws_access_key_id
            aws_secret_access_key = method.aws_secret_access_key
            aws_session_token = method.aws_session_token

            # Create session with env var isolation - explicit credentials are captured
            with without_env_vars("AWS_*"):
                session = aioboto3.Session(
                    aws_access_key_id=aws_access_key_id,
                    aws_secret_access_key=aws_secret_access_key,
                    aws_session_token=aws_session_token,
                    region_name=region_name,
                )

            def create_client_with_keys() -> "AbstractAsyncContextManager[BedrockRuntimeClient]":
                # Client creation still needs env var isolation for endpoint resolution
                with without_env_vars("AWS_*"):
                    client_context = session.client(
                        service_name="bedrock-runtime",
                        endpoint_url=endpoint_url,
                    )
                return _bedrock_client_with_headers(client_context, headers)

            return create_client_with_keys

        elif method.type == "default_credentials":
            # Use boto3 default credential chain (IAM role, env vars, ~/.aws/credentials)
            session = aioboto3.Session(region_name=region_name)

            def create_client_with_env() -> "AbstractAsyncContextManager[BedrockRuntimeClient]":
                client_context = session.client(
                    service_name="bedrock-runtime",
                    endpoint_url=endpoint_url,
                )
                return _bedrock_client_with_headers(client_context, headers)

            return create_client_with_env

        else:
            assert_never(method.type)


GoogleGenAIAuthenticationMethod: TypeAlias = AuthenticationMethodApiKey


class GoogleGenAIHttpOptions(BaseModel):
    """HTTP options to be used in each of the requests."""

    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
    base_url: str | None = Field(
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
    )
    http_options: GoogleGenAIHttpOptions | None = Field(
        default=None,
        description="HTTP options",
    )


class GoogleGenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_strip_whitespace=True,
    )
    type: Literal["google_genai"] = "google_genai"
    google_genai_authentication_method: GoogleGenAIAuthenticationMethod = Field(
        ...,
        description="Google GenAI authentication method",
    )
    google_genai_client_kwargs: GoogleGenAIClientKwargs | None = Field(
        default=None,
        description="Google GenAI client kwargs",
    )

    def get_client_factory(
        self,
        extra_headers: Mapping[str, str] | None = None,
    ) -> "ClientFactory[GoogleAsyncClient]":
        """
        Returns a factory that creates fresh Google GenAI async clients.

        The factory returns Client.aio which is an async context manager.
        """
        try:
            from google.genai.client import Client
            from google.genai.types import HttpOptions
        except ImportError:
            raise ImportError("Google genai package not installed. Run: pip install google-genai")

        kwargs = self.google_genai_client_kwargs
        base_url = None
        default_headers = None
        if kwargs and kwargs.http_options:
            ho = kwargs.http_options
            base_url = ho.base_url
            default_headers = ho.headers

        method = self.google_genai_authentication_method
        if method.type == "api_key":
            api_key = method.api_key
        else:
            assert_never(method.type)

        headers = dict(default_headers) if default_headers else {}
        if extra_headers:
            headers.update(extra_headers)
        http_options = (
            HttpOptions(
                base_url=base_url,
                headers=headers or None,
            )
            if base_url or headers
            else None
        )

        def create_client() -> "AbstractAsyncContextManager[GoogleAsyncClient]":
            with without_env_vars("GOOGLE_*", "GEMINI_*"):
                return Client(  # type: ignore[no-any-return]
                    api_key=api_key,
                    http_options=http_options,
                ).aio

        return create_client


GenerativeModelCustomerProviderConfigType = Annotated[
    Union[
        OpenAICustomProviderConfig,
        AzureOpenAICustomProviderConfig,
        AnthropicCustomProviderConfig,
        AWSBedrockCustomProviderConfig,
        GoogleGenAICustomProviderConfig,
    ],
    Field(discriminator="type"),
]


class GenerativeModelCustomerProviderConfig(RootModel[GenerativeModelCustomerProviderConfigType]):
    root: GenerativeModelCustomerProviderConfigType
