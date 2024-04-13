from starlette.routing import Route

from . import evaluations, spans, traces

V1_ROUTES = [
    Route("/v1/evaluations", evaluations.post_evaluations, methods=["POST"]),
    Route("/v1/evaluations", evaluations.get_evaluations, methods=["GET"]),
    Route("/v1/traces", traces.post_traces, methods=["POST"]),
    Route("/v1/spans", spans.query_spans_handler, methods=["POST"]),
    Route("/v1/spans", spans.get_spans_handler, methods=["GET"]),
]
