import ast
import inspect
import sys
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import (
    Any,
    Dict,
    Iterable,
    Iterator,
    Mapping,
    Optional,
    Protocol,
    Sequence,
    Tuple,
    cast,
)

from openinference.semconv import trace
from typing_extensions import TypeGuard

import phoenix.trace.v1 as pb
from phoenix.trace.dsl.missing import MISSING
from phoenix.trace.schemas import COMPUTED_PREFIX, ComputedAttributes, Span, SpanID

_VALID_EVAL_ATTRIBUTES: Tuple[str, ...] = tuple(
    field.name for field in pb.Evaluation.Result.DESCRIPTOR.fields
)


class SupportsGetSpanEvaluation(Protocol):
    def get_span_evaluation(self, span_id: SpanID, name: str) -> Optional[pb.Evaluation]:
        ...


@dataclass(frozen=True)
class SpanFilter:
    condition: str = ""
    evals: Optional[SupportsGetSpanEvaluation] = None
    valid_eval_names: Optional[Sequence[str]] = None
    translated: ast.Expression = field(init=False, repr=False)
    compiled: Any = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        condition = self.condition or "True"  # default to no op
        root = ast.parse(condition, mode="eval")
        if self.condition:
            _validate_expression(root, condition, valid_eval_names=self.valid_eval_names)
        translated = _Translator(condition).visit(root)
        ast.fix_missing_locations(translated)
        compiled = compile(translated, filename="", mode="eval")
        object.__setattr__(self, "translated", translated)
        object.__setattr__(self, "compiled", compiled)
        object.__setattr__(self, "evals", self.evals or MISSING)

    def __call__(self, span: Span) -> bool:
        return cast(
            bool,
            eval(
                self.compiled,
                {"span": span, "_MISSING": MISSING, "evals": self.evals},
            ),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {"condition": self.condition}

    @classmethod
    def from_dict(
        cls,
        obj: Mapping[str, Any],
        evals: Optional[SupportsGetSpanEvaluation] = None,
        valid_eval_names: Optional[Sequence[str]] = None,
    ) -> "SpanFilter":
        return cls(
            condition=obj.get("condition") or "",
            evals=evals,
            valid_eval_names=valid_eval_names,
        )


def _replace_none_with_missing(
    value: ast.expr,
    as_str: bool = False,
) -> ast.IfExp:
    """
    E.g. `value` becomes
    `_MISSING if (_VALUE := value) is None else _VALUE`
    """
    _store_VALUE = ast.Name(id="_VALUE", ctx=ast.Store())
    _load_VALUE = ast.Name(id="_VALUE", ctx=ast.Load())
    return ast.IfExp(
        test=ast.Compare(
            left=ast.NamedExpr(target=_store_VALUE, value=value),
            ops=[ast.Is()],
            comparators=[ast.Constant(value=None)],
        ),
        body=ast.Name(id="_MISSING", ctx=ast.Load()),
        orelse=_as_str(_load_VALUE) if as_str else _load_VALUE,
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

    for field_name in (
        getattr(klass, attr)
        for name in dir(trace)
        if name.endswith("Attributes") and inspect.isclass(klass := getattr(trace, name))
        for attr in dir(klass)
        if attr.isupper()
    ):
        source_segment = field_name
        ast_replacement = _ast_replacement(f"span.attributes.get('{field_name}')")
        yield source_segment, ast_replacement
        yield "attributes." + source_segment, ast_replacement
        yield "span.attributes." + source_segment, ast_replacement

    for computed_attribute in ComputedAttributes:
        field_name = computed_attribute.value
        source_segment = field_name[len(COMPUTED_PREFIX) :]
        ast_replacement = _ast_replacement(f"span.attributes.get('{field_name}')")
        yield source_segment, ast_replacement


class _Translator(ast.NodeTransformer):
    _allowed_fields: Mapping[str, ast.expr] = dict(_allowed_replacements())

    def __init__(self, source: str) -> None:
        # Regarding the need for `source: str` for getting source segments:
        # In Python 3.8, we have to use `ast.get_source_segment(source, node)`.
        # In Python 3.9+, we can use `ast.unparse(node)` (no need for `source`).
        self._source = source

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        if _is_eval(node.value) and (eval_name := _get_eval_name(node.value)):
            # e.g. `evals["name"].score`
            return _ast_evaluation_result_value(eval_name, node.attr)
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


def _validate_expression(
    expression: ast.Expression,
    source: str,
    valid_eval_names: Optional[Sequence[str]] = None,
    valid_eval_attributes: Tuple[str, ...] = _VALID_EVAL_ATTRIBUTES,
) -> None:
    """
    Validate primarily the structural (i.e. not semantic) characteristics of an
    expression, e.g. function calls are not allowed. Note that the separation
    between structural and semantic validation is a matter of convenience and is
    not meant to be strict. Some validations such as that for the evaluation name
    may be considered semantic but is placed here because it's convenient, and
    additional exceptions may be raised later by the NodeTransformer regarding
    either structural and semantic issues.
    """
    # Regarding the need for `source: str` for getting source segments:
    # In Python 3.8, we have to use `ast.get_source_segment(source, node)`.
    # In Python 3.9+, we can use `ast.unparse(node)` (no need for `source`).
    if not isinstance(expression, ast.Expression):
        raise SyntaxError(f"invalid expression: {source}")  # TODO: add details
    for i, node in enumerate(ast.walk(expression.body)):
        if i == 0:
            if isinstance(node, (ast.BoolOp, ast.Compare)):
                continue
        elif _is_eval(node):
            # e.g. `evals["name"]`
            if not (eval_name := _get_eval_name(node)) or (
                valid_eval_names is not None and eval_name not in valid_eval_names
            ):
                source_segment = cast(str, ast.get_source_segment(source, node))
                if eval_name and valid_eval_names:
                    # suggest a valid eval name most similar to the one given
                    choice, score = _find_best_match(eval_name, valid_eval_names)
                    if choice and score > 0.75:  # arbitrary threshold
                        raise SyntaxError(
                            f"invalid eval name `{eval_name}` in `{source_segment}`"
                            + f', did you mean "{choice}"?'
                        )
                expected = _disjunction([f'"{name}"' for name in valid_eval_names or ()])
                raise SyntaxError(
                    f"invalid eval name `{eval_name}` in `{source_segment}`"
                    + f", expected {expected}"
                    if expected
                    else ""
                )
            continue
        elif isinstance(node, ast.Attribute) and _is_eval(node.value):
            # e.g. `evals["name"].score`
            if (attr := node.attr) not in valid_eval_attributes:
                source_segment = cast(str, ast.get_source_segment(source, node))
                # suggest a valid attribute most similar to the one given
                choice, score = _find_best_match(attr, valid_eval_attributes)
                if choice and score > 0.75:  # arbitrary threshold
                    raise SyntaxError(
                        f"invalid attribute `.{attr}` in `{source_segment}`"
                        + f", did you mean `.{choice}`?"
                    )
                expected = _disjunction([f"`.{attribute}`" for attribute in valid_eval_attributes])
                raise SyntaxError(
                    f"invalid eval attribute `.{attr}` in `{source_segment}`"
                    + f", expected {expected}"
                    if expected
                    else ""
                )
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
                # Prior to Python 3.9, `ast.Index` is part of `ast.Subscript`,
                # so it needs to allowed here, but note that `ast.Subscript` is
                # not allowed in general except in the case of `evals["name"]`.
                # Note that `ast.Index` is deprecated in Python 3.9+.
                *((ast.Index,) if sys.version_info < (3, 9) else ()),
            ),
        ):
            continue
        source_segment = cast(str, ast.get_source_segment(source, node))
        raise SyntaxError(f"invalid expression: {source_segment}")  # TODO: add details


