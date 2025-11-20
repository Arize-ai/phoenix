import csv
import gzip
import io
import json
import logging
import urllib
import zlib
from asyncio import QueueFull
from collections import Counter
from collections.abc import Awaitable, Callable, Coroutine, Iterator, Mapping, Sequence
from datetime import datetime
from enum import Enum
from functools import partial
from typing import Any, Optional, Union, cast

import pandas as pd
import pyarrow as pa
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import and_, case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData, UploadFile
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import (
    HTTP_404_NOT_FOUND,
)
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import get_eval_trace_ids_for_datasets, get_project_names_for_datasets
from phoenix.db.insertion.dataset import (
    DatasetAction,
    DatasetExampleAdditionEvent,
    ExampleContent,
    add_dataset_examples,
)
from phoenix.db.types.db_models import UNDEFINED
from phoenix.server.api.types.Dataset import Dataset as DatasetNodeType
from phoenix.server.api.types.DatasetExample import DatasetExample as DatasetExampleNodeType
from phoenix.server.api.types.DatasetSplit import DatasetSplit as DatasetSplitNodeType
from phoenix.server.api.types.DatasetVersion import DatasetVersion as DatasetVersionNodeType
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.utils import delete_projects, delete_traces
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import DatasetInsertEvent

from .models import V1RoutesBaseModel
from .utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    add_text_csv_content_to_responses,
)

csv.field_size_limit(
    1_000_000_000  # allows large field sizes for CSV upload (1GB)
)


logger = logging.getLogger(__name__)

DATASET_NODE_NAME = DatasetNodeType.__name__
DATASET_VERSION_NODE_NAME = DatasetVersionNodeType.__name__


router = APIRouter(tags=["datasets"])


class Dataset(V1RoutesBaseModel):
    id: str
    name: str
    description: Optional[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    example_count: int


class ListDatasetsResponseBody(PaginatedResponseBody[Dataset]):
    pass


@router.get(
    "/datasets",
    operation_id="listDatasets",
    summary="List datasets",
    responses=add_errors_to_responses([422]),
)
async def list_datasets(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination",
    ),
    name: Optional[str] = Query(default=None, description="An optional dataset name to filter by"),
    limit: int = Query(
        default=10, description="The max number of datasets to return at a time.", gt=0
    ),
) -> ListDatasetsResponseBody:
    async with request.app.state.db() as session:
        value = case(
            (models.DatasetExampleRevision.revision_kind == "CREATE", 1),
            (models.DatasetExampleRevision.revision_kind == "DELETE", -1),
        )
        query = (
            select(models.Dataset)
            .add_columns(func.coalesce(func.sum(value), 0).label("example_count"))
            .outerjoin_from(models.Dataset, models.DatasetExample)
            .outerjoin_from(models.DatasetExample, models.DatasetExampleRevision)
            .group_by(models.Dataset.id)
            .order_by(models.Dataset.id.desc())
        )

        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                query = query.filter(models.Dataset.id <= int(cursor_id))
            except ValueError:
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=422,
                )
        if name:
            query = query.filter(models.Dataset.name == name)

        query = query.limit(limit + 1)
        result = await session.execute(query)
        datasets = result.all()
        if not datasets:
            return ListDatasetsResponseBody(next_cursor=None, data=[])

        next_cursor = None
        if len(datasets) == limit + 1:
            dataset = datasets[-1][0]
            next_cursor = str(GlobalID(DATASET_NODE_NAME, str(dataset.id)))
            datasets = datasets[:-1]

        data = []
        for row in datasets:
            dataset = row[0]
            data.append(
                Dataset(
                    id=str(GlobalID(DATASET_NODE_NAME, str(dataset.id))),
                    name=dataset.name,
                    description=dataset.description,
                    metadata=dataset.metadata_,
                    created_at=dataset.created_at,
                    updated_at=dataset.updated_at,
                    example_count=row[1],
                )
            )

        return ListDatasetsResponseBody(next_cursor=next_cursor, data=data)


