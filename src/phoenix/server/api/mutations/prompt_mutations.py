from typing import Optional

import strawberry
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptJSONSchema,
    PromptToolsV1,
)
from phoenix.server.api.input_types.PromptVersionInput import PromptVersionInput
from phoenix.server.api.types.Prompt import Prompt, to_gql_prompt_from_orm


@strawberry.input
class CreatePromptInput:
    name: str
    description: Optional[str] = None
    prompt_version: PromptVersionInput


@strawberry.type
class PromptMutationMixin:
    @strawberry.mutation
    async def create_prompt(self, info: Info[Context, None], input: CreatePromptInput) -> Prompt:
        try:
            tool_definitions = []
            for tool in input.prompt_version.tools:
                pydantic_tool = tool.to_pydantic()
                tool_definitions.append(pydantic_tool.dict())
            tools = (
                PromptToolsV1(tool_definitions=tool_definitions).dict()
                if tool_definitions
                else None
            )
            output_schema = (
                PromptJSONSchema.model_validate(
                    strawberry.asdict(input.prompt_version.output_schema)
                ).dict()
                if input.prompt_version.output_schema is not None
                else None
            )
            template = PromptChatTemplateV1.model_validate(
                strawberry.asdict(input.prompt_version.template)
            ).dict()
        except ValidationError as error:
            raise BadRequest(str(error))
        async with info.context.db() as session:
            prompt_version = models.PromptVersion(
                description=input.prompt_version.description,
                template_type=input.prompt_version.template_type.value,
                template_format=input.prompt_version.template_format.value,
                template=template,
                invocation_parameters=input.prompt_version.invocation_parameters,
                tools=tools,
                output_schema=output_schema,
                model_provider=input.prompt_version.model_provider,
                model_name=input.prompt_version.model_name,
            )
            prompt = models.Prompt(
                name=input.name,
                description=input.description,
                prompt_versions=[prompt_version],
            )
            session.add(prompt)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A prompt named '{input.name}' already exists")
        return to_gql_prompt_from_orm(prompt)
