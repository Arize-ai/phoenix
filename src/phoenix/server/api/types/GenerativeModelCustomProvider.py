from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Type

import strawberry
from pydantic import ValidationError
from strawberry import UNSET
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import Self, TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types import model_provider as mp
from phoenix.server.api.context import Context
from phoenix.server.api.types.node import from_global_id

if TYPE_CHECKING:
    from phoenix.server.api.types.User import User


@strawberry.type
class StringValueLookup:
    """Represents a value that should be looked up from a secret store."""

    string_value_lookup_key: str


@strawberry.type
class StringValue:
    """Represents a direct value."""

    string_value: str


def _from_orm(
    value: mp.StringValueLookup | mp.StringValue | None,
) -> StringValueLookup | StringValue | None:
    """Convert a StringStringValueLookup or StringValue to a GraphQL type."""
    if value is None:
        return None
    if isinstance(value, mp.StringValue):
        return StringValue(string_value=value.string_value)
    if isinstance(value, mp.StringValueLookup):
        return StringValueLookup(string_value_lookup_key=value.string_value_lookup_key)
    assert_never(value)


class GenerativeModelCustomProviderSDK(Enum):
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    ANTHROPIC = "anthropic"
    AWS_BEDROCK = "aws_bedrock"
    GOOGLE_GENAI = "google_genai"


class OpenAISDKClientInterface(Enum):
    CHAT = "chat"


class AnthropicSDKClientInterface(Enum):
    CHAT = "chat"


class AWSBedrockSDKClientInterface(Enum):
    CONVERSE = "converse"


class GoogleGenAISDKClientInterface(Enum):
    CHAT = "chat"


@strawberry.type
class UnparsableConfig:
    parse_error: str


@strawberry.type
class AzureADTokenProvider:
    azure_tenant_id: StringValueLookup | StringValue | None = UNSET
    azure_client_id: StringValueLookup | StringValue | None = UNSET
    azure_client_secret: StringValueLookup | StringValue | None = UNSET
    scope: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, provider: mp.AzureADTokenProvider | None) -> Self | None:
        if not provider:
            return None
        return cls(
            azure_tenant_id=_from_orm(provider.azure_tenant_id),
            azure_client_id=_from_orm(provider.azure_client_id),
            azure_client_secret=_from_orm(provider.azure_client_secret),
            scope=_from_orm(provider.scope),
        )


@strawberry.type
class OpenAIAuthenticationMethod:
    api_key: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.OpenAIAuthenticationMethod) -> Self:
        return cls(api_key=_from_orm(method.api_key))


@strawberry.type
class OpenAIClientKwargs:
    base_url: StringValueLookup | StringValue | None = UNSET
    organization: StringValueLookup | StringValue | None = UNSET
    project: StringValueLookup | StringValue | None = UNSET
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.OpenAIClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            base_url=_from_orm(kwargs.base_url),
            organization=_from_orm(kwargs.organization),
            project=_from_orm(kwargs.project),
            default_headers=kwargs.default_headers,
        )


@strawberry.type
class OpenAICustomProviderConfig:
    supports_streaming: bool
    openai_authentication_method: OpenAIAuthenticationMethod
    openai_client_kwargs: OpenAIClientKwargs | None = UNSET
    openai_client_interface: OpenAISDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.OpenAICustomProviderConfig) -> Self:
        return cls(
            openai_client_interface=OpenAISDKClientInterface(config.openai_client_interface),
            supports_streaming=config.supports_streaming,
            openai_authentication_method=OpenAIAuthenticationMethod.from_orm(
                config.openai_authentication_method
            ),
            openai_client_kwargs=(OpenAIClientKwargs.from_orm(config.openai_client_kwargs)),
        )


@strawberry.type
class AzureOpenAIAuthenticationMethod:
    api_key: StringValueLookup | StringValue | None = UNSET
    azure_ad_token: StringValueLookup | StringValue | None = UNSET
    azure_ad_token_provider: AzureADTokenProvider | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AzureOpenAIAuthenticationMethod) -> Self:
        azure_ad_token_provider = None
        if method.azure_ad_token_provider:
            azure_ad_token_provider = AzureADTokenProvider.from_orm(method.azure_ad_token_provider)
        return cls(
            api_key=_from_orm(method.api_key),
            azure_ad_token=_from_orm(method.azure_ad_token),
            azure_ad_token_provider=azure_ad_token_provider,
        )


