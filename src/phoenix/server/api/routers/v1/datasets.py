import csv
import gzip
import io
import logging
import zlib
from collections import Counter
from functools import partial
from typing import Awaitable, Callable, List, Optional, Set, Tuple, cast

import pyarrow as pa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData, UploadFile
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_403_FORBIDDEN, HTTP_422_UNPROCESSABLE_ENTITY
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.insertion.dataset import TableAction, add_table
from phoenix.db.insertion.helpers import DataModification

logger = logging.getLogger(__name__)


async def post_datasets_upload_csv(request: Request) -> Response:
    """
    summary: Upload CSV file as dataset
    operationId: uploadDatasetCSV
    tags:
      - datasets
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            required:
              - inputKeys
              - outputKeys
              - file
            properties:
              name:
                type: string
                format: binary
              description:
                type: string
                format: binary
              inputKeys:
                type: array
                items:
                  type: string
                  format: binary
              outputKeys:
                type: array
                items:
                  type: string
                  format: binary
              metadataKeys:
                type: array
                items:
                  type: string
                  format: binary
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
            ) = await _parse_form(form)
        except ValueError as e:
            return Response(
                content=str(e),
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if name and action is TableAction.CREATE:
            async with request.app.state.db() as session:
                if await _check_table_exists(session, name):
                    return Response(
                        content=f"Dataset already exists: {name=}",
                        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                    )
        content = await file.read()
        if file.content_type == "application/gzip":
            content = await run_in_threadpool(gzip.decompress, content)
        elif file.content_type == "application/zlib":
            content = await run_in_threadpool(zlib.decompress, content)
    reader = await run_in_threadpool(lambda c: csv.DictReader(io.StringIO(c.decode())), content)
    if reader.fieldnames is None:
        return Response(
            content="Missing CSV column header",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    (header, freq), *_ = Counter(reader.fieldnames).most_common(1)
    if freq > 1:
        return Response(
            content=f"Duplicated column header in CSV file: {header}",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    column_headers = set(reader.fieldnames)
    try:
        _check_keys_exist(column_headers, input_keys, output_keys, metadata_keys)
    except ValueError as e:
        return Response(
            content=str(e),
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    await request.state.enqueue_for_transaction(
        partial(
            add_table,
            action=action,
            table=reader,
            name=name,
            description=description,
            input_keys=list(input_keys),
            output_keys=list(output_keys),
            metadata_keys=list(metadata_keys),
        )
    )
    return Response()


async def post_datasets_upload_pyarrow(request: Request) -> Response:
    """
    summary: Upload PyArrow as dataset
    operationId: uploadDatasetPyArrow
    tags:
      - datasets
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            required:
              - inputKeys
              - outputKeys
              - file
            properties:
              name:
                type: string
                format: binary
              description:
                type: string
                format: binary
              inputKeys:
                type: array
                items:
                  type: string
                  format: binary
              outputKeys:
                type: array
                items:
                  type: string
                  format: binary
              metadataKeys:
                type: array
                items:
                  type: string
                  format: binary
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
            ) = await _parse_form(form)
        except ValueError as e:
            return Response(
                content=str(e),
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if name and action is TableAction.CREATE:
            async with request.app.state.db() as session:
                if await _check_table_exists(session, name):
                    return Response(
                        content=f"Dataset already exists: {name=}",
                        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                    )
        content = await file.read()
    try:
        reader = pa.ipc.open_stream(content)
    except pa.ArrowInvalid:
        return Response(
            content="File is not valid pyarrow",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    column_headers = set(reader.schema.names)
    try:
        _check_keys_exist(column_headers, input_keys, output_keys, metadata_keys)
    except ValueError as e:
        return Response(
            content=str(e),
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return Response(
        background=BackgroundTask(
            _read_pyarrow,
            reader,
            action,
            name,
            description,
            input_keys,
            output_keys,
            metadata_keys,
            request.state.enqueue_for_transaction,
        )
    )


Name: TypeAlias = Optional[str]
Description: TypeAlias = Optional[str]
InputKeys: TypeAlias = Set[str]
OutputKeys: TypeAlias = Set[str]
MetadataKeys: TypeAlias = Set[str]
DatasetId: TypeAlias = int


async def _check_table_exists(session: AsyncSession, name: str) -> bool:
    return bool(
        await session.scalar(
            select(1).select_from(models.Dataset).where(models.Dataset.name == name)
        )
    )


async def _read_pyarrow(
    reader: pa.RecordBatchStreamReader,
    action: TableAction,
    name: Name,
    description: Description,
    input_keys: InputKeys,
    output_keys: OutputKeys,
    metadata_keys: MetadataKeys,
    enqueue: Callable[[DataModification], Awaitable[None]],
) -> None:
    df = await run_in_threadpool(reader.read_pandas)
    await enqueue(
        partial(
            add_table,
            action=action,
            table=df.to_dict(orient="records"),
            name=name,
            description=description,
            input_keys=list(input_keys),
            output_keys=list(output_keys),
            metadata_keys=list(metadata_keys),
        )
    )


def _check_keys_exist(
    column_headers: Set[str],
    input_keys: InputKeys,
    output_keys: OutputKeys,
    metadata_keys: MetadataKeys,
) -> None:
    for desc, keys in (
        ("input", input_keys),
        ("output", output_keys),
        ("metadata", metadata_keys),
    ):
        if diff := keys.difference(column_headers):
            raise ValueError(f"{desc} keys not found in column headers: {diff}")


async def _parse_form(
    form: FormData,
) -> Tuple[
    TableAction,
    Name,
    Description,
    InputKeys,
    OutputKeys,
    MetadataKeys,
    UploadFile,
]:
    name = cast(Optional[str], form.get("name"))
    action = TableAction(cast(Optional[str], form.get("action")) or "create")
    if action is TableAction.APPEND and not name:
        raise ValueError(f"Dataset name must not be empty for action={action.value}")
    file = form["file"]
    assert isinstance(file, UploadFile)
    description = cast(Optional[str], form.get("description")) or file.filename
    input_keys = set(cast(List[str], form.getlist("input_keys[]")))
    output_keys = set(cast(List[str], form.getlist("output_keys[]")))
    metadata_keys = set(cast(List[str], form.getlist("metadata_keys[]")))
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
