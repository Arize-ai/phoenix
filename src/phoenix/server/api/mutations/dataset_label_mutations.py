from typing import Optional

import sqlalchemy
import strawberry
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset, to_gql_dataset
from phoenix.server.api.types.DatasetLabel import DatasetLabel, to_gql_dataset_label
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDatasetLabelInput:
    name: str
    description: Optional[str] = UNSET
    color: str
    dataset_ids: Optional[list[GlobalID]] = UNSET


@strawberry.type
class CreateDatasetLabelMutationPayload:
    dataset_label: DatasetLabel
    datasets: list[Dataset]


@strawberry.input
class DeleteDatasetLabelsInput:
    dataset_label_ids: list[GlobalID]


@strawberry.type
class DeleteDatasetLabelsMutationPayload:
    dataset_labels: list[DatasetLabel]


@strawberry.input
class UpdateDatasetLabelInput:
    dataset_label_id: GlobalID
    name: str
    description: Optional[str] = None
    color: str


@strawberry.type
class UpdateDatasetLabelMutationPayload:
    dataset_label: DatasetLabel


@strawberry.input
class SetDatasetLabelsInput:
    dataset_id: GlobalID
    dataset_label_ids: list[GlobalID]


@strawberry.type
class SetDatasetLabelsMutationPayload:
    query: Query
    dataset: Dataset


@strawberry.type
class DatasetLabelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_label(
        self,
        info: Info[Context, None],
        input: CreateDatasetLabelInput,
    ) -> CreateDatasetLabelMutationPayload:
        name = input.name
        description = input.description
        color = input.color
        dataset_rowids: list[int] = []
        if input.dataset_ids:
            for dataset_id in input.dataset_ids:
                try:
                    dataset_rowid = from_global_id_with_expected_type(dataset_id, Dataset.__name__)
                except ValueError:
                    raise BadRequest(f"Invalid dataset ID: {dataset_id}")
                dataset_rowids.append(dataset_rowid)

        async with info.context.db() as session:
            dataset_label_orm = models.DatasetLabel(name=name, description=description, color=color)
            session.add(dataset_label_orm)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset label named '{name}' already exists")
            except sqlalchemy.exc.StatementError as error:
                raise BadRequest(str(error.orig))

            datasets_by_id: dict[int, models.Dataset] = {}
            if dataset_rowids:
                datasets_by_id = {
                    dataset.id: dataset
                    for dataset in await session.scalars(
                        select(models.Dataset).where(models.Dataset.id.in_(dataset_rowids))
                    )
                }
                if len(datasets_by_id) != len(dataset_rowids):
                    raise NotFound("One or more datasets not found")
                session.add_all(
                    [
                        models.DatasetsDatasetLabel(
                            dataset_id=dataset_rowid,
                            dataset_label_id=dataset_label_orm.id,
                        )
                        for dataset_rowid in dataset_rowids
                    ]
                )
                await session.commit()

        return CreateDatasetLabelMutationPayload(
            dataset_label=to_gql_dataset_label(dataset_label_orm),
            datasets=[
                to_gql_dataset(datasets_by_id[dataset_rowid]) for dataset_rowid in dataset_rowids
            ],
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_label(
        self, info: Info[Context, None], input: UpdateDatasetLabelInput
    ) -> UpdateDatasetLabelMutationPayload:
        if not input.name or not input.name.strip():
            raise BadRequest("Dataset label name cannot be empty")

        try:
            dataset_label_id = from_global_id_with_expected_type(
                input.dataset_label_id, DatasetLabel.__name__
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset label ID: {input.dataset_label_id}")

        async with info.context.db() as session:
            dataset_label_orm = await session.get(models.DatasetLabel, dataset_label_id)
            if not dataset_label_orm:
                raise NotFound(f"DatasetLabel with ID {input.dataset_label_id} not found")

            dataset_label_orm.name = input.name.strip()
            dataset_label_orm.description = input.description
            dataset_label_orm.color = input.color.strip()

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A dataset label named '{input.name}' already exists")
            except sqlalchemy.exc.StatementError as error:
                raise BadRequest(str(error.orig))
        return UpdateDatasetLabelMutationPayload(
            dataset_label=to_gql_dataset_label(dataset_label_orm)
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_dataset_labels(
        self, info: Info[Context, None], input: DeleteDatasetLabelsInput
    ) -> DeleteDatasetLabelsMutationPayload:
        dataset_label_row_ids: dict[int, None] = {}
        for dataset_label_node_id in input.dataset_label_ids:
            try:
                dataset_label_row_id = from_global_id_with_expected_type(
                    dataset_label_node_id, DatasetLabel.__name__
                )
            except ValueError:
                raise BadRequest(f"Unknown dataset label: {dataset_label_node_id}")
            dataset_label_row_ids[dataset_label_row_id] = None
        async with info.context.db() as session:
            stmt = (
                delete(models.DatasetLabel)
                .where(models.DatasetLabel.id.in_(dataset_label_row_ids.keys()))
                .returning(models.DatasetLabel)
            )
            deleted_dataset_labels = (await session.scalars(stmt)).all()
            if len(deleted_dataset_labels) < len(dataset_label_row_ids):
                await session.rollback()
                raise NotFound("Could not find one or more dataset labels with given IDs")
        deleted_dataset_labels_by_id = {
            dataset_label.id: dataset_label for dataset_label in deleted_dataset_labels
        }
        return DeleteDatasetLabelsMutationPayload(
            dataset_labels=[
                to_gql_dataset_label(deleted_dataset_labels_by_id[dataset_label_row_id])
                for dataset_label_row_id in dataset_label_row_ids
            ]
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def set_dataset_labels(
        self, info: Info[Context, None], input: SetDatasetLabelsInput
    ) -> SetDatasetLabelsMutationPayload:
        try:
            dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
        except ValueError:
            raise BadRequest(f"Invalid dataset ID: {input.dataset_id}")

        dataset_label_ids: list[int] = []
        for dataset_label_gid in input.dataset_label_ids:
            try:
                dataset_label_id = from_global_id_with_expected_type(
                    dataset_label_gid, DatasetLabel.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset label ID: {dataset_label_gid}")
            dataset_label_ids.append(dataset_label_id)

        async with info.context.db() as session:
            dataset = await session.get(models.Dataset, dataset_id)
            if not dataset:
                raise NotFound(f"Dataset with ID {input.dataset_id} not found")

            if dataset_label_ids:
                existing_label_ids = (
                    await session.scalars(
                        select(models.DatasetLabel.id).where(
                            models.DatasetLabel.id.in_(dataset_label_ids)
                        )
                    )
                ).all()
                if len(existing_label_ids) != len(dataset_label_ids):
                    raise NotFound("One or more dataset labels not found")

            await session.execute(
                delete(models.DatasetsDatasetLabel).where(
                    models.DatasetsDatasetLabel.dataset_id == dataset_id
                )
            )

            if dataset_label_ids:
                datasets_dataset_labels = [
                    models.DatasetsDatasetLabel(
                        dataset_id=dataset_id,
                        dataset_label_id=dataset_label_id,
                    )
                    for dataset_label_id in dataset_label_ids
                ]
                session.add_all(datasets_dataset_labels)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                raise Conflict("Failed to set dataset labels.") from e

        return SetDatasetLabelsMutationPayload(
            dataset=to_gql_dataset(dataset),
            query=Query(),
        )
