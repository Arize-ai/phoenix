import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    HexColor,
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    get_dataset_by_identifier,
)
from phoenix.server.api.types.DatasetLabel import DatasetLabel as DatasetLabelNodeType
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked

logger = logging.getLogger(__name__)

router = APIRouter(tags=["datasets"])

DATASET_LABEL_NODE_NAME = DatasetLabelNodeType.__name__


class DatasetLabel(V1RoutesBaseModel):
    id: str
    name: str
    description: Optional[str]
    color: str


class DatasetLabelData(V1RoutesBaseModel):
    name: str = Field(..., min_length=1, description="The name of the dataset label")
    color: HexColor = Field(
        ...,
        description="A lowercase hex color code (e.g. '#00cc88') used to display the label",
    )
    description: Optional[str] = Field(
        default=None, description="An optional description of the dataset label"
    )


class CreateDatasetLabelRequestBody(DatasetLabelData):
    pass


class UpdateDatasetLabelRequestBody(V1RoutesBaseModel):
    """
    Fields to update on a dataset label. Omit a field to leave it unchanged.
    """

    name: Optional[str] = Field(
        default=UNDEFINED,
        min_length=1,
        description="New name for the label (null is rejected; name is required)",
    )
    color: Optional[HexColor] = Field(
        default=UNDEFINED,
        description="New lowercase hex color code for the label (null is rejected)",
    )
    description: Optional[str] = Field(
        default=UNDEFINED,
        description="New description for the label (null clears the description)",
    )


class SetDatasetLabelsRequestBody(V1RoutesBaseModel):
    dataset_label_ids: list[str] = Field(
        default_factory=list,
        description=(
            "The complete set of dataset label GlobalIDs to apply to the dataset. "
            "Labels not in this list are removed from the dataset; an empty list "
            "removes all labels."
        ),
    )


class GetDatasetLabelsResponseBody(PaginatedResponseBody[DatasetLabel]):
    pass


class GetDatasetLabelResponseBody(ResponseBody[DatasetLabel]):
    pass


class CreateDatasetLabelResponseBody(ResponseBody[DatasetLabel]):
    pass


class UpdateDatasetLabelResponseBody(ResponseBody[DatasetLabel]):
    pass


class ListDatasetLabelsForDatasetResponseBody(ResponseBody[list[DatasetLabel]]):
    pass


class AddDatasetLabelToDatasetResponseBody(ResponseBody[DatasetLabel]):
    pass


class SetDatasetLabelsForDatasetResponseBody(ResponseBody[list[DatasetLabel]]):
    pass


def _db_to_api_dataset_label(dataset_label: models.DatasetLabel) -> DatasetLabel:
    return DatasetLabel(
        id=str(GlobalID(DATASET_LABEL_NODE_NAME, str(dataset_label.id))),
        name=dataset_label.name,
        description=dataset_label.description,
        color=dataset_label.color,
    )


def _get_dataset_label_rowid(label_id: str) -> int:
    try:
        return from_global_id_with_expected_type(
            GlobalID.from_id(label_id), DATASET_LABEL_NODE_NAME
        )
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid dataset label ID: {label_id}",
        )


# ---------------------------------------------------------------------------
# Global dataset label CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/dataset_labels",
    operation_id="listDatasetLabels",
    summary="List dataset labels",
    description="Retrieve a paginated list of all dataset labels in the system.",
    responses=add_errors_to_responses([422]),
)
async def list_dataset_labels(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (a dataset label GlobalID)",
    ),
    limit: int = Query(
        default=100, gt=0, description="The max number of dataset labels to return at a time."
    ),
) -> GetDatasetLabelsResponseBody:
    cursor_id: Optional[int] = None
    if cursor:
        try:
            cursor_gid = GlobalID.from_id(cursor)
            if cursor_gid.type_name != DATASET_LABEL_NODE_NAME:
                raise ValueError
            cursor_id = int(cursor_gid.node_id)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid cursor: {cursor}")
    async with request.app.state.db() as session:
        query = (
            select(models.DatasetLabel)
            .order_by(models.DatasetLabel.id.desc())
            .limit(limit + 1)  # overfetch by 1 to check whether there are more results
        )
        if cursor_id is not None:
            query = query.where(models.DatasetLabel.id <= cursor_id)
        dataset_labels = (await session.scalars(query)).all()

        next_cursor: Optional[str] = None
        if len(dataset_labels) == limit + 1:
            last_label = dataset_labels[-1]
            next_cursor = str(GlobalID(DATASET_LABEL_NODE_NAME, str(last_label.id)))
            dataset_labels = dataset_labels[:-1]

        return GetDatasetLabelsResponseBody(
            next_cursor=next_cursor,
            data=[_db_to_api_dataset_label(label) for label in dataset_labels],
        )


