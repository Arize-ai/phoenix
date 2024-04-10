from starlette.routing import Route

from . import evaluations

V2_ROUTES = [
    Route("/v2/evaluations", evaluations.post_evaluation, methods=["POST"]),
    Route("/v2/evaluations", evaluations.get_evaluations, methods=["GET"]),
]