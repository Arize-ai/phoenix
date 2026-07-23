from __future__ import annotations

from dataclasses import dataclass, field

from phoenix.db import models
from phoenix.server.api.dataloaders.span_cost_detail_summary_entries_by_project_session import (
    SpanCostDetailSummaryEntriesByProjectSessionDataLoader,
)
from phoenix.server.types import DbSessionFactory

from .annotation_configs_by_project import AnnotationConfigsByProjectDataLoader
from .annotation_summaries import AnnotationSummaryCache, AnnotationSummaryDataLoader
from .average_experiment_repeated_run_group_latency import (
    AverageExperimentRepeatedRunGroupLatencyDataLoader,
)
from .average_experiment_run_latency import AverageExperimentRunLatencyDataLoader
from .code_evaluator_version_count import CodeEvaluatorVersionCountDataLoader
from .code_evaluator_version_sequence_number import CodeEvaluatorVersionSequenceNumberDataLoader
from .dataset_dataset_splits import DatasetDatasetSplitsDataLoader
from .dataset_evaluators import DatasetEvaluatorsDataLoader
from .dataset_evaluators_by_evaluator import DatasetEvaluatorsByEvaluatorDataLoader
from .dataset_evaluators_by_id import DatasetEvaluatorsByIdDataLoader
from .dataset_example_counts import DatasetExampleCountsDataLoader
from .dataset_example_revisions import DatasetExampleRevisionsDataLoader
from .dataset_example_spans import DatasetExampleSpansDataLoader
from .dataset_example_splits import DatasetExampleSplitsDataLoader
from .dataset_examples_and_versions_by_experiment_run import (
    DatasetExamplesAndVersionsByExperimentRunDataLoader,
)
from .dataset_label_usage_counts import DatasetLabelUsageCountsDataLoader
from .dataset_labels import DatasetLabelsDataLoader
from .datasets_by_evaluator import DatasetsByEvaluatorDataLoader
from .document_evaluation_summaries import (
    DocumentEvaluationSummaryCache,
    DocumentEvaluationSummaryDataLoader,
)
from .document_evaluations import DocumentEvaluationsDataLoader
from .document_retrieval_metrics import DocumentRetrievalMetricsDataLoader
from .evaluator_by_id import EvaluatorByIdDataLoader
from .experiment_annotation_label_fractions import ExperimentAnnotationLabelFractionsDataLoader
from .experiment_annotation_summaries import ExperimentAnnotationSummaryDataLoader
from .experiment_baseline_tags import ExperimentBaselineTagsDataLoader
from .experiment_dataset_splits import ExperimentDatasetSplitsDataLoader
from .experiment_error_rates import ExperimentErrorRatesDataLoader
from .experiment_expected_run_counts import ExperimentExpectedRunCountsDataLoader
from .experiment_jobs import ExperimentJobsDataLoader
from .experiment_repeated_run_group_annotation_summaries import (
    ExperimentRepeatedRunGroupAnnotationSummariesDataLoader,
)
from .experiment_repeated_run_groups import ExperimentRepeatedRunGroupsDataLoader
from .experiment_run_annotations import ExperimentRunAnnotations
from .experiment_run_counts import ExperimentRunCountsDataLoader
from .experiment_runs_by_experiment_and_example import (
    ExperimentRunsByExperimentAndExampleDataLoader,
)
from .experiment_sequence_number import ExperimentSequenceNumberDataLoader
from .last_experiment_errors import LastExperimentErrorsDataLoader
from .last_used_times_by_generative_model_id import LastUsedTimesByGenerativeModelIdDataLoader
from .latency_ms_quantile import LatencyMsQuantileCache, LatencyMsQuantileDataLoader
from .latest_code_evaluator_versions import LatestCodeEvaluatorVersionDataLoader
from .latest_prompt_version_ids import LatestPromptVersionIdDataLoader
from .min_start_or_max_end_times import MinStartOrMaxEndTimeCache, MinStartOrMaxEndTimeDataLoader
from .num_child_spans import NumChildSpansDataLoader
from .num_spans_per_trace import NumSpansPerTraceDataLoader
from .project_by_name import ProjectByNameDataLoader
from .project_has_traces import ProjectHasTracesDataLoader
from .project_ids_by_trace_retention_policy_id import ProjectIdsByTraceRetentionPolicyIdDataLoader
from .prompt_label_usage_counts import PromptLabelUsageCountsDataLoader
from .prompt_labels_by_prompt import PromptLabelsByPromptDataLoader
from .prompt_version_counts import PromptVersionCountDataLoader
from .prompt_version_sequence_number import PromptVersionSequenceNumberDataLoader
from .prompt_version_tags_by_prompt import PromptVersionTagsByPromptDataLoader
from .prompt_versions import PromptVersionDataLoader
from .record_counts import RecordCountCache, RecordCountDataLoader
from .sandbox_configs_by_provider import SandboxConfigsByProviderDataLoader
from .sandbox_provider import SandboxProviderDataLoader
from .secrets import SecretsDataLoader
from .session_annotations_by_session import SessionAnnotationsBySessionDataLoader
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
from .span_cost_summary_by_experiment_repeated_run_group import (
    SpanCostSummaryByExperimentRepeatedRunGroupDataLoader,
)
from .span_cost_summary_by_experiment_run import SpanCostSummaryByExperimentRunDataLoader
from .span_cost_summary_by_generative_model import SpanCostSummaryByGenerativeModelDataLoader
from .span_cost_summary_by_project import SpanCostSummaryByProjectDataLoader, SpanCostSummaryCache
from .span_cost_summary_by_project_session import SpanCostSummaryByProjectSessionDataLoader
from .span_cost_summary_by_trace import SpanCostSummaryByTraceDataLoader
from .span_dataset_examples import SpanDatasetExamplesDataLoader
from .span_descendants import SpanDescendantsDataLoader
from .span_projects import SpanProjectsDataLoader
from .table_fields import TableFieldsDataLoader
from .token_counts import TokenCountCache, TokenCountDataLoader
from .token_prices_by_model import TokenPricesByModelDataLoader
from .trace_annotations_by_trace import TraceAnnotationsByTraceDataLoader
from .trace_by_trace_ids import TraceByTraceIdsDataLoader
from .trace_error_count import TraceErrorCountDataLoader
from .trace_errors_by_type import TraceErrorsByTypeDataLoader
from .trace_retention_policy_id_by_project_id import TraceRetentionPolicyIdByProjectIdDataLoader
from .trace_root_spans import TraceRootSpansDataLoader
from .trace_span_counts_by_kind import TraceSpanCountsByKindDataLoader
from .user_credential_counts import UserCredentialCountsDataLoader
from .user_ids import UserIdsDataLoader
from .user_roles import UserRolesDataLoader
from .users import UsersDataLoader
from .version_authors import VersionAuthorsDataLoader

