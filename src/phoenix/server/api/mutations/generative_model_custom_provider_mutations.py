from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
import strawberry
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from strawberry import UNSET, Info
from strawberry.scalars import JSON
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.model_provider import (
    AnthropicAuthenticationMethod,
    AnthropicClientKwargs,
    AnthropicCustomProviderConfig,
    AWSBedrockAuthenticationMethod,
    AWSBedrockClientKwargs,
    AWSBedrockCustomProviderConfig,
    AzureADTokenProvider,
    AzureOpenAIAuthenticationMethod,
    AzureOpenAIClientKwargs,
    AzureOpenAICustomProviderConfig,
    DeepSeekAuthenticationMethod,
    DeepSeekCustomProviderConfig,
    GenerativeModelCustomerProviderConfig,
    GoogleGenAIAuthenticationMethod,
    GoogleGenAIClientKwargs,
    GoogleGenAICustomProviderConfig,
    GoogleGenAIHttpOptions,
    OllamaCustomProviderConfig,
    OpenAIAuthenticationMethod,
    OpenAIClientKwargs,
    OpenAICustomProviderConfig,
    StringValue,
    StringValueLookup,
    XAIAuthenticationMethod,
    XAICustomProviderConfig,
)
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
    GenerativeModelCustomProviderAnthropic,
    GenerativeModelCustomProviderAWSBedrock,
    GenerativeModelCustomProviderAzureOpenAI,
    GenerativeModelCustomProviderDeepSeek,
    GenerativeModelCustomProviderGoogleGenAI,
    GenerativeModelCustomProviderOllama,
    GenerativeModelCustomProviderOpenAI,
    GenerativeModelCustomProviderXAI,
    parse_custom_provider_id,
)
from phoenix.server.bearer_auth import PhoenixUser


def _get_sdk_from_config(
    config: GenerativeModelCustomerProviderConfig,
) -> models.GenerativeModelCustomProviderSDK:
    """Determine the SDK type from a client configuration."""
    if isinstance(config.root, AWSBedrockCustomProviderConfig):
        return "aws_bedrock"
    if isinstance(config.root, GoogleGenAICustomProviderConfig):
        return "google_genai"
    if isinstance(config.root, AnthropicCustomProviderConfig):
        return "anthropic"
    if isinstance(config.root, OpenAICustomProviderConfig):
        return "openai"
    if isinstance(config.root, AzureOpenAICustomProviderConfig):
        return "azure_openai"
    if isinstance(config.root, OllamaCustomProviderConfig):
        return "openai"
    if isinstance(config.root, DeepSeekCustomProviderConfig):
        return "openai"
    if isinstance(config.root, XAICustomProviderConfig):
        return "openai"
    assert_never(config.root)


def _get_provider_class_from_config(
    config: GenerativeModelCustomerProviderConfig,
) -> (
    type[GenerativeModelCustomProviderOpenAI]
    | type[GenerativeModelCustomProviderAzureOpenAI]
    | type[GenerativeModelCustomProviderAnthropic]
    | type[GenerativeModelCustomProviderAWSBedrock]
    | type[GenerativeModelCustomProviderGoogleGenAI]
    | type[GenerativeModelCustomProviderOllama]
    | type[GenerativeModelCustomProviderDeepSeek]
    | type[GenerativeModelCustomProviderXAI]
):
    """Determine the GraphQL provider class from a client configuration."""
    if isinstance(config.root, AWSBedrockCustomProviderConfig):
        return GenerativeModelCustomProviderAWSBedrock
    if isinstance(config.root, GoogleGenAICustomProviderConfig):
        return GenerativeModelCustomProviderGoogleGenAI
    if isinstance(config.root, AnthropicCustomProviderConfig):
        return GenerativeModelCustomProviderAnthropic
    if isinstance(config.root, OpenAICustomProviderConfig):
        return GenerativeModelCustomProviderOpenAI
    if isinstance(config.root, AzureOpenAICustomProviderConfig):
        return GenerativeModelCustomProviderAzureOpenAI
    if isinstance(config.root, OllamaCustomProviderConfig):
        return GenerativeModelCustomProviderOllama
    if isinstance(config.root, DeepSeekCustomProviderConfig):
        return GenerativeModelCustomProviderDeepSeek
    if isinstance(config.root, XAICustomProviderConfig):
        return GenerativeModelCustomProviderXAI
    assert_never(config.root)


