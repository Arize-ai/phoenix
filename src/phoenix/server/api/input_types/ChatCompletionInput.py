from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    PromptTemplateFormat,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.Identifier import Identifier

from .ChatCompletionMessageInput import ChatCompletionMessageInput
from .GenerativeModelInput import GenerativeModelInput
from .InvocationParameters import InvocationParameterInput
from .PromptTemplateOptions import PromptTemplateOptions


@strawberry.input
class ChatCompletionInput:
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: list[InvocationParameterInput] = strawberry.field(default_factory=list)
    tools: Optional[list[JSON]] = UNSET
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET
    template: Optional[PromptTemplateOptions] = UNSET
    prompt_name: Optional[Identifier] = None


@strawberry.input
class ChatCompletionOverDatasetInput:
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: list[InvocationParameterInput] = strawberry.field(default_factory=list)
    tools: Optional[list[JSON]] = UNSET
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET
    template_format: PromptTemplateFormat = PromptTemplateFormat.MUSTACHE
    dataset_id: GlobalID
    dataset_version_id: Optional[GlobalID] = None
    experiment_name: Optional[str] = None
    experiment_description: Optional[str] = None
    experiment_metadata: Optional[JSON] = strawberry.field(default_factory=dict)
    prompt_name: Optional[Identifier] = None
