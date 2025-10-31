from typing import Optional

import strawberry
from sqlalchemy import delete, func, insert, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.api.queries import Query
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetSplit import DatasetSplit
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDatasetSplitInput:
    name: str
    description: Optional[str] = UNSET
    color: str
    metadata: Optional[JSON] = UNSET


@strawberry.input
class PatchDatasetSplitInput:
    dataset_split_id: GlobalID
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
    color: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET


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
    description: Optional[str] = UNSET
    color: str
    metadata: Optional[JSON] = UNSET
    example_ids: list[GlobalID]


@strawberry.type
class DatasetSplitMutationPayload:
    dataset_split: DatasetSplit
    query: "Query"


@strawberry.type
class DatasetSplitMutationPayloadWithExamples:
    dataset_split: DatasetSplit
    query: "Query"
    examples: list[DatasetExample]


@strawberry.type
class DeleteDatasetSplitsMutationPayload:
    dataset_splits: list[DatasetSplit]
    query: "Query"


@strawberry.type
class AddDatasetExamplesToDatasetSplitsMutationPayload:
    query: "Query"
    examples: list[DatasetExample]


@strawberry.type
class RemoveDatasetExamplesFromDatasetSplitsMutationPayload:
    query: "Query"
    examples: list[DatasetExample]


