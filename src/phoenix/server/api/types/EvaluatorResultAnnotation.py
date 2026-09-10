from typing import Annotated, Union

import strawberry
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models

from .ProjectSessionAnnotation import ProjectSessionAnnotation
from .SpanAnnotation import SpanAnnotation
from .TraceAnnotation import TraceAnnotation

EvaluatorResultAnnotation: TypeAlias = Annotated[
    Union[SpanAnnotation, TraceAnnotation, ProjectSessionAnnotation],
    strawberry.union("EvaluatorResultAnnotation"),
]


def to_gql_evaluator_result_annotation(
    annotation: Union[
        models.SpanAnnotation,
        models.TraceAnnotation,
        models.ProjectSessionAnnotation,
    ],
) -> EvaluatorResultAnnotation:
    """Convert a persisted evaluator result annotation to its GraphQL type."""
    if isinstance(annotation, models.SpanAnnotation):
        return SpanAnnotation(id=annotation.id, db_record=annotation)
    if isinstance(annotation, models.TraceAnnotation):
        return TraceAnnotation(id=annotation.id, db_record=annotation)
    if isinstance(annotation, models.ProjectSessionAnnotation):
        return ProjectSessionAnnotation(id=annotation.id, db_record=annotation)
    assert_never(annotation)
