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
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.types.DecisionSDK import DecisionSDK
from phoenix.server.api.types.GenerativeProvider import (
    CONFIG_TYPE_TO_GENERATIVE_PROVIDER_KEY,
    GenerativeProviderKey,
)
from phoenix.server.api.types.ModelType import ModelType
from phoenix.server.api.types.RedactedString import RedactedString

if TYPE_CHECKING:
    from phoenix.server.api.types.User import User


class GenerativeModelSDK(Enum):
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    ANTHROPIC = "anthropic"
    AWS_BEDROCK = "aws_bedrock"
    GOOGLE_GENAI = "google_genai"
    TYPESAFE = "typesafe"


@strawberry.type
class UnparsableConfig:
    parse_error: str


@strawberry.type(
    description=(
        "Where a custom provider's decision models run. They reuse the provider's API key "
        "and headers."
    )
)
class DecisionModelsConfig:
    decision_sdk: DecisionSDK
    base_url: str | None = strawberry.field(
        description="The configured decision base URL; null uses the chat base URL."
    )
    model_names: list[str] = strawberry.field(description="Suggested decision model names.")

    @classmethod
    def from_orm(
        cls,
        decision_sdk: models.DecisionSDK | None,
        config: mp.DecisionModelsConfig | None,
    ) -> Self | None:
        if decision_sdk is None:
            return None
        return cls(
            decision_sdk=DecisionSDK(decision_sdk),
            base_url=config.base_url if config else None,
            model_names=list(config.model_names) if config else [],
        )


@strawberry.type
class AzureADTokenProvider:
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: RedactedString
    scope: str

    @classmethod
    def from_orm(cls, provider: mp.AuthenticationMethodAzureADTokenProvider) -> Self:
        return cls(
            azure_tenant_id=provider.azure_tenant_id,
            azure_client_id=provider.azure_client_id,
            azure_client_secret=RedactedString(provider.azure_client_secret),
            scope=provider.scope,
        )


@strawberry.type
class OpenAIAuthenticationMethod:
    api_key: RedactedString | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.OpenAIAuthenticationMethod) -> Self:
        return cls(api_key=RedactedString(method.api_key))


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
            default_headers=JSON(kwargs.default_headers)
            if kwargs.default_headers is not None
            else None,
        )


@strawberry.type
class OpenAICustomProviderConfig:
    openai_authentication_method: OpenAIAuthenticationMethod
    openai_client_kwargs: OpenAIClientKwargs | None = UNSET
    openai_api_type: OpenAIApiType
    model_names: list[str] = strawberry.field(
        description=("Suggested LLM model names; empty lists the SDK's built-in models instead.")
    )
    decision_models: DecisionModelsConfig | None = None

    @classmethod
    def from_orm(
        cls,
        config: mp.OpenAICustomProviderConfig,
        decision_sdk: models.DecisionSDK | None = None,
    ) -> Self:
        return cls(
            decision_models=DecisionModelsConfig.from_orm(decision_sdk, config.decision_models),
            openai_authentication_method=OpenAIAuthenticationMethod.from_orm(
                config.openai_authentication_method
            ),
            openai_client_kwargs=OpenAIClientKwargs.from_orm(config.openai_client_kwargs),
            openai_api_type=OpenAIApiType(config.openai_api_type),
            model_names=list(config.model_names),
        )


@strawberry.type
class AzureOpenAIAuthenticationMethod:
    api_key: RedactedString | None = UNSET
    azure_ad_token_provider: AzureADTokenProvider | None = UNSET
    default_credentials: bool | None = strawberry.field(
        default=UNSET,
        description="Use SDK default credentials (Managed Identity, Azure CLI, env vars).",
    )

    @classmethod
    def from_orm(cls, method: mp.AzureOpenAIAuthenticationMethod) -> Self:
        if method.type == "api_key":
            return cls(
                api_key=RedactedString(method.api_key),
                azure_ad_token_provider=None,
                default_credentials=None,
            )
        if method.type == "azure_ad_token_provider":
            return cls(
                api_key=None,
                azure_ad_token_provider=AzureADTokenProvider.from_orm(method),
                default_credentials=None,
            )
        if method.type == "default_credentials":
            return cls(
                api_key=None,
                azure_ad_token_provider=None,
                default_credentials=True,
            )
        assert_never(method.type)