@strawberry.type
class DatasetSplitMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_split(
        self, info: Info[Context, None], input: CreateDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        user_id = get_user(info)
        validated_name = _validated_name(input.name)
        async with info.context.db() as session:
            dataset_split_orm = models.DatasetSplit(
                name=validated_name,
                description=input.description,
                color=input.color,
                metadata_=input.metadata or {},
                user_id=user_id,
            )
            session.add(dataset_split_orm)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset split named '{input.name}' already exists.")
        return DatasetSplitMutationPayload(
            dataset_split=DatasetSplit(id=dataset_split_orm.id, db_record=dataset_split_orm),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_dataset_split(
        self, info: Info[Context, None], input: PatchDatasetSplitInput
    ) -> DatasetSplitMutationPayload:
        validated_name = _validated_name(input.name) if input.name else None
        async with info.context.db() as session:
            dataset_split_id = from_global_id_with_expected_type(
                input.dataset_split_id, DatasetSplit.__name__
            )
            dataset_split_orm = await session.get(models.DatasetSplit, dataset_split_id)
            if not dataset_split_orm:
                raise NotFound(f"Dataset split with ID {input.dataset_split_id} not found")

            if validated_name:
                dataset_split_orm.name = validated_name
            if input.description:
                dataset_split_orm.description = input.description
            if input.color:
                dataset_split_orm.color = input.color
            if isinstance(input.metadata, dict):
                dataset_split_orm.metadata_ = input.metadata

            gql_dataset_split = DatasetSplit(id=dataset_split_orm.id, db_record=dataset_split_orm)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("A dataset split with this name already exists")

        return DatasetSplitMutationPayload(
            dataset_split=gql_dataset_split,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_dataset_splits(
        self, info: Info[Context, None], input: DeleteDatasetSplitInput
    ) -> DeleteDatasetSplitsMutationPayload:
        unique_dataset_split_rowids: dict[int, None] = {}  # use a dict to preserve ordering
        for dataset_split_gid in input.dataset_split_ids:
            try:
                dataset_split_rowid = from_global_id_with_expected_type(
                    dataset_split_gid, DatasetSplit.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset split ID: {dataset_split_gid}")
            unique_dataset_split_rowids[dataset_split_rowid] = None
        dataset_split_rowids = list(unique_dataset_split_rowids.keys())

        async with info.context.db() as session:
            deleted_splits_by_id = {
                split.id: split
                for split in (
                    await session.scalars(
                        delete(models.DatasetSplit)
                        .where(models.DatasetSplit.id.in_(dataset_split_rowids))
                        .returning(models.DatasetSplit)
                    )
                ).all()
            }
            if len(deleted_splits_by_id) < len(dataset_split_rowids):
                await session.rollback()
                raise NotFound("One or more dataset splits not found")
            await session.commit()

        return DeleteDatasetSplitsMutationPayload(
            dataset_splits=[
                DatasetSplit(
                    id=deleted_splits_by_id[dataset_split_rowid].id,
                    db_record=deleted_splits_by_id[dataset_split_rowid],
                )
                for dataset_split_rowid in dataset_split_rowids
            ],
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def add_dataset_examples_to_dataset_splits(
        self, info: Info[Context, None], input: AddDatasetExamplesToDatasetSplitsInput
    ) -> AddDatasetExamplesToDatasetSplitsMutationPayload:
        if not input.example_ids:
            raise BadRequest("No examples provided.")
        if not input.dataset_split_ids:
            raise BadRequest("No dataset splits provided.")

        unique_dataset_split_rowids: set[int] = set()
        for dataset_split_gid in input.dataset_split_ids:
            try:
                dataset_split_rowid = from_global_id_with_expected_type(
                    dataset_split_gid, DatasetSplit.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset split ID: {dataset_split_gid}")
            unique_dataset_split_rowids.add(dataset_split_rowid)
        dataset_split_rowids = list(unique_dataset_split_rowids)

        unique_example_rowids: set[int] = set()
        for example_gid in input.example_ids:
            try:
                example_rowid = from_global_id_with_expected_type(
                    example_gid, models.DatasetExample.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid example ID: {example_gid}")
            unique_example_rowids.add(example_rowid)
        example_rowids = list(unique_example_rowids)

        async with info.context.db() as session:
            existing_dataset_split_ids = (
                await session.scalars(
                    select(models.DatasetSplit.id).where(
                        models.DatasetSplit.id.in_(dataset_split_rowids)
                    )
                )
            ).all()
            if len(existing_dataset_split_ids) != len(dataset_split_rowids):
                raise NotFound("One or more dataset splits not found")

            # Find existing (dataset_split_id, dataset_example_id) keys to avoid duplicates
            # Users can submit multiple examples at once which can have
            # indeterminate participation in multiple splits
            existing_dataset_example_split_keys = await session.execute(
                select(
                    models.DatasetSplitDatasetExample.dataset_split_id,
                    models.DatasetSplitDatasetExample.dataset_example_id,
                ).where(
                    models.DatasetSplitDatasetExample.dataset_split_id.in_(dataset_split_rowids)
                    & models.DatasetSplitDatasetExample.dataset_example_id.in_(example_rowids)
                )
            )
            unique_dataset_example_split_keys = set(existing_dataset_example_split_keys.all())

            # Compute all desired pairs and insert only missing
            values = []
            for dataset_split_rowid in dataset_split_rowids:
                for example_rowid in example_rowids:
                    # if the keys already exists, skip
                    if (dataset_split_rowid, example_rowid) in unique_dataset_example_split_keys:
                        continue
                    dataset_split_id_key = models.DatasetSplitDatasetExample.dataset_split_id.key
                    dataset_example_id_key = (
                        models.DatasetSplitDatasetExample.dataset_example_id.key
                    )
                    values.append(
                        {
                            dataset_split_id_key: dataset_split_rowid,
                            dataset_example_id_key: example_rowid,
                        }
                    )

            if values:
                try:
                    await session.execute(insert(models.DatasetSplitDatasetExample), values)
                    await session.flush()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                    raise Conflict("Failed to add examples to dataset splits.") from e

            examples = (
                await session.scalars(
                    select(models.DatasetExample).where(
                        models.DatasetExample.id.in_(example_rowids)
                    )
                )
            ).all()
        return AddDatasetExamplesToDatasetSplitsMutationPayload(
            query=Query(),
            examples=[DatasetExample(id=example.id, db_record=example) for example in examples],
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def remove_dataset_examples_from_dataset_splits(
        self, info: Info[Context, None], input: RemoveDatasetExamplesFromDatasetSplitsInput
    ) -> RemoveDatasetExamplesFromDatasetSplitsMutationPayload:
        if not input.dataset_split_ids:
            raise BadRequest("No dataset splits provided.")
        if not input.example_ids:
            raise BadRequest("No examples provided.")

        unique_dataset_split_rowids: set[int] = set()
        for dataset_split_gid in input.dataset_split_ids:
            try:
                dataset_split_rowid = from_global_id_with_expected_type(
                    dataset_split_gid, DatasetSplit.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset split ID: {dataset_split_gid}")
            unique_dataset_split_rowids.add(dataset_split_rowid)
        dataset_split_rowids = list(unique_dataset_split_rowids)

        unique_example_rowids: set[int] = set()
        for example_gid in input.example_ids:
            try:
                example_rowid = from_global_id_with_expected_type(
                    example_gid, models.DatasetExample.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid example ID: {example_gid}")
            unique_example_rowids.add(example_rowid)
        example_rowids = list(unique_example_rowids)

        stmt = delete(models.DatasetSplitDatasetExample).where(
            models.DatasetSplitDatasetExample.dataset_split_id.in_(dataset_split_rowids)
            & models.DatasetSplitDatasetExample.dataset_example_id.in_(example_rowids)
        )
        async with info.context.db() as session:
            existing_dataset_split_ids = (
                await session.scalars(
                    select(models.DatasetSplit.id).where(
                        models.DatasetSplit.id.in_(dataset_split_rowids)
                    )
                )
            ).all()
            if len(existing_dataset_split_ids) != len(dataset_split_rowids):
                raise NotFound("One or more dataset splits not found")

            await session.execute(stmt)

            examples = (
                await session.scalars(
                    select(models.DatasetExample).where(
                        models.DatasetExample.id.in_(example_rowids)
                    )
                )
            ).all()

        return RemoveDatasetExamplesFromDatasetSplitsMutationPayload(
            query=Query(),
            examples=[DatasetExample(id=example.id, db_record=example) for example in examples],
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_split_with_examples(
        self, info: Info[Context, None], input: CreateDatasetSplitWithExamplesInput
    ) -> DatasetSplitMutationPayloadWithExamples:
        user_id = get_user(info)
        validated_name = _validated_name(input.name)
        unique_example_rowids: set[int] = set()
        for example_gid in input.example_ids:
            try:
                example_rowid = from_global_id_with_expected_type(
                    example_gid, models.DatasetExample.__name__
                )
                unique_example_rowids.add(example_rowid)
            except ValueError:
                raise BadRequest(f"Invalid example ID: {example_gid}")
        example_rowids = list(unique_example_rowids)
        async with info.context.db() as session:
            if example_rowids:
                found_count = await session.scalar(
                    select(func.count(models.DatasetExample.id)).where(
                        models.DatasetExample.id.in_(example_rowids)
                    )
                )
                if found_count is None or found_count < len(example_rowids):
                    raise NotFound("One or more dataset examples were not found.")

            dataset_split_orm = models.DatasetSplit(
                name=validated_name,
                description=input.description or None,
                color=input.color,
                metadata_=input.metadata or {},
                user_id=user_id,
            )
            session.add(dataset_split_orm)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset split named '{validated_name}' already exists.")

            if example_rowids:
                values = [
                    {
                        models.DatasetSplitDatasetExample.dataset_split_id.key: dataset_split_orm.id,  # noqa: E501
                        models.DatasetSplitDatasetExample.dataset_example_id.key: example_id,
                    }
                    for example_id in example_rowids
                ]
                try:
                    await session.execute(insert(models.DatasetSplitDatasetExample), values)
                except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                    # Roll back the transaction on association failure
                    await session.rollback()
                    raise Conflict(
                        "Failed to associate examples with the new dataset split."
                    ) from e

            examples = (
                await session.scalars(
                    select(models.DatasetExample).where(
                        models.DatasetExample.id.in_(example_rowids)
                    )
                )
            ).all()

        return DatasetSplitMutationPayloadWithExamples(
            dataset_split=DatasetSplit(id=dataset_split_orm.id, db_record=dataset_split_orm),
            query=Query(),
            examples=[DatasetExample(id=example.id, db_record=example) for example in examples],
        )


def _validated_name(name: str) -> str:
    validated_name = name.strip()
    if not validated_name:
        raise BadRequest("Name cannot be empty")
    return validated_name
