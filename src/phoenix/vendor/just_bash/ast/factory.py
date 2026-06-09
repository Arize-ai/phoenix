"""
AST Factory Functions

Convenience functions for building AST nodes, matching the TypeScript AST object pattern.
"""

from typing import Optional, Sequence

from .types import (
    # Core nodes
    ScriptNode,
    StatementNode,
    PipelineNode,
    SimpleCommandNode,
    WordNode,
    WordPart,
    AssignmentNode,
    RedirectionNode,
    RedirectionOperator,
    HereDocNode,
    # Word parts
    LiteralPart,
    SingleQuotedPart,
    DoubleQuotedPart,
    EscapedPart,
    ParameterExpansionPart,
    ParameterOperation,
    CommandSubstitutionPart,
    ArithmeticExpansionPart,
    ArithmeticExpressionNode,
    # Control flow
    IfNode,
    IfClause,
    ForNode,
    WhileNode,
    UntilNode,
    CaseNode,
    CaseItemNode,
    SubshellNode,
    GroupNode,
    FunctionDefNode,
    ConditionalCommandNode,
    ArithmeticCommandNode,
    CompoundCommandNode,
    ConditionalExpressionNode,
)


def script(statements: Sequence[StatementNode]) -> ScriptNode:
    """Create a script node."""
    return ScriptNode(statements=tuple(statements))


def statement(
    pipelines: Sequence[PipelineNode],
    operators: Sequence[str] | None = None,
    background: bool = False,
) -> StatementNode:
    """Create a statement node."""
    ops = tuple(operators) if operators else ()
    return StatementNode(
        pipelines=tuple(pipelines),
        operators=ops,  # type: ignore
        background=background,
    )


def pipeline(
    commands: Sequence["CommandNode"],  # type: ignore
    negated: bool = False,
    pipe_amp: tuple[bool, ...] = (),
) -> PipelineNode:
    """Create a pipeline node."""
    return PipelineNode(commands=tuple(commands), negated=negated, pipe_amp=pipe_amp)


def simple_command(
    name: WordNode | None = None,
    args: Sequence[WordNode] | None = None,
    assignments: Sequence[AssignmentNode] | None = None,
    redirections: Sequence[RedirectionNode] | None = None,
    line: int | None = None,
) -> SimpleCommandNode:
    """Create a simple command node."""
    return SimpleCommandNode(
        name=name,
        args=tuple(args) if args else (),
        assignments=tuple(assignments) if assignments else (),
        redirections=tuple(redirections) if redirections else (),
        line=line,
    )


def word(parts: Sequence[WordPart]) -> WordNode:
    """Create a word node."""
    return WordNode(parts=tuple(parts))


def literal(value: str) -> LiteralPart:
    """Create a literal part."""
    return LiteralPart(value=value)


def single_quoted(value: str) -> SingleQuotedPart:
    """Create a single-quoted part."""
    return SingleQuotedPart(value=value)


def double_quoted(parts: Sequence[WordPart]) -> DoubleQuotedPart:
    """Create a double-quoted part."""
    return DoubleQuotedPart(parts=tuple(parts))


def escaped(value: str) -> EscapedPart:
    """Create an escaped character part."""
    return EscapedPart(value=value)


def parameter_expansion(
    parameter: str,
    operation: ParameterOperation | None = None,
) -> ParameterExpansionPart:
    """Create a parameter expansion part."""
    return ParameterExpansionPart(parameter=parameter, operation=operation)


def command_substitution(
    body: ScriptNode,
    legacy: bool = False,
) -> CommandSubstitutionPart:
    """Create a command substitution part."""
    return CommandSubstitutionPart(body=body, legacy=legacy)


def arithmetic_expansion(
    expression: ArithmeticExpressionNode,
) -> ArithmeticExpansionPart:
    """Create an arithmetic expansion part."""
    return ArithmeticExpansionPart(expression=expression)


def assignment(
    name: str,
    value: WordNode | None = None,
    append: bool = False,
    array: Sequence[WordNode] | None = None,
) -> AssignmentNode:
    """Create an assignment node."""
    return AssignmentNode(
        name=name,
        value=value,
        append=append,
        array=tuple(array) if array else None,
    )


