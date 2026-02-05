"""Path expression validation for evaluator input mappings.

This module provides validation for path expressions used to extract data from
JSON objects. Paths are validated against a restricted subset of JSONPath syntax.

Design Principles
-----------------

1. RFC 9535 compliance: We reject syntax that jsonpath-ng accepts but isn't
   part of the JSONPath standard (RFC 9535). This ensures paths are portable
   across different JSONPath implementations. Exception: we allow omitting the
   root marker ($) for convenience, though RFC 9535 requires it.

2. Simplicity: Complex features like recursive descent and filter expressions
   add cognitive overhead without significant benefit for the input mapping
   use case. Explicit paths are easier to understand and debug.

Supported Syntax
----------------

Root marker (optional):
    $                       The root object (can be omitted)

Dot notation:
    field                   Access a field
    field.nested            Access nested fields
    $.field.nested          Same as above, with explicit root

Bracket notation:
    ['field']               Access a field (alternative to dot notation)
    ["field"]               Double quotes also supported
    ['field-name']          Required for field names with special characters
    ['123']                 Required for numeric field names

Index access:
    [0]                     First element
    [-1]                    Last element
    [n]                     Any integer index

Wildcard:
    [*]                     All elements of an array

Slices:
    [start:end]             Elements from start to end (exclusive)
    [start:]                Elements from start to end of array
    [:end]                  Elements from beginning to end (exclusive)
    [::step]                Every nth element
    [start:end:step]        Full slice syntax

Combinations:
    items[0].name           Chained accessors
    items[*].name           Wildcard with field access
    data[0][1][2]           Multiple indices

Not Supported
-------------

The following features are rejected for specific reasons:

Recursive descent (..) - TOO COMPLEX
    $..name                 Searches entire document tree at all depths. Adds
                            complexity without significant benefit for the
                            input mapping use case.

Bare @ - NOT RFC 9535 COMPLIANT
    @                       jsonpath-ng accepts this as a field name, but it's
    foo.@.bar               not valid per RFC 9535. Use bracket notation ['@']
                            for fields actually named '@'.

Invalid dot-notation identifiers - NOT RFC 9535 COMPLIANT
    123                     RFC 9535 requires dot-notation identifiers to start
    .123                    with a letter or underscore. Use bracket notation
    items.0.name            for field names that don't meet this requirement.

Operators - JSONPATH-NG EXTENSIONS, NOT PORTABLE
    a | b                   Union - not in RFC 9535, jsonpath-ng specific
    a & b                   Intersect - not in RFC 9535, jsonpath-ng specific
    a where b               Filter clause - jsonpath-ng specific syntax
    a wherenot b            Filter clause - jsonpath-ng specific syntax
    `this`                  Self-reference - jsonpath-ng specific

Filter expressions - TOO COMPLEX
    [?(@.price < 10)]       While RFC 9535 supports filters, they add significant
                            complexity. For input mappings, explicit paths are
                            clearer and more predictable.

Examples
--------

Valid paths:
    "name"
    "user.email"
    "$.user.email"
    "items[0]"
    "items[*].name"
    "data['special-key']"
    "results[0:10]"

Invalid paths:
    "$..name"               # Recursive descent not allowed
    "a | b"                 # Union not allowed
    "foo.@.bar"             # Bare @ not allowed
    "123"                   # Numeric field name not allowed
    "items.0.name"          # Numeric field name not allowed
"""

import re
from typing import Annotated, Any

from jsonpath_ng import JSONPath as JSONPathAST
from jsonpath_ng import parse as parse_jsonpath
from jsonpath_ng.exceptions import (  # type: ignore[import-untyped]
    JsonPathLexerError,
    JsonPathParserError,
)
from jsonpath_ng.jsonpath import (  # type: ignore[import-untyped]
    Child,
    Fields,
    Index,
    Root,
    Slice,
)
from pydantic import AfterValidator

from .db_helper_types import DBBaseModel

# Regex to detect bare @ usage (jsonpath-ng extension, not RFC 9535).
# Matches @ when used as identifier (not inside quotes).
# Examples that should match (reject):  @, $.@, foo.@.bar, $..@
# Examples that should NOT match (allow): $['@'], $["@"]
_BARE_AT_PATTERN = re.compile(
    r"""
    (?:^|[.\[])  # Start of string, dot, or bracket
    @            # The @ symbol
    (?:[.\[]|$)  # Followed by dot, bracket, or end of string
    """,
    re.VERBOSE,
)

