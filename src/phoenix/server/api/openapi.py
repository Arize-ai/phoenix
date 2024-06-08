import json
from pathlib import Path
from typing import Any

from starlette.schemas import SchemaGenerator

from phoenix.server.api.routers.v1 import V1_ROUTES

OPENAPI_SCHEMA_GENERATOR = SchemaGenerator(
    {"openapi": "3.0.0", "info": {"title": "Arize-Phoenix API", "version": "1.0"}}
)
OPENAPI_SCHEMA_PATH = (Path(__file__).parent / "../../../../openapi.json").resolve()


def get_openapi_schema() -> Any:
    """
    Exports an OpenAPI schema for the Phoenix REST API as a JSON object.
    """
    return OPENAPI_SCHEMA_GENERATOR.get_schema(V1_ROUTES)  # type: ignore


def export_openapi_schema() -> None:
    """
    Exports an OpenAPI schema for the Phoenix REST API to a JSON file.
    """
    with OPENAPI_SCHEMA_PATH.open("w") as f:
        json.dump(get_openapi_schema(), f, indent=4)


if __name__ == "__main__":
    export_openapi_schema()
