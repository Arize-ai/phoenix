import logging
from typing import Annotated, List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field, RootModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    AnnotationType,
    OptimizationDirection,
)
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue as CategoricalAnnotationValueModel,
)
from phoenix.db.types.annotation_configs import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    FreeformAnnotationConfig as FreeformAnnotationConfigModel,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    get_project_by_identifier,
)
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigType,
)
from phoenix.server.api.types.AnnotationConfig import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigType,
)
from phoenix.server.api.types.AnnotationConfig import (
    FreeformAnnotationConfig as FreeformAnnotationConfigType,
)
from phoenix.server.authorization import is_not_locked

logger = logging.getLogger(__name__)

router = APIRouter(tags=["annotation_configs"])


class CategoricalAnnotationValue(V1RoutesBaseModel):
    label: str
    score: Optional[float] = None


class CategoricalAnnotationConfigData(V1RoutesBaseModel):
    name: str
    type: Literal[AnnotationType.CATEGORICAL.value]  # type: ignore[name-defined]
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    values: List[CategoricalAnnotationValue]


class ContinuousAnnotationConfigData(V1RoutesBaseModel):
    name: str
    type: Literal[AnnotationType.CONTINUOUS.value]  # type: ignore[name-defined]
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


class FreeformAnnotationConfigData(V1RoutesBaseModel):
    name: str
    type: Literal[AnnotationType.FREEFORM.value]  # type: ignore[name-defined]
    description: Optional[str] = None
    optimization_direction: Optional[OptimizationDirection] = None
    threshold: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


AnnotationConfigData: TypeAlias = Annotated[
    Union[
        CategoricalAnnotationConfigData,
        ContinuousAnnotationConfigData,
        FreeformAnnotationConfigData,
    ],
    Field(..., discriminator="type"),
]


class CategoricalAnnotationConfig(CategoricalAnnotationConfigData):
    id: str


class ContinuousAnnotationConfig(ContinuousAnnotationConfigData):
    id: str


class FreeformAnnotationConfig(FreeformAnnotationConfigData):
    id: str


AnnotationConfig: TypeAlias = Annotated[
    Union[
        CategoricalAnnotationConfig,
        ContinuousAnnotationConfig,
        FreeformAnnotationConfig,
    ],
    Field(..., discriminator="type"),
]


