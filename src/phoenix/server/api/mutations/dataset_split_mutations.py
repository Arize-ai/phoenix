from typing import Optional

import strawberry
from sqlalchemy import delete, func, insert, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.DatasetSplit import DatasetSplit, to_gql_dataset_split
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDatasetSplitInput:
    name: str
    description: Optional[str] = None
    color: str


@strawberry.input
class PatchDatasetSplitInput:
    dataset_split_id: GlobalID
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


@strawberry.input
class DeleteDatasetSplitInput:
    dataset_split_ids: list[GlobalID]


@strawberry.input
class AddDatasetExamplesToDatasetSplitsInput:
    dataset_split_ids: list[GlobalID]
    example_ids: list[GlobalID]


@strawberry.input
class RemoveDatasetExamplesFromDatasetSplitsInput:
    dataset_split_ids: list[GlobalID]
    example_ids: list[GlobalID]


@strawberry.input
class CreateDatasetSplitWithExamplesInput:
    name: str
    description: Optional[str] = None
    color: str = None
    example_ids: list[GlobalID]


@strawberry.type
class DatasetSplitMutationPayload:
    dataset_split: DatasetSplit
    query: "Query"


@strawberry.type
class DeleteDatasetSplitsMutationPayload:
    dataset_splits: list[DatasetSplit]
    query: "Query"


@strawberry.type
class AddDatasetExamplesToDatasetSplitsMutationPayload:
    query: "Query"


@strawberry.type
class RemoveDatasetExamplesFromDatasetSplitsMutationPayload:
    query: "Query"


@strawberry.type
class DatasetSplitMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_dataset_split(
        self, info: Info[Context, None], input: CreateDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        async with info.context.db() as session:
            dataset_split_orm = models.DatasetSplit(
                name=str(input.name),
                description=input.description,
                color=input.color,
            )
            session.add(dataset_split_orm)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset split named '{input.name}' already exists.")
        return DatasetSplitMutationPayload(
            dataset_split=to_gql_dataset_split(dataset_split_orm), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def patch_dataset_split(
        self, info: Info[Context, None], input: PatchDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        validated_name = str(input.name) if input.name else None
        async with info.context.db() as session:
            dataset_split_id = from_global_id_with_expected_type(
                input.dataset_split_id, DatasetSplit.__name__
            )
            dataset_split_orm = await session.get(models.DatasetSplit, dataset_split_id)
            if not dataset_split_orm:
                raise NotFound(f"DatasetSplit with ID {input.dataset_split_id} not found")

            if validated_name is not None:
                dataset_split_orm.name = validated_name
            if input.description is not None:
                dataset_split_orm.description = input.description
            if input.color is not None:
                dataset_split_orm.color = input.color

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Error patching DatasetSplit. Possibly a name conflict?")

        return DatasetSplitMutationPayload(
            dataset_split=to_gql_dataset_split(dataset_split_orm),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_dataset_splits(
        self, info: Info[Context, None], input: DeleteDatasetSplitInput
    ) -> DeleteDatasetSplitsMutationPayload:
        async with info.context.db() as session:
            dataset_split_ids = [
                from_global_id_with_expected_type(dataset_split_id, DatasetSplit.__name__)
                for dataset_split_id in input.dataset_split_ids
            ]

            stmt = (
                delete(models.DatasetSplit)
                .where(models.DatasetSplit.id.in_(dataset_split_ids))
                .returning(models.DatasetSplit)
            )
            result = (await session.scalars(stmt)).all()
            if len(result) != len(dataset_split_ids):
                raise NotFound("One or more Dataset Splits not found")
            await session.commit()

        return DeleteDatasetSplitsMutationPayload(
            dataset_splits=[
                to_gql_dataset_split(dataset_split_orm) for dataset_split_orm in result
            ],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def add_dataset_examples_to_dataset_splits(
        self, info: Info[Context, None], input: AddDatasetExamplesToDatasetSplitsInput
    ) -> AddDatasetExamplesToDatasetSplitsMutationPayload:
        async with info.context.db() as session:
            dataset_split_ids = [
                from_global_id_with_expected_type(dataset_split_id, DatasetSplit.__name__)
                for dataset_split_id in input.dataset_split_ids
            ]
            example_ids = [
                from_global_id_with_expected_type(example_id, models.DatasetExample.__name__)
                for example_id in input.example_ids
            ]
            if not example_ids:
                raise Conflict("No examples provided.")
            if not dataset_split_ids:
                raise Conflict("No dataset splits provided.")

            # Find existing (dataset_split_id, dataset_example_id) keys to avoid duplicates
            # Users can submit multiple examples at once which can have
            # indeterminate participation in multiple splits
            existing_dataset_example_split_keys = await session.execute(
                select(
                    models.DatasetSplitDatasetExample.dataset_split_id,
                    models.DatasetSplitDatasetExample.dataset_example_id,
                ).where(
                    models.DatasetSplitDatasetExample.dataset_split_id.in_(dataset_split_ids)
                    & models.DatasetSplitDatasetExample.dataset_example_id.in_(example_ids)
                )
            )
            unique_dataset_example_split_keys = set(existing_dataset_example_split_keys.all())

            # Compute all desired pairs and insert only missing
            values = []
            for dataset_split_id in dataset_split_ids:
                for example_id in example_ids:
                    # if the keys already exists, skip
                    if (dataset_split_id, example_id) in unique_dataset_example_split_keys:
                        continue
                    dataset_split_id_key = models.DatasetSplitDatasetExample.dataset_split_id.key
                    values.append(
                        {
                            dataset_split_id_key: dataset_split_id,
                            models.DatasetSplitDatasetExample.dataset_example_id.key: example_id,
                        }
                    )

            if values:
                try:
                    await session.execute(insert(models.DatasetSplitDatasetExample), values)
                    await session.flush()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                    raise Conflict("Failed to add examples to dataset splits.") from e

        return AddDatasetExamplesToDatasetSplitsMutationPayload(
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def remove_dataset_examples_from_dataset_splits(
        self, info: Info[Context, None], input: RemoveDatasetExamplesFromDatasetSplitsInput
    ) -> RemoveDatasetExamplesFromDatasetSplitsMutationPayload:
        async with info.context.db() as session:
            dataset_split_ids = [
                from_global_id_with_expected_type(dataset_split_id, DatasetSplit.__name__)
                for dataset_split_id in input.dataset_split_ids
            ]
            example_ids = [
                from_global_id_with_expected_type(example_id, models.DatasetExample.__name__)
                for example_id in input.example_ids
            ]
            if not example_ids:
                raise Conflict("No examples provided.")

            stmt = delete(models.DatasetSplitDatasetExample).where(
                models.DatasetSplitDatasetExample.dataset_split_id.in_(dataset_split_ids)
                & models.DatasetSplitDatasetExample.dataset_example_id.in_(example_ids)
            )

            await session.execute(stmt)
            await session.flush()

        return RemoveDatasetExamplesFromDatasetSplitsMutationPayload(
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_dataset_split_with_examples(
        self, info: Info[Context, None], input: CreateDatasetSplitWithExamplesInput
    ) -> DatasetSplitMutationPayload:
        validated_name = input.name
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
                name=validated_name,
                description=input.description,
                color=input.color,
            )
            session.add(dataset_split_orm)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset split named '{validated_name}' already exists.")

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
