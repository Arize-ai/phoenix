import logging
from typing import Annotated, List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Path, Query
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
from phoenix.server.api.routers.v1.utils import PaginatedResponseBody, ResponseBody
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
            CategoricalAnnotationConfigType.__name__,
            ContinuousAnnotationConfigType.__name__,
            FreeformAnnotationConfigType.__name__,
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
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND, detail="Annotation configuration not found"
            )
        return GetAnnotationConfigResponseBody(data=db_to_api_annotation_config(config))


@router.post(
    "/annotation_configs",
    dependencies=[Depends(is_not_locked)],
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
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(error))

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
                status_code=HTTP_409_CONFLICT,
                detail="The name of the annotation configuration is already taken",
            )
        return CreateAnnotationConfigResponseBody(
            data=db_to_api_annotation_config(annotation_config)
        )


@router.put(
    "/annotation_configs/{config_id}",
    dependencies=[Depends(is_not_locked)],
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
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST, detail="Invalid annotation configuration ID"
        )
    config_rowid = int(config_gid.node_id)

    try:
        db_config = _to_db_annotation_config(input_config)
    except ValueError as error:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(error))

    async with request.app.state.db() as session:
        existing_config = await session.get(models.AnnotationConfig, config_rowid)
        if not existing_config:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND, detail="Annotation configuration not found"
            )

        existing_config.name = input_config.name
        existing_config.config = db_config

        try:
            await session.commit()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise HTTPException(
                status_code=HTTP_409_CONFLICT,
                detail="The name of the annotation configuration is already taken",
            )

        return UpdateAnnotationConfigResponseBody(data=db_to_api_annotation_config(existing_config))


@router.delete(
    "/annotation_configs/{config_id}",
    summary="Delete an annotation configuration",
)
async def delete_annotation_config(
    request: Request,
    config_id: str = Path(..., description="ID of the annotation configuration"),
) -> DeleteAnnotationConfigResponseBody:
    config_gid = GlobalID.from_id(config_id)
    if config_gid.type_name not in (
        CategoricalAnnotationConfigType.__name__,
        ContinuousAnnotationConfigType.__name__,
        FreeformAnnotationConfigType.__name__,
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
    return DeleteAnnotationConfigResponseBody(data=db_to_api_annotation_config(annotation_config))


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
            status_code=HTTP_409_CONFLICT, detail="The name 'note' is reserved for span notes"
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
    )