def redirection(
    operator: RedirectionOperator,
    target: WordNode | HereDocNode,
    fd: int | None = None,
) -> RedirectionNode:
    """Create a redirection node."""
    return RedirectionNode(fd=fd, operator=operator, target=target)


def here_doc(
    delimiter: str,
    content: WordNode,
    strip_tabs: bool = False,
    quoted: bool = False,
) -> HereDocNode:
    """Create a here-document node."""
    return HereDocNode(
        delimiter=delimiter,
        content=content,
        strip_tabs=strip_tabs,
        quoted=quoted,
    )


def if_node(
    clauses: Sequence[IfClause],
    else_body: Sequence[StatementNode] | None = None,
    redirections: Sequence[RedirectionNode] | None = None,
) -> IfNode:
    """Create an if node."""
    return IfNode(
        clauses=tuple(clauses),
        else_body=tuple(else_body) if else_body else None,
        redirections=tuple(redirections) if redirections else (),
    )


def if_clause(
    condition: Sequence[StatementNode],
    body: Sequence[StatementNode],
) -> IfClause:
    """Create an if clause."""
    return IfClause(condition=tuple(condition), body=tuple(body))


def for_node(
    variable: str,
    words: Sequence[WordNode] | None,
    body: Sequence[StatementNode],
    redirections: Sequence[RedirectionNode] | None = None,
) -> ForNode:
    """Create a for node."""
    return ForNode(
        variable=variable,
        words=tuple(words) if words is not None else None,
        body=tuple(body),
        redirections=tuple(redirections) if redirections else (),
    )


def while_node(
    condition: Sequence[StatementNode],
    body: Sequence[StatementNode],
    redirections: Sequence[RedirectionNode] | None = None,
) -> WhileNode:
    """Create a while node."""
    return WhileNode(
        condition=tuple(condition),
        body=tuple(body),
        redirections=tuple(redirections) if redirections else (),
    )


def until_node(
    condition: Sequence[StatementNode],
    body: Sequence[StatementNode],
    redirections: Sequence[RedirectionNode] | None = None,
) -> UntilNode:
    """Create an until node."""
    return UntilNode(
        condition=tuple(condition),
        body=tuple(body),
        redirections=tuple(redirections) if redirections else (),
    )


def case_node(
    word: WordNode,
    items: Sequence[CaseItemNode],
    redirections: Sequence[RedirectionNode] | None = None,
) -> CaseNode:
    """Create a case node."""
    return CaseNode(
        word=word,
        items=tuple(items),
        redirections=tuple(redirections) if redirections else (),
    )


def case_item(
    patterns: Sequence[WordNode],
    body: Sequence[StatementNode],
    terminator: str = ";;",
) -> CaseItemNode:
    """Create a case item node."""
    return CaseItemNode(
        patterns=tuple(patterns),
        body=tuple(body),
        terminator=terminator,  # type: ignore
    )


def subshell(
    body: Sequence[StatementNode],
    redirections: Sequence[RedirectionNode] | None = None,
) -> SubshellNode:
    """Create a subshell node."""
    return SubshellNode(
        body=tuple(body),
        redirections=tuple(redirections) if redirections else (),
    )


def group(
    body: Sequence[StatementNode],
    redirections: Sequence[RedirectionNode] | None = None,
) -> GroupNode:
    """Create a command group node."""
    return GroupNode(
        body=tuple(body),
        redirections=tuple(redirections) if redirections else (),
    )


def function_def(
    name: str,
    body: CompoundCommandNode,
    redirections: Sequence[RedirectionNode] | None = None,
) -> FunctionDefNode:
    """Create a function definition node."""
    return FunctionDefNode(
        name=name,
        body=body,
        redirections=tuple(redirections) if redirections else (),
    )


def conditional_command(
    expression: ConditionalExpressionNode,
    redirections: Sequence[RedirectionNode] | None = None,
) -> ConditionalCommandNode:
    """Create a conditional command node ([[ ]])."""
    return ConditionalCommandNode(
        expression=expression,
        redirections=tuple(redirections) if redirections else (),
    )


def arithmetic_command(
    expression: ArithmeticExpressionNode,
    redirections: Sequence[RedirectionNode] | None = None,
) -> ArithmeticCommandNode:
    """Create an arithmetic command node ((( )))."""
    return ArithmeticCommandNode(
        expression=expression,
        redirections=tuple(redirections) if redirections else (),
    )
