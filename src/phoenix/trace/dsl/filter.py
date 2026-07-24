import ast
import sys
import typing
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from itertools import chain
from types import MappingProxyType
from uuid import uuid4

import sqlalchemy
from sqlalchemy import case, literal
from sqlalchemy.orm import aliased
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.expression import ColumnElement, Select
from typing_extensions import TypeAlias, TypeGuard, assert_never

from phoenix.db import models

_VALID_EVAL_ATTRIBUTES: tuple[str, ...] = ("score", "label", "explanation")


AnnotationType: TypeAlias = typing.Literal["annotations", "evals", "trace_annotations"]
AnnotationAttribute: TypeAlias = typing.Literal["explanation", "label", "score"]
AnnotationName: TypeAlias = str
AnnotationRelationKind: TypeAlias = typing.Literal["span", "trace"]
AnnotationModel: TypeAlias = typing.Union[models.SpanAnnotation, models.TraceAnnotation]

_ANNOTATION_ACCESSORS: tuple[AnnotationType, ...] = (
    "trace_annotations",
    "annotations",
    "evals",
)


def _annotation_relation_kind(annotation_type: AnnotationType) -> AnnotationRelationKind:
    return "trace" if annotation_type == "trace_annotations" else "span"


@dataclass(frozen=True)
class AliasedAnnotationRelation:
    """
    Represents an aliased annotation relation (i.e., SQL table), either
    `span_annotation` or `trace_annotation`, depending on `kind`. Used to
    perform joins on span- or trace-level annotations during filtering. An alias
    is required because the annotation table may be joined multiple times for
    different annotation names.
    """

    index: int
    name: str
    kind: AnnotationRelationKind = "span"
    table: AliasedClass[AnnotationModel] = field(init=False, repr=False)
    _explanation_attribute_alias: str = field(init=False, repr=False)
    _label_attribute_alias: str = field(init=False, repr=False)
    _score_attribute_alias: str = field(init=False, repr=False)
    _exists_attribute_alias: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        table_alias = f"{self.kind}_annotation_{self.index}"
        alias_id = uuid4().hex
        explanation_attribute_alias = f"{table_alias}_explanation_{alias_id}"
        label_attribute_alias = f"{table_alias}_label_{alias_id}"
        score_attribute_alias = f"{table_alias}_score_{alias_id}"
        exists_attribute_alias = f"{table_alias}_exists_{alias_id}"

        table = typing.cast(
            AliasedClass[AnnotationModel],
            aliased(
                models.TraceAnnotation if self.kind == "trace" else models.SpanAnnotation,
                name=table_alias,
            ),
        )
        object.__setattr__(self, "_explanation_attribute_alias", explanation_attribute_alias)
        object.__setattr__(self, "_label_attribute_alias", label_attribute_alias)
        object.__setattr__(self, "_score_attribute_alias", score_attribute_alias)
        object.__setattr__(self, "_exists_attribute_alias", exists_attribute_alias)
        object.__setattr__(self, "table", table)

    @property
    def attributes(self) -> typing.Iterator[tuple[str, ColumnElement[typing.Any]]]:
        """
        Alias names and attributes (i.e., columns) of the annotation relation.
        """
        yield self._explanation_attribute_alias, self.table.explanation
        yield self._label_attribute_alias, self.table.label
        yield self._score_attribute_alias, self.table.score
        yield (
            self._exists_attribute_alias,
            case((self.table.id.is_not(None), literal(True)), else_=literal(False)),
        )

    @property
    def existence_alias(self) -> str:
        return self._exists_attribute_alias

    @property
    def string_attribute_aliases(self) -> tuple[str, str]:
        return self._explanation_attribute_alias, self._label_attribute_alias

    def attribute_alias(self, attribute: AnnotationAttribute) -> str:
        """
        Returns an alias for the given attribute (i.e., column).
        """
        if attribute == "explanation":
            return self._explanation_attribute_alias
        if attribute == "label":
            return self._label_attribute_alias
        if attribute == "score":
            return self._score_attribute_alias
        assert_never(attribute)


