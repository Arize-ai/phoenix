import csv
import gzip
import io
import logging
import zlib
from collections import Counter
from enum import Enum
from functools import partial
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    FrozenSet,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    cast,
)

import pyarrow as pa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData, UploadFile
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_403_FORBIDDEN, HTTP_422_UNPROCESSABLE_ENTITY
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.insertion.dataset import DatasetAction, add_dataset_examples
from phoenix.db.insertion.helpers import DataModification

logger = logging.getLogger(__name__)


async def post_datasets_upload(request: Request) -> Response:
    """
    summary: Upload CSV or PyArrow file as dataset
    operationId: uploadDataset
    tags:
      - datasets
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            required:
              - name
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
            ) = await _parse_form_data(form)
        except ValueError as e:
            return Response(
                content=str(e),
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if name and action is DatasetAction.CREATE:
            async with request.app.state.db() as session:
                if await _check_table_exists(session, name):
                    return Response(
                        content=f"Dataset already exists: {name=}",
                        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                    )
        content = await file.read()
    try:
        content_type = FileContentType(file.content_type)
        if content_type is FileContentType.CSV:
            get_examples, column_headers = await _process_csv(
                content,
                FileContentEncoding(file.headers.get("content-encoding")),
            )
        elif content_type is FileContentType.PYARROW:
            get_examples, column_headers = await _process_pyarrow(
                content,
            )
        else:
            assert_never(content_type)
        _check_keys_exist(column_headers, input_keys, output_keys, metadata_keys)
    except ValueError as e:
        return Response(
            content=str(e),
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return Response(
        background=BackgroundTask(
            _add_dataset_examples,
            request.state.enqueue_for_transaction,
            get_examples=get_examples,
            action=action,
            name=name,
            description=description,
            input_keys=list(input_keys),
            output_keys=list(output_keys),
            metadata_keys=list(metadata_keys),
        )
    )


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


async def _add_dataset_examples(
    enqueue: Callable[[DataModification], Awaitable[None]],
    get_examples: Callable[[], Iterator[Mapping[str, Any]]],
    name: str,
    input_keys: Sequence[str],
    output_keys: Sequence[str],
    metadata_keys: Sequence[str] = (),
    description: Optional[str] = None,
    action: DatasetAction = DatasetAction.CREATE,
) -> None:
    await enqueue(
        partial(
            add_dataset_examples,
            examples=await run_in_threadpool(get_examples),
            action=action,
            name=name,
            description=description,
            input_keys=input_keys,
            output_keys=output_keys,
            metadata_keys=metadata_keys,
        )
    )


async def _process_csv(
    content: bytes,
    content_encoding: FileContentEncoding,
) -> Tuple[Callable[[], Iterator[Dict[str, Any]]], FrozenSet[str]]:
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

    def get_examples() -> Iterator[Dict[str, Any]]:
        yield from reader

    return get_examples, column_headers


async def _process_pyarrow(
    content: bytes,
) -> Tuple[Callable[[], Iterator[Dict[str, Any]]], FrozenSet[str]]:
    try:
        reader = pa.ipc.open_stream(content)
    except pa.ArrowInvalid as e:
        raise ValueError("File is not valid pyarrow") from e
    column_headers = frozenset(reader.schema.names)

    def get_examples() -> Iterator[Dict[str, Any]]:
        yield from reader.read_pandas().to_dict(orient="records")

    return get_examples, column_headers


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
        if diff := keys.difference(column_headers):
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
    input_keys = frozenset(cast(List[str], form.getlist("input_keys[]")))
    output_keys = frozenset(cast(List[str], form.getlist("output_keys[]")))
    metadata_keys = frozenset(cast(List[str], form.getlist("metadata_keys[]")))
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
