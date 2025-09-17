from typing import Optional

import strawberry
from sqlalchemy import delete, func, insert, select
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
from phoenix.server.api.types.DatasetSplit import DatasetSplit, to_gql_dataset_split
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDatasetSplitInput:
    name: Identifier
    description: Optional[str] = None


@strawberry.input
class PatchDatasetSplitInput:
    dataset_split_id: GlobalID
    name: Optional[Identifier] = None
    description: Optional[str] = None


@strawberry.input
class DeleteDatasetSplitInput:
    dataset_split_id: GlobalID


@strawberry.input
class SetDatasetSplitInput:
    dataset_id: GlobalID
    dataset_split_id: GlobalID


@strawberry.input
class UnsetDatasetSplitInput:
    dataset_id: GlobalID
    dataset_split_id: GlobalID


@strawberry.input
class AddDatasetExamplesToDatasetSplitInput:
    dataset_split_id: GlobalID
    example_ids: list[GlobalID]


@strawberry.input
class RemoveDatasetExamplesFromDatasetSplitInput:
    dataset_split_id: GlobalID
    example_ids: list[GlobalID]


@strawberry.input
class CreateDatasetSplitWithExamplesInput:
    name: Identifier
    description: Optional[str] = None
    example_ids: list[GlobalID]


@strawberry.type
class DatasetSplitMutationPayload:
    dataset_split: DatasetSplit
    query: "Query"


