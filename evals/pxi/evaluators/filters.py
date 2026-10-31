"""Decode static filter scripts and compare predicate structure without executing code."""

from __future__ import annotations

import ast
import re

_STRING = r"""(?:"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'|`(?:[^`\\]|\\.)*`)"""
_IDENTIFIER = r"[A-Za-z_$][\w$]*"
_COMMENT_OR_STRING = re.compile(rf"({_STRING})|//[^\n]*|/\*[\s\S]*?\*/")
_BINDING = re.compile(rf"\s*const\s+({_IDENTIFIER})\s*=\s*({_STRING})\s*;")
_CALL = re.compile(
    rf"\s*(?:const\s+(?P<result>{_IDENTIFIER})\s*=\s*|return\s+)?"
    rf"(?:await\s+)?ui\.spansFilter\.set\s*\(\s*\{{\s*"
    rf"(?:condition|\"condition\"|'condition')\s*(?::\s*(?P<value>{_STRING}|{_IDENTIFIER}))?"
    rf"\s*,?\s*\}}\s*\)\s*;?\s*(?P<tail>[\s\S]*)"
)


def _decode_string(source: str) -> str:
    if source.startswith("`") and "${" in source:
        raise ValueError("Interpolated templates are not static")
    escapes = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "v": "\v"}

    def decode(match: re.Match[str]) -> str:
        escape = match.group(1)
        if escape.startswith(("u", "x")):
            return chr(int(escape[1:], 16))
        if escape in escapes:
            return escapes[escape]
        if escape in "\\/'\"`":
            return escape
        raise ValueError("Unsupported JavaScript escape")

    return re.sub(r"\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])", decode, source[1:-1])


def static_filter_condition(script: str) -> str | None:
    """Read a literal or const-bound condition from one straight-line filter call.

    Comments, quote styles, const string bindings, and a UIResult return guard
    after the call are supported. Conditional calls, interpolation, reassignment,
    and multiple calls fail closed. This deliberately
    does not implement a JavaScript runtime or infer values from source substrings.
    """
    if len(script) > 32_768:
        return None
    source = _COMMENT_OR_STRING.sub(lambda match: match.group(1) or " ", script)
    bindings: dict[str, str] = {}
    try:
        while match := _BINDING.match(source):
            name, value = match.groups()
            if name in bindings or name == "ui":
                return None
            bindings[name] = _decode_string(value)
            source = source[match.end() :]
        call = _CALL.fullmatch(source)
        if call is None:
            return None
        result = call["result"]
        if result in bindings or result == "ui":
            return None
        tail = call["tail"].strip()
        if tail:
            if result is None:
                return None
            result_name = re.escape(result)
            # A common wrapper returns a failed UIResult, otherwise the condition.
            # Both branches follow the unconditional operation; neither adds calls.
            return_value = rf"(?:{result_name}|\{{\s*condition\s*:\s*{_STRING}\s*,?\s*\}})"
            tail_pattern = (
                rf"(?:if\s*\(\s*!{result_name}\.ok\s*\)\s*return\s+{result_name}\s*;\s*)?"
                rf"return\s+{return_value}\s*;?"
            )
            if re.fullmatch(tail_pattern, tail) is None:
                return None
        if call["value"] is None and re.search(r"[\"']condition[\"']", source):
            return None
        value = call["value"] or "condition"
        return _decode_string(value) if value[0] in "'\"`" else bindings.get(value)
    except ValueError:
        return None


class _CanonicalPredicate(ast.NodeTransformer):
    def visit_Compare(self, node: ast.Compare) -> ast.AST:
        visited = self.generic_visit(node)
        assert isinstance(visited, ast.Compare)
        node = visited
        if (
            len(node.ops) == 1
            and isinstance(node.ops[0], ast.In)
            and isinstance(node.comparators[0], (ast.List, ast.Tuple, ast.Set))
            and node.comparators[0].elts
            and all(isinstance(item, ast.Constant) for item in node.comparators[0].elts)
        ):
            expanded = self.visit(
                ast.BoolOp(
                    op=ast.Or(),
                    values=[
                        ast.Compare(left=node.left, ops=[ast.Eq()], comparators=[item])
                        for item in node.comparators[0].elts
                    ],
                )
            )
            assert isinstance(expanded, ast.AST)
            return expanded
        return node

    def visit_BoolOp(self, node: ast.BoolOp) -> ast.AST:
        values: list[ast.expr] = []
        for value in node.values:
            value = self.visit(value)
            if isinstance(value, ast.BoolOp) and type(value.op) is type(node.op):
                values.extend(value.values)
            else:
                values.append(value)
        unique = {ast.dump(value): value for value in values}
        ordered = [unique[key] for key in sorted(unique)]
        return ordered[0] if len(ordered) == 1 else ast.BoolOp(op=node.op, values=ordered)


def _predicate_key(condition: str) -> str:
    if len(condition) > 16_384:
        raise ValueError("Filter exceeds parser limit")
    if not condition.strip():
        return ""
    tree = ast.parse(condition.strip(), mode="eval")
    if sum(1 for _ in ast.walk(tree)) > 512:
        raise ValueError("Filter exceeds AST limit")
    return ast.dump(_CanonicalPredicate().visit(tree), include_attributes=False)


def filter_matches(script: str, expected: str) -> bool:
    """Compare decoded DSL ASTs, allowing clause order and literal membership lists."""
    condition = static_filter_condition(script)
    if condition is None:
        return False
    try:
        return _predicate_key(condition) == _predicate_key(expected)
    except (SyntaxError, ValueError, RecursionError):
        return False
