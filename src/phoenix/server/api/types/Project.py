from datetime import datetime
from typing import List, Optional

import numpy as np
import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, distinct, func, select
from sqlalchemy.orm import contains_eager, selectinload
from sqlalchemy.sql.functions import coalesce
from strawberry import ID, UNSET
from strawberry.types import Info

from phoenix.core.project import Project as CoreProject
from phoenix.datetime_utils import right_open_time_range
from phoenix.db import models
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.SpanSort import SpanSort
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary
from phoenix.server.api.types.EvaluationSummary import EvaluationSummary
from phoenix.server.api.types.node import Node
from phoenix.server.api.types.pagination import (
    Connection,
    ConnectionArgs,
    Cursor,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.api.types.ValidationResult import ValidationResult
from phoenix.trace.dsl import SpanFilter


@strawberry.type
class Project(Node):
    name: str
    gradient_start_color: str
    gradient_end_color: str
    project: strawberry.Private[CoreProject]

    @strawberry.field
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        stmt = select(func.min(models.Trace.start_time)).where(
            models.Trace.project_rowid == self.id_attr
        )
        async with info.context.db() as session:
            start_time = await session.scalar(stmt)
        start_time, _ = right_open_time_range(start_time, None)
        return start_time

    @strawberry.field
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        stmt = select(func.max(models.Trace.end_time)).where(
            models.Trace.project_rowid == self.id_attr
        )
        async with info.context.db() as session:
            end_time = await session.scalar(stmt)
        _, end_time = right_open_time_range(None, end_time)
        return end_time

    @strawberry.field
    async def record_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
    ) -> int:
        stmt = (
            select(func.count(models.Span.id))
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.id_attr)
        )
        if time_range:
            stmt = stmt.where(
                and_(
                    time_range.start <= models.Span.start_time,
                    models.Span.start_time < time_range.end,
                )
            )
        async with info.context.db() as session:
            return (await session.scalar(stmt)) or 0

    @strawberry.field
    async def trace_count(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
    ) -> int:
        stmt = select(func.count(models.Trace.id)).where(models.Trace.project_rowid == self.id_attr)
        if time_range:
            stmt = stmt.where(
                and_(
                    time_range.start <= models.Trace.start_time,
                    models.Trace.start_time < time_range.end,
                )
            )
        async with info.context.db() as session:
            return (await session.scalar(stmt)) or 0

    @strawberry.field
    async def token_count_total(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
    ) -> int:
        prompt = models.Span.attributes[LLM_TOKEN_COUNT_PROMPT].as_float()
        completion = models.Span.attributes[LLM_TOKEN_COUNT_COMPLETION].as_float()
        stmt = (
            select(coalesce(func.sum(prompt), 0) + coalesce(func.sum(completion), 0))
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.id_attr)
        )
        if time_range:
            stmt = stmt.where(
                and_(
                    time_range.start <= models.Span.start_time,
                    models.Span.start_time < time_range.end,
                )
            )
        async with info.context.db() as session:
            return (await session.scalar(stmt)) or 0

    @strawberry.field
    async def latency_ms_quantile(
        self,
        info: Info[Context, None],
        probability: float,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[float]:
        return await info.context.data_loaders.latency_ms_quantile.load(
            (self.id_attr, time_range, probability)
        )

    @strawberry.field
    async def trace(self, trace_id: ID, info: Info[Context, None]) -> Optional[Trace]:
        async with info.context.db() as session:
            if (
                trace_rowid := await session.scalar(
                    select(models.Trace.id).where(
                        and_(
                            models.Trace.trace_id == str(trace_id),
                            models.Trace.project_rowid == self.id_attr,
                        )
                    )
                )
            ) is None:
                return None
        return Trace(trace_rowid=trace_rowid)

    @strawberry.field
    async def spans(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
        sort: Optional[SpanSort] = UNSET,
        root_spans_only: Optional[bool] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, Cursor) else None,
            last=last,
            before=before if isinstance(before, Cursor) else None,
        )
        stmt = (
            select(models.Span)
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.id_attr)
            .options(contains_eager(models.Span.trace))
        )
        if time_range:
            stmt = stmt.where(
                and_(
                    time_range.start <= models.Span.start_time,
                    models.Span.start_time < time_range.end,
                )
            )
        if root_spans_only:
            # A root span is any span whose parent span is missing in the
            # database, even if its `parent_span_id` may not be NULL.
            parent = select(models.Span.span_id).alias()
            stmt = stmt.outerjoin(
                parent,
                models.Span.parent_id == parent.c.span_id,
            ).where(parent.c.span_id.is_(None))
        if filter_condition:
            span_filter = SpanFilter(condition=filter_condition)
            stmt = span_filter(stmt)
        if sort:
            stmt = stmt.order_by(sort.to_orm_expr())
        async with info.context.db() as session:
            spans = await session.scalars(stmt)
        data = [to_gql_span(span) for span in spans]
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="Names of all available evaluations for traces. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    async def trace_evaluation_names(
        self,
        info: Info[Context, None],
    ) -> List[str]:
        stmt = (
            select(distinct(models.TraceAnnotation.name))
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.id_attr)
            .where(models.TraceAnnotation.annotator_kind == "LLM")
        )
        async with info.context.db() as session:
            return list(await session.scalars(stmt))

    @strawberry.field(
        description="Names of all available evaluations for spans. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    async def span_evaluation_names(
        self,
        info: Info[Context, None],
    ) -> List[str]:
        stmt = (
            select(distinct(models.SpanAnnotation.name))
            .join(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.id_attr)
            .where(models.SpanAnnotation.annotator_kind == "LLM")
        )
        async with info.context.db() as session:
            return list(await session.scalars(stmt))

    @strawberry.field(
        description="Names of available document evaluations.",
    )  # type: ignore
    async def document_evaluation_names(
        self,
        info: Info[Context, None],
        span_id: Optional[ID] = UNSET,
    ) -> List[str]:
        stmt = (
            select(distinct(models.DocumentAnnotation.name))
            .join(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.id_attr)
            .where(models.DocumentAnnotation.annotator_kind == "LLM")
        )
        if span_id:
            stmt = stmt.where(models.Span.span_id == str(span_id))
        async with info.context.db() as session:
            return list(await session.scalars(stmt))

    @strawberry.field
    async def trace_evaluation_summary(
        self,
        info: Info[Context, None],
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[EvaluationSummary]:
        base_query = (
            select(models.TraceAnnotation)
            .join(models.Trace)
            .where(models.Trace.project_rowid == self.id_attr)
            .where(models.TraceAnnotation.annotator_kind == "LLM")
            .where(models.TraceAnnotation.name == evaluation_name)
        )
        unfiltered = base_query
        filtered = base_query
        if time_range:
            filtered = filtered.where(
                and_(
                    time_range.start <= models.Span.start_time,
                    models.Span.start_time < time_range.end,
                )
            )

        # todo: implement filter condition
        async with info.context.db() as session:
            evaluations = list(await session.scalars(filtered))
            all_labels = await session.scalars(
                unfiltered.with_only_columns(distinct(models.TraceAnnotation.label))
            )
            labels = [label for label in all_labels if label is not None]
        if not evaluations or labels:
            return None
        return EvaluationSummary(evaluations, labels)

    @strawberry.field
    async def span_evaluation_summary(
        self,
        info: Info[Context, None],
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[EvaluationSummary]:
        base_query = (
            select(models.SpanAnnotation)
            .join(models.Span)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.id_attr)
            .where(models.SpanAnnotation.annotator_kind == "LLM")
            .where(models.SpanAnnotation.name == evaluation_name)
        )
        unfiltered = base_query
        filtered = base_query
        if time_range:
            filtered = filtered.where(
                and_(
                    time_range.start <= models.Span.start_time,
                    models.Span.start_time < time_range.end,
                )
            )

        # todo: implement filter condition
        async with info.context.db() as session:
            evaluations = list(await session.scalars(filtered))
            all_labels = await session.scalars(
                unfiltered.with_only_columns(distinct(models.TraceAnnotation.label))
            )
            labels = [label for label in all_labels if label is not None]
        if not evaluations or labels:
            return None
        return EvaluationSummary(evaluations, labels)

    @strawberry.field
    async def document_evaluation_summary(
        self,
        info: Info[Context, None],
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[DocumentEvaluationSummary]:
        stmt = (
            select(models.Span)
            .join(models.Trace)
            .where(
                models.Trace.project_rowid == self.id_attr,
            )
            .options(selectinload(models.Span.document_annotations))
            .options(contains_eager(models.Span.trace))
        )
        if time_range:
            stmt = stmt.where(
                and_(
                    time_range.start <= models.Span.start_time,
                    models.Span.start_time < time_range.end,
                )
            )
        # todo: add filter_condition
        async with info.context.db() as session:
            sql_spans = await session.scalars(stmt)
        metrics_collection = []
        for sql_span in sql_spans:
            span = to_gql_span(sql_span)
            if not (num_documents := span.num_documents):
                continue
            evaluation_scores: List[float] = [np.nan] * num_documents
            for annotation in sql_span.document_annotations:
                if (score := annotation.score) is not None and (
                    document_position := annotation.document_index
                ) < num_documents:
                    evaluation_scores[document_position] = score
            metrics_collection.append(RetrievalMetrics(evaluation_scores))
        if not metrics_collection:
            return None
        return DocumentEvaluationSummary(
            evaluation_name=evaluation_name,
            metrics_collection=metrics_collection,
        )

    @strawberry.field
    def streaming_last_updated_at(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        return info.context.streaming_last_updated_at()

    @strawberry.field
    async def validate_span_filter_condition(self, condition: str) -> ValidationResult:
        # TODO(persistence): this query is too expensive to run on every validation
        # valid_eval_names = await self.span_evaluation_names()
        try:
            SpanFilter(
                condition=condition,
                # valid_eval_names=valid_eval_names,
            )
            return ValidationResult(is_valid=True, error_message=None)
        except SyntaxError as e:
            return ValidationResult(
                is_valid=False,
                error_message=e.msg,
            )


LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT.split(".")
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION.split(".")
