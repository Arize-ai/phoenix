import ast
import sys
import typing
from dataclasses import dataclass, field
from datetime import datetime
from difflib import SequenceMatcher
from itertools import chain
from types import MappingProxyType
from uuid import uuid4

import sqlalchemy
from sqlalchemy import case, literal
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Mapped, aliased
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.expression import ColumnElement, Select
from typing_extensions import TypeAlias, TypeGuard, assert_never

from phoenix.db import models

_VALID_EVAL_ATTRIBUTES: tuple[str, ...] = ("score", "label", "explanation")


AnnotationAttribute: TypeAlias = typing.Literal["explanation", "label", "score"]
AnnotationName: TypeAlias = str


class _SafeJsonFloat(sqlalchemy.sql.functions.FunctionElement[float]):
    type = sqlalchemy.Float()
    inherit_cache = True


class _SafeJsonBoolean(sqlalchemy.sql.functions.FunctionElement[bool]):
    type = sqlalchemy.Boolean()
    inherit_cache = True


@compiles(_SafeJsonBoolean)
def _compile_safe_json_boolean(
    element: typing.Any, compiler: typing.Any, **kwargs: typing.Any
) -> str:
    value = compiler.process(list(element.clauses)[0], **kwargs)
    scalar = f"lower(json_extract({value}, '$'))"
    # SQLite's JSON functions return booleans as integers (e.g. JSON_QUOTE of an
    # extracted true is '1', whose json_type is 'integer'), so real JSON booleans
    # arrive here as 1/0 rather than 'true'/'false'.
    return (
        f"CASE json_type({value}) WHEN 'true' THEN 1 WHEN 'false' THEN 0 "
        f"WHEN 'integer' THEN CASE json_extract({value}, '$') WHEN 1 THEN 1 WHEN 0 THEN 0 END "
        f"WHEN 'text' THEN CASE {scalar} WHEN 'true' THEN 1 WHEN 'false' THEN 0 END END"
    )


@compiles(_SafeJsonBoolean, "postgresql")
def _compile_safe_json_boolean_postgresql(
    element: typing.Any, compiler: typing.Any, **kwargs: typing.Any
) -> str:
    value = compiler.process(list(element.clauses)[0], **kwargs)
    # The jsonpath .boolean() method requires PostgreSQL 17; this CASE works on
    # all supported PostgreSQL versions.
    scalar = f"({value} #>> '{{}}')"
    return (
        f"CASE jsonb_typeof({value}) WHEN 'boolean' THEN CAST({scalar} AS BOOLEAN) "
        f"WHEN 'string' THEN CASE lower{scalar} WHEN 'true' THEN true WHEN 'false' THEN false END "
        f"WHEN 'number' THEN CASE {scalar} WHEN '1' THEN true WHEN '0' THEN false END END"
    )


@compiles(_SafeJsonFloat)
def _compile_safe_json_float(
    element: typing.Any, compiler: typing.Any, **kwargs: typing.Any
) -> str:
    value = compiler.process(list(element.clauses)[0], **kwargs)
    scalar = f"json_extract({value}, '$')"
    return (
        f"CASE WHEN json_type({value}) IN ('integer', 'real') THEN CAST({value} AS FLOAT) "
        f"WHEN json_type({value}) = 'text' THEN CASE WHEN json_valid({scalar}) "
        f"AND json_type({scalar}) IN ('integer', 'real') THEN CAST({scalar} AS FLOAT) END END"
    )


@compiles(_SafeJsonFloat, "postgresql")
def _compile_safe_json_float_postgresql(
    element: typing.Any, compiler: typing.Any, **kwargs: typing.Any
) -> str:
    value = compiler.process(list(element.clauses)[0], **kwargs)
    converted = f"jsonb_path_query_first({value}, '$.double()', '{{}}'::jsonb, true)"
    return f"CAST({converted} AS NUMERIC)"