@router.delete(
    "/datasets/{id}",
    operation_id="deleteDatasetById",
    summary="Delete dataset by ID",
    status_code=204,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Dataset not found"},
            {"status_code": 422, "description": "Invalid dataset ID"},
        ]
    ),
)
async def delete_dataset(
    request: Request, id: str = Path(description="The ID of the dataset to delete.")
) -> None:
    if id:
        try:
            dataset_id = from_global_id_with_expected_type(
                GlobalID.from_id(id),
                DATASET_NODE_NAME,
            )
        except ValueError:
            raise HTTPException(detail=f"Invalid Dataset ID: {id}", status_code=422)
    else:
        raise HTTPException(detail="Missing Dataset ID", status_code=422)
    project_names_stmt = get_project_names_for_datasets(dataset_id)
    eval_trace_ids_stmt = get_eval_trace_ids_for_datasets(dataset_id)
    stmt = (
        delete(models.Dataset).where(models.Dataset.id == dataset_id).returning(models.Dataset.id)
    )
    async with request.app.state.db() as session:
        project_names = await session.scalars(project_names_stmt)
        eval_trace_ids = await session.scalars(eval_trace_ids_stmt)
        if (await session.scalar(stmt)) is None:
            raise HTTPException(detail="Dataset does not exist", status_code=404)
    tasks = BackgroundTasks()
    tasks.add_task(delete_projects, request.app.state.db, *project_names)
    tasks.add_task(delete_traces, request.app.state.db, *eval_trace_ids)


class DatasetWithExampleCount(Dataset):
    example_count: int


class GetDatasetResponseBody(ResponseBody[DatasetWithExampleCount]):
    pass


@router.get(
    "/datasets/{id}",
    operation_id="getDataset",
    summary="Get dataset by ID",
    responses=add_errors_to_responses([404]),
)
async def get_dataset(
    request: Request, id: str = Path(description="The ID of the dataset")
) -> GetDatasetResponseBody:
    try:
        dataset_id = GlobalID.from_id(id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid dataset ID format: {id}",
            status_code=422,
        ) from e

    if (type_name := dataset_id.type_name) != DATASET_NODE_NAME:
        raise HTTPException(detail=f"ID {dataset_id} refers to a f{type_name}", status_code=404)
    async with request.app.state.db() as session:
        result = await session.execute(
            select(models.Dataset, models.Dataset.example_count).filter(
                models.Dataset.id == int(dataset_id.node_id)
            )
        )
        dataset_query = result.first()
        dataset = dataset_query[0] if dataset_query else None
        example_count = dataset_query[1] if dataset_query else 0
        if dataset is None:
            raise HTTPException(detail=f"Dataset with ID {dataset_id} not found", status_code=404)

        dataset = DatasetWithExampleCount(
            id=str(dataset_id),
            name=dataset.name,
            description=dataset.description,
            metadata=dataset.metadata_,
            created_at=dataset.created_at,
            updated_at=dataset.updated_at,
            example_count=example_count,
        )
        return GetDatasetResponseBody(data=dataset)


class DatasetVersion(V1RoutesBaseModel):
    version_id: str
    description: Optional[str]
    metadata: dict[str, Any]
    created_at: datetime


class ListDatasetVersionsResponseBody(PaginatedResponseBody[DatasetVersion]):
    pass


