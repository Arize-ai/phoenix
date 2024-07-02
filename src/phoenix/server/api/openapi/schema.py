from typing import Any

from starlette.schemas import SchemaGenerator

from phoenix.server.api.routers.v1 import V1_ROUTES

OPENAPI_SCHEMA_GENERATOR = SchemaGenerator(
    {"openapi": "3.0.0", "info": {"title": "Arize-Phoenix API", "version": "1.0"}}
)


def get_openapi_schema() -> Any:
    """
    Exports an OpenAPI schema for the Phoenix REST API as a JSON object.
    """
    return OPENAPI_SCHEMA_GENERATOR.get_schema(V1_ROUTES)  # type: ignore
