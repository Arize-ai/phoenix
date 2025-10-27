from typing import Optional

import sqlalchemy
import strawberry
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlalchemy.sql import tuple_
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetLabel import DatasetLabel
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
        dataset_rowids: dict[
            int, None
        ] = {}  # use dictionary to de-duplicate while preserving order
        if input.dataset_ids:
            for dataset_id in input.dataset_ids:
                try:
                    dataset_rowid = from_global_id_with_expected_type(dataset_id, Dataset.__name__)
                except ValueError:
                    raise BadRequest(f"Invalid dataset ID: {dataset_id}")
                dataset_rowids[dataset_rowid] = None

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
                        select(models.Dataset).where(models.Dataset.id.in_(dataset_rowids.keys()))
                    )
                }
                if len(datasets_by_id) < len(dataset_rowids):
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
            dataset_label=DatasetLabel(id=dataset_label_orm.id, db_record=dataset_label_orm),
            datasets=[
                Dataset(
                    id=datasets_by_id[dataset_rowid].id, db_record=datasets_by_id[dataset_rowid]
                )
                for dataset_rowid in dataset_rowids
            ],
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
                DatasetLabel(
                    id=deleted_dataset_labels_by_id[dataset_label_row_id].id,
                    db_record=deleted_dataset_labels_by_id[dataset_label_row_id],
                )
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

        dataset_label_ids: dict[
            int, None
        ] = {}  # use dictionary to de-duplicate while preserving order
        for dataset_label_gid in input.dataset_label_ids:
            try:
                dataset_label_id = from_global_id_with_expected_type(
                    dataset_label_gid, DatasetLabel.__name__
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset label ID: {dataset_label_gid}")
            dataset_label_ids[dataset_label_id] = None

        async with info.context.db() as session:
            dataset = await session.scalar(
                select(models.Dataset)
                .where(models.Dataset.id == dataset_id)
                .options(joinedload(models.Dataset.datasets_dataset_labels))
            )

            if not dataset:
                raise NotFound(f"Dataset with ID {input.dataset_id} not found")

            existing_label_ids = (
                await session.scalars(
                    select(models.DatasetLabel.id).where(
                        models.DatasetLabel.id.in_(dataset_label_ids.keys())
                    )
                )
            ).all()
            if len(existing_label_ids) != len(dataset_label_ids):
                raise NotFound("One or more dataset labels not found")

            previously_applied_dataset_label_ids = {
                dataset_dataset_label.dataset_label_id
                for dataset_dataset_label in dataset.datasets_dataset_labels
            }

            datasets_dataset_labels_to_add = [
                models.DatasetsDatasetLabel(
                    dataset_id=dataset_id,
                    dataset_label_id=dataset_label_id,
                )
                for dataset_label_id in dataset_label_ids
                if dataset_label_id not in previously_applied_dataset_label_ids
            ]
            if datasets_dataset_labels_to_add:
                session.add_all(datasets_dataset_labels_to_add)
                await session.flush()

            datasets_dataset_labels_to_delete = [
                dataset_dataset_label
                for dataset_dataset_label in dataset.datasets_dataset_labels
                if dataset_dataset_label.dataset_label_id not in dataset_label_ids
            ]
            if datasets_dataset_labels_to_delete:
                await session.execute(
                    delete(models.DatasetsDatasetLabel).where(
                        tuple_(
                            models.DatasetsDatasetLabel.dataset_id,
                            models.DatasetsDatasetLabel.dataset_label_id,
                        ).in_(
                            [
                                (
                                    datasets_dataset_labels.dataset_id,
                                    datasets_dataset_labels.dataset_label_id,
                                )
                                for datasets_dataset_labels in datasets_dataset_labels_to_delete
                            ]
                        )
                    )
                )

        return SetDatasetLabelsMutationPayload(
            dataset=Dataset(id=dataset.id, db_record=dataset),
            query=Query(),
        )