@router.get(
    "/datasets/{id}/versions",
    operation_id="listDatasetVersionsByDatasetId",
    summary="List dataset versions",
    responses=add_errors_to_responses([422]),
)
async def list_dataset_versions(
    request: Request,
    id: str = Path(description="The ID of the dataset"),
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination",
    ),
    limit: int = Query(
        default=10, description="The max number of dataset versions to return at a time", gt=0
    ),
) -> ListDatasetVersionsResponseBody:
    if id:
        try:
            dataset_id = from_global_id_with_expected_type(
                GlobalID.from_id(id),
                DATASET_NODE_NAME,
            )
        except ValueError:
            raise HTTPException(
                detail=f"Invalid Dataset ID: {id}",
                status_code=422,
            )
    else:
        raise HTTPException(
            detail="Missing Dataset ID",
            status_code=422,
        )
    stmt = (
        select(models.DatasetVersion)
        .where(models.DatasetVersion.dataset_id == dataset_id)
        .order_by(models.DatasetVersion.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        try:
            dataset_version_id = from_global_id_with_expected_type(
                GlobalID.from_id(cursor), DATASET_VERSION_NODE_NAME
            )
        except ValueError:
            raise HTTPException(
                detail=f"Invalid cursor: {cursor}",
                status_code=422,
            )
        max_dataset_version_id = (
            select(models.DatasetVersion.id)
            .where(models.DatasetVersion.id == dataset_version_id)
            .where(models.DatasetVersion.dataset_id == dataset_id)
        ).scalar_subquery()
        stmt = stmt.filter(models.DatasetVersion.id <= max_dataset_version_id)
    async with request.app.state.db() as session:
        data = [
            DatasetVersion(
                version_id=str(GlobalID(DATASET_VERSION_NODE_NAME, str(version.id))),
                description=version.description,
                metadata=version.metadata_,
                created_at=version.created_at,
            )
            async for version in await session.stream_scalars(stmt)
        ]
    next_cursor = data.pop().version_id if len(data) == limit + 1 else None
    return ListDatasetVersionsResponseBody(data=data, next_cursor=next_cursor)


class UploadDatasetData(V1RoutesBaseModel):
    dataset_id: str
    version_id: str


class UploadDatasetResponseBody(ResponseBody[UploadDatasetData]):
    pass


@router.post(
    "/datasets/upload",
    dependencies=[Depends(is_not_locked)],
    operation_id="uploadDataset",
    summary="Upload dataset from JSON, CSV, or PyArrow",
    responses=add_errors_to_responses(
        [
            {
                "status_code": 409,
                "description": "Dataset of the same name already exists",
            },
            {"status_code": 422, "description": "Invalid request body"},
        ]
    ),
    # FastAPI cannot generate the request body portion of the OpenAPI schema for
    # routes that accept multiple request content types, so we have to provide
    # this part of the schema manually. For context, see
    # https://github.com/tiangolo/fastapi/discussions/7786 and
    # https://github.com/tiangolo/fastapi/issues/990
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["name", "inputs"],
                        "properties": {
                            "action": {"type": "string", "enum": ["create", "append"]},
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "inputs": {"type": "array", "items": {"type": "object"}},
                            "outputs": {"type": "array", "items": {"type": "object"}},
                            "metadata": {"type": "array", "items": {"type": "object"}},
                        },
                    }
                },
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["name", "input_keys[]", "output_keys[]", "file"],
                        "properties": {
                            "action": {"type": "string", "enum": ["create", "append"]},
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "input_keys[]": {
                                "type": "array",
                                "items": {"type": "string"},
                                "uniqueItems": True,
                            },
                            "output_keys[]": {
                                "type": "array",
                                "items": {"type": "string"},
                                "uniqueItems": True,
                            },
                            "metadata_keys[]": {
                                "type": "array",
                                "items": {"type": "string"},
                                "uniqueItems": True,
                            },
                            "file": {"type": "string", "format": "binary"},
                        },
                    }
                },
            }
        },
    },
)
async def upload_dataset(
    request: Request,
    sync: bool = Query(
        default=False,
        description="If true, fulfill request synchronously and return JSON containing dataset_id.",
    ),
) -> Optional[UploadDatasetResponseBody]:
    request_content_type = request.headers.get("content-type")
    if not request_content_type:
        raise HTTPException(
            detail="Missing content-type header",
            status_code=400,
        )
    examples: Union[Examples, Awaitable[Examples]]
    if request_content_type.startswith("application/json"):
        try:
            examples, action, name, description = await run_in_threadpool(
                _process_json, await request.json()
            )
        except ValueError as e:
            raise HTTPException(
                detail=str(e),
                status_code=422,
            )
        if action is DatasetAction.CREATE:
            async with request.app.state.db() as session:
                if await _check_table_exists(session, name):
                    raise HTTPException(
                        detail=f"Dataset with the same name already exists: {name=}",
                        status_code=409,
                    )
    elif request_content_type.startswith("multipart/form-data"):
        async with request.form() as form:
            try:
                (
                    action,
                    name,
                    description,
                    input_keys,
                    output_keys,
                    metadata_keys,
                    file,
                ) = await _parse_form_data(form)
            except ValueError as e:
                raise HTTPException(
                    detail=str(e),
                    status_code=422,
                )
            if action is DatasetAction.CREATE:
                async with request.app.state.db() as session:
                    if await _check_table_exists(session, name):
                        raise HTTPException(
                            detail=f"Dataset with the same name already exists: {name=}",
                            status_code=409,
                        )
            content = await file.read()
        try:
            file_content_type = FileContentType(file.content_type)
            if file_content_type is FileContentType.CSV:
                encoding = FileContentEncoding(file.headers.get("content-encoding"))
                examples = await _process_csv(
                    content, encoding, input_keys, output_keys, metadata_keys
                )
            elif file_content_type is FileContentType.PYARROW:
                examples = await _process_pyarrow(content, input_keys, output_keys, metadata_keys)
            else:
                assert_never(file_content_type)
        except ValueError as e:
            raise HTTPException(
                detail=str(e),
                status_code=422,
            )
    else:
        raise HTTPException(
            detail="Invalid request Content-Type",
            status_code=422,
        )
    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)
    operation = cast(
        Callable[[AsyncSession], Awaitable[DatasetExampleAdditionEvent]],
        partial(
            add_dataset_examples,
            examples=examples,
            action=action,
            name=name,
            description=description,
            user_id=user_id,
        ),
    )
    if sync:
        async with request.app.state.db() as session:
            event = await operation(session)
            dataset_id = event.dataset_id
            version_id = event.dataset_version_id
        request.state.event_queue.put(DatasetInsertEvent((dataset_id,)))
        return UploadDatasetResponseBody(
            data=UploadDatasetData(
                dataset_id=str(GlobalID(Dataset.__name__, str(dataset_id))),
                version_id=str(GlobalID(DatasetVersion.__name__, str(version_id))),
            )
        )
    try:
        request.state.enqueue_operation(operation)
    except QueueFull:
        if isinstance(examples, Coroutine):
            examples.close()
        raise HTTPException(detail="Too many requests.", status_code=429)
    return None


