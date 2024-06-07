from starlette.routing import Route

from . import (
    datasets,
    evaluations,
    experiment_evaluations,
    experiment_runs,
    experiments,
    spans,
    traces,
)
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
    Route(
        "/v1/datasets/{dataset_id:str}/experiments",
        experiments.create_experiment,
        methods=["POST"],
    ),
    Route(
        "/v1/experiments/{experiment_id:str}",
        experiments.read_experiment,
        methods=["GET"],
    ),
    Route(
        "/v1/datasets/{dataset_id:str}/experiments/{experiment_id:str}/runs",
        experiment_runs.create_experiment_run,
        methods=["POST"],
    ),
    Route(
        "/v1/datasets/{dataset_id:str}/experiments/{experiment_id:str}/runs",
        experiment_runs.get_experiment_runs,
        methods=["GET"],
    ),
    Route(
        "/v1/datasets/{ds_id:str}/experiments/{exp_id:str}/runs/{run_id:str}/evaluations",
        experiment_evaluations.create_experiment_evaluation,
        methods=["POST"],
    ),
]