@strawberry.input(one_of=True)
class StringValueLookupOrStringValueInput:
    string_value_lookup_key: str | None = UNSET
    string_value: str | None = UNSET

    def __post_init__(self) -> None:
        if self.string_value_lookup_key is not UNSET:
            if not self.string_value_lookup_key or not self.string_value_lookup_key.strip():
                self.string_value_lookup_key = None
            else:
                self.string_value_lookup_key = self.string_value_lookup_key.strip()
        if self.string_value is not UNSET:
            if not self.string_value or not self.string_value.strip():
                self.string_value = None
            else:
                self.string_value = self.string_value.strip()
        if not self.string_value_lookup_key and not self.string_value:
            raise ValueError("Either string_value_lookup_key or string_value must be provided")
        if self.string_value_lookup_key and self.string_value:
            raise ValueError("Only one of string_value_lookup_key or string_value must be provided")

    def to_orm(self) -> StringValueLookup | StringValue | None:
        if self.string_value_lookup_key:
            return StringValueLookup(string_value_lookup_key=self.string_value_lookup_key)
        if self.string_value:
            return StringValue(string_value=self.string_value)
        raise ValueError("Either string_value_lookup_key or string_value must be provided")


@strawberry.input
class OpenAIAuthenticationMethodInput:
    api_key: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> OpenAIAuthenticationMethod:
        return OpenAIAuthenticationMethod(api_key=self.api_key.to_orm() if self.api_key else None)


