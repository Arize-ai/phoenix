import strawberry
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict
from phoenix.server.api.input_types.PromptVersionTagInput import (
    CreatePromptVersionTagInput,
    PatchPromptVersionTagInput,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag, to_gql_prompt_version_tag


@strawberry.type
class PromptVersionTagMutationPayload:
    prompt_version_tag: list[PromptVersionTag]
    query: Query


@strawberry.type
class PromptVersionTagMutationMixin:
    @strawberry.mutation
    async def create_prompt_version_tag(
        self, info: Info[Context, None], input: CreatePromptVersionTagInput
    ) -> PromptVersionTagMutationPayload:
        """
        Create a new PromptVersionTag. Raises Conflict if a tag with the same
        name already exists (depending on your business logic).
        """
        async with info.context.db() as session:
            prompt_id = from_global_id_with_expected_type(input.prompt_id, Prompt.__name__)
            prompt = await session.scalar(
                select(models.Prompt).where(models.Prompt.id == prompt_id)
            )
            if not prompt:
                raise BadRequest(f"Prompt with ID {prompt_id} not found.")
            new_tag = models.PromptVersionTag(
                name=input.name,
                description=input.description,
                prompt_id=prompt.id,
            )
            session.add(new_tag)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A PromptVersionTag named '{input.name}' already exists.")

            version_tag = to_gql_prompt_version_tag(new_tag)
            return PromptVersionTagMutationPayload(prompt_version_tag=[version_tag], query=Query())

    @strawberry.mutation
    async def patch_prompt_version_tag(
        self, info: Info[Context, None], input: PatchPromptVersionTagInput
    ) -> PromptVersionTagMutationPayload:
        """
        Update an existing PromptVersionTag by ID.
        Raises NotFound if no record is found.
        """
        try:
            async with info.context.db() as session:
                existing_tag_id = from_global_id_with_expected_type(
                    input.version_tag_id, PromptVersionTag.__name__
                )
                existing_tag = await session.scalar(
                    select(models.PromptVersionTag).where(
                        models.PromptVersionTag.id == existing_tag_id
                    )
                )

                if not existing_tag:
                    raise BadRequest(f"No version tag with ID {existing_tag_id} found.")

                if input.name is not None:
                    existing_tag.name = input.name
                if input.description is not None:
                    existing_tag.description = input.description

                try:
                    await session.commit()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                    raise Conflict("Failed to update PromptVersionTag.")

                version_tag = to_gql_prompt_version_tag(existing_tag)
                return PromptVersionTagMutationPayload(
                    prompt_version_tag=[version_tag], query=Query()
                )
        except ValidationError as error:
            raise BadRequest(str(error))
