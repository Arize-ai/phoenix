from enum import Enum
from typing import Annotated, List, Optional, Union

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from typing_extensions import TypeAlias

from phoenix.db import models


@strawberry.enum
class AnnotationType(str, Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"


@strawberry.enum
class OptimizationDirection(str, Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"


@strawberry.interface
class AnnotationConfigInterface:
    id_attr: NodeID[int]
    name: str
    annotation_type: AnnotationType
    optimization_direction: OptimizationDirection
    description: Optional[str]


@strawberry.type
class ContinuousAnnotationConfig(Node, AnnotationConfigInterface):
    lower_bound: Optional[float]
    upper_bound: Optional[float]


@strawberry.type
class CategoricalAnnotationValue(Node):
    id_attr: NodeID[int]
    label: str
    numeric_score: Optional[float]


@strawberry.type
class CategoricalAnnotationConfig(Node, AnnotationConfigInterface):
    is_ordinal: bool
    multilabel_allowed: bool
    allowed_values: List[CategoricalAnnotationValue]


@strawberry.type
class FreeformAnnotationConfig(Node, AnnotationConfigInterface):
    pass


@strawberry.type
class ProjectAnnotationConfig(Node):
    id_attr: NodeID[int]
    project_id: GlobalID
    annotation_config_id: GlobalID


AnnotationConfig: TypeAlias = Annotated[
    Union[ContinuousAnnotationConfig, CategoricalAnnotationConfig, FreeformAnnotationConfig],
    strawberry.union("AnnotationConfig"),
]


def to_gql_annotation_config(annotation_config: models.AnnotationConfig) -> AnnotationConfig:
    """
    Convert an SQLAlchemy AnnotationConfig instance to one of the GraphQL types.
    """
    try:
        gql_annotation_type = AnnotationType(annotation_config.annotation_type.upper())
    except ValueError:
        if annotation_config.annotation_type.upper() == "CATEGORICAL":
            gql_annotation_type = AnnotationType.CATEGORICAL
        else:
            raise

    gql_optimization_direction = OptimizationDirection(
        annotation_config.optimization_direction.upper()
    )

    if gql_annotation_type == AnnotationType.CONTINUOUS:
        continuous = annotation_config.continuous_config
        return ContinuousAnnotationConfig(
            id_attr=annotation_config.id,
            name=annotation_config.name,
            annotation_type=gql_annotation_type,
            optimization_direction=gql_optimization_direction,
            description=annotation_config.description,
            lower_bound=continuous.lower_bound if continuous else None,
            upper_bound=continuous.upper_bound if continuous else None,
        )
    elif gql_annotation_type == AnnotationType.CATEGORICAL:
        categorical = annotation_config.categorical_config
        allowed_values = (
            [
                CategoricalAnnotationValue(
                    id_attr=val.id,
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                for val in categorical.allowed_values
            ]
            if categorical and categorical.allowed_values
            else []
        )
        return CategoricalAnnotationConfig(
            id_attr=annotation_config.id,
            name=annotation_config.name,
            annotation_type=gql_annotation_type,
            optimization_direction=gql_optimization_direction,
            description=annotation_config.description,
            is_ordinal=categorical.is_ordinal if categorical else False,
            multilabel_allowed=categorical.multilabel_allowed if categorical else False,
            allowed_values=allowed_values,
        )
    else:
        return FreeformAnnotationConfig(
            id_attr=annotation_config.id,
            name=annotation_config.name,
            annotation_type=gql_annotation_type,
            optimization_direction=gql_optimization_direction,
            description=annotation_config.description,
        )