class FileContentType(Enum):
    CSV = "text/csv"
    PYARROW = "application/x-pandas-pyarrow"

    @classmethod
    def _missing_(cls, v: Any) -> "FileContentType":
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        raise ValueError(f"Invalid file content type: {v}")


class FileContentEncoding(Enum):
    NONE = "none"
    GZIP = "gzip"
    DEFLATE = "deflate"

    @classmethod
    def _missing_(cls, v: Any) -> "FileContentEncoding":
        if v is None:
            return cls("none")
        if isinstance(v, str) and v and v.isascii() and not v.islower():
            return cls(v.lower())
        raise ValueError(f"Invalid file content encoding: {v}")


Name: TypeAlias = str
Description: TypeAlias = Optional[str]
InputKeys: TypeAlias = frozenset[str]
OutputKeys: TypeAlias = frozenset[str]
MetadataKeys: TypeAlias = frozenset[str]
DatasetId: TypeAlias = int
Examples: TypeAlias = Iterator[ExampleContent]


def _process_json(
    data: Mapping[str, Any],
) -> tuple[Examples, DatasetAction, Name, Description]:
    name = data.get("name")
    if not name:
        raise ValueError("Dataset name is required")
    description = data.get("description") or ""
    inputs = data.get("inputs")
    if not inputs:
        raise ValueError("input is required")
    if not isinstance(inputs, list) or not _is_all_dict(inputs):
        raise ValueError("Input should be a list containing only dictionary objects")
    outputs, metadata = data.get("outputs"), data.get("metadata")
    for k, v in {"outputs": outputs, "metadata": metadata}.items():
        if v and not (isinstance(v, list) and len(v) == len(inputs) and _is_all_dict(v)):
            raise ValueError(
                f"{k} should be a list of same length as input containing only dictionary objects"
            )
    examples: list[ExampleContent] = []
    for i, obj in enumerate(inputs):
        example = ExampleContent(
            input=obj,
            output=outputs[i] if outputs else {},
            metadata=metadata[i] if metadata else {},
        )
        examples.append(example)
    action = DatasetAction(cast(Optional[str], data.get("action")) or "create")
    return iter(examples), action, name, description


async def _process_csv(
    content: bytes,
    content_encoding: FileContentEncoding,
    input_keys: InputKeys,
    output_keys: OutputKeys,
    metadata_keys: MetadataKeys,
) -> Examples:
    if content_encoding is FileContentEncoding.GZIP:
        content = await run_in_threadpool(gzip.decompress, content)
    elif content_encoding is FileContentEncoding.DEFLATE:
        content = await run_in_threadpool(zlib.decompress, content)
    elif content_encoding is not FileContentEncoding.NONE:
        assert_never(content_encoding)
    reader = await run_in_threadpool(lambda c: csv.DictReader(io.StringIO(c.decode())), content)
    if reader.fieldnames is None:
        raise ValueError("Missing CSV column header")
    (header, freq), *_ = Counter(reader.fieldnames).most_common(1)
    if freq > 1:
        raise ValueError(f"Duplicated column header in CSV file: {header}")
    column_headers = frozenset(reader.fieldnames)
    _check_keys_exist(column_headers, input_keys, output_keys, metadata_keys)
    return (
        ExampleContent(
            input={k: row.get(k) for k in input_keys},
            output={k: row.get(k) for k in output_keys},
            metadata={k: row.get(k) for k in metadata_keys},
        )
        for row in iter(reader)
    )


async def _process_pyarrow(
    content: bytes,
    input_keys: InputKeys,
    output_keys: OutputKeys,
    metadata_keys: MetadataKeys,
) -> Awaitable[Examples]:
    try:
        reader = pa.ipc.open_stream(content)
    except pa.ArrowInvalid as e:
        raise ValueError("File is not valid pyarrow") from e
    column_headers = frozenset(reader.schema.names)
    _check_keys_exist(column_headers, input_keys, output_keys, metadata_keys)

    def get_examples() -> Iterator[ExampleContent]:
        for row in reader.read_pandas().to_dict(orient="records"):
            yield ExampleContent(
                input={k: row.get(k) for k in input_keys},
                output={k: row.get(k) for k in output_keys},
                metadata={k: row.get(k) for k in metadata_keys},
            )

    return run_in_threadpool(get_examples)