@dataclass(frozen=True)
class AliasedAnnotationRelation:
    """
    Represents an aliased `span_annotation` relation (i.e., SQL table). Used to
    perform joins on span evaluations during filtering. An alias is required
    because the `span_annotation` may be joined multiple times for different
    evaluation names.
    """

    index: int
    name: str
    table: AliasedClass[models.SpanAnnotation] = field(init=False, repr=False)
    _label_attribute_alias: str = field(init=False, repr=False)
    _score_attribute_alias: str = field(init=False, repr=False)
    _explanation_attribute_alias: str = field(init=False, repr=False)
    _exists_attribute_alias: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        table_alias = f"span_annotation_{self.index}"
        alias_id = uuid4().hex
        label_attribute_alias = f"{table_alias}_label_{alias_id}"
        score_attribute_alias = f"{table_alias}_score_{alias_id}"
        explanation_attribute_alias = f"{table_alias}_explanation_{alias_id}"
        exists_attribute_alias = f"{table_alias}_exists_{alias_id}"

        table = aliased(models.SpanAnnotation, name=table_alias)
        object.__setattr__(self, "_label_attribute_alias", label_attribute_alias)
        object.__setattr__(self, "_score_attribute_alias", score_attribute_alias)
        object.__setattr__(self, "_explanation_attribute_alias", explanation_attribute_alias)
        object.__setattr__(self, "_exists_attribute_alias", exists_attribute_alias)
        object.__setattr__(self, "table", table)

    @property
    def attributes(self) -> typing.Iterator[tuple[str, ColumnElement[typing.Any]]]:
        """
        Alias names and attributes (i.e., columns) of the `span_annotation`
        relation.
        """
        yield self._label_attribute_alias, self.table.label
        yield self._score_attribute_alias, self.table.score
        yield self._explanation_attribute_alias, self.table.explanation
        yield (
            self._exists_attribute_alias,
            case((self.table.id.is_not(None), literal(True)), else_=literal(False)),
        )

    def attribute_alias(self, attribute: AnnotationAttribute) -> str:
        """
        Returns an alias for the given attribute (i.e., column).
        """
        if attribute == "label":
            return self._label_attribute_alias
        if attribute == "score":
            return self._score_attribute_alias
        if attribute == "explanation":
            return self._explanation_attribute_alias
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


class SpanFilterError(SyntaxError):
    """An invalid span filter condition supplied by a caller."""


@dataclass(frozen=True)
class SpanFilter:
    condition: str = ""
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    _aliased_annotation_relations: tuple[AliasedAnnotationRelation] = field(init=False, repr=False)
    _aliased_annotation_attributes: dict[str, Mapped[typing.Any]] = field(init=False, repr=False)
    _literal_bindings: dict[str, typing.Any] = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        try:
            self._initialize()
        except SpanFilterError:
            raise
        except SyntaxError as error:
            raise SpanFilterError(str(error)) from error

    def _initialize(self) -> None:
        if not (source := self.condition):
            return
        root = ast.parse(source, mode="eval")
        _validate_expression(root, valid_eval_names=self.valid_eval_names)
        source, aliased_annotation_relations = _apply_eval_aliasing(source)
        root = ast.parse(source, mode="eval")
        translator = _FilterTranslator(
            reserved_keywords=(
                alias
                for aliased_annotation in aliased_annotation_relations
                for alias, _ in aliased_annotation.attributes
            ),
            string_keywords=(
                alias
                for aliased_annotation in aliased_annotation_relations
                for alias in (
                    aliased_annotation._label_attribute_alias,
                    aliased_annotation._explanation_attribute_alias,
                )
            ),
        )
        translated = translator.visit(root)
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
        object.__setattr__(self, "_literal_bindings", translator.literal_bindings)

    def __call__(self, select: Select[typing.Any]) -> Select[typing.Any]:
        if not self.condition:
            return select
        return self._join_aliased_relations(select).where(
            eval(
                self.compiled,
                {
                    "__builtins__": {},
                    **_NAMES,
                    **self._aliased_annotation_attributes,
                    **self._literal_bindings,
                    "not_": sqlalchemy.not_,
                    "and_": sqlalchemy.and_,
                    "or_": sqlalchemy.or_,
                    "nullif": sqlalchemy.func.nullif,
                    "cast": sqlalchemy.cast,
                    "Float": sqlalchemy.Float,
                    "String": sqlalchemy.String,
                    "SafeJsonBoolean": _SafeJsonBoolean,
                    "SafeJsonFloat": _SafeJsonFloat,
                    "TextContains": models.TextContains,
                },
            )
        )

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

    def _join_aliased_relations(self, stmt: Select[typing.Any]) -> Select[typing.Any]:
        """
        Joins the aliased relations to the given statement. E.g., for the filter condition:

        ```
        evals["Hallucination"].score > 0.5
        ```

        an alias (e.g., `A`) is generated for the `span_annotations` relation. An input statement
        `select(Span)` is transformed to:

        ```
        A = aliased(SpanAnnotation)
        select(Span).join(A, onclause=(and_(Span.id == A.span_rowid, A.name == "Hallucination")))
        ```
        """
        for eval_alias in self._aliased_annotation_relations:
            eval_name = eval_alias.name
            AliasedSpanAnnotation = eval_alias.table
            stmt = stmt.outerjoin(
                AliasedSpanAnnotation,
                onclause=(
                    sqlalchemy.and_(
                        AliasedSpanAnnotation.span_rowid == models.Span.id,
                        AliasedSpanAnnotation.name == eval_name,
                    )
                ),
            )
        return stmt


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