@router.get(
    "/dataset_labels/{label_id}",
    operation_id="getDatasetLabel",
    summary="Get a dataset label by ID",
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset label not found"},
            {"status_code": 422, "description": "Invalid dataset label ID"},
        ]
    ),
)
async def get_dataset_label(
    request: Request,
    label_id: str = Path(description="The ID of the dataset label"),
) -> GetDatasetLabelResponseBody:
    label_rowid = _get_dataset_label_rowid(label_id)
    async with request.app.state.db() as session:
        dataset_label = await session.get(models.DatasetLabel, label_rowid)
        if dataset_label is None:
            raise HTTPException(status_code=404, detail="Dataset label not found")
        return GetDatasetLabelResponseBody(data=_db_to_api_dataset_label(dataset_label))


@router.post(
    "/dataset_labels",
    dependencies=[Depends(is_not_locked)],
    operation_id="createDatasetLabel",
    summary="Create a dataset label",
    status_code=201,
    responses=add_errors_to_responses(
        [
            {
                "status_code": 409,
                "description": "A dataset label with the same name already exists",
            },
            {"status_code": 422, "description": "Invalid request body"},
        ]
    ),
)
async def create_dataset_label(
    request: Request,
    request_body: CreateDatasetLabelRequestBody,
) -> CreateDatasetLabelResponseBody:
    async with request.app.state.db() as session:
        dataset_label = models.DatasetLabel(
            name=request_body.name,
            description=request_body.description,
            color=request_body.color,
        )
        session.add(dataset_label)
        try:
            await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=409,
                detail=f"A dataset label named '{request_body.name}' already exists",
            )
        data = _db_to_api_dataset_label(dataset_label)
    return CreateDatasetLabelResponseBody(data=data)


@router.patch(
    "/dataset_labels/{label_id}",
    dependencies=[Depends(is_not_locked)],
    operation_id="updateDatasetLabel",
    summary="Update a dataset label by ID",
    description=(
        "Partially update a dataset label's name, color, and/or description. Only the "
        "fields included in the request body are changed; omitted fields are left as-is."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset label not found"},
            {
                "status_code": 409,
                "description": "A dataset label with the same name already exists",
            },
            {"status_code": 422, "description": "Invalid dataset label ID or request body"},
        ]
    ),
)
async def update_dataset_label(
    request: Request,
    request_body: UpdateDatasetLabelRequestBody,
    label_id: str = Path(description="The ID of the dataset label"),
) -> UpdateDatasetLabelResponseBody:
    label_rowid = _get_dataset_label_rowid(label_id)

    patch = {
        column.key: patch_value
        for column, patch_value, column_is_nullable in (
            (models.DatasetLabel.name, request_body.name, False),
            (models.DatasetLabel.color, request_body.color, False),
            (models.DatasetLabel.description, request_body.description, True),
        )
        if patch_value is not UNDEFINED and (patch_value is not None or column_is_nullable)
    }
    if not patch:
        raise HTTPException(status_code=422, detail="No fields to update")

    async with request.app.state.db() as session:
        try:
            dataset_label = await session.scalar(
                update(models.DatasetLabel)
                .where(models.DatasetLabel.id == label_rowid)
                .values(**patch)
                .returning(models.DatasetLabel)
            )
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=409,
                detail=f"A dataset label named '{request_body.name}' already exists",
            )
        if dataset_label is None:
            raise HTTPException(status_code=404, detail="Dataset label not found")
        data = _db_to_api_dataset_label(dataset_label)
    return UpdateDatasetLabelResponseBody(data=data)