def _ast_evaluation_result_value(name: str, attr: str) -> ast.expr:
    source = (
        f"_RESULT.{attr}.value if ("
        f"    _RESULT := ("
        f"        _MISSING if ("
        f"            _VALUE := evals.get_span_evaluation("
        f"                 span.context.span_id, '{name}'"
        f"            )"
        f"        ) is None "
        f"        else _VALUE"
        f"    ).result"
        f").HasField('{attr}') "
        f"else _MISSING"
    )
    return ast.parse(source, mode="eval").body


def _is_eval(node: Any) -> TypeGuard[ast.Subscript]:
    # e.g. `evals["name"]`
    return (
        isinstance(node, ast.Subscript)
        and isinstance(value := node.value, ast.Name)
        and value.id == "evals"
    )


def _get_eval_name(node: ast.Subscript) -> Optional[str]:
    if sys.version_info < (3, 9):
        # Note that `ast.Index` is deprecated in Python 3.9+, but is necessary
        # for Python 3.8 as part of `ast.Subscript`.
        return (
            eval_name
            if isinstance(node_slice := node.slice, ast.Index)
            and isinstance(slice_value := node_slice.value, ast.Constant)
            and isinstance(eval_name := slice_value.value, str)
            else None
        )
    return (
        eval_name
        if isinstance(node_slice := node.slice, ast.Constant)
        and isinstance(eval_name := node_slice.value, str)
        else None
    )


def _disjunction(choices: Sequence[str]) -> str:
    """
    E.g. `["a", "b", "c"]` becomes `"one of a, b, or c"`
    """
    if len(choices) == 0:
        return ""
    if len(choices) == 1:
        return choices[0]
    if len(choices) == 2:
        return f"{choices[0]} or {choices[1]}"
    return f"one of {', '.join(choices[:-1])}, or {choices[-1]}"


def _find_best_match(source: str, choices: Iterable[str]) -> Tuple[Optional[str], float]:
    best_choice, best_score = None, 0.0
    for choice in choices:
        score = SequenceMatcher(None, source, choice).ratio()
        if score > best_score:
            best_choice, best_score = choice, score
    return best_choice, best_score
