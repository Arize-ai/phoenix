import ast
import inspect
from types import ModuleType

from pydantic import TypeAdapter
from pydantic_ai.ui.vercel_ai import _models as upstream_models
from pydantic_ai.ui.vercel_ai import request_types as upstream_request_types

from phoenix.db.types.data_stream_protocol import _models as vendored_models
from phoenix.db.types.data_stream_protocol import request_types as vendored_request_types


def _source_ast(module: ModuleType) -> str:
    return ast.dump(ast.parse(inspect.getsource(module)), include_attributes=False)


def test_vendored_base_models_match_pydantic_ai_source() -> None:
    assert _source_ast(vendored_models) == _source_ast(upstream_models)


def test_vendored_request_types_match_pydantic_ai_source() -> None:
    assert _source_ast(vendored_request_types) == _source_ast(upstream_request_types)


def test_vendored_request_data_has_same_pydantic_schema() -> None:
    upstream_adapter: TypeAdapter[upstream_request_types.RequestData] = TypeAdapter(
        upstream_request_types.RequestData
    )
    vendored_adapter: TypeAdapter[vendored_request_types.RequestData] = TypeAdapter(
        vendored_request_types.RequestData
    )

    assert vendored_adapter.json_schema(mode="validation") == upstream_adapter.json_schema(
        mode="validation"
    )
    assert vendored_adapter.json_schema(mode="serialization") == upstream_adapter.json_schema(
        mode="serialization"
    )