def db_to_api_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> AnnotationConfig:
    config = annotation_config.config
    name = annotation_config.name
    type_ = config.type
    description = config.description
    if isinstance(config, ContinuousAnnotationConfigModel):
        return ContinuousAnnotationConfig(
            id=str(GlobalID(ContinuousAnnotationConfigType.__name__, str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
            optimization_direction=config.optimization_direction,
            lower_bound=config.lower_bound,
            upper_bound=config.upper_bound,
        )
    if isinstance(config, CategoricalAnnotationConfigModel):
        return CategoricalAnnotationConfig(
            id=str(GlobalID(CategoricalAnnotationConfigType.__name__, str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
            optimization_direction=config.optimization_direction,
            values=[
                CategoricalAnnotationValue(label=val.label, score=val.score)
                for val in config.values
            ],
        )
    if isinstance(config, FreeformAnnotationConfigModel):
        return FreeformAnnotationConfig(
            id=str(GlobalID(FreeformAnnotationConfigType.__name__, str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
            optimization_direction=config.optimization_direction,
            threshold=(config.thresholds[0] if config.thresholds else None),
            lower_bound=config.lower_bound,
            upper_bound=config.upper_bound,
        )
    assert_never(config)


def _get_annotation_global_id(annotation_config: models.AnnotationConfig) -> GlobalID:
    config = annotation_config.config
    if isinstance(config, ContinuousAnnotationConfigModel):
        return GlobalID(ContinuousAnnotationConfigType.__name__, str(annotation_config.id))
    if isinstance(config, CategoricalAnnotationConfigModel):
        return GlobalID(CategoricalAnnotationConfigType.__name__, str(annotation_config.id))
    if isinstance(config, FreeformAnnotationConfigModel):
        return GlobalID(FreeformAnnotationConfigType.__name__, str(annotation_config.id))
    assert_never(config)


class CreateAnnotationConfigData(RootModel[AnnotationConfigData]):
    root: AnnotationConfigData


class GetAnnotationConfigsResponseBody(PaginatedResponseBody[AnnotationConfig]):
    pass


class GetAnnotationConfigResponseBody(ResponseBody[AnnotationConfig]):
    pass


class CreateAnnotationConfigResponseBody(ResponseBody[AnnotationConfig]):
    pass


class UpdateAnnotationConfigResponseBody(ResponseBody[AnnotationConfig]):
    pass


class DeleteAnnotationConfigResponseBody(ResponseBody[AnnotationConfig]):
    pass


class GetProjectAnnotationConfigsResponseBody(PaginatedResponseBody[AnnotationConfig]):
    pass


class AssignAnnotationConfigToProjectResponseBody(ResponseBody[AnnotationConfig]):
    pass


class SetProjectAnnotationConfigsRequestBody(V1RoutesBaseModel):
    annotation_config_ids: List[str] = Field(
        ...,
        description=(
            "The complete set of annotation configuration GlobalIDs that should be assigned to "
            "the project. Configs not in this list are unassigned; an empty list clears all "
            "assignments."
        ),
    )


class SetProjectAnnotationConfigsResponseBody(PaginatedResponseBody[AnnotationConfig]):
    pass


@router.get(
    "/annotation_configs",
    operation_id="listAnnotationConfigs",
    summary="List annotation configurations",
    description="Retrieve a paginated list of all annotation configurations in the system.",
    response_description="A list of annotation configurations with pagination information",
)
async def list_annotation_configs(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded annotation config ID)",
    ),
    limit: int = Query(100, gt=0, description="Maximum number of configs to return"),
) -> GetAnnotationConfigsResponseBody:
    cursor_id: Optional[int] = None
    if cursor:
        try:
            cursor_gid = GlobalID.from_id(cursor)
        except ValueError:
            raise HTTPException(
                detail=f"Invalid cursor: {cursor}",
                status_code=400,
            )
        if cursor_gid.type_name not in (
            CategoricalAnnotationConfigType.__name__,
            ContinuousAnnotationConfigType.__name__,
            FreeformAnnotationConfigType.__name__,
        ):
            raise HTTPException(
                detail=f"Invalid cursor: {cursor}",
                status_code=400,
            )
        cursor_id = int(cursor_gid.node_id)

    async with request.app.state.db() as session:
        query = (
            select(models.AnnotationConfig)
            .order_by(models.AnnotationConfig.id.desc())
            .limit(limit + 1)  # overfetch by 1 to check if there are more results
        )
        if cursor_id is not None:
            query = query.where(models.AnnotationConfig.id <= cursor_id)

        result = await session.scalars(query)
        configs = result.all()

        next_cursor = None
        if len(configs) == limit + 1:
            last_config = configs[-1]
            next_cursor = str(_get_annotation_global_id(last_config))
            configs = configs[:-1]

        return GetAnnotationConfigsResponseBody(
            next_cursor=next_cursor,
            data=[db_to_api_annotation_config(config) for config in configs],
        )


@router.get(
    "/annotation_configs/{config_identifier}",
    operation_id="getAnnotationConfig",
    summary="Get an annotation configuration by ID or name",
)
async def get_annotation_config_by_name_or_id(
    request: Request,
    config_identifier: str = Path(..., description="ID or name of the annotation configuration"),
) -> GetAnnotationConfigResponseBody:
    async with request.app.state.db() as session:
        query = select(models.AnnotationConfig)
        # Try to interpret the identifier as an integer ID; if not, use it as a name.
        try:
            db_id = _get_annotation_config_db_id(config_identifier)
            query = query.where(models.AnnotationConfig.id == db_id)
        except ValueError:
            query = query.where(models.AnnotationConfig.name == config_identifier)
        config = await session.scalar(query)
        if not config:
            raise HTTPException(status_code=404, detail="Annotation configuration not found")
        return GetAnnotationConfigResponseBody(data=db_to_api_annotation_config(config))


@router.post(
    "/annotation_configs",
    dependencies=[Depends(is_not_locked)],
    operation_id="createAnnotationConfig",
    summary="Create an annotation configuration",
)
async def create_annotation_config(
    request: Request,
    data: CreateAnnotationConfigData,
) -> CreateAnnotationConfigResponseBody:
    input_config = data.root
    _reserve_note_annotation_name(input_config)

    try:
        db_config = _to_db_annotation_config(input_config)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    async with request.app.state.db() as session:
        annotation_config = models.AnnotationConfig(
            name=input_config.name,
            config=db_config,
        )
        session.add(annotation_config)
        try:
            await session.commit()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=409,
                detail="The name of the annotation configuration is already taken",
            )
        return CreateAnnotationConfigResponseBody(
            data=db_to_api_annotation_config(annotation_config)
        )


@router.put(
    "/annotation_configs/{config_id}",
    dependencies=[Depends(is_not_locked)],
    operation_id="updateAnnotationConfig",
    summary="Update an annotation configuration",
)
async def update_annotation_config(
    request: Request,
    data: CreateAnnotationConfigData,
    config_id: str = Path(..., description="ID of the annotation configuration"),
) -> UpdateAnnotationConfigResponseBody:
    input_config = data.root
    _reserve_note_annotation_name(input_config)

    config_gid = GlobalID.from_id(config_id)
    if config_gid.type_name not in (
        CategoricalAnnotationConfigType.__name__,
        ContinuousAnnotationConfigType.__name__,
        FreeformAnnotationConfigType.__name__,
    ):
        raise HTTPException(status_code=400, detail="Invalid annotation configuration ID")
    config_rowid = int(config_gid.node_id)

    try:
        db_config = _to_db_annotation_config(input_config)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    async with request.app.state.db() as session:
        existing_config = await session.get(models.AnnotationConfig, config_rowid)
        if not existing_config:
            raise HTTPException(status_code=404, detail="Annotation configuration not found")

        existing_config.name = input_config.name
        existing_config.config = db_config

        try:
            await session.commit()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=409,
                detail="The name of the annotation configuration is already taken",
            )

        return UpdateAnnotationConfigResponseBody(data=db_to_api_annotation_config(existing_config))


@router.delete(
    "/annotation_configs/{config_id}",
    operation_id="deleteAnnotationConfig",
    summary="Delete an annotation configuration",
)
async def delete_annotation_config(
    request: Request,
    config_id: str = Path(..., description="ID of the annotation configuration"),
) -> DeleteAnnotationConfigResponseBody:
    try:
        config_gid = GlobalID.from_id(config_id)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid annotation configuration ID format: {config_id}",
        )
    if config_gid.type_name not in (
        CategoricalAnnotationConfigType.__name__,
        ContinuousAnnotationConfigType.__name__,
        FreeformAnnotationConfigType.__name__,
    ):
        raise HTTPException(status_code=400, detail="Invalid annotation configuration ID")
    config_rowid = int(config_gid.node_id)
    async with request.app.state.db() as session:
        stmt = (
            delete(models.AnnotationConfig)
            .where(models.AnnotationConfig.id == config_rowid)
            .returning(models.AnnotationConfig)
        )
        annotation_config = await session.scalar(stmt)
        if annotation_config is None:
            raise HTTPException(status_code=404, detail="Annotation configuration not found")
        await session.commit()
    return DeleteAnnotationConfigResponseBody(data=db_to_api_annotation_config(annotation_config))


@router.get(
    "/projects/{project_identifier}/annotation_configs",
    operation_id="getProjectAnnotationConfigs",
    summary="List annotation configurations assigned to a project",
    description=(
        "Retrieve a paginated list of the annotation configurations assigned to a project, "
        "identified by either project ID or project name."
    ),
    response_description="A list of the project's annotation configurations with pagination information",  # noqa: E501
    responses=add_errors_to_responses([404, 422]),
)
async def list_project_annotation_configs(
    request: Request,
    project_identifier: str = Path(
        ..., description="The project identifier: either project ID or project name."
    ),
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded annotation config ID)",
    ),
    limit: int = Query(100, gt=0, description="Maximum number of configs to return"),
) -> GetProjectAnnotationConfigsResponseBody:
    """
    List the annotation configurations assigned to a project.

    Args:
        request (Request): The FastAPI request object.
        project_identifier (str): The project ID or name.
        cursor (Optional[str]): Pagination cursor (annotation config GlobalID).
        limit (int): Maximum number of configs to return per request.

    Returns:
        GetProjectAnnotationConfigsResponseBody: The project's annotation configs and
            pagination information.

    Raises:
        HTTPException: If the cursor is invalid or the project is not found.
    """
    cursor_id: Optional[int] = None
    if cursor:
        try:
            cursor_gid = GlobalID.from_id(cursor)
        except ValueError:
            raise HTTPException(detail=f"Invalid cursor: {cursor}", status_code=400)
        if cursor_gid.type_name not in (
            CategoricalAnnotationConfigType.__name__,
            ContinuousAnnotationConfigType.__name__,
            FreeformAnnotationConfigType.__name__,
        ):
            raise HTTPException(detail=f"Invalid cursor: {cursor}", status_code=400)
        cursor_id = int(cursor_gid.node_id)

    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        query = (
            select(models.AnnotationConfig)
            .join(
                models.ProjectAnnotationConfig,
                models.ProjectAnnotationConfig.annotation_config_id == models.AnnotationConfig.id,
            )
            .where(models.ProjectAnnotationConfig.project_id == project.id)
            .order_by(models.AnnotationConfig.id.desc())
            .limit(limit + 1)  # overfetch by 1 to check if there are more results
        )
        if cursor_id is not None:
            query = query.where(models.AnnotationConfig.id <= cursor_id)

        result = await session.scalars(query)
        configs = result.all()

        next_cursor = None
        if len(configs) == limit + 1:
            last_config = configs[-1]
            next_cursor = str(_get_annotation_global_id(last_config))
            configs = configs[:-1]

        return GetProjectAnnotationConfigsResponseBody(
            next_cursor=next_cursor,
            data=[db_to_api_annotation_config(config) for config in configs],
        )


