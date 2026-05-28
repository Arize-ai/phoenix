"""GraphQL input mirroring the agent ``/chat`` ``model`` selection union.

This input carries the same provider + model information the chat endpoint
uses to build a model, minus the message history. It exists so the frontend
can ask whether the currently selected model supports provider-native web
search before sending a turn. Convert it to the transport-neutral
``AgentModelSelection`` pydantic union with :meth:`to_pydantic` before handing
it to :func:`phoenix.server.agents.model_factory.build_model`.
"""

from typing import Literal, cast

import strawberry
from strawberry import UNSET

from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.input
class BuiltInProviderModelSelectionInput:
    """Select a Phoenix built-in provider and model."""

    provider: GenerativeProviderKey
    model_name: str
    openai_api_type: OpenAIApiType = OpenAIApiType.RESPONSES


@strawberry.input
class CustomProviderModelSelectionInput:
    """Select a stored custom-provider record and model."""

    provider_id: strawberry.relay.GlobalID
    model_name: str


@strawberry.input(one_of=True)
class AgentModelSelectionInput:
    """Pick exactly one of a built-in or custom provider model selection."""

    builtin: BuiltInProviderModelSelectionInput | None = UNSET
    custom: CustomProviderModelSelectionInput | None = UNSET

    def to_pydantic(self) -> AgentModelSelection:
        """Convert to the chat endpoint's ``AgentModelSelection`` union.

        Raises:
            BadRequest: Neither or both variants were supplied.
        """
        builtin = self.builtin if self.builtin is not UNSET else None
        custom = self.custom if self.custom is not UNSET else None
        if (builtin is None) == (custom is None):
            raise BadRequest(
                "Provide exactly one of `builtin` or `custom` for the model selection."
            )
        if builtin is not None:
            if not builtin.model_name.strip():
                raise BadRequest("A model name is required.")
            return BuiltInProviderModelSelection(
                provider_type="builtin",
                provider=builtin.provider.to_model_provider(),
                model_name=builtin.model_name,
                openai_api_type=cast(
                    Literal["chat_completions", "responses"],
                    builtin.openai_api_type.value,
                ),
            )
        assert custom is not None
        if not custom.model_name.strip():
            raise BadRequest("A model name is required.")
        return CustomProviderModelSelection(
            provider_type="custom",
            provider_id=str(custom.provider_id),
            model_name=custom.model_name,
        )
