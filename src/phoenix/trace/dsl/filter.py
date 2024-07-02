import ast
import re
import sys
import typing
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from itertools import chain
from random import randint
from types import MappingProxyType

import sqlalchemy
from sqlalchemy.orm import Mapped, aliased
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.expression import Select
from typing_extensions import TypeAlias, TypeGuard, assert_never

import phoenix.trace.v1 as pb
from phoenix.db import models

_VALID_EVAL_ATTRIBUTES: typing.Tuple[str, ...] = tuple(
    field.name for field in pb.Evaluation.Result.DESCRIPTOR.fields
)


EvalAttribute: TypeAlias = typing.Literal["label", "score"]
EvalExpression: TypeAlias = str
EvalName: TypeAlias = str

EVAL_EXPRESSION_PATTERN = re.compile(r"""\b(evals\[(".*?"|'.*?')\][.](label|score))\b""")


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

    def __post_init__(self) -> None:
        table_alias = f"span_annotation_{self.index}"
        alias_id = f"{randint(0, 10**6):06d}"  # prevent conflicts with user-defined attributes
        label_attribute_alias = f"{table_alias}_label_{alias_id}"
        score_attribute_alias = f"{table_alias}_score_{alias_id}"
        table = aliased(models.SpanAnnotation, name=table_alias)
        object.__setattr__(self, "_label_attribute_alias", label_attribute_alias)
        object.__setattr__(self, "_score_attribute_alias", score_attribute_alias)
        object.__setattr__(
            self,
            "table",
            table,
        )

    @property
    def attributes(self) -> typing.Iterator[typing.Tuple[str, Mapped[typing.Any]]]:
        """
        Alias names and attributes (i.e., columns) of the `span_annotation`
        relation.
        """
        yield self._label_attribute_alias, self.table.label
        yield self._score_attribute_alias, self.table.score

    def attribute_alias(self, attribute: EvalAttribute) -> str:
        """
        Returns an alias for the given attribute (i.e., column).
        """
        if attribute == "label":
            return self._label_attribute_alias
        if attribute == "score":
            return self._score_attribute_alias
        assert_never(attribute)


