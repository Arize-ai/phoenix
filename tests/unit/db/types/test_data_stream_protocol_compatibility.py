import ast
import inspect
from types import ModuleType
from typing import Any

from pydantic import TypeAdapter
from pydantic.json_schema import JsonSchemaMode
from pydantic_ai.ui.vercel_ai import _models as upstream_models
from pydantic_ai.ui.vercel_ai import request_types as upstream_request_types

from phoenix.db.types.data_stream_protocol import _models as vendored_models
from phoenix.db.types.data_stream_protocol import request_types as vendored_request_types

_LOCAL_FIELD_ADDITIONS: dict[str, frozenset[str]] = {
    "ToolOutputAvailablePart": frozenset({"result_provider_metadata"}),
    "ToolOutputErrorPart": frozenset({"result_provider_metadata"}),
    "DynamicToolOutputAvailablePart": frozenset({"result_provider_metadata"}),
    "DynamicToolOutputErrorPart": frozenset({"result_provider_metadata"}),
    "ReasoningUIPart": frozenset({"id"}),
}
"""Fields Phoenix adds to the vendored parts because pydantic-ai lags AI SDK v7.

These are stripped before comparing against upstream so the rest of the vendored
source is still held to exact equality. Delete an entry once upstream carries the
field: the comparison then fails until the allowlist matches reality.
"""


def _source_ast(module: ModuleType) -> ast.Module:
    return ast.parse(inspect.getsource(module))


def _strip_local_additions(tree: ast.Module) -> ast.Module:
    """Remove Phoenix's added field declarations from a vendored module's AST."""
    stripped: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        if not (added := _LOCAL_FIELD_ADDITIONS.get(node.name)):
            continue
        kept = []
        drop_field_docstring = False
        for stmt in node.body:
            if (
                isinstance(stmt, ast.AnnAssign)
                and isinstance(stmt.target, ast.Name)
                and stmt.target.id in added
            ):
                stripped.setdefault(node.name, set()).add(stmt.target.id)
                drop_field_docstring = True
                continue
            if drop_field_docstring:
                drop_field_docstring = False
                # A bare string literal directly after a field declaration documents that
                # field, so it is part of the local addition and has no upstream counterpart.
                if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
                    if isinstance(stmt.value.value, str):
                        continue
            kept.append(stmt)
        node.body = kept
    assert stripped == {name: set(fields) for name, fields in _LOCAL_FIELD_ADDITIONS.items()}, (
        "_LOCAL_FIELD_ADDITIONS is stale: the vendored module no longer declares these fields"
    )
    return tree


def _strip_local_properties(schema: dict[str, Any], module: ModuleType) -> dict[str, Any]:
    """Remove the JSON Schema properties for Phoenix's added fields."""
    for class_name, fields in _LOCAL_FIELD_ADDITIONS.items():
        properties = schema["$defs"][class_name]["properties"]
        for field in fields:
            model_field = getattr(module, class_name).model_fields[field]
            del properties[model_field.alias or field]
    return schema


def _dump(tree: ast.Module) -> str:
    return ast.dump(tree, include_attributes=False)


def test_vendored_base_models_match_pydantic_ai_source() -> None:
    assert _dump(_source_ast(vendored_models)) == _dump(_source_ast(upstream_models))


def test_vendored_request_types_match_pydantic_ai_source() -> None:
    vendored = _strip_local_additions(_source_ast(vendored_request_types))
    assert _dump(vendored) == _dump(_source_ast(upstream_request_types))


def test_vendored_request_data_has_same_pydantic_schema() -> None:
    upstream_adapter: TypeAdapter[upstream_request_types.RequestData] = TypeAdapter(
        upstream_request_types.RequestData
    )
    vendored_adapter: TypeAdapter[vendored_request_types.RequestData] = TypeAdapter(
        vendored_request_types.RequestData
    )

    modes: tuple[JsonSchemaMode, ...] = ("validation", "serialization")
    for mode in modes:
        vendored_schema = _strip_local_properties(
            vendored_adapter.json_schema(mode=mode),
            vendored_request_types,
        )
        assert vendored_schema == upstream_adapter.json_schema(mode=mode)