@strawberry.type
class AzureOpenAIClientKwargs:
    azure_endpoint: str
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.AzureOpenAIClientKwargs) -> Self:
        return cls(
            azure_endpoint=kwargs.azure_endpoint,
            default_headers=JSON(kwargs.default_headers)
            if kwargs.default_headers is not None
            else None,
        )


@strawberry.type
class AzureOpenAICustomProviderConfig:
    azure_openai_authentication_method: AzureOpenAIAuthenticationMethod
    azure_openai_client_kwargs: AzureOpenAIClientKwargs
    openai_api_type: OpenAIApiType
    model_names: list[str] = strawberry.field(
        description=("Suggested LLM model names; empty lists the SDK's built-in models instead.")
    )
    decision_models: DecisionModelsConfig | None = None

    @classmethod
    def from_orm(
        cls,
        config: mp.AzureOpenAICustomProviderConfig,
        decision_sdk: models.DecisionSDK | None = None,
    ) -> Self:
        return cls(
            decision_models=DecisionModelsConfig.from_orm(decision_sdk, config.decision_models),
            azure_openai_authentication_method=AzureOpenAIAuthenticationMethod.from_orm(
                config.azure_openai_authentication_method
            ),
            azure_openai_client_kwargs=AzureOpenAIClientKwargs.from_orm(
                config.azure_openai_client_kwargs
            ),
            openai_api_type=OpenAIApiType(config.openai_api_type),
            model_names=list(config.model_names),
        )


@strawberry.type
class AnthropicAuthenticationMethod:
    api_key: RedactedString | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AnthropicAuthenticationMethod) -> Self:
        return cls(api_key=RedactedString(method.api_key))


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
            default_headers=JSON(kwargs.default_headers)
            if kwargs.default_headers is not None
            else None,
        )


@strawberry.type
class AnthropicCustomProviderConfig:
    anthropic_authentication_method: AnthropicAuthenticationMethod
    anthropic_client_kwargs: AnthropicClientKwargs | None = UNSET
    model_names: list[str] = strawberry.field(
        description=("Suggested LLM model names; empty lists the SDK's built-in models instead.")
    )

    @classmethod
    def from_orm(cls, config: mp.AnthropicCustomProviderConfig) -> Self:
        return cls(
            anthropic_authentication_method=AnthropicAuthenticationMethod.from_orm(
                config.anthropic_authentication_method
            ),
            anthropic_client_kwargs=AnthropicClientKwargs.from_orm(config.anthropic_client_kwargs),
            model_names=list(config.model_names),
        )


@strawberry.type
class AWSBedrockAccessKeys:
    """AWS access key credentials."""

    aws_access_key_id: str
    aws_secret_access_key: RedactedString
    aws_session_token: RedactedString | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.AWSBedrockAuthenticationMethodAccessKeys) -> Self:
        return cls(
            aws_access_key_id=method.aws_access_key_id,
            aws_secret_access_key=RedactedString(method.aws_secret_access_key),
            aws_session_token=(
                RedactedString(method.aws_session_token)
                if method.aws_session_token is not None
                else None
            ),
        )


@strawberry.type
class AWSBedrockAuthenticationMethod:
    access_keys: AWSBedrockAccessKeys | None = strawberry.field(
        default=UNSET,
        description="Explicit AWS access key credentials.",
    )
    default_credentials: bool | None = strawberry.field(
        default=UNSET,
        description="Use SDK default credentials (IAM role, env vars, config files).",
    )

    @classmethod
    def from_orm(cls, method: mp.AWSBedrockAuthenticationMethod) -> Self:
        if method.type == "access_keys":
            return cls(
                access_keys=AWSBedrockAccessKeys.from_orm(method),
                default_credentials=None,
            )
        if method.type == "default_credentials":
            return cls(
                access_keys=None,
                default_credentials=True,
            )
        assert_never(method.type)


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
    aws_bedrock_authentication_method: AWSBedrockAuthenticationMethod
    aws_bedrock_client_kwargs: AWSBedrockClientKwargs
    model_names: list[str] = strawberry.field(
        description=("Suggested LLM model names; empty lists the SDK's built-in models instead.")
    )

    @classmethod
    def from_orm(cls, config: mp.AWSBedrockCustomProviderConfig) -> Self:
        return cls(
            aws_bedrock_authentication_method=AWSBedrockAuthenticationMethod.from_orm(
                config.aws_bedrock_authentication_method
            ),
            aws_bedrock_client_kwargs=AWSBedrockClientKwargs.from_orm(
                config.aws_bedrock_client_kwargs
            ),
            model_names=list(config.model_names),
        )


