from datetime import datetime, timezone
from secrets import token_hex
from typing import Annotated, Any, Callable, Iterator, Mapping, Sequence

import anyio
import sqlalchemy as sa
import strawberry
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
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
    ClientFactory,
    DecisionSDK,
    GenerativeModelCustomerProviderConfig,
    GoogleGenAICustomProviderConfig,
    OpenAICustomProviderConfig,
    ProviderModels,
    TypeSafeCustomProviderConfig,
    default_provider_models,
)
from phoenix.server.api.auth import IsAdminIfAuthEnabled, IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.builtin_providers import check_provider_base_urls
from phoenix.server.api.helpers.decision_clients import (
    custom_provider_decision_client_class,
    custom_provider_decision_client_factory,
)
from phoenix.server.api.input_types.GenerativeModelCustomerProviderConfigInput import (
    GenerativeModelCustomerProviderConfigInput,
)
from phoenix.server.api.input_types.ProviderModelsInput import (
    ProviderModelsInput,
    check_provider_models,
    check_servable_model_types,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModelCustomProvider import (
    GenerativeModelCustomProvider,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.type(description="The check of one model type a custom provider serves.")
class CustomProviderModelTypeCheck:
    error: str | None = strawberry.field(
        default=None, description="Why the check failed; null when it passed."
    )


@strawberry.type
class TestGenerativeModelCustomProviderCredentialsResult:
    error: str | None = strawberry.field(
        default=None, description="The first check that failed; null when all passed."
    )
    chat: CustomProviderModelTypeCheck | None = strawberry.field(
        default=None, description="The chat check; null when chat models were not checked."
    )
    decision: CustomProviderModelTypeCheck | None = strawberry.field(
        default=None,
        description="The decision endpoint check; null when decision models were not checked.",
    )


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
    elif isinstance(root, TypeSafeCustomProviderConfig):
        yield root.typesafe_authentication_method.api_key
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


_CREDENTIAL_CHECK_MODEL = "test-credential-check"


def _rejects_model(decision_sdk: DecisionSDK, body: Any, model: str) -> bool:
    """Whether a JSON error body is the client's own rejection of ``model``.

    Only the client's error field counts, so a body that merely echoes the request (a
    validation error, a router's "no route" message) doesn't pass:

    - OpenAI Decisions: ``{"error": {"code": "model_not_found"}}``, or an
      ``error.message`` that names the model.
    - System One: a ``detail`` string, or ``detail.message``, that names the model.
    """
    if not isinstance(body, Mapping):
        return False
    if decision_sdk == "openai":
        error = body.get("error")
        if not isinstance(error, Mapping):
            return False
        message = error.get("message")
        return error.get("code") == "model_not_found" or (
            isinstance(message, str) and model in message
        )
    detail = body.get("detail")
    if isinstance(detail, Mapping):
        detail = detail.get("message")
    return isinstance(detail, str) and model in detail


def _post_to(url: str | None) -> str:
    return f"POST {url}" if url else "The decision endpoint"


def _describe_endpoint_rejection(
    *, decision_sdk: DecisionSDK, url: str | None, status: int, body: Any
) -> str | None:
    """Return an error message for a decision endpoint check response, or ``None`` if it passes.

    Passing requires a 4xx (other than 401/403/405/408/422/429) whose error payload
    specifically rejects the sentinel model, proving the endpoint authenticated the
    request and resolved the model rather than returning a generic 404/405/422.
    """
    at = _post_to(url)
    if status in (401, 403):
        return f"{at} rejected the API key (HTTP {status})."
    if status == 405:
        return f"{at} does not accept decision requests (HTTP 405). Check the base URL."
    if status in (408, 429) or status >= 500:
        return f"{at} failed with HTTP {status}, which says nothing about the setup. Retry."
    if 400 <= status < 500 and status != 422:
        if _rejects_model(decision_sdk, body, _CREDENTIAL_CHECK_MODEL):
            return None
    if isinstance(body, str) and body.lstrip().startswith("<"):
        what = "an HTML page"
    elif body is None or body == "":
        what = "an empty response"
    else:
        what = "a response that is not a decision API's"
    return f"{at} answered HTTP {status} with {what}. Check the base URL."


async def _test_chat_credentials(config: GenerativeModelCustomerProviderConfig) -> str | None:
    """Make a lightweight chat API call with the provider's credentials.

    Uses models.list() where available, or a dummy model name where non-auth errors
    indicate valid credentials.

    Returns:
        Why the check failed, redacted, or None if it passed.
    """
    if config.root.type == "openai":
        try:
            with anyio.move_on_after(10) as scope:
                async with config.root.get_client_factory()() as openai_client:
                    await openai_client.models.list(timeout=10)
            if scope.cancelled_caught:
                return "Request timed out after 10 seconds"
        except Exception as e:
            return _redact_provider_error(e, config)
    elif config.root.type == "azure_openai":
        try:
            with anyio.move_on_after(10) as scope:
                async with config.root.get_client_factory()() as azure_openai_client:
                    await azure_openai_client.models.list(timeout=10)
            if scope.cancelled_caught:
                return "Request timed out after 10 seconds"
        except Exception as e:
            return _redact_provider_error(e, config)
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
                return "Request timed out after 10 seconds"
        except AnthropicNotFoundError:
            pass  # Fall through to return VALID
        except Exception as e:
            return _redact_provider_error(e, config)
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
                return "Request timed out after 10 seconds"
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            # ValidationException means credentials are valid but model ID is wrong
            # This is still a successful credential test
            if error_code == "ValidationException":
                pass  # Fall through to return VALID
            else:
                return _redact_provider_error(e, config)
        except Exception as e:
            return _redact_provider_error(e, config)
    elif config.root.type == "google_genai":
        try:
            from google.genai.types import HttpOptions, ListModelsConfig

            with anyio.move_on_after(10) as scope:
                async with config.root.get_client_factory()() as google_genai_client:
                    await google_genai_client.models.list(
                        config=ListModelsConfig(http_options=HttpOptions(timeout=10_000))
                    )
            if scope.cancelled_caught:
                return "Request timed out after 10 seconds"
        except Exception as e:
            return _redact_provider_error(e, config)
    else:
        raise BadRequest(f"A provider with the {config.root.type} SDK can't serve chat models.")
    return None


async def _test_decision_endpoint(config: GenerativeModelCustomerProviderConfig) -> str | None:
    """Probe the provider's decision endpoint with a sentinel model name.

    Passes when the endpoint either rejects the sentinel model by name (proving URL and
    credentials without running a model) or returns a valid decision response (for
    single-model servers that ignore the model field).

    Returns:
        Unredacted failure reason, or ``None`` if the check passed.
    """
    root = config.root
    assert isinstance(root, (OpenAICustomProviderConfig, TypeSafeCustomProviderConfig))
    client_class = custom_provider_decision_client_class(root, provider_name="This provider")
    if not client_class.dependencies_are_installed():
        names = ", ".join(dependency.name for dependency in client_class.dependencies())
        return f"Install {names} to run decisions."
    try:
        client_factory = custom_provider_decision_client_factory(root)
    except BadRequest as error:
        return str(error)
    with anyio.move_on_after(10) as scope:
        try:
            if isinstance(root, TypeSafeCustomProviderConfig):
                return await _post_system_one_check(client_factory)
            return await _post_openai_decisions_check(client_factory)
        except Exception as error:
            return f"The decision request failed: {error}"
    assert scope.cancelled_caught
    return "The decision request timed out after 10 seconds."


async def _post_system_one_check(client_factory: ClientFactory[Any]) -> str | None:
    from typesafe_sdk import (
        TypeSafeAPIConnectionError,
        TypeSafeAPIError,
        TypeSafeAPIResponseValidationError,
    )

    try:
        async with client_factory() as client:
            await client.system_one(
                "Credential check",
                {"check": {"type": "noul", "instructions": "Is this a credential check?"}},
                model=_CREDENTIAL_CHECK_MODEL,
                timeout=10,
            )
    except TypeSafeAPIResponseValidationError as error:
        return (
            f"{_post_to(_endpoint_url(error.endpoint))} answered HTTP {error.status} with a "
            "body that is not a System One response. Check the base URL."
        )
    except TypeSafeAPIError as error:
        return _describe_endpoint_rejection(
            decision_sdk="typesafe",
            url=_endpoint_url(error.endpoint),
            status=error.status,
            body=error.body,
        )
    except TypeSafeAPIConnectionError as error:
        return f"Could not connect to the decision endpoint: {error}"
    return None


def _endpoint_url(endpoint: str | None) -> str | None:
    """The URL in a TypeSafe error's ``endpoint``, which reads ``"POST <url>"``."""
    return endpoint.split(" ", 1)[-1] if endpoint else None


async def _post_openai_decisions_check(client_factory: ClientFactory[Any]) -> str | None:
    from openai import APIConnectionError, APIStatusError
    from openai.types import Decision

    try:
        async with client_factory() as client:
            response = await client.decisions.with_raw_response.create(
                model=_CREDENTIAL_CHECK_MODEL,
                input="Credential check",
                questions=[
                    {
                        "name": "check",
                        "type": "predicate",
                        "instructions": "Is this a credential check?",
                    }
                ],
                timeout=10,
            )
            try:
                Decision.model_validate(response.http_response.json())
            except ValueError:
                http_response = response.http_response
                return (
                    f"{_post_to(str(http_response.request.url))} answered HTTP "
                    f"{http_response.status_code} with a body that is not a decisions "
                    "response. Check the base URL."
                )
    except APIStatusError as error:
        # `error.body` has OpenAI's `error` object unwrapped; read the body as sent.
        body: Any
        try:
            body = error.response.json()
        except ValueError:
            body = error.response.text
        return _describe_endpoint_rejection(
            decision_sdk="openai", url=str(error.request.url), status=error.status_code, body=body
        )
    except APIConnectionError as error:
        return f"Could not connect to {error.request.url}: {error}"
    return None


def _stored_config(
    provider: models.GenerativeModelCustomProvider, decrypt: Callable[[bytes], bytes]
) -> GenerativeModelCustomerProviderConfig:
    try:
        return GenerativeModelCustomerProviderConfig.model_validate_json(decrypt(provider.config))
    except Exception as error:
        raise BadRequest(
            f"Custom provider '{provider.name}' can't be read. Re-enter its connection settings."
        ) from error


async def _check_decision_references(
    session: AsyncSession,
    provider_id: int,
    *,
    action: str = "delete it",
) -> None:
    """Refuse to delete a provider, or stop it serving decision models,
    while saved decisions or decision experiment tasks use it."""
    if decision_names := (
        await session.scalars(
            sa.select(models.Decision.name)
            .join(models.DecisionVersion)
            .where(models.DecisionVersion.custom_provider_id == provider_id)
            .distinct()
            .order_by(models.Decision.name)
        )
    ).all():
        names = ", ".join(str(name) for name in decision_names)
        raise BadRequest(
            f"This provider is referenced by saved decision versions ({names}), so you "
            f"cannot {action}"
        )
    if await session.scalar(
        sa.select(models.ExperimentDecisionTask.id)
        .where(models.ExperimentDecisionTask.custom_provider_id == provider_id)
        .limit(1)
    ):
        raise BadRequest(
            f"This provider is referenced by decision experiment tasks, so you cannot {action}"
        )


@strawberry.input
class CreateGenerativeModelCustomProviderMutationInput:
    name: str
    description: str | None = UNSET
    provider: str
    client_config: GenerativeModelCustomerProviderConfigInput
    models: ProviderModelsInput | None = strawberry.field(
        default=UNSET,
        description=(
            "The model types the endpoint serves; omitted, what its SDK serves by default: "
            "chat models, or decision models for TypeSafe."
        ),
    )

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("name must be provided")
        self.name = self.name.strip()
        if not self.provider.strip():
            raise ValueError("provider must be provided")
        self.provider = self.provider.strip()


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
    models: ProviderModelsInput | None = strawberry.field(
        default=UNSET,
        description="The model types the endpoint serves; given, it replaces the stored value.",
    )

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
        check_provider_base_urls(config_obj.root)
        provider_models = (
            input.models.to_orm() if input.models else default_provider_models(config_obj.root.type)
        )
        check_provider_models(config_obj.root, provider_models)
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
            sdk=config_obj.root.type,
            config=encrypted_config,
            models=provider_models,
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

            new_config: GenerativeModelCustomerProviderConfig | None = None
            if input.client_config:
                try:
                    new_config = input.client_config.to_orm()
                except ValidationError as e:
                    raise BadRequest(f"Invalid client config: {e}") from e
                check_provider_base_urls(new_config.root)
                new_sdk = new_config.root.type

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

            new_served: ProviderModels | None = input.models.to_orm() if input.models else None
            if new_config is not None or new_served is not None:
                config = new_config or _stored_config(provider, info.context.decrypt)
                served = new_served or provider.models
                check_provider_models(config.root, served)

                if provider.models.decision is not None and served.decision is None:
                    await _check_decision_references(
                        session, provider.id, action="stop it serving decision models"
                    )

                if served != provider.models:
                    provider.models = served
                if new_config is not None:
                    if new_config.root.type != provider.sdk:
                        provider.sdk = new_config.root.type
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
        provider_models: Annotated[
            ProviderModelsInput | None,
            strawberry.argument(
                name="models",
                description=(
                    "The model types to check, as the provider would serve them; the SDK's "
                    "default when omitted."
                ),
            ),
        ] = None,
    ) -> TestGenerativeModelCustomProviderCredentialsResult:
        """
        Check the provider's connection for each model type it serves. Chat models are
        checked with a lightweight API call. Decision models are checked by posting to the
        exact URL a decision run would, asking for a model that does not exist; that check
        passes when the endpoint rejects the model by name or answers with a valid decision.
        """
        try:
            config = input.to_orm()
        except ValidationError as e:
            raise BadRequest(f"Invalid client config: {e}") from e
        check_provider_base_urls(config.root)
        served = (
            provider_models.to_orm()
            if provider_models
            else default_provider_models(config.root.type)
        )
        # Allow testing a subset of servable types (e.g., decision only on an OpenAI config).
        check_servable_model_types(config.root, served)

        chat: CustomProviderModelTypeCheck | None = None
        if served.chat is not None:
            chat = CustomProviderModelTypeCheck(error=await _test_chat_credentials(config))
        decision: CustomProviderModelTypeCheck | None = None
        if served.decision is not None:
            reason = await _test_decision_endpoint(config)
            decision = CustomProviderModelTypeCheck(
                error=_redact_provider_error(RuntimeError(reason), config) if reason else None
            )
        return TestGenerativeModelCustomProviderCredentialsResult(
            error=next((c.error for c in (chat, decision) if c and c.error), None),
            chat=chat,
            decision=decision,
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
            # TODO: prompt tasks have the same flaw as decision tasks did: a task's
            # custom_provider_id is cleared (ON DELETE SET NULL) when the provider is
            # deleted, and a resumed task then silently runs on the built-in provider.
            await _check_decision_references(session, provider_id)
            await session.execute(stmt)

        return DeleteGenerativeModelCustomProviderMutationPayload(
            id=input.id,
            query=Query(),
        )
