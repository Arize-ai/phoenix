from starlette.routing import Route

from .evaluation_handler import EvaluationHandler
from .span_handler import SpanHandler
from .trace_handler import TraceHandler


def v1_routes(traces, span_store):
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
