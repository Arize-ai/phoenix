from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import AsyncContextManager, Callable, Optional, Union

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket

from phoenix.core.model_schema import Model
from phoenix.server.api.dataloaders import (
    DocumentEvaluationsDataLoader,
    DocumentEvaluationSummaryDataLoader,
    DocumentRetrievalMetricsDataLoader,
    EvaluationSummaryDataLoader,
    LatencyMsQuantileDataLoader,
    MinStartOrMaxEndTimeDataLoader,
    RecordCountDataLoader,
    SpanDescendantsDataLoader,
    SpanEvaluationsDataLoader,
    TokenCountDataLoader,
    TraceEvaluationsDataLoader,
)


@dataclass
class DataLoaders:
    document_evaluation_summaries: DocumentEvaluationSummaryDataLoader
    document_evaluations: DocumentEvaluationsDataLoader
    document_retrieval_metrics: DocumentRetrievalMetricsDataLoader
    evaluation_summaries: EvaluationSummaryDataLoader
    latency_ms_quantile: LatencyMsQuantileDataLoader
    min_start_or_max_end_times: MinStartOrMaxEndTimeDataLoader
    record_counts: RecordCountDataLoader
    span_descendants: SpanDescendantsDataLoader
    span_evaluations: SpanEvaluationsDataLoader
    token_counts: TokenCountDataLoader
    trace_evaluations: TraceEvaluationsDataLoader


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    db: Callable[[], AsyncContextManager[AsyncSession]]
    data_loaders: DataLoaders
    model: Model
    export_path: Path
    corpus: Optional[Model] = None
    streaming_last_updated_at: Callable[[], Optional[datetime]] = lambda: None
