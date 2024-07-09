from typing import Any, Dict

from fastapi.openapi.utils import get_openapi

from phoenix.server.api.routers.v1 import router as v1_router
from phoenix.version import __version__


def get_openapi_schema() -> Dict[str, Any]:
    return get_openapi(
        title="Arize-Phoenix API",
        version=__version__,
        openapi_version="3.1.0",
        description="Schema for Arize-Phoenix REST API",
        routes=v1_router.routes,
    )
