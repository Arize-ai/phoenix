from datetime import datetime, timezone

import sqlalchemy as sa
import strawberry
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from strawberry import UNSET, Info
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.model_provider import (
    AnthropicCustomProviderConfig,
    AWSBedrockCustomProviderConfig,
    AzureOpenAICustomProviderConfig,
    GenerativeModelCustomerProviderConfig,
    GoogleGenAICustomProviderConfig,
    OpenAICustomProviderConfig,
)
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.input_types.GenerativeModelCustomerProviderConfigInput import (
    GenerativeModelCustomerProviderConfigInput,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
    GenerativeModelCustomProviderAnthropic,
    GenerativeModelCustomProviderAWSBedrock,
    GenerativeModelCustomProviderAzureOpenAI,
    GenerativeModelCustomProviderGoogleGenAI,
    GenerativeModelCustomProviderOpenAI,
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
    assert_never(config.root)


def _get_provider_class_from_config(
    config: GenerativeModelCustomerProviderConfig,
) -> (
    type[GenerativeModelCustomProviderOpenAI]
    | type[GenerativeModelCustomProviderAzureOpenAI]
    | type[GenerativeModelCustomProviderAnthropic]
    | type[GenerativeModelCustomProviderAWSBedrock]
    | type[GenerativeModelCustomProviderGoogleGenAI]
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
    assert_never(config.root)


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
        if not self.provider.strip():
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
    id: GlobalID


@strawberry.type
class DeleteGenerativeModelCustomProviderMutationPayload:
    id: GlobalID
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
            id=input.id,
            query=Query(),
        )
