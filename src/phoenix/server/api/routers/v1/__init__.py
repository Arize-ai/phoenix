from fastapi import APIRouter

from .datasets import router as datasets_router
from .evaluations import router as evaluations_router
from .experiment_evaluations import router as experiment_evaluations_router
from .experiments import router as experiments_router
from .spans import router as spans_router
from .traces import router as traces_router

router = APIRouter(prefix="/v1")
router.include_router(datasets_router)
router.include_router(evaluations_router)
router.include_router(experiment_evaluations_router)
router.include_router(experiments_router)
router.include_router(traces_router)
router.include_router(spans_router)
