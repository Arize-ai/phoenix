from starlette.routing import Route

from . import datasets, evaluations, spans, traces
from .dataset_examples import list_dataset_examples

V1_ROUTES = [
    Route("/v1/evaluations", evaluations.post_evaluations, methods=["POST"]),
    Route("/v1/evaluations", evaluations.get_evaluations, methods=["GET"]),
    Route("/v1/traces", traces.post_traces, methods=["POST"]),
    Route("/v1/spans", spans.query_spans_handler, methods=["POST"]),
    Route("/v1/spans", spans.get_spans_handler, methods=["GET"]),
    Route("/v1/datasets/upload", datasets.post_datasets_upload, methods=["POST"]),
    Route("/v1/datasets", datasets.list_datasets, methods=["GET"]),
    Route("/v1/datasets/{id:str}", datasets.get_dataset_by_id, methods=["GET"]),
    Route("/v1/datasets/{id:str}/csv", datasets.get_dataset_csv, methods=["GET"]),
    Route("/v1/datasets/{id:str}/examples", list_dataset_examples, methods=["GET"]),
    Route("/v1/datasets/{id:str}/versions", datasets.get_dataset_versions, methods=["GET"]),
]
