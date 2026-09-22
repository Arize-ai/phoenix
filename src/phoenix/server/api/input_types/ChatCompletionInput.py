from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON

from phoenix.db.types.identifier import Identifier
from phoenix.server.api.input_types.ConnectionConfigInput import ConnectionConfigInput
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput

from .PlaygroundEvaluatorInput import PlaygroundEvaluatorInput
from .PromptTemplateOptions import PromptTemplateOptions
from .PromptVersionInput import ChatPromptVersionInput


@strawberry.input
class ChatCompletionInput:
    prompt_version: ChatPromptVersionInput
    connection_config: Optional[ConnectionConfigInput] = None
    headers: Optional[JSON] = None
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET
    template: Optional[PromptTemplateOptions] = UNSET
    prompt_name: Optional[Identifier] = None
    repetitions: int
    evaluators: list[PlaygroundEvaluatorInput] = strawberry.field(default_factory=list)
    stream_model_output: bool = True