# Because postgresql is strongly typed, we cast JSON values to string
# by default unless it's hinted otherwise as done here.
_FLOAT_ATTRIBUTES: frozenset[str] = frozenset(
    {
        "llm.token_count.completion",
        "llm.token_count.prompt",
        "llm.token_count.total",
    }
)

_STRING_NAMES: typing.Mapping[str, sqlalchemy.SQLColumnExpression[typing.Any]] = MappingProxyType(
    {
        "span_id": models.Span.span_id,
        "trace_id": models.Trace.trace_id,
        "context.span_id": models.Span.span_id,
        "context.trace_id": models.Trace.trace_id,
        "parent_id": models.Span.parent_id,
        "span_kind": models.Span.span_kind,
        "name": models.Span.name,
        "status_code": models.Span.status_code,
        "status_message": models.Span.status_message,
    }
)
_FLOAT_NAMES: typing.Mapping[str, sqlalchemy.SQLColumnExpression[typing.Any]] = MappingProxyType(
    {
        "latency_ms": models.Span.latency_ms,
        "cumulative_llm_token_count_completion": models.Span.cumulative_llm_token_count_completion,
        "cumulative_llm_token_count_prompt": models.Span.cumulative_llm_token_count_prompt,
        "cumulative_llm_token_count_total": models.Span.cumulative_llm_token_count_total,
    }
)
_DATETIME_NAMES: typing.Mapping[str, sqlalchemy.SQLColumnExpression[typing.Any]] = MappingProxyType(
    {
        "start_time": models.Span.start_time,
        "end_time": models.Span.end_time,
    }
)
_NAMES: typing.Mapping[str, sqlalchemy.SQLColumnExpression[typing.Any]] = MappingProxyType(
    {
        **_STRING_NAMES,
        **_FLOAT_NAMES,
        **_DATETIME_NAMES,
        "attributes": models.Span.attributes,
        "events": models.Span.events,
    }
)
_BACKWARD_COMPATIBILITY_REPLACEMENTS: typing.Mapping[str, str] = MappingProxyType(
    {
        # for backward-compatibility
        "context.span_id": "span_id",
        "context.trace_id": "trace_id",
        "cumulative_token_count.completion": "cumulative_llm_token_count_completion",
        "cumulative_token_count.prompt": "cumulative_llm_token_count_prompt",
        "cumulative_token_count.total": "cumulative_llm_token_count_total",
    }
)


