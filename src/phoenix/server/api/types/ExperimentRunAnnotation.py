from datetime import datetime
from math import isfinite
from typing import Optional

import strawberry
from strawberry import Info
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.AnnotatorKind import ExperimentRunAnnotatorKind
from phoenix.server.api.types.Trace import Trace


@strawberry.type
class ExperimentRunAnnotation(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.ExperimentRunAnnotation]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("ExperimentRunAnnotation ID mismatch")

    @strawberry.field(description="Name of the annotation, e.g. 'helpfulness' or 'relevance'.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.name),
            )
        return val

    @strawberry.field(description="The kind of annotator that produced the annotation.")  # type: ignore
    async def annotator_kind(
        self,
        info: Info[Context, None],
    ) -> ExperimentRunAnnotatorKind:
        if self.db_record:
            val = self.db_record.annotator_kind
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.annotator_kind),
            )
        return ExperimentRunAnnotatorKind(val)

    @strawberry.field(
        description="Value of the annotation in the form of a string, e.g. 'helpful' or 'not helpful'. Note that the label is not necessarily binary."  # noqa: E501
    )  # type: ignore
    async def label(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.label
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.label),
            )
        return val

    @strawberry.field(description="Value of the annotation in the form of a numeric score.")  # type: ignore
    async def score(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            val = self.db_record.score
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.score),
            )
        return val if val is not None and isfinite(val) else None

    @strawberry.field(
        description="The annotator's explanation for the annotation result (i.e. score or label, or both) given to the subject."  # noqa: E501
    )  # type: ignore
    async def explanation(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.explanation
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.explanation),
            )
        return val

    @strawberry.field(description="Error message if the annotation failed to produce a result.")  # type: ignore
    async def error(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.error
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.error),
            )
        return val

    @strawberry.field(description="Metadata about the annotation.")  # type: ignore
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.metadata_),
            )
        return val

    @strawberry.field(description="The date and time when the annotation was created.")  # type: ignore
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.start_time
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.start_time),
            )
        return val

    @strawberry.field(description="The date and time when the annotation was last updated.")  # type: ignore
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.end_time
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.end_time),
            )
        return val

    @strawberry.field(description="The identifier of the trace associated with the annotation.")  # type: ignore
    async def trace_id(
        self,
        info: Info[Context, None],
    ) -> Optional[GlobalID]:
        if self.db_record:
            val = self.db_record.trace_id
        else:
            val = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.trace_id),
            )
        return None if val is None else GlobalID(type_name=Trace.__name__, node_id=val)

    @strawberry.field(description="The trace associated with the annotation.")  # type: ignore
    async def trace(
        self,
        info: Info[Context, None],
    ) -> Optional[Trace]:
        if self.db_record:
            trace_id = self.db_record.trace_id
        else:
            trace_id = await info.context.data_loaders.experiment_run_annotation_fields.load(
                (self.id, models.ExperimentRunAnnotation.trace_id),
            )
        if not trace_id:
            return None
        dataloader = info.context.data_loaders.trace_by_trace_ids
        if (trace := await dataloader.load(trace_id)) is None:
            return None
        return Trace(id=trace.id, db_record=trace)
