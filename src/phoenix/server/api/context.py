from dataclasses import dataclass
from pathlib import Path
from typing import AsyncContextManager, Callable, List, Optional, Tuple, Union

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket
from strawberry.dataloader import DataLoader

from phoenix.core.model_schema import Model
from phoenix.core.traces import Traces
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.Evaluation import DocumentEvaluation, SpanEvaluation, TraceEvaluation


@dataclass
class DataLoaders:
    latency_ms_quantile: DataLoader[Tuple[int, Optional[TimeRange], float], Optional[float]]
    span_evaluations: DataLoader[int, List[SpanEvaluation]]
    document_evaluations: DataLoader[int, List[DocumentEvaluation]]
    trace_evaluations: DataLoader[int, List[TraceEvaluation]]


@dataclass
class Context:
    request: Union[Request, WebSocket]
    response: Optional[Response]
    db: Callable[[], AsyncContextManager[AsyncSession]]
    data_loaders: DataLoaders
    model: Model
    export_path: Path
    corpus: Optional[Model] = None
    traces: Optional[Traces] = None