# Because postgresql is strongly typed, we cast JSON values to string
# by default unless it's hinted otherwise as done here.
_FLOAT_ATTRIBUTES: typing.FrozenSet[str] = frozenset(
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
    _aliased_annotation_relations: typing.Tuple[AliasedAnnotationRelation] = field(
        init=False, repr=False
    )
    _aliased_annotation_attributes: typing.Dict[str, Mapped[typing.Any]] = field(
        init=False, repr=False
    )

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        if not (source := self.condition):
            return
        root = ast.parse(source, mode="eval")
        _validate_expression(root, source, valid_eval_names=self.valid_eval_names)
        source, aliased_annotation_relations = _apply_eval_aliasing(source)
        root = ast.parse(source, mode="eval")
        translated = _FilterTranslator(
            source=source,
            reserved_keywords=(
                alias
                for aliased_annotation in aliased_annotation_relations
                for alias, _ in aliased_annotation.attributes
            ),
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
        return self._join_aliased_relations(select).where(
            eval(
                self.compiled,
                {
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
        )

    def to_dict(self) -> typing.Dict[str, typing.Any]:
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
            stmt = stmt.join(
                AliasedSpanAnnotation,
                onclause=(
                    sqlalchemy.and_(
                        AliasedSpanAnnotation.span_rowid == models.Span.id,
                        AliasedSpanAnnotation.name == eval_name,
                    )
                ),
            )
        return stmt


@dataclass(frozen=True)
class Projector:
    expression: str
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)

    def __post_init__(self) -> None:
        if not (source := self.expression):
            raise ValueError("missing expression")
        root = ast.parse(source, mode="eval")
        translated = _ProjectionTranslator(source).visit(root)
        ast.fix_missing_locations(translated)
        compiled = compile(translated, filename="", mode="eval")
        object.__setattr__(self, "translated", translated)
        object.__setattr__(self, "compiled", compiled)

    def __call__(self) -> sqlalchemy.SQLColumnExpression[typing.Any]:
        return typing.cast(
            sqlalchemy.SQLColumnExpression[typing.Any],
            eval(self.compiled, {**_NAMES}),
        )


def _is_string_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and isinstance(node.value, str)


def _is_float_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and isinstance(node.value, typing.SupportsFloat)


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
    def __init__(self, source: str, reserved_keywords: typing.Iterable[str] = ()) -> None:
        # Regarding the need for `source: str` for getting source segments:
        # In Python 3.8, we have to use `ast.get_source_segment(source, node)`.
        # In Python 3.9+, we can use `ast.unparse(node)` (no need for `source`).
        self._source = source
        self._reserved_keywords = frozenset(
            chain(
                reserved_keywords,
                _STRING_NAMES.keys(),
                _FLOAT_NAMES.keys(),
                _DATETIME_NAMES.keys(),
            )
        )

    def visit_generic(self, node: ast.AST) -> typing.Any:
        raise SyntaxError(f"invalid expression: {ast.get_source_segment(self._source, node)}")

    def visit_Expression(self, node: ast.Expression) -> typing.Any:
        return ast.Expression(body=self.visit(node.body))

    def visit_Attribute(self, node: ast.Attribute) -> typing.Any:
        source_segment = typing.cast(str, ast.get_source_segment(self._source, node))
        if replacement := _BACKWARD_COMPATIBILITY_REPLACEMENTS.get(source_segment):
            return ast.Name(id=replacement, ctx=ast.Load())
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {source_segment}")

    def visit_Name(self, node: ast.Name) -> typing.Any:
        source_segment = typing.cast(str, ast.get_source_segment(self._source, node))
        if source_segment in self._reserved_keywords:
            return node
        name = source_segment
        return _as_attribute([ast.Constant(value=name, kind=None)])

    def visit_Subscript(self, node: ast.Subscript) -> typing.Any:
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {ast.get_source_segment(self._source, node)}")


class _FilterTranslator(_ProjectionTranslator):
    def visit_Compare(self, node: ast.Compare) -> typing.Any:
        if len(node.comparators) > 1:
            args: typing.List[typing.Any] = []
            left = node.left
            for i, (op, comparator) in enumerate(zip(node.ops, node.comparators)):
                args.append(self.visit(ast.Compare(left=left, ops=[op], comparators=[comparator])))
                left = comparator
            return ast.Call(func=ast.Name(id="and_", ctx=ast.Load()), args=args, keywords=[])
        left, op, right = self.visit(node.left), node.ops[0], self.visit(node.comparators[0])
        if _is_subscript(left, "attributes"):
            left = _cast_as("String", left)
        if _is_subscript(right, "attributes"):
            right = _cast_as("String", right)
        if _is_float(left) and not _is_float(right):
            right = _cast_as("Float", right)
        elif not _is_float(left) and _is_float(right):
            left = _cast_as("Float", left)
        if isinstance(op, (ast.In, ast.NotIn)):
            if (
                _is_string_attribute(right)
                or (typing.cast(str, ast.get_source_segment(self._source, right))) in _NAMES
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
                raise SyntaxError(f"invalid expression: {ast.get_source_segment(self._source, op)}")
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
            raise SyntaxError(f"invalid expression: {ast.get_source_segment(self._source, node)}")
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
        source_segment = typing.cast(str, ast.get_source_segment(self._source, node))
        if len(node.args) != 1:
            raise SyntaxError(f"invalid expression: {source_segment}")
        if not isinstance(node.func, ast.Name) or node.func.id not in ("str", "float", "int"):
            raise SyntaxError(
                f"invalid expression: {ast.get_source_segment(self._source, node.func)}"
            )
        arg = self.visit(node.args[0])
        if node.func.id in ("float", "int") and not _is_float(arg):
            return _cast_as("Float", arg)
        if node.func.id in ("str",) and not _is_string(arg):
            return _cast_as("String", arg)
        return arg


def _validate_expression(
    expression: ast.Expression,
    source: str,
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None,
    valid_eval_attributes: typing.Tuple[str, ...] = _VALID_EVAL_ATTRIBUTES,
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
        raise SyntaxError(f"invalid expression: {source}")
    for i, node in enumerate(ast.walk(expression.body)):
        if i == 0:
            if (
                isinstance(node, (ast.BoolOp, ast.Compare))
                or isinstance(node, ast.UnaryOp)
                and isinstance(node.op, ast.Not)
            ):
                continue
        elif (
            _is_subscript(node, "metadata") or _is_subscript(node, "attributes")
        ) and _get_attribute_keys_list(node) is not None:
            continue
        elif _is_eval(node) and _get_subscript_key(node) is not None:
            # e.g. `evals["name"]`
            if not (eval_name := _get_subscript_key(node)) or (
                valid_eval_names is not None and eval_name not in valid_eval_names
            ):
                source_segment = typing.cast(str, ast.get_source_segment(source, node))
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
                source_segment = typing.cast(str, ast.get_source_segment(source, node))
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
                # Prior to Python 3.9, `ast.Index` is part of `ast.Subscript`,
                # so it needs to allowed here, but note that `ast.Subscript` is
                # not allowed in general except in the case of `evals["name"]`.
                # Note that `ast.Index` is deprecated in Python 3.9+.
                *((ast.Index,) if sys.version_info < (3, 9) else ()),
            ),
        ):
            continue
        source_segment = typing.cast(str, ast.get_source_segment(source, node))
        raise SyntaxError(f"invalid expression: {source_segment}")


def _as_attribute(
    keys: typing.List[ast.Constant],
    # as_float: typing.Optional[bool] = None,
) -> ast.Subscript:
    return ast.Subscript(
        value=ast.Name(id="attributes", ctx=ast.Load()),
        slice=ast.List(elts=keys, ctx=ast.Load())
        if sys.version_info >= (3, 9)
        else ast.Index(value=ast.List(elts=keys, ctx=ast.Load())),
        ctx=ast.Load(),
    )


def _is_eval(node: typing.Any) -> TypeGuard[ast.Subscript]:
    # e.g. `evals["name"]`
    return (
        isinstance(node, ast.Subscript)
        and isinstance(value := node.value, ast.Name)
        and value.id == "evals"
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
) -> typing.Optional[typing.List[ast.Constant]]:
    # e.g. `attributes["key"]` -> `["key"]`
    # e.g. `attributes["a"]["b.c"][["d"]]` -> `["a", "b.c", "d"]`
    # e.g. `attributes["a"][["b.c", "d"]]` -> `["a", "b.c", "d"]`
    # e.g. `metadata["key"]` -> `["metadata", "key"]`
    # e.g. `metadata["a"]["b.c"][["d"]]` -> `["metadata", "a", "b.c", "d"]`
    # e.g. `metadata["a"][["b.c", "d"]]` -> `["metadata", "a", "b.c", "d"]`
    keys: typing.List[ast.Constant] = []
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
) -> typing.Optional[typing.List[ast.Constant]]:
    if sys.version_info < (3, 9):
        # Note that `ast.Index` is deprecated in Python 3.9+, but is necessary
        # for Python 3.8 as part of `ast.Subscript`.
        if not isinstance(node.slice, ast.Index):
            return None
        child = node.slice.value
    else:
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
    if sys.version_info < (3, 9):
        # Note that `ast.Index` is deprecated in Python 3.9+, but is necessary
        # for Python 3.8 as part of `ast.Subscript`.
        if not isinstance(node.slice, ast.Index):
            return None
        child = node.slice.value
    else:
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
) -> typing.Tuple[typing.Optional[str], float]:
    best_choice, best_score = None, 0.0
    for choice in choices:
        score = SequenceMatcher(None, source, choice).ratio()
        if score > best_score:
            best_choice, best_score = choice, score
    return best_choice, best_score


def _apply_eval_aliasing(
    source: str,
) -> typing.Tuple[
    str,
    typing.Tuple[AliasedAnnotationRelation, ...],
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
    eval_aliases: typing.Dict[EvalName, AliasedAnnotationRelation] = {}
    for eval_expression, eval_name, eval_attribute in _parse_eval_expressions_and_names(source):
        if (eval_alias := eval_aliases.get(eval_name)) is None:
            eval_alias = AliasedAnnotationRelation(index=len(eval_aliases), name=eval_name)
            eval_aliases[eval_name] = eval_alias
        alias_name = eval_alias.attribute_alias(eval_attribute)
        source = source.replace(eval_expression, alias_name)
    return source, tuple(eval_aliases.values())


def _parse_eval_expressions_and_names(
    source: str,
) -> typing.Iterator[typing.Tuple[EvalExpression, EvalName, EvalAttribute]]:
    """
    Parses filter conditions for evaluation expressions of the form:

    ```
    evals["<eval-name>"].<attribute>
    ```
    """
    for match in EVAL_EXPRESSION_PATTERN.finditer(source):
        (
            eval_expression,
            quoted_eval_name,
            evaluation_attribute_name,
        ) = match.groups()
        yield (
            eval_expression,
            quoted_eval_name[1:-1],
            typing.cast(EvalAttribute, evaluation_attribute_name),
        )