@strawberry.type
class GoogleGenAIAuthenticationMethod:
    api_key: RedactedString | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.GoogleGenAIAuthenticationMethod) -> Self:
        return cls(api_key=RedactedString(method.api_key))


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
            headers=JSON(dict(http_options.headers)) if http_options.headers else None,
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
    google_genai_authentication_method: GoogleGenAIAuthenticationMethod
    google_genai_client_kwargs: GoogleGenAIClientKwargs | None = UNSET
    model_names: list[str] = strawberry.field(
        description=("Suggested LLM model names; empty lists the SDK's built-in models instead.")
    )

    @classmethod
    def from_orm(cls, config: mp.GoogleGenAICustomProviderConfig) -> Self:
        return cls(
            google_genai_authentication_method=GoogleGenAIAuthenticationMethod.from_orm(
                config.google_genai_authentication_method
            ),
            google_genai_client_kwargs=GoogleGenAIClientKwargs.from_orm(
                config.google_genai_client_kwargs
            ),
            model_names=list(config.model_names),
        )


@strawberry.type
class TypeSafeAuthenticationMethod:
    api_key: RedactedString | None = UNSET

    @classmethod
    def from_orm(cls, method: mp.TypeSafeAuthenticationMethod) -> Self:
        return cls(api_key=RedactedString(method.api_key))


@strawberry.type
class TypeSafeClientKwargs:
    base_url: str | None = UNSET
    default_headers: JSON | None = UNSET

    @classmethod
    def from_orm(cls, kwargs: mp.TypeSafeClientKwargs | None) -> Self | None:
        if not kwargs:
            return None
        return cls(
            base_url=kwargs.base_url,
            default_headers=JSON(dict(kwargs.default_headers))
            if kwargs.default_headers is not None
            else None,
        )


@strawberry.type(description="A System One-compatible endpoint; it serves decision models only.")
class TypeSafeCustomProviderConfig:
    typesafe_authentication_method: TypeSafeAuthenticationMethod
    typesafe_client_kwargs: TypeSafeClientKwargs | None = UNSET
    decision_models: DecisionModelsConfig | None = None

    @classmethod
    def from_orm(
        cls,
        config: mp.TypeSafeCustomProviderConfig,
        decision_sdk: models.DecisionSDK | None = "typesafe",
    ) -> Self:
        return cls(
            decision_models=DecisionModelsConfig.from_orm(decision_sdk, config.decision_models),
            typesafe_authentication_method=TypeSafeAuthenticationMethod.from_orm(
                config.typesafe_authentication_method
            ),
            typesafe_client_kwargs=TypeSafeClientKwargs.from_orm(config.typesafe_client_kwargs),
        )


# Union type for polymorphic config field
CustomProviderConfig = Annotated[
    Union[
        OpenAICustomProviderConfig,
        AzureOpenAICustomProviderConfig,
        AnthropicCustomProviderConfig,
        AWSBedrockCustomProviderConfig,
        GoogleGenAICustomProviderConfig,
        TypeSafeCustomProviderConfig,
        UnparsableConfig,
    ],
    strawberry.union("CustomProviderConfig"),
]


