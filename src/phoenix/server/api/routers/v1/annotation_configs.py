import logging
from typing import Any, List, Optional, Union

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from starlette.requests import Request
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
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
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig,
    ContinuousAnnotationConfig,
    FreeformAnnotationConfig,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["annotation_configs"])


class CategoricalAnnotationValue(BaseModel):
    label: str
    score: Optional[float] = None


class AnnotationConfigResponse(BaseModel):
    id: str
    name: str
    annotation_type: AnnotationType
    optimization_direction: Optional[OptimizationDirection] = None
    description: Optional[str] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    values: Optional[List[CategoricalAnnotationValue]] = None


def annotation_config_to_response(
    annotation_config: models.AnnotationConfig,
) -> AnnotationConfigResponse:
    """Convert an AnnotationConfig SQLAlchemy model instance to our response model."""
    config = annotation_config.config
    base: dict[str, Any] = {
        "name": annotation_config.name,
        "annotation_type": config.type,
        "description": config.description,
    }
    if isinstance(config, ContinuousAnnotationConfigModel):
        base["id"] = str(GlobalID(ContinuousAnnotationConfig.__name__, str(annotation_config.id)))
        base["optimization_direction"] = config.optimization_direction
        base["lower_bound"] = config.lower_bound
        base["upper_bound"] = config.upper_bound
    elif isinstance(config, CategoricalAnnotationConfigModel):
        base["id"] = str(GlobalID(CategoricalAnnotationConfig.__name__, str(annotation_config.id)))
        base["optimization_direction"] = config.optimization_direction
        base["values"] = [
            CategoricalAnnotationValue(label=val.label, score=val.score) for val in config.values
        ]
    elif isinstance(config, FreeformAnnotationConfigModel):
        base["id"] = str(GlobalID(FreeformAnnotationConfig.__name__, str(annotation_config.id)))
    else:
        assert_never(config)
    return AnnotationConfigResponse(**base)


class CreateContinuousAnnotationConfigPayload(BaseModel):
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


class CreateCategoricalAnnotationValuePayload(BaseModel):
    label: str
    score: Optional[float] = None


class CreateCategoricalAnnotationConfigPayload(BaseModel):
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    values: List[CreateCategoricalAnnotationValuePayload]


class CreateFreeformAnnotationConfigPayload(BaseModel):
    name: str
    description: Optional[str] = None


@router.get(
    "/annotation_configs",
    response_model=List[AnnotationConfigResponse],
    summary="List annotation configurations",
)
async def list_annotation_configs(
    request: Request,
    limit: int = Query(50, gt=0, description="Maximum number of configs to return"),
) -> List[AnnotationConfigResponse]:
    async with request.app.state.db() as session:
        result = await session.execute(
            select(models.AnnotationConfig).order_by(models.AnnotationConfig.name).limit(limit)
        )
        configs = result.scalars().all()
        return [annotation_config_to_response(config) for config in configs]


@router.get(
    "/annotation_configs/{config_identifier}",
    response_model=AnnotationConfigResponse,
    summary="Get an annotation configuration by ID or name",
)
async def get_annotation_config_by_name_or_id(
    request: Request,
    config_identifier: str = Path(..., description="ID or name of the annotation configuration"),
) -> AnnotationConfigResponse:
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
        return annotation_config_to_response(config)


@router.post(
    "/annotation_configs/continuous",
    response_model=AnnotationConfigResponse,
    summary="Create a continuous annotation configuration",
)
async def create_continuous_annotation_config(
    request: Request,
    payload: CreateContinuousAnnotationConfigPayload,
) -> AnnotationConfigResponse:
    _reserve_note_annotation_name(payload)

    async with request.app.state.db() as session:
        config = ContinuousAnnotationConfigModel(
            type=AnnotationType.CONTINUOUS.value,
            description=payload.description,
            optimization_direction=payload.optimization_direction,
            lower_bound=payload.lower_bound,
            upper_bound=payload.upper_bound,
        )
        annotation_config = models.AnnotationConfig(
            name=payload.name,
            config=config,
        )
        session.add(annotation_config)
        try:
            await session.commit()
        except Exception as e:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        return annotation_config_to_response(annotation_config)


@router.post(
    "/annotation_configs/categorical",
    response_model=AnnotationConfigResponse,
    summary="Create a categorical annotation configuration",
)
async def create_categorical_annotation_config(
    request: Request,
    payload: CreateCategoricalAnnotationConfigPayload,
) -> AnnotationConfigResponse:
    _reserve_note_annotation_name(payload)

    async with request.app.state.db() as session:
        values = [
            CategoricalAnnotationValueModel(label=value.label, score=value.score)
            for value in payload.values
        ]
        config = CategoricalAnnotationConfigModel(
            type=AnnotationType.CATEGORICAL.value,
            description=payload.description,
            optimization_direction=payload.optimization_direction,
            values=values,
        )
        annotation_config = models.AnnotationConfig(
            name=payload.name,
            config=config,
        )
        session.add(annotation_config)
        try:
            await session.commit()
        except Exception as e:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        return annotation_config_to_response(annotation_config)


@router.post(
    "/annotation_configs/freeform",
    response_model=AnnotationConfigResponse,
    summary="Create a freeform annotation configuration",
)
async def create_freeform_annotation_config(
    request: Request,
    payload: CreateFreeformAnnotationConfigPayload,
) -> AnnotationConfigResponse:
    _reserve_note_annotation_name(payload)

    async with request.app.state.db() as session:
        config = FreeformAnnotationConfigModel(
            type=AnnotationType.FREEFORM.value,
            description=payload.description,
        )
        annotation_config = models.AnnotationConfig(
            name=payload.name,
            config=config,
        )
        session.add(annotation_config)
        try:
            await session.commit()
        except Exception as e:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        return annotation_config_to_response(annotation_config)


@router.delete(
    "/annotation_configs/{config_id}",
    response_model=bool,
    summary="Delete an annotation configuration",
)
async def delete_annotation_config(
    request: Request,
    config_id: str = Path(..., description="ID of the annotation configuration"),
) -> bool:
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
        stmt = delete(models.AnnotationConfig).where(models.AnnotationConfig.id == config_rowid)
        result = await session.execute(stmt)
        if result.rowcount == 0:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND, detail="Annotation configuration not found"
            )
        await session.commit()
    return True


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


def _reserve_note_annotation_name(
    payload: Union[
        CreateCategoricalAnnotationConfigPayload,
        CreateContinuousAnnotationConfigPayload,
        CreateFreeformAnnotationConfigPayload,
    ],
) -> str:
    name = payload.name
    if name == "note":
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST, detail="The name 'note' is reserved for span notes"
        )
    return name
