from typing import Any

from fastapi import APIRouter
from fastapi.openapi.utils import get_openapi

from phoenix.server.api.routers.auth import create_auth_router
from phoenix.server.api.routers.chat import create_chat_router
from phoenix.server.api.routers.chat_v2 import create_chat_v2_router
from phoenix.server.api.routers.oauth2 import router as oauth2_router
from phoenix.server.api.routers.v1 import REST_API_VERSION, create_v1_router
from phoenix.server.app import router as app_root_router


def get_openapi_schema() -> dict[str, Any]:
    router = APIRouter()
    router.include_router(create_v1_router(authentication_enabled=False))
    router.include_router(create_auth_router(ldap_enabled=True))
    router.include_router(oauth2_router)
    router.include_router(create_chat_router(authentication_enabled=False))
    router.include_router(create_chat_v2_router(authentication_enabled=False))
    router.include_router(app_root_router)
    return get_openapi(
        title="Arize-Phoenix REST API",
        version=REST_API_VERSION,
        openapi_version="3.1.0",
        description="Schema for Arize-Phoenix REST API",
        routes=router.routes,
        separate_input_output_schemas=False,
    )
