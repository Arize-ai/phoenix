import csv
import gzip
import io
import logging
import zlib
from asyncio import QueueFull
from collections import Counter
from enum import Enum
from functools import partial
from typing import (
    Any,
    Awaitable,
    Coroutine,
    Dict,
    FrozenSet,
    Iterator,
    List,
    Optional,
    Tuple,
    Union,
    cast,
)

import pandas as pd
import pyarrow as pa
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData, UploadFile
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import (
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_429_TOO_MANY_REQUESTS,
)
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.insertion.dataset import (
    DatasetAction,
    DatasetExamplesAdditionEvent,
    add_dataset_examples,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.node import from_global_id_with_expected_type

logger = logging.getLogger(__name__)

NODE_NAME = "Dataset"


async def list_datasets(request: Request) -> Response:
    """
    summary: List datasets with cursor-based pagination
    operationId: listDatasets
    tags:
      - datasets
    parameters:
      - in: query
        name: cursor
        required: false
        schema:
          type: string
        description: Cursor for pagination
      - in: query
        name: limit
        required: false
        schema:
          type: integer
          default: 10
    responses:
      200:
        description: A paginated list of datasets
        content:
          application/json:
            schema:
              type: object
              properties:
                next_cursor:
                  type: string
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                      name:
                        type: string
                      description:
                        type: string
                      metadata:
                        type: object
                      created_at:
                        type: string
                        format: date-time
                      updated_at:
                        type: string
                        format: date-time
      404:
        description: No datasets found
    """
    cursor = request.query_params.get("cursor")
    limit = int(request.query_params.get("limit", 10))
    async with request.app.state.db() as session:
        query = select(models.Dataset).order_by(models.Dataset.id.desc())

        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                query = query.filter(models.Dataset.id <= int(cursor_id))
            except ValueError:
                return Response(
                    content=f"Invalid cursor format: {cursor}",
                    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                )

        query = query.limit(limit + 1)
        result = await session.execute(query)
        datasets = result.scalars().all()

        if not datasets:
            return JSONResponse(content={"next_cursor": None, "data": []}, status_code=200)

        next_cursor = None
        if len(datasets) == limit + 1:
            next_cursor = str(GlobalID(NODE_NAME, str(datasets[-1].id)))
            datasets = datasets[:-1]

        data = []
        for dataset in datasets:
            data.append(
                {
                    "id": str(GlobalID(NODE_NAME, str(dataset.id))),
                    "name": dataset.name,
                    "description": dataset.description,
                    "metadata": dataset.metadata_,
                    "created_at": dataset.created_at.isoformat(),
                    "updated_at": dataset.updated_at.isoformat(),
                }
            )

        return JSONResponse(content={"next_cursor": next_cursor, "data": data})


async def get_dataset_by_id(request: Request) -> Response:
    """
    summary: Get dataset by ID
    operationId: getDatasetById
    tags:
      - datasets
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
    responses:
      200:
        description: Success
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: string
                name:
                  type: string
                description:
                  type: string
                metadata:
                  type: object
                created_at:
                  type: string
                  format: date-time
                updated_at:
                  type: string
                  format: date-time
                example_count:
                  type: integer
      404:
        description: Dataset not found
    """
    dataset_id = GlobalID.from_id(request.path_params["id"])

    if (type_name := dataset_id.type_name) != NODE_NAME:
        return Response(
            content=f"ID {dataset_id} refers to a f{type_name}", status_code=HTTP_404_NOT_FOUND
        )
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
            return Response(
                content=f"Dataset with ID {dataset_id} not found", status_code=HTTP_404_NOT_FOUND
            )

        output_dict = {
            "id": str(dataset_id),
            "name": dataset.name,
            "description": dataset.description,
            "metadata": dataset.metadata_,
            "created_at": dataset.created_at.isoformat(),
            "updated_at": dataset.updated_at.isoformat(),
            "example_count": example_count,
        }
        return JSONResponse(content=output_dict)


async def get_dataset_versions(request: Request) -> Response:
    """
    summary: Get dataset versions (sorted from latest to oldest)
    operationId: getDatasetVersionsByDatasetId
    tags:
      - datasets
    parameters:
      - in: path
        name: id
        required: true
        description: Dataset ID
        schema:
          type: string
      - in: query
        name: cursor
        description: Cursor for pagination.
        schema:
          type: string
      - in: query
        name: limit
        description: Maximum number versions to return.
        schema:
          type: integer
          default: 10
    responses:
      200:
        description: Success
        content:
          application/json:
            schema:
              type: object
              properties:
                next_cursor:
                  type: string
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      version_id:
                        type: string
                      description:
                        type: string
                      metadata:
                        type: object
                      created_at:
                        type: string
                        format: date-time
      422:
        description: Dataset ID, cursor or limit is invalid.
    """
    if id_ := request.path_params.get("id"):
        try:
            dataset_id = from_global_id_with_expected_type(
                GlobalID.from_id(id_),
                Dataset.__name__,
            )
        except ValueError:
            return Response(
                content=f"Invalid Dataset ID: {id_}",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
    else:
        return Response(
            content="Missing Dataset ID",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    try:
        limit = int(request.query_params.get("limit", 10))
        assert limit > 0
    except (ValueError, AssertionError):
        return Response(
            content="Invalid limit parameter",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    stmt = (
        select(models.DatasetVersion)
        .where(models.DatasetVersion.dataset_id == dataset_id)
        .order_by(models.DatasetVersion.id.desc())
        .limit(limit + 1)
    )
    if cursor := request.query_params.get("cursor"):
        try:
            dataset_version_id = from_global_id_with_expected_type(
                GlobalID.from_id(cursor),
                DatasetVersion.__name__,
            )
        except ValueError:
            return Response(
                content=f"Invalid cursor: {cursor}",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        max_dataset_version_id = (
            select(models.DatasetVersion.id)
            .where(models.DatasetVersion.id == dataset_version_id)
            .where(models.DatasetVersion.dataset_id == dataset_id)
        ).scalar_subquery()
        stmt = stmt.filter(models.DatasetVersion.id <= max_dataset_version_id)
    async with request.app.state.db() as session:
        data = [
            {
                "version_id": str(GlobalID(DatasetVersion.__name__, str(version.id))),
                "description": version.description,
                "metadata": version.metadata_,
                "created_at": version.created_at.isoformat(),
            }
            async for version in await session.stream_scalars(stmt)
        ]
    next_cursor = data.pop()["version_id"] if len(data) == limit + 1 else None
    return JSONResponse(content={"next_cursor": next_cursor, "data": data})


async def post_datasets_upload(request: Request) -> Response:
    """
    summary: Upload CSV or PyArrow file as dataset
    operationId: uploadDataset
    tags:
      - datasets
    parameters:
      - in: query
        name: sync
        description: If true, fulfill request synchronously and return JSON containing dataset_id
        schema:
          type: boolean
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            required:
              - name
              - input_keys[]
              - output_keys[]
              - file
            properties:
              action:
                type: string
                enum: [create, append]
              name:
                type: string
              description:
                type: string
              input_keys[]:
                type: array
                items:
                  type: string
                uniqueItems: true
              output_keys[]:
                type: array
                items:
                  type: string
                uniqueItems: true
              metadata_keys[]:
                type: array
                items:
                  type: string
                uniqueItems: true
              file:
                type: string
                format: binary
    responses:
      200:
        description: Success
      403:
        description: Forbidden
      422:
        description: Request body is invalid
    """
    if request.app.state.read_only:
        return Response(status_code=HTTP_403_FORBIDDEN)
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
            return Response(
                content=str(e),
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if action is DatasetAction.CREATE:
            async with request.app.state.db() as session:
                if await _check_table_exists(session, name):
                    return Response(
                        content=f"Dataset already exists: {name=}",
                        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                    )
        content = await file.read()
    try:
        examples: Union[Examples, Awaitable[Examples]]
        content_type = FileContentType(file.content_type)
        if content_type is FileContentType.CSV:
            encoding = FileContentEncoding(file.headers.get("content-encoding"))
            examples, column_headers = await _process_csv(content, encoding)
        elif content_type is FileContentType.PYARROW:
            examples, column_headers = await _process_pyarrow(content)
        else:
            assert_never(content_type)
        _check_keys_exist(column_headers, input_keys, output_keys, metadata_keys)
    except ValueError as e:
        return Response(
            content=str(e),
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    operation = partial(
        add_dataset_examples,
        examples=examples,
        action=action,
        name=name,
        description=description,
        input_keys=input_keys,
        output_keys=output_keys,
        metadata_keys=metadata_keys,
    )
    if request.query_params.get("sync") == "true":
        async with request.app.state.db() as session:
            dataset_id = cast(DatasetExamplesAdditionEvent, await operation(session)).dataset_id
        return JSONResponse(
            content={"dataset_id": str(GlobalID(Dataset.__name__, str(dataset_id)))}
        )
    try:
        request.state.enqueue_operation(operation)
    except QueueFull:
        if isinstance(examples, Coroutine):
            examples.close()
        return Response(status_code=HTTP_429_TOO_MANY_REQUESTS)
    return Response()


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
InputKeys: TypeAlias = FrozenSet[str]
OutputKeys: TypeAlias = FrozenSet[str]
MetadataKeys: TypeAlias = FrozenSet[str]
DatasetId: TypeAlias = int
Examples: TypeAlias = Iterator[Dict[str, Any]]


async def _process_csv(
    content: bytes,
    content_encoding: FileContentEncoding,
) -> Tuple[Examples, FrozenSet[str]]:
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
    return reader, column_headers


async def _process_pyarrow(
    content: bytes,
) -> Tuple[Awaitable[Examples], FrozenSet[str]]:
    try:
        reader = pa.ipc.open_stream(content)
    except pa.ArrowInvalid as e:
        raise ValueError("File is not valid pyarrow") from e
    column_headers = frozenset(reader.schema.names)

    def get_examples() -> Iterator[Dict[str, Any]]:
        yield from reader.read_pandas().to_dict(orient="records")

    return run_in_threadpool(get_examples), column_headers


async def _check_table_exists(session: AsyncSession, name: str) -> bool:
    return bool(
        await session.scalar(
            select(1).select_from(models.Dataset).where(models.Dataset.name == name)
        )
    )


def _check_keys_exist(
    column_headers: FrozenSet[str],
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
) -> Tuple[
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
    input_keys = frozenset(filter(bool, cast(List[str], form.getlist("input_keys[]"))))
    output_keys = frozenset(filter(bool, cast(List[str], form.getlist("output_keys[]"))))
    metadata_keys = frozenset(filter(bool, cast(List[str], form.getlist("metadata_keys[]"))))
    if overlap := input_keys.intersection(output_keys):
        raise ValueError(f"input_keys, output_keys have overlap: {overlap}")
    if overlap := input_keys.intersection(metadata_keys):
        raise ValueError(f"input_keys and metadata_keys have overlap: {overlap}")
    if overlap := output_keys.intersection(metadata_keys):
        raise ValueError(f"output_keys and metadata_keys have overlap: {overlap}")
    return (
        action,
        name,
        description,
        input_keys,
        output_keys,
        metadata_keys,
        file,
    )


async def get_dataset_csv(request: Request) -> Response:
    """
    summary: Download dataset examples as CSV text file
    operationId: getDatasetCsv
    tags:
      - datasets
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
        description: Dataset ID
      - in: query
        name: version
        schema:
          type: string
        description: Dataset version ID. If omitted, returns the latest version.
    responses:
      200:
        description: Success
        content:
          text/csv:
            schema:
              type: string
              contentMediaType: text/csv
              contentEncoding: gzip
      404:
        description: Dataset does not exist.
      422:
        description: Dataset ID or version ID is invalid.
    """
    if id_ := request.path_params.get("id"):
        try:
            dataset_id = from_global_id_with_expected_type(GlobalID.from_id(id_), Dataset.__name__)
        except ValueError:
            return Response(
                content=f"Invalid Dataset ID: {id_}",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
    else:
        return Response(
            content="Missing Dataset ID",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    dataset_version_id: Optional[int] = None
    if version := request.query_params.get("version"):
        try:
            dataset_version_id = from_global_id_with_expected_type(
                GlobalID.from_id(version),
                DatasetVersion.__name__,
            )
        except ValueError:
            return Response(
                content=f"Invalid Dataset Version ID: {version}",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
    mder = models.DatasetExampleRevision
    latest_version = (
        select(
            mder.dataset_example_id,
            func.max(mder.dataset_version_id).label("dataset_version_id"),
        )
        .group_by(mder.dataset_example_id)
        .join(models.DatasetExample)
        .where(models.DatasetExample.dataset_id == dataset_id)
    )
    if dataset_version_id is not None:
        max_dataset_version_id = (
            select(models.DatasetVersion.id)
            .where(models.DatasetVersion.id == dataset_version_id)
            .where(models.DatasetVersion.dataset_id == dataset_id)
        ).scalar_subquery()
        latest_version = latest_version.where(mder.dataset_version_id <= max_dataset_version_id)
    subq = latest_version.subquery("latest_version")
    stmt = (
        select(
            mder.dataset_example_id,
            mder.input,
            mder.output,
            mder.metadata_,
        )
        .join(
            subq,
            onclause=and_(
                mder.dataset_example_id == subq.c.dataset_example_id,
                mder.dataset_version_id == subq.c.dataset_version_id,
            ),
        )
        .where(mder.revision_kind != "DELETE")
        .order_by(mder.dataset_example_id)
    )
    async with request.app.state.db() as session:
        dataset_name: Optional[str] = await session.scalar(
            select(models.Dataset.name).where(models.Dataset.id == dataset_id)
        )
        if not dataset_name:
            return Response(
                content="Dataset does not exist.",
                status_code=HTTP_404_NOT_FOUND,
            )
        examples = [
            {
                "example_id": GlobalID(type_name=DatasetExample.__name__, node_id=str(example_id)),
                **{f"input_{k}": v for k, v in input.items()},
                **{f"output_{k}": v for k, v in output.items()},
                **{f"metadata_{k}": v for k, v in metadata.items()},
            }
            async for example_id, input, output, metadata in await session.stream(stmt)
        ]
    content = await run_in_threadpool(
        lambda records: gzip.compress(
            pd.DataFrame.from_records(records).to_csv(index=False).encode()
        ),
        examples,
    )
    return Response(
        content=content,
        headers={
            "content-disposition": f'attachment; filename="{dataset_name}.csv"',
            "content-type": "text/csv",
            "content-encoding": "gzip",
        },
    )