@router.put(
    "/projects/{project_identifier}/annotation_configs/{config_identifier}",
    dependencies=[Depends(is_not_locked)],
    operation_id="assignAnnotationConfigToProject",
    summary="Assign an annotation configuration to a project",
    description=(
        "Assign an annotation configuration to a project. This operation is idempotent: "
        "re-assigning a config that is already assigned is a no-op that returns the config. "
        "Both the project and the config are identified by either ID or name."
    ),
    response_description="The annotation configuration assigned to the project",
    responses=add_errors_to_responses([403, 404, 422]),
)
async def assign_annotation_config_to_project(
    request: Request,
    project_identifier: str = Path(
        ..., description="The project identifier: either project ID or project name."
    ),
    config_identifier: str = Path(
        ..., description="The annotation configuration identifier: either ID or name."
    ),
) -> AssignAnnotationConfigToProjectResponseBody:
    """
    Assign an annotation configuration to a project (idempotent).

    Args:
        request (Request): The FastAPI request object.
        project_identifier (str): The project ID or name.
        config_identifier (str): The annotation config ID or name.

    Returns:
        AssignAnnotationConfigToProjectResponseBody: The assigned annotation config.

    Raises:
        HTTPException: If the project or the annotation config is not found.
    """
    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        config = await _get_annotation_config_by_identifier(session, config_identifier)
        # Serialize before mutating the session so the response is unaffected by the commit
        # expiring the ORM instance.
        data = db_to_api_annotation_config(config)
        session.add(
            models.ProjectAnnotationConfig(
                project_id=project.id,
                annotation_config_id=config.id,
            )
        )
        try:
            await session.commit()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            # The config is already assigned to the project. Assignment is idempotent, so the
            # duplicate is swallowed and treated as a successful no-op rather than a 409.
            await session.rollback()
        return AssignAnnotationConfigToProjectResponseBody(data=data)


