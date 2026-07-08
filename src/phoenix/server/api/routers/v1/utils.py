from typing import Annotated, Any, Generic, Optional, TypedDict, TypeVar, Union

from fastapi import HTTPException
from pydantic import Field
from sqlalchemy import ColumnElement, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.config import get_env_access_control_enabled
from phoenix.db import models
from phoenix.server.access import (
    OBJECT_TYPE_DATASET,
    Permission,
    accessible_scope,
    can_access,
)
from phoenix.server.api.types.Dataset import Dataset as DatasetNodeType
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.bearer_auth import PhoenixUser

from .models import V1RoutesBaseModel


def request_user_id(request: Request) -> Optional[int]:
    """The caller's user id, or None when auth is disabled or the caller is not a
    PhoenixUser. (Admins are PhoenixUsers too — the oracle's ADMINISTER rule, not
    a None here, is what grants them universal access.)"""
    if not request.app.state.authentication_enabled:
        return None
    user = request.user
    return int(user.identity) if isinstance(user, PhoenixUser) else None


async def assert_can_access(
    session: AsyncSession,
    request: Request,
    *,
    object_type: str,
    object_id: int,
    permission: Permission,
    not_found_detail: str,
) -> None:
    """Gate an action on ``(object_type, object_id)`` by the caller's ``permission`` on it
    (``OBJ_VIEW`` for reads, ``OBJ_EDIT`` for mutations). Unauthorized is surfaced as **404**
    — indistinguishable from not-found. A no-op when access control is not enforcing or auth
    is disabled (access control presupposes auth). Containment children pass their *parent's*
    (object_type, object_id); roots pass their own."""
    if not get_env_access_control_enabled():
        return
    user_id = request_user_id(request)
    if user_id is None:
        return
    if not await can_access(
        session,
        user_id=user_id,
        object_type=object_type,
        object_id=object_id,
        enabled=True,
        permission=permission,
    ):
        raise HTTPException(status_code=404, detail=not_found_detail)


async def assert_can_read(
    session: AsyncSession,
    request: Request,
    *,
    object_type: str,
    object_id: int,
    not_found_detail: str,
) -> None:
    """Gate a *read* by the caller's visibility (``OBJ_VIEW``) of ``(object_type,
    object_id)``. Thin wrapper over :func:`assert_can_access`."""
    await assert_can_access(
        session,
        request,
        object_type=object_type,
        object_id=object_id,
        permission=Permission.OBJ_VIEW,
        not_found_detail=not_found_detail,
    )


async def scope_predicate(
    session: AsyncSession,
    request: Request,
    *,
    object_type: str,
    id_column: "InstrumentedAttribute[int]",
) -> "ColumnElement[bool]":
    """A WHERE predicate restricting a *list* query to the rows the caller may
    read. ``true()`` when access control is not enforcing or auth is disabled, so
    callers can ``.where(...)`` it unconditionally with no behavior change.

    Compiles the actor's accessible scope to ``id_column IN (...)`` — a single hashed
    lookup. Not a correlated per-row grant subquery, which on a full-table list re-runs
    for every candidate row and is orders of magnitude slower."""
    if not get_env_access_control_enabled():
        return true()
    user_id = request_user_id(request)
    if user_id is None:
        return true()
    scope = await accessible_scope(
        session,
        user_id=user_id,
        object_type=object_type,
        enabled=True,
    )
    return scope.apply(id_column)


async def assert_can_read_experiment(
    session: AsyncSession,
    request: Request,
    experiment_rowid: int,
    *,
    not_found_detail: str,
) -> None:
    """Access-by-parent for experiments: an experiment (and its runs, evaluations, and
    exports) derives its access from the dataset it runs on. Resolves the parent dataset and
    gates on it. A no-op if the experiment is absent (the endpoint surfaces its own
    not-found)."""
    await assert_can_access_experiment(
        session,
        request,
        experiment_rowid,
        permission=Permission.OBJ_VIEW,
        not_found_detail=not_found_detail,
    )


async def assert_can_access_experiment(
    session: AsyncSession,
    request: Request,
    experiment_rowid: int,
    *,
    permission: Permission,
    not_found_detail: str,
) -> None:
    """Gate an experiment action through the parent dataset's access policy."""
    dataset_id = await session.scalar(
        select(models.Experiment.dataset_id).where(models.Experiment.id == experiment_rowid)
    )
    if dataset_id is None:
        return
    await assert_can_read(
        session,
        request,
        object_type=OBJECT_TYPE_DATASET,
        object_id=dataset_id,
        not_found_detail=not_found_detail,
    )
    if permission is Permission.OBJ_VIEW:
        return
    await assert_can_access(
        session,
        request,
        object_type=OBJECT_TYPE_DATASET,
        object_id=dataset_id,
        permission=permission,
        not_found_detail=not_found_detail,
    )


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