async def _check_table_exists(session: AsyncSession, name: str) -> bool:
    return bool(
        await session.scalar(
            select(1).select_from(models.Dataset).where(models.Dataset.name == name)
        )
    )


def _check_keys_exist(
    column_headers: frozenset[str],
    input_keys: InputKeys,
    output_keys: OutputKeys,
    metadata_keys: MetadataKeys,
) -> None:
    for desc, keys in (
        ("input", input_keys),
        ("output", output_keys),
        ("metadata", metadata_keys),
    ):
        if keys and (diff := keys.difference(column_headers)):
            raise ValueError(f"{desc} keys not found in column headers: {diff}")


async def _parse_form_data(
    form: FormData,
) -> tuple[
    DatasetAction,
    Name,
    Description,
    InputKeys,
    OutputKeys,
    MetadataKeys,
    UploadFile,
]:
    name = cast(Optional[str], form.get("name"))
    if not name:
        raise ValueError("Dataset name must not be empty")
    action = DatasetAction(cast(Optional[str], form.get("action")) or "create")
    file = form["file"]
    if not isinstance(file, UploadFile):
        raise ValueError("Malformed file in form data.")
    description = cast(Optional[str], form.get("description")) or file.filename
    input_keys = frozenset(filter(bool, cast(list[str], form.getlist("input_keys[]"))))
    output_keys = frozenset(filter(bool, cast(list[str], form.getlist("output_keys[]"))))
    metadata_keys = frozenset(filter(bool, cast(list[str], form.getlist("metadata_keys[]"))))
    return (
        action,
        name,
        description,
        input_keys,
        output_keys,
        metadata_keys,
        file,
    )


class DatasetExample(V1RoutesBaseModel):
    id: str
    input: dict[str, Any]
    output: dict[str, Any]
    metadata: dict[str, Any]
    updated_at: datetime


class ListDatasetExamplesData(V1RoutesBaseModel):
    dataset_id: str
    version_id: str
    filtered_splits: list[str] = UNDEFINED
    examples: list[DatasetExample]


class ListDatasetExamplesResponseBody(ResponseBody[ListDatasetExamplesData]):
    pass