@router.delete(
    "/projects/{project_identifier}/annotation_configs/{config_identifier}",
    operation_id="unassignAnnotationConfigFromProject",
    summary="Unassign an annotation configuration from a project",
    description=(
        "Unassign an annotation configuration from a project. This operation is idempotent: "
        "unassigning a config that is not currently assigned is a no-op. The underlying "
        "annotation config is not deleted. Both the project and the config are identified by "
        "either ID or name."
    ),
    response_description="No content returned on successful unassignment",
    status_code=204,
    responses=add_errors_to_responses([403, 404, 422]),
)
async def unassign_annotation_config_from_project(
    request: Request,
    project_identifier: str = Path(
        ..., description="The project identifier: either project ID or project name."
    ),
    config_identifier: str = Path(
        ..., description="The annotation configuration identifier: either ID or name."
    ),
) -> None:
    """
    Unassign an annotation configuration from a project (idempotent).

    Args:
        request (Request): The FastAPI request object.
        project_identifier (str): The project ID or name.
        config_identifier (str): The annotation config ID or name.

    Returns:
        None: Returns a 204 No Content response on success.

    Raises:
        HTTPException: If the project or the annotation config is not found.
    """
    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        config = await _get_annotation_config_by_identifier(session, config_identifier)
        await session.execute(
            delete(models.ProjectAnnotationConfig).where(
                models.ProjectAnnotationConfig.project_id == project.id,
                models.ProjectAnnotationConfig.annotation_config_id == config.id,
            )
        )
        # Deleting a non-existent assignment is a no-op (idempotent).
    return None


