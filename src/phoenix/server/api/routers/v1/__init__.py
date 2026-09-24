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
from .chat_completions import router as chat_completions_router
from .custom_model_providers import router as custom_model_providers_router
from .dataset_labels import router as dataset_labels_router
from .datasets import router as datasets_router
from .documents import router as documents_router
from .experiment_evaluations import router as experiment_evaluations_router
from .experiment_runs import router as experiment_runs_router
from .experiment_tags import router as experiment_tags_router
from .experiments import router as experiments_router
from .model_providers import router as model_providers_router
from .projects import router as projects_router
from .prompts import router as prompts_router
from .secrets import router as secrets_router
from .sessions import router as sessions_router
from .spans import router as spans_router
from .traces import router as traces_router
from .users import router as users_router
from .utils import add_errors_to_responses, order_identifier_routes

REST_API_VERSION = "1.0"
REST_API_DESCRIPTION = """\
Schema for Arize-Phoenix REST API.

Path parameters named `*_identifier` accept either the entity's node ID or its
unique name. Names may contain slashes. A name whose trailing segments coincide
with a sub-route of the same entity, such as a dataset named `foo/examples`, is
ambiguous in a URL and must be referenced by node ID on that route.
"""


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
    # Name-or-ID identifiers match greedily across slashes, so within each router the
    # more specific routes go first, and a router whose routes end in an identifier
    # (projects, datasets) is included after the routers with sub-routes under its
    # prefix. tests/unit/server/api/routers/v1/test_identifier_routes.py pins this.
    for viewer_restricted in (
        annotation_configs_router,
        annotations_router,
        traces_router,
        spans_router,
        sessions_router,
        projects_router,
        dataset_labels_router,
        experiments_router,
        experiment_tags_router,
        experiment_runs_router,
        experiment_evaluations_router,
        datasets_router,
        prompts_router,
        model_providers_router,
        custom_model_providers_router,
        documents_router,
        users_router,
        secrets_router,
    ):
        order_identifier_routes(viewer_restricted)
        viewer_restricted_router.include_router(viewer_restricted)
    router.include_router(viewer_restricted_router)
    # API-key routes define their own viewer policy: viewers can manage their own user keys,
    # while system and organization-wide operations remain admin-gated.
    router.include_router(api_keys_router)
    # The chat completions proxy writes nothing and powers read features like
    # AI search, so — like the agents chat endpoints — it stays available to
    # every authenticated role, viewers included.
    router.include_router(chat_completions_router)
    return router
