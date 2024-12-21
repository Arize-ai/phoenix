from typing import Optional

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import (
    PromptTemplateFormat,
    PromptTemplateType,
)


@strawberry.input
class PromptVersionInput:
    description: Optional[str] = None
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: JSON
    invocation_parameters: Optional[JSON] = None
    tools: Optional[JSON] = None
    output_schema: Optional[JSON] = None
    model_provider: str
    model_name: str


@strawberry.input
class CreatePromptInput:
    name: str
    description: Optional[str] = None
    prompt_version: PromptVersionInput


@strawberry.type
class PromptMutationMixin:
    @strawberry.mutation
    def create_prompt(self, info: Info[Context, None], input: CreatePromptInput) -> Prompt:
        raise NotImplementedError
