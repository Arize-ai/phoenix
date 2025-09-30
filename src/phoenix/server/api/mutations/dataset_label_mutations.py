from typing import Optional

import strawberry
from sqlalchemy import delete
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.DatasetLabel import DatasetLabel, to_gql_dataset_label
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDatasetLabelInput:
    name: str
    description: Optional[str] = UNSET
    color: str


@strawberry.type
class CreateDatasetLabelMutationPayload:
    dataset_label: DatasetLabel


@strawberry.input
class DeleteDatasetLabelsInput:
    dataset_label_ids: list[GlobalID]


@strawberry.type
class DeleteDatasetLabelsMutationPayload:
    dataset_labels: list[DatasetLabel]


@strawberry.type
class DatasetLabelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    async def create_dataset_label(
        self,
        info: Info[Context, None],
        input: CreateDatasetLabelInput,
    ) -> CreateDatasetLabelMutationPayload:
        name = input.name
        description = input.description
        color = input.color
        async with info.context.db() as session:
            dataset_label_orm = models.DatasetLabel(name=name, description=description, color=color)
            session.add(dataset_label_orm)
            await session.commit()
        return CreateDatasetLabelMutationPayload(
            dataset_label=to_gql_dataset_label(dataset_label_orm)
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
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
