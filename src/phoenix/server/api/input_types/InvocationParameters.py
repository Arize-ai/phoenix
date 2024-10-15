from typing import List, Optional

import strawberry
from strawberry import UNSET


@strawberry.input
class OpenAIBaseInvocationParameters:
    """
    Invocation parameters shared in common between OpenAI and Azure OpenAI.

    For the meaning of specific parameters, see:

    - https://platform.openai.com/docs/api-reference/chat/create
    - https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#chat-completions
    """

    temperature: Optional[float] = UNSET
    top_p: Optional[float] = UNSET
    stop: Optional[List[str]] = UNSET
    presence_penalty: Optional[float] = UNSET
    frequency_penalty: Optional[float] = UNSET
    logit_bias: Optional[strawberry.scalars.JSON] = UNSET
    seed: Optional[int] = UNSET
    logprobs: Optional[bool] = UNSET
    top_logprobs: Optional[int] = UNSET
    response_format: Optional[strawberry.scalars.JSON] = UNSET


@strawberry.input
class OpenAIInvocationParameters(OpenAIBaseInvocationParameters):
    """
    OpenAI invocation parameters.

    For the meaning of specific parameters, see:

    https://platform.openai.com/docs/api-reference/chat/create
    """

    store: Optional[bool] = UNSET
    metadata: Optional[strawberry.scalars.JSON] = UNSET
    max_completion_tokens: Optional[int] = UNSET


@strawberry.input
class AzureOpenAIInvocationParameters(OpenAIBaseInvocationParameters):
    """
    Azure OpenAI invocation parameters.

    For the meaning of specific parameters, see:

    https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#chat-completions
    """

    max_tokens: Optional[int] = UNSET


@strawberry.input
class AnthropicInvocationParameters:
    """
    Anthropic invocation parameters.

    For the meaning of specific parameters, see:

    https://docs.anthropic.com/en/api/messages
    """

    max_tokens: int = 1024
    stop_sequences: Optional[List[str]] = UNSET
    temperature: Optional[float] = UNSET
    top_k: Optional[int] = UNSET
    top_p: Optional[int] = UNSET


@strawberry.input(one_of=True)
class InvocationParameters:
    OPENAI: Optional[OpenAIInvocationParameters] = strawberry.field(name="OPENAI", default=UNSET)
    AZURE_OPENAI: Optional[AzureOpenAIInvocationParameters] = strawberry.field(
        name="AZURE_OPENAI", default=UNSET
    )
    ANTHROPIC: Optional[AnthropicInvocationParameters] = strawberry.field(
        name="ANTHROPIC", default=UNSET
    )
