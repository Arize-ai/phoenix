from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN

from phoenix.server.bearer_auth import is_authenticated

from .annotation_configs import router as annotation_configs_router
from .annotations import router as annotations_router
from .datasets import router as datasets_router
from .evaluations import router as evaluations_router
from .experiment_evaluations import router as experiment_evaluations_router
from .experiment_runs import router as experiment_runs_router
from .experiments import router as experiments_router
from .projects import router as projects_router
from .prompts import router as prompts_router
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


def create_v1_router(authentication_enabled: bool) -> APIRouter:
    """
    Instantiates the v1 REST API router.
    """
    dependencies = [Depends(prevent_access_in_read_only_mode)]
    if authentication_enabled:
        dependencies.append(
            Depends(
                APIKeyHeader(
                    name="Authorization",
                    scheme_name="Bearer",
                    auto_error=False,
                    description="Enter `Bearer` followed by a space and then the token.",
                )
            )
        )
        dependencies.append(Depends(is_authenticated))

    router = APIRouter(
        prefix="/v1",
        dependencies=dependencies,
        responses=add_errors_to_responses(
            [
                HTTP_403_FORBIDDEN  # adds a 403 response to routes in the generated OpenAPI schema
            ]
        ),
    )
    router.include_router(annotation_configs_router)
    router.include_router(annotations_router)
    router.include_router(datasets_router)
    router.include_router(experiments_router)
    router.include_router(experiment_runs_router)
    router.include_router(experiment_evaluations_router)
    router.include_router(traces_router)
    router.include_router(spans_router)
    router.include_router(evaluations_router)
    router.include_router(prompts_router)
    router.include_router(projects_router)
    return router
