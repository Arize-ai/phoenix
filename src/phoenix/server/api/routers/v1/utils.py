from typing import Annotated, Any, Generic, Optional, TypedDict, TypeVar, Union

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from starlette.routing import BaseRoute
from strawberry.relay import GlobalID, Node
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigNodeType,
)
from phoenix.server.api.types.AnnotationConfig import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigNodeType,
)
from phoenix.server.api.types.AnnotationConfig import (
    FreeformAnnotationConfig as FreeformAnnotationConfigNodeType,
)
from phoenix.server.api.types.Dataset import Dataset as DatasetNodeType
from phoenix.server.api.types.DatasetLabel import DatasetLabel as DatasetLabelNodeType
from phoenix.server.api.types.DatasetSplit import DatasetSplit as DatasetSplitNodeType
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.ProjectSession import ProjectSession as ProjectSessionNodeType

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


# Rowid columns are 32-bit integers on Postgres; a wider value fails at bind time.
MAX_CURSOR_ROWID = 2**31 - 1


def parse_cursor_rowid(cursor: str, node_name: str) -> int:
    """Parse a pagination cursor into a rowid for the given node type.

    Raises 422 for malformed cursors and for ids outside the bindable range.
    """
    try:
        rowid: Optional[int] = from_global_id_with_expected_type(
            GlobalID.from_id(cursor), node_name
        )
    except ValueError:
        rowid = None
    if rowid is None or not 0 <= rowid <= MAX_CURSOR_ROWID:
        raise HTTPException(
            detail=f"Invalid cursor format: {cursor}",
            status_code=422,
        )
    return rowid


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


ModelType = TypeVar("ModelType", bound=models.Base)


def order_identifier_routes(router: APIRouter) -> None:
    """
    Reorder a router's routes in place so that no route is shadowed by a
    greedier one. Routes without an ``identifier`` parameter keep their
    relative order and come first. Among routes with one, those with more
    path segments come first, so ``/datasets/{d:path}/examples`` is
    tried before ``/datasets/{d:path}`` swallows ``/datasets/foo/examples``.

    Routes are matched in registration order across routers too, so a router
    whose routes end in an identifier must be included after the routers that
    define sub-routes under the same prefix.
    """

    def key(route: BaseRoute) -> tuple[int, int]:
        path = getattr(route, "path", "")
        if ":path}" not in path:
            return (0, 0)
        return (1, -path.count("/"))

    router.routes.sort(key=key)


async def _get_entity_by_identifier(
    session: AsyncSession,
    model: type[ModelType],
    node_types: tuple[type[Node], ...],
    name_column: InstrumentedAttribute[str],
    identifier: str,
) -> ModelType:
    """
    Resolve a path identifier to a row of ``model``. The identifier is a GlobalID
    of one of ``node_types`` or a value of ``name_column``, which must be unique.

    Raises:
        HTTPException: 422 for a GlobalID of another node type, 404 when no row matches.
    """
    label = model.__name__
    try:
        global_id = GlobalID.from_id(identifier)
    except Exception:
        row = await session.scalar(select(model).where(name_column == identifier))
        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"{label} with {name_column.key} {identifier!r} not found",
            )
        return row
    if global_id.type_name not in {node_type.__name__ for node_type in node_types}:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {label} identifier: {identifier}",
        )
    row = await session.get(model, int(global_id.node_id))
    if row is None:
        raise HTTPException(status_code=404, detail=f"{label} with ID {identifier} not found")
    return row


async def get_project_by_identifier(session: AsyncSession, identifier: str) -> models.Project:
    return await _get_entity_by_identifier(
        session, models.Project, (ProjectNodeType,), models.Project.name, identifier
    )


async def get_dataset_by_identifier(session: AsyncSession, identifier: str) -> models.Dataset:
    return await _get_entity_by_identifier(
        session, models.Dataset, (DatasetNodeType,), models.Dataset.name, identifier
    )


async def get_dataset_label_by_identifier(
    session: AsyncSession, identifier: str
) -> models.DatasetLabel:
    return await _get_entity_by_identifier(
        session, models.DatasetLabel, (DatasetLabelNodeType,), models.DatasetLabel.name, identifier
    )


async def get_dataset_split_by_identifier(
    session: AsyncSession, identifier: str
) -> models.DatasetSplit:
    return await _get_entity_by_identifier(
        session, models.DatasetSplit, (DatasetSplitNodeType,), models.DatasetSplit.name, identifier
    )


async def get_annotation_config_by_identifier(
    session: AsyncSession, identifier: str
) -> models.AnnotationConfig:
    return await _get_entity_by_identifier(
        session,
        models.AnnotationConfig,
        (
            CategoricalAnnotationConfigNodeType,
            ContinuousAnnotationConfigNodeType,
            FreeformAnnotationConfigNodeType,
        ),
        models.AnnotationConfig.name,
        identifier,
    )


async def get_session_by_identifier(
    session: AsyncSession, identifier: str
) -> models.ProjectSession:
    return await _get_entity_by_identifier(
        session,
        models.ProjectSession,
        (ProjectSessionNodeType,),
        models.ProjectSession.session_id,
        identifier,
    )
