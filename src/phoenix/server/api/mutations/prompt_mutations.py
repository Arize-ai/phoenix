from typing import Any, Optional, Union, cast

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.prompts.models import (
    normalize_response_format,
    normalize_tools,
    validate_invocation_parameters,
)
from phoenix.server.api.input_types.PromptVersionInput import (
    ChatPromptVersionInput,
    to_pydantic_prompt_chat_template_v1,
)
from phoenix.server.api.mutations.prompt_version_tag_mutations import (
    SetPromptVersionTagInput,
    upsert_prompt_version_tag,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt, to_gql_prompt_from_orm
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.input
class CreateChatPromptInput:
    name: Identifier
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput


@strawberry.input
class CreateChatPromptVersionInput:
    prompt_id: GlobalID
    prompt_version: ChatPromptVersionInput
    tags: Optional[list[SetPromptVersionTagInput]] = None


@strawberry.input
class DeletePromptInput:
    prompt_id: GlobalID


@strawberry.input
class ClonePromptInput:
    name: Identifier
    description: Optional[str] = None
    prompt_id: GlobalID


@strawberry.input
class PatchPromptInput:
    prompt_id: GlobalID
    description: str


@strawberry.type
class DeletePromptMutationPayload:
    query: Query


@strawberry.type
class PromptMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_chat_prompt(
        self, info: Info[Context, None], input: CreateChatPromptInput
    ) -> Prompt:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        input_prompt_version = input.prompt_version
        tool_definitions = [tool.definition for tool in input_prompt_version.tools]
        tool_choice = cast(
            Optional[Union[str, dict[str, Any]]],
            cast(dict[str, Any], input.prompt_version.invocation_parameters).pop(
                "tool_choice", None
            ),
        )
        model_provider = ModelProvider(input_prompt_version.model_provider)
        try:
            tools = (
                normalize_tools(tool_definitions, model_provider, tool_choice)
                if tool_definitions
                else None
            )
            template = to_pydantic_prompt_chat_template_v1(input_prompt_version.template)
            response_format = (
                normalize_response_format(
                    input_prompt_version.response_format.definition,
                    model_provider,
                )
                if input_prompt_version.response_format
                else None
            )
            invocation_parameters = validate_invocation_parameters(
                input_prompt_version.invocation_parameters,
                model_provider,
            )
        except ValidationError as error:
            raise BadRequest(str(error))

        async with info.context.db() as session:
            prompt_version = models.PromptVersion(
                description=input_prompt_version.description,
                user_id=user_id,
                template_type="CHAT",
                template_format=input_prompt_version.template_format,
                template=template,
                invocation_parameters=invocation_parameters,
                tools=tools,
                response_format=response_format,
                model_provider=input_prompt_version.model_provider,
                model_name=input_prompt_version.model_name,
            )
            name = IdentifierModel.model_validate(str(input.name))
            prompt = models.Prompt(
                name=name,
                description=input.description,
                prompt_versions=[prompt_version],
            )
            session.add(prompt)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A prompt named '{input.name}' already exists")
        return to_gql_prompt_from_orm(prompt)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
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

        input_prompt_version = input.prompt_version
        tool_definitions = [tool.definition for tool in input.prompt_version.tools]
        tool_choice = cast(
            Optional[Union[str, dict[str, Any]]],
            cast(dict[str, Any], input.prompt_version.invocation_parameters).pop(
                "tool_choice", None
            ),
        )
        model_provider = ModelProvider(input_prompt_version.model_provider)
        try:
            tools = (
                normalize_tools(tool_definitions, model_provider, tool_choice)
                if tool_definitions
                else None
            )
            template = to_pydantic_prompt_chat_template_v1(input_prompt_version.template)
            response_format = (
                normalize_response_format(
                    input_prompt_version.response_format.definition,
                    model_provider,
                )
                if input_prompt_version.response_format
                else None
            )
            invocation_parameters = validate_invocation_parameters(
                input_prompt_version.invocation_parameters,
                model_provider,
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
                description=input.prompt_version.description,
                user_id=user_id,
                template_type="CHAT",
                template_format=input.prompt_version.template_format,
                template=template,
                invocation_parameters=invocation_parameters,
                tools=tools,
                response_format=response_format,
                model_provider=input.prompt_version.model_provider,
                model_name=input.prompt_version.model_name,
            )
            session.add(prompt_version)

        # ensure prompt_version is flushed to the database before creating tags against the
        # prompt_version id
        await session.flush()

        if input.tags:
            for tag in input.tags:
                await upsert_prompt_version_tag(
                    session, prompt_id, prompt_version.id, tag.name, tag.description
                )

        return to_gql_prompt_from_orm(prompt)

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_prompt(
        self, info: Info[Context, None], input: DeletePromptInput
    ) -> DeletePromptMutationPayload:
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )
        async with info.context.db() as session:
            stmt = delete(models.Prompt).where(models.Prompt.id == prompt_id)
            result = await session.execute(stmt)

            if result.rowcount == 0:
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

            await session.commit()
        return DeletePromptMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def clone_prompt(self, info: Info[Context, None], input: ClonePromptInput) -> Prompt:
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )
        async with info.context.db() as session:
            # Load prompt with all versions
            stmt = (
                select(models.Prompt)
                .options(joinedload(models.Prompt.prompt_versions))
                .where(models.Prompt.id == prompt_id)
            )
            prompt = await session.scalar(stmt)

            if not prompt:
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

            # Create new prompt
            name = IdentifierModel.model_validate(str(input.name))
            new_prompt = models.Prompt(
                name=name,
                description=input.description,
                source_prompt_id=prompt_id,
            )

            # Create copies of all versions
            new_versions = [
                models.PromptVersion(
                    prompt_id=new_prompt.id,
                    user_id=version.user_id,
                    description=version.description,
                    template_type=version.template_type,
                    template_format=version.template_format,
                    template=version.template,
                    invocation_parameters=version.invocation_parameters,
                    tools=version.tools,
                    response_format=version.response_format,
                    model_provider=version.model_provider,
                    model_name=version.model_name,
                )
                for version in prompt.prompt_versions
            ]
            # Add all version copies to the new prompt
            new_prompt.prompt_versions = new_versions

            session.add(new_prompt)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A prompt named '{input.name}' already exists")
        return to_gql_prompt_from_orm(new_prompt)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_prompt(self, info: Info[Context, None], input: PatchPromptInput) -> Prompt:
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )

        async with info.context.db() as session:
            stmt = (
                update(models.Prompt)
                .where(models.Prompt.id == prompt_id)
                .values(description=input.description)
                .returning(models.Prompt)
            )

            result = await session.execute(stmt)
            prompt = result.scalar_one_or_none()

            if prompt is None:
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

        return to_gql_prompt_from_orm(prompt)
