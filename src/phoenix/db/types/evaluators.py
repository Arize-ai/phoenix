from typing import Annotated, Any

from jsonpath_ng import JSONPath as JSONPathAST
from jsonpath_ng import parse as parse_jsonpath
from jsonpath_ng.exceptions import (  # type: ignore[import-untyped]
    JsonPathLexerError,
    JsonPathParserError,
)
from jsonpath_ng.jsonpath import (  # type: ignore[import-untyped]
    Intersect,
    Parent,
    Union,
    Where,
    WhereNot,
)
from pydantic import AfterValidator

from .db_helper_types import DBBaseModel

# AST node types to reject: jsonpath-ng extensions not in RFC 9535
# We allow only RFC 9535 compliant features (root, child, index, wildcard, slice, descendant)
_DISALLOWED_JSONPATH_NODES = (
    Union,  # $.a | $.b - jsonpath-ng extension
    Intersect,  # $.a & $.b - jsonpath-ng extension
    Where,  # $.a where $.b - jsonpath-ng extension
    WhereNot,  # $.a wherenot $.b - jsonpath-ng extension
    Parent,  # `parent` - jsonpath-ng extension
)


def _walk_jsonpath_ast(node: JSONPathAST) -> None:
    """Recursively walk AST and raise if disallowed node found."""
    if isinstance(node, _DISALLOWED_JSONPATH_NODES):
        raise ValueError(f"JSONPath feature '{type(node).__name__}' is not supported")

    # Recurse into child nodes
    if hasattr(node, "left"):
        _walk_jsonpath_ast(node.left)
    if hasattr(node, "right"):
        _walk_jsonpath_ast(node.right)


def _validate_jsonpath(value: str) -> str:
    """Validate JSONPath: must parse and not use disallowed features."""
    # Pre-checks for strict validation
    if not value:
        raise ValueError("JSONPath cannot be empty")
    if not value.startswith("$"):
        raise ValueError("JSONPath must start with '$'")
    if len(value) > 1000:
        raise ValueError("JSONPath exceeds maximum length of 1000 characters")

    try:
        ast = parse_jsonpath(value)
    except (JsonPathLexerError, JsonPathParserError) as e:
        raise ValueError(f"Invalid JSONPath syntax: {e}")

    _walk_jsonpath_ast(ast)
    return value


JSONPath = Annotated[str, AfterValidator(_validate_jsonpath)]


class InputMapping(DBBaseModel):
    literal_mapping: dict[str, Any]
    path_mapping: dict[str, JSONPath]
