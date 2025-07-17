from dataclasses import dataclass, field

from phoenix.server.api.dataloaders.span_cost_detail_summary_entries_by_project_session import (
    SpanCostDetailSummaryEntriesByProjectSessionDataLoader,
)

from .annotation_configs_by_project import AnnotationConfigsByProjectDataLoader
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
from .last_used_times_by_generative_model_id import LastUsedTimesByGenerativeModelIdDataLoader
from .latency_ms_quantile import LatencyMsQuantileCache, LatencyMsQuantileDataLoader
from .min_start_or_max_end_times import MinStartOrMaxEndTimeCache, MinStartOrMaxEndTimeDataLoader
from .num_child_spans import NumChildSpansDataLoader
from .num_spans_per_trace import NumSpansPerTraceDataLoader
from .project_by_name import ProjectByNameDataLoader
from .project_ids_by_trace_retention_policy_id import ProjectIdsByTraceRetentionPolicyIdDataLoader
from .prompt_version_sequence_number import PromptVersionSequenceNumberDataLoader
from .record_counts import RecordCountCache, RecordCountDataLoader
from .session_io import SessionIODataLoader
from .session_num_traces import SessionNumTracesDataLoader
from .session_num_traces_with_error import SessionNumTracesWithErrorDataLoader
from .session_token_usages import SessionTokenUsagesDataLoader
from .session_trace_latency_ms_quantile import SessionTraceLatencyMsQuantileDataLoader
from .span_annotations import SpanAnnotationsDataLoader
from .span_by_id import SpanByIdDataLoader
from .span_cost_by_span import SpanCostBySpanDataLoader
from .span_cost_detail_summary_entries_by_generative_model import (
    SpanCostDetailSummaryEntriesByGenerativeModelDataLoader,
)
from .span_cost_detail_summary_entries_by_span import SpanCostDetailSummaryEntriesBySpanDataLoader
from .span_cost_detail_summary_entries_by_trace import SpanCostDetailSummaryEntriesByTraceDataLoader
from .span_cost_details_by_span_cost import SpanCostDetailsBySpanCostDataLoader
from .span_cost_summary_by_experiment import SpanCostSummaryByExperimentDataLoader
from .span_cost_summary_by_experiment_run import SpanCostSummaryByExperimentRunDataLoader
from .span_cost_summary_by_generative_model import SpanCostSummaryByGenerativeModelDataLoader
from .span_cost_summary_by_project import SpanCostSummaryByProjectDataLoader, SpanCostSummaryCache
from .span_cost_summary_by_project_session import SpanCostSummaryByProjectSessionDataLoader
from .span_cost_summary_by_trace import SpanCostSummaryByTraceDataLoader
from .span_costs import SpanCostsDataLoader
from .span_dataset_examples import SpanDatasetExamplesDataLoader
from .span_descendants import SpanDescendantsDataLoader
from .span_projects import SpanProjectsDataLoader
from .table_fields import TableFieldsDataLoader
from .token_counts import TokenCountCache, TokenCountDataLoader
from .trace_by_trace_ids import TraceByTraceIdsDataLoader
from .trace_retention_policy_id_by_project_id import TraceRetentionPolicyIdByProjectIdDataLoader
from .trace_root_spans import TraceRootSpansDataLoader
from .user_roles import UserRolesDataLoader
from .users import UsersDataLoader

__all__ = [
    "AnnotationConfigsByProjectDataLoader",
    "AnnotationSummaryDataLoader",
    "AverageExperimentRunLatencyDataLoader",
    "CacheForDataLoaders",
    "DatasetExampleRevisionsDataLoader",
    "DatasetExampleSpansDataLoader",
    "DocumentEvaluationSummaryDataLoader",
    "DocumentEvaluationsDataLoader",
    "DocumentRetrievalMetricsDataLoader",
    "ExperimentAnnotationSummaryDataLoader",
    "ExperimentErrorRatesDataLoader",
    "ExperimentRunAnnotations",
    "ExperimentRunCountsDataLoader",
    "ExperimentSequenceNumberDataLoader",
    "LastUsedTimesByGenerativeModelIdDataLoader",
    "LatencyMsQuantileDataLoader",
    "MinStartOrMaxEndTimeDataLoader",
    "NumChildSpansDataLoader",
    "NumSpansPerTraceDataLoader",
    "ProjectByNameDataLoader",
    "ProjectIdsByTraceRetentionPolicyIdDataLoader",
    "PromptVersionSequenceNumberDataLoader",
    "RecordCountDataLoader",
    "SessionIODataLoader",
    "SessionNumTracesDataLoader",
    "SessionNumTracesWithErrorDataLoader",
    "SessionTokenUsagesDataLoader",
    "SessionTraceLatencyMsQuantileDataLoader",
    "SpanAnnotationsDataLoader",
    "SpanByIdDataLoader",
    "SpanCostBySpanDataLoader",
    "SpanCostDetailSummaryEntriesByGenerativeModelDataLoader",
    "SpanCostDetailSummaryEntriesByProjectSessionDataLoader",
    "SpanCostDetailSummaryEntriesBySpanDataLoader",
    "SpanCostDetailSummaryEntriesByTraceDataLoader",
    "SpanCostDetailsBySpanCostDataLoader",
    "SpanCostSummaryByExperimentDataLoader",
    "SpanCostSummaryByExperimentRunDataLoader",
    "SpanCostSummaryByGenerativeModelDataLoader",
    "SpanCostSummaryByProjectDataLoader",
    "SpanCostSummaryByProjectSessionDataLoader",
    "SpanCostSummaryByTraceDataLoader",
    "SpanCostsDataLoader",
    "SpanDatasetExamplesDataLoader",
    "SpanDescendantsDataLoader",
    "SpanProjectsDataLoader",
    "TableFieldsDataLoader",
    "TokenCountDataLoader",
    "TraceByTraceIdsDataLoader",
    "TraceRetentionPolicyIdByProjectIdDataLoader",
    "TraceRootSpansDataLoader",
    "UserRolesDataLoader",
    "UsersDataLoader",
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
    token_cost: SpanCostSummaryCache = field(
        default_factory=SpanCostSummaryCache,
    )