def _parse_config(
    sdk: models.GenerativeModelSDK,
    encrypted_config: bytes,
    decrypt: Callable[[bytes], bytes],
    decision_sdk: models.DecisionSDK | None = None,
) -> CustomProviderConfig:
    """Parse the encrypted config based on the SDK type."""
    try:
        data = decrypt(encrypted_config)
    except ValueError:
        return UnparsableConfig(parse_error="Config cannot be decrypted")

    try:
        if sdk == "openai":
            openai_config = mp.OpenAICustomProviderConfig.model_validate_json(data)
            return OpenAICustomProviderConfig.from_orm(openai_config, decision_sdk)
        elif sdk == "azure_openai":
            azure_config = mp.AzureOpenAICustomProviderConfig.model_validate_json(data)
            return AzureOpenAICustomProviderConfig.from_orm(azure_config, decision_sdk)
        elif sdk == "anthropic":
            anthropic_config = mp.AnthropicCustomProviderConfig.model_validate_json(data)
            return AnthropicCustomProviderConfig.from_orm(anthropic_config)
        elif sdk == "aws_bedrock":
            bedrock_config = mp.AWSBedrockCustomProviderConfig.model_validate_json(data)
            return AWSBedrockCustomProviderConfig.from_orm(bedrock_config)
        elif sdk == "google_genai":
            google_config = mp.GoogleGenAICustomProviderConfig.model_validate_json(data)
            return GoogleGenAICustomProviderConfig.from_orm(google_config)
        elif sdk == "typesafe":
            typesafe_config = mp.TypeSafeCustomProviderConfig.model_validate_json(data)
            return TypeSafeCustomProviderConfig.from_orm(typesafe_config, decision_sdk)
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
        return await self._config(info)

    async def _config(self, info: Info[Context, None]) -> CustomProviderConfig:
        if self.db_record:
            sdk = self.db_record.sdk
            encrypted_config = self.db_record.config
            decision_sdk = self.db_record.decision_sdk
        else:
            (
                sdk,
                encrypted_config,
                decision_sdk,
            ) = await info.context.data_loaders.generative_model_custom_provider_fields.load_many(
                [
                    (self.id, models.GenerativeModelCustomProvider.sdk),
                    (self.id, models.GenerativeModelCustomProvider.config),
                    (self.id, models.GenerativeModelCustomProvider.decision_sdk),
                ]
            )
        return _parse_config(sdk, encrypted_config, info.context.decrypt, decision_sdk)

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

    async def _sdk(self, info: Info[Context, None]) -> models.GenerativeModelSDK:
        if self.db_record:
            return self.db_record.sdk
        sdk: models.GenerativeModelSDK = (
            await info.context.data_loaders.generative_model_custom_provider_fields.load(
                (self.id, models.GenerativeModelCustomProvider.sdk),
            )
        )
        return sdk

    async def _decision_sdk(self, info: Info[Context, None]) -> models.DecisionSDK | None:
        if self.db_record:
            return self.db_record.decision_sdk
        decision_sdk: (
            models.DecisionSDK | None
        ) = await info.context.data_loaders.generative_model_custom_provider_fields.load(
            (self.id, models.GenerativeModelCustomProvider.decision_sdk),
        )
        return decision_sdk

    @strawberry.field(
        description=(
            "The client this provider's decision models run through; null when it serves "
            "none. A decision made on it is saved with this client's model provider."
        )
    )  # type: ignore
    async def decision_sdk(self, info: Info[Context, None]) -> DecisionSDK | None:
        decision_sdk = await self._decision_sdk(info)
        return DecisionSDK(decision_sdk) if decision_sdk is not None else None

    @strawberry.field(
        description=(
            "The model types this provider can serve: chat (LLM) models, decision models, "
            "or both. Chat comes from its SDK; decision models from its decision client."
        )
    )  # type: ignore
    async def model_types(self, info: Info[Context, None]) -> list[ModelType]:
        model_types: list[ModelType] = []
        if mp.sdk_offers_chat(await self._sdk(info)):
            model_types.append(ModelType.LLM)
        if await self._decision_sdk(info) is not None:
            model_types.append(ModelType.DECISION)
        return model_types

    @strawberry.field(
        description=(
            "Suggested model names for this provider and model type; empty when it serves "
            "no models of that type. Any model name the endpoint accepts can be used."
        )
    )  # type: ignore
    async def model_names(
        self, info: Info[Context, None], model_type: ModelType = ModelType.LLM
    ) -> list[str]:
        sdk = await self._sdk(info)
        if model_type is ModelType.DECISION:
            from phoenix.server.api.helpers.decision_clients import DECISION_CLIENTS

            if (decision_sdk := await self._decision_sdk(info)) is None:
                return []
            config = await self._config(info)
            decision_models = getattr(config, "decision_models", None)
            if isinstance(decision_models, DecisionModelsConfig) and decision_models.model_names:
                return decision_models.model_names
            key = (
                GenerativeProviderKey.OPENAI
                if decision_sdk == "openai"
                else GenerativeProviderKey.TYPESAFE
            )
            return list(DECISION_CLIENTS[key].model_names)
        if not mp.sdk_offers_chat(sdk):
            return []
        # Suggested names replace the built-in list; an unparsable config has none.
        llm_model_names: list[str] = getattr(await self._config(info), "model_names", [])
        if llm_model_names:
            return llm_model_names
        return PLAYGROUND_CLIENT_REGISTRY.list_models(CONFIG_TYPE_TO_GENERATIVE_PROVIDER_KEY[sdk])
