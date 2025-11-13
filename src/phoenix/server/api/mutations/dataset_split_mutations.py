from typing import Optional

import strawberry
from sqlalchemy import delete, func, insert, select, tuple_
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
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
class SetDatasetExampleSplitsInput:
    example_id: GlobalID
    dataset_split_ids: list[GlobalID]


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
class SetDatasetExampleSplitsMutationPayload:
    query: "Query"
    example: DatasetExample


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
    async def set_dataset_example_splits(
        self, info: Info[Context, None], input: SetDatasetExampleSplitsInput
    ) -> SetDatasetExampleSplitsMutationPayload:
        try:
            example_id = from_global_id_with_expected_type(
                input.example_id, models.DatasetExample.__name__
            )
        except ValueError:
            raise BadRequest(f"Invalid example ID: {input.example_id}")

        dataset_split_ids: dict[
            int, None
        ] = {}  # use dictionary to de-duplicate while preserving order
        for dataset_split_gid in input.dataset_split_ids:
            try:
                dataset_split_id = from_global_id_with_expected_type(
                    dataset_split_gid, DatasetSplit.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset split ID: {dataset_split_gid}")
            dataset_split_ids[dataset_split_id] = None

        async with info.context.db() as session:
            example = await session.scalar(
                select(models.DatasetExample)
                .where(models.DatasetExample.id == example_id)
                .options(joinedload(models.DatasetExample.dataset_splits_dataset_examples))
            )

            if not example:
                raise NotFound(f"Example with ID {input.example_id} not found")

            existing_split_ids = (
                await session.scalars(
                    select(models.DatasetSplit.id).where(
                        models.DatasetSplit.id.in_(dataset_split_ids.keys())
                    )
                )
            ).all()
            if len(existing_split_ids) != len(dataset_split_ids):
                raise NotFound("One or more dataset splits not found")

            previously_applied_dataset_split_ids = {
                dataset_split_dataset_example.dataset_split_id
                for dataset_split_dataset_example in example.dataset_splits_dataset_examples
            }

            # Do deletes first, then adds to prevent duplicate key errors
            dataset_splits_dataset_examples_to_delete = [
                dataset_split_dataset_example
                for dataset_split_dataset_example in example.dataset_splits_dataset_examples
                if dataset_split_dataset_example.dataset_split_id not in dataset_split_ids
            ]
            if dataset_splits_dataset_examples_to_delete:
                await session.execute(
                    delete(models.DatasetSplitDatasetExample).where(
                        tuple_(
                            models.DatasetSplitDatasetExample.dataset_split_id,
                            models.DatasetSplitDatasetExample.dataset_example_id,
                        ).in_(
                            [
                                (
                                    dataset_split_dataset_example.dataset_split_id,
                                    dataset_split_dataset_example.dataset_example_id,
                                )
                                for dataset_split_dataset_example in dataset_splits_dataset_examples_to_delete
                            ]
                        )
                    )
                )
                await session.flush()

            dataset_splits_dataset_examples_to_add = [
                models.DatasetSplitDatasetExample(
                    dataset_example_id=example_id,
                    dataset_split_id=dataset_split_id,
                )
                for dataset_split_id in dataset_split_ids
                if dataset_split_id not in previously_applied_dataset_split_ids
            ]
            if dataset_splits_dataset_examples_to_add:
                session.add_all(dataset_splits_dataset_examples_to_add)
                await session.flush()

        return SetDatasetExampleSplitsMutationPayload(
            example=DatasetExample(id=example.id, db_record=example),
            query=Query(),
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
