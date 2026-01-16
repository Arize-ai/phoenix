from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON

from phoenix.db.types.model_provider import (
    AnthropicClientKwargs,
    AnthropicCustomProviderConfig,
    AuthenticationMethodApiKey,
    AuthenticationMethodAzureADTokenProvider,
    AuthenticationMethodEnvironment,
    AWSBedrockAuthenticationMethodAccessKeys,
    AWSBedrockClientKwargs,
    AWSBedrockCustomProviderConfig,
    AzureOpenAIClientKwargs,
    AzureOpenAICustomProviderConfig,
    GenerativeModelCustomerProviderConfig,
    GoogleGenAIClientKwargs,
    GoogleGenAICustomProviderConfig,
    GoogleGenAIHttpOptions,
    OpenAIClientKwargs,
    OpenAICustomProviderConfig,
)


@strawberry.input
class OpenAIAuthenticationMethodInput:
    api_key: str

    def to_orm(self) -> AuthenticationMethodApiKey:
        return AuthenticationMethodApiKey(api_key=self.api_key)


@strawberry.input
class OpenAIClientKwargsInput:
    base_url: str | None = UNSET
    organization: str | None = UNSET
    project: str | None = UNSET
    default_headers: JSON | None = UNSET

    def to_orm(self) -> OpenAIClientKwargs:
        return OpenAIClientKwargs(
            base_url=self.base_url or None,
            organization=self.organization or None,
            project=self.project or None,
            default_headers=self.default_headers or None,
        )


@strawberry.input
class OpenAICustomProviderConfigInput:
    openai_authentication_method: OpenAIAuthenticationMethodInput
    openai_client_kwargs: OpenAIClientKwargsInput | None = UNSET

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=OpenAICustomProviderConfig(
                openai_authentication_method=self.openai_authentication_method.to_orm(),
                openai_client_kwargs=self.openai_client_kwargs.to_orm()
                if self.openai_client_kwargs
                else None,
            )
        )


@strawberry.input
class AzureOpenAIADTokenProviderInput:
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: str
    scope: str | None = UNSET

    def to_orm(self) -> AuthenticationMethodAzureADTokenProvider:
        return AuthenticationMethodAzureADTokenProvider(
            azure_tenant_id=self.azure_tenant_id,
            azure_client_id=self.azure_client_id,
            azure_client_secret=self.azure_client_secret,
            scope=self.scope if self.scope else "https://cognitiveservices.azure.com/.default",
        )


@strawberry.input(one_of=True)
class AzureOpenAIAuthenticationMethodInput:
    api_key: str | None = UNSET
    azure_ad_token_provider: AzureOpenAIADTokenProviderInput | None = UNSET
    environment: bool | None = strawberry.field(
        default=UNSET,
        description="Use SDK default credentials (Managed Identity, Azure CLI, env vars).",
    )

    def to_orm(
        self,
    ) -> (
        AuthenticationMethodApiKey
        | AuthenticationMethodAzureADTokenProvider
        | AuthenticationMethodEnvironment
    ):
        if self.environment:
            return AuthenticationMethodEnvironment()
        if self.azure_ad_token_provider:
            return self.azure_ad_token_provider.to_orm()
        if self.api_key:
            return AuthenticationMethodApiKey(api_key=self.api_key)
        raise ValueError("One of api_key, azure_ad_token_provider, or environment must be provided")


@strawberry.input
class AzureOpenAIClientKwargsInput:
    azure_endpoint: str
    default_headers: JSON | None = UNSET

    def to_orm(self) -> AzureOpenAIClientKwargs:
        return AzureOpenAIClientKwargs(
            azure_endpoint=self.azure_endpoint,
            default_headers=self.default_headers or None,
        )


@strawberry.input
class AzureOpenAICustomProviderConfigInput:
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethodInput
    azure_openai_client_kwargs: AzureOpenAIClientKwargsInput

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        # Build authentication method
        return GenerativeModelCustomerProviderConfig(
            root=AzureOpenAICustomProviderConfig(
                azure_openai_authentication_method=self.azure_openai_authentication_method.to_orm(),
                azure_openai_client_kwargs=self.azure_openai_client_kwargs.to_orm(),
            )
        )


@strawberry.input
class AnthropicAuthenticationMethodInput:
    api_key: str

    def to_orm(self) -> AuthenticationMethodApiKey:
        return AuthenticationMethodApiKey(api_key=self.api_key)


@strawberry.input
class AnthropicClientKwargsInput:
    base_url: str | None = UNSET
    default_headers: JSON | None = UNSET

    def to_orm(self) -> AnthropicClientKwargs:
        return AnthropicClientKwargs(
            base_url=self.base_url or None,
            default_headers=self.default_headers or None,
        )


@strawberry.input
class AnthropicCustomProviderConfigInput:
    anthropic_authentication_method: AnthropicAuthenticationMethodInput
    anthropic_client_kwargs: AnthropicClientKwargsInput | None = UNSET

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=AnthropicCustomProviderConfig(
                anthropic_authentication_method=self.anthropic_authentication_method.to_orm(),
                anthropic_client_kwargs=self.anthropic_client_kwargs.to_orm()
                if self.anthropic_client_kwargs
                else None,
            )
        )