@dataclass(frozen=True)
class SpanFilter:
    condition: str = ""
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    _aliased_annotation_relations: tuple[AliasedAnnotationRelation] = field(init=False, repr=False)
    _aliased_annotation_attributes: dict[str, ColumnElement[typing.Any]] = field(
        init=False, repr=False
    )

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        if not (source := self.condition):
            return
        root = ast.parse(source, mode="eval")
        _validate_expression(root, valid_eval_names=self.valid_eval_names)
        root, aliased_annotation_relations = _apply_annotation_aliasing(root)
        annotation_string_aliases = (
            alias
            for relation in aliased_annotation_relations
            for alias in relation.string_attribute_aliases
        )
        translated = _FilterTranslator(
            reserved_keywords=(
                alias
                for aliased_annotation in aliased_annotation_relations
                for alias, _ in aliased_annotation.attributes
            ),
            string_names=annotation_string_aliases,
        ).visit(root)
        ast.fix_missing_locations(translated)
        compiled = compile(translated, filename="", mode="eval")
        aliased_annotation_attributes = {
            alias: attribute
            for aliased_annotation in aliased_annotation_relations
            for alias, attribute in aliased_annotation.attributes
        }
        object.__setattr__(self, "translated", translated)
        object.__setattr__(self, "compiled", compiled)
        object.__setattr__(self, "_aliased_annotation_relations", aliased_annotation_relations)
        object.__setattr__(self, "_aliased_annotation_attributes", aliased_annotation_attributes)

    def __call__(self, select: Select[typing.Any]) -> Select[typing.Any]:
        if not self.condition:
            return select
        predicate = eval(
            self.compiled,
            {
                "__builtins__": {},
                **_NAMES,
                **self._aliased_annotation_attributes,
                "not_": sqlalchemy.not_,
                "and_": sqlalchemy.and_,
                "or_": sqlalchemy.or_,
                "cast": sqlalchemy.cast,
                "Float": sqlalchemy.Float,
                "String": sqlalchemy.String,
                "TextContains": models.TextContains,
            },
        )
        if not self._aliased_annotation_relations:
            return select.where(predicate)
        return select.where(self._annotation_predicate_exists(predicate))

    def to_dict(self) -> dict[str, typing.Any]:
        return {"condition": self.condition}

    @classmethod
    def from_dict(
        cls,
        obj: typing.Mapping[str, typing.Any],
        valid_eval_names: typing.Optional[typing.Sequence[str]] = None,
    ) -> "SpanFilter":
        return cls(
            condition=obj.get("condition") or "",
            valid_eval_names=valid_eval_names,
        )

    def _annotation_predicate_exists(self, predicate: ColumnElement[bool]) -> ColumnElement[bool]:
        """
        Evaluates annotation predicates in a correlated subquery.

        The one-row seed preserves outer-join semantics for missing annotations.
        Using EXISTS prevents multiple annotations with the same name and different
        identifiers from duplicating spans in the outer query.
        """
        seed = sqlalchemy.select(literal(True).label("seed")).subquery()
        stmt = sqlalchemy.select(literal(True)).select_from(seed)
        for annotation_relation in self._aliased_annotation_relations:
            annotation_name = annotation_relation.name
            aliased_annotation = annotation_relation.table
            if annotation_relation.kind == "trace":
                foreign_key_clause = aliased_annotation.trace_rowid == models.Span.trace_rowid
            else:
                foreign_key_clause = aliased_annotation.span_rowid == models.Span.id
            stmt = stmt.outerjoin(
                aliased_annotation,
                onclause=(
                    sqlalchemy.and_(
                        foreign_key_clause,
                        aliased_annotation.name == annotation_name,
                    )
                ),
            )
        return stmt.where(predicate).correlate(models.Span).exists()


_VALID_PROJECTION_NODE_TYPES: tuple[type, ...] = (
    ast.Expression,
    ast.Attribute,
    ast.Subscript,
    ast.Name,
    ast.Constant,
    ast.List,
    ast.Tuple,
    ast.Load,
)


def _validate_projection_expression(expression: ast.Expression) -> None:
    """
    Reject any AST construct that isn't a simple attribute/subscript lookup.
    Projection keys are paths like ``name``, ``output.value``,
    ``attributes['key']``, or ``attributes[['a','b']]`` — never function calls,
    operators, comprehensions, lambdas, or f-strings.
    """
    if not isinstance(expression, ast.Expression):
        raise SyntaxError(f"invalid projection: {ast.unparse(expression)}")
    for node in ast.walk(expression.body):
        if not isinstance(node, _VALID_PROJECTION_NODE_TYPES):
            raise SyntaxError(f"invalid projection: {ast.unparse(node)}")


@dataclass(frozen=True)
class Projector:
    expression: str
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)

    def __post_init__(self) -> None:
        if not (source := self.expression):
            raise ValueError("missing expression")
        root = ast.parse(source, mode="eval")
        _validate_projection_expression(root)
        translated = _ProjectionTranslator(source).visit(root)
        ast.fix_missing_locations(translated)
        compiled = compile(translated, filename="", mode="eval")
        object.__setattr__(self, "translated", translated)
        object.__setattr__(self, "compiled", compiled)

    def __call__(self) -> sqlalchemy.SQLColumnExpression[typing.Any]:
        return typing.cast(
            sqlalchemy.SQLColumnExpression[typing.Any],
            eval(self.compiled, {"__builtins__": {}, **_NAMES}),
        )


