from typing import Any, Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.input_types.PromptVersionInput import (
    ChatPromptVersionInput,
)
from phoenix.server.api.mutations.prompt_version_tag_mutations import (
    SetPromptVersionTagInput,
    upsert_prompt_version_tag,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.input
class CreateChatPromptInput:
    name: Identifier
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput
    metadata: Optional[strawberry.scalars.JSON] = None


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
    prompt_id: GlobalID
    description: Optional[str] = UNSET
    metadata: Optional[strawberry.scalars.JSON] = UNSET


@strawberry.input
class PatchPromptInput:
    prompt_id: GlobalID
    description: Optional[str] = UNSET
    metadata: Optional[strawberry.scalars.JSON] = UNSET


@strawberry.type
class DeletePromptMutationPayload:
    query: Query


@strawberry.type
class PromptMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_chat_prompt(
        self, info: Info[Context, None], input: CreateChatPromptInput
    ) -> Prompt:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
        try:
            prompt_version = input.prompt_version.to_orm_prompt_version(user_id)
        except ValidationError as error:
            raise BadRequest(str(error))
        name = IdentifierModel.model_validate(str(input.name))
        prompt = models.Prompt(
            name=name,
            description=input.description,
            metadata_=input.metadata or {},
            prompt_versions=[prompt_version],
        )
        async with info.context.db() as session:
            session.add(prompt)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A prompt named '{input.name}' already exists")
        return Prompt(id=prompt.id, db_record=prompt)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
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
            prompt_version = input.prompt_version.to_orm_prompt_version(user_id)
        except ValidationError as error:
            raise BadRequest(str(error))
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )
        prompt_version.prompt_id = prompt_id
        async with info.context.db() as session:
            session.add(prompt_version)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")
            if input.tags:
                for tag in input.tags:
                    await upsert_prompt_version_tag(
                        session, prompt_id, prompt_version.id, tag.name, tag.description
                    )
        return Prompt(id=prompt_id)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_prompt(
        self, info: Info[Context, None], input: DeletePromptInput
    ) -> DeletePromptMutationPayload:
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )
        async with info.context.db() as session:
            stmt = delete(models.Prompt).where(models.Prompt.id == prompt_id)
            result = await session.execute(stmt)

            if result.rowcount == 0:  # type: ignore[attr-defined]
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

            await session.commit()
        return DeletePromptMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
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
            # Handle description: inherit if UNSET, otherwise use value (can be None)
            if input.description is UNSET:
                description = prompt.description
            else:
                description = input.description.strip() if input.description is not None else None

            # Handle metadata: inherit if UNSET, clear to empty dict if None, or use value
            if input.metadata is UNSET:
                metadata = prompt.metadata_
            else:
                metadata = input.metadata or {}

            new_prompt = models.Prompt(
                name=name,
                source_prompt_id=prompt_id,
                description=description,
                metadata_=metadata,
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
        return Prompt(id=new_prompt.id, db_record=new_prompt)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_prompt(self, info: Info[Context, None], input: PatchPromptInput) -> Prompt:
        prompt_id = from_global_id_with_expected_type(
            global_id=input.prompt_id, expected_type_name=Prompt.__name__
        )

        values: dict[str, Any] = {}
        if input.description is not UNSET:
            values["description"] = (
                input.description.strip() if input.description is not None else None
            )
        if input.metadata is not UNSET:
            values["metadata_"] = input.metadata or {}

        if not values:
            raise BadRequest("No fields provided to update")

        async with info.context.db() as session:
            stmt = (
                update(models.Prompt)
                .where(models.Prompt.id == prompt_id)
                .values(**values)
                .returning(models.Prompt)
            )

            result = await session.execute(stmt)
            prompt = result.scalar_one_or_none()

            if prompt is None:
                raise NotFound(f"Prompt with ID '{input.prompt_id}' not found")

        return Prompt(id=prompt.id, db_record=prompt)
