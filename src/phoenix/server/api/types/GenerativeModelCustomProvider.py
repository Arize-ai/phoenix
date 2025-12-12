from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Callable, Union

import strawberry
from pydantic import ValidationError
from strawberry import UNSET
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import Self, assert_never

from phoenix.db import models
from phoenix.db.types import model_provider as mp
from phoenix.server.api.context import Context

if TYPE_CHECKING:
    from phoenix.server.api.types.User import User


class GenerativeModelSDK(Enum):
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    ANTHROPIC = "anthropic"
    AWS_BEDROCK = "aws_bedrock"
    GOOGLE_GENAI = "google_genai"


class OpenAIClientInterface(Enum):
    CHAT = "chat"


class AnthropicClientInterface(Enum):
    CHAT = "chat"


class AWSBedrockClientInterface(Enum):
    CONVERSE = "converse"


class GoogleGenAIClientInterface(Enum):
    CHAT = "chat"


@strawberry.type
class UnparsableConfig:
    parse_error: str


@strawberry.type
class AzureADTokenProvider:
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: str
    scope: str

    @classmethod
    def from_orm(cls, provider: mp.AuthenticationMethodAzureADTokenProvider) -> Self:
        return cls(
            azure_tenant_id=provider.azure_tenant_id,
            azure_client_id=provider.azure_client_id,
            azure_client_secret=provider.azure_client_secret,
            scope=provider.scope,
        )


@strawberry.type
class OpenAIAuthenticationMethod:
    api_key: str | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.OpenAIAuthenticationMethod) -> Self:
        return cls(api_key=method.api_key)


@strawberry.type
class OpenAIClientKwargs:
    base_url: str | None = UNSET
    organization: str | None = UNSET
    project: str | None = UNSET
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.OpenAIClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            base_url=kwargs.base_url,
            organization=kwargs.organization,
            project=kwargs.project,
            default_headers=kwargs.default_headers,
        )


@strawberry.type
class OpenAICustomProviderConfig:
    supports_streaming: bool
    openai_authentication_method: OpenAIAuthenticationMethod
    openai_client_kwargs: OpenAIClientKwargs | None = UNSET
    openai_client_interface: OpenAIClientInterface

    @classmethod
    def from_orm(cls, config: mp.OpenAICustomProviderConfig) -> Self:
        return cls(
            openai_client_interface=OpenAIClientInterface(config.openai_client_interface),
            supports_streaming=config.supports_streaming,
            openai_authentication_method=OpenAIAuthenticationMethod.from_orm(
                config.openai_authentication_method
            ),
            openai_client_kwargs=(OpenAIClientKwargs.from_orm(config.openai_client_kwargs)),
        )


@strawberry.type
class AzureOpenAIAuthenticationMethod:
    api_key: str | None = UNSET
    azure_ad_token_provider: AzureADTokenProvider | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AzureOpenAIAuthenticationMethod) -> Self:
        if method.type == "api_key":
            return cls(
                api_key=method.api_key,
                azure_ad_token_provider=None,
            )
        if method.type == "azure_ad_token_provider":
            return cls(
                api_key=None,
                azure_ad_token_provider=AzureADTokenProvider.from_orm(method),
            )
        assert_never(method.type)


@strawberry.type
class AzureOpenAIClientKwargs:
    api_version: str
    azure_endpoint: str
    azure_deployment: str
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AzureOpenAIClientKwargs) -> Self:
        return cls(
            api_version=kwargs.api_version,
            azure_endpoint=kwargs.azure_endpoint,
            azure_deployment=kwargs.azure_deployment,
            default_headers=kwargs.default_headers,
        )


@strawberry.type
class AzureOpenAICustomProviderConfig:
    supports_streaming: bool
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethod
    azure_openai_client_kwargs: AzureOpenAIClientKwargs
    azure_openai_client_interface: OpenAIClientInterface

    @classmethod
    def from_orm(cls, config: mp.AzureOpenAICustomProviderConfig) -> Self:
        return cls(
            azure_openai_client_interface=OpenAIClientInterface(
                config.azure_openai_client_interface
            ),
            supports_streaming=config.supports_streaming,
            azure_openai_authentication_method=AzureOpenAIAuthenticationMethod.from_orm(
                config.azure_openai_authentication_method
            ),
            azure_openai_client_kwargs=AzureOpenAIClientKwargs.from_orm(
                config.azure_openai_client_kwargs
            ),
        )


