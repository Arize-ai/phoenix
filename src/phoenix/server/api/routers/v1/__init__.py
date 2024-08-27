from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from phoenix.auth import ClaimStatus
from phoenix.config import ENABLE_AUTH
from phoenix.server.bearer_auth import PhoenixUser

from .datasets import router as datasets_router
from .evaluations import router as evaluations_router
from .experiment_evaluations import router as experiment_evaluations_router
from .experiment_runs import router as experiment_runs_router
from .experiments import router as experiments_router
from .spans import router as spans_router
from .traces import router as traces_router
from .utils import add_errors_to_responses

REST_API_VERSION = "1.0"


async def prevent_access_in_read_only_mode(request: Request) -> None:
    """
    Prevents access to the REST API in read-only mode.
    """
    if request.app.state.read_only:
        raise HTTPException(
            detail="The Phoenix REST API is disabled in read-only mode.",
            status_code=HTTP_403_FORBIDDEN,
        )


async def authorize(request: Request) -> None:
    """
    Authorize the claim in the request.

    Args:
        request: The incoming request.
    Returns:
        None
    """
    if not isinstance((user := request.user), PhoenixUser):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid token")
    claim = user.claim
    if claim.status is ClaimStatus.EXPIRED:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Expired token")
    if claim.status is ClaimStatus.INACTIVE:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Inactive token")
    if claim.status is not ClaimStatus.VALID:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid token")


dependencies = [Depends(prevent_access_in_read_only_mode)]
if ENABLE_AUTH:
    dependencies.append(Depends(authorize))

router = APIRouter(
    prefix="/v1",
    dependencies=dependencies,
    responses=add_errors_to_responses(
        [
            HTTP_403_FORBIDDEN  # adds a 403 response to each route in the generated OpenAPI schema
        ]
    ),
)
router.include_router(datasets_router)
router.include_router(experiments_router)
router.include_router(experiment_runs_router)
router.include_router(experiment_evaluations_router)
router.include_router(traces_router)
router.include_router(spans_router)
router.include_router(evaluations_router)
