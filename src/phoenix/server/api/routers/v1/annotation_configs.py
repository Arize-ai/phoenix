import logging
from typing import Annotated, List, Literal, Optional, Union

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import Field, RootModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.requests import Request
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
)
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
from phoenix.server.api.routers.v1.utils import PaginatedResponseBody
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig,
    ContinuousAnnotationConfig,
    FreeformAnnotationConfig,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["annotation_configs"])


class CategoricalAnnotationValue(V1RoutesBaseModel):
    label: str
    score: Optional[float] = None


class CategoricalAnnotationConfigPayload(V1RoutesBaseModel):
    name: str
    type: Literal[AnnotationType.CATEGORICAL.value]  # type: ignore[name-defined]
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    values: List[CategoricalAnnotationValue]


class ContinuousAnnotationConfigPayload(V1RoutesBaseModel):
    name: str
    type: Literal[AnnotationType.CONTINUOUS.value]  # type: ignore[name-defined]
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


class FreeformAnnotationConfigPayload(V1RoutesBaseModel):
    name: str
    type: Literal[AnnotationType.FREEFORM.value]  # type: ignore[name-defined]
    description: Optional[str] = None


AnnotationConfigPayloadType: TypeAlias = Annotated[
    Union[
        CategoricalAnnotationConfigPayload,
        ContinuousAnnotationConfigPayload,
        FreeformAnnotationConfigPayload,
    ],
    Field(..., discriminator="type"),
]


class CategoricalAnnotationConfigWithID(CategoricalAnnotationConfigPayload):
    id: str


class ContinuousAnnotationConfigWithID(ContinuousAnnotationConfigPayload):
    id: str


class FreeformAnnotationConfigWithID(FreeformAnnotationConfigPayload):
    id: str


AnnotationConfigWithID: TypeAlias = Annotated[
    Union[
        CategoricalAnnotationConfigWithID,
        ContinuousAnnotationConfigWithID,
        FreeformAnnotationConfigWithID,
    ],
    Field(..., discriminator="type"),
]


def db_to_api_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> AnnotationConfigWithID:
    config = annotation_config.config
    name = annotation_config.name
    type_ = config.type
    description = config.description
    if isinstance(config, ContinuousAnnotationConfigModel):
        return ContinuousAnnotationConfigWithID(
            id=str(GlobalID(ContinuousAnnotationConfig.__name__, str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
            optimization_direction=config.optimization_direction,
            lower_bound=config.lower_bound,
            upper_bound=config.upper_bound,
        )
    if isinstance(config, CategoricalAnnotationConfigModel):
        return CategoricalAnnotationConfigWithID(
            id=str(GlobalID(CategoricalAnnotationConfig.__name__, str(annotation_config.id))),
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
        return FreeformAnnotationConfigWithID(
            id=str(GlobalID(FreeformAnnotationConfig.__name__, str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
        )
    assert_never(config)


def _get_annotation_global_id(annotation_config: models.AnnotationConfig) -> GlobalID:
    config = annotation_config.config
    if isinstance(config, ContinuousAnnotationConfigModel):
        return GlobalID(ContinuousAnnotationConfig.__name__, str(annotation_config.id))
    if isinstance(config, CategoricalAnnotationConfigModel):
        return GlobalID(CategoricalAnnotationConfig.__name__, str(annotation_config.id))
    if isinstance(config, FreeformAnnotationConfigModel):
        return GlobalID(FreeformAnnotationConfig.__name__, str(annotation_config.id))
    assert_never(config)


class CreateAnnotationConfigPayload(RootModel[AnnotationConfigPayloadType]):
    root: AnnotationConfigPayloadType


class GetAnnotationConfigsResponseBody(PaginatedResponseBody[AnnotationConfigWithID]):
    pass


@router.get(
    "/annotation_configs",
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
                status_code=HTTP_400_BAD_REQUEST,
            )
        if cursor_gid.type_name not in (
            CategoricalAnnotationConfig.__name__,
            ContinuousAnnotationConfig.__name__,
            FreeformAnnotationConfig.__name__,
        ):
            raise HTTPException(
                detail=f"Invalid cursor: {cursor}",
                status_code=HTTP_400_BAD_REQUEST,
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
    summary="Get an annotation configuration by ID or name",
)
async def get_annotation_config_by_name_or_id(
    request: Request,
    config_identifier: str = Path(..., description="ID or name of the annotation configuration"),
) -> AnnotationConfigWithID:
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
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND, detail="Annotation configuration not found"
            )
        return db_to_api_annotation_config(config)


@router.post(
    "/annotation_configs",
    summary="Create an annotation configuration",
)
async def create_annotation_config(
    request: Request,
    payload: CreateAnnotationConfigPayload,
) -> AnnotationConfigWithID:
    input_config = payload.root
    _reserve_note_annotation_name(input_config)

    async with request.app.state.db() as session:
        db_config = _to_db_annotation_config(input_config)
        annotation_config = models.AnnotationConfig(
            name=input_config.name,
            config=db_config,
        )
        session.add(annotation_config)
        try:
            await session.commit()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=HTTP_409_CONFLICT,
                detail="The name of the annotation configuration is already taken",
            )
        return db_to_api_annotation_config(annotation_config)


@router.put(
    "/annotation_configs/{config_id}",
    summary="Update an annotation configuration",
)
async def update_annotation_config(
    request: Request,
    payload: CreateAnnotationConfigPayload,
    config_id: str = Path(..., description="ID of the annotation configuration"),
) -> AnnotationConfigWithID:
    input_config = payload.root
    _reserve_note_annotation_name(input_config)

    config_gid = GlobalID.from_id(config_id)
    if config_gid.type_name not in (
        CategoricalAnnotationConfig.__name__,
        ContinuousAnnotationConfig.__name__,
        FreeformAnnotationConfig.__name__,
    ):
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST, detail="Invalid annotation configuration ID"
        )
    config_rowid = int(config_gid.node_id)

    async with request.app.state.db() as session:
        existing_config = await session.get(models.AnnotationConfig, config_rowid)
        if not existing_config:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND, detail="Annotation configuration not found"
            )

        db_config = _to_db_annotation_config(input_config)
        existing_config.name = input_config.name
        existing_config.config = db_config

        try:
            await session.commit()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=HTTP_409_CONFLICT,
                detail="The name of the annotation configuration is already taken",
            )

        return db_to_api_annotation_config(existing_config)