@strawberry.type
class AnthropicAuthenticationMethod:
    api_key: str | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AnthropicAuthenticationMethod) -> Self:
        return cls(api_key=method.api_key)


@strawberry.type
class AnthropicClientKwargs:
    base_url: str | None = UNSET
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AnthropicClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            base_url=kwargs.base_url,
            default_headers=kwargs.default_headers,
        )


@strawberry.type
class AnthropicCustomProviderConfig:
    supports_streaming: bool
    anthropic_authentication_method: AnthropicAuthenticationMethod
    anthropic_client_kwargs: AnthropicClientKwargs | None = UNSET
    anthropic_client_interface: AnthropicClientInterface

    @classmethod
    def from_orm(cls, config: mp.AnthropicCustomProviderConfig) -> Self:
        return cls(
            anthropic_client_interface=AnthropicClientInterface(config.anthropic_client_interface),
            supports_streaming=config.supports_streaming,
            anthropic_authentication_method=AnthropicAuthenticationMethod.from_orm(
                config.anthropic_authentication_method
            ),
            anthropic_client_kwargs=(
                AnthropicClientKwargs.from_orm(config.anthropic_client_kwargs)
            ),
        )


@strawberry.type
class AWSBedrockAuthenticationMethod:
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_session_token: str | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AWSBedrockAuthenticationMethod) -> Self:
        return cls(
            aws_access_key_id=method.aws_access_key_id,
            aws_secret_access_key=method.aws_secret_access_key,
            aws_session_token=method.aws_session_token,
        )


@strawberry.type
class AWSBedrockClientKwargs:
    region_name: str
    endpoint_url: str | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AWSBedrockClientKwargs) -> Self:
        return cls(
            region_name=kwargs.region_name,
            endpoint_url=kwargs.endpoint_url,
        )


@strawberry.type
class AWSBedrockCustomProviderConfig:
    supports_streaming: bool
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethod
    aws_bedrock_client_kwargs: AWSBedrockClientKwargs
    aws_bedrock_client_interface: AWSBedrockClientInterface

    @classmethod
    def from_orm(cls, config: mp.AWSBedrockCustomProviderConfig) -> Self:
        return cls(
            supports_streaming=config.supports_streaming,
            aws_bedrock_authentication_method=AWSBedrockAuthenticationMethod.from_orm(
                config.aws_bedrock_authentication_method
            ),
            aws_bedrock_client_kwargs=AWSBedrockClientKwargs.from_orm(
                config.aws_bedrock_client_kwargs
            ),
            aws_bedrock_client_interface=AWSBedrockClientInterface(
                config.aws_bedrock_client_interface
            ),
        )


@strawberry.type
class GoogleGenAIAuthenticationMethod:
    api_key: str | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.GoogleGenAIAuthenticationMethod) -> Self:
        return cls(api_key=method.api_key)


@strawberry.type
class GoogleGenAIHttpOptions:
    base_url: str | None = UNSET
    headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, http_options: mp.GoogleGenAIHttpOptions | None) -> Self | None:
        if not http_options:
            return None
        return cls(
            base_url=http_options.base_url,
            headers=dict(http_options.headers) if http_options.headers else None,
        )


@strawberry.type
class GoogleGenAIClientKwargs:
    http_options: GoogleGenAIHttpOptions | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.GoogleGenAIClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        http_options = (
            GoogleGenAIHttpOptions.from_orm(kwargs.http_options) if kwargs.http_options else None
        )
        return cls(http_options=http_options)


@strawberry.type
class GoogleGenAICustomProviderConfig:
    supports_streaming: bool
    google_genai_authentication_method: GoogleGenAIAuthenticationMethod
    google_genai_client_kwargs: GoogleGenAIClientKwargs | None = UNSET
    google_genai_client_interface: GoogleGenAIClientInterface

    @classmethod
    def from_orm(cls, config: mp.GoogleGenAICustomProviderConfig) -> Self:
        return cls(
            google_genai_client_interface=GoogleGenAIClientInterface(
                config.google_genai_client_interface
            ),
            supports_streaming=config.supports_streaming,
            google_genai_authentication_method=GoogleGenAIAuthenticationMethod.from_orm(
                config.google_genai_authentication_method
            ),
            google_genai_client_kwargs=GoogleGenAIClientKwargs.from_orm(
                config.google_genai_client_kwargs
            ),
        )


