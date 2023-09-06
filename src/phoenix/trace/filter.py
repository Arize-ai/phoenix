import ast
from typing import Any, Iterator, Mapping, Tuple, cast

from phoenix.trace import semantic_conventions
from phoenix.trace.schemas import Span


class Filter:
    def __init__(self, condition: str) -> None:
        self._root = ast.parse(condition, mode="eval")
        _validate_expression(self._root, condition)
        self._translated = _Translator(condition).visit(self._root)
        ast.fix_missing_locations(self._translated)
        self._compiled = compile(self._translated, filename="", mode="eval")

    def __call__(self, span: Span) -> bool:
        return cast(bool, eval(self._compiled, {}, {"span": span, "_MISSING": _Missing()}))


def _replace_none_with_missing(
    value: ast.expr,
    as_str: bool = False,
) -> ast.IfExp:
    """E.g. `value` becomes
    `_MISSING if (_MAYBE := value) is None else _MAYBE`
    """
    _store_MAYBE = ast.Name(id="_MAYBE", ctx=ast.Store())
    _load_MAYBE = ast.Name(id="_MAYBE", ctx=ast.Load())
    return ast.IfExp(
        test=ast.Compare(
            left=ast.NamedExpr(target=_store_MAYBE, value=value),
            ops=[ast.Is()],
            comparators=[ast.Constant(value=None)],
        ),
        body=ast.Name(id="_MISSING", ctx=ast.Load()),
        orelse=_as_str(_load_MAYBE) if as_str else _load_MAYBE,
    )


def _as_str(value: ast.expr) -> ast.Call:
    """E.g. `value` becomes `str(value)`"""
    return ast.Call(func=ast.Name(id="str", ctx=ast.Load()), args=[value], keywords=[])


def _ast_replacement(expression: str) -> ast.expr:
    as_str = expression in (
        "span.status_code",
        "span.span_kind",
        "span.parent_id",
        "span.context.span_id",
        "span.context.trace_id",
    )
    return _replace_none_with_missing(ast.parse(expression, mode="eval").body, as_str)


def _allowed_replacements() -> Iterator[Tuple[str, ast.expr]]:
    for source_segment, ast_replacement in {
        "name": _ast_replacement("span.name"),
        "status_code": _ast_replacement("span.status_code"),
        "span_kind": _ast_replacement("span.span_kind"),
        "parent_id": _ast_replacement("span.parent_id"),
    }.items():
        yield source_segment, ast_replacement
        yield "span." + source_segment, ast_replacement
    for source_segment, ast_replacement in {
        "span_id": _ast_replacement("span.context.span_id"),
        "trace_id": _ast_replacement("span.context.trace_id"),
    }.items():
        yield source_segment, ast_replacement
        yield "context." + source_segment, ast_replacement
        yield "span.context." + source_segment, ast_replacement
    for source_segment, ast_replacement in {
        field_name: _ast_replacement(f"span.attributes.get('{field_name}')")
        for field_name in (
            getattr(semantic_conventions, variable_name)
            for variable_name in dir(semantic_conventions)
            if variable_name.isupper()
            and variable_name.startswith(("RETRIEVAL", "EMBEDDING", "LLM", "TOOL"))
        )
    }.items():
        yield source_segment, ast_replacement
        yield "attributes." + source_segment, ast_replacement
        yield "span.attributes." + source_segment, ast_replacement


class _Translator(ast.NodeTransformer):
    _allowed_fields: Mapping[str, ast.expr] = dict(_allowed_replacements())

    def __init__(self, source: str) -> None:
        # In Python 3.8, we have to use `ast.get_source_segment(source, node)`.
        # In Python 3.9, we can use `ast.unparse(node)` instead.
        self._source = source

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        source_segment: str = cast(str, ast.get_source_segment(self._source, node))
        if replacement := self._allowed_fields.get(source_segment):
            return replacement
        raise SyntaxError(f"invalid expression: {source_segment}")  # TODO: add details

    def visit_Name(self, node: ast.Name) -> Any:
        source_segment: str = cast(str, ast.get_source_segment(self._source, node))
        if replacement := self._allowed_fields.get(source_segment):
            return replacement
        raise SyntaxError(f"invalid expression: {source_segment}")  # TODO: add details

    def visit_Constant(self, node: ast.Constant) -> Any:
        return ast.Name(id="_MISSING", ctx=ast.Load()) if node.value is None else node


def _validate_expression(expression: ast.Expression, source: str) -> None:
    # In Python 3.8, we have to use `ast.get_source_segment(source, node)`.
    # In Python 3.9, we can use `ast.unparse(node)` instead.
    if not isinstance(expression, ast.Expression):
        raise SyntaxError(f"invalid expression: {source}")  # TODO: add details
    for i, node in enumerate(ast.walk(expression.body)):
        if i == 0:
            if isinstance(node, (ast.BoolOp, ast.Compare)):
                continue
        elif isinstance(
            node,
            (
                ast.Attribute,
                ast.BinOp,
                ast.BoolOp,
                ast.Compare,
                ast.Constant,
                ast.Load,
                ast.Name,
                ast.Tuple,
                ast.List,
                ast.UnaryOp,
                ast.boolop,
                ast.cmpop,
                ast.operator,
                ast.unaryop,
            ),
        ):
            continue
        source_segment: str = cast(str, ast.get_source_segment(source, node))
        raise SyntaxError(f"invalid expression: {source_segment}")  # TODO: add details


class _Missing:
    """Falsifies all comparisons except those with self."""

    def __lt__(self, other: Any) -> bool:
        return False

    def __le__(self, other: Any) -> bool:
        return False

    def __gt__(self, other: Any) -> bool:
        return False

    def __ge__(self, other: Any) -> bool:
        return False

    def __eq__(self, other: Any) -> bool:
        return isinstance(other, _Missing)

    def __ne__(self, other: Any) -> bool:
        return False

    def __len__(self) -> int:
        return 0

    def __iter__(self) -> Any:
        return self

    def __next__(self) -> Any:
        raise StopIteration()

    def __contains__(self, item: Any) -> bool:
        return False

    def __str__(self) -> str:
        return ""

    def __float__(self) -> float:
        return float("nan")
