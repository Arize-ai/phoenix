import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from starlette.requests import Request
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig,
    ContinuousAnnotationConfig,
    FreeformAnnotationConfig,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["annotation_configs"])


class AllowedValue(BaseModel):
    label: str
    numeric_score: Optional[float] = None


class AnnotationConfigResponse(BaseModel):
    id: str
    name: str
    annotation_type: str
    optimization_direction: str
    description: Optional[str] = None
    # Continuous config fields:
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    # Categorical config fields:
    is_ordinal: Optional[bool] = None
    multilabel_allowed: Optional[bool] = None
    allowed_values: Optional[List[AllowedValue]] = None

    class Config:
        orm_mode = True


def annotation_config_to_response(config: models.AnnotationConfig) -> AnnotationConfigResponse:
    """Convert an AnnotationConfig SQLAlchemy model instance to our response model."""
    base = {
        "name": config.name,
        "annotation_type": config.annotation_type,
        "optimization_direction": config.optimization_direction,
        "description": config.description,
    }
    if config.annotation_type.upper() == "CONTINUOUS" and config.continuous_config:
        base["id"] = str(GlobalID(ContinuousAnnotationConfig.__name__, str(config.id)))
        base["lower_bound"] = config.continuous_config.lower_bound
        base["upper_bound"] = config.continuous_config.upper_bound
    elif config.annotation_type.upper() == "CATEGORICAL" and config.categorical_config:
        base["id"] = str(GlobalID(CategoricalAnnotationConfig.__name__, str(config.id)))
        base["is_ordinal"] = config.categorical_config.is_ordinal
        base["multilabel_allowed"] = config.categorical_config.multilabel_allowed
        base["allowed_values"] = [
            AllowedValue(label=val.label, numeric_score=val.numeric_score)
            for val in config.categorical_config.allowed_values
        ]
    elif config.annotation_type.upper() == "FREEFORM":
        base["id"] = str(GlobalID(FreeformAnnotationConfig.__name__, str(config.id)))
    return AnnotationConfigResponse(**base)


class CreateContinuousAnnotationConfigPayload(BaseModel):
    name: str
    optimization_direction: str
    description: Optional[str] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


class CreateCategoricalAnnotationValuePayload(BaseModel):
    label: str
    numeric_score: Optional[float] = None


class CreateCategoricalAnnotationConfigPayload(BaseModel):
    name: str
    optimization_direction: str
    description: Optional[str] = None
    is_ordinal: bool
    multilabel_allowed: bool
    allowed_values: List[CreateCategoricalAnnotationValuePayload]


class CreateBinaryAnnotationConfigPayload(BaseModel):
    name: str
    optimization_direction: str
    description: Optional[str] = None
    is_ordinal: bool = False
    multilabel_allowed: bool = False
    allowed_values: List[CreateCategoricalAnnotationValuePayload]


class CreateFreeformAnnotationConfigPayload(BaseModel):
    name: str
    optimization_direction: str
    description: Optional[str] = None


@router.get(
    "/annotation_configs",
    response_model=List[AnnotationConfigResponse],
    summary="List annotation configurations",
)
async def list_annotation_configs(
    request: Request,
    limit: int = Query(100, gt=0, description="Maximum number of configs to return"),
) -> List[AnnotationConfigResponse]:
    async with request.app.state.db() as session:
        query = (
            select(models.AnnotationConfig)
            .options(
                selectinload(models.AnnotationConfig.continuous_config),
                selectinload(models.AnnotationConfig.categorical_config).selectinload(
                    models.CategoricalAnnotationConfig.allowed_values
                ),
            )
            .limit(limit)
        )
        result = await session.execute(query)
        configs = result.scalars().all()
        return [annotation_config_to_response(config) for config in configs]


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
        query = select(models.AnnotationConfig).options(
            selectinload(models.AnnotationConfig.continuous_config),
            selectinload(models.AnnotationConfig.categorical_config).selectinload(
                models.CategoricalAnnotationConfig.allowed_values
            ),
        )
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
    async with request.app.state.db() as session:
        config = models.AnnotationConfig(
            name=payload.name,
            annotation_type="CONTINUOUS",
            optimization_direction=payload.optimization_direction.upper(),
            description=payload.description,
        )
        cont = models.ContinuousAnnotationConfig(
            lower_bound=payload.lower_bound,
            upper_bound=payload.upper_bound,
        )
        config.continuous_config = cont
        session.add(config)
        try:
            await session.commit()
        except Exception as e:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        return annotation_config_to_response(config)


@router.post(
    "/annotation_configs/categorical",
    response_model=AnnotationConfigResponse,
    summary="Create a categorical annotation configuration",
)
async def create_categorical_annotation_config(
    request: Request,
    payload: CreateCategoricalAnnotationConfigPayload,
) -> AnnotationConfigResponse:
    async with request.app.state.db() as session:
        config = models.AnnotationConfig(
            name=payload.name,
            annotation_type="CATEGORICAL",
            optimization_direction=payload.optimization_direction.upper(),
            description=payload.description,
        )
        cat = models.CategoricalAnnotationConfig(
            is_ordinal=payload.is_ordinal,
            multilabel_allowed=payload.multilabel_allowed,
        )
        for val in payload.allowed_values:
            allowed_value = models.CategoricalAnnotationValue(
                label=val.label,
                numeric_score=val.numeric_score,
            )
            cat.allowed_values.append(allowed_value)
        config.categorical_config = cat
        session.add(config)
        try:
            await session.commit()
        except Exception as e:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        return annotation_config_to_response(config)


@router.post(
    "/annotation_configs/freeform",
    response_model=AnnotationConfigResponse,
    summary="Create a freeform annotation configuration",
)
async def create_freeform_annotation_config(
    request: Request,
    payload: CreateFreeformAnnotationConfigPayload,
) -> AnnotationConfigResponse:
    async with request.app.state.db() as session:
        config = models.AnnotationConfig(
            name=payload.name,
            annotation_type="FREEFORM",
            optimization_direction=payload.optimization_direction.upper(),
            description=payload.description,
        )
        session.add(config)
        try:
            await session.commit()
        except Exception as e:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        return annotation_config_to_response(config)


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
