from contextlib import AbstractAsyncContextManager
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Annotated,
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

# Generic type for client factory
ClientT = TypeVar("ClientT")
ClientFactory: TypeAlias = Callable[[], AbstractAsyncContextManager[ClientT]]


class ModelProvider(Enum):
    OPENAI = "OPENAI"
    AZURE_OPENAI = "AZURE_OPENAI"
    ANTHROPIC = "ANTHROPIC"
    GOOGLE = "GOOGLE"
    DEEPSEEK = "DEEPSEEK"
    XAI = "XAI"
    OLLAMA = "OLLAMA"
    AWS = "AWS"


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
    supports_streaming: bool = True
    openai_authentication_method: OpenAIAuthenticationMethod = Field(
        ...,
        description="OpenAI authentication method",
    )
    openai_client_interface: Literal["chat"] = "chat"
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
    AuthenticationMethodApiKey | AuthenticationMethodAzureADTokenProvider,
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
    supports_streaming: bool = True
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethod = Field(
        ...,
        description="Azure OpenAI authentication method",
    )
    azure_openai_client_interface: Literal["chat"] = "chat"
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
    supports_streaming: bool = True
    anthropic_authentication_method: AnthropicAuthenticationMethod = Field(
        ...,
        description="Anthropic authentication method",
    )
    anthropic_client_interface: Literal["chat"] = "chat"
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


class AWSBedrockAuthenticationMethod(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        str_min_length=1,
        str_strip_whitespace=True,
    )
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
    supports_streaming: bool = True
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethod = Field(
        ...,
        description="AWS Bedrock authentication method",
    )
    aws_bedrock_client_interface: Literal["converse"] = "converse"
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

        The factory returns aioboto3's ClientCreatorContext which is an async context manager.

        Usage::

            client_factory = config.get_client_factory()
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

        aws_access_key_id = method.aws_access_key_id
        aws_secret_access_key = method.aws_secret_access_key
        aws_session_token = method.aws_session_token

        with without_env_vars("AWS_*"):
            session = aioboto3.Session(
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                aws_session_token=aws_session_token,
                region_name=region_name,
            )

        def create_client() -> "AbstractAsyncContextManager[BedrockRuntimeClient]":
            return session.client(  # type: ignore[no-any-return]
                service_name="bedrock-runtime",
                endpoint_url=endpoint_url,
            )

        return create_client


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
    supports_streaming: bool = True
    google_genai_authentication_method: GoogleGenAIAuthenticationMethod = Field(
        ...,
        description="Google GenAI authentication method",
    )
    google_genai_client_interface: Literal["chat"] = "chat"
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