@strawberry.type
class AzureOpenAIClientKwargs:
    api_version: StringValueLookup | StringValue | None = UNSET
    azure_endpoint: StringValueLookup | StringValue | None = UNSET
    azure_deployment: StringValueLookup | StringValue | None = UNSET
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AzureOpenAIClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            api_version=_from_orm(kwargs.api_version),
            azure_endpoint=_from_orm(kwargs.azure_endpoint),
            azure_deployment=_from_orm(kwargs.azure_deployment),
            default_headers=kwargs.default_headers,
        )


@strawberry.type
class AzureOpenAICustomProviderConfig:
    supports_streaming: bool
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethod
    azure_openai_client_kwargs: AzureOpenAIClientKwargs | None = UNSET
    azure_openai_client_interface: OpenAISDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.AzureOpenAICustomProviderConfig) -> Self:
        return cls(
            azure_openai_client_interface=OpenAISDKClientInterface(
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
    api_key: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AnthropicAuthenticationMethod) -> Self:
        return cls(api_key=_from_orm(method.api_key))


@strawberry.type
class AnthropicClientKwargs:
    base_url: StringValueLookup | StringValue | None = UNSET
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AnthropicClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            base_url=_from_orm(kwargs.base_url),
            default_headers=kwargs.default_headers,
        )


@strawberry.type
class AnthropicCustomProviderConfig:
    supports_streaming: bool
    anthropic_authentication_method: AnthropicAuthenticationMethod
    anthropic_client_kwargs: AnthropicClientKwargs | None = UNSET
    anthropic_client_interface: AnthropicSDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.AnthropicCustomProviderConfig) -> Self:
        return cls(
            anthropic_client_interface=AnthropicSDKClientInterface(
                config.anthropic_client_interface
            ),
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
    aws_access_key_id: StringValueLookup | StringValue | None = UNSET
    aws_secret_access_key: StringValueLookup | StringValue | None = UNSET
    aws_session_token: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AWSBedrockAuthenticationMethod) -> Self:
        return cls(
            aws_access_key_id=_from_orm(method.aws_access_key_id),
            aws_secret_access_key=_from_orm(method.aws_secret_access_key),
            aws_session_token=_from_orm(method.aws_session_token),
        )


@strawberry.type
class AWSBedrockClientKwargs:
    region_name: StringValueLookup | StringValue | None = UNSET
    endpoint_url: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AWSBedrockClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            region_name=_from_orm(kwargs.region_name),
            endpoint_url=_from_orm(kwargs.endpoint_url),
        )


@strawberry.type
class AWSBedrockCustomProviderConfig:
    supports_streaming: bool
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethod
    aws_bedrock_client_kwargs: AWSBedrockClientKwargs | None = UNSET
    aws_bedrock_client_interface: AWSBedrockSDKClientInterface

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
            aws_bedrock_client_interface=AWSBedrockSDKClientInterface(
                config.aws_bedrock_client_interface
            ),
        )


@strawberry.type
class GoogleGenAIAuthenticationMethod:
    api_key: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.GoogleGenAIAuthenticationMethod) -> Self:
        return cls(api_key=_from_orm(method.api_key))


@strawberry.type
class GoogleGenAIHttpOptions:
    base_url: StringValueLookup | StringValue | None = UNSET
    headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, http_options: mp.GoogleGenAIHttpOptions | None) -> Self | None:
        if not http_options:
            return None
        return cls(
            base_url=_from_orm(http_options.base_url),
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
    google_genai_client_interface: GoogleGenAISDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.GoogleGenAICustomProviderConfig) -> Self:
        return cls(
            google_genai_client_interface=GoogleGenAISDKClientInterface(
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


@strawberry.type
class OllamaCustomProviderConfig:
    supports_streaming: bool
    openai_client_kwargs: OpenAIClientKwargs | None = UNSET
    openai_client_interface: OpenAISDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.OllamaCustomProviderConfig) -> Self:
        return cls(
            openai_client_interface=OpenAISDKClientInterface(config.openai_client_interface),
            supports_streaming=config.supports_streaming,
            openai_client_kwargs=(OpenAIClientKwargs.from_orm(config.openai_client_kwargs)),
        )


@strawberry.type
class DeepSeekAuthenticationMethod:
    api_key: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.DeepSeekAuthenticationMethod) -> Self:
        return cls(api_key=_from_orm(method.api_key))


