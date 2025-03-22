from enum import Enum
from typing import Annotated, List, Optional, Union

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models


@strawberry.enum
class AnnotationType(Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"


@strawberry.enum
class OptimizationDirection(Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"


@strawberry.type
class CategoricalAnnotationValue:
    label: str
    score: Optional[float]


@strawberry.type
class CategoricalAnnotationConfig(Node):
    id_attr: NodeID[int]
    name: str
    annotation_type: AnnotationType
    description: Optional[str]
    optimization_direction: OptimizationDirection
    values: List[CategoricalAnnotationValue]


@strawberry.type
class ContinuousAnnotationConfig(Node):
    id_attr: NodeID[int]
    name: str
    annotation_type: AnnotationType
    description: Optional[str]
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float]
    upper_bound: Optional[float]


@strawberry.type
class FreeformAnnotationConfig(Node):
    id_attr: NodeID[int]
    name: str
    annotation_type: AnnotationType
    description: Optional[str]


AnnotationConfig: TypeAlias = Annotated[
    Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig],
    strawberry.union("AnnotationConfig"),
]


@strawberry.type
class ProjectAnnotationConfigAssociation:
    project_id: GlobalID
    annotation_config_id: GlobalID


def to_gql_categorical_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> CategoricalAnnotationConfig:
    gql_annotation_type = AnnotationType(annotation_config.annotation_type)
    assert gql_annotation_type is AnnotationType.CATEGORICAL
    categorical_config = annotation_config.categorical_annotation_config
    assert categorical_config is not None
    values = [
        CategoricalAnnotationValue(
            label=val.label,
            score=val.score,
        )
        for val in categorical_config.values
    ]
    return CategoricalAnnotationConfig(
        id_attr=annotation_config.id,
        name=annotation_config.name,
        annotation_type=AnnotationType.CATEGORICAL,
        optimization_direction=OptimizationDirection(categorical_config.optimization_direction),
        description=annotation_config.description,
        values=values,
    )


def to_gql_continuous_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> ContinuousAnnotationConfig:
    gql_annotation_type = AnnotationType(annotation_config.annotation_type)
    assert gql_annotation_type is AnnotationType.CONTINUOUS
    continuous_config = annotation_config.continuous_annotation_config
    assert continuous_config is not None
    return ContinuousAnnotationConfig(
        id_attr=annotation_config.id,
        name=annotation_config.name,
        annotation_type=AnnotationType.CONTINUOUS,
        optimization_direction=OptimizationDirection(continuous_config.optimization_direction),
        description=annotation_config.description,
        lower_bound=continuous_config.lower_bound,
        upper_bound=continuous_config.upper_bound,
    )


def to_gql_freeform_annotation_config(
    annotation_config: models.AnnotationConfig,
) -> FreeformAnnotationConfig:
    gql_annotation_type = AnnotationType(annotation_config.annotation_type)
    assert gql_annotation_type is AnnotationType.FREEFORM
    return FreeformAnnotationConfig(
        id_attr=annotation_config.id,
        name=annotation_config.name,
        annotation_type=AnnotationType.FREEFORM,
        description=annotation_config.description,
    )


def to_gql_annotation_config(annotation_config: models.AnnotationConfig) -> AnnotationConfig:
    """
    Convert an SQLAlchemy AnnotationConfig instance to one of the GraphQL types.
    """
    gql_annotation_type = AnnotationType(annotation_config.annotation_type)
    if gql_annotation_type is AnnotationType.CONTINUOUS:
        return to_gql_continuous_annotation_config(annotation_config)
    elif gql_annotation_type == AnnotationType.CATEGORICAL:
        return to_gql_categorical_annotation_config(annotation_config)
    elif gql_annotation_type is AnnotationType.FREEFORM:
        return to_gql_freeform_annotation_config(annotation_config)
    assert_never(annotation_config)