@strawberry.input
class GoogleGenAIHttpOptionsInput:
    """HTTP options to be used in each of the requests."""

    base_url: str | None = UNSET
    """The base URL for the AI platform service endpoint."""

    headers: JSON | None = UNSET
    """Additional HTTP headers to be sent with the request."""

    def to_orm(self) -> GoogleGenAIHttpOptions:
        return GoogleGenAIHttpOptions(
            base_url=self.base_url or None,
            headers=self.headers or None,
        )


@strawberry.input
class GoogleGenAIAuthenticationMethodInput:
    api_key: str

    def to_orm(self) -> AuthenticationMethodApiKey:
        return AuthenticationMethodApiKey(api_key=self.api_key)


@strawberry.input
class GoogleGenAIClientKwargsInput:
    http_options: GoogleGenAIHttpOptionsInput | None = UNSET

    def to_orm(self) -> GoogleGenAIClientKwargs:
        http_options = self.http_options.to_orm() if self.http_options else None
        return GoogleGenAIClientKwargs(http_options=http_options)


@strawberry.input
class GoogleGenAICustomProviderConfigInput:
    google_genai_authentication_method: GoogleGenAIAuthenticationMethodInput
    google_genai_client_kwargs: GoogleGenAIClientKwargsInput | None = UNSET

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=GoogleGenAICustomProviderConfig(
                google_genai_authentication_method=self.google_genai_authentication_method.to_orm(),
                google_genai_client_kwargs=self.google_genai_client_kwargs.to_orm()
                if self.google_genai_client_kwargs
                else None,
            )
        )


@strawberry.input
class AWSBedrockAccessKeysInput:
    """AWS access key credentials."""

    aws_access_key_id: str
    aws_secret_access_key: str
    aws_session_token: str | None = UNSET

    def to_orm(self) -> AWSBedrockAuthenticationMethodAccessKeys:
        return AWSBedrockAuthenticationMethodAccessKeys(
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            aws_session_token=self.aws_session_token or None,
        )


@strawberry.input(one_of=True)
class AWSBedrockAuthenticationMethodInput:
    """AWS Bedrock auth - access keys or environment credentials."""

    access_keys: AWSBedrockAccessKeysInput | None = strawberry.field(
        default=UNSET,
        description="Explicit AWS access key credentials.",
    )
    environment: bool | None = strawberry.field(
        default=UNSET,
        description="Use SDK default credentials (IAM role, env vars, ~/.aws/credentials).",
    )

    def to_orm(
        self,
    ) -> AWSBedrockAuthenticationMethodAccessKeys | AuthenticationMethodEnvironment:
        if self.environment:
            return AuthenticationMethodEnvironment()
        if self.access_keys:
            return self.access_keys.to_orm()
        raise ValueError("One of access_keys or environment must be provided")


@strawberry.input
class AWSBedrockClientKwargsInput:
    region_name: str
    endpoint_url: str | None = UNSET

    def to_orm(self) -> AWSBedrockClientKwargs:
        return AWSBedrockClientKwargs(
            region_name=self.region_name,
            endpoint_url=self.endpoint_url or None,
        )


@strawberry.input
class AWSBedrockCustomProviderConfigInput:
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethodInput
    aws_bedrock_client_kwargs: AWSBedrockClientKwargsInput

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=AWSBedrockCustomProviderConfig(
                aws_bedrock_authentication_method=self.aws_bedrock_authentication_method.to_orm(),
                aws_bedrock_client_kwargs=self.aws_bedrock_client_kwargs.to_orm(),
            )
        )


@strawberry.input(one_of=True)
class GenerativeModelCustomerProviderConfigInput:
    """Client configuration input for any supported provider type."""

    openai: Optional[OpenAICustomProviderConfigInput] = UNSET
    azure_openai: Optional[AzureOpenAICustomProviderConfigInput] = UNSET
    anthropic: Optional[AnthropicCustomProviderConfigInput] = UNSET
    aws_bedrock: Optional[AWSBedrockCustomProviderConfigInput] = UNSET
    google_genai: Optional[GoogleGenAICustomProviderConfigInput] = UNSET

    def __post_init__(self) -> None:
        if (
            sum(
                map(
                    bool,
                    [
                        self.openai,
                        self.azure_openai,
                        self.anthropic,
                        self.aws_bedrock,
                        self.google_genai,
                    ],
                )
            )
            != 1
        ):
            raise ValueError(
                "Exactly one of openai, azure_openai, anthropic, aws_bedrock, "
                "google_genai must be provided"
            )

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        """Convert input config to ORM config based on which provider is set."""
        if self.openai:
            return self.openai.to_orm()
        if self.azure_openai:
            return self.azure_openai.to_orm()
        if self.anthropic:
            return self.anthropic.to_orm()
        if self.aws_bedrock:
            return self.aws_bedrock.to_orm()
        if self.google_genai:
            return self.google_genai.to_orm()
        raise ValueError(
            "Exactly one of openai, azure_openai, anthropic, aws_bedrock, "
            "google_genai must be provided"
        )