# Union type for polymorphic config field
CustomProviderConfig = Annotated[
    Union[
        OpenAICustomProviderConfig,
        AzureOpenAICustomProviderConfig,
        AnthropicCustomProviderConfig,
        AWSBedrockCustomProviderConfig,
        GoogleGenAICustomProviderConfig,
        UnparsableConfig,
    ],
    strawberry.union("CustomProviderConfig"),
]


def _parse_config(
    sdk: models.GenerativeModelSDK,
    encrypted_config: bytes,
    decrypt: Callable[[bytes], bytes],
) -> (
    OpenAICustomProviderConfig
    | AzureOpenAICustomProviderConfig
    | AnthropicCustomProviderConfig
    | AWSBedrockCustomProviderConfig
    | GoogleGenAICustomProviderConfig
    | UnparsableConfig
):
    """Parse the encrypted config based on the SDK type."""
    try:
        data = decrypt(encrypted_config)
    except ValueError:
        return UnparsableConfig(parse_error="Config cannot be decrypted")

    try:
        if sdk == "openai":
            openai_config = mp.OpenAICustomProviderConfig.model_validate_json(data)
            return OpenAICustomProviderConfig.from_orm(openai_config)
        elif sdk == "azure_openai":
            azure_config = mp.AzureOpenAICustomProviderConfig.model_validate_json(data)
            return AzureOpenAICustomProviderConfig.from_orm(azure_config)
        elif sdk == "anthropic":
            anthropic_config = mp.AnthropicCustomProviderConfig.model_validate_json(data)
            return AnthropicCustomProviderConfig.from_orm(anthropic_config)
        elif sdk == "aws_bedrock":
            bedrock_config = mp.AWSBedrockCustomProviderConfig.model_validate_json(data)
            return AWSBedrockCustomProviderConfig.from_orm(bedrock_config)
        elif sdk == "google_genai":
            google_config = mp.GoogleGenAICustomProviderConfig.model_validate_json(data)
            return GoogleGenAICustomProviderConfig.from_orm(google_config)
        else:
            assert_never(sdk)
    except ValidationError:
        return UnparsableConfig(parse_error="Config cannot be parsed")


@strawberry.type
class GenerativeModelCustomProvider(Node):
    id: NodeID[int]
    db_record: strawberry.Private[models.GenerativeModelCustomProvider | None] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("GenerativeModelCustomProvider ID mismatch")

    @strawberry.field(description="The name of this provider.")  # type: ignore
    async def name(self, info: Info[Context, None]) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.name),
            )
        return val

    @strawberry.field(description="The description of this provider.")  # type: ignore
    async def description(self, info: Info[Context, None]) -> str | None:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.description),
            )
        return val

    @strawberry.field(description="The provider of this provider.")  # type: ignore
    async def provider(self, info: Info[Context, None]) -> str:
        if self.db_record:
            val = self.db_record.provider
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.provider),
            )
        return val

    @strawberry.field(description="The creation timestamp of this provider.")  # type: ignore
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.created_at),
            )
        return val

    @strawberry.field(description="The last updated timestamp of this provider.")  # type: ignore
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.updated_at),
            )
        return val

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self, info: Info[Context, None]) -> GenerativeModelSDK:
        if self.db_record:
            sdk = self.db_record.sdk
        else:
            sdk = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.sdk),
            )
        return GenerativeModelSDK(sdk)

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(self, info: Info[Context, None]) -> CustomProviderConfig:
        if self.db_record:
            encrypted_config = self.db_record.config
            sdk = self.db_record.sdk
        else:
            # Load both config and sdk fields
            encrypted_config = (
                await info.context.data_loaders.generative_model_custom_provider_fields.load(
                    (self.id, models.GenerativeModelCustomProvider.config),
                )
            )
            sdk = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.sdk),
            )
        return _parse_config(sdk, encrypted_config, info.context.decrypt)

    @strawberry.field(description="The user that created this provider.")  # type: ignore
    async def user(
        self, info: Info[Context, None]
    ) -> Annotated["User", strawberry.lazy(".User")] | None:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)
