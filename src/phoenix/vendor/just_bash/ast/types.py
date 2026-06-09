"""
Abstract Syntax Tree (AST) Types for Bash

This module defines the complete AST structure for bash scripts.
The design follows the actual bash grammar while being Pythonic.

Architecture:
  Input → Lexer → Parser → AST → Expander → Interpreter → Output

Each node type corresponds to a bash construct and can be visited
by the tree-walking interpreter.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Union, Optional

# =============================================================================
# BASE TYPES
# =============================================================================


@dataclass(frozen=True)
class Position:
    """Position information for error reporting."""

    line: int
    column: int
    offset: int


@dataclass(frozen=True)
class Span:
    """Span in source code."""

    start: Position
    end: Position


# =============================================================================
# SCRIPT & STATEMENTS
# =============================================================================


@dataclass(frozen=True)
class ScriptNode:
    """Root node: a complete script."""

    type: Literal["Script"] = field(default="Script", repr=False)
    statements: tuple["StatementNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class StatementNode:
    """A statement is a list of pipelines connected by && or ||."""

    type: Literal["Statement"] = field(default="Statement", repr=False)
    pipelines: tuple["PipelineNode", ...] = ()
    operators: tuple[Literal["&&", "||", ";"], ...] = ()
    background: bool = False
    line: Optional[int] = None


# =============================================================================
# PIPELINES & COMMANDS
# =============================================================================


@dataclass(frozen=True)
class PipelineNode:
    """A pipeline: cmd1 | cmd2 | cmd3."""

    type: Literal["Pipeline"] = field(default="Pipeline", repr=False)
    commands: tuple["CommandNode", ...] = ()
    negated: bool = False
    line: Optional[int] = None
    # Track which pipes are |& (merge stderr): True = |&, False = |
    pipe_amp: tuple[bool, ...] = ()


@dataclass(frozen=True)
class SimpleCommandNode:
    """Simple command: name args... with optional redirections."""

    type: Literal["SimpleCommand"] = field(default="SimpleCommand", repr=False)
    assignments: tuple["AssignmentNode", ...] = ()
    name: Optional["WordNode"] = None
    args: tuple["WordNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


# Forward declarations for compound commands
@dataclass(frozen=True)
class IfNode:
    """if statement."""

    type: Literal["If"] = field(default="If", repr=False)
    clauses: tuple["IfClause", ...] = ()
    else_body: Optional[tuple["StatementNode", ...]] = None
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class IfClause:
    """A single if/elif clause."""

    condition: tuple["StatementNode", ...] = ()
    body: tuple["StatementNode", ...] = ()


@dataclass(frozen=True)
class ForNode:
    """for loop: for VAR in WORDS; do ...; done."""

    type: Literal["For"] = field(default="For", repr=False)
    variable: str = ""
    words: Optional[tuple["WordNode", ...]] = None  # None = "$@"
    body: tuple["StatementNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class CStyleForNode:
    """C-style for loop: for ((init; cond; step)); do ...; done."""

    type: Literal["CStyleFor"] = field(default="CStyleFor", repr=False)
    init: Optional["ArithmeticExpressionNode"] = None
    condition: Optional["ArithmeticExpressionNode"] = None
    update: Optional["ArithmeticExpressionNode"] = None
    body: tuple["StatementNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class WhileNode:
    """while loop."""

    type: Literal["While"] = field(default="While", repr=False)
    condition: tuple["StatementNode", ...] = ()
    body: tuple["StatementNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class UntilNode:
    """until loop."""

    type: Literal["Until"] = field(default="Until", repr=False)
    condition: tuple["StatementNode", ...] = ()
    body: tuple["StatementNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class CaseNode:
    """case statement."""

    type: Literal["Case"] = field(default="Case", repr=False)
    word: Optional["WordNode"] = None
    items: tuple["CaseItemNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class CaseItemNode:
    """A single case item with patterns and body."""

    type: Literal["CaseItem"] = field(default="CaseItem", repr=False)
    patterns: tuple["WordNode", ...] = ()
    body: tuple["StatementNode", ...] = ()
    terminator: Literal[";;", ";&", ";;&"] = ";;"
    line: Optional[int] = None


@dataclass(frozen=True)
class SubshellNode:
    """Subshell: ( ... )."""

    type: Literal["Subshell"] = field(default="Subshell", repr=False)
    body: tuple["StatementNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class GroupNode:
    """Command group: { ...; }."""

    type: Literal["Group"] = field(default="Group", repr=False)
    body: tuple["StatementNode", ...] = ()
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithmeticCommandNode:
    """Arithmetic command: (( expr ))."""

    type: Literal["ArithmeticCommand"] = field(default="ArithmeticCommand", repr=False)
    expression: Optional["ArithmeticExpressionNode"] = None
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class ConditionalCommandNode:
    """Conditional command: [[ expr ]]."""

    type: Literal["ConditionalCommand"] = field(default="ConditionalCommand", repr=False)
    expression: Optional["ConditionalExpressionNode"] = None
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


# Union of all compound commands
CompoundCommandNode = Union[
    IfNode,
    ForNode,
    CStyleForNode,
    WhileNode,
    UntilNode,
    CaseNode,
    SubshellNode,
    GroupNode,
    ArithmeticCommandNode,
    ConditionalCommandNode,
]


# =============================================================================
# FUNCTIONS
# =============================================================================


@dataclass(frozen=True)
class FunctionDefNode:
    """Function definition."""

    type: Literal["FunctionDef"] = field(default="FunctionDef", repr=False)
    name: str = ""
    body: Optional[CompoundCommandNode] = None
    redirections: tuple["RedirectionNode", ...] = ()
    line: Optional[int] = None


# Union of all command types
CommandNode = Union[SimpleCommandNode, CompoundCommandNode, FunctionDefNode]


# =============================================================================
# ASSIGNMENTS
# =============================================================================


@dataclass(frozen=True)
class AssignmentNode:
    """Variable assignment: VAR=value or VAR+=value."""

    type: Literal["Assignment"] = field(default="Assignment", repr=False)
    name: str = ""
    value: Optional["WordNode"] = None
    append: bool = False
    array: Optional[tuple["WordNode", ...]] = None
    line: Optional[int] = None


# =============================================================================
# REDIRECTIONS
# =============================================================================

RedirectionOperator = Literal[
    "<",  # Input
    ">",  # Output (truncate)
    ">>",  # Output (append)
    ">&",  # Duplicate output fd
    "<&",  # Duplicate input fd
    "<>",  # Open for read/write
    ">|",  # Output (clobber)
    "&>",  # Redirect stdout and stderr
    "&>>",  # Append stdout and stderr
    "<<<",  # Here-string
    "<<",  # Here-document
    "<<-",  # Here-document (strip tabs)
]


@dataclass(frozen=True)
class HereDocNode:
    """Here document."""

    type: Literal["HereDoc"] = field(default="HereDoc", repr=False)
    delimiter: str = ""
    content: Optional["WordNode"] = None
    strip_tabs: bool = False
    quoted: bool = False
    line: Optional[int] = None


@dataclass(frozen=True)
class RedirectionNode:
    """I/O redirection."""

    type: Literal["Redirection"] = field(default="Redirection", repr=False)
    fd: Optional[int] = None
    operator: RedirectionOperator = "<"
    target: Union["WordNode", HereDocNode, None] = None
    line: Optional[int] = None


# =============================================================================
# WORDS (the heart of shell parsing)
# =============================================================================


@dataclass(frozen=True)
class LiteralPart:
    """Literal text (no special meaning)."""

    type: Literal["Literal"] = field(default="Literal", repr=False)
    value: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class SingleQuotedPart:
    """Single-quoted string: 'literal'."""

    type: Literal["SingleQuoted"] = field(default="SingleQuoted", repr=False)
    value: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class EscapedPart:
    """Escaped character: \\x."""

    type: Literal["Escaped"] = field(default="Escaped", repr=False)
    value: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class GlobPart:
    """Glob pattern part (expanded during pathname expansion)."""

    type: Literal["Glob"] = field(default="Glob", repr=False)
    pattern: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class TildeExpansionPart:
    """Tilde expansion: ~ or ~user."""

    type: Literal["TildeExpansion"] = field(default="TildeExpansion", repr=False)
    user: Optional[str] = None  # None = current user
    line: Optional[int] = None


# =============================================================================
# PARAMETER EXPANSION
# =============================================================================


@dataclass(frozen=True)
class DefaultValueOp:
    """${VAR:-default} or ${VAR-default}."""

    type: Literal["DefaultValue"] = field(default="DefaultValue", repr=False)
    word: Optional["WordNode"] = None
    check_empty: bool = False  # : present = check empty too


@dataclass(frozen=True)
class AssignDefaultOp:
    """${VAR:=default} or ${VAR=default}."""

    type: Literal["AssignDefault"] = field(default="AssignDefault", repr=False)
    word: Optional["WordNode"] = None
    check_empty: bool = False


@dataclass(frozen=True)
class ErrorIfUnsetOp:
    """${VAR:?error} or ${VAR?error}."""

    type: Literal["ErrorIfUnset"] = field(default="ErrorIfUnset", repr=False)
    word: Optional["WordNode"] = None
    check_empty: bool = False


@dataclass(frozen=True)
class UseAlternativeOp:
    """${VAR:+alternative} or ${VAR+alternative}."""

    type: Literal["UseAlternative"] = field(default="UseAlternative", repr=False)
    word: Optional["WordNode"] = None
    check_empty: bool = False


@dataclass(frozen=True)
class LengthOp:
    """${#VAR}."""

    type: Literal["Length"] = field(default="Length", repr=False)


@dataclass(frozen=True)
class LengthSliceErrorOp:
    """${#VAR:...} - invalid syntax, length cannot have substring."""

    type: Literal["LengthSliceError"] = field(default="LengthSliceError", repr=False)


@dataclass(frozen=True)
class SubstringOp:
    """${VAR:offset} or ${VAR:offset:length}."""

    type: Literal["Substring"] = field(default="Substring", repr=False)
    offset: Optional["ArithmeticExpressionNode"] = None
    length: Optional["ArithmeticExpressionNode"] = None
    # Raw strings for arithmetic evaluation (handles $var, expressions, etc.)
    offset_str: Optional[str] = None
    length_str: Optional[str] = None


@dataclass(frozen=True)
class PatternRemovalOp:
    """${VAR#pattern}, ${VAR##pattern}, ${VAR%pattern}, ${VAR%%pattern}."""

    type: Literal["PatternRemoval"] = field(default="PatternRemoval", repr=False)
    pattern: Optional["WordNode"] = None
    side: Literal["prefix", "suffix"] = "prefix"
    greedy: bool = False


@dataclass(frozen=True)
class PatternReplacementOp:
    """${VAR/pattern/replacement} or ${VAR//pattern/replacement}."""

    type: Literal["PatternReplacement"] = field(default="PatternReplacement", repr=False)
    pattern: Optional["WordNode"] = None
    replacement: Optional["WordNode"] = None
    all: bool = False
    anchor: Optional[Literal["start", "end"]] = None


@dataclass(frozen=True)
class CaseModificationOp:
    """${VAR^}, ${VAR^^}, ${VAR,}, ${VAR,,}."""

    type: Literal["CaseModification"] = field(default="CaseModification", repr=False)
    direction: Literal["upper", "lower"] = "upper"
    all: bool = False
    pattern: Optional["WordNode"] = None


@dataclass(frozen=True)
class TransformOp:
    """${var@Q}, ${var@P}, etc. - parameter transformation."""

    type: Literal["Transform"] = field(default="Transform", repr=False)
    operator: Literal["Q", "P", "a", "A", "E", "K"] = "Q"


@dataclass(frozen=True)
class IndirectionOp:
    """${!VAR} - indirect expansion."""

    type: Literal["Indirection"] = field(default="Indirection", repr=False)


@dataclass(frozen=True)
class ArrayKeysOp:
    """${!arr[@]} or ${!arr[*]} - array keys/indices."""

    type: Literal["ArrayKeys"] = field(default="ArrayKeys", repr=False)
    array: str = ""
    star: bool = False  # True if [*] was used instead of [@]


@dataclass(frozen=True)
class VarNamePrefixOp:
    """${!prefix*} or ${!prefix@} - list variable names with prefix."""

    type: Literal["VarNamePrefix"] = field(default="VarNamePrefix", repr=False)
    prefix: str = ""
    star: bool = False  # True if * was used instead of @


# Union of all parameter operations
ParameterOperation = Union[
    DefaultValueOp,
    AssignDefaultOp,
    ErrorIfUnsetOp,
    UseAlternativeOp,
    LengthOp,
    LengthSliceErrorOp,
    SubstringOp,
    PatternRemovalOp,
    PatternReplacementOp,
    CaseModificationOp,
    TransformOp,
    IndirectionOp,
    ArrayKeysOp,
    VarNamePrefixOp,
]


@dataclass(frozen=True)
class ParameterExpansionPart:
    """Parameter/variable expansion: $VAR or ${VAR...}."""

    type: Literal["ParameterExpansion"] = field(default="ParameterExpansion", repr=False)
    parameter: str = ""
    operation: Optional[ParameterOperation] = None
    line: Optional[int] = None


# =============================================================================
# COMMAND SUBSTITUTION
# =============================================================================


@dataclass(frozen=True)
class CommandSubstitutionPart:
    """Command substitution: $(cmd) or `cmd`."""

    type: Literal["CommandSubstitution"] = field(default="CommandSubstitution", repr=False)
    body: Optional[ScriptNode] = None
    legacy: bool = False  # True for backtick syntax
    line: Optional[int] = None


# =============================================================================
# ARITHMETIC
# =============================================================================


@dataclass(frozen=True)
class ArithNumberNode:
    """Numeric literal."""

    type: Literal["ArithNumber"] = field(default="ArithNumber", repr=False)
    value: int = 0
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithVariableNode:
    """Variable reference in arithmetic context."""

    type: Literal["ArithVariable"] = field(default="ArithVariable", repr=False)
    name: str = ""
    line: Optional[int] = None


ArithBinaryOperator = Literal[
    "+", "-", "*", "/", "%", "**",
    "<<", ">>",
    "<", "<=", ">", ">=", "==", "!=",
    "&", "|", "^",
    "&&", "||",
    ",",
]


@dataclass(frozen=True)
class ArithBinaryNode:
    """Binary arithmetic operation."""

    type: Literal["ArithBinary"] = field(default="ArithBinary", repr=False)
    operator: ArithBinaryOperator = "+"
    left: Optional["ArithExpr"] = None
    right: Optional["ArithExpr"] = None
    line: Optional[int] = None


ArithUnaryOperator = Literal["-", "+", "!", "~", "++", "--"]


@dataclass(frozen=True)
class ArithUnaryNode:
    """Unary arithmetic operation."""

    type: Literal["ArithUnary"] = field(default="ArithUnary", repr=False)
    operator: ArithUnaryOperator = "-"
    operand: Optional["ArithExpr"] = None
    prefix: bool = True
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithTernaryNode:
    """Ternary conditional: cond ? a : b."""

    type: Literal["ArithTernary"] = field(default="ArithTernary", repr=False)
    condition: Optional["ArithExpr"] = None
    consequent: Optional["ArithExpr"] = None
    alternate: Optional["ArithExpr"] = None
    line: Optional[int] = None


ArithAssignmentOperator = Literal[
    "=", "+=", "-=", "*=", "/=", "%=",
    "<<=", ">>=", "&=", "|=", "^=",
]


@dataclass(frozen=True)
class ArithAssignmentNode:
    """Arithmetic assignment."""

    type: Literal["ArithAssignment"] = field(default="ArithAssignment", repr=False)
    operator: ArithAssignmentOperator = "="
    variable: str = ""
    subscript: Optional["ArithExpr"] = None
    string_key: Optional[str] = None  # For associative arrays
    value: Optional["ArithExpr"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithGroupNode:
    """Parenthesized arithmetic expression."""

    type: Literal["ArithGroup"] = field(default="ArithGroup", repr=False)
    expression: Optional["ArithExpr"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithNestedNode:
    """Nested arithmetic expansion within arithmetic context: $((expr))."""

    type: Literal["ArithNested"] = field(default="ArithNested", repr=False)
    expression: Optional["ArithExpr"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithCommandSubstNode:
    """Command substitution within arithmetic context: $(cmd) or `cmd`."""

    type: Literal["ArithCommandSubst"] = field(default="ArithCommandSubst", repr=False)
    command: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithBracedExpansionNode:
    """Braced expansion in arithmetic: ${...}."""

    type: Literal["ArithBracedExpansion"] = field(default="ArithBracedExpansion", repr=False)
    content: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithDynamicBaseNode:
    """Dynamic base constant: ${base}#value."""

    type: Literal["ArithDynamicBase"] = field(default="ArithDynamicBase", repr=False)
    base_expr: str = ""
    value: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithDynamicNumberNode:
    """Dynamic number prefix: ${zero}11 or ${zero}xAB."""

    type: Literal["ArithDynamicNumber"] = field(default="ArithDynamicNumber", repr=False)
    prefix: str = ""
    suffix: str = ""
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithConcatNode:
    """Concatenation of parts forming a single numeric value."""

    type: Literal["ArithConcat"] = field(default="ArithConcat", repr=False)
    parts: tuple["ArithExpr", ...] = ()
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithArrayElementNode:
    """Array element access in arithmetic context."""

    type: Literal["ArithArrayElement"] = field(default="ArithArrayElement", repr=False)
    array: str = ""
    index: Optional["ArithExpr"] = None
    string_key: Optional[str] = None  # For associative arrays
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithDoubleSubscriptNode:
    """Invalid double subscript node (e.g., a[1][1])."""

    type: Literal["ArithDoubleSubscript"] = field(default="ArithDoubleSubscript", repr=False)
    array: str = ""
    index: Optional["ArithExpr"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithNumberSubscriptNode:
    """Invalid number subscript node (e.g., 1[2])."""

    type: Literal["ArithNumberSubscript"] = field(default="ArithNumberSubscript", repr=False)
    number: str = ""
    error_token: str = ""
    line: Optional[int] = None


# Union of all arithmetic expressions
ArithExpr = Union[
    ArithNumberNode,
    ArithVariableNode,
    ArithBinaryNode,
    ArithUnaryNode,
    ArithTernaryNode,
    ArithAssignmentNode,
    ArithGroupNode,
    ArithNestedNode,
    ArithCommandSubstNode,
    ArithBracedExpansionNode,
    ArithDynamicBaseNode,
    ArithDynamicNumberNode,
    ArithConcatNode,
    ArithArrayElementNode,
    ArithDoubleSubscriptNode,
    ArithNumberSubscriptNode,
]


@dataclass(frozen=True)
class ArithmeticExpressionNode:
    """Arithmetic expression wrapper (for $((...)) and ((...)))."""

    type: Literal["ArithmeticExpression"] = field(default="ArithmeticExpression", repr=False)
    expression: Optional[ArithExpr] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class ArithmeticExpansionPart:
    """Arithmetic expansion: $((expr))."""

    type: Literal["ArithmeticExpansion"] = field(default="ArithmeticExpansion", repr=False)
    expression: Optional[ArithmeticExpressionNode] = None
    line: Optional[int] = None


# =============================================================================
# PROCESS SUBSTITUTION
# =============================================================================


@dataclass(frozen=True)
class ProcessSubstitutionPart:
    """Process substitution: <(cmd) or >(cmd)."""

    type: Literal["ProcessSubstitution"] = field(default="ProcessSubstitution", repr=False)
    body: Optional[ScriptNode] = None
    direction: Literal["input", "output"] = "input"  # <(...) vs >(...)
    line: Optional[int] = None


# =============================================================================
# BRACE EXPANSION
# =============================================================================


@dataclass(frozen=True)
class BraceWordItem:
    """A word item in brace expansion: {a,b,c}."""

    type: Literal["Word"] = field(default="Word", repr=False)
    word: Optional["WordNode"] = None


@dataclass(frozen=True)
class BraceRangeItem:
    """A range item in brace expansion: {1..10}."""

    type: Literal["Range"] = field(default="Range", repr=False)
    start: Union[str, int] = ""
    end: Union[str, int] = ""
    step: Optional[int] = None
    start_str: Optional[str] = None  # For zero-padding
    end_str: Optional[str] = None


BraceItem = Union[BraceWordItem, BraceRangeItem]


@dataclass(frozen=True)
class BraceExpansionPart:
    """Brace expansion: {a,b,c} or {1..10}."""

    type: Literal["BraceExpansion"] = field(default="BraceExpansion", repr=False)
    items: tuple[BraceItem, ...] = ()
    line: Optional[int] = None


# =============================================================================
# DOUBLE QUOTED (must be defined after all parts it can contain)
# =============================================================================


@dataclass(frozen=True)
class DoubleQuotedPart:
    """Double-quoted string: "with $expansion"."""

    type: Literal["DoubleQuoted"] = field(default="DoubleQuoted", repr=False)
    parts: tuple["WordPart", ...] = ()
    line: Optional[int] = None


# Union of all word parts
WordPart = Union[
    LiteralPart,
    SingleQuotedPart,
    DoubleQuotedPart,
    EscapedPart,
    ParameterExpansionPart,
    CommandSubstitutionPart,
    ArithmeticExpansionPart,
    ProcessSubstitutionPart,
    BraceExpansionPart,
    TildeExpansionPart,
    GlobPart,
]


@dataclass(frozen=True)
class WordNode:
    """
    A Word is a sequence of parts that form a single shell word.
    After expansion, it may produce zero, one, or multiple strings.
    """

    type: Literal["Word"] = field(default="Word", repr=False)
    parts: tuple[WordPart, ...] = ()
    line: Optional[int] = None


# =============================================================================
# CONDITIONAL EXPRESSIONS (for [[ ]])
# =============================================================================

CondBinaryOperator = Literal[
    "=", "==", "!=", "=~",
    "<", ">",
    "-eq", "-ne", "-lt", "-le", "-gt", "-ge",
    "-nt", "-ot", "-ef",
]


@dataclass(frozen=True)
class CondBinaryNode:
    """Binary conditional expression."""

    type: Literal["CondBinary"] = field(default="CondBinary", repr=False)
    operator: CondBinaryOperator = "="
    left: Optional[WordNode] = None
    right: Optional[WordNode] = None
    line: Optional[int] = None


CondUnaryOperator = Literal[
    "-a", "-b", "-c", "-d", "-e", "-f", "-g", "-h", "-k", "-p",
    "-r", "-s", "-t", "-u", "-w", "-x",
    "-G", "-L", "-N", "-O", "-S",
    "-z", "-n", "-o", "-v", "-R",
]


@dataclass(frozen=True)
class CondUnaryNode:
    """Unary conditional expression."""

    type: Literal["CondUnary"] = field(default="CondUnary", repr=False)
    operator: CondUnaryOperator = "-e"
    operand: Optional[WordNode] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class CondNotNode:
    """Negated conditional expression."""

    type: Literal["CondNot"] = field(default="CondNot", repr=False)
    operand: Optional["ConditionalExpressionNode"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class CondAndNode:
    """AND conditional expression."""

    type: Literal["CondAnd"] = field(default="CondAnd", repr=False)
    left: Optional["ConditionalExpressionNode"] = None
    right: Optional["ConditionalExpressionNode"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class CondOrNode:
    """OR conditional expression."""

    type: Literal["CondOr"] = field(default="CondOr", repr=False)
    left: Optional["ConditionalExpressionNode"] = None
    right: Optional["ConditionalExpressionNode"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class CondGroupNode:
    """Grouped conditional expression."""

    type: Literal["CondGroup"] = field(default="CondGroup", repr=False)
    expression: Optional["ConditionalExpressionNode"] = None
    line: Optional[int] = None


@dataclass(frozen=True)
class CondWordNode:
    """Word in conditional context."""

    type: Literal["CondWord"] = field(default="CondWord", repr=False)
    word: Optional[WordNode] = None
    line: Optional[int] = None


# Union of all conditional expressions
ConditionalExpressionNode = Union[
    CondBinaryNode,
    CondUnaryNode,
    CondNotNode,
    CondAndNode,
    CondOrNode,
    CondGroupNode,
    CondWordNode,
]
