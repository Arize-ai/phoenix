from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import AsyncContextManager, Callable, Optional, Union

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket
from typing_extensions import TypeAlias

from phoenix.core.model_schema import Model
from phoenix.server.api.dataloaders import (
    AverageExperimentRunLatencyDataLoader,
    CacheForDataLoaders,
    DatasetExampleRevisionsDataLoader,
    DatasetExampleSpansDataLoader,
    DocumentEvaluationsDataLoader,
    DocumentEvaluationSummaryDataLoader,
    DocumentRetrievalMetricsDataLoader,
    EvaluationSummaryDataLoader,
    ExperimentAnnotationSummaryDataLoader,
    ExperimentErrorRatesDataLoader,
    ExperimentRunCountsDataLoader,
    ExperimentSequenceNumberDataLoader,
    LatencyMsQuantileDataLoader,
    MinStartOrMaxEndTimeDataLoader,
    ProjectByNameDataLoader,
    RecordCountDataLoader,
    SpanDescendantsDataLoader,
    SpanEvaluationsDataLoader,
    SpanProjectsDataLoader,
    TokenCountDataLoader,
    TraceEvaluationsDataLoader,
    TraceRowIdsDataLoader,
)


@dataclass
class DataLoaders:
    average_experiment_run_latency: AverageExperimentRunLatencyDataLoader
    dataset_example_revisions: DatasetExampleRevisionsDataLoader
    dataset_example_spans: DatasetExampleSpansDataLoader
    document_evaluation_summaries: DocumentEvaluationSummaryDataLoader
    document_evaluations: DocumentEvaluationsDataLoader
    document_retrieval_metrics: DocumentRetrievalMetricsDataLoader
    evaluation_summaries: EvaluationSummaryDataLoader
    experiment_annotation_summaries: ExperimentAnnotationSummaryDataLoader
    experiment_error_rates: ExperimentErrorRatesDataLoader
    experiment_run_counts: ExperimentRunCountsDataLoader
    experiment_sequence_number: ExperimentSequenceNumberDataLoader
    latency_ms_quantile: LatencyMsQuantileDataLoader
    min_start_or_max_end_times: MinStartOrMaxEndTimeDataLoader
    record_counts: RecordCountDataLoader
    span_descendants: SpanDescendantsDataLoader
    span_evaluations: SpanEvaluationsDataLoader
    span_projects: SpanProjectsDataLoader
    token_counts: TokenCountDataLoader
    trace_evaluations: TraceEvaluationsDataLoader
    trace_row_ids: TraceRowIdsDataLoader
    project_by_name: ProjectByNameDataLoader


ProjectRowId: TypeAlias = int


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    db: Callable[[], AsyncContextManager[AsyncSession]]
    data_loaders: DataLoaders
    cache_for_dataloaders: Optional[CacheForDataLoaders]
    model: Model
    export_path: Path
    corpus: Optional[Model] = None
    streaming_last_updated_at: Callable[[ProjectRowId], Optional[datetime]] = lambda _: None
    read_only: bool = False
