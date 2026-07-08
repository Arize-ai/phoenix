from __future__ import annotations

from collections.abc import Sequence
from copy import deepcopy
from typing import Any, Literal, TypeVar

from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

ModelType = TypeVar("ModelType", bound=type[BaseModel])

_REGISTERED_MODELS: list[type[BaseModel]] = []


def register_openapi_schema(cls: ModelType) -> ModelType:
    """Mark a Pydantic model class for inclusion in the generated OpenAPI
    schema's `components.schemas` block.

    Use this when a model is part of a wire payload that doesn't ride on a
    typed FastAPI response — for example, a chunk embedded in an SSE stream.
    """
    _REGISTERED_MODELS.append(cls)
    return cls


def get_registered_models() -> tuple[type[BaseModel], ...]:
    """Return all classes recorded via `register_openapi_schema`, in registration order."""
    return tuple(_REGISTERED_MODELS)


def add_registered_models_to_openapi_schema(
    *,
    openapi_schema: dict[str, Any],
    registered_models: Sequence[type[BaseModel]],
) -> dict[str, Any]:
    """Return a deep copy of ``openapi_schema`` with each model in
    ``registered_schemas`` merged into ``components.schemas``."""
    result = deepcopy(openapi_schema)
    if not registered_models:
        return result
    mode: Literal["validation"] = "validation"
    _, top_level = models_json_schema(
        [(model, mode) for model in registered_models],
        ref_template="#/components/schemas/{model}",
    )
    extra_schemas = top_level.get("$defs", {})
    if not extra_schemas:
        return result
    components = result.setdefault("components", {})
    schemas = components.setdefault("schemas", {})
    for name, schema in extra_schemas.items():
        schemas.setdefault(name, schema)
    return result