@strawberry.type
class DatasetSplitMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_dataset_split(
        self, info: Info[Context, None], input: CreateDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        async with info.context.db() as session:
            name = IdentifierModel.model_validate(str(input.name))
            dataset_split_orm = models.DatasetSplit(
                name=name.root,
                description=input.description,
            )
            session.add(dataset_split_orm)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset split named '{name}' already exists.")
            return DatasetSplitMutationPayload(
                dataset_split=to_gql_dataset_split(dataset_split_orm), query=Query()
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_dataset_split(
        self, info: Info[Context, None], input: PatchDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        validated_name = IdentifierModel.model_validate(str(input.name)) if input.name else None
        async with info.context.db() as session:
            dataset_split_id = from_global_id_with_expected_type(
                input.dataset_split_id, DatasetSplit.__name__
            )
            dataset_split_orm = await session.get(models.DatasetSplit, dataset_split_id)
            if not dataset_split_orm:
                raise NotFound(f"DatasetSplit with ID {input.dataset_split_id} not found")

            if validated_name is not None:
                dataset_split_orm.name = validated_name.root
            if input.description is not None:
                dataset_split_orm.description = input.description

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Error patching DatasetSplit. Possibly a name conflict?")

            return DatasetSplitMutationPayload(
                dataset_split=to_gql_dataset_split(dataset_split_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_dataset_split(
        self, info: Info[Context, None], input: DeleteDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        async with info.context.db() as session:
            dataset_split_id = from_global_id_with_expected_type(
                input.dataset_split_id, DatasetSplit.__name__
            )

            # Load the split first so we can return it in the payload after deletion
            dataset_split_orm = await session.get(models.DatasetSplit, dataset_split_id)
            if not dataset_split_orm:
                raise NotFound(f"DatasetSplit with ID {input.dataset_split_id} not found")

            stmt = delete(models.DatasetSplit).where(models.DatasetSplit.id == dataset_split_id)
            result = await session.execute(stmt)
            if result.rowcount == 0:
                raise NotFound(f"DatasetSplit with ID {input.dataset_split_id} not found")
            await session.commit()

            return DatasetSplitMutationPayload(
                dataset_split=to_gql_dataset_split(dataset_split_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def set_dataset_split(
        self, info: Info[Context, None], input: SetDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        # Not yet implemented: requires a dataset <-> dataset_split relationship design.
        raise Conflict("Setting a dataset split on a dataset is not implemented.")

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def unset_dataset_split(
        self, info: Info[Context, None], input: UnsetDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        # Not yet implemented: requires a dataset <-> dataset_split relationship design.
        raise Conflict("Unsetting a dataset split on a dataset is not implemented.")

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def add_dataset_examples_to_dataset_split(
        self, info: Info[Context, None], input: AddDatasetExamplesToDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        async with info.context.db() as session:
            dataset_split_id = from_global_id_with_expected_type(
                input.dataset_split_id, DatasetSplit.__name__
            )
            example_ids = [
                from_global_id_with_expected_type(example_id, models.DatasetExample.__name__)
                for example_id in input.example_ids
            ]
            if not example_ids:
                raise Conflict("No examples provided.")

            # Filter out already-associated example IDs to avoid unique constraint violations
            existing_example_ids = set(
                await session.scalars(
                    select(models.DatasetSplitDatasetExample.dataset_example_id).where(
                        (models.DatasetSplitDatasetExample.dataset_split_id == dataset_split_id)
                        & (models.DatasetSplitDatasetExample.dataset_example_id.in_(example_ids))
                    )
                )
            )
            missing_ids = [eid for eid in example_ids if eid not in existing_example_ids]

            if missing_ids:
                values = [
                    {
                        models.DatasetSplitDatasetExample.dataset_split_id.key: dataset_split_id,
                        models.DatasetSplitDatasetExample.dataset_example_id.key: example_id,
                    }
                    for example_id in missing_ids
                ]
                try:
                    await session.execute(insert(models.DatasetSplitDatasetExample), values)
                    await session.flush()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                    raise Conflict("Failed to add examples to dataset split.") from e

            dataset_split_orm = await session.get(models.DatasetSplit, dataset_split_id)
            assert dataset_split_orm is not None
            return DatasetSplitMutationPayload(
                dataset_split=to_gql_dataset_split(dataset_split_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def remove_dataset_examples_from_dataset_split(
        self, info: Info[Context, None], input: RemoveDatasetExamplesFromDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        async with info.context.db() as session:
            dataset_split_id = from_global_id_with_expected_type(
                input.dataset_split_id, DatasetSplit.__name__
            )
            example_ids = [
                from_global_id_with_expected_type(example_id, models.DatasetExample.__name__)
                for example_id in input.example_ids
            ]
            if not example_ids:
                raise Conflict("No examples provided.")

            stmt = delete(models.DatasetSplitDatasetExample).where(
                (models.DatasetSplitDatasetExample.dataset_split_id == dataset_split_id)
                & (models.DatasetSplitDatasetExample.dataset_example_id.in_(example_ids))
            )
            await session.execute(stmt)
            await session.flush()

            dataset_split_orm = await session.get(models.DatasetSplit, dataset_split_id)
            if not dataset_split_orm:
                raise NotFound(f"DatasetSplit with ID {input.dataset_split_id} not found")
            return DatasetSplitMutationPayload(
                dataset_split=to_gql_dataset_split(dataset_split_orm),
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_dataset_split_with_examples(
        self, info: Info[Context, None], input: CreateDatasetSplitWithExamplesInput
    ) -> DatasetSplitMutationPayload:
        validated_name = IdentifierModel.model_validate(str(input.name))
        example_ids = [
            from_global_id_with_expected_type(example_id, models.DatasetExample.__name__)
            for example_id in input.example_ids
        ]
        async with info.context.db() as session:
            # Optionally verify all examples exist to provide better error messages
            if example_ids:
                found_count = await session.scalar(
                    select(func.count(models.DatasetExample.id)).where(
                        models.DatasetExample.id.in_(example_ids)
                    )
                )
                if found_count is None or int(found_count) != len(example_ids):
                    raise NotFound("One or more dataset examples were not found.")

            dataset_split_orm = models.DatasetSplit(
                name=validated_name.root,
                description=input.description,
            )
            session.add(dataset_split_orm)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset split named '{validated_name.root}' already exists.")

            if example_ids:
                values = [
                    {
                        models.DatasetSplitDatasetExample.dataset_split_id.key: dataset_split_orm.id,  # noqa: E501
                        models.DatasetSplitDatasetExample.dataset_example_id.key: example_id,
                    }
                    for example_id in example_ids
                ]
                try:
                    await session.execute(insert(models.DatasetSplitDatasetExample), values)
                except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                    # Roll back the transaction on association failure
                    await session.rollback()
                    raise Conflict(
                        "Failed to associate examples with the new dataset split."
                    ) from e

            await session.commit()
            return DatasetSplitMutationPayload(
                dataset_split=to_gql_dataset_split(dataset_split_orm),
                query=Query(),
            )