@router.delete(
    "/dataset_labels/{label_id}",
    operation_id="deleteDatasetLabel",
    summary="Delete a dataset label by ID",
    description=(
        "Delete a dataset label. This also removes the label from every dataset it is applied to."
    ),
    status_code=204,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset label not found"},
            {"status_code": 422, "description": "Invalid dataset label ID"},
        ]
    ),
)
async def delete_dataset_label(
    request: Request,
    label_id: str = Path(description="The ID of the dataset label"),
) -> Response:
    label_rowid = _get_dataset_label_rowid(label_id)
    async with request.app.state.db() as session:
        deleted = await session.scalar(
            delete(models.DatasetLabel)
            .where(models.DatasetLabel.id == label_rowid)
            .returning(models.DatasetLabel.id)
        )
        if deleted is None:
            raise HTTPException(status_code=404, detail="Dataset label not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Dataset <-> label membership
# ---------------------------------------------------------------------------


@router.get(
    "/datasets/{dataset_identifier}/labels",
    operation_id="listDatasetLabelsForDataset",
    summary="List the labels applied to a dataset",
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset not found"},
            {"status_code": 422, "description": "Invalid dataset identifier"},
        ]
    ),
)
async def list_dataset_labels_for_dataset(
    request: Request,
    dataset_identifier: str = Path(
        description="The dataset identifier: either the dataset ID (GlobalID) or its name.",
    ),
) -> ListDatasetLabelsForDatasetResponseBody:
    async with request.app.state.db() as session:
        dataset = await get_dataset_by_identifier(session, dataset_identifier)
        dataset_labels = (
            await session.scalars(
                select(models.DatasetLabel)
                .join(
                    models.DatasetsDatasetLabel,
                    models.DatasetsDatasetLabel.dataset_label_id == models.DatasetLabel.id,
                )
                .where(models.DatasetsDatasetLabel.dataset_id == dataset.id)
                .order_by(models.DatasetLabel.id.desc())
            )
        ).all()
    return ListDatasetLabelsForDatasetResponseBody(
        data=[_db_to_api_dataset_label(label) for label in dataset_labels]
    )


@router.put(
    "/datasets/{dataset_identifier}/labels/{label_id}",
    dependencies=[Depends(is_not_locked)],
    operation_id="addDatasetLabelToDataset",
    summary="Apply a label to a dataset",
    description=(
        "Apply an existing label to a dataset. This operation is idempotent: applying a "
        "label that is already applied is a no-op that returns the label."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset or dataset label not found"},
            {"status_code": 422, "description": "Invalid dataset identifier or dataset label ID"},
        ]
    ),
)
async def add_dataset_label_to_dataset(
    request: Request,
    dataset_identifier: str = Path(
        description="The dataset identifier: either the dataset ID (GlobalID) or its name.",
    ),
    label_id: str = Path(description="The ID of the dataset label to apply"),
) -> AddDatasetLabelToDatasetResponseBody:
    label_rowid = _get_dataset_label_rowid(label_id)
    async with request.app.state.db() as session:
        dataset = await get_dataset_by_identifier(session, dataset_identifier)
        dataset_label = await session.get(models.DatasetLabel, label_rowid)
        if dataset_label is None:
            raise HTTPException(status_code=404, detail="Dataset label not found")
        data = _db_to_api_dataset_label(dataset_label)
        already_applied = await session.scalar(
            select(models.DatasetsDatasetLabel).where(
                models.DatasetsDatasetLabel.dataset_id == dataset.id,
                models.DatasetsDatasetLabel.dataset_label_id == label_rowid,
            )
        )
        if already_applied is None:
            session.add(
                models.DatasetsDatasetLabel(
                    dataset_id=dataset.id,
                    dataset_label_id=label_rowid,
                )
            )
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                # A concurrent request applied the same label; treat as an idempotent no-op.
                await session.rollback()
    return AddDatasetLabelToDatasetResponseBody(data=data)


