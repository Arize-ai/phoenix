from dataclasses import dataclass, field
from functools import singledispatchmethod

from phoenix.db.insertion.evaluation import (
    DocumentEvaluationInsertionResult,
    SpanEvaluationInsertionResult,
    TraceEvaluationInsertionResult,
)
from phoenix.db.insertion.span import SpanInsertionResult

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

    @singledispatchmethod
    def invalidate(self, result: SpanInsertionResult) -> None:
        project_rowid, *_ = result
        self.latency_ms_quantile.invalidate(project_rowid)
        self.token_count.invalidate(project_rowid)
        self.record_count.invalidate(project_rowid)
        self.min_start_or_max_end_time.invalidate(project_rowid)

    @invalidate.register
    def _(self, result: DocumentEvaluationInsertionResult) -> None:
        project_rowid, evaluation_name = result
        self.document_evaluation_summary.invalidate((project_rowid, evaluation_name))

    @invalidate.register
    def _(self, result: SpanEvaluationInsertionResult) -> None:
        project_rowid, evaluation_name = result
        self.evaluation_summary.invalidate((project_rowid, evaluation_name, "span"))

    @invalidate.register
    def _(self, result: TraceEvaluationInsertionResult) -> None:
        project_rowid, evaluation_name = result
        self.evaluation_summary.invalidate((project_rowid, evaluation_name, "trace"))
