"""Type definitions for the query engine.

Contains TokenType enum, Token dataclass, and all AST node dataclasses.
"""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Union


class TokenType(Enum):
    """Token types for the jq expression lexer."""

    # Structural
    DOT = auto()
    PIPE = auto()
    COMMA = auto()
    COLON = auto()
    SEMICOLON = auto()
    LPAREN = auto()
    RPAREN = auto()
    LBRACKET = auto()
    RBRACKET = auto()
    LBRACE = auto()
    RBRACE = auto()
    QUESTION = auto()

    # Arithmetic
    PLUS = auto()
    MINUS = auto()
    STAR = auto()
    SLASH = auto()
    PERCENT = auto()

    # Comparison
    EQ = auto()  # ==
    NE = auto()  # !=
    LT = auto()  # <
    LE = auto()  # <=
    GT = auto()  # >
    GE = auto()  # >=

    # Logical
    AND = auto()  # and
    OR = auto()  # or
    NOT = auto()  # not

    # Alternative
    ALT = auto()  # //

    # Assignment
    ASSIGN = auto()  # =

    # Update operators
    UPDATE_ADD = auto()  # +=
    UPDATE_SUB = auto()  # -=
    UPDATE_MUL = auto()  # *=
    UPDATE_DIV = auto()  # /=
    UPDATE_MOD = auto()  # %=
    UPDATE_ALT = auto()  # //=
    UPDATE_PIPE = auto()  # |=

    # Values
    IDENT = auto()
    NUMBER = auto()
    STRING = auto()

    # Keywords
    IF = auto()
    THEN = auto()
    ELIF = auto()
    ELSE = auto()
    END = auto()
    AS = auto()
    TRY = auto()
    CATCH = auto()
    TRUE = auto()
    FALSE = auto()
    NULL = auto()
    REDUCE = auto()
    FOREACH = auto()
    DEF = auto()
    LABEL = auto()
    BREAK = auto()

    # Special
    DOTDOT = auto()  # ..
    EOF = auto()


@dataclass
class Token:
    """A lexer token."""

    type: TokenType
    value: str | int | float | None = None
    pos: int = 0


@dataclass
class QueryExecutionLimits:
    """Execution limits to prevent runaway queries."""

    max_iterations: int = 10000


@dataclass
class FuncDef:
    """A user-defined function."""

    name: str
    args: list[str]  # parameter names
    body: "AstNode"


@dataclass
class EvalContext:
    """Evaluation context with variables, limits, and environment."""

    vars: dict[str, Any] = field(default_factory=dict)
    limits: QueryExecutionLimits = field(default_factory=QueryExecutionLimits)
    env: dict[str, str] = field(default_factory=dict)
    root: Any = None
    current_path: list[str | int] = field(default_factory=list)
    funcs: dict[str, "FuncDef"] = field(default_factory=dict)


# AST Node Types
@dataclass
class IdentityNode:
    """The identity filter (.)"""

    type: str = field(default="Identity", init=False)


@dataclass
class FieldNode:
    """Field access (.name)"""

    name: str
    base: "AstNode | None" = None
    type: str = field(default="Field", init=False)


@dataclass
class IndexNode:
    """Array/object index access (.[n] or .["key"])"""

    index: "AstNode"
    base: "AstNode | None" = None
    type: str = field(default="Index", init=False)


@dataclass
class SliceNode:
    """Array slice (.[start:end])"""

    start: "AstNode | None" = None
    end: "AstNode | None" = None
    base: "AstNode | None" = None
    type: str = field(default="Slice", init=False)


@dataclass
class IterateNode:
    """Iterator (.[] or .[])"""

    base: "AstNode | None" = None
    type: str = field(default="Iterate", init=False)


@dataclass
class PipeNode:
    """Pipe operator (|)"""

    left: "AstNode"
    right: "AstNode"
    type: str = field(default="Pipe", init=False)


@dataclass
class CommaNode:
    """Comma operator for multiple outputs"""

    left: "AstNode"
    right: "AstNode"
    type: str = field(default="Comma", init=False)


@dataclass
class LiteralNode:
    """Literal value (number, string, true, false, null)"""

    value: Any
    type: str = field(default="Literal", init=False)


@dataclass
class ArrayNode:
    """Array construction ([...])"""

    elements: "AstNode | None" = None
    type: str = field(default="Array", init=False)


@dataclass
class ObjectEntry:
    """A single object entry with key and value."""

    key: "AstNode | str"
    value: "AstNode"


@dataclass
class ObjectNode:
    """Object construction ({...})"""

    entries: list[ObjectEntry] = field(default_factory=list)
    type: str = field(default="Object", init=False)


@dataclass
class ParenNode:
    """Parenthesized expression"""

    expr: "AstNode"
    type: str = field(default="Paren", init=False)


