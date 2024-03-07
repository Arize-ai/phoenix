from datetime import datetime
from typing import List, Optional

import strawberry
from strawberry import ID, UNSET

from phoenix.core.project import Project as CoreProject
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary
from phoenix.server.api.types.EvaluationSummary import EvaluationSummary
from phoenix.server.api.types.node import Node
from phoenix.trace.dsl import SpanFilter
from phoenix.trace.schemas import SpanID


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
    def record_count(self) -> int:
        return self.project.span_count

    @strawberry.field
    def token_count_total(self) -> int:
        return self.project.token_count_total

    @strawberry.field
    def latency_ms_p50(self) -> Optional[float]:
        return self.project.root_span_latency_ms_quantiles(0.50)

    @strawberry.field
    def latency_ms_p99(self) -> Optional[float]:
        return self.project.root_span_latency_ms_quantiles(0.99)

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
