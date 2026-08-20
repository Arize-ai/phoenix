from collections.abc import Mapping
from typing import Annotated, Any, Generic, Optional, TypedDict, TypeVar, Union

from fastapi import HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.types.Dataset import Dataset as DatasetNodeType
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import Cursor, CursorSortColumnDataType
from phoenix.server.api.types.Project import Project as ProjectNodeType

from .models import V1RoutesBaseModel

StatusCode: TypeAlias = int
DataType = TypeVar("DataType")
Responses: TypeAlias = dict[
    Union[int, str], dict[str, Any]
]  # input type for the `responses` parameter of a fastapi route

HexColor: TypeAlias = Annotated[
    str,
    Field(
        pattern=models.HEX_COLOR_REGEX,
        description="A lowercase six-digit hex color code (e.g. '#00cc88')",
    ),
]
"""
A request-body field type for hex colors. Validates against the same pattern
enforced at the database layer (`_HexColor` in `phoenix.db.models`) so that
invalid colors are rejected at request-validation time (422) rather than
surfacing as an opaque database error.
"""


class StatusCodeWithDescription(TypedDict):
    """
    A duck type for a status code with a description detailing under what
    conditions the status code is raised.
    """

    status_code: StatusCode
    description: str


class RequestBody(V1RoutesBaseModel, Generic[DataType]):
    # A generic request type accepted by V1 routes.
    #
    # Don't use """ for this docstring or it will be included as a description
    # in the generated OpenAPI schema.
    data: DataType


class ResponseBody(V1RoutesBaseModel, Generic[DataType]):
    # A generic response type returned by V1 routes.
    #
    # Don't use """ for this docstring or it will be included as a description
    # in the generated OpenAPI schema.

    data: DataType


class PaginatedResponseBody(V1RoutesBaseModel, Generic[DataType]):
    # A generic paginated response type returned by V1 routes.
    #
    # Don't use """ for this docstring or it will be included as a description
    # in the generated OpenAPI schema.

    data: list[DataType]
    next_cursor: Optional[str]


def add_errors_to_responses(
    errors: list[Union[StatusCode, StatusCodeWithDescription]],
    /,
    *,
    responses: Optional[Responses] = None,
) -> Responses:
    """
    Creates or updates a patch for an OpenAPI schema's `responses` section to
    include status codes in the generated OpenAPI schema.
    """
    output_responses: Responses = responses or {}
    for error in errors:
        status_code: int
        description: Optional[str] = None
        if isinstance(error, StatusCode):
            status_code = error
        elif isinstance(error, dict):
            status_code = error["status_code"]
            description = error["description"]
        else:
            assert_never(error)
        if status_code not in output_responses:
            output_responses[status_code] = {
                "content": {"text/plain": {"schema": {"type": "string"}}}
            }
        if description:
            output_responses[status_code]["description"] = description
    return output_responses


def add_text_csv_content_to_responses(
    status_code: StatusCode, /, *, responses: Optional[Responses] = None
) -> Responses:
    """
    Creates or updates a patch for an OpenAPI schema's `responses` section to
    ensure that the response for the given status code is marked as text/csv in
    the generated OpenAPI schema.
    """
    output_responses: Responses = responses or {}
    if status_code not in output_responses:
        output_responses[status_code] = {}
    output_responses[status_code]["content"] = {
        "text/csv": {"schema": {"type": "string", "contentMediaType": "text/csv"}}
    }
    return output_responses


async def get_project_by_identifier(
    session: AsyncSession,
    project_identifier: str,
) -> models.Project:
    """
    Get a project by its ID or name.

    Args:
        session: The database session.
        project_identifier: The project ID or name.

    Returns:
        The project object.

    Raises:
        HTTPException: If the identifier format is invalid or the project is not found.
    """
    # Try to parse as a GlobalID first
    try:
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(project_identifier),
            ProjectNodeType.__name__,
        )
    except Exception:
        try:
            name = project_identifier
        except HTTPException:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid project identifier format: {project_identifier}",
            )
        stmt = select(models.Project).filter_by(name=name)
        project = await session.scalar(stmt)
        if project is None:
            raise HTTPException(
                status_code=404,
                detail=f"Project with name {name} not found",
            )
    else:
        project = await session.get(models.Project, id_)
        if project is None:
            raise HTTPException(
                status_code=404,
                detail=f"Project with ID {project_identifier} not found",
            )
    return project


async def get_dataset_by_identifier(
    session: AsyncSession,
    dataset_identifier: str,
) -> models.Dataset:
    """
    Get a dataset by its ID or name.

    Args:
        session: The database session.
        dataset_identifier: The dataset ID (GlobalID) or name.

    Returns:
        The dataset object.

    Raises:
        HTTPException: If the identifier format is invalid or the dataset is not found.
    """
    # Try to parse as a GlobalID first; otherwise, treat the identifier as a name.
    try:
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(dataset_identifier),
            DatasetNodeType.__name__,
        )
    except Exception:
        stmt = select(models.Dataset).filter_by(name=dataset_identifier)
        dataset = await session.scalar(stmt)
        if dataset is None:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset with name {dataset_identifier} not found",
            )
    else:
        dataset = await session.get(models.Dataset, id_)
        if dataset is None:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset with ID {dataset_identifier} not found",
            )
    return dataset


#: The rowids each dialect can hold for a table whose primary key is declared as
#: a plain `Mapped[int]`: postgres `SERIAL` is 32-bit, while sqlite's `INTEGER
#: PRIMARY KEY` is the 64-bit rowid. Tables declared with `models._Integer` are
#: `BIGINT` on postgres and hold the wider range, so they need their own bound.
_DEFAULT_ROWID_RANGES: Mapping[SupportedSQLDialect, range] = {
    SupportedSQLDialect.POSTGRESQL: range(-(2**31), 2**31),
    SupportedSQLDialect.SQLITE: range(-(2**63), 2**63),
}


def default_rowid_range(dialect: SupportedSQLDialect) -> range:
    """
    The rowids a table whose primary key is a plain `Mapped[int]` can hold.

    Args:
        dialect: The dialect the query runs against.

    Returns:
        The range to pass as `Cursor.parse`'s `rowid_range`.
    """
    return _DEFAULT_ROWID_RANGES[dialect]


def parse_cursor(
    cursor: str,
    *,
    sort_column_type: Optional[CursorSortColumnDataType],
    rowid_range: Optional[range] = None,
) -> Cursor:
    """
    Decodes a pagination cursor, answering one this route cannot use with 422.

    An HTTP adapter over `Cursor.parse`, which defines what makes a cursor
    usable. The reason a cursor was refused is not echoed back, because the
    token is opaque to the client and naming the failed check would describe
    its encoding.

    Args:
        cursor: The token as received from the client.
        sort_column_type: The data type of the column the route sorts on, or
            None if the route orders by rowid alone.
        rowid_range: The rowids the table's primary key can hold.

    Returns:
        The decoded cursor.

    Raises:
        HTTPException: 422, if the cursor is not one this route can page with.
    """
    try:
        return Cursor.parse(
            cursor,
            sort_column_type=sort_column_type,
            rowid_range=rowid_range,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"Invalid cursor format: {cursor}") from error
