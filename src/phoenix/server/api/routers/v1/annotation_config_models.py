"""Shared REST annotation configuration schemas and database conversion."""

from typing import Annotated, List, Literal, Optional, Union

from pydantic import Field
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import AnnotationType, OptimizationDirection
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    FreeformAnnotationConfig as FreeformAnnotationConfigModel,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel


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
            id=str(GlobalID("ContinuousAnnotationConfig", str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
            optimization_direction=config.optimization_direction,
            lower_bound=config.lower_bound,
            upper_bound=config.upper_bound,
        )
    if isinstance(config, CategoricalAnnotationConfigModel):
        return CategoricalAnnotationConfig(
            id=str(GlobalID("CategoricalAnnotationConfig", str(annotation_config.id))),
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
            id=str(GlobalID("FreeformAnnotationConfig", str(annotation_config.id))),
            name=name,
            type=type_,
            description=description,
            optimization_direction=config.optimization_direction,
            threshold=(config.thresholds[0] if config.thresholds else None),
            lower_bound=config.lower_bound,
            upper_bound=config.upper_bound,
        )
    assert_never(config)