@strawberry.type
class DeepSeekCustomProviderConfig:
    supports_streaming: bool
    deepseek_authentication_method: DeepSeekAuthenticationMethod
    openai_client_kwargs: OpenAIClientKwargs | None = UNSET
    openai_client_interface: OpenAISDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.DeepSeekCustomProviderConfig) -> Self:
        return cls(
            openai_client_interface=OpenAISDKClientInterface(config.openai_client_interface),
            supports_streaming=config.supports_streaming,
            deepseek_authentication_method=DeepSeekAuthenticationMethod.from_orm(
                config.deepseek_authentication_method
            ),
            openai_client_kwargs=OpenAIClientKwargs.from_orm(config.openai_client_kwargs),
        )


@strawberry.type
class XAIAuthenticationMethod:
    api_key: StringValueLookup | StringValue | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.XAIAuthenticationMethod) -> Self:
        return cls(api_key=_from_orm(method.api_key))


@strawberry.type
class XAICustomProviderConfig:
    supports_streaming: bool
    xai_authentication_method: XAIAuthenticationMethod
    openai_client_kwargs: OpenAIClientKwargs | None = UNSET
    openai_client_interface: OpenAISDKClientInterface

    @classmethod
    def from_orm(cls, config: mp.XAICustomProviderConfig) -> Self:
        return cls(
            openai_client_interface=OpenAISDKClientInterface(config.openai_client_interface),
            supports_streaming=config.supports_streaming,
            xai_authentication_method=XAIAuthenticationMethod.from_orm(
                config.xai_authentication_method
            ),
            openai_client_kwargs=OpenAIClientKwargs.from_orm(config.openai_client_kwargs),
        )


@strawberry.interface
class GenerativeModelCustomProvider(Node):
    @strawberry.field(description="The name of this provider.")  # type: ignore
    async def name(self) -> str:
        raise NotImplementedError

    @strawberry.field(description="The description of this provider.")  # type: ignore
    async def description(self) -> str | None:
        raise NotImplementedError

    @strawberry.field(description="The provider of this provider.")  # type: ignore
    async def provider(self) -> str:
        raise NotImplementedError

    @strawberry.field(description="The creation timestamp of this provider.")  # type: ignore
    async def created_at(self) -> datetime:
        raise NotImplementedError

    @strawberry.field(description="The last updated timestamp of this provider.")  # type: ignore
    async def updated_at(self) -> datetime:
        raise NotImplementedError

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        raise NotImplementedError

    @strawberry.field(description="The user that created this provider.")  # type: ignore
    async def user(self) -> Annotated["User", strawberry.lazy(".User")] | None:
        raise NotImplementedError


@strawberry.type
class GenerativeModelCustomProviderOpenAI(GenerativeModelCustomProvider):
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

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> OpenAICustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.OpenAICustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return OpenAICustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.OPENAI

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


@strawberry.type
class GenerativeModelCustomProviderAzureOpenAI(GenerativeModelCustomProvider):
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

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> AzureOpenAICustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.AzureOpenAICustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return AzureOpenAICustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.AZURE_OPENAI

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


@strawberry.type
class GenerativeModelCustomProviderAnthropic(GenerativeModelCustomProvider):
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

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> AnthropicCustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.AnthropicCustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return AnthropicCustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.ANTHROPIC

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


@strawberry.type
class GenerativeModelCustomProviderAWSBedrock(GenerativeModelCustomProvider):
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

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> AWSBedrockCustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.AWSBedrockCustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return AWSBedrockCustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.AWS_BEDROCK

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


@strawberry.type
class GenerativeModelCustomProviderGoogleGenAI(GenerativeModelCustomProvider):
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

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> GoogleGenAICustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.GoogleGenAICustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return GoogleGenAICustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.GOOGLE_GENAI

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


@strawberry.type
class GenerativeModelCustomProviderOllama(GenerativeModelCustomProvider):
    id: NodeID[int]
    db_record: strawberry.Private[models.GenerativeModelCustomProvider | None] = None

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

    @strawberry.field(description="The created at timestamp of this provider.")  # type: ignore
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.created_at),
            )
        return val

    @strawberry.field(description="The updated at timestamp of this provider.")  # type: ignore
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.updated_at),
            )
        return val

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> OllamaCustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.OllamaCustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return OllamaCustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.OPENAI

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


