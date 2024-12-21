from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import (
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptToolDefinition as ToolDefinitionModel,
)


@strawberry.experimental.pydantic.input(ToolDefinitionModel)
class ToolDefinitionInput:
    definition: JSON


@strawberry.input
class JSONSchemaInput:
    definition: JSON


@strawberry.input
class PromptVersionInput:
    description: Optional[str] = None
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: JSON
    invocation_parameters: JSON = strawberry.field(default_factory=dict)
    tools: list[ToolDefinitionInput] = strawberry.field(default_factory=list)
    output_schema: Optional[JSONSchemaInput] = None
    model_provider: str
    model_name: str
