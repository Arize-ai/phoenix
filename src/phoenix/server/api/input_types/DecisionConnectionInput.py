"""Where a decision runs: a built-in provider, or a custom provider."""

from typing import Callable, Optional, Sequence

import strawberry
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import (
    DecisionClient,
    get_custom_provider_decision_client,
    get_decision_client,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeModelCustomProvider import GenerativeModelCustomProvider
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input(description="A built-in provider, reached with its own or given credentials.")
class BuiltInDecisionConnectionInput:
    provider_key: GenerativeProviderKey = strawberry.field(
        description=(
            "The provider whose decision API runs the request; it must offer decision models."
        )
    )
    base_url: Optional[str] = strawberry.field(
        default=None,
        description=(
            "Send the request to this endpoint instead of the provider default. Requires an "
            "API key in `credentials` or a stored secret; the server-configured key is never "
            "sent to a custom URL."
        ),
    )
    credentials: Optional[list[GenerativeCredentialInput]] = strawberry.field(
        default=None,
        description=(
            "API keys for this request only, by environment variable name. When omitted, a "
            "stored secret is used, then the server environment."
        ),
    )


@strawberry.input(
    description=(
        "A custom provider, reached with its stored key, endpoint, and headers. Its SDK must "
        "serve decision models: `openai` runs OpenAI's Decisions API, `typesafe` runs System "
        "One."
    )
)
class CustomProviderDecisionConnectionInput:
    id: GlobalID = strawberry.field(description="The custom provider's ID.")


@strawberry.input(one_of=True, description="Where a decision runs.")
class DecisionConnectionInput:
    built_in: Optional[BuiltInDecisionConnectionInput] = UNSET
    custom_provider: Optional[CustomProviderDecisionConnectionInput] = UNSET

    def custom_provider_id(self) -> Optional[int]:
        """The custom provider's row ID, or None for a built-in provider.

        Raises:
            BadRequest: The ID is not a custom provider's.
        """
        if not self.custom_provider:
            return None
        try:
            return from_global_id_with_expected_type(
                self.custom_provider.id, GenerativeModelCustomProvider.__name__
            )
        except ValueError as error:
            raise BadRequest(f"Invalid custom provider ID: {self.custom_provider.id}") from error

    def built_in_provider(self) -> BuiltInDecisionConnectionInput:
        if not self.built_in:
            raise BadRequest("A connection is required: builtIn or customProvider.")
        return self.built_in

    async def resolve_client(
        self,
        *,
        model_name: str,
        session: AsyncSession,
        decrypt: Callable[[bytes], bytes],
        allowed_provider_names: Optional[frozenset[str]],
        credentials: Sequence[GenerativeCredentialInput] = (),
        sdk_retries: bool = True,
    ) -> DecisionClient:
        """The client for this connection.

        ``credentials`` are added to a built-in provider's own; a custom provider brings
        its own key and ignores them.

        Raises:
            BadRequest: The provider is not permitted or offers no decision models, or its
                credentials or endpoint can't be used.
            NotFound: The custom provider does not exist.
        """
        custom_provider_id = self.custom_provider_id()
        if custom_provider_id is not None:
            return await get_custom_provider_decision_client(
                custom_provider_id=custom_provider_id,
                model_name=model_name,
                session=session,
                decrypt=decrypt,
                sdk_retries=sdk_retries,
            )
        built_in = self.built_in_provider()
        if (
            allowed_provider_names is not None
            and built_in.provider_key.name not in allowed_provider_names
        ):
            raise BadRequest("This decision provider is not permitted by the server configuration.")
        return await get_decision_client(
            provider=built_in.provider_key,
            model_name=model_name,
            base_url=built_in.base_url,
            credentials=[*(built_in.credentials or ()), *credentials] or None,
            session=session,
            decrypt=decrypt,
            sdk_retries=sdk_retries,
        )
