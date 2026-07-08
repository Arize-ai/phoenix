from typing import Annotated

import strawberry
from strawberry.relay import GlobalID

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.model_selection import (
    AgentModelSelection as AgentModelSelectionModel,
)
from phoenix.server.agents.model_selection import (
    CustomProviderModelSelection,
)
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType


@strawberry.type
class AgentCustomProviderModelSelection:
    provider_id: GlobalID
    model_name: str


@strawberry.type
class AgentBuiltinProviderModelSelection:
    provider: ModelProvider
    model_name: str
    openai_api_type: OpenAIApiType


AgentModelSelection = Annotated[
    AgentCustomProviderModelSelection | AgentBuiltinProviderModelSelection,
    strawberry.union("AgentModelSelection"),
]


def to_gql_agent_model_selection(
    model: AgentModelSelectionModel,
) -> AgentModelSelection:
    if isinstance(model, CustomProviderModelSelection):
        return AgentCustomProviderModelSelection(
            provider_id=GlobalID.from_id(model.provider_id),
            model_name=model.model_name,
        )
    return AgentBuiltinProviderModelSelection(
        provider=model.provider,
        model_name=model.model_name,
        openai_api_type=OpenAIApiType(model.openai_api_type),
    )
