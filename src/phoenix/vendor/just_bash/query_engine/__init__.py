"""Query engine for jq-style expressions.

A shared module that powers jq, yq, and xan commands with consistent
jq-style filtering, used by AI agents needing structured data manipulation.

Public API:
    parse(expr: str) -> AstNode: Parse a jq expression into an AST
    evaluate(value: Any, ast: AstNode, ctx: EvalContext | None) -> list[Any]: Evaluate AST
    EvalContext: Execution context with variables, limits, and environment
"""

from .evaluator import evaluate
from .parser import parse
from .tokenizer import tokenize
from .types import (
    ArrayNode,
    AstNode,
    BinaryOpNode,
    CallNode,
    CommaNode,
    CondNode,
    EvalContext,
    FieldNode,
    ForeachNode,
    IdentityNode,
    IndexNode,
    IterateNode,
    LiteralNode,
    ObjectNode,
    OptionalNode,
    ParenNode,
    PipeNode,
    QueryExecutionLimits,
    RecurseNode,
    ReduceNode,
    SliceNode,
    StringInterpNode,
    Token,
    TokenType,
    TryNode,
    UnaryOpNode,
    UpdateOpNode,
    VarBindNode,
    VarRefNode,
)

__all__ = [
    # Core functions
    "parse",
    "evaluate",
    "tokenize",
    # Types
    "TokenType",
    "Token",
    "AstNode",
    "EvalContext",
    "QueryExecutionLimits",
    # AST nodes
    "IdentityNode",
    "FieldNode",
    "IndexNode",
    "SliceNode",
    "IterateNode",
    "PipeNode",
    "CommaNode",
    "LiteralNode",
    "ArrayNode",
    "ObjectNode",
    "ParenNode",
    "BinaryOpNode",
    "UnaryOpNode",
    "CondNode",
    "TryNode",
    "CallNode",
    "VarBindNode",
    "VarRefNode",
    "RecurseNode",
    "OptionalNode",
    "StringInterpNode",
    "UpdateOpNode",
    "ReduceNode",
    "ForeachNode",
]
