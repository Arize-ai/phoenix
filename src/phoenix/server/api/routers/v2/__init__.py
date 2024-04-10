from starlette.routing import Route

from . import evaluations, spans, traces

V2_ROUTES = [
    Route("/v2/evaluations", evaluations.post_evaluation, methods=["POST"]),
    Route("/v2/evaluations", evaluations.get_evaluations, methods=["GET"]),
    Route("/v2/traces", traces.post_traces, methods=["POST"]),
    Route("/v2/spans", spans.get_spans, methods=["GET"]),
]