@strawberry.input
class OpenAIClientKwargsInput:
    base_url: StringValueLookupOrStringValueInput | None = UNSET
    organization: StringValueLookupOrStringValueInput | None = UNSET
    project: StringValueLookupOrStringValueInput | None = UNSET
    default_headers: JSON | None = UNSET

    def to_orm(self) -> OpenAIClientKwargs:
        return OpenAIClientKwargs(
            base_url=self.base_url.to_orm() if self.base_url else None,
            organization=self.organization.to_orm() if self.organization else None,
            project=self.project.to_orm() if self.project else None,
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
    azure_tenant_id: StringValueLookupOrStringValueInput | None = UNSET
    azure_client_id: StringValueLookupOrStringValueInput | None = UNSET
    azure_client_secret: StringValueLookupOrStringValueInput | None = UNSET
    scope: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> AzureADTokenProvider:
        return AzureADTokenProvider(
            azure_tenant_id=self.azure_tenant_id.to_orm() if self.azure_tenant_id else None,
            azure_client_id=self.azure_client_id.to_orm() if self.azure_client_id else None,
            azure_client_secret=self.azure_client_secret.to_orm()
            if self.azure_client_secret
            else None,
            scope=self.scope.to_orm() if self.scope else None,
        )


@strawberry.input
class AzureOpenAIAuthenticationMethodInput:
    api_key: StringValueLookupOrStringValueInput | None = UNSET
    azure_ad_token: StringValueLookupOrStringValueInput | None = UNSET
    azure_ad_token_provider: AzureOpenAIADTokenProviderInput | None = UNSET

    def to_orm(self) -> AzureOpenAIAuthenticationMethod:
        return AzureOpenAIAuthenticationMethod(
            api_key=self.api_key.to_orm() if self.api_key else None,
            azure_ad_token=self.azure_ad_token.to_orm() if self.azure_ad_token else None,
            azure_ad_token_provider=self.azure_ad_token_provider.to_orm()
            if self.azure_ad_token_provider
            else None,
        )


@strawberry.input
class AzureOpenAIClientKwargsInput:
    azure_endpoint: StringValueLookupOrStringValueInput
    azure_deployment: StringValueLookupOrStringValueInput
    api_version: StringValueLookupOrStringValueInput
    default_headers: JSON | None = UNSET

    def to_orm(self) -> AzureOpenAIClientKwargs:
        return AzureOpenAIClientKwargs(
            api_version=self.api_version.to_orm(),
            azure_endpoint=self.azure_endpoint.to_orm(),
            azure_deployment=self.azure_deployment.to_orm(),
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
    api_key: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> AnthropicAuthenticationMethod:
        return AnthropicAuthenticationMethod(
            api_key=self.api_key.to_orm() if self.api_key else None
        )


@strawberry.input
class AnthropicClientKwargsInput:
    base_url: StringValueLookupOrStringValueInput | None = UNSET
    default_headers: JSON | None = UNSET

    def to_orm(self) -> AnthropicClientKwargs:
        return AnthropicClientKwargs(
            base_url=self.base_url.to_orm() if self.base_url else None,
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

    base_url: StringValueLookupOrStringValueInput | None = UNSET
    """The base URL for the AI platform service endpoint."""

    headers: JSON | None = UNSET
    """Additional HTTP headers to be sent with the request."""

    def to_orm(self) -> GoogleGenAIHttpOptions:
        return GoogleGenAIHttpOptions(
            base_url=self.base_url.to_orm() if self.base_url else None,
            headers=self.headers or None,
        )


@strawberry.input
class GoogleGenAIAuthenticationMethodInput:
    api_key: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> GoogleGenAIAuthenticationMethod:
        return GoogleGenAIAuthenticationMethod(
            api_key=self.api_key.to_orm() if self.api_key else None
        )


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
class AWSBedrockAuthenticationMethodInput:
    aws_access_key_id: StringValueLookupOrStringValueInput | None = UNSET
    aws_secret_access_key: StringValueLookupOrStringValueInput | None = UNSET
    aws_session_token: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> AWSBedrockAuthenticationMethod:
        return AWSBedrockAuthenticationMethod(
            aws_access_key_id=self.aws_access_key_id.to_orm() if self.aws_access_key_id else None,
            aws_secret_access_key=self.aws_secret_access_key.to_orm()
            if self.aws_secret_access_key
            else None,
            aws_session_token=self.aws_session_token.to_orm() if self.aws_session_token else None,
        )


@strawberry.input
class AWSBedrockClientKwargsInput:
    region_name: StringValueLookupOrStringValueInput
    endpoint_url: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> AWSBedrockClientKwargs:
        return AWSBedrockClientKwargs(
            region_name=self.region_name.to_orm(),
            endpoint_url=self.endpoint_url.to_orm() if self.endpoint_url else None,
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


@strawberry.input
class OllamaCustomProviderConfigInput:
    openai_client_kwargs: OpenAIClientKwargsInput | None = UNSET

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=OllamaCustomProviderConfig(
                openai_client_kwargs=self.openai_client_kwargs.to_orm()
                if self.openai_client_kwargs
                else None,
            )
        )


@strawberry.input
class DeepSeekAuthenticationMethodInput:
    api_key: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> DeepSeekAuthenticationMethod:
        return DeepSeekAuthenticationMethod(api_key=self.api_key.to_orm() if self.api_key else None)


@strawberry.input
class DeepSeekCustomProviderConfigInput:
    deepseek_authentication_method: DeepSeekAuthenticationMethodInput
    openai_client_kwargs: OpenAIClientKwargsInput | None = UNSET

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=DeepSeekCustomProviderConfig(
                deepseek_authentication_method=self.deepseek_authentication_method.to_orm(),
                openai_client_kwargs=self.openai_client_kwargs.to_orm()
                if self.openai_client_kwargs
                else None,
            )
        )


@strawberry.input
class XAIAuthenticationMethodInput:
    api_key: StringValueLookupOrStringValueInput | None = UNSET

    def to_orm(self) -> XAIAuthenticationMethod:
        return XAIAuthenticationMethod(api_key=self.api_key.to_orm() if self.api_key else None)


@strawberry.input
class XAICustomProviderConfigInput:
    xai_authentication_method: XAIAuthenticationMethodInput
    openai_client_kwargs: OpenAIClientKwargsInput | None = UNSET

    def to_orm(self) -> GenerativeModelCustomerProviderConfig:
        return GenerativeModelCustomerProviderConfig(
            root=XAICustomProviderConfig(
                xai_authentication_method=self.xai_authentication_method.to_orm(),
                openai_client_kwargs=self.openai_client_kwargs.to_orm()
                if self.openai_client_kwargs
                else None,
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
    ollama: Optional[OllamaCustomProviderConfigInput] = UNSET
    deepseek: Optional[DeepSeekCustomProviderConfigInput] = UNSET
    xai: Optional[XAICustomProviderConfigInput] = UNSET

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
                        self.ollama,
                        self.deepseek,
                        self.xai,
                    ],
                )
            )
            != 1
        ):
            raise ValueError(
                "Exactly one of openai, azure_openai, anthropic, aws_bedrock, "
                "google_genai, ollama, deepseek, or xai must be provided"
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
        if self.ollama:
            return self.ollama.to_orm()
        if self.deepseek:
            return self.deepseek.to_orm()
        if self.xai:
            return self.xai.to_orm()
        raise ValueError(
            "Exactly one of openai, azure_openai, anthropic, aws_bedrock, "
            "google_genai, ollama, deepseek, or xai must be provided"
        )


@strawberry.input
class CreateGenerativeModelCustomProviderMutationInput:
    name: str
    description: str | None = UNSET
    provider: str
    client_config: GenerativeModelCustomerProviderConfigInput

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("name must be provided")
        self.name = self.name.strip()
        if self.provider and not self.provider.strip():
            raise ValueError("provider must be provided")
        self.provider = self.provider.strip()

    def to_orm(self) -> models.GenerativeModelCustomProvider:
        config = self.client_config.to_orm()
        return models.GenerativeModelCustomProvider(
            name=self.name,
            description=self.description or None,
            provider=self.provider,
            sdk=_get_sdk_from_config(config),
            config=config,
        )


@strawberry.type
class CreateGenerativeModelCustomProviderMutationPayload:
    provider: GenerativeModelCustomProvider
    query: Query


@strawberry.input
class PatchGenerativeModelCustomProviderMutationInput:
    id: strawberry.relay.GlobalID
    name: str | None = UNSET
    description: str | None = UNSET
    provider: str | None = UNSET
    client_config: GenerativeModelCustomerProviderConfigInput | None = UNSET

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("id must be provided")
        if self.name:
            if not self.name.strip():
                raise ValueError("name must not be empty")
            self.name = self.name.strip()
        if self.provider:
            if not self.provider.strip():
                raise ValueError("provider must not be empty")
            self.provider = self.provider.strip()
        if self.description:
            self.description = self.description.strip()


@strawberry.type
class PatchGenerativeModelCustomProviderMutationPayload:
    provider: GenerativeModelCustomProvider
    query: Query


@strawberry.input
class DeleteGenerativeModelCustomProviderMutationInput:
    id: strawberry.relay.GlobalID


@strawberry.type
class DeleteGenerativeModelCustomProviderMutationPayload:
    deleted_provider_id: strawberry.relay.GlobalID
    query: Query


@strawberry.type
class GenerativeModelCustomProviderMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def create_generative_model_custom_provider(
        self,
        info: Info[Context, None],
        input: CreateGenerativeModelCustomProviderMutationInput,
    ) -> CreateGenerativeModelCustomProviderMutationPayload:
        # Get the config object before creating the provider
        config_obj = input.client_config.to_orm()
        # Serialize and encrypt the config
        config_json = config_obj.model_dump_json().encode("utf-8")
        encrypted_config = info.context.encrypt(config_json)

        assert isinstance(request := info.context.request, Request)
        user_id: int | None = None
        if "user" in request.scope and isinstance((user := info.context.user), PhoenixUser):
            user_id = int(user.identity)

        # Create the provider with encrypted config
        provider = models.GenerativeModelCustomProvider(
            name=input.name,
            description=input.description or None,
            provider=input.provider,
            sdk=_get_sdk_from_config(config_obj),
            config=encrypted_config,
            user_id=user_id,
        )

        try:
            async with info.context.db() as session:
                session.add(provider)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict(f"Provider with name '{input.name}' already exists")

        provider_class = _get_provider_class_from_config(config_obj)

        from typing import cast

        return CreateGenerativeModelCustomProviderMutationPayload(
            provider=cast(
                GenerativeModelCustomProvider, provider_class(id=provider.id, db_record=provider)
            ),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def patch_generative_model_custom_provider(
        self,
        info: Info[Context, None],
        input: PatchGenerativeModelCustomProviderMutationInput,
    ) -> PatchGenerativeModelCustomProviderMutationPayload:
        provider_id, provider_class = parse_custom_provider_id(input.id)

        async with info.context.db() as session:
            # Fetch the existing provider
            provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
            if not provider:
                raise NotFound(f"Provider with ID '{input.id}' not found")

            # Update fields if provided
            if input.name and input.name != provider.name:
                provider.name = input.name

            if input.description and input.description != provider.description:
                provider.description = input.description

            if input.provider and input.provider != provider.provider:
                provider.provider = input.provider

            if input.client_config:
                config = input.client_config.to_orm()
                if _get_provider_class_from_config(config) != provider_class:
                    raise BadRequest("Cannot change provider type")
                # Serialize and encrypt the config
                config_json = config.model_dump_json().encode("utf-8")
                provider.config = info.context.encrypt(config_json)

            if provider in session.dirty:
                provider.updated_at = datetime.now(timezone.utc)
                try:
                    await session.flush()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                    raise Conflict(f"Provider with name '{input.name}' already exists")

        return PatchGenerativeModelCustomProviderMutationPayload(
            provider=provider_class(id=provider.id, db_record=provider),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled, IsLocked]
    )  # type: ignore
    async def delete_generative_model_custom_provider(
        self,
        info: Info[Context, None],
        input: DeleteGenerativeModelCustomProviderMutationInput,
    ) -> DeleteGenerativeModelCustomProviderMutationPayload:
        provider_id, _ = parse_custom_provider_id(input.id)

        stmt = sa.delete(models.GenerativeModelCustomProvider).where(
            models.GenerativeModelCustomProvider.id == provider_id
        )
        async with info.context.db() as session:
            await session.execute(stmt)

        return DeleteGenerativeModelCustomProviderMutationPayload(
            deleted_provider_id=input.id,
            query=Query(),
        )