def _is_datetime_name(node: typing.Any) -> TypeGuard[ast.Name]:
    return isinstance(node, ast.Name) and node.id in _DATETIME_NAMES


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


def _is_none_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and node.value is None


def _is_bool_sequence(node: typing.Any) -> TypeGuard[typing.Union[ast.List, ast.Tuple]]:
    return (
        isinstance(node, (ast.List, ast.Tuple))
        and bool(node.elts)
        and all(_is_bool_constant(element) for element in node.elts)
    )


FilterValueType: TypeAlias = typing.Literal["boolean", "datetime", "number", "string", "null"]


def _get_filter_value_type(node: ast.AST) -> typing.Optional[FilterValueType]:
    if isinstance(node, ast.Constant):
        if node.value is None:
            return "null"
        if isinstance(node.value, bool):
            return "boolean"
        if isinstance(node.value, (int, float)):
            return "number"
        if isinstance(node.value, str):
            return "string"
        return None
    if isinstance(node, ast.Name):
        return _get_named_filter_value_type(node.id)
    if isinstance(node, ast.Attribute) and _is_annotation(node.value):
        if node.attr in ("label", "explanation"):
            return "string"
        if node.attr == "score":
            return "number"
        return None
    if isinstance(node, ast.Attribute):
        return _get_named_filter_value_type(ast.unparse(node))
    if _is_annotation(node):
        return "boolean"
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        if node.func.id == "str":
            return "string"
        if node.func.id in ("float", "int"):
            return "number"
    if isinstance(node, ast.BinOp):
        if not isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod)):
            raise SyntaxError(f"invalid arithmetic operator: {ast.unparse(node.op)}")
        left_type = _get_filter_value_type(node.left)
        right_type = _get_filter_value_type(node.right)
        if isinstance(node.op, ast.Add):
            known_types = {value_type for value_type in (left_type, right_type) if value_type}
            if not known_types:
                return "string"
            if len(known_types) == 1 and known_types <= {"number", "string"}:
                return known_types.pop()
        elif left_type in (None, "number") and right_type in (None, "number"):
            return "number"
        raise SyntaxError("invalid arithmetic operands")
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        operand_type = _get_filter_value_type(node.operand)
        if operand_type not in (None, "number"):
            raise SyntaxError("invalid arithmetic operand")
        return "number"
    if isinstance(node, ast.Compare):
        return "boolean"
    if isinstance(node, ast.BoolOp):
        return "boolean"
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return "boolean"
    return None


def _get_named_filter_value_type(name: str) -> typing.Optional[FilterValueType]:
    name = _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(name, name)
    if name in _STRING_NAMES:
        return "string"
    if name in _FLOAT_NAMES or name in _FLOAT_ATTRIBUTES:
        return "number"
    if name in _DATETIME_NAMES:
        return "datetime"
    return None


def _validate_operand_types(expression: ast.Expression) -> None:
    for node in ast.walk(expression.body):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in ("float", "int")
        ):
            if len(node.args) != 1:
                raise SyntaxError(f"invalid expression: {ast.unparse(node)}")
            argument = node.args[0]
            if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
                try:
                    float(argument.value)
                except ValueError as error:
                    raise SyntaxError("cannot cast string to number") from error
            elif _get_filter_value_type(argument) == "string":
                raise SyntaxError("cannot cast string to number")
            continue
        if isinstance(node, ast.BoolOp):
            # operands of unknown type (e.g. JSON attributes) are allowed as truthy values
            if any(_get_filter_value_type(value) not in (None, "boolean") for value in node.values):
                raise SyntaxError("logical operands must be boolean expressions")
            continue
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            if _get_filter_value_type(node.operand) not in (None, "boolean"):
                raise SyntaxError("logical operands must be boolean expressions")
            continue
        if not isinstance(node, ast.Compare):
            continue
        left = node.left
        for operator, right in zip(node.ops, node.comparators):
            if isinstance(operator, (ast.In, ast.NotIn)) and isinstance(
                right, (ast.List, ast.Tuple)
            ):
                element_types = {
                    element_type
                    for element in right.elts
                    if (element_type := _get_filter_value_type(element)) not in (None, "null")
                }
                if len(element_types) > 1:
                    ordered_types: tuple[FilterValueType, ...] = (
                        "boolean",
                        "datetime",
                        "number",
                        "string",
                    )
                    present_types = [
                        value_type for value_type in ordered_types if value_type in element_types
                    ]
                    first_type, second_type = present_types[0], present_types[1]
                    raise SyntaxError(f"cannot compare {first_type} and {second_type}")
                for element in right.elts:
                    _validate_comparable_types(left, element)
            elif isinstance(operator, (ast.In, ast.NotIn)):
                left_type = _get_filter_value_type(left)
                right_type = _get_filter_value_type(right)
                if left_type not in (None, "string") or right_type not in (None, "string"):
                    raise SyntaxError(
                        f"cannot compare {left_type or 'value'} and {right_type or 'string'}"
                    )
            else:
                _validate_comparable_types(left, right)
            left = right