@router.put(
    "/projects/{project_identifier}/annotation_configs",
    dependencies=[Depends(is_not_locked)],
    operation_id="setProjectAnnotationConfigs",
    summary="Replace the set of annotation configurations assigned to a project",
    description=(
        "Replace the project's entire set of assigned annotation configurations with the "
        "provided set. The server diffs the desired set against the current set: configs in the "
        "body but not assigned are added, and configs assigned but not in the body are removed. "
        "An empty array clears all assignments."
    ),
    response_description="The resulting set of annotation configurations assigned to the project",
    responses=add_errors_to_responses([403, 404, 422]),
)
async def set_project_annotation_configs(
    request: Request,
    request_body: SetProjectAnnotationConfigsRequestBody,
    project_identifier: str = Path(
        ..., description="The project identifier: either project ID or project name."
    ),
) -> SetProjectAnnotationConfigsResponseBody:
    """
    Replace the set of annotation configurations assigned to a project.

    Args:
        request (Request): The FastAPI request object.
        request_body (SetProjectAnnotationConfigsRequestBody): The desired set of annotation
            config GlobalIDs.
        project_identifier (str): The project ID or name.

    Returns:
        SetProjectAnnotationConfigsResponseBody: The resulting set of assigned annotation configs.

    Raises:
        HTTPException: If the project is not found, or if any annotation config GlobalID in the
            body is invalid or refers to a config that does not exist.
    """
    desired_ids: set[int] = set()
    for config_id in request_body.annotation_config_ids:
        try:
            desired_ids.add(_get_annotation_config_db_id(config_id))
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid annotation configuration ID: {config_id}",
            )

    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)

        desired_configs: list[models.AnnotationConfig] = []
        if desired_ids:
            result = await session.scalars(
                select(models.AnnotationConfig).where(models.AnnotationConfig.id.in_(desired_ids))
            )
            desired_configs = list(result.all())
            if desired_ids - {config.id for config in desired_configs}:
                raise HTTPException(
                    status_code=422,
                    detail="One or more annotation configurations were not found",
                )

        current_result = await session.scalars(
            select(models.ProjectAnnotationConfig.annotation_config_id).where(
                models.ProjectAnnotationConfig.project_id == project.id
            )
        )
        current_ids = set(current_result.all())

        to_add = desired_ids - current_ids
        to_remove = current_ids - desired_ids

        if to_remove:
            await session.execute(
                delete(models.ProjectAnnotationConfig).where(
                    models.ProjectAnnotationConfig.project_id == project.id,
                    models.ProjectAnnotationConfig.annotation_config_id.in_(to_remove),
                )
            )
        for annotation_config_id in to_add:
            session.add(
                models.ProjectAnnotationConfig(
                    project_id=project.id,
                    annotation_config_id=annotation_config_id,
                )
            )

        # Serialize before committing so the response is unaffected by the commit expiring the
        # ORM instances. Order by ID descending to match the list endpoint.
        data = [
            db_to_api_annotation_config(config)
            for config in sorted(desired_configs, key=lambda c: c.id, reverse=True)
        ]
        await session.commit()

    return SetProjectAnnotationConfigsResponseBody(next_cursor=None, data=data)


