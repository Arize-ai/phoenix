from datetime import datetime
from itertools import chain
from typing import List, Optional

import strawberry
from strawberry import ID, UNSET

from phoenix.core.project import Project as CoreProject
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
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
from phoenix.trace.schemas import SpanID, TraceID


@strawberry.type
class Project(Node):
    name: str
    project: strawberry.Private[CoreProject]

    @strawberry.field
    def start_time(self) -> Optional[datetime]:
        start_time, _ = self.project.right_open_time_range
        return start_time

    @strawberry.field
    def end_time(self) -> Optional[datetime]:
        _, end_time = self.project.right_open_time_range
        return end_time

    @strawberry.field
    def record_count(
        self,
        time_range: Optional[TimeRange] = UNSET,
    ) -> int:
        if not time_range:
            return self.project.span_count()
        return self.project.span_count(time_range.start, time_range.end)

    @strawberry.field
    def trace_count(
        self,
        time_range: Optional[TimeRange] = UNSET,
    ) -> int:
        if not time_range:
            return self.project.trace_count()
        return self.project.trace_count(time_range.start, time_range.end)

    @strawberry.field
    def token_count_total(self) -> int:
        return self.project.token_count_total

    @strawberry.field
    def latency_ms_p50(self) -> Optional[float]:
        return self.project.root_span_latency_ms_quantiles(0.50)

    @strawberry.field
    def latency_ms_p99(self) -> Optional[float]:
        return self.project.root_span_latency_ms_quantiles(0.99)

    @strawberry.field
    def trace(self, trace_id: ID) -> Optional[Trace]:
        if self.project.has_trace(TraceID(trace_id)):
            return Trace(trace_id=trace_id, project=self.project)
        return None

    @strawberry.field
    def spans(
        self,
        time_range: Optional[TimeRange] = UNSET,
        trace_ids: Optional[List[ID]] = UNSET,
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
        start_time = time_range.start if time_range else None
        stop_time = time_range.end if time_range else None
        if not (project := self.project).span_count(
            start_time=start_time,
            stop_time=stop_time,
        ):
            return connection_from_list(data=[], args=args)
        predicate = (
            SpanFilter(
                condition=filter_condition,
                evals=project,
            )
            if filter_condition
            else None
        )
        if not trace_ids:
            spans = project.get_spans(
                start_time=start_time,
                stop_time=stop_time,
                root_spans_only=root_spans_only,
            )
        else:
            spans = chain.from_iterable(
                project.get_trace(trace_id) for trace_id in map(TraceID, trace_ids)
            )
        if predicate:
            spans = filter(predicate, spans)
        if sort:
            spans = sort(spans, evals=project)
        data = [to_gql_span(span, project) for span in spans]
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="Names of all available evaluations for traces. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    def trace_evaluation_names(self) -> List[str]:
        return self.project.get_trace_evaluation_names()

    @strawberry.field(
        description="Names of all available evaluations for spans. "
        "(The list contains no duplicates.)"
    )  # type: ignore
    def span_evaluation_names(self) -> List[str]:
        return self.project.get_span_evaluation_names()

    @strawberry.field(
        description="Names of available document evaluations.",
    )  # type: ignore
    def document_evaluation_names(
        self,
        span_id: Optional[ID] = UNSET,
    ) -> List[str]:
        return self.project.get_document_evaluation_names(
            None if span_id is UNSET else SpanID(span_id),
        )

    @strawberry.field
    def trace_evaluation_summary(
        self,
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[EvaluationSummary]:
        project = self.project
        eval_trace_ids = project.get_trace_evaluation_trace_ids(evaluation_name)
        if not eval_trace_ids:
            return None
        trace_ids = project.get_trace_ids(
            start_time=time_range.start if time_range else None,
            stop_time=time_range.end if time_range else None,
            trace_ids=eval_trace_ids,
        )
        evaluations = tuple(
            evaluation
            for trace_id in trace_ids
            if (
                evaluation := project.get_trace_evaluation(
                    trace_id,
                    evaluation_name,
                )
            )
            is not None
        )
        if not evaluations:
            return None
        labels = project.get_trace_evaluation_labels(evaluation_name)
        return EvaluationSummary(evaluations, labels)

    @strawberry.field
    def span_evaluation_summary(
        self,
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[EvaluationSummary]:
        project = self.project
        predicate = (
            SpanFilter(
                condition=filter_condition,
                evals=project,
            )
            if filter_condition
            else None
        )
        span_ids = project.get_span_evaluation_span_ids(evaluation_name)
        if not span_ids:
            return None
        spans = project.get_spans(
            start_time=time_range.start if time_range else None,
            stop_time=time_range.end if time_range else None,
            span_ids=span_ids,
        )
        if predicate:
            spans = filter(predicate, spans)
        evaluations = tuple(
            evaluation
            for span in spans
            if (
                evaluation := project.get_span_evaluation(
                    span.context.span_id,
                    evaluation_name,
                )
            )
            is not None
        )
        if not evaluations:
            return None
        labels = project.get_span_evaluation_labels(evaluation_name)
        return EvaluationSummary(evaluations, labels)

    @strawberry.field
    def document_evaluation_summary(
        self,
        evaluation_name: str,
        time_range: Optional[TimeRange] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Optional[DocumentEvaluationSummary]:
        project = self.project
        predicate = (
            SpanFilter(condition=filter_condition, evals=project) if filter_condition else None
        )
        span_ids = project.get_document_evaluation_span_ids(evaluation_name)
        if not span_ids:
            return None
        spans = project.get_spans(
            start_time=time_range.start if time_range else None,
            stop_time=time_range.end if time_range else None,
            span_ids=span_ids,
        )
        if predicate:
            spans = filter(predicate, spans)
        metrics_collection = []
        for span in spans:
            span_id = span.context.span_id
            num_documents = project.get_num_documents(span_id)
            if not num_documents:
                continue
            evaluation_scores = project.get_document_evaluation_scores(
                span_id=span_id,
                evaluation_name=evaluation_name,
                num_documents=num_documents,
            )
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
    ) -> Optional[datetime]:
        return self.project.last_updated_at

    @strawberry.field
    def validate_span_filter_condition(self, condition: str) -> ValidationResult:
        valid_eval_names = self.project.get_span_evaluation_names()
        try:
            SpanFilter(
                condition=condition,
                evals=self.project,
                valid_eval_names=valid_eval_names,
            )
            return ValidationResult(is_valid=True, error_message=None)
        except SyntaxError as e:
            return ValidationResult(
                is_valid=False,
                error_message=e.msg,
            )