@router.get(
    "/datasets/{id}/examples",
    operation_id="getDatasetExamples",
    summary="Get examples from a dataset",
    responses=add_errors_to_responses([404]),
)
async def get_dataset_examples(
    request: Request,
    id: str = Path(description="The ID of the dataset"),
    version_id: Optional[str] = Query(
        default=None,
        description=(
            "The ID of the dataset version (if omitted, returns data from the latest version)"
        ),
    ),
    split: Optional[list[str]] = Query(
        default=None,
        description="List of dataset split identifiers (GlobalIDs or names) to filter by",
    ),
) -> ListDatasetExamplesResponseBody:
    try:
        dataset_gid = GlobalID.from_id(id)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid dataset ID format: {id}",
            status_code=422,
        ) from e

    if version_id:
        try:
            version_gid = GlobalID.from_id(version_id)
        except Exception as e:
            raise HTTPException(
                detail=f"Invalid dataset version ID format: {version_id}",
                status_code=422,
            ) from e
    else:
        version_gid = None

    if (dataset_type := dataset_gid.type_name) != "Dataset":
        raise HTTPException(detail=f"ID {dataset_gid} refers to a {dataset_type}", status_code=404)

    if version_gid and (version_type := version_gid.type_name) != "DatasetVersion":
        raise HTTPException(detail=f"ID {version_gid} refers to a {version_type}", status_code=404)

    async with request.app.state.db() as session:
        if (
            resolved_dataset_id := await session.scalar(
                select(models.Dataset.id).where(models.Dataset.id == int(dataset_gid.node_id))
            )
        ) is None:
            raise HTTPException(
                detail=f"No dataset with id {dataset_gid} can be found.",
                status_code=404,
            )

        # Subquery to find the maximum created_at for each dataset_example_id
        # timestamp tiebreaks are resolved by the largest id
        partial_subquery = select(
            func.max(models.DatasetExampleRevision.id).label("max_id"),
        ).group_by(models.DatasetExampleRevision.dataset_example_id)

        if version_gid:
            if (
                resolved_version_id := await session.scalar(
                    select(models.DatasetVersion.id).where(
                        and_(
                            models.DatasetVersion.dataset_id == resolved_dataset_id,
                            models.DatasetVersion.id == int(version_gid.node_id),
                        )
                    )
                )
            ) is None:
                raise HTTPException(
                    detail=f"No dataset version with id {version_id} can be found.",
                    status_code=404,
                )
            # if a version_id is provided, filter the subquery to only include revisions from that
            partial_subquery = partial_subquery.filter(
                models.DatasetExampleRevision.dataset_version_id <= resolved_version_id
            )
        else:
            if (
                resolved_version_id := await session.scalar(
                    select(func.max(models.DatasetVersion.id)).where(
                        models.DatasetVersion.dataset_id == resolved_dataset_id
                    )
                )
            ) is None:
                raise HTTPException(
                    detail="Dataset has no versions.",
                    status_code=404,
                )

        subquery = partial_subquery.subquery()

        # Query for the most recent example revisions that are not deleted
        query = (
            select(
                models.DatasetExample,
                models.DatasetExampleRevision,
            )
            .join(
                models.DatasetExampleRevision,
                models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id,
            )
            .join(
                subquery,
                (subquery.c.max_id == models.DatasetExampleRevision.id),
            )
            .filter(models.DatasetExample.dataset_id == resolved_dataset_id)
            .filter(models.DatasetExampleRevision.revision_kind != "DELETE")
            .order_by(models.DatasetExample.id.asc())
        )

        # If splits are provided, filter by dataset splits
        resolved_split_names: list[str] = []
        if split:
            # Resolve split identifiers (IDs or names) to IDs and names
            resolved_split_ids, resolved_split_names = await _resolve_split_identifiers(
                session, split
            )

            # Add filter for splits (join with the association table)
            # Use distinct() to prevent duplicates when an example belongs to
            # multiple splits
            query = (
                query.join(
                    models.DatasetSplitDatasetExample,
                    models.DatasetExample.id
                    == models.DatasetSplitDatasetExample.dataset_example_id,
                )
                .filter(models.DatasetSplitDatasetExample.dataset_split_id.in_(resolved_split_ids))
                .distinct()
            )

        examples = [
            DatasetExample(
                id=str(GlobalID("DatasetExample", str(example.id))),
                input=revision.input,
                output=revision.output,
                metadata=revision.metadata_,
                updated_at=revision.created_at,
            )
            async for example, revision in await session.stream(query)
        ]
    return ListDatasetExamplesResponseBody(
        data=ListDatasetExamplesData(
            dataset_id=str(GlobalID("Dataset", str(resolved_dataset_id))),
            version_id=str(GlobalID("DatasetVersion", str(resolved_version_id))),
            filtered_splits=resolved_split_names,
            examples=examples,
        )
    )


@router.get(
    "/datasets/{id}/csv",
    operation_id="getDatasetCsv",
    summary="Download dataset examples as CSV file",
    response_class=StreamingResponse,
    status_code=200,
    responses={
        **add_errors_to_responses([422]),
        **add_text_csv_content_to_responses(200),
    },
)
async def get_dataset_csv(
    request: Request,
    response: Response,
    id: str = Path(description="The ID of the dataset"),
    version_id: Optional[str] = Query(
        default=None,
        description=(
            "The ID of the dataset version (if omitted, returns data from the latest version)"
        ),
    ),
) -> Response:
    try:
        async with request.app.state.db() as session:
            dataset_name, examples = await _get_db_examples(
                session=session, id=id, version_id=version_id
            )
    except ValueError as e:
        raise HTTPException(detail=str(e), status_code=422)
    content = await run_in_threadpool(_get_content_csv, examples)
    encoded_dataset_name = urllib.parse.quote(dataset_name)
    return Response(
        content=content,
        headers={
            "content-disposition": f"attachment; filename*=UTF-8''{encoded_dataset_name}.csv",
            "content-type": "text/csv",
        },
    )


@router.get(
    "/datasets/{id}/jsonl/openai_ft",
    operation_id="getDatasetJSONLOpenAIFineTuning",
    summary="Download dataset examples as OpenAI fine-tuning JSONL file",
    response_class=PlainTextResponse,
    responses=add_errors_to_responses(
        [
            {
                "status_code": 422,
                "description": "Invalid dataset or version ID",
            }
        ]
    ),
)
async def get_dataset_jsonl_openai_ft(
    request: Request,
    response: Response,
    id: str = Path(description="The ID of the dataset"),
    version_id: Optional[str] = Query(
        default=None,
        description=(
            "The ID of the dataset version (if omitted, returns data from the latest version)"
        ),
    ),
) -> bytes:
    try:
        async with request.app.state.db() as session:
            dataset_name, examples = await _get_db_examples(
                session=session, id=id, version_id=version_id
            )
    except ValueError as e:
        raise HTTPException(detail=str(e), status_code=422)
    content = await run_in_threadpool(_get_content_jsonl_openai_ft, examples)
    encoded_dataset_name = urllib.parse.quote(dataset_name)
    response.headers["content-disposition"] = (
        f"attachment; filename*=UTF-8''{encoded_dataset_name}.jsonl"
    )
    return content


