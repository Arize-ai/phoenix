from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptJSONSchema,
    PromptToolsV1,
    PromptVersion,
)
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt, to_gql_prompt_from_orm
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.input
class CreateChatPromptInput:
    name: str
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput


@strawberry.input
class CreateChatPromptVersionInput:
    prompt_id: GlobalID
    prompt_version: ChatPromptVersionInput


@strawberry.input
class DeletePromptInput:
    prompt_id: GlobalID


@strawberry.type
class PromptMutationMixin:
    @strawberry.mutation
    async def create_chat_prompt(
        self, info: Info[Context, None], input: CreateChatPromptInput
    ) -> Prompt:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            tool_definitions = []
            for tool in input.prompt_version.tools:
                pydantic_tool = tool.to_pydantic()
                tool_definitions.append(pydantic_tool)
            tools = PromptToolsV1(tool_definitions=tool_definitions)
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
            pydantic_prompt_version = PromptVersion(
                user_id=user_id,
                description=input.prompt_version.description,
                template_type=input.prompt_version.template_type.value,
                template_format=input.prompt_version.template_format.value,
                template=template,
                invocation_parameters=input.prompt_version.invocation_parameters,
                tools=tools,
                output_schema=output_schema,
                model_name=input.prompt_version.model_name,
                model_provider=input.prompt_version.model_provider,
            )
        except ValidationError as error:
            raise BadRequest(str(error))

        async with info.context.db() as session:
            prompt_version = models.PromptVersion(
                description=pydantic_prompt_version.description,
                user_id=pydantic_prompt_version.user_id,
                template_type=pydantic_prompt_version.template_type,
                template_format=pydantic_prompt_version.template_format,
                template=pydantic_prompt_version.template.dict(),
                invocation_parameters=pydantic_prompt_version.invocation_parameters,
                tools=pydantic_prompt_version.tools.dict(),
                output_schema=pydantic_prompt_version.output_schema,
                model_provider=pydantic_prompt_version.model_provider,
                model_name=pydantic_prompt_version.model_name,
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

    @strawberry.mutation
    async def create_chat_prompt_version(
        self,
        info: Info[Context, None],
        input: CreateChatPromptVersionInput,
    ) -> Prompt:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            tool_definitions = []
            for tool in input.prompt_version.tools:
                pydantic_tool = tool.to_pydantic()
                tool_definitions.append(pydantic_tool)
            tools = PromptToolsV1(tool_definitions=tool_definitions)
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
            pydantic_prompt_version = PromptVersion(
                user_id=user_id,
                description=input.prompt_version.description,
                template_type=input.prompt_version.template_type.value,
                template_format=input.prompt_version.template_format.value,
                template=template,
                invocation_parameters=input.prompt_version.invocation_parameters,
                tools=tools,
                output_schema=output_schema,
                model_name=input.prompt_version.model_name,
                model_provider=input.prompt_version.model_provider,
            )
        except ValidationError as error:
            raise BadRequest(str(error))

        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )
        async with info.context.db() as session:
            prompt = await session.get(models.Prompt, prompt_id)
            if not prompt:
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

            prompt_version = models.PromptVersion(
                prompt_id=prompt_id,
                user_id=pydantic_prompt_version.user_id,
                description=pydantic_prompt_version.description,
                template_type=pydantic_prompt_version.template_type,
                template_format=pydantic_prompt_version.template_format,
                template=pydantic_prompt_version.template.dict(),
                invocation_parameters=pydantic_prompt_version.invocation_parameters,
                tools=pydantic_prompt_version.tools.dict(),
                output_schema=pydantic_prompt_version.output_schema,
                model_provider=pydantic_prompt_version.model_provider,
                model_name=pydantic_prompt_version.model_name,
            )
            session.add(prompt_version)

        return to_gql_prompt_from_orm(prompt)

    @strawberry.mutation
    async def delete_prompt(self, info: Info[Context, None], input: DeletePromptInput) -> Query:
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )
        async with info.context.db() as session:
            stmt = delete(models.Prompt).where(models.Prompt.id == prompt_id)
            result = await session.execute(stmt)

            if result.rowcount == 0:
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

            await session.commit()
        return Query()
