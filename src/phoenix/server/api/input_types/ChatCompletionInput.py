from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from .ChatCompletionMessageInput import ChatCompletionMessageInput
from .GenerativeModelInput import GenerativeModelInput
from .InvocationParameters import InvocationParameterInput
from .TemplateOptions import TemplateOptions


@strawberry.input
class ChatCompletionInput:
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: list[InvocationParameterInput] = strawberry.field(default_factory=list)
    tools: Optional[list[JSON]] = UNSET
    template: Optional[TemplateOptions] = UNSET
    api_key: Optional[str] = strawberry.field(default=None)


@strawberry.input
class ChatCompletionOverDatasetInput(ChatCompletionInput):
    dataset_id: GlobalID
    dataset_version_id: Optional[GlobalID] = None