@router.delete(
    "/datasets/{dataset_identifier}/labels/{label_id}",
    operation_id="removeDatasetLabelFromDataset",
    summary="Remove a label from a dataset",
    description=(
        "Remove a label from a dataset without deleting the label itself. This operation "
        "is idempotent: removing a label that is not applied is a no-op."
    ),
    status_code=204,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset not found"},
            {"status_code": 422, "description": "Invalid dataset identifier or dataset label ID"},
        ]
    ),
)
async def remove_dataset_label_from_dataset(
    request: Request,
    dataset_identifier: str = Path(
        description="The dataset identifier: either the dataset ID (GlobalID) or its name.",
    ),
    label_id: str = Path(description="The ID of the dataset label to remove"),
) -> Response:
    label_rowid = _get_dataset_label_rowid(label_id)
    async with request.app.state.db() as session:
        dataset = await get_dataset_by_identifier(session, dataset_identifier)
        await session.execute(
            delete(models.DatasetsDatasetLabel).where(
                models.DatasetsDatasetLabel.dataset_id == dataset.id,
                models.DatasetsDatasetLabel.dataset_label_id == label_rowid,
            )
        )
    return Response(status_code=204)


@router.put(
    "/datasets/{dataset_identifier}/labels",
    dependencies=[Depends(is_not_locked)],
    operation_id="setDatasetLabelsForDataset",
    summary="Replace the set of labels applied to a dataset",
    description=(
        "Replace the entire set of labels applied to a dataset. Labels present in the "
        "request but not currently applied are added; labels currently applied but absent "
        "from the request are removed. An empty list removes all labels."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset or one or more dataset labels not found"},
            {"status_code": 422, "description": "Invalid dataset identifier or request body"},
        ]
    ),
)
async def set_dataset_labels_for_dataset(
    request: Request,
    request_body: SetDatasetLabelsRequestBody,
    dataset_identifier: str = Path(
        description="The dataset identifier: either the dataset ID (GlobalID) or its name.",
    ),
) -> SetDatasetLabelsForDatasetResponseBody:
    # De-duplicate while preserving order.
    label_rowids: dict[int, None] = {}
    for label_id in request_body.dataset_label_ids:
        label_rowids[_get_dataset_label_rowid(label_id)] = None

    async with request.app.state.db() as session:
        dataset = await get_dataset_by_identifier(session, dataset_identifier)

        if label_rowids:
            existing_label_rowids = set(
                (
                    await session.scalars(
                        select(models.DatasetLabel.id).where(
                            models.DatasetLabel.id.in_(label_rowids.keys())
                        )
                    )
                ).all()
            )
            if len(existing_label_rowids) != len(label_rowids):
                raise HTTPException(status_code=404, detail="One or more dataset labels not found")

        currently_applied = {
            row.dataset_label_id
            for row in (
                await session.scalars(
                    select(models.DatasetsDatasetLabel).where(
                        models.DatasetsDatasetLabel.dataset_id == dataset.id
                    )
                )
            ).all()
        }

        to_add = [rowid for rowid in label_rowids if rowid not in currently_applied]
        if to_add:
            session.add_all(
                [
                    models.DatasetsDatasetLabel(
                        dataset_id=dataset.id,
                        dataset_label_id=rowid,
                    )
                    for rowid in to_add
                ]
            )

        to_remove = [rowid for rowid in currently_applied if rowid not in label_rowids]
        if to_remove:
            await session.execute(
                delete(models.DatasetsDatasetLabel).where(
                    models.DatasetsDatasetLabel.dataset_id == dataset.id,
                    models.DatasetsDatasetLabel.dataset_label_id.in_(to_remove),
                )
            )

        await session.flush()

        dataset_labels = (
            await session.scalars(
                select(models.DatasetLabel)
                .join(
                    models.DatasetsDatasetLabel,
                    models.DatasetsDatasetLabel.dataset_label_id == models.DatasetLabel.id,
                )
                .where(models.DatasetsDatasetLabel.dataset_id == dataset.id)
                .order_by(models.DatasetLabel.id.desc())
            )
        ).all()
    return SetDatasetLabelsForDatasetResponseBody(
        data=[_db_to_api_dataset_label(label) for label in dataset_labels]
    )
