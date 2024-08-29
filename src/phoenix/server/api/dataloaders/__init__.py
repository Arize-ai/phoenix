from dataclasses import dataclass, field

from .annotation_summaries import AnnotationSummaryCache, AnnotationSummaryDataLoader
from .average_experiment_run_latency import AverageExperimentRunLatencyDataLoader
from .dataset_example_revisions import DatasetExampleRevisionsDataLoader
from .dataset_example_spans import DatasetExampleSpansDataLoader
from .document_evaluation_summaries import (
    DocumentEvaluationSummaryCache,
    DocumentEvaluationSummaryDataLoader,
)
from .document_evaluations import DocumentEvaluationsDataLoader
from .document_retrieval_metrics import DocumentRetrievalMetricsDataLoader
from .experiment_annotation_summaries import ExperimentAnnotationSummaryDataLoader
from .experiment_error_rates import ExperimentErrorRatesDataLoader
from .experiment_run_annotations import ExperimentRunAnnotations
from .experiment_run_counts import ExperimentRunCountsDataLoader
from .experiment_sequence_number import ExperimentSequenceNumberDataLoader
from .latency_ms_quantile import LatencyMsQuantileCache, LatencyMsQuantileDataLoader
from .min_start_or_max_end_times import MinStartOrMaxEndTimeCache, MinStartOrMaxEndTimeDataLoader
from .project_by_name import ProjectByNameDataLoader
from .record_counts import RecordCountCache, RecordCountDataLoader
from .span_annotations import SpanAnnotationsDataLoader
from .span_dataset_examples import SpanDatasetExamplesDataLoader
from .span_descendants import SpanDescendantsDataLoader
from .span_projects import SpanProjectsDataLoader
from .token_counts import TokenCountCache, TokenCountDataLoader
from .trace_row_ids import TraceRowIdsDataLoader

__all__ = [
    "CacheForDataLoaders",
    "AverageExperimentRunLatencyDataLoader",
    "DatasetExampleRevisionsDataLoader",
    "DatasetExampleSpansDataLoader",
    "DocumentEvaluationSummaryDataLoader",
    "DocumentEvaluationsDataLoader",
    "DocumentRetrievalMetricsDataLoader",
    "AnnotationSummaryDataLoader",
    "ExperimentAnnotationSummaryDataLoader",
    "ExperimentErrorRatesDataLoader",
    "ExperimentRunAnnotations",
    "ExperimentRunCountsDataLoader",
    "ExperimentSequenceNumberDataLoader",
    "LatencyMsQuantileDataLoader",
    "MinStartOrMaxEndTimeDataLoader",
    "RecordCountDataLoader",
    "SpanDatasetExamplesDataLoader",
    "SpanDescendantsDataLoader",
    "SpanProjectsDataLoader",
    "TokenCountDataLoader",
    "TraceRowIdsDataLoader",
    "ProjectByNameDataLoader",
    "SpanAnnotationsDataLoader",
]


@dataclass(frozen=True)
class CacheForDataLoaders:
    document_evaluation_summary: DocumentEvaluationSummaryCache = field(
        default_factory=DocumentEvaluationSummaryCache,
    )
    annotation_summary: AnnotationSummaryCache = field(
        default_factory=AnnotationSummaryCache,
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
