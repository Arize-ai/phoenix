# file: PromptLabelMutations.py

from typing import Optional

import strawberry
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptLabel import PromptLabel


@strawberry.input
class CreatePromptLabelInput:
    name: str
    description: Optional[str] = None
    color: str


@strawberry.input
class PatchPromptLabelInput:
    prompt_label_id: GlobalID
    name: Optional[str] = None
    description: Optional[str] = None


@strawberry.input
class DeletePromptLabelsInput:
    prompt_label_ids: list[GlobalID]


@strawberry.input
class SetPromptLabelsInput:
    prompt_id: GlobalID
    prompt_label_ids: list[GlobalID]


@strawberry.input
class UnsetPromptLabelsInput:
    prompt_id: GlobalID
    prompt_label_ids: list[GlobalID]


@strawberry.type
class PromptLabelMutationPayload:
    prompt_labels: list["PromptLabel"]
    query: "Query"


@strawberry.type
class PromptLabelDeleteMutationPayload:
    deleted_prompt_label_ids: list["GlobalID"]
    query: "Query"


@strawberry.type
class PromptLabelAssociationMutationPayload:
    query: "Query"


@strawberry.type
class PromptLabelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_prompt_label(
        self, info: Info[Context, None], input: CreatePromptLabelInput
    ) -> PromptLabelMutationPayload:
        async with info.context.db() as session:
            label_orm = models.PromptLabel(
                name=input.name, description=input.description, color=input.color
            )
            session.add(label_orm)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A prompt label named '{input.name}' already exists.")

            return PromptLabelMutationPayload(
                prompt_labels=[PromptLabel(id=label_orm.id, db_record=label_orm)],
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_prompt_label(
        self, info: Info[Context, None], input: PatchPromptLabelInput
    ) -> PromptLabelMutationPayload:
        async with info.context.db() as session:
            label_id = from_global_id_with_expected_type(
                input.prompt_label_id, PromptLabel.__name__
            )

            label_orm = await session.get(models.PromptLabel, label_id)
            if not label_orm:
                raise NotFound(f"PromptLabel with ID {input.prompt_label_id} not found")

            if input.name is not None:
                label_orm.name = input.name
            if input.description is not None:
                label_orm.description = input.description

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Error patching PromptLabel. Possibly a name conflict?")

            return PromptLabelMutationPayload(
                prompt_labels=[PromptLabel(id=label_orm.id, db_record=label_orm)],
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_prompt_labels(
        self, info: Info[Context, None], input: DeletePromptLabelsInput
    ) -> PromptLabelDeleteMutationPayload:
        """
        Deletes a PromptLabel (and any crosswalk references).
        """
        async with info.context.db() as session:
            label_ids = [
                from_global_id_with_expected_type(prompt_label_id, PromptLabel.__name__)
                for prompt_label_id in input.prompt_label_ids
            ]
            stmt = delete(models.PromptLabel).where(models.PromptLabel.id.in_(label_ids))
            await session.execute(stmt)

            await session.commit()

            return PromptLabelDeleteMutationPayload(
                deleted_prompt_label_ids=input.prompt_label_ids,
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def set_prompt_labels(
        self, info: Info[Context, None], input: SetPromptLabelsInput
    ) -> PromptLabelAssociationMutationPayload:
        async with info.context.db() as session:
            prompt_id = from_global_id_with_expected_type(input.prompt_id, Prompt.__name__)
            label_ids = [
                from_global_id_with_expected_type(prompt_label_id, PromptLabel.__name__)
                for prompt_label_id in input.prompt_label_ids
            ]

            crosswalk_items = [
                models.PromptPromptLabel(prompt_id=prompt_id, prompt_label_id=label_id)
                for label_id in label_ids
            ]
            session.add_all(crosswalk_items)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                # The error could be:
                # - Unique constraint violation => row already exists
                # - Foreign key violation => prompt_id or label_id doesn't exist
                raise Conflict("Failed to associate PromptLabel with Prompt.") from e

            return PromptLabelAssociationMutationPayload(
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def unset_prompt_labels(
        self, info: Info[Context, None], input: UnsetPromptLabelsInput
    ) -> PromptLabelAssociationMutationPayload:
        """
        Unsets a PromptLabel from a Prompt by removing the row in the crosswalk.
        """
        async with info.context.db() as session:
            prompt_id = from_global_id_with_expected_type(input.prompt_id, Prompt.__name__)
            label_ids = [
                from_global_id_with_expected_type(prompt_label_id, PromptLabel.__name__)
                for prompt_label_id in input.prompt_label_ids
            ]

            stmt = delete(models.PromptPromptLabel).where(
                (models.PromptPromptLabel.prompt_id == prompt_id)
                & (models.PromptPromptLabel.prompt_label_id.in_(label_ids))
            )
            result = await session.execute(stmt)

            if result.rowcount != len(label_ids):  # type: ignore[attr-defined]
                label_ids_str = ", ".join(str(i) for i in label_ids)
                raise NotFound(
                    f"No association between prompt={prompt_id} and labels={label_ids_str}."
                )

            await session.commit()

            return PromptLabelAssociationMutationPayload(
                query=Query(),
            )
