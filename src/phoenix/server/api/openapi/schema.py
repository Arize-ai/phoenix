from typing import Any

from fastapi.openapi.utils import get_openapi

from phoenix.server.api.routers.v1 import REST_API_VERSION, create_v1_router


def get_openapi_schema() -> dict[str, Any]:
    v1_router = create_v1_router(authentication_enabled=False)
    return get_openapi(
        title="Arize-Phoenix REST API",
        version=REST_API_VERSION,
        openapi_version="3.1.0",
        description="Schema for Arize-Phoenix REST API",
        routes=v1_router.routes,
    )