@router.get(
    "/datasets/{id}/jsonl/openai_evals",
    operation_id="getDatasetJSONLOpenAIEvals",
    summary="Download dataset examples as OpenAI evals JSONL file",
    response_class=PlainTextResponse,
    responses=add_errors_to_responses(
        [
            {
                "status_code": 422,
                "description": "Invalid dataset or version ID",
            }
        ]
    ),
)
async def get_dataset_jsonl_openai_evals(
    request: Request,
    response: Response,
    id: str = Path(description="The ID of the dataset"),
    version_id: Optional[str] = Query(
        default=None,
        description=(
            "The ID of the dataset version (if omitted, returns data from the latest version)"
        ),
    ),
) -> bytes:
    try:
        async with request.app.state.db() as session:
            dataset_name, examples = await _get_db_examples(
                session=session, id=id, version_id=version_id
            )
    except ValueError as e:
        raise HTTPException(detail=str(e), status_code=422)
    content = await run_in_threadpool(_get_content_jsonl_openai_evals, examples)
    encoded_dataset_name = urllib.parse.quote(dataset_name)
    response.headers["content-disposition"] = (
        f"attachment; filename*=UTF-8''{encoded_dataset_name}.jsonl"
    )
    return content


def _get_content_csv(examples: list[models.DatasetExampleRevision]) -> bytes:
    records = [
        {
            "example_id": GlobalID(
                type_name=DatasetExampleNodeType.__name__,
                node_id=str(ex.dataset_example_id),
            ),
            **{f"input_{k}": v for k, v in ex.input.items()},
            **{f"output_{k}": v for k, v in ex.output.items()},
            **{f"metadata_{k}": v for k, v in ex.metadata_.items()},
        }
        for ex in examples
    ]
    return str(pd.DataFrame.from_records(records).to_csv(index=False)).encode()


def _get_content_jsonl_openai_ft(examples: list[models.DatasetExampleRevision]) -> bytes:
    records = io.BytesIO()
    for ex in examples:
        input_messages = ex.input.get("messages", [])
        if not isinstance(input_messages, list):
            input_messages = []
        output_messages = ex.output.get("messages", [])
        if not isinstance(output_messages, list):
            output_messages = []

        record_dict = {
            "messages": input_messages + output_messages,
        }

        tools = ex.input.get("tools", [])
        if tools:
            record_dict["tools"] = tools

        records.write((json.dumps(record_dict, ensure_ascii=False) + "\n").encode())

    records.seek(0)
    return records.read()


def _get_content_jsonl_openai_evals(examples: list[models.DatasetExampleRevision]) -> bytes:
    records = io.BytesIO()
    for ex in examples:
        records.write(
            (
                json.dumps(
                    {
                        "messages": ims
                        if isinstance(ims := ex.input.get("messages"), list)
                        else [],
                        "ideal": (
                            ideal if isinstance(ideal := last_message.get("content"), str) else ""
                        )
                        if isinstance(oms := ex.output.get("messages"), list)
                        and oms
                        and hasattr(last_message := oms[-1], "get")
                        else "",
                    },
                    ensure_ascii=False,
                )
                + "\n"
            ).encode()
        )
    records.seek(0)
    return records.read()


