from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.type
class ExperimentRunAnnotation(Node):
    id_attr: NodeID[int]
    name: str
    annotator_kind: AnnotatorKind
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    error: Optional[str]
    metadata: JSON
    start_time: datetime
    end_time: datetime


def to_gql_experiment_run_annotation(
    annotation: models.ExperimentAnnotation,
) -> ExperimentRunAnnotation:
    """
    Converts an ORM experiment run annotation to a GraphQL ExperimentRunAnnotation.
    """
    return ExperimentRunAnnotation(
        id_attr=annotation.id,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        error=annotation.error,
        metadata=annotation.metadata_,
        start_time=annotation.start_time,
        end_time=annotation.end_time,
    )
