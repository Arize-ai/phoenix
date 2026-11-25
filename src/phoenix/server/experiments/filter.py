"""Compile experiment filter expressions directly to SQLAlchemy predicates."""

import ast
import math
import operator
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import get_close_matches
from typing import Any, Callable, Literal, Optional, cast

from sqlalchemy import BigInteger, ColumnElement, Numeric, and_, func, literal, not_, null, or_
from sqlalchemy.sql.visitors import iterate

from phoenix.db import models
from phoenix.server.experiments.metadata import get_metadata_number, get_metadata_text

_Kind = Literal["text", "number", "datetime", "boolean", "json", "none"]
_KIND_DESCRIPTIONS = {
    "text": "text",
    "number": "a number",
    "datetime": "a timestamp",
    "boolean": "a condition",
    "json": "a metadata value",
    "none": "None",
}
_MAX_CONDITION_LENGTH = 4096
_MAX_EXPRESSION_DEPTH = 64
_MAX_EXPRESSION_NODES = 1000
_MAX_SQL_EXPRESSION_NODES = 10000


@dataclass(frozen=True)
class _Value:
    kind: _Kind
    expression: ColumnElement[Any]

    def as_scalar(self, kind: _Kind) -> "_Value":
        if self.kind != "json":
            return self
        if kind == "number":
            return _Value(kind, get_metadata_number(self.expression))
        if kind == "boolean":
            return _Value(kind, models.SafeJsonBoolean(self.expression))
        return _Value("text", get_metadata_text(self.expression))


_FIELDS = {
    "name": _Value("text", models.Experiment.name.expression),
    "description": _Value("text", models.Experiment.description.expression),
    "project_name": _Value("text", models.Experiment.project_name.expression),
    "repetitions": _Value("number", models.Experiment.repetitions.expression),
    "created_at": _Value("datetime", models.Experiment.created_at.expression),
    "updated_at": _Value("datetime", models.Experiment.updated_at.expression),
}
_COMPARISONS: dict[
    type[ast.cmpop], Callable[[ColumnElement[Any], ColumnElement[Any]], ColumnElement[bool]]
] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}
_ARITHMETIC: dict[
    type[ast.operator], Callable[[ColumnElement[Any], ColumnElement[Any]], ColumnElement[Any]]
] = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul}


def compile_experiment_filter(condition: str) -> Optional[ColumnElement[bool]]:
    """Returns the SQL predicate for a condition, or None for an empty condition.

    Raises:
        SyntaxError: If the expression uses unsupported syntax, fields, or operand types.
    """
    if not condition:
        return None
    if len(condition) > _MAX_CONDITION_LENGTH:
        raise SyntaxError(f"filter condition must be at most {_MAX_CONDITION_LENGTH} characters")
    try:
        source_lines = condition.encode("utf-8").splitlines() if not condition.isascii() else []
        expression = ast.parse(condition, mode="eval")
        pending: list[tuple[ast.AST, int]] = [(expression, 0)]
        node_count = 0
        while pending:
            node, depth = pending.pop()
            node_count += 1
            if depth > _MAX_EXPRESSION_DEPTH or node_count > _MAX_EXPRESSION_NODES:
                raise SyntaxError("filter condition is nested too deeply")
            if source_lines and isinstance(node, ast.Name):
                spelling = source_lines[node.lineno - 1][node.col_offset : node.end_col_offset]
                if spelling.decode("utf-8") != node.id:
                    raise SyntaxError("write experiment field names using their ASCII spelling")
            pending.extend((child, depth + 1) for child in ast.iter_child_nodes(node))
        compiler = _Compiler()
        if not isinstance(expression.body, (ast.Compare, ast.BoolOp, ast.UnaryOp)):
            raise SyntaxError(f"`{ast.unparse(expression.body)}` is not a condition")
        predicate = compiler.predicate(expression.body)
        for index, _ in enumerate(iterate(predicate)):
            if index >= _MAX_SQL_EXPRESSION_NODES:
                raise SyntaxError("filter condition expands to too much SQL")
        return predicate
    except UnicodeEncodeError:
        raise SyntaxError("filter conditions must contain valid UTF-8") from None
    except (RecursionError, MemoryError):
        raise SyntaxError("filter condition is nested too deeply") from None
    except SyntaxError as error:
        raise SyntaxError(error.msg) from None


