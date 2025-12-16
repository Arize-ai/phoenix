from typing import Annotated, Optional, Union

import strawberry
from strawberry.relay import Node, NodeID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationType,
    OptimizationDirection,
)
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    FreeformAnnotationConfig as FreeformAnnotationConfigModel,
)


@strawberry.interface
class AnnotationConfigBase:
    name: str
    description: Optional[str]
    annotation_type: AnnotationType


@strawberry.type
class CategoricalAnnotationValue:
    label: str
    score: Optional[float]


@strawberry.type
class CategoricalAnnotationConfig(Node, AnnotationConfigBase):
    id_attr: NodeID[int]
    optimization_direction: OptimizationDirection
    values: list[CategoricalAnnotationValue]


@strawberry.type
class ContinuousAnnotationConfig(Node, AnnotationConfigBase):
    id_attr: NodeID[int]
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float]
    upper_bound: Optional[float]


@strawberry.type
class FreeformAnnotationConfig(Node, AnnotationConfigBase):
    id_attr: NodeID[int]


AnnotationConfig: TypeAlias = Annotated[
    Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig],
    strawberry.union("AnnotationConfig"),
]


def _to_gql_categorical_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> CategoricalAnnotationConfig:
    config = annotation_config.config
    assert isinstance(config, CategoricalAnnotationConfigModel)
    values = [
        CategoricalAnnotationValue(
            label=val.label,
            score=val.score,
        )
        for val in config.values
    ]
    return CategoricalAnnotationConfig(
        id_attr=annotation_config.id,
        name=annotation_config.name,
        annotation_type=config.type,
        optimization_direction=config.optimization_direction,
        description=config.description,
        values=values,
    )


def _to_gql_continuous_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> ContinuousAnnotationConfig:
    config = annotation_config.config
    assert isinstance(config, ContinuousAnnotationConfigModel)
    return ContinuousAnnotationConfig(
        id_attr=annotation_config.id,
        name=annotation_config.name,
        annotation_type=config.type,
        optimization_direction=config.optimization_direction,
        description=config.description,
        lower_bound=config.lower_bound,
        upper_bound=config.upper_bound,
    )


def _to_gql_freeform_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> FreeformAnnotationConfig:
    config = annotation_config.config
    assert isinstance(config, FreeformAnnotationConfigModel)
    return FreeformAnnotationConfig(
        id_attr=annotation_config.id,
        name=annotation_config.name,
        annotation_type=config.type,
        description=config.description,
    )


def to_gql_annotation_config(annotation_config: models.AnnotationConfig) -> AnnotationConfig:
    """
    Convert an SQLAlchemy AnnotationConfig instance to one of the GraphQL types.
    """
    config = annotation_config.config
    if isinstance(config, ContinuousAnnotationConfigModel):
        return _to_gql_continuous_annotation_config(annotation_config)
    if isinstance(config, CategoricalAnnotationConfigModel):
        return _to_gql_categorical_annotation_config(annotation_config)
    if isinstance(config, FreeformAnnotationConfigModel):
        return _to_gql_freeform_annotation_config(annotation_config)
    assert_never(annotation_config)
