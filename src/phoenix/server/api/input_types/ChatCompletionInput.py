from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.Identifier import Identifier

from .ModelClientOptionsInput import ModelClientOptionsInput
from .PlaygroundEvaluatorInput import PlaygroundEvaluatorInput
from .PromptTemplateOptions import PromptTemplateOptions
from .PromptVersionInput import ChatPromptVersionInput


@strawberry.input
class ChatCompletionInput:
    prompt_version: ChatPromptVersionInput
    client_options: Optional[ModelClientOptionsInput] = None
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET
    template: Optional[PromptTemplateOptions] = UNSET
    prompt_name: Optional[Identifier] = None
    repetitions: int
    evaluators: list[PlaygroundEvaluatorInput] = strawberry.field(default_factory=list)
    stream_model_output: bool = True


@strawberry.input
class ChatCompletionOverDatasetInput:
    prompt_version: ChatPromptVersionInput
    client_options: Optional[ModelClientOptionsInput] = None
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET
    repetitions: int
    dataset_id: GlobalID
    dataset_version_id: Optional[GlobalID] = None
    split_ids: Optional[list[GlobalID]] = None
    experiment_name: Optional[str] = None
    experiment_description: Optional[str] = None
    experiment_metadata: Optional[JSON] = strawberry.field(default_factory=dict)
    prompt_name: Optional[Identifier] = None
    evaluators: list[PlaygroundEvaluatorInput] = strawberry.field(default_factory=list)
    appended_messages_path: Optional[str] = strawberry.field(
        default=None,
        description="Dot-notation path to messages in dataset example input to append to prompt",
    )
    template_variables_path: Optional[str] = strawberry.field(
        default="input",
        description="Dot-notation path prefix for template variables. Default 'input' means "
        "{{query}} resolves to input.query. Empty string means full paths like "
        "{{input.query}} or {{reference.answer}} are required.",
    )
    tracing_enabled: bool = True
    stream_model_output: bool = True