@dataclass
class BinaryOpNode:
    """Binary operation (+, -, *, /, %, ==, !=, <, <=, >, >=, and, or, //)"""

    op: str  # "+", "-", "*", "/", "%", "==", "!=", "<", "<=", ">", ">=", "and", "or", "//"
    left: "AstNode"
    right: "AstNode"
    type: str = field(default="BinaryOp", init=False)


@dataclass
class UnaryOpNode:
    """Unary operation (- or not)"""

    op: str  # "-" or "not"
    operand: "AstNode"
    type: str = field(default="UnaryOp", init=False)


@dataclass
class ElifBranch:
    """An elif branch in a conditional."""

    cond: "AstNode"
    then: "AstNode"


@dataclass
class CondNode:
    """Conditional (if-then-elif-else-end)"""

    cond: "AstNode"
    then: "AstNode"
    elifs: list[ElifBranch] = field(default_factory=list)
    else_: "AstNode | None" = None
    type: str = field(default="Cond", init=False)


@dataclass
class TryNode:
    """Try-catch expression"""

    body: "AstNode"
    catch: "AstNode | None" = None
    type: str = field(default="Try", init=False)


@dataclass
class CallNode:
    """Function call"""

    name: str
    args: list["AstNode"] = field(default_factory=list)
    type: str = field(default="Call", init=False)


@dataclass
class VarBindNode:
    """Variable binding (expr as $var | body) or destructuring (expr as [$a,$b] | body)"""

    name: "str | ArrayDestructure | ObjectDestructure"
    value: "AstNode"
    body: "AstNode"
    alt_patterns: "list[str | ArrayDestructure | ObjectDestructure]" = field(default_factory=list)
    type: str = field(default="VarBind", init=False)


@dataclass
class VarRefNode:
    """Variable reference ($var)"""

    name: str
    type: str = field(default="VarRef", init=False)


@dataclass
class RecurseNode:
    """Recursive descent (..)"""

    type: str = field(default="Recurse", init=False)


@dataclass
class OptionalNode:
    """Optional operator (?)"""

    expr: "AstNode"
    type: str = field(default="Optional", init=False)


@dataclass
class StringInterpNode:
    """String with interpolation"""

    parts: list["str | AstNode"] = field(default_factory=list)
    type: str = field(default="StringInterp", init=False)


@dataclass
class UpdateOpNode:
    """Update operation (=, |=, +=, -=, *=, /=, %=, //=)"""

    op: str  # "=", "|=", "+=", "-=", "*=", "/=", "%=", "//="
    path: "AstNode"
    value: "AstNode"
    type: str = field(default="UpdateOp", init=False)


@dataclass
class DefNode:
    """Function definition (def name: body; rest)"""

    name: str
    args: list[str]  # parameter names (without $)
    body: "AstNode"
    rest: "AstNode"
    type: str = field(default="Def", init=False)


@dataclass
class LabelNode:
    """Label expression (label $name | body)"""

    name: str
    body: "AstNode"
    type: str = field(default="Label", init=False)


@dataclass
class BreakNode:
    """Break expression (break $name)"""

    name: str
    type: str = field(default="Break", init=False)


# Destructuring pattern types
@dataclass
class ArrayDestructure:
    """Array destructuring pattern [$a, $b, ...]"""

    elements: list["DestructurePattern"]
    type: str = field(default="ArrayDestructure", init=False)


@dataclass
class ObjectDestructure:
    """Object destructuring pattern {key: $var, ...}"""

    entries: list[tuple[str, "DestructurePattern"]]
    type: str = field(default="ObjectDestructure", init=False)


# A pattern is either a simple variable name or a destructuring pattern
DestructurePattern = Union[str, ArrayDestructure, ObjectDestructure]


@dataclass
class ReduceNode:
    """Reduce expression"""

    expr: "AstNode"
    var_name: "str | ArrayDestructure | ObjectDestructure"
    init: "AstNode"
    update: "AstNode"
    type: str = field(default="Reduce", init=False)


@dataclass
class ForeachNode:
    """Foreach expression"""

    expr: "AstNode"
    var_name: "str | ArrayDestructure | ObjectDestructure"
    init: "AstNode"
    update: "AstNode"
    extract: "AstNode | None" = None
    type: str = field(default="Foreach", init=False)


# Union type for all AST nodes
AstNode = Union[
    IdentityNode,
    FieldNode,
    IndexNode,
    SliceNode,
    IterateNode,
    PipeNode,
    CommaNode,
    LiteralNode,
    ArrayNode,
    ObjectNode,
    ParenNode,
    BinaryOpNode,
    UnaryOpNode,
    CondNode,
    TryNode,
    CallNode,
    VarBindNode,
    VarRefNode,
    RecurseNode,
    OptionalNode,
    StringInterpNode,
    UpdateOpNode,
    ReduceNode,
    ForeachNode,
    DefNode,
    LabelNode,
    BreakNode,
    ArrayDestructure,
    ObjectDestructure,
]


class JqError(Exception):
    """Error raised by jq error() function, carrying the error value."""

    def __init__(self, value: Any):
        self.value = value
        super().__init__(str(value))
