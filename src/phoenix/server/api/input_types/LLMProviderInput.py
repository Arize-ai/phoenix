import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID

from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput


@strawberry.input(one_of=True)
class LLMProviderInput:
    custom_llm_provider_id: GlobalID | None = UNSET
    generative_model_input: GenerativeModelInput
