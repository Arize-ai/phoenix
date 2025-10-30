from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional, Union

import pandas as pd
import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import desc, select
from strawberry import ID, UNSET, lazy
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.AnnotationFilter import AnnotationFilter, satisfies_filter
from phoenix.server.api.input_types.TraceAnnotationSort import TraceAnnotationSort
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation

if TYPE_CHECKING:
    from phoenix.server.api.types.Project import Project
    from phoenix.server.api.types.ProjectSession import ProjectSession

ProjectRowId: TypeAlias = int
TraceRowId: TypeAlias = int


@strawberry.type
class Trace(Node):
    id: NodeID[TraceRowId]
    db_record: strawberry.Private[Optional[models.Trace]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Trace ID mismatch")

    @strawberry.field
    async def trace_id(
        self,
        info: Info[Context, None],
    ) -> ID:
        if self.db_record:
            trace_id = self.db_record.trace_id
        else:
            trace_id = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.trace_id),
            )
        return ID(trace_id)

    @strawberry.field
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            start_time = self.db_record.start_time
        else:
            start_time = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.start_time),
            )
        return start_time

    @strawberry.field
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            end_time = self.db_record.end_time
        else:
            end_time = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.end_time),
            )
        return end_time

    @strawberry.field
    async def latency_ms(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            latency_ms = self.db_record.latency_ms
        else:
            latency_ms = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.latency_ms),
            )
        return latency_ms

    @strawberry.field
    async def project(
        self,
        info: Info[Context, None],
    ) -> Annotated["Project", strawberry.lazy(".Project")]:
        if self.db_record:
            project_rowid = self.db_record.project_rowid
        else:
            project_rowid = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.project_rowid),
            )
        from phoenix.server.api.types.Project import Project

        return Project(id=project_rowid)

    @strawberry.field
    async def project_id(
        self,
        info: Info[Context, None],
    ) -> GlobalID:
        if self.db_record:
            project_rowid = self.db_record.project_rowid
        else:
            project_rowid = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.project_rowid),
            )
        from phoenix.server.api.types.Project import Project

        return GlobalID(type_name=Project.__name__, node_id=str(project_rowid))

    @strawberry.field
    async def project_session_id(
        self,
        info: Info[Context, None],
    ) -> Optional[GlobalID]:
        if self.db_record:
            project_session_rowid = self.db_record.project_session_rowid
        else:
            project_session_rowid = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.project_session_rowid),
            )
        if project_session_rowid is None:
            return None
        from phoenix.server.api.types.ProjectSession import ProjectSession

        return GlobalID(type_name=ProjectSession.__name__, node_id=str(project_session_rowid))

    @strawberry.field
    async def session(
        self,
        info: Info[Context, None],
    ) -> Union[Annotated["ProjectSession", lazy(".ProjectSession")], None]:
        if self.db_record:
            project_session_rowid = self.db_record.project_session_rowid
        else:
            project_session_rowid = await info.context.data_loaders.trace_fields.load(
                (self.id, models.Trace.project_session_rowid),
            )
        if project_session_rowid is None:
            return None

        stmt = select(models.ProjectSession).filter_by(id=project_session_rowid)
        async with info.context.db() as session:
            project_session = await session.scalar(stmt)
        if project_session is None:
            return None
        from .ProjectSession import ProjectSession

        return ProjectSession(id=project_session.id, db_record=project_session)

    @strawberry.field
    async def root_span(
        self,
        info: Info[Context, None],
    ) -> Optional[Span]:
        span_rowid = await info.context.data_loaders.trace_root_spans.load(self.id)
        if span_rowid is None:
            return None
        return Span(id=span_rowid)

    @strawberry.field
    async def num_spans(
        self,
        info: Info[Context, None],
    ) -> int:
        return await info.context.data_loaders.num_spans_per_trace.load(self.id)

    @strawberry.field
    async def spans(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = (
            select(models.Span.id)
            .join(models.Trace)
            .where(models.Trace.id == self.id)
            # Sort descending because the root span tends to show up later
            # in the ingestion process.
            .order_by(desc(models.Span.id))
            .limit(first)
        )
        async with info.context.db() as session:
            span_rowids = await session.stream_scalars(stmt)
            data = [Span(id=span_rowid) async for span_rowid in span_rowids]
        return connection_from_list(data=data, args=args)

    @strawberry.field(description="Annotations associated with the trace.")  # type: ignore
    async def trace_annotations(
        self,
        info: Info[Context, None],
        sort: Optional[TraceAnnotationSort] = None,
    ) -> list[TraceAnnotation]:
        async with info.context.db() as session:
            stmt = select(models.TraceAnnotation).filter_by(trace_rowid=self.id)
            if sort:
                sort_col = getattr(models.TraceAnnotation, sort.col.value)
                if sort.dir is SortDir.desc:
                    stmt = stmt.order_by(sort_col.desc(), models.TraceAnnotation.id.desc())
                else:
                    stmt = stmt.order_by(sort_col.asc(), models.TraceAnnotation.id.asc())
            else:
                stmt = stmt.order_by(models.TraceAnnotation.created_at.desc())
            annotations = await session.scalars(stmt)
        return [
            TraceAnnotation(id=annotation.id, db_record=annotation) for annotation in annotations
        ]

    @strawberry.field(description="Summarizes each annotation (by name) associated with the trace")  # type: ignore
    async def trace_annotation_summaries(
        self,
        info: Info[Context, None],
        filter: Optional[AnnotationFilter] = None,
    ) -> list[AnnotationSummary]:
        """
        Retrieves and summarizes annotations associated with this span.

        This method aggregates annotation data by name and label, calculating metrics
        such as count of occurrences and sum of scores. The results are organized
        into a structured format that can be easily converted to a DataFrame.

        Args:
            info: GraphQL context information
            filter: Optional filter to apply to annotations before processing

        Returns:
            A list of AnnotationSummary objects, each containing:
            - name: The name of the annotation
            - data: A list of dictionaries with label statistics
        """
        # Load all annotations for this span from the data loader
        annotations = await info.context.data_loaders.trace_annotations_by_trace.load(self.id)

        # Apply filter if provided to narrow down the annotations
        if filter:
            annotations = [
                annotation for annotation in annotations if satisfies_filter(annotation, filter)
            ]

        @dataclass
        class Metrics:
            record_count: int = 0
            label_count: int = 0
            score_sum: float = 0
            score_count: int = 0

        summaries: defaultdict[str, defaultdict[Optional[str], Metrics]] = defaultdict(
            lambda: defaultdict(Metrics)
        )
        for annotation in annotations:
            metrics = summaries[annotation.name][annotation.label]
            metrics.record_count += 1
            metrics.label_count += int(annotation.label is not None)
            metrics.score_sum += annotation.score or 0
            metrics.score_count += int(annotation.score is not None)

        result: list[AnnotationSummary] = []
        for name, label_metrics in summaries.items():
            rows = [{"label": label, **asdict(metrics)} for label, metrics in label_metrics.items()]
            result.append(AnnotationSummary(name=name, df=pd.DataFrame(rows), simple_avg=True))
        return result

    @strawberry.field
    async def cost_summary(
        self,
        info: Info[Context, None],
    ) -> SpanCostSummary:
        loader = info.context.data_loaders.span_cost_summary_by_trace
        summary = await loader.load(self.id)
        return SpanCostSummary(
            prompt=CostBreakdown(
                tokens=summary.prompt.tokens,
                cost=summary.prompt.cost,
            ),
            completion=CostBreakdown(
                tokens=summary.completion.tokens,
                cost=summary.completion.cost,
            ),
            total=CostBreakdown(
                tokens=summary.total.tokens,
                cost=summary.total.cost,
            ),
        )

    @strawberry.field
    async def cost_detail_summary_entries(
        self,
        info: Info[Context, None],
    ) -> list[SpanCostDetailSummaryEntry]:
        loader = info.context.data_loaders.span_cost_detail_summary_entries_by_trace
        entries = await loader.load(self.id)
        return [
            SpanCostDetailSummaryEntry(
                token_type=entry.token_type,
                is_prompt=entry.is_prompt,
                value=CostBreakdown(tokens=entry.value.tokens, cost=entry.value.cost),
            )
            for entry in entries
        ]


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
