from typing import Any, Dict

from fastapi.openapi.utils import get_openapi

from phoenix.server.api.routers.v1 import REST_API_VERSION
from phoenix.server.api.routers.v1 import router as v1_router


def get_openapi_schema() -> Dict[str, Any]:
    return get_openapi(
        title="Arize-Phoenix REST API",
        version=REST_API_VERSION,
        openapi_version="3.1.0",
        description="Schema for Arize-Phoenix REST API",
        routes=v1_router.routes,
    )