def _validate_comparable_types(left: ast.AST, right: ast.AST) -> None:
    left_type = _get_filter_value_type(left)
    right_type = _get_filter_value_type(right)
    if {left_type, right_type} == {"datetime", "string"}:
        # only a string literal can be bound as a datetime
        string_node = left if left_type == "string" else right
        if _is_string_constant(string_node):
            return
    if {left_type, right_type} == {"number", "string"}:
        # a numeric string literal is cast to a number at translation
        string_node = left if left_type == "string" else right
        if (
            isinstance(string_node, ast.Constant)
            and isinstance(string_node.value, str)
            and _is_numeric_string(string_node.value)
        ):
            return
    if (
        left_type is not None
        and right_type is not None
        and left_type != right_type
        and "null" not in (left_type, right_type)
    ):
        raise SyntaxError(f"cannot compare {left_type} and {right_type}")


def _is_numeric_string(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True


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
        and isinstance(node.func, ast.Name)
        and node.func.id == "SafeJsonFloat"
        and len(node.args) == 1
        and isinstance(value := node.args[0], ast.Subscript)
        and isinstance(name := value.value, ast.Name)
        and name.id == "attributes"
    )


def _as_string_attribute(node: typing.Union[ast.Subscript, ast.Call]) -> ast.Call:
    if isinstance(node, ast.Call):
        value = (
            node.args[0]
            if isinstance(node.func, ast.Name) and node.func.id == "SafeJsonFloat"
            else typing.cast(ast.Attribute, node.func).value
        )
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
        func=ast.Name(id="SafeJsonFloat", ctx=ast.Load()),
        args=[value],
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
        func=ast.Name(id="SafeJsonBoolean", ctx=ast.Load()),
        args=[value],
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
        string_keywords: typing.Iterable[str] = (),
    ) -> None:
        super().__init__(reserved_keywords)
        self._string_keywords = frozenset(string_keywords)
        self.literal_bindings: dict[str, typing.Any] = {}

    def visit_Compare(self, node: ast.Compare) -> typing.Any:
        if len(node.comparators) > 1:
            args: list[typing.Any] = []
            left = node.left
            for i, (op, comparator) in enumerate(zip(node.ops, node.comparators)):
                args.append(self.visit(ast.Compare(left=left, ops=[op], comparators=[comparator])))
                left = comparator
            return ast.Call(func=ast.Name(id="and_", ctx=ast.Load()), args=args, keywords=[])
        left_node, right_node = node.left, node.comparators[0]
        left, op, right = self.visit(left_node), node.ops[0], self.visit(right_node)
        if _is_datetime_name(left_node):
            right = self._bind_datetime_literal(right_node, right)
        elif _is_datetime_name(right_node):
            left = self._bind_datetime_literal(left_node, left)
        if _is_uppercase_enum(left):
            right = _convert_to_uppercase(right)
        elif _is_uppercase_enum(right):
            left = _convert_to_uppercase(left)
        if _is_subscript(left, "attributes"):
            left = (
                _as_bool_attribute(left)
                if _is_bool_constant(right) or _is_bool_sequence(right)
                else _cast_as("String", left)
            )
        if _is_subscript(right, "attributes"):
            right = (
                _as_bool_attribute(right)
                if _is_bool_constant(left) or _is_bool_sequence(left)
                else _cast_as("String", right)
            )
        if _is_float(left) and not _is_float(right) and not _is_none_constant(right):
            right = _cast_as("Float", right)
        elif not _is_float(left) and not _is_none_constant(left) and _is_float(right):
            left = _cast_as("Float", left)
        if isinstance(op, (ast.In, ast.NotIn)):
            if (
                _is_string_attribute(right)
                or ast.unparse(right) in _NAMES
                or isinstance(right, ast.Name)
                and right.id in self._string_keywords
            ):
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

    def _bind_datetime_literal(self, source: ast.expr, translated: ast.expr) -> ast.expr:
        if isinstance(source, (ast.List, ast.Tuple)) and isinstance(
            translated, (ast.List, ast.Tuple)
        ):
            elts = [
                self._bind_datetime_literal(source_elt, translated_elt)
                for source_elt, translated_elt in zip(source.elts, translated.elts)
            ]
            if isinstance(translated, ast.List):
                return ast.List(elts=elts, ctx=ast.Load())
            return ast.Tuple(elts=elts, ctx=ast.Load())
        if not (isinstance(source, ast.Constant) and isinstance(source.value, str)):
            return translated
        raw = source.value
        if raw.endswith(("Z", "z")):
            # Python 3.10's fromisoformat does not accept the Z suffix
            raw = raw[:-1] + "+00:00"
        try:
            value = datetime.fromisoformat(raw)
        except ValueError as error:
            raise SyntaxError(f"invalid datetime literal: {source.value!r}") from error
        name = f"__datetime_literal_{len(self.literal_bindings)}"
        self.literal_bindings[name] = value
        return ast.Name(id=name, ctx=ast.Load())

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
            if isinstance(op, (ast.Div, ast.Mod)):
                right = ast.Call(
                    func=ast.Name(id="nullif", ctx=ast.Load()),
                    args=[right, ast.Constant(value=0)],
                    keywords=[],
                )
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
    """Validate the expression's structure, names, attributes, and operand types."""
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
            if not (eval_name := _get_subscript_key(node)) or (
                valid_eval_names is not None and eval_name not in valid_eval_names
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
    _validate_operand_types(expression)


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
    # e.g. `evals["name"]`
    return (
        isinstance(node, ast.Subscript)
        and isinstance(value := node.value, ast.Name)
        and value.id in ["evals", "annotations"]
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


def _apply_eval_aliasing(
    source: str,
) -> tuple[
    str,
    tuple[AliasedAnnotationRelation, ...],
]:
    """
    Substitutes `evals[<eval-name>].<attribute>` with aliases. Returns the
    updated source code in addition to the aliased relations.

    Example:

    input:

    ```
    evals['Hallucination'].label == 'correct' or evals['Hallucination'].score < 0.5
    ```

    output:

    ```
    span_annotation_0_label_123 == 'correct' or span_annotation_0_score_456 < 0.5
    ```
    """
    try:
        root = ast.parse(source, mode="eval")
    except SyntaxError:
        return source, ()
    aliaser = _AnnotationExpressionAliaser(source)
    aliaser.visit(root)
    encoded = source.encode()
    for start, end, alias in sorted(aliaser.replacements, reverse=True):
        encoded = encoded[:start] + alias.encode() + encoded[end:]
    return encoded.decode(), aliaser.relations


class _AnnotationExpressionAliaser(ast.NodeVisitor):
    def __init__(self, source: str) -> None:
        lines = source.splitlines(keepends=True)
        self._line_offsets = [0]
        for line in lines:
            self._line_offsets.append(self._line_offsets[-1] + len(line.encode()))
        self._relations_by_name: dict[AnnotationName, AliasedAnnotationRelation] = {}
        self.replacements: list[tuple[int, int, str]] = []

    @property
    def relations(self) -> tuple[AliasedAnnotationRelation, ...]:
        return tuple(self._relations_by_name.values())

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if not _is_annotation(node.value):
            self.generic_visit(node)
            return
        if node.attr not in _VALID_EVAL_ATTRIBUTES:
            return
        annotation_name = _get_subscript_key(node.value)
        if annotation_name is None:
            return
        relation = self._get_relation(annotation_name)
        attribute = typing.cast(AnnotationAttribute, node.attr)
        self._add_replacement(node, relation.attribute_alias(attribute))

    def visit_Subscript(self, node: ast.Subscript) -> None:
        if not _is_annotation(node):
            self.generic_visit(node)
            return
        annotation_name = _get_subscript_key(node)
        if annotation_name is None:
            return
        relation = self._get_relation(annotation_name)
        self._add_replacement(node, relation._exists_attribute_alias)

    def _get_relation(self, annotation_name: str) -> AliasedAnnotationRelation:
        if (relation := self._relations_by_name.get(annotation_name)) is None:
            relation = AliasedAnnotationRelation(
                index=len(self._relations_by_name),
                name=annotation_name,
            )
            self._relations_by_name[annotation_name] = relation
        return relation

    def _add_replacement(self, node: ast.expr, alias: str) -> None:
        if node.end_lineno is not None and node.end_col_offset is not None:
            start = self._line_offsets[node.lineno - 1] + node.col_offset
            end = self._line_offsets[node.end_lineno - 1] + node.end_col_offset
            self.replacements.append((start, end, alias))
