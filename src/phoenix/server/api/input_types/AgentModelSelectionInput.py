from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType


@strawberry.input
class AgentCustomProviderModelSelectionInput:
    provider_id: GlobalID
    model_name: str


@strawberry.input
class AgentBuiltinProviderModelSelectionInput:
    provider: ModelProvider
    model_name: str
    openai_api_type: OpenAIApiType = OpenAIApiType.RESPONSES


@strawberry.input(one_of=True)
class AgentModelSelectionInput:
    custom: Optional[AgentCustomProviderModelSelectionInput] = UNSET
    builtin: Optional[AgentBuiltinProviderModelSelectionInput] = UNSET