@router.delete(
    "/annotation_configs/{config_id}",
    summary="Delete an annotation configuration",
)
async def delete_annotation_config(
    request: Request,
    config_id: str = Path(..., description="ID of the annotation configuration"),
) -> AnnotationConfigWithID:
    config_gid = GlobalID.from_id(config_id)
    if config_gid.type_name not in (
        CategoricalAnnotationConfig.__name__,
        ContinuousAnnotationConfig.__name__,
        FreeformAnnotationConfig.__name__,
    ):
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST, detail="Invalid annotation configuration ID"
        )
    config_rowid = int(config_gid.node_id)
    async with request.app.state.db() as session:
        stmt = (
            delete(models.AnnotationConfig)
            .where(models.AnnotationConfig.id == config_rowid)
            .returning(models.AnnotationConfig)
        )
        annotation_config = await session.scalar(stmt)
        if annotation_config is None:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND, detail="Annotation configuration not found"
            )
        await session.commit()
    return db_to_api_annotation_config(annotation_config)


def _get_annotation_config_db_id(config_gid: str) -> int:
    gid = GlobalID.from_id(config_gid)
    type_name, node_id = gid.type_name, int(gid.node_id)
    if type_name not in (
        CategoricalAnnotationConfig.__name__,
        ContinuousAnnotationConfig.__name__,
        FreeformAnnotationConfig.__name__,
    ):
        raise ValueError(f"Invalid annotation configuration ID: {config_gid}")
    return node_id


def _reserve_note_annotation_name(payload: AnnotationConfigPayloadType) -> str:
    name = payload.name
    if name == "note":
        raise HTTPException(
            status_code=HTTP_409_CONFLICT, detail="The name 'note' is reserved for span notes"
        )
    return name


def _to_db_annotation_config(input_config: AnnotationConfigPayloadType) -> AnnotationConfigType:
    if isinstance(input_config, ContinuousAnnotationConfigPayload):
        return _to_db_continuous_annotation_config(input_config)
    if isinstance(input_config, CategoricalAnnotationConfigPayload):
        return _to_db_categorical_annotation_config(input_config)
    if isinstance(input_config, FreeformAnnotationConfigPayload):
        return _to_db_freeform_annotation_config(input_config)
    assert_never(input_config)


def _to_db_continuous_annotation_config(
    input_config: ContinuousAnnotationConfigPayload,
) -> ContinuousAnnotationConfigModel:
    return ContinuousAnnotationConfigModel(
        type=AnnotationType.CONTINUOUS.value,
        description=input_config.description,
        optimization_direction=input_config.optimization_direction,
        lower_bound=input_config.lower_bound,
        upper_bound=input_config.upper_bound,
    )


def _to_db_categorical_annotation_config(
    input_config: CategoricalAnnotationConfigPayload,
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
    input_config: FreeformAnnotationConfigPayload,
) -> FreeformAnnotationConfigModel:
    return FreeformAnnotationConfigModel(
        type=AnnotationType.FREEFORM.value,
        description=input_config.description,
    )
