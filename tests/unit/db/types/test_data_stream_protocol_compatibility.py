import ast
import inspect
from types import ModuleType

from pydantic import TypeAdapter
from pydantic_ai.ui.vercel_ai import _models as upstream_models
from pydantic_ai.ui.vercel_ai import request_types as upstream_request_types

from phoenix.db.types.data_stream_protocol import _base as vendored_models
from phoenix.db.types.data_stream_protocol import request_types as vendored_request_types


class _NormalizeVendoredSource(ast.NodeTransformer):
    """Remove intentional, non-behavioral differences from vendored source."""

    def _remove_docstring(self, node: ast.Module | ast.ClassDef | ast.FunctionDef) -> None:
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
        ):
            node.body.pop(0)

    def visit_Module(self, node: ast.Module) -> ast.Module:  # noqa: N802
        self.generic_visit(node)
        self._remove_docstring(node)
        return node

    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:  # noqa: N802
        self.generic_visit(node)
        self._remove_docstring(node)
        return node

    def visit_FunctionDef(self, node: ast.FunctionDef) -> ast.FunctionDef:  # noqa: N802
        self.generic_visit(node)
        self._remove_docstring(node)
        return node

    def visit_ImportFrom(self, node: ast.ImportFrom) -> ast.ImportFrom:  # noqa: N802
        # Phoenix renamed pydantic-ai's private `_models` module to `_base`.
        if node.level == 1 and node.module in {"_models", "_base"}:
            node.module = "_vendored_models"
        return node


def _normalized_source_ast(module: ModuleType) -> str:
    tree = ast.parse(inspect.getsource(module))
    tree = _NormalizeVendoredSource().visit(tree)
    ast.fix_missing_locations(tree)
    return ast.dump(tree, include_attributes=False)


def test_vendored_base_models_match_pydantic_ai_source() -> None:
    assert _normalized_source_ast(vendored_models) == _normalized_source_ast(upstream_models)


def test_vendored_request_types_match_pydantic_ai_source() -> None:
    assert _normalized_source_ast(vendored_request_types) == _normalized_source_ast(
        upstream_request_types
    )


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