async def _get_db_examples(
    *, session: Any, id: str, version_id: Optional[str]
) -> tuple[str, list[models.DatasetExampleRevision]]:
    try:
        dataset_id = from_global_id_with_expected_type(GlobalID.from_id(id), DATASET_NODE_NAME)
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid dataset ID format: {id}",
            status_code=422,
        ) from e

    dataset_version_id: Optional[int] = None
    if version_id:
        try:
            dataset_version_id = from_global_id_with_expected_type(
                GlobalID.from_id(version_id), DATASET_VERSION_NODE_NAME
            )
        except Exception as e:
            raise HTTPException(
                detail=f"Invalid dataset version ID format: {version_id}",
                status_code=422,
            ) from e
    latest_version = (
        select(
            models.DatasetExampleRevision.dataset_example_id,
            func.max(models.DatasetExampleRevision.dataset_version_id).label("dataset_version_id"),
        )
        .group_by(models.DatasetExampleRevision.dataset_example_id)
        .join(models.DatasetExample)
        .where(models.DatasetExample.dataset_id == dataset_id)
    )
    if dataset_version_id is not None:
        max_dataset_version_id = (
            select(models.DatasetVersion.id)
            .where(models.DatasetVersion.id == dataset_version_id)
            .where(models.DatasetVersion.dataset_id == dataset_id)
        ).scalar_subquery()
        latest_version = latest_version.where(
            models.DatasetExampleRevision.dataset_version_id <= max_dataset_version_id
        )
    subq = latest_version.subquery("latest_version")
    stmt = (
        select(models.DatasetExampleRevision)
        .join(
            subq,
            onclause=and_(
                models.DatasetExampleRevision.dataset_example_id == subq.c.dataset_example_id,
                models.DatasetExampleRevision.dataset_version_id == subq.c.dataset_version_id,
            ),
        )
        .where(models.DatasetExampleRevision.revision_kind != "DELETE")
        .order_by(models.DatasetExampleRevision.dataset_example_id)
    )
    dataset_name: Optional[str] = await session.scalar(
        select(models.Dataset.name).where(models.Dataset.id == dataset_id)
    )
    if not dataset_name:
        raise ValueError("Dataset does not exist.")
    examples = [r async for r in await session.stream_scalars(stmt)]
    return dataset_name, examples


def _is_all_dict(seq: Sequence[Any]) -> bool:
    return all(map(lambda obj: isinstance(obj, dict), seq))


# Split identifier helper types and functions
class _SplitId(int): ...


_SplitIdentifier: TypeAlias = Union[_SplitId, str]


def _parse_split_identifier(split_identifier: str) -> _SplitIdentifier:
    """
    Parse a split identifier as either a GlobalID or a name.

    Args:
        split_identifier: The identifier string (GlobalID or name)

    Returns:
        Either a _SplitId or an Identifier

    Raises:
        HTTPException: If the identifier format is invalid
    """
    if not split_identifier:
        raise HTTPException(422, "Invalid split identifier")
    try:
        split_id = from_global_id_with_expected_type(
            GlobalID.from_id(split_identifier),
            DatasetSplitNodeType.__name__,
        )
    except ValueError:
        return split_identifier
    return _SplitId(split_id)


async def _resolve_split_identifiers(
    session: AsyncSession,
    split_identifiers: list[str],
) -> tuple[list[int], list[str]]:
    """
    Resolve a list of split identifiers (IDs or names) to split IDs and names.

    Args:
        session: The database session
        split_identifiers: List of split identifiers (GlobalIDs or names)

    Returns:
        Tuple of (list of split IDs, list of split names)

    Raises:
        HTTPException: If any split identifier is invalid or not found
    """
    split_ids: list[int] = []
    split_names: list[str] = []

    # Parse all identifiers first
    parsed_identifiers: list[_SplitIdentifier] = []
    for identifier_str in split_identifiers:
        parsed_identifiers.append(_parse_split_identifier(identifier_str.strip()))

    # Separate IDs and names
    requested_ids: list[int] = []
    requested_names: list[str] = []
    for identifier in parsed_identifiers:
        if isinstance(identifier, _SplitId):
            requested_ids.append(int(identifier))
        elif isinstance(identifier, str):
            requested_names.append(identifier)
        else:
            assert_never(identifier)

    # Query for splits by ID
    if requested_ids:
        id_results = await session.stream(
            select(models.DatasetSplit.id, models.DatasetSplit.name).where(
                models.DatasetSplit.id.in_(requested_ids)
            )
        )
        async for split_id, split_name in id_results:
            split_ids.append(split_id)
            split_names.append(split_name)

        # Check if all requested IDs were found
        found_ids = set(split_ids[-len(requested_ids) :] if requested_ids else [])
        missing_ids = [sid for sid in requested_ids if sid not in found_ids]
        if missing_ids:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Dataset splits not found for IDs: {', '.join(map(str, missing_ids))}",
            )

    # Query for splits by name
    if requested_names:
        name_results = await session.stream(
            select(models.DatasetSplit.id, models.DatasetSplit.name).where(
                models.DatasetSplit.name.in_(requested_names)
            )
        )
        name_to_id: dict[str, int] = {}
        async for split_id, split_name in name_results:
            split_ids.append(split_id)
            split_names.append(split_name)
            name_to_id[split_name] = split_id

        # Check if all requested names were found
        missing_names = [name for name in requested_names if name not in name_to_id]
        if missing_names:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Dataset splits not found: {', '.join(missing_names)}",
            )

    return split_ids, split_names
