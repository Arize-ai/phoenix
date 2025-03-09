# file: PromptLabelMutations.py

from typing import Optional

import strawberry
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptLabel import PromptLabel, to_gql_prompt_label


@strawberry.input
class CreatePromptLabelInput:
    name: Identifier
    description: Optional[str] = None


@strawberry.input
class PatchPromptLabelInput:
    prompt_label_id: GlobalID
    name: Optional[Identifier] = None
    description: Optional[str] = None


@strawberry.input
class DeletePromptLabelInput:
    prompt_label_id: GlobalID


@strawberry.input
class SetPromptLabelInput:
    prompt_id: GlobalID
    prompt_label_id: GlobalID


@strawberry.input
class UnsetPromptLabelInput:
    prompt_id: GlobalID
    prompt_label_id: GlobalID


@strawberry.type
class PromptLabelMutationPayload:
    prompt_label: Optional["PromptLabel"]
    query: "Query"


@strawberry.type
class PromptLabelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_prompt_label(
        self, info: Info[Context, None], input: CreatePromptLabelInput
    ) -> PromptLabelMutationPayload:
        async with info.context.db() as session:
            name = IdentifierModel.model_validate(str(input.name))
            label_orm = models.PromptLabel(name=name, description=input.description)
            session.add(label_orm)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A prompt label named '{name}' already exists.")

            return PromptLabelMutationPayload(
                prompt_label=to_gql_prompt_label(label_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_prompt_label(
        self, info: Info[Context, None], input: PatchPromptLabelInput
    ) -> PromptLabelMutationPayload:
        validated_name = IdentifierModel.model_validate(str(input.name)) if input.name else None
        async with info.context.db() as session:
            label_id = from_global_id_with_expected_type(
                input.prompt_label_id, PromptLabel.__name__
            )

            label_orm = await session.get(models.PromptLabel, label_id)
            if not label_orm:
                raise NotFound(f"PromptLabel with ID {input.prompt_label_id} not found")

            if validated_name is not None:
                label_orm.name = validated_name.root
            if input.description is not None:
                label_orm.description = input.description

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Error patching PromptLabel. Possibly a name conflict?")

            return PromptLabelMutationPayload(
                prompt_label=to_gql_prompt_label(label_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_prompt_label(
        self, info: Info[Context, None], input: DeletePromptLabelInput
    ) -> PromptLabelMutationPayload:
        """
        Deletes a PromptLabel (and any crosswalk references).
        """
        async with info.context.db() as session:
            label_id = from_global_id_with_expected_type(
                input.prompt_label_id, PromptLabel.__name__
            )
            stmt = delete(models.PromptLabel).where(models.PromptLabel.id == label_id)
            result = await session.execute(stmt)

            if result.rowcount == 0:
                raise NotFound(f"PromptLabel with ID {input.prompt_label_id} not found")

            await session.commit()

            return PromptLabelMutationPayload(
                prompt_label=None,
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def set_prompt_label(
        self, info: Info[Context, None], input: SetPromptLabelInput
    ) -> PromptLabelMutationPayload:
        async with info.context.db() as session:
            prompt_id = from_global_id_with_expected_type(input.prompt_id, Prompt.__name__)
            label_id = from_global_id_with_expected_type(
                input.prompt_label_id, PromptLabel.__name__
            )

            crosswalk = models.PromptPromptLabel(prompt_id=prompt_id, prompt_label_id=label_id)
            session.add(crosswalk)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                # The error could be:
                # - Unique constraint violation => row already exists
                # - Foreign key violation => prompt_id or label_id doesn't exist
                raise Conflict("Failed to associate PromptLabel with Prompt.") from e

            label_orm = await session.get(models.PromptLabel, label_id)
            if not label_orm:
                raise NotFound(f"PromptLabel with ID {input.prompt_label_id} not found")

            return PromptLabelMutationPayload(
                prompt_label=to_gql_prompt_label(label_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def unset_prompt_label(
        self, info: Info[Context, None], input: UnsetPromptLabelInput
    ) -> PromptLabelMutationPayload:
        """
        Unsets a PromptLabel from a Prompt by removing the row in the crosswalk.
        """
        async with info.context.db() as session:
            prompt_id = from_global_id_with_expected_type(input.prompt_id, Prompt.__name__)
            label_id = from_global_id_with_expected_type(
                input.prompt_label_id, PromptLabel.__name__
            )

            stmt = delete(models.PromptPromptLabel).where(
                (models.PromptPromptLabel.prompt_id == prompt_id)
                & (models.PromptPromptLabel.prompt_label_id == label_id)
            )
            result = await session.execute(stmt)

            if result.rowcount == 0:
                raise NotFound(f"No association between prompt={prompt_id} and label={label_id}.")

            await session.commit()

            label_orm = await session.get(models.PromptLabel, label_id)
            return PromptLabelMutationPayload(
                prompt_label=to_gql_prompt_label(label_orm) if label_orm else None,
                query=Query(),
            )
