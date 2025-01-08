from typing import Optional

import strawberry
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag, to_gql_prompt_version_tag


@strawberry.input
class DeletePromptVersionTagInput:
    prompt_version_tag_id: GlobalID


@strawberry.input
class SetPromptVersionTagInput:
    prompt_version_id: GlobalID
    name: str
    description: Optional[str] = None


@strawberry.type
class PromptVersionTagMutationPayload:
    prompt_version_tag: Optional[PromptVersionTag]
    query: Query


@strawberry.type
class PromptVersionTagMutationMixin:
    @strawberry.mutation
    async def delete_prompt_version_tag(
        self, info: Info[Context, None], input: DeletePromptVersionTagInput
    ) -> PromptVersionTagMutationPayload:
        async with info.context.db() as session:
            prompt_version_tag_id = from_global_id_with_expected_type(
                input.prompt_version_tag_id, PromptVersionTag.__name__
            )
            stmt = delete(models.PromptVersionTag).where(
                models.PromptVersionTag.id == prompt_version_tag_id
            )
            result = await session.execute(stmt)
            if result.rowcount == 0:
                raise NotFound(f"PromptVersionTag with ID {input.prompt_version_tag_id} not found")

            await session.commit()
            return PromptVersionTagMutationPayload(prompt_version_tag=None, query=Query())

    @strawberry.mutation
    async def set_prompt_version_tag(
        self, info: Info[Context, None], input: SetPromptVersionTagInput
    ) -> PromptVersionTagMutationPayload:
        async with info.context.db() as session:
            prompt_version_id = from_global_id_with_expected_type(
                input.prompt_version_id, PromptVersion.__name__
            )
            prompt_version = await session.scalar(
                select(models.PromptVersion).where(models.PromptVersion.id == prompt_version_id)
            )
            if not prompt_version:
                raise BadRequest("PromptVersion with ID {input.prompt_version_id} not found.")

            prompt_id = prompt_version.prompt_id

            existing_tag = await session.scalar(
                select(models.PromptVersionTag).where(
                    models.PromptVersionTag.prompt_id == prompt_id,
                    models.PromptVersionTag.name == input.name,
                )
            )

            if existing_tag:
                existing_tag.prompt_version_id = prompt_version_id
                if input.description is not None:
                    existing_tag.description = input.description
                updated_tag = existing_tag
            else:
                new_tag = models.PromptVersionTag(
                    name=input.name,
                    description=input.description,
                    prompt_id=prompt_id,
                    prompt_version_id=prompt_version_id,
                )
                session.add(new_tag)
                updated_tag = new_tag

            if not updated_tag:
                raise BadRequest("Failed to create or update PromptVersionTag.")

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Failed to update PromptVersionTag.")

            version_tag = to_gql_prompt_version_tag(updated_tag)
            return PromptVersionTagMutationPayload(prompt_version_tag=version_tag, query=Query())
