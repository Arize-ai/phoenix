from datetime import datetime, timezone
from typing import Mapping, Sequence

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
from phoenix.server.api.auth import (
    IsAdminIfAuthEnabled,
    IsLocked,
    IsNotReadOnly,
    IsNotViewer,
)
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.input_types.GenerativeModelCustomerProviderConfigInput import (
    GenerativeModelCustomerProviderConfigInput,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


def _get_sdk_from_config(
    config: GenerativeModelCustomerProviderConfig,
) -> models.GenerativeModelSDK:
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


# openai and azure_openai use the same underlying SDK, so switching between them is safe.
# All other SDKs have different invocation parameters and are incompatible.
_COMPATIBLE_SDKS: Mapping[models.GenerativeModelSDK, Sequence[models.GenerativeModelSDK]] = {
    "openai": ("azure_openai",),
    "azure_openai": ("openai",),
}


def _are_sdks_compatible(
    old_sdk: models.GenerativeModelSDK, new_sdk: models.GenerativeModelSDK
) -> bool:
    """
    Check if switching from one SDK to another is compatible.

    Compatible switches:
    - Same SDK (no change)
    - openai ↔ azure_openai (same underlying SDK)

    Incompatible switches (will break existing prompts):
    - Any SDK → anthropic, google_genai, aws_bedrock (and vice versa)
    """
    if old_sdk == new_sdk:
        return True
    return new_sdk in _COMPATIBLE_SDKS.get(old_sdk, ())


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

        return CreateGenerativeModelCustomProviderMutationPayload(
            provider=GenerativeModelCustomProvider(id=provider.id, db_record=provider),
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
        try:
            provider_id = from_global_id_with_expected_type(
                input.id, GenerativeModelCustomProvider.__name__
            )
        except ValueError:
            raise BadRequest(f'Invalid provider id: "{input.id}"')

        async with info.context.db() as session:
            # Fetch the existing provider
            provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
            if not provider:
                raise NotFound(f"Provider with ID '{input.id}' not found")

            # Update fields if provided
            if input.name and input.name != provider.name:
                provider.name = input.name

            if input.description is not UNSET and input.description != provider.description:
                provider.description = input.description

            if input.provider and input.provider != provider.provider:
                provider.provider = input.provider

            if input.client_config:
                new_config = input.client_config.to_orm()
                new_sdk = _get_sdk_from_config(new_config)

                # Block incompatible SDK changes to prevent breaking existing prompts.
                # Prompts store invocation parameters in un-normalized form, so switching
                # to an incompatible SDK would cause silent behavior changes or loud failures.
                if not _are_sdks_compatible(provider.sdk, new_sdk):
                    old_sdk_display = provider.sdk.replace("_", " ").title()
                    new_sdk_display = new_sdk.replace("_", " ").title()
                    raise BadRequest(
                        f"Cannot change SDK from {old_sdk_display} to {new_sdk_display}. "
                        f"Existing prompts using this provider would break. "
                        f"Please create a new provider with the desired SDK instead."
                    )

                if new_sdk != provider.sdk:
                    provider.sdk = new_sdk
                # Serialize and encrypt the config
                config_json = new_config.model_dump_json().encode("utf-8")
                provider.config = info.context.encrypt(config_json)

            if provider in session.dirty:
                provider.updated_at = datetime.now(timezone.utc)
                try:
                    await session.flush()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                    raise Conflict(f"Provider with name '{input.name}' already exists")

        return PatchGenerativeModelCustomProviderMutationPayload(
            provider=GenerativeModelCustomProvider(id=provider.id, db_record=provider),
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
        try:
            provider_id = from_global_id_with_expected_type(
                input.id, GenerativeModelCustomProvider.__name__
            )
        except ValueError:
            raise BadRequest(f'Invalid provider id: "{input.id}"')

        stmt = sa.delete(models.GenerativeModelCustomProvider).where(
            models.GenerativeModelCustomProvider.id == provider_id
        )
        async with info.context.db() as session:
            await session.execute(stmt)

        return DeleteGenerativeModelCustomProviderMutationPayload(
            id=input.id,
            query=Query(),
        )
