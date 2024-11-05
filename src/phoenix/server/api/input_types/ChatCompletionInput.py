from typing import Optional, Protocol

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.types.TemplateLanguage import TemplateLanguage

from .ChatCompletionMessageInput import ChatCompletionMessageInput
from .GenerativeModelInput import GenerativeModelInput
from .InvocationParameters import InvocationParameterInput
from .TemplateOptions import TemplateOptions


@strawberry.type
class BaseChatCompletionInput(Protocol):
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    invocation_parameters: list[InvocationParameterInput] = strawberry.field(default_factory=list)
    tools: Optional[list[JSON]] = UNSET
    api_key: Optional[str] = strawberry.field(default=None)


@strawberry.input
class ChatCompletionInput(BaseChatCompletionInput):
    template: Optional[TemplateOptions] = UNSET


@strawberry.input
class ChatCompletionOverDatasetInput(BaseChatCompletionInput):
    dataset_id: GlobalID
    dataset_version_id: Optional[GlobalID] = None
    template_language: TemplateLanguage
