from dataclasses import dataclass, field
from functools import singledispatchmethod

from phoenix.db.insertion.evaluation import (
    DocumentEvaluationInsertionEvent,
    SpanEvaluationInsertionEvent,
    TraceEvaluationInsertionEvent,
)
from phoenix.db.insertion.span import ClearProjectSpansEvent, SpanInsertionEvent

from .document_evaluation_summaries import (
    DocumentEvaluationSummaryCache,
    DocumentEvaluationSummaryDataLoader,
)
from .document_evaluations import DocumentEvaluationsDataLoader
from .document_retrieval_metrics import DocumentRetrievalMetricsDataLoader
from .evaluation_summaries import EvaluationSummaryCache, EvaluationSummaryDataLoader
from .latency_ms_quantile import LatencyMsQuantileCache, LatencyMsQuantileDataLoader
from .min_start_or_max_end_times import MinStartOrMaxEndTimeCache, MinStartOrMaxEndTimeDataLoader
from .record_counts import RecordCountCache, RecordCountDataLoader
from .span_descendants import SpanDescendantsDataLoader
from .span_evaluations import SpanEvaluationsDataLoader
from .token_counts import TokenCountCache, TokenCountDataLoader
from .trace_evaluations import TraceEvaluationsDataLoader

__all__ = [
    "CacheForDataLoaders",
    "DocumentEvaluationSummaryDataLoader",
    "DocumentEvaluationsDataLoader",
    "DocumentRetrievalMetricsDataLoader",
    "EvaluationSummaryDataLoader",
    "LatencyMsQuantileDataLoader",
    "MinStartOrMaxEndTimeDataLoader",
    "RecordCountDataLoader",
    "SpanDescendantsDataLoader",
    "SpanEvaluationsDataLoader",
    "TokenCountDataLoader",
    "TraceEvaluationsDataLoader",
]


@dataclass(frozen=True)
class CacheForDataLoaders:
    document_evaluation_summary: DocumentEvaluationSummaryCache = field(
        default_factory=DocumentEvaluationSummaryCache,
    )
    evaluation_summary: EvaluationSummaryCache = field(
        default_factory=EvaluationSummaryCache,
    )
    latency_ms_quantile: LatencyMsQuantileCache = field(
        default_factory=LatencyMsQuantileCache,
    )
    min_start_or_max_end_time: MinStartOrMaxEndTimeCache = field(
        default_factory=MinStartOrMaxEndTimeCache,
    )
    record_count: RecordCountCache = field(
        default_factory=RecordCountCache,
    )
    token_count: TokenCountCache = field(
        default_factory=TokenCountCache,
    )

    def _update_spans(self, project_rowid: int) -> None:
        self.latency_ms_quantile.invalidate(project_rowid)
        self.token_count.invalidate(project_rowid)
        self.record_count.invalidate(project_rowid)
        self.min_start_or_max_end_time.invalidate(project_rowid)

    def _clear_spans(self, project_rowid: int) -> None:
        self._update_spans(project_rowid)
        self.evaluation_summary.invalidate_project(project_rowid)
        self.document_evaluation_summary.invalidate_project(project_rowid)

    @singledispatchmethod
    def invalidate(self, event: SpanInsertionEvent) -> None:
        project_rowid, *_ = event
        self._update_spans(project_rowid)

    @invalidate.register
    def _(self, event: ClearProjectSpansEvent) -> None:
        project_rowid, *_ = event
        self._clear_spans(project_rowid)

    @invalidate.register
    def _(self, event: DocumentEvaluationInsertionEvent) -> None:
        project_rowid, evaluation_name = event
        self.document_evaluation_summary.invalidate((project_rowid, evaluation_name))

    @invalidate.register
    def _(self, event: SpanEvaluationInsertionEvent) -> None:
        project_rowid, evaluation_name = event
        self.evaluation_summary.invalidate((project_rowid, evaluation_name, "span"))

    @invalidate.register
    def _(self, event: TraceEvaluationInsertionEvent) -> None:
        project_rowid, evaluation_name = event
        self.evaluation_summary.invalidate((project_rowid, evaluation_name, "trace"))
