from typing import Optional

import strawberry
from sqlean.dbapi2 import IntegrityError  # type: ignore[import-untyped]
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict
from phoenix.server.api.helpers.prompts.models import validate_prompt_template
from phoenix.server.api.types.Prompt import Prompt, to_gql_prompt
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
    async def create_prompt(self, info: Info[Context, None], input: CreatePromptInput) -> Prompt:
        input_prompt_version = input.prompt_version
        input_prompt_name = input.name
        input_prompt_template_type = input_prompt_version.template_type
        input_prompt_template = input_prompt_version.template
        prompt_template_valid, error_message = validate_prompt_template(
            input_prompt_template, input_prompt_template_type
        )
        if not prompt_template_valid:
            raise BadRequest(error_message)
        async with info.context.db() as session:
            prompt_version = models.PromptVersion(
                description=input_prompt_version.description,
                template_type=input_prompt_template_type.value,
                template_format=input_prompt_version.template_format.value,
                template=input_prompt_template,
                invocation_parameters=input_prompt_version.invocation_parameters,
                tools=input_prompt_version.tools,
                output_schema=input_prompt_version.output_schema,
                model_provider=input_prompt_version.model_provider,
                model_name=input_prompt_version.model_name,
            )
            prompt = models.Prompt(
                name=input_prompt_name,
                description=input.description,
                prompt_versions=[prompt_version],
            )
            session.add(prompt)
            try:
                await session.commit()
            except IntegrityError:
                raise Conflict(f"A prompt named '{input_prompt_name}' already exists")
        return to_gql_prompt(prompt)
