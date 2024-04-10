from typing import List, Optional

from starlette.routing import Route

from phoenix.core.traces import Traces
from phoenix.storage.span_store import SpanStore

from .evaluation_handler import EvaluationHandler
from .span_handler import SpanHandler
from .trace_handler import TraceHandler


def v1_routes(traces: Traces, span_store: Optional[SpanStore]) -> List[Route]:
    return [
        Route("/v1/spans", type("SpanEndpoint", (SpanHandler,), {"traces": traces})),
        Route(
            "/v1/traces",
            type("TraceEndpoint", (TraceHandler,), {"traces": traces, "store": span_store}),
        ),
        Route(
            "/v1/evaluations", type("EvaluationEndpoint", (EvaluationHandler,), {"traces": traces})
        ),
    ]