# Regex to detect invalid field names in dot notation (not RFC 9535).
# RFC 9535 requires dot-notation identifiers to start with a letter or underscore:
#   member-name-shorthand = name-first *name-char
#   name-first = ALPHA / "_"
# Examples that should match (reject):  .123, field.0, items.0.bar, 123, 123.foo
# Examples that should NOT match (allow): ['123'], field[0], a1.b2, _foo, $, ..name
_INVALID_IDENTIFIER_PATTERN = re.compile(
    r"""
    (?:^|\.)       # Start of string or after a dot
    (?!\.)         # NOT followed by another dot (let AST catch recursive descent)
    (?![a-zA-Z_])  # NOT followed by letter or underscore (negative lookahead)
    (?!\$)         # NOT the root marker $
    (?!\[)         # NOT a bracket (which starts bracket notation)
    (?!`)          # NOT a backtick (let AST catch `this`)
    .              # Match the invalid character
    """,
    re.VERBOSE,
)

# Allowlist of AST node types for a restricted path syntax.
# This limits the feature set to simple, well-understood path expressions,
# avoiding complex features that could cause confusion or unexpected behavior.
#
# Allowed features:
#   - Root ($) - optional
#   - Child (.field)
#   - Fields (field names)
#   - Index ([n] or [-n])
#   - Slice ([start:end:step], also used for wildcard [*])
#
# NOT allowed:
#   - Descendants (..) - too complex
_ALLOWED_JSONPATH_NODES = (
    Root,
    Child,
    Fields,
    Index,
    Slice,
)


def _walk_jsonpath_ast(node: JSONPathAST) -> None:
    """Recursively walk AST and raise if node type is not in allowlist.

    The jsonpath-ng AST uses a binary tree structure where composite paths
    like 'foo.bar' are represented as:

        Child(left=Fields('foo'), right=Fields('bar'))

    Node types fall into two categories:
      - Leaf nodes (Fields, Index, Slice): no children to recurse into
      - Binary nodes (Child): have 'left' and 'right' subtrees
    """
    if not isinstance(node, _ALLOWED_JSONPATH_NODES):
        raise ValueError(f"JSONPath feature '{type(node).__name__}' is not supported")

    # Child nodes have left/right subtrees that must also be validated.
    if isinstance(node, Child):
        _walk_jsonpath_ast(node.left)
        _walk_jsonpath_ast(node.right)


def validate_jsonpath(value: str) -> str:
    """Validate path expression using a restricted feature set.

    Allowed:
      - Root marker: $ (optional)
      - Dot notation: field.nested or $.field.nested
      - Bracket notation: ['field'], ['123'], ['@']
      - Index access: field[0], field[-1]
      - Wildcard: field[*]
      - Slices: field[0:5], field[::2]

    Not allowed:
      - '..' recursive descent
      - Bare '@' (use ['@'] instead)
      - Invalid identifiers in dot notation (must start with letter or underscore)
    """
    if not value:
        raise ValueError("JSONPath cannot be empty")
    if len(value) > 1000:
        raise ValueError("JSONPath exceeds maximum length of 1000 characters")

    # Reject bare @ usage (jsonpath-ng parses this as a field name, but it's
    # not RFC 9535 compliant). Bracket notation like ['@'] is still allowed.
    if _BARE_AT_PATTERN.search(value):
        raise ValueError(
            "Bare '@' is not supported. Use bracket notation ['@'] for fields named '@'"
        )

    # Reject invalid identifiers in dot notation (not RFC 9535 compliant).
    # RFC 9535 requires identifiers to start with a letter or underscore.
    if _INVALID_IDENTIFIER_PATTERN.search(value):
        raise ValueError(
            "Field names in dot notation must start with a letter or underscore. "
            "Use bracket notation like ['123'] for other field names"
        )

    try:
        ast = parse_jsonpath(value)
    except (JsonPathLexerError, JsonPathParserError) as e:
        raise ValueError(f"Invalid JSONPath syntax: {e}")

    _walk_jsonpath_ast(ast)

    return value


JSONPath = Annotated[str, AfterValidator(validate_jsonpath)]


class InputMapping(DBBaseModel):
    literal_mapping: dict[str, Any]
    path_mapping: dict[str, JSONPath]