__all__ = [
    "CacheForDataLoaders",
    "DataLoaders",
    "build_data_loaders",
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


@dataclass
class DataLoaders:
    annotation_configs_by_project: AnnotationConfigsByProjectDataLoader
    annotation_summaries: AnnotationSummaryDataLoader
    average_experiment_repeated_run_group_latency: (
        AverageExperimentRepeatedRunGroupLatencyDataLoader
    )
    average_experiment_run_latency: AverageExperimentRunLatencyDataLoader
    code_evaluator_fields: TableFieldsDataLoader
    code_evaluator_version_count: CodeEvaluatorVersionCountDataLoader
    code_evaluator_version_sequence_number: CodeEvaluatorVersionSequenceNumberDataLoader
    dataset_evaluator_fields: TableFieldsDataLoader
    dataset_evaluators_by_evaluator: DatasetEvaluatorsByEvaluatorDataLoader
    dataset_evaluators_by_id: DatasetEvaluatorsByIdDataLoader
    dataset_evaluators: DatasetEvaluatorsDataLoader
    datasets_by_evaluator: DatasetsByEvaluatorDataLoader
    dataset_example_counts: DatasetExampleCountsDataLoader
    dataset_example_fields: TableFieldsDataLoader
    dataset_example_revisions: DatasetExampleRevisionsDataLoader
    dataset_example_spans: DatasetExampleSpansDataLoader
    dataset_labels: DatasetLabelsDataLoader
    dataset_authors: "VersionAuthorsDataLoader[models.DatasetVersion]"
    dataset_label_fields: TableFieldsDataLoader
    dataset_label_usage_counts: DatasetLabelUsageCountsDataLoader
    dataset_dataset_splits: DatasetDatasetSplitsDataLoader
    dataset_examples_and_versions_by_experiment_run: (
        DatasetExamplesAndVersionsByExperimentRunDataLoader
    )
    dataset_example_splits: DatasetExampleSplitsDataLoader
    dataset_fields: TableFieldsDataLoader
    dataset_split_fields: TableFieldsDataLoader
    dataset_version_fields: TableFieldsDataLoader
    document_annotation_fields: TableFieldsDataLoader
    document_evaluation_summaries: DocumentEvaluationSummaryDataLoader
    document_evaluations: DocumentEvaluationsDataLoader
    document_retrieval_metrics: DocumentRetrievalMetricsDataLoader
    evaluator_by_id: EvaluatorByIdDataLoader
    experiment_annotation_label_fractions: ExperimentAnnotationLabelFractionsDataLoader
    experiment_annotation_summaries: ExperimentAnnotationSummaryDataLoader
    experiment_baseline_tags: ExperimentBaselineTagsDataLoader
    experiment_dataset_splits: ExperimentDatasetSplitsDataLoader
    experiment_error_rates: ExperimentErrorRatesDataLoader
    experiment_job_fields: TableFieldsDataLoader
    experiment_jobs: ExperimentJobsDataLoader
    experiment_expected_run_counts: ExperimentExpectedRunCountsDataLoader
    last_experiment_errors: LastExperimentErrorsDataLoader
    experiment_fields: TableFieldsDataLoader
    experiment_repeated_run_group_annotation_summaries: (
        ExperimentRepeatedRunGroupAnnotationSummariesDataLoader
    )
    experiment_repeated_run_groups: ExperimentRepeatedRunGroupsDataLoader
    experiment_run_annotation_fields: TableFieldsDataLoader
    experiment_run_annotations: ExperimentRunAnnotations
    experiment_run_counts: ExperimentRunCountsDataLoader
    experiment_run_fields: TableFieldsDataLoader
    experiment_runs_by_experiment_and_example: ExperimentRunsByExperimentAndExampleDataLoader
    experiment_sequence_number: ExperimentSequenceNumberDataLoader
    generative_model_fields: TableFieldsDataLoader
    generative_model_custom_provider_fields: TableFieldsDataLoader
    last_used_times_by_generative_model_id: LastUsedTimesByGenerativeModelIdDataLoader
    latency_ms_quantile: LatencyMsQuantileDataLoader
    min_start_or_max_end_times: MinStartOrMaxEndTimeDataLoader
    llm_evaluator_fields: TableFieldsDataLoader
    num_child_spans: NumChildSpansDataLoader
    num_spans_per_trace: NumSpansPerTraceDataLoader
    project_by_name: ProjectByNameDataLoader
    project_has_traces: ProjectHasTracesDataLoader
    project_fields: TableFieldsDataLoader
    project_trace_retention_policy_fields: TableFieldsDataLoader
    projects_by_trace_retention_policy_id: ProjectIdsByTraceRetentionPolicyIdDataLoader
    prompt_fields: TableFieldsDataLoader
    prompt_label_fields: TableFieldsDataLoader
    prompt_label_usage_counts: PromptLabelUsageCountsDataLoader
    prompt_labels_by_prompt: PromptLabelsByPromptDataLoader
    prompt_versions: PromptVersionDataLoader
    prompt_version_counts: PromptVersionCountDataLoader
    prompt_version_sequence_number: PromptVersionSequenceNumberDataLoader
    prompt_version_tag_fields: TableFieldsDataLoader
    prompt_version_tags_by_prompt: PromptVersionTagsByPromptDataLoader
    prompt_authors: "VersionAuthorsDataLoader[models.PromptVersion]"
    latest_prompt_version_ids: LatestPromptVersionIdDataLoader
    latest_code_evaluator_versions: LatestCodeEvaluatorVersionDataLoader
    project_session_annotation_fields: TableFieldsDataLoader
    project_session_fields: TableFieldsDataLoader
    record_counts: RecordCountDataLoader
    sandbox_configs_by_provider: SandboxConfigsByProviderDataLoader
    sandbox_provider: SandboxProviderDataLoader
    secret_fields: TableFieldsDataLoader
    secrets: SecretsDataLoader
    session_annotations_by_session: SessionAnnotationsBySessionDataLoader
    session_first_inputs: SessionIODataLoader
    session_last_outputs: SessionIODataLoader
    session_num_traces: SessionNumTracesDataLoader
    session_num_traces_with_error: SessionNumTracesWithErrorDataLoader
    session_token_usages: SessionTokenUsagesDataLoader
    session_trace_latency_ms_quantile: SessionTraceLatencyMsQuantileDataLoader
    session_user_ids: UserIdsDataLoader
    span_annotation_fields: TableFieldsDataLoader
    span_annotations: SpanAnnotationsDataLoader
    span_by_id: SpanByIdDataLoader
    span_cost_by_span: SpanCostBySpanDataLoader
    span_cost_detail_fields: TableFieldsDataLoader
    span_cost_detail_summary_entries_by_generative_model: (
        SpanCostDetailSummaryEntriesByGenerativeModelDataLoader
    )
    span_cost_detail_summary_entries_by_project_session: (
        SpanCostDetailSummaryEntriesByProjectSessionDataLoader
    )
    span_cost_detail_summary_entries_by_span: SpanCostDetailSummaryEntriesBySpanDataLoader
    span_cost_detail_summary_entries_by_trace: SpanCostDetailSummaryEntriesByTraceDataLoader
    span_cost_details_by_span_cost: SpanCostDetailsBySpanCostDataLoader
    span_cost_fields: TableFieldsDataLoader
    span_cost_summary_by_experiment: SpanCostSummaryByExperimentDataLoader
    span_cost_summary_by_experiment_repeated_run_group: (
        SpanCostSummaryByExperimentRepeatedRunGroupDataLoader
    )
    span_cost_summary_by_experiment_run: SpanCostSummaryByExperimentRunDataLoader
    span_cost_summary_by_generative_model: SpanCostSummaryByGenerativeModelDataLoader
    span_cost_summary_by_project: SpanCostSummaryByProjectDataLoader
    span_cost_summary_by_project_session: SpanCostSummaryByProjectSessionDataLoader
    span_cost_summary_by_trace: SpanCostSummaryByTraceDataLoader
    span_dataset_examples: SpanDatasetExamplesDataLoader
    span_descendants: SpanDescendantsDataLoader
    span_fields: TableFieldsDataLoader
    span_projects: SpanProjectsDataLoader
    token_counts: TokenCountDataLoader
    token_prices_by_model: TokenPricesByModelDataLoader
    trace_annotation_fields: TableFieldsDataLoader
    trace_annotations_by_trace: TraceAnnotationsByTraceDataLoader
    trace_by_trace_ids: TraceByTraceIdsDataLoader
    trace_error_count: TraceErrorCountDataLoader
    trace_errors_by_type: TraceErrorsByTypeDataLoader
    trace_fields: TableFieldsDataLoader
    trace_retention_policy_id_by_project_id: TraceRetentionPolicyIdByProjectIdDataLoader
    trace_root_spans: TraceRootSpansDataLoader
    trace_span_counts_by_kind: TraceSpanCountsByKindDataLoader
    trace_user_ids: UserIdsDataLoader
    user_credential_counts: UserCredentialCountsDataLoader
    user_roles: UserRolesDataLoader
    user_api_key_fields: TableFieldsDataLoader
    user_fields: TableFieldsDataLoader
    users: UsersDataLoader


def build_data_loaders(
    db: DbSessionFactory,
    cache_for_dataloaders: CacheForDataLoaders | None = None,
) -> DataLoaders:
    return DataLoaders(
        annotation_configs_by_project=AnnotationConfigsByProjectDataLoader(db),
        average_experiment_repeated_run_group_latency=AverageExperimentRepeatedRunGroupLatencyDataLoader(
            db
        ),
        average_experiment_run_latency=AverageExperimentRunLatencyDataLoader(db),
        code_evaluator_fields=TableFieldsDataLoader(db, models.CodeEvaluator),
        code_evaluator_version_count=CodeEvaluatorVersionCountDataLoader(db),
        code_evaluator_version_sequence_number=CodeEvaluatorVersionSequenceNumberDataLoader(db),
        dataset_evaluator_fields=TableFieldsDataLoader(db, models.DatasetEvaluators),
        dataset_evaluators_by_evaluator=DatasetEvaluatorsByEvaluatorDataLoader(db),
        dataset_evaluators_by_id=DatasetEvaluatorsByIdDataLoader(db),
        dataset_evaluators=DatasetEvaluatorsDataLoader(db),
        datasets_by_evaluator=DatasetsByEvaluatorDataLoader(db),
        dataset_dataset_splits=DatasetDatasetSplitsDataLoader(db),
        dataset_example_counts=DatasetExampleCountsDataLoader(db),
        dataset_example_fields=TableFieldsDataLoader(db, models.DatasetExample),
        dataset_example_revisions=DatasetExampleRevisionsDataLoader(db),
        dataset_example_spans=DatasetExampleSpansDataLoader(db),
        dataset_examples_and_versions_by_experiment_run=DatasetExamplesAndVersionsByExperimentRunDataLoader(
            db
        ),
        dataset_example_splits=DatasetExampleSplitsDataLoader(db),
        dataset_fields=TableFieldsDataLoader(db, models.Dataset),
        dataset_split_fields=TableFieldsDataLoader(db, models.DatasetSplit),
        dataset_version_fields=TableFieldsDataLoader(db, models.DatasetVersion),
        dataset_labels=DatasetLabelsDataLoader(db),
        dataset_authors=VersionAuthorsDataLoader(
            db,
            models.DatasetVersion,
            models.DatasetVersion.dataset_id,
            # A dataset owns its creator, so only its last editor comes from its versions.
            resolve_created_by=False,
        ),
        dataset_label_fields=TableFieldsDataLoader(db, models.DatasetLabel),
        dataset_label_usage_counts=DatasetLabelUsageCountsDataLoader(db),
        document_evaluation_summaries=DocumentEvaluationSummaryDataLoader(
            db,
            cache_map=(
                cache_for_dataloaders.document_evaluation_summary if cache_for_dataloaders else None
            ),
        ),
        document_annotation_fields=TableFieldsDataLoader(db, models.DocumentAnnotation),
        document_evaluations=DocumentEvaluationsDataLoader(db),
        document_retrieval_metrics=DocumentRetrievalMetricsDataLoader(db),
        evaluator_by_id=EvaluatorByIdDataLoader(db),
        experiment_annotation_label_fractions=ExperimentAnnotationLabelFractionsDataLoader(db),
        annotation_summaries=AnnotationSummaryDataLoader(
            db,
            cache_map=(cache_for_dataloaders.annotation_summary if cache_for_dataloaders else None),
        ),
        experiment_annotation_summaries=ExperimentAnnotationSummaryDataLoader(db),
        experiment_baseline_tags=ExperimentBaselineTagsDataLoader(db),
        experiment_dataset_splits=ExperimentDatasetSplitsDataLoader(db),
        experiment_error_rates=ExperimentErrorRatesDataLoader(db),
        experiment_job_fields=TableFieldsDataLoader(db, models.ExperimentJob),
        experiment_jobs=ExperimentJobsDataLoader(db),
        experiment_expected_run_counts=ExperimentExpectedRunCountsDataLoader(db),
        last_experiment_errors=LastExperimentErrorsDataLoader(db),
        experiment_fields=TableFieldsDataLoader(db, models.Experiment),
        experiment_repeated_run_group_annotation_summaries=ExperimentRepeatedRunGroupAnnotationSummariesDataLoader(
            db
        ),
        experiment_repeated_run_groups=ExperimentRepeatedRunGroupsDataLoader(db),
        experiment_run_annotation_fields=TableFieldsDataLoader(db, models.ExperimentRunAnnotation),
        experiment_run_annotations=ExperimentRunAnnotations(db),
        experiment_run_counts=ExperimentRunCountsDataLoader(db),
        experiment_run_fields=TableFieldsDataLoader(db, models.ExperimentRun),
        experiment_runs_by_experiment_and_example=ExperimentRunsByExperimentAndExampleDataLoader(
            db
        ),
        experiment_sequence_number=ExperimentSequenceNumberDataLoader(db),
        generative_model_fields=TableFieldsDataLoader(db, models.GenerativeModel),
        generative_model_custom_provider_fields=TableFieldsDataLoader(
            db, models.GenerativeModelCustomProvider
        ),
        last_used_times_by_generative_model_id=LastUsedTimesByGenerativeModelIdDataLoader(db),
        latency_ms_quantile=LatencyMsQuantileDataLoader(
            db,
            cache_map=(
                cache_for_dataloaders.latency_ms_quantile if cache_for_dataloaders else None
            ),
        ),
        llm_evaluator_fields=TableFieldsDataLoader(db, models.LLMEvaluator),
        min_start_or_max_end_times=MinStartOrMaxEndTimeDataLoader(
            db,
            cache_map=(
                cache_for_dataloaders.min_start_or_max_end_time if cache_for_dataloaders else None
            ),
        ),
        num_child_spans=NumChildSpansDataLoader(db),
        num_spans_per_trace=NumSpansPerTraceDataLoader(db),
        project_fields=TableFieldsDataLoader(db, models.Project),
        projects_by_trace_retention_policy_id=ProjectIdsByTraceRetentionPolicyIdDataLoader(db),
        prompt_fields=TableFieldsDataLoader(db, models.Prompt),
        prompt_label_fields=TableFieldsDataLoader(db, models.PromptLabel),
        prompt_label_usage_counts=PromptLabelUsageCountsDataLoader(db),
        prompt_labels_by_prompt=PromptLabelsByPromptDataLoader(db),
        prompt_versions=PromptVersionDataLoader(db),
        prompt_version_counts=PromptVersionCountDataLoader(db),
        prompt_version_sequence_number=PromptVersionSequenceNumberDataLoader(db),
        prompt_version_tag_fields=TableFieldsDataLoader(db, models.PromptVersionTag),
        prompt_version_tags_by_prompt=PromptVersionTagsByPromptDataLoader(db),
        prompt_authors=VersionAuthorsDataLoader(
            db, models.PromptVersion, models.PromptVersion.prompt_id
        ),
        latest_prompt_version_ids=LatestPromptVersionIdDataLoader(db),
        latest_code_evaluator_versions=LatestCodeEvaluatorVersionDataLoader(db),
        project_session_annotation_fields=TableFieldsDataLoader(
            db, models.ProjectSessionAnnotation
        ),
        project_session_fields=TableFieldsDataLoader(db, models.ProjectSession),
        record_counts=RecordCountDataLoader(
            db,
            cache_map=cache_for_dataloaders.record_count if cache_for_dataloaders else None,
        ),
        sandbox_configs_by_provider=SandboxConfigsByProviderDataLoader(db),
        sandbox_provider=SandboxProviderDataLoader(db),
        secret_fields=TableFieldsDataLoader(db, models.Secret),
        secrets=SecretsDataLoader(db),
        session_annotations_by_session=SessionAnnotationsBySessionDataLoader(db),
        session_first_inputs=SessionIODataLoader(db, "first_input"),
        session_last_outputs=SessionIODataLoader(db, "last_output"),
        session_num_traces=SessionNumTracesDataLoader(db),
        session_num_traces_with_error=SessionNumTracesWithErrorDataLoader(db),
        session_token_usages=SessionTokenUsagesDataLoader(db),
        session_trace_latency_ms_quantile=SessionTraceLatencyMsQuantileDataLoader(db),
        session_user_ids=UserIdsDataLoader(db, "session"),
        span_annotation_fields=TableFieldsDataLoader(db, models.SpanAnnotation),
        span_annotations=SpanAnnotationsDataLoader(db),
        span_fields=TableFieldsDataLoader(db, models.Span),
        span_by_id=SpanByIdDataLoader(db),
        span_cost_by_span=SpanCostBySpanDataLoader(db),
        span_cost_detail_summary_entries_by_generative_model=SpanCostDetailSummaryEntriesByGenerativeModelDataLoader(
            db
        ),
        span_cost_detail_summary_entries_by_project_session=SpanCostDetailSummaryEntriesByProjectSessionDataLoader(
            db
        ),
        span_cost_detail_summary_entries_by_span=SpanCostDetailSummaryEntriesBySpanDataLoader(db),
        span_cost_detail_summary_entries_by_trace=SpanCostDetailSummaryEntriesByTraceDataLoader(db),
        span_cost_details_by_span_cost=SpanCostDetailsBySpanCostDataLoader(db),
        span_cost_detail_fields=TableFieldsDataLoader(db, models.SpanCostDetail),
        span_cost_fields=TableFieldsDataLoader(db, models.SpanCost),
        span_cost_summary_by_experiment=SpanCostSummaryByExperimentDataLoader(db),
        span_cost_summary_by_experiment_repeated_run_group=SpanCostSummaryByExperimentRepeatedRunGroupDataLoader(
            db
        ),
        span_cost_summary_by_experiment_run=SpanCostSummaryByExperimentRunDataLoader(db),
        span_cost_summary_by_generative_model=SpanCostSummaryByGenerativeModelDataLoader(db),
        span_cost_summary_by_project=SpanCostSummaryByProjectDataLoader(
            db,
            cache_map=cache_for_dataloaders.token_cost if cache_for_dataloaders else None,
        ),
        span_cost_summary_by_project_session=SpanCostSummaryByProjectSessionDataLoader(db),
        span_cost_summary_by_trace=SpanCostSummaryByTraceDataLoader(db),
        span_dataset_examples=SpanDatasetExamplesDataLoader(db),
        span_descendants=SpanDescendantsDataLoader(db),
        span_projects=SpanProjectsDataLoader(db),
        token_counts=TokenCountDataLoader(
            db,
            cache_map=cache_for_dataloaders.token_count if cache_for_dataloaders else None,
        ),
        token_prices_by_model=TokenPricesByModelDataLoader(db),
        trace_annotation_fields=TableFieldsDataLoader(db, models.TraceAnnotation),
        trace_annotations_by_trace=TraceAnnotationsByTraceDataLoader(db),
        trace_by_trace_ids=TraceByTraceIdsDataLoader(db),
        trace_error_count=TraceErrorCountDataLoader(db),
        trace_errors_by_type=TraceErrorsByTypeDataLoader(db),
        trace_fields=TableFieldsDataLoader(db, models.Trace),
        trace_span_counts_by_kind=TraceSpanCountsByKindDataLoader(db),
        trace_retention_policy_id_by_project_id=TraceRetentionPolicyIdByProjectIdDataLoader(db),
        project_trace_retention_policy_fields=TableFieldsDataLoader(
            db, models.ProjectTraceRetentionPolicy
        ),
        trace_root_spans=TraceRootSpansDataLoader(db),
        trace_user_ids=UserIdsDataLoader(db, "trace"),
        project_by_name=ProjectByNameDataLoader(db),
        project_has_traces=ProjectHasTracesDataLoader(db),
        user_credential_counts=UserCredentialCountsDataLoader(db),
        users=UsersDataLoader(db),
        user_api_key_fields=TableFieldsDataLoader(db, models.ApiKey),
        user_fields=TableFieldsDataLoader(db, models.User),
        user_roles=UserRolesDataLoader(db),
    )
