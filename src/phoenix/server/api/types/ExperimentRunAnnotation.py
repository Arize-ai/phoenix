from datetime import datetime
from typing import Optional

import strawberry
from strawberry import Info
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.types.AnnotatorKind import ExperimentRunAnnotatorKind
from phoenix.server.api.types.Trace import Trace


@strawberry.type
class ExperimentRunAnnotation(Node):
    id_attr: NodeID[int]
    name: str
    annotator_kind: ExperimentRunAnnotatorKind
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    error: Optional[str]
    metadata: JSON
    start_time: datetime
    end_time: datetime
    trace_id: Optional[str]

    @strawberry.field
    async def trace(self, info: Info) -> Optional[Trace]:
        if not self.trace_id:
            return None
        dataloader = info.context.data_loaders.trace_row_ids
        if (trace := await dataloader.load(self.trace_id)) is None:
            return None
        trace_row_id, project_row_id = trace
        return Trace(id_attr=trace_row_id, trace_id=self.trace_id, project_rowid=project_row_id)


def to_gql_experiment_run_annotation(
    annotation: models.ExperimentRunAnnotation,
) -> ExperimentRunAnnotation:
    """
    Converts an ORM experiment run annotation to a GraphQL ExperimentRunAnnotation.
    """
    return ExperimentRunAnnotation(
        id_attr=annotation.id,
        name=annotation.name,
        annotator_kind=ExperimentRunAnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        error=annotation.error,
        metadata=annotation.metadata_,
        start_time=annotation.start_time,
        end_time=annotation.end_time,
        trace_id=annotation.trace_id,
    )