class _Compiler:
    def predicate(self, node: ast.expr) -> ColumnElement[bool]:
        value = self.value(node)
        self.expect(value, "boolean", node)
        return cast(ColumnElement[bool], value.expression)

    def expect(self, value: _Value, kind: _Kind, node: ast.expr) -> None:
        if value.kind != kind:
            raise SyntaxError(
                f"`{ast.unparse(node)}` is {_KIND_DESCRIPTIONS[value.kind]}, "
                f"expected {_KIND_DESCRIPTIONS[kind]}"
            )

    def value(self, node: ast.expr) -> _Value:
        if isinstance(node, ast.Constant):
            return self.constant(node.value)
        if isinstance(node, ast.Name):
            if node.id in _FIELDS:
                return _FIELDS[node.id]
            suggestions = get_close_matches(node.id, _FIELDS, n=1, cutoff=0.75)
            hint = f', did you mean "{suggestions[0]}"?' if suggestions else ""
            raise SyntaxError(f"invalid name `{node.id}`{hint}")
        if isinstance(node, ast.Subscript):
            return self.metadata(node)
        if isinstance(node, ast.Attribute):
            if ast.unparse(node).startswith("metadata."):
                raise SyntaxError('read experiment metadata as `metadata["key"]`')
            self.value(node.value)
            raise SyntaxError(f"unsupported attribute access: `{ast.unparse(node)}`")
        if isinstance(node, ast.BoolOp):
            combine = and_ if isinstance(node.op, ast.And) else or_
            return _Value("boolean", combine(*(self.predicate(value) for value in node.values)))
        if isinstance(node, ast.Compare):
            operands = [node.left, *node.comparators]
            return _Value(
                "boolean",
                and_(
                    *(
                        self.compare(left, operation, right)
                        for left, operation, right in zip(operands, node.ops, operands[1:])
                    )
                ),
            )
        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.Not):
                return _Value("boolean", not_(self.predicate(node.operand)))
            if isinstance(node.op, (ast.USub, ast.UAdd)):
                if (
                    isinstance(node.operand, ast.Constant)
                    and isinstance(node.operand.value, (int, float))
                    and not isinstance(node.operand.value, bool)
                ):
                    sign = -1 if isinstance(node.op, ast.USub) else 1
                    return self.constant(sign * node.operand.value)
                value = self.value(node.operand)
                self.expect(value, "number", node.operand)
                return _Value(
                    "number",
                    -value.expression.cast(Numeric)
                    if isinstance(node.op, ast.USub)
                    else value.expression,
                )
        if isinstance(node, ast.BinOp):
            return self.arithmetic(node)
        if isinstance(node, ast.Call):
            if (
                isinstance(node.func, ast.Name)
                and node.func.id in ("float", "str")
                and len(node.args) == 1
                and not node.keywords
            ):
                value = self.value(node.args[0])
                self.expect(value, "json", node.args[0])
                return value.as_scalar("number" if node.func.id == "float" else "text")
        raise SyntaxError(f"unsupported experiment filter expression: `{ast.unparse(node)}`")

    def constant(self, value: Any) -> _Value:
        if value is None:
            return _Value("none", null())
        if isinstance(value, bool):
            return _Value("boolean", literal(value))
        if isinstance(value, str):
            if "\x00" in value:
                raise SyntaxError("string literals cannot contain a NUL character")
            try:
                value.encode("utf-8")
            except UnicodeEncodeError:
                raise SyntaxError("string literals must contain valid UTF-8") from None
            return _Value("text", literal(value))
        if isinstance(value, int):
            if not -(2**63) <= value < 2**63:
                raise SyntaxError("integer literals must fit in a signed 64-bit integer")
            return _Value("number", literal(value, type_=BigInteger()))
        if isinstance(value, float) and math.isfinite(value):
            return _Value("number", literal(value))
        raise SyntaxError(f"unsupported experiment filter literal: {value!r}")

    def metadata(self, node: ast.Subscript) -> _Value:
        keys: list[str] = []
        root: ast.expr = node
        while isinstance(root, ast.Subscript):
            if not isinstance(root.slice, ast.Constant) or not isinstance(root.slice.value, str):
                raise SyntaxError('experiment metadata keys must be strings, e.g. `metadata["0"]`')
            self.constant(root.slice.value)
            keys.append(root.slice.value)
            root = root.value
        if isinstance(root, ast.Name) and root.id in ("attributes", "annotations", "evals"):
            raise SyntaxError(f"`{root.id}[...]` is not available in the experiment filter")
        if not isinstance(root, ast.Name) or root.id != "metadata":
            raise SyntaxError('read experiment metadata as `metadata["key"]`')
        return _Value("json", models.Experiment.metadata_[list(reversed(keys))])

    def arithmetic(self, node: ast.BinOp) -> _Value:
        left, right = self.value(node.left), self.value(node.right)
        self.expect(left, "number", node.left)
        self.expect(right, "number", node.right)
        numerator = left.expression.cast(Numeric)
        denominator = right.expression.cast(Numeric)
        if operation := _ARITHMETIC.get(type(node.op)):
            return _Value("number", operation(numerator, denominator))
        if isinstance(node.op, (ast.Div, ast.Mod)):
            # A zero denominator must yield NULL on both databases.
            numeric_denominator = func.nullif(denominator, 0)
            if isinstance(node.op, ast.Div):
                return _Value("number", numerator / numeric_denominator)
            return _Value(
                "number",
                func.mod(
                    func.mod(numerator, numeric_denominator) + numeric_denominator,
                    numeric_denominator,
                ),
            )
        raise SyntaxError("arithmetic is limited to + - * / %")

    def compare(
        self, left_node: ast.expr, operation: ast.cmpop, right_node: ast.expr
    ) -> ColumnElement[bool]:
        left = self.value(left_node)
        if isinstance(operation, (ast.In, ast.NotIn)):
            result = self.membership(left_node, left, right_node)
            return not_(result) if isinstance(operation, ast.NotIn) else result
        right = self.value(right_node)
        if isinstance(operation, (ast.Is, ast.IsNot)) and "none" not in (left.kind, right.kind):
            raise SyntaxError(
                "`is` / `is not` compare against None only; use `==` / `!=` to compare values"
            )
        if "none" in (left.kind, right.kind):
            if not isinstance(operation, (ast.Is, ast.IsNot, ast.Eq, ast.NotEq)):
                raise SyntaxError("use `is None` / `is not None` to check for missing values")
            value = right if left.kind == "none" else left
            expression = value.as_scalar("text").expression
            return (
                expression.is_not(None)
                if isinstance(operation, (ast.IsNot, ast.NotEq))
                else expression.is_(None)
            )
        is_ordering = isinstance(operation, (ast.Lt, ast.LtE, ast.Gt, ast.GtE))
        if left.kind == right.kind == "json":
            kind: _Kind = "number" if is_ordering else "text"
            left, right = left.as_scalar(kind), right.as_scalar(kind)
        elif left.kind == "json":
            left = left.as_scalar(right.kind)
        elif right.kind == "json":
            right = right.as_scalar(left.kind)
        if (
            left.kind == "datetime"
            and isinstance(right_node, ast.Constant)
            and right.kind == "text"
        ):
            right = self.datetime_literal(cast(str, right_node.value))
        if right.kind == "datetime" and isinstance(left_node, ast.Constant) and left.kind == "text":
            left = self.datetime_literal(cast(str, left_node.value))
        if left.kind != right.kind:
            raise SyntaxError(
                f"cannot compare `{ast.unparse(left_node)}` ({_KIND_DESCRIPTIONS[left.kind]}) "
                f"with `{ast.unparse(right_node)}` ({_KIND_DESCRIPTIONS[right.kind]})"
            )
        if is_ordering and left.kind not in ("number", "datetime"):
            raise SyntaxError(f"ordered comparisons cannot compare {_KIND_DESCRIPTIONS[left.kind]}")
        if compare := _COMPARISONS.get(type(operation)):
            if left.kind == "number":
                return compare(left.expression.cast(Numeric), right.expression.cast(Numeric))
            return compare(left.expression, right.expression)
        raise SyntaxError(f"unsupported comparison: `{ast.unparse(operation)}`")

    def membership(
        self, node: ast.expr, needle: _Value, haystack_node: ast.expr
    ) -> ColumnElement[bool]:
        if isinstance(haystack_node, (ast.List, ast.Tuple)):
            if isinstance(node, ast.Constant):
                raise SyntaxError("list membership requires an experiment field on the left")
            values: list[_Value] = []
            for element in haystack_node.elts:
                if not isinstance(element, ast.Constant) and not (
                    isinstance(element, ast.UnaryOp)
                    and isinstance(element.op, (ast.USub, ast.UAdd))
                    and isinstance(element.operand, ast.Constant)
                ):
                    raise SyntaxError("a membership list holds literal values only")
                values.append(self.value(element))
            kinds = {value.kind for value in values}
            if len(kinds) > 1 or "none" in kinds:
                raise SyntaxError(
                    "a membership list must contain one scalar type and cannot contain None"
                )
            kind = values[0].kind if values else needle.kind
            if needle.kind not in ("text", "number", "json"):
                raise SyntaxError("list membership requires text, a number, or a metadata value")
            needle = needle.as_scalar(kind)
            if values and needle.kind != kind:
                raise SyntaxError("membership values must match the field's type")
            if needle.kind == "number":
                return needle.expression.cast(Numeric).in_(
                    [value.expression.cast(Numeric) for value in values]
                )
            return needle.expression.in_([value.expression for value in values])
        haystack = self.value(haystack_node).as_scalar("text")
        self.expect(haystack, "text", haystack_node)
        if not isinstance(node, ast.Constant) or needle.kind != "text":
            raise SyntaxError("text containment requires a string literal on the left")
        return models.CaseInsensitiveContains(haystack.expression, needle.expression)

    def datetime_literal(self, value: str) -> _Value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise SyntaxError(
                    f"datetime literal {value!r} has no timezone, add an offset (e.g. 'Z' for UTC)"
                )
            return _Value("datetime", literal(parsed.astimezone(timezone.utc)))
        except (ValueError, OverflowError):
            raise SyntaxError(
                f"invalid datetime literal {value!r}; use ISO 8601 with a timezone"
            ) from None
