from typing import Annotated, Any

from jsonpath_ng import JSONPath as JSONPathAST
from jsonpath_ng import parse as parse_jsonpath
from jsonpath_ng.exceptions import (  # type: ignore[import-untyped]
    JsonPathLexerError,
    JsonPathParserError,
)
from jsonpath_ng.jsonpath import (  # type: ignore[import-untyped]
    Child,
    Descendants,
    Fields,
    Index,
    Root,
    Slice,
)
from pydantic import AfterValidator

from .db_helper_types import DBBaseModel

# Allowlist of AST node types that correspond to RFC 9535 features.
# Using an allowlist (not denylist) ensures new jsonpath-ng features
# don't accidentally slip through if the library adds them.
#
# Allowed features:
#   - Root ($)
#   - Child (.field or ['field'])
#   - Fields (field names, including multiple: ["a", "b"])
#   - Index ([n] or [-n])
#   - Slice ([start:end:step], also used for wildcard [*])
#   - Descendants (..)
_ALLOWED_JSONPATH_NODES = (
    Root,
    Child,
    Fields,
    Index,
    Slice,
    Descendants,
)


def _walk_jsonpath_ast(node: JSONPathAST) -> None:
    """Recursively walk AST and raise if node type is not in allowlist."""
    if not isinstance(node, _ALLOWED_JSONPATH_NODES):
        raise ValueError(f"JSONPath feature '{type(node).__name__}' is not supported")

    # Recurse into child nodes
    if hasattr(node, "left"):
        _walk_jsonpath_ast(node.left)
    if hasattr(node, "right"):
        _walk_jsonpath_ast(node.right)


def _validate_jsonpath(value: str) -> str:
    """Validate JSONPath: must parse and only use allowed features.

    Note: jsonpath-ng accepts paths with or without leading '$' (e.g., both
    '$.input.query' and 'input.query' are valid). The frontend sends paths
    without '$', so we don't require it.
    """
    if not value:
        raise ValueError("JSONPath cannot be empty")
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