async def _get_annotation_config_by_identifier(
    session: AsyncSession,
    config_identifier: str,
) -> models.AnnotationConfig:
    """
    Get an annotation configuration by its GlobalID or name.

    Args:
        session: The database session.
        config_identifier: The annotation config GlobalID or name.

    Returns:
        The annotation config object.

    Raises:
        HTTPException: 404 if the annotation config is not found.
    """
    query = select(models.AnnotationConfig)
    # Try to interpret the identifier as a GlobalID; if not, use it as a name.
    try:
        db_id = _get_annotation_config_db_id(config_identifier)
        query = query.where(models.AnnotationConfig.id == db_id)
    except ValueError:
        query = query.where(models.AnnotationConfig.name == config_identifier)
    config = await session.scalar(query)
    if config is None:
        raise HTTPException(status_code=404, detail="Annotation configuration not found")
    return config


def _get_annotation_config_db_id(config_gid: str) -> int:
    gid = GlobalID.from_id(config_gid)
    type_name, node_id = gid.type_name, int(gid.node_id)
    if type_name not in (
        CategoricalAnnotationConfigType.__name__,
        ContinuousAnnotationConfigType.__name__,
        FreeformAnnotationConfigType.__name__,
    ):
        raise ValueError(f"Invalid annotation configuration ID: {config_gid}")
    return node_id


def _reserve_note_annotation_name(data: AnnotationConfigData) -> str:
    name = data.name
    if name == "note":
        raise HTTPException(
            status_code=409,
            detail=(
                "The name 'note' is reserved for trace and span notes and cannot be used "
                "for annotation configs."
            ),
        )
    return name


def _to_db_annotation_config(input_config: AnnotationConfigData) -> AnnotationConfigType:
    if isinstance(input_config, ContinuousAnnotationConfigData):
        return _to_db_continuous_annotation_config(input_config)
    if isinstance(input_config, CategoricalAnnotationConfigData):
        return _to_db_categorical_annotation_config(input_config)
    if isinstance(input_config, FreeformAnnotationConfigData):
        return _to_db_freeform_annotation_config(input_config)
    assert_never(input_config)


def _to_db_continuous_annotation_config(
    input_config: ContinuousAnnotationConfigData,
) -> ContinuousAnnotationConfigModel:
    return ContinuousAnnotationConfigModel(
        type=AnnotationType.CONTINUOUS.value,
        description=input_config.description,
        optimization_direction=input_config.optimization_direction,
        lower_bound=input_config.lower_bound,
        upper_bound=input_config.upper_bound,
    )


def _to_db_categorical_annotation_config(
    input_config: CategoricalAnnotationConfigData,
) -> CategoricalAnnotationConfigModel:
    values = [
        CategoricalAnnotationValueModel(label=value.label, score=value.score)
        for value in input_config.values
    ]
    return CategoricalAnnotationConfigModel(
        type=AnnotationType.CATEGORICAL.value,
        description=input_config.description,
        optimization_direction=input_config.optimization_direction,
        values=values,
    )


def _to_db_freeform_annotation_config(
    input_config: FreeformAnnotationConfigData,
) -> FreeformAnnotationConfigModel:
    return FreeformAnnotationConfigModel(
        type=AnnotationType.FREEFORM.value,
        description=input_config.description,
        optimization_direction=input_config.optimization_direction,
        thresholds=([input_config.threshold] if input_config.threshold is not None else None),
        lower_bound=input_config.lower_bound,
        upper_bound=input_config.upper_bound,
    )
