from fastapi import APIRouter

from . import (
    experiment_evaluations,
    experiment_runs,
)
from .datasets import router as datasets_router
from .evaluations import router as evaluations_router
from .experiments import router as experiments_router
from .spans import router as spans_router
from .traces import router as traces_router

router = APIRouter(prefix="/v1")
router.include_router(datasets_router)
router.include_router(evaluations_router)
router.include_router(experiments_router)
router.include_router(traces_router)
router.include_router(spans_router)

V1_ROUTES = (
    ("/experiments/{experiment_id:str}/runs", experiment_runs.create_experiment_run, ["POST"]),
    ("/experiments/{experiment_id:str}/runs", experiment_runs.list_experiment_runs, ["GET"]),
    ("/experiment_evaluations", experiment_evaluations.upsert_experiment_evaluation, ["POST"]),
)
for path, endpoint, methods in V1_ROUTES:
    router.add_api_route(path, endpoint, methods=methods)
