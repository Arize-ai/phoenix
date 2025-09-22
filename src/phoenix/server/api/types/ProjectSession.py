from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, ClassVar, Optional, Type

import pandas as pd
import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import select
from strawberry import UNSET, Info, Private, lazy
from strawberry.relay import Connection, Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.AnnotationFilter import AnnotationFilter, satisfies_filter
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.MimeType import MimeType
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.SpanIOValue import SpanIOValue
from phoenix.server.api.types.TokenUsage import TokenUsage

if TYPE_CHECKING:
    from phoenix.server.api.types.Project import Project
    from phoenix.server.api.types.ProjectSessionAnnotation import ProjectSessionAnnotation
    from phoenix.server.api.types.Trace import Trace


@strawberry.type
class ProjectSession(Node):
    _table: ClassVar[Type[models.ProjectSession]] = models.ProjectSession
    id_attr: NodeID[int]
    project_rowid: Private[int]
    session_id: str
    start_time: datetime
    end_time: datetime

    @strawberry.field
    async def project(
        self,
        info: Info[Context, None],
    ) -> Annotated["Project", lazy(".Project")]:
        from phoenix.server.api.types.Project import Project

        return Project(project_rowid=self.project_rowid)

    @strawberry.field
    async def num_traces(
        self,
        info: Info[Context, None],
    ) -> int:
        return await info.context.data_loaders.session_num_traces.load(self.id_attr)

    @strawberry.field
    async def num_traces_with_error(
        self,
        info: Info[Context, None],
    ) -> int:
        return await info.context.data_loaders.session_num_traces_with_error.load(self.id_attr)

    @strawberry.field
    async def first_input(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        record = await info.context.data_loaders.session_first_inputs.load(self.id_attr)
        if record is None:
            return None
        return SpanIOValue(
            mime_type=MimeType(record.mime_type.value),
            cached_value=record.value,
        )

    @strawberry.field
    async def last_output(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        record = await info.context.data_loaders.session_last_outputs.load(self.id_attr)
        if record is None:
            return None
        return SpanIOValue(
            mime_type=MimeType(record.mime_type.value),
            cached_value=record.value,
        )

    @strawberry.field
    async def token_usage(
        self,
        info: Info[Context, None],
    ) -> TokenUsage:
        usage = await info.context.data_loaders.session_token_usages.load(self.id_attr)
        return TokenUsage(
            prompt=usage.prompt,
            completion=usage.completion,
        )

    @strawberry.field
    async def traces(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Annotated["Trace", lazy(".Trace")]]:
        from phoenix.server.api.types.Trace import Trace

        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = (
            select(models.Trace)
            .filter_by(project_session_rowid=self.id_attr)
            .order_by(models.Trace.start_time)
        )
        async with info.context.db() as session:
            traces = await session.stream_scalars(stmt)
            data = [Trace(trace_rowid=trace.id, db_trace=trace) async for trace in traces]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def trace_latency_ms_quantile(
        self,
        info: Info[Context, None],
        probability: float,
    ) -> Optional[float]:
        return await info.context.data_loaders.session_trace_latency_ms_quantile.load(
            (self.id_attr, probability)
        )

    @strawberry.field
    async def cost_summary(
        self,
        info: Info[Context, None],
    ) -> SpanCostSummary:
        loader = info.context.data_loaders.span_cost_summary_by_project_session
        summary = await loader.load(self.id_attr)
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
        loader = info.context.data_loaders.span_cost_detail_summary_entries_by_project_session
        summary = await loader.load(self.id_attr)
        return [
            SpanCostDetailSummaryEntry(
                token_type=entry.token_type,
                is_prompt=entry.is_prompt,
                value=CostBreakdown(
                    tokens=entry.value.tokens,
                    cost=entry.value.cost,
                ),
            )
            for entry in summary
        ]

    @strawberry.field
    async def session_annotations(
        self,
        info: Info[Context, None],
    ) -> list[Annotated["ProjectSessionAnnotation", lazy(".ProjectSessionAnnotation")]]:
        """Get all annotations for this session."""
        from phoenix.server.api.types.ProjectSessionAnnotation import (
            to_gql_project_session_annotation,
        )

        stmt = select(models.ProjectSessionAnnotation).filter_by(project_session_id=self.id_attr)
        async with info.context.db() as session:
            annotations = await session.stream_scalars(stmt)
            return [
                to_gql_project_session_annotation(annotation) async for annotation in annotations
            ]

    @strawberry.field(
        description="Summarizes each annotation (by name) associated with the session"
    )  # type: ignore
    async def session_annotation_summaries(
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
        annotations = await info.context.data_loaders.session_annotations_by_session.load(
            self.id_attr
        )

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


def to_gql_project_session(project_session: models.ProjectSession) -> ProjectSession:
    return ProjectSession(
        id_attr=project_session.id,
        session_id=project_session.session_id,
        start_time=project_session.start_time,
        project_rowid=project_session.project_id,
        end_time=project_session.end_time,
    )


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE.split(".")
