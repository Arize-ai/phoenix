from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db.types.model_provider import ModelProvider


@strawberry.input
class AgentCustomProviderModelSelectionInput:
    provider_id: GlobalID
    model_name: str


@strawberry.input
class AgentBuiltinProviderModelSelectionInput:
    provider: ModelProvider
    model_name: str


@strawberry.input(one_of=True)
class AgentModelSelectionInput:
    custom: Optional[AgentCustomProviderModelSelectionInput] = UNSET
    builtin: Optional[AgentBuiltinProviderModelSelectionInput] = UNSET
