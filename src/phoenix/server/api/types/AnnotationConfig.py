from enum import Enum
from typing import Annotated, List, Optional, TypeAlias, Union

import strawberry

from phoenix.db import models


@strawberry.enum
class AnnotationType(str, Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"
    BINARY = "BINARY"


@strawberry.enum
class ScoreDirection(str, Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"


@strawberry.interface
class AnnotationConfigInterface:
    id: int
    name: str
    annotation_type: AnnotationType
    score_direction: ScoreDirection
    description: Optional[str]


@strawberry.type
class ContinuousAnnotationConfig(AnnotationConfigInterface):
    lower_bound: Optional[float]
    upper_bound: Optional[float]


@strawberry.type
class CategoricalAnnotationValueType:
    id: int
    label: str
    numeric_score: Optional[float]


@strawberry.type
class CategoricalAnnotationConfig(AnnotationConfigInterface):
    is_ordinal: bool
    multilabel_allowed: bool
    allowed_values: List[CategoricalAnnotationValueType]


@strawberry.type
class FreeformAnnotationConfig(AnnotationConfigInterface):
    pass


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
        if annotation_config.annotation_type.upper() == "CATEGORIAL":
            gql_annotation_type = AnnotationType.CATEGORICAL
        else:
            raise

    gql_score_direction = ScoreDirection(annotation_config.score_direction.upper())

    common = {
        "id": annotation_config.id,
        "name": annotation_config.name,
        "annotation_type": gql_annotation_type,
        "score_direction": gql_score_direction,
        "description": annotation_config.description,
    }

    if gql_annotation_type == AnnotationType.CONTINUOUS:
        continuous = annotation_config.continuous_config
        return ContinuousAnnotationConfig(
            **common,
            lower_bound=continuous.lower_bound if continuous else None,
            upper_bound=continuous.upper_bound if continuous else None,
        )
    elif (
        gql_annotation_type == AnnotationType.CATEGORICAL
        or gql_annotation_type == AnnotationType.BINARY
    ):
        categorical = annotation_config.categorical_config
        allowed_values = (
            [
                CategoricalAnnotationValueType(
                    id=val.id,
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                for val in categorical.allowed_values
            ]
            if categorical and categorical.allowed_values
            else []
        )
        return CategoricalAnnotationConfig(
            **common,
            is_ordinal=categorical.is_ordinal if categorical else False,
            multilabel_allowed=categorical.multilabel_allowed if categorical else False,
            allowed_values=allowed_values,
        )
    else:
        return FreeformAnnotationConfig(**common)
