from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.prompt_version_tags import (
    validate_prompt_version_tag_delete,
    validate_prompt_version_tag_move,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag


@strawberry.input
class DeletePromptVersionTagInput:
    prompt_version_tag_id: GlobalID


@strawberry.input
class CreatePromptVersionTagInput:
    name: Identifier
    description: Optional[str] = None


@strawberry.input
class SetPromptVersionTagInput:
    prompt_version_id: GlobalID
    name: Identifier
    description: Optional[str] = None


@strawberry.type
class PromptVersionTagMutationPayload:
    prompt_version_tag: Optional[PromptVersionTag]
    prompt: Prompt
    query: Query


@strawberry.type
class PromptVersionTagMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_prompt_version_tag(
        self, info: Info[Context, None], input: DeletePromptVersionTagInput
    ) -> PromptVersionTagMutationPayload:
        async with info.context.db() as session:
            prompt_version_tag_id = from_global_id_with_expected_type(
                input.prompt_version_tag_id, PromptVersionTag.__name__
            )
            stmt = (
                select(models.PromptVersionTag, models.Prompt)
                .join(
                    models.PromptVersion,
                    models.PromptVersion.id == models.PromptVersionTag.prompt_version_id,
                )
                .join(models.Prompt, models.Prompt.id == models.PromptVersion.prompt_id)
                .where(models.PromptVersionTag.id == prompt_version_tag_id)
            )
            row = (await session.execute(stmt)).one_or_none()
            if row is None:
                raise NotFound(f"PromptVersionTag with ID {input.prompt_version_tag_id} not found")
            prompt_version_tag, prompt = row

            await validate_prompt_version_tag_delete(session, prompt_version_tag)
            await session.delete(prompt_version_tag)
            await session.commit()
            return PromptVersionTagMutationPayload(
                prompt_version_tag=None,
                query=Query(),
                prompt=Prompt(id=prompt.id, db_record=prompt),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
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
                raise BadRequest(f"PromptVersion with ID {input.prompt_version_id} not found.")

            prompt_id = prompt_version.prompt_id
            prompt = await session.scalar(
                select(models.Prompt).where(models.Prompt.id == prompt_id)
            )
            if not prompt:
                raise BadRequest("All prompt version tags must belong to a prompt")

            updated_tag = await upsert_prompt_version_tag(
                session, prompt_id, prompt_version_id, input.name, input.description
            )

            if not updated_tag:
                raise BadRequest("Failed to create or update PromptVersionTag.")

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Failed to update PromptVersionTag.")

            return PromptVersionTagMutationPayload(
                prompt_version_tag=PromptVersionTag(id=updated_tag.id, db_record=updated_tag),
                prompt=Prompt(id=prompt.id, db_record=prompt),
                query=Query(),
            )


async def upsert_prompt_version_tag(
    session: AsyncSession,
    prompt_id: int,
    prompt_version_id: int,
    name: Identifier,
    description: Optional[str] = None,
    user_id: Optional[int] = None,
) -> models.PromptVersionTag:
    """Create or retarget a tag within the caller's transaction.

    A tag that an LLM evaluator runs through only moves to a version the evaluator can run;
    otherwise Conflict is raised and nothing changes.
    """
    existing_tag = await session.scalar(
        select(models.PromptVersionTag).where(
            models.PromptVersionTag.prompt_id == prompt_id,
            models.PromptVersionTag.name == name,
        )
    )

    if existing_tag:
        await validate_prompt_version_tag_move(session, existing_tag, prompt_version_id)
        existing_tag.prompt_version_id = prompt_version_id
        if description is not None:
            existing_tag.description = description
        return existing_tag
    else:
        new_tag = models.PromptVersionTag(
            name=name,
            description=description,
            prompt_id=prompt_id,
            prompt_version_id=prompt_version_id,
            user_id=user_id,
        )
        session.add(new_tag)
        return new_tag