@strawberry.type
class GenerativeModelCustomProviderDeepSeek(GenerativeModelCustomProvider):
    id: NodeID[int]
    db_record: strawberry.Private[models.GenerativeModelCustomProvider | None] = None

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

    @strawberry.field(description="The created at timestamp of this provider.")  # type: ignore
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.created_at),
            )
        return val

    @strawberry.field(description="The updated at timestamp of this provider.")  # type: ignore
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.updated_at),
            )
        return val

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(
        self, info: Info[Context, None]
    ) -> DeepSeekCustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.DeepSeekCustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return DeepSeekCustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.OPENAI

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


@strawberry.type
class GenerativeModelCustomProviderXAI(GenerativeModelCustomProvider):
    id: NodeID[int]
    db_record: strawberry.Private[models.GenerativeModelCustomProvider | None] = None

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

    @strawberry.field(description="The created at timestamp of this provider.")  # type: ignore
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.created_at),
            )
        return val

    @strawberry.field(description="The updated at timestamp of this provider.")  # type: ignore
    async def updated_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.updated_at),
            )
        return val

    @strawberry.field(description="The config of this provider.")  # type: ignore
    async def config(self, info: Info[Context, None]) -> XAICustomProviderConfig | UnparsableConfig:
        if self.db_record:
            val = self.db_record.config
        else:
            val = await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.config),
            )
        try:
            data = info.context.decrypt(val)
        except ValueError:
            return UnparsableConfig(parse_error="Config cannot be decrypted")
        try:
            config = mp.XAICustomProviderConfig.model_validate_json(data)
        except ValidationError:
            return UnparsableConfig(parse_error="Config cannot be parsed")
        return XAICustomProviderConfig.from_orm(config)

    @strawberry.field(description="The SDK of this provider.")  # type: ignore
    async def sdk(self) -> GenerativeModelCustomProviderSDK:
        return GenerativeModelCustomProviderSDK.OPENAI

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


GenerativeModelCustomProviderType: TypeAlias = (
    Type[GenerativeModelCustomProviderOpenAI]
    | Type[GenerativeModelCustomProviderAzureOpenAI]
    | Type[GenerativeModelCustomProviderAnthropic]
    | Type[GenerativeModelCustomProviderAWSBedrock]
    | Type[GenerativeModelCustomProviderGoogleGenAI]
    | Type[GenerativeModelCustomProviderOllama]
    | Type[GenerativeModelCustomProviderDeepSeek]
    | Type[GenerativeModelCustomProviderXAI]
)


def parse_custom_provider_id(global_id: GlobalID) -> tuple[int, GenerativeModelCustomProviderType]:
    """
    Parse provider ID accepting any concrete GenerativeModelCustomProvider type.

    Returns:
        A tuple containing the provider ID as an integer and the provider class.
    """
    type_name, provider_id = from_global_id(global_id)

    # Map type names to provider classes
    provider_classes: dict[str, GenerativeModelCustomProviderType] = {
        GenerativeModelCustomProviderOpenAI.__name__: GenerativeModelCustomProviderOpenAI,
        GenerativeModelCustomProviderAzureOpenAI.__name__: GenerativeModelCustomProviderAzureOpenAI,
        GenerativeModelCustomProviderAnthropic.__name__: GenerativeModelCustomProviderAnthropic,
        GenerativeModelCustomProviderAWSBedrock.__name__: GenerativeModelCustomProviderAWSBedrock,
        GenerativeModelCustomProviderGoogleGenAI.__name__: GenerativeModelCustomProviderGoogleGenAI,
        GenerativeModelCustomProviderOllama.__name__: GenerativeModelCustomProviderOllama,
        GenerativeModelCustomProviderDeepSeek.__name__: GenerativeModelCustomProviderDeepSeek,
        GenerativeModelCustomProviderXAI.__name__: GenerativeModelCustomProviderXAI,
    }

    cls = provider_classes.get(type_name)
    if cls is None:
        raise ValueError(
            f"Invalid provider type: {type_name}. Expected one of "
            f"{', '.join(provider_classes.keys())}"
        )
    return provider_id, cls