def _is_string_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and isinstance(node.value, str)


def _is_uppercase_enum(node: typing.Any) -> TypeGuard[ast.Name]:
    return isinstance(node, ast.Name) and node.id in ("span_kind", "status_code")


def _convert_to_uppercase(node: ast.expr) -> ast.expr:
    """Converts constants and lists/ tuples of constants to uppercase."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return ast.Constant(value=node.value.upper(), kind=node.kind)
    if isinstance(node, (ast.List, ast.Tuple)):
        new_elts = [_convert_to_uppercase(elt) for elt in node.elts]
        if isinstance(node, ast.List):
            return ast.List(elts=new_elts, ctx=node.ctx)
        if isinstance(node, ast.Tuple):
            return ast.Tuple(elts=new_elts, ctx=node.ctx)
        assert_never(node)
    return node


def _is_float_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return (
        isinstance(node, ast.Constant)
        and isinstance(node.value, typing.SupportsFloat)
        and not isinstance(node.value, bool)
    )


def _is_bool_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and isinstance(node.value, bool)


def _is_string_attribute(node: typing.Any) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Call)
        and isinstance(func := node.func, ast.Attribute)
        and func.attr == "as_string"
        and isinstance(value := func.value, ast.Subscript)
        and isinstance(name := value.value, ast.Name)
        and name.id == "attributes"
    )


def _is_float_attribute(node: typing.Any) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Call)
        and isinstance(func := node.func, ast.Attribute)
        and func.attr == "as_float"
        and isinstance(value := func.value, ast.Subscript)
        and isinstance(name := value.value, ast.Name)
        and name.id == "attributes"
    )


def _as_string_attribute(node: typing.Union[ast.Subscript, ast.Call]) -> ast.Call:
    if isinstance(node, ast.Call):
        value = typing.cast(ast.Attribute, node.func).value
    elif isinstance(node, ast.Subscript):
        value = node
    else:
        assert_never(node)
    return ast.Call(
        func=ast.Attribute(
            value=value,
            attr="as_string",
            ctx=ast.Load(),
        ),
        args=[],
        keywords=[],
    )


def _as_float_attribute(node: typing.Union[ast.Subscript, ast.Call]) -> ast.Call:
    if isinstance(node, ast.Call):
        value = typing.cast(ast.Attribute, node.func).value
    elif isinstance(node, ast.Subscript):
        value = node
    else:
        assert_never(node)
    return ast.Call(
        func=ast.Attribute(
            value=value,
            attr="as_float",
            ctx=ast.Load(),
        ),
        args=[],
        keywords=[],
    )


def _as_bool_attribute(node: typing.Union[ast.Subscript, ast.Call]) -> ast.Call:
    if isinstance(node, ast.Call):
        value = typing.cast(ast.Attribute, node.func).value
    elif isinstance(node, ast.Subscript):
        value = node
    else:
        assert_never(node)
    return ast.Call(
        func=ast.Attribute(
            value=value,
            attr="as_boolean",
            ctx=ast.Load(),
        ),
        args=[],
        keywords=[],
    )


def _is_cast(
    node: typing.Any,
    type_: typing.Optional[typing.Literal["Float", "String"]] = None,
) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Call)
        and isinstance(func := node.func, ast.Name)
        and func.id == "cast"
        and len(node.args) == 2
        and isinstance(name := node.args[1], ast.Name)
        and (not type_ or name.id == type_)
    )


def _remove_cast(node: typing.Any) -> typing.Any:
    return node.args[0] if _is_cast(node) else node


def _cast_as(
    type_: typing.Literal["Float", "String"],
    node: typing.Any,
) -> ast.Call:
    if type_ == "Float" and (_is_subscript(node, "attributes") or _is_string_attribute(node)):
        return _as_float_attribute(node)
    if type_ == "String" and (_is_subscript(node, "attributes") or _is_float_attribute(node)):
        return _as_string_attribute(node)
    return ast.Call(
        func=ast.Name(id="cast", ctx=ast.Load()),
        args=[
            _remove_cast(node),
            ast.Name(id=type_, ctx=ast.Load()),
        ],
        keywords=[],
    )


def _is_string(node: typing.Any) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Name)
        and node.id in _STRING_NAMES
        or _is_cast(node, "String")
        or _is_string_constant(node)
        or _is_string_attribute(node)
        or isinstance(node, (ast.List, ast.Tuple))
        and len(node.elts) > 0
        and _is_string(node.elts[0])
    )


def _is_float(node: typing.Any) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Name)
        and node.id in _FLOAT_NAMES
        or _is_cast(node, "Float")
        or _is_float_constant(node)
        or _is_float_attribute(node)
        or isinstance(node, (ast.List, ast.Tuple))
        and len(node.elts) > 0
        and _is_float(node.elts[0])
        or isinstance(node, ast.BinOp)
        and (not isinstance(node.op, ast.Add) or (_is_float(node.left) or _is_float(node.right)))
        or isinstance(node, ast.UnaryOp)
        and isinstance(node.op, (ast.USub, ast.UAdd))
    )


class _ProjectionTranslator(ast.NodeTransformer):
    def __init__(self, reserved_keywords: typing.Iterable[str] = ()) -> None:
        self._reserved_keywords = frozenset(
            chain(
                reserved_keywords,
                _STRING_NAMES.keys(),
                _FLOAT_NAMES.keys(),
                _DATETIME_NAMES.keys(),
            )
        )

    def visit_generic(self, node: ast.AST) -> typing.Any:
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")

    def visit_Expression(self, node: ast.Expression) -> typing.Any:
        return ast.Expression(body=self.visit(node.body))

    def visit_Attribute(self, node: ast.Attribute) -> typing.Any:
        source_segment = ast.unparse(node)
        if replacement := _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(source_segment):
            return ast.Name(id=replacement, ctx=ast.Load())
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {source_segment}")

    def visit_Name(self, node: ast.Name) -> typing.Any:
        source_segment = ast.unparse(node)
        if source_segment in self._reserved_keywords:
            return node
        name = source_segment
        return _as_attribute([ast.Constant(value=name, kind=None)])

    def visit_Subscript(self, node: ast.Subscript) -> typing.Any:
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")


class _FilterTranslator(_ProjectionTranslator):
    def __init__(
        self,
        reserved_keywords: typing.Iterable[str] = (),
        string_names: typing.Iterable[str] = (),
    ) -> None:
        super().__init__(reserved_keywords)
        self._string_names = frozenset(chain(_STRING_NAMES, string_names))

    def visit_Compare(self, node: ast.Compare) -> typing.Any:
        if len(node.comparators) > 1:
            args: list[typing.Any] = []
            left = node.left
            for i, (op, comparator) in enumerate(zip(node.ops, node.comparators)):
                args.append(self.visit(ast.Compare(left=left, ops=[op], comparators=[comparator])))
                left = comparator
            return ast.Call(func=ast.Name(id="and_", ctx=ast.Load()), args=args, keywords=[])
        left, op, right = self.visit(node.left), node.ops[0], self.visit(node.comparators[0])
        if _is_uppercase_enum(left):
            right = _convert_to_uppercase(right)
        elif _is_uppercase_enum(right):
            left = _convert_to_uppercase(left)
        if _is_subscript(left, "attributes"):
            left = (
                _as_bool_attribute(left) if _is_bool_constant(right) else _cast_as("String", left)
            )
        if _is_subscript(right, "attributes"):
            right = (
                _as_bool_attribute(right) if _is_bool_constant(left) else _cast_as("String", right)
            )
        if _is_float(left) and not _is_float(right):
            right = _cast_as("Float", right)
        elif not _is_float(left) and _is_float(right):
            left = _cast_as("Float", left)
        if isinstance(op, (ast.In, ast.NotIn)):
            if _is_string_attribute(right) or ast.unparse(right) in self._string_names:
                call = ast.Call(
                    func=ast.Name(id="TextContains", ctx=ast.Load()),
                    args=[right, left],
                    keywords=[],
                )
                if isinstance(op, ast.NotIn):
                    call = ast.Call(
                        func=ast.Name(id="not_", ctx=ast.Load()), args=[call], keywords=[]
                    )
                return call
            elif isinstance(right, (ast.List, ast.Tuple)):
                attr = "in_" if isinstance(op, ast.In) else "not_in"
                return ast.Call(
                    func=ast.Attribute(value=left, attr=attr, ctx=ast.Load()),
                    args=[right],
                    keywords=[],
                )
            else:
                raise SyntaxError(f"invalid expression: {ast.unparse(op)}")
        if isinstance(op, ast.Is):
            op = ast.Eq()
        elif isinstance(op, ast.IsNot):
            op = ast.NotEq()
        return ast.Compare(left=left, ops=[op], comparators=[right])

    def visit_BoolOp(self, node: ast.BoolOp) -> typing.Any:
        if isinstance(node.op, ast.And):
            func = ast.Name(id="and_", ctx=ast.Load())
        elif isinstance(node.op, ast.Or):
            func = ast.Name(id="or_", ctx=ast.Load())
        else:
            raise SyntaxError(f"invalid expression: {ast.unparse(node)}")
        args = [self.visit(value) for value in node.values]
        return ast.Call(func=func, args=args, keywords=[])

    def visit_UnaryOp(self, node: ast.UnaryOp) -> typing.Any:
        operand = self.visit(node.operand)
        if isinstance(node.op, ast.Not):
            return ast.Call(
                func=ast.Name(id="not_", ctx=ast.Load()),
                args=[operand],
                keywords=[],
            )
        node = ast.UnaryOp(op=node.op, operand=operand)
        if isinstance(node.op, (ast.USub, ast.UAdd)):
            if not _is_float(node.operand):
                operand = _cast_as("Float", node.operand)
                return ast.UnaryOp(op=ast.USub(), operand=operand)
            return node
        return node

    def visit_BinOp(self, node: ast.BinOp) -> typing.Any:
        left, op, right = self.visit(node.left), node.op, self.visit(node.right)
        if _is_subscript(left, "attributes"):
            left = _cast_as("String", left)
        if _is_subscript(right, "attributes"):
            right = _cast_as("String", right)
        type_: typing.Literal["Float", "String"] = "String"
        if not isinstance(op, ast.Add) or _is_float(left) or _is_float(right):
            type_ = "Float"
            if not _is_float(left):
                left = _cast_as(type_, left)
            if not _is_float(right):
                right = _cast_as(type_, right)
            return ast.BinOp(left=left, op=op, right=right)
        return _cast_as(type_, ast.BinOp(left=left, op=op, right=right))

    def visit_Call(self, node: ast.Call) -> typing.Any:
        source_segment = ast.unparse(node)
        if len(node.args) != 1:
            raise SyntaxError(f"invalid expression: {source_segment}")
        if not isinstance(node.func, ast.Name) or node.func.id not in ("str", "float", "int"):
            raise SyntaxError(f"invalid expression: {ast.unparse(node.func)}")
        arg = self.visit(node.args[0])
        if node.func.id in ("float", "int") and not _is_float(arg):
            return _cast_as("Float", arg)
        if node.func.id in ("str",) and not _is_string(arg):
            return _cast_as("String", arg)
        return arg


def _validate_expression(
    expression: ast.Expression,
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None,
    valid_eval_attributes: tuple[str, ...] = _VALID_EVAL_ATTRIBUTES,
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
    if not isinstance(expression, ast.Expression):
        raise SyntaxError(f"invalid expression: {ast.unparse(expression)}")
    for i, node in enumerate(ast.walk(expression.body)):
        if i == 0:
            if (
                isinstance(node, (ast.BoolOp, ast.Compare))
                or isinstance(node, ast.UnaryOp)
                and isinstance(node.op, ast.Not)
                or _is_annotation(node)
            ):
                continue
        elif (
            _is_subscript(node, "metadata") or _is_subscript(node, "attributes")
        ) and _get_attribute_keys_list(node) is not None:
            continue
        elif _is_annotation(node) and _get_subscript_key(node) is not None:
            # e.g. `evals["name"]`
            annotation_type = typing.cast(AnnotationType, typing.cast(ast.Name, node.value).id)
            if not (eval_name := _get_subscript_key(node)) or (
                annotation_type != "trace_annotations"
                and valid_eval_names is not None
                and eval_name not in valid_eval_names
            ):
                source_segment = ast.unparse(node)
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
        elif isinstance(node, ast.Attribute) and _is_annotation(node.value):
            # e.g. `evals["name"].score`
            if (attr := node.attr) not in valid_eval_attributes:
                source_segment = ast.unparse(node)
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
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in ("str", "float", "int")
        ):
            # allow type casting functions
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
        source_segment = ast.unparse(node)
        raise SyntaxError(f"invalid expression: {source_segment}")


def _as_attribute(
    keys: list[ast.Constant],
    # as_float: typing.Optional[bool] = None,
) -> ast.Subscript:
    return ast.Subscript(
        value=ast.Name(id="attributes", ctx=ast.Load()),
        slice=ast.List(elts=keys, ctx=ast.Load())  # type: ignore[arg-type]
        if sys.version_info >= (3, 9)
        else ast.Index(value=ast.List(elts=keys, ctx=ast.Load())),  # type: ignore
        ctx=ast.Load(),
    )


def _is_annotation(node: typing.Any) -> TypeGuard[ast.Subscript]:
    # e.g. `evals["name"]`, `annotations["name"]`, `trace_annotations["name"]`
    return (
        isinstance(node, ast.Subscript)
        and isinstance(value := node.value, ast.Name)
        and value.id in _ANNOTATION_ACCESSORS
    )


def _is_subscript(
    node: typing.Any,
    id_: typing.Literal["attributes", "metadata"],
) -> TypeGuard[ast.Subscript]:
    # e.g. `attributes["key"]`
    # e.g. `attributes[["a", "b.c", "d"]]`
    # e.g. `attributes["a"]["b.c"]["d"]`
    while isinstance(node, ast.Subscript):
        node = node.value
        if isinstance(node, ast.Name) and node.id == id_:
            return True
    return False


def _get_attribute_keys_list(
    node: typing.Any,
) -> typing.Optional[list[ast.Constant]]:
    # e.g. `attributes["key"]` -> `["key"]`
    # e.g. `attributes["a"]["b.c"][["d"]]` -> `["a", "b.c", "d"]`
    # e.g. `attributes["a"][["b.c", "d"]]` -> `["a", "b.c", "d"]`
    # e.g. `metadata["key"]` -> `["metadata", "key"]`
    # e.g. `metadata["a"]["b.c"][["d"]]` -> `["metadata", "a", "b.c", "d"]`
    # e.g. `metadata["a"][["b.c", "d"]]` -> `["metadata", "a", "b.c", "d"]`
    keys: list[ast.Constant] = []
    if isinstance(node, ast.Attribute):
        while isinstance(node, ast.Attribute):
            keys.append(ast.Constant(value=node.attr, kind=None))
            node = node.value
            if isinstance(node, ast.Name):
                keys.append(ast.Constant(value=node.id, kind=None))
                return keys[::-1]
    elif isinstance(node, ast.Subscript):
        while isinstance(node, ast.Subscript):
            if not (sub_keys := _get_subscript_keys_list(node)):
                return None
            keys.extend(reversed(sub_keys))
            node = node.value
            if isinstance(node, ast.Name):
                if not isinstance(keys[-1].value, str):
                    return None
                if node.id == "metadata":
                    keys.append(ast.Constant(value="metadata", kind=None))
                return keys[::-1]
    return None


def _get_subscript_keys_list(
    node: ast.Subscript,
) -> typing.Optional[list[ast.Constant]]:
    child = node.slice
    if isinstance(child, ast.Constant):
        if not isinstance(child.value, (str, int)) or isinstance(child.value, bool):
            return None
        return [child]
    if not (
        isinstance(child, ast.List)
        and (elts := child.elts)
        and all(
            isinstance(elt, ast.Constant)
            and isinstance(elt.value, (str, int))
            and not isinstance(elt.value, bool)
            for elt in elts
        )
    ):
        return None
    return [typing.cast(ast.Constant, elt) for elt in elts]


def _get_subscript_key(
    node: ast.Subscript,
) -> typing.Optional[str]:
    child = node.slice
    if not (isinstance(child, ast.Constant) and isinstance(child.value, str)):
        return None
    return child.value


def _disjunction(choices: typing.Sequence[str]) -> str:
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


def _find_best_match(
    source: str, choices: typing.Iterable[str]
) -> tuple[typing.Optional[str], float]:
    best_choice, best_score = None, 0.0
    for choice in choices:
        score = SequenceMatcher(None, source, choice).ratio()
        if score > best_score:
            best_choice, best_score = choice, score
    return best_choice, best_score


class _AnnotationAliasTransformer(ast.NodeTransformer):
    def __init__(self) -> None:
        self._aliases: dict[
            tuple[AnnotationRelationKind, AnnotationName], AliasedAnnotationRelation
        ] = {}

    @property
    def relations(self) -> tuple[AliasedAnnotationRelation, ...]:
        return tuple(self._aliases.values())

    def visit_Attribute(self, node: ast.Attribute) -> ast.expr:
        if (reference := _get_annotation_reference(node.value)) is None:
            return typing.cast(ast.expr, self.generic_visit(node))
        annotation_type, annotation_name = reference
        attribute = typing.cast(AnnotationAttribute, node.attr)
        alias = self._get_alias(annotation_type, annotation_name).attribute_alias(attribute)
        return ast.copy_location(ast.Name(id=alias, ctx=ast.Load()), node)

    def visit_Subscript(self, node: ast.Subscript) -> ast.expr:
        if (reference := _get_annotation_reference(node)) is None:
            return typing.cast(ast.expr, self.generic_visit(node))
        annotation_type, annotation_name = reference
        alias = self._get_alias(annotation_type, annotation_name).existence_alias
        return ast.copy_location(ast.Name(id=alias, ctx=ast.Load()), node)

    def _get_alias(
        self, annotation_type: AnnotationType, annotation_name: AnnotationName
    ) -> AliasedAnnotationRelation:
        kind = _annotation_relation_kind(annotation_type)
        key = (kind, annotation_name)
        if (alias := self._aliases.get(key)) is None:
            alias = AliasedAnnotationRelation(
                index=len(self._aliases),
                name=annotation_name,
                kind=kind,
            )
            self._aliases[key] = alias
        return alias


def _get_annotation_reference(node: ast.AST) -> typing.Optional[tuple[AnnotationType, str]]:
    if not _is_annotation(node) or (annotation_name := _get_subscript_key(node)) is None:
        return None
    annotation_type = typing.cast(AnnotationType, typing.cast(ast.Name, node.value).id)
    return annotation_type, annotation_name


def _apply_annotation_aliasing(
    expression: ast.Expression,
) -> tuple[ast.Expression, tuple[AliasedAnnotationRelation, ...]]:
    transformer = _AnnotationAliasTransformer()
    transformed = transformer.visit(expression)
    return typing.cast(ast.Expression, transformed), transformer.relations
