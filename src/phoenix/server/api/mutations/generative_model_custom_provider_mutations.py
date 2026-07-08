from datetime import datetime, timezone
from secrets import token_hex
from typing import Iterator, Mapping, Sequence

import anyio
import sqlalchemy as sa
import strawberry
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from strawberry import UNSET, Info
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.model_provider import (
    AnthropicCustomProviderConfig,
    AuthenticationMethodApiKey,
    AuthenticationMethodAzureADTokenProvider,
    AuthenticationMethodDefaultCredentials,
    AWSBedrockAuthenticationMethodAccessKeys,
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
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.type
class TestGenerativeModelCustomProviderCredentialsResult:
    error: str | None = None


def _iter_secret_values(
    config: GenerativeModelCustomerProviderConfig,
) -> Iterator[str]:
    """Yield the user-supplied secret values present in a provider config.

    Used to scrub these values from upstream provider error messages — e.g.
    OpenAI's "Incorrect API key provided: <key>" echoes the rejected key back.
    """
    root = config.root
    if isinstance(root, OpenAICustomProviderConfig):
        yield root.openai_authentication_method.api_key
    elif isinstance(root, AzureOpenAICustomProviderConfig):
        method = root.azure_openai_authentication_method
        if isinstance(method, AuthenticationMethodApiKey):
            yield method.api_key
        elif isinstance(method, AuthenticationMethodAzureADTokenProvider):
            yield method.azure_client_secret
        elif isinstance(method, AuthenticationMethodDefaultCredentials):
            return
        else:
            assert_never(method)
    elif isinstance(root, AnthropicCustomProviderConfig):
        yield root.anthropic_authentication_method.api_key
    elif isinstance(root, AWSBedrockCustomProviderConfig):
        method_aws = root.aws_bedrock_authentication_method
        if isinstance(method_aws, AWSBedrockAuthenticationMethodAccessKeys):
            yield method_aws.aws_secret_access_key
            if method_aws.aws_session_token:
                yield method_aws.aws_session_token
        elif isinstance(method_aws, AuthenticationMethodDefaultCredentials):
            return
        else:
            assert_never(method_aws)
    elif isinstance(root, GoogleGenAICustomProviderConfig):
        yield root.google_genai_authentication_method.api_key
    else:
        assert_never(root)


def _redact_provider_error(
    error: BaseException,
    config: GenerativeModelCustomerProviderConfig,
) -> str:
    """Stringify a provider exception with any user-supplied secrets scrubbed.

    Upstream providers may echo the rejected credential back in their error
    message (notably OpenAI's "Incorrect API key provided: <key>"). Replacing
    each known secret value with a placeholder keeps the diagnostic detail
    without leaking the secret to the client.
    """
    message = str(error)
    # Replace longer secrets first so a short secret that is a substring of a
    # longer one doesn't shadow it.
    for secret in sorted(set(_iter_secret_values(config)), key=len, reverse=True):
        if secret.strip():
            message = message.replace(secret, "[REDACTED]")
    return message


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
        try:
            config_obj = input.client_config.to_orm()
        except ValidationError as e:
            raise BadRequest(f"Invalid client config: {e}") from e
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
                try:
                    new_config = input.client_config.to_orm()
                except ValidationError as e:
                    raise BadRequest(f"Invalid client config: {e}") from e
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

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsAdminIfAuthEnabled])  # type: ignore
    async def test_generative_model_custom_provider_credentials(
        self,
        info: Info[Context, None],
        input: GenerativeModelCustomerProviderConfigInput,
    ) -> TestGenerativeModelCustomProviderCredentialsResult:
        """
        Test provider credentials by making a lightweight API call.
        Uses models.list() where available, or a dummy model name where
        non-auth errors indicate valid credentials.
        """
        try:
            config = input.to_orm()
        except ValidationError as e:
            raise BadRequest(f"Invalid client config: {e}") from e

        if config.root.type == "openai":
            try:
                with anyio.move_on_after(10) as scope:
                    async with config.root.get_client_factory()() as openai_client:
                        await openai_client.models.list(timeout=10)
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(
                    error=_redact_provider_error(e, config)
                )
        elif config.root.type == "azure_openai":
            try:
                with anyio.move_on_after(10) as scope:
                    async with config.root.get_client_factory()() as azure_openai_client:
                        await azure_openai_client.models.list(timeout=10)
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(
                    error=_redact_provider_error(e, config)
                )
        elif config.root.type == "anthropic":
            try:
                from anthropic import NotFoundError as AnthropicNotFoundError

                # Use dummy model - non-auth errors mean credentials are valid
                with anyio.move_on_after(10) as scope:
                    async with config.root.get_client_factory()() as anthropic_client:
                        await anthropic_client.messages.create(
                            model="test-credential-check",
                            messages=[{"role": "user", "content": "Hi"}],
                            max_tokens=10,
                            timeout=10,
                        )
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except AnthropicNotFoundError:
                pass  # Fall through to return VALID
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(
                    error=_redact_provider_error(e, config)
                )
        elif config.root.type == "aws_bedrock":
            try:
                from botocore.exceptions import ClientError  # type: ignore[import-untyped]

                # Use dummy model - ValidationException means credentials are valid
                # Use async aioboto3 client
                with anyio.move_on_after(10) as scope:
                    async with config.root.get_client_factory()() as client:
                        await client.converse(
                            modelId=f"test-credential-check-{token_hex(4)}",
                            messages=[{"role": "user", "content": [{"text": "Hi"}]}],
                            inferenceConfig={"maxTokens": 10},
                        )
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                # ValidationException means credentials are valid but model ID is wrong
                # This is still a successful credential test
                if error_code == "ValidationException":
                    pass  # Fall through to return VALID
                else:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error=_redact_provider_error(e, config)
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(
                    error=_redact_provider_error(e, config)
                )
        elif config.root.type == "google_genai":
            try:
                from google.genai.types import HttpOptions, ListModelsConfig

                with anyio.move_on_after(10) as scope:
                    async with config.root.get_client_factory()() as google_genai_client:
                        await google_genai_client.models.list(
                            config=ListModelsConfig(http_options=HttpOptions(timeout=10_000))
                        )
                if scope.cancelled_caught:
                    return TestGenerativeModelCustomProviderCredentialsResult(
                        error="Request timed out after 10 seconds"
                    )
            except Exception as e:
                return TestGenerativeModelCustomProviderCredentialsResult(
                    error=_redact_provider_error(e, config)
                )
        else:
            raise BadRequest("Invalid input")
        return TestGenerativeModelCustomProviderCredentialsResult(error=None)

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
