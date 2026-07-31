from fastapi import APIRouter, Depends
from fastapi.security import APIKeyHeader

from phoenix.server.authorization import (
    prevent_access_in_read_only_mode,
    restrict_access_by_viewers,
)
from phoenix.server.bearer_auth import is_authenticated

from .annotation_configs import router as annotation_configs_router
from .annotations import router as annotations_router
from .api_keys import router as api_keys_router
from .dataset_labels import router as dataset_labels_router
from .datasets import router as datasets_router
from .documents import router as documents_router
from .experiment_evaluations import router as experiment_evaluations_router
from .experiment_runs import router as experiment_runs_router
from .experiments import router as experiments_router
from .projects import router as projects_router
from .prompts import router as prompts_router
from .secrets import router as secrets_router
from .sessions import router as sessions_router
from .span_costs import router as span_costs_router
from .spans import router as spans_router
from .traces import router as traces_router
from .users import router as users_router
from .utils import add_errors_to_responses

REST_API_VERSION = "1.0"


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
                403  # adds a 403 response to routes in the generated OpenAPI schema
            ]
        ),
    )
    viewer_restricted_router = APIRouter(
        dependencies=[Depends(restrict_access_by_viewers)] if authentication_enabled else []
    )
    viewer_restricted_router.include_router(annotation_configs_router)
    viewer_restricted_router.include_router(annotations_router)
    viewer_restricted_router.include_router(dataset_labels_router)
    viewer_restricted_router.include_router(datasets_router)
    viewer_restricted_router.include_router(experiments_router)
    viewer_restricted_router.include_router(experiment_runs_router)
    viewer_restricted_router.include_router(experiment_evaluations_router)
    viewer_restricted_router.include_router(traces_router)
    viewer_restricted_router.include_router(spans_router)
    viewer_restricted_router.include_router(span_costs_router)
    viewer_restricted_router.include_router(prompts_router)
    viewer_restricted_router.include_router(projects_router)
    viewer_restricted_router.include_router(sessions_router)
    viewer_restricted_router.include_router(documents_router)
    viewer_restricted_router.include_router(users_router)
    viewer_restricted_router.include_router(secrets_router)
    router.include_router(viewer_restricted_router)
    # API-key routes define their own viewer policy: viewers can manage their own user keys,
    # while system and organization-wide operations remain admin-gated.
    router.include_router(api_keys_router)
    return router
