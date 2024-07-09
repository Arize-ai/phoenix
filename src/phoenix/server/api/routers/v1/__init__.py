from fastapi import APIRouter

from . import (
    evaluations,
    experiment_evaluations,
    experiment_runs,
    experiments,
    spans,
    traces,
)
from .dataset_examples import list_dataset_examples
from .datasets import router as datasets_router

router = APIRouter(prefix="/v1")
router.include_router(datasets_router)

V1_ROUTES = (
    ("/evaluations", evaluations.post_evaluations, ["POST"]),
    ("/evaluations", evaluations.get_evaluations, ["GET"]),
    ("/traces", traces.post_traces, ["POST"]),
    ("/spans", spans.query_spans_handler, ["POST"]),
    ("/spans", spans.get_spans_handler, ["GET"]),
    ("/datasets/{id:str}/examples", list_dataset_examples, ["GET"]),
    ("/datasets/{dataset_id:str}/experiments", experiments.create_experiment, ["POST"]),
    ("/experiments/{experiment_id:str}", experiments.read_experiment, ["GET"]),
    ("/experiments/{experiment_id:str}/runs", experiment_runs.create_experiment_run, ["POST"]),
    ("/experiments/{experiment_id:str}/runs", experiment_runs.list_experiment_runs, ["GET"]),
    ("/experiment_evaluations", experiment_evaluations.upsert_experiment_evaluation, ["POST"]),
)
for path, endpoint, methods in V1_ROUTES:
    router.add_api_route(path, endpoint, methods=methods)
