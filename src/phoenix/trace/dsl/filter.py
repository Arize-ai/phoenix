import ast
import re
import sys
import typing
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from itertools import chain
from types import MappingProxyType
from uuid import uuid4

import sqlalchemy
from sqlalchemy import case, literal
from sqlalchemy.orm import Mapped, aliased
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.expression import ColumnElement, Select
from typing_extensions import TypeAlias, TypeGuard, assert_never

from phoenix.db import models

NameMap: TypeAlias = typing.Mapping[str, "sqlalchemy.SQLColumnExpression[typing.Any]"]

_VALID_EVAL_ATTRIBUTES: tuple[str, ...] = ("score", "label", "explanation")


AnnotationType: TypeAlias = typing.Literal["annotations", "evals"]
AnnotationAttribute: TypeAlias = typing.Literal["label", "score"]
AnnotationExpression: TypeAlias = str
AnnotationName: TypeAlias = str

EVAL_EXPRESSION_PATTERN = re.compile(
    r"""\b((annotations|evals)\[(".*?"|'.*?')\][.](label|score))\b"""
)

EVAL_NAME_PATTERN = re.compile(r"""(?<!\w)((annotations|evals)\[(".*?"|'.*?')\])(?![\w\.])""")


@dataclass(frozen=True)
class AliasedAnnotationRelation:
    """
    Represents an aliased annotation relation (i.e., SQL table). Used to
    perform joins on annotations during filtering. An alias is required
    because the annotation table may be joined multiple times for different
    annotation names. ``annotation_model`` and ``table_prefix`` select the grain
    (span vs. session); they default to the span annotation.
    """

    index: int
    name: str
    annotation_model: type[typing.Any] = models.SpanAnnotation
    table_prefix: str = "span_annotation"
    table: AliasedClass[typing.Any] = field(init=False, repr=False)
    _label_attribute_alias: str = field(init=False, repr=False)
    _score_attribute_alias: str = field(init=False, repr=False)
    _exists_attribute_alias: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        table_alias = f"{self.table_prefix}_{self.index}"
        alias_id = uuid4().hex
        label_attribute_alias = f"{table_alias}_label_{alias_id}"
        score_attribute_alias = f"{table_alias}_score_{alias_id}"
        exists_attribute_alias = f"{table_alias}_exists_{alias_id}"

        table = aliased(self.annotation_model, name=table_alias)
        object.__setattr__(self, "_label_attribute_alias", label_attribute_alias)
        object.__setattr__(self, "_score_attribute_alias", score_attribute_alias)
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
class _FilterBindings:
    """The entity-specific surface the shared filter compiler is parameterized over.

    The compile pipeline (parse -> validate -> alias -> translate -> eval) is
    entity-agnostic; everything that couples it to a grain lives here. ``string_names``,
    ``float_names`` and ``datetime_names`` are the bound scalar columns, consulted both as
    eval globals and by the ``_is_string``/``_is_float`` type-inference and reserved-keyword
    passthrough. ``extra_names`` are additional eval globals (e.g. ``attributes``) that are not
    reserved keywords. ``aggregate_names`` are float-typed names whose SQL is a per-instance
    join (bound by the caller, not present as a static column) — they participate in type
    inference and reserved-keyword passthrough but carry no entry in ``names``.
    ``exists_names`` are operator-restricted pseudo names that compile only from
    ``<expr> in <name>`` / ``<expr> not in <name>`` into a callable eval-global.
    ``annotation_model``/``annotation_fk``/``entity_id``/``annotation_table_prefix`` retarget
    the annotation join. ``uppercase_names`` are names whose string comparands are folded to
    upper case (``span_kind``, ``status_code``). ``reject_unbound_names`` makes an unbound
    bare name a did-you-mean error instead of an ``attributes`` lookup. ``quantifiers`` is
    the set of call names allowed beyond the cast functions; both grains leave it empty.
    """

    string_names: NameMap
    float_names: NameMap
    datetime_names: NameMap
    extra_names: NameMap
    aggregate_names: frozenset[str]
    legacy_replacements: typing.Mapping[str, str]
    uppercase_names: frozenset[str]
    annotation_model: type[typing.Any]
    annotation_fk: str
    entity_id: "sqlalchemy.SQLColumnExpression[typing.Any]"
    annotation_table_prefix: str
    reject_unbound_names: bool
    quantifiers: frozenset[str] = frozenset()
    exists_names: frozenset[str] = frozenset()

    @property
    def names(self) -> NameMap:
        """Static eval globals: the scalar columns usable directly in a compiled predicate."""
        return MappingProxyType(
            {
                **self.string_names,
                **self.float_names,
                **self.datetime_names,
                **self.extra_names,
            }
        )

    @property
    def binding_names(self) -> frozenset[str]:
        """Every bound name a bare identifier may resolve to — the did-you-mean vocabulary."""
        return frozenset(
            chain(
                self.string_names,
                self.float_names,
                self.datetime_names,
                self.aggregate_names,
                self.exists_names,
            )
        )


SPAN_BINDINGS = _FilterBindings(
    string_names=_STRING_NAMES,
    float_names=_FLOAT_NAMES,
    datetime_names=_DATETIME_NAMES,
    extra_names=MappingProxyType(
        {
            "attributes": models.Span.attributes,
            "events": models.Span.events,
        }
    ),
    aggregate_names=frozenset(),
    legacy_replacements=_BACKWARD_COMPATIBILITY_REPLACEMENTS,
    uppercase_names=frozenset({"span_kind", "status_code"}),
    annotation_model=models.SpanAnnotation,
    annotation_fk="span_rowid",
    entity_id=models.Span.id,
    annotation_table_prefix="span_annotation",
    reject_unbound_names=False,
    quantifiers=frozenset(),
    exists_names=frozenset(),
)


class _CompiledCondition(typing.NamedTuple):
    translated: ast.Expression
    compiled: typing.Any
    aliased_annotation_relations: tuple[AliasedAnnotationRelation, ...]
    aliased_annotation_attributes: dict[str, ColumnElement[typing.Any]]


def _compile_condition(
    source: str,
    bindings: _FilterBindings,
    valid_annotation_names: typing.Optional[typing.Sequence[str]],
) -> _CompiledCondition:
    """Run the shared parse -> validate -> alias -> translate -> compile pipeline."""
    root = ast.parse(source, mode="eval")
    _validate_expression(root, bindings, valid_eval_names=valid_annotation_names)
    source, aliased_annotation_relations = _apply_eval_aliasing(source, bindings)
    root = ast.parse(source, mode="eval")
    translated = _FilterTranslator(
        bindings=bindings,
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
    return _CompiledCondition(
        translated, compiled, aliased_annotation_relations, aliased_annotation_attributes
    )


def _join_annotations(
    stmt: Select[typing.Any],
    bindings: _FilterBindings,
    aliased_annotation_relations: typing.Iterable[AliasedAnnotationRelation],
) -> Select[typing.Any]:
    """Outer-join each aliased annotation relation on ``<fk> == entity_id`` and matching name.

    E.g. for ``evals["Hallucination"].score > 0.5`` an alias ``A`` is generated and
    ``select(Span)`` becomes
    ``select(Span).outerjoin(A, and_(A.span_rowid == Span.id, A.name == "Hallucination"))``.
    The FK column and entity id are taken from ``bindings`` so the join retargets across grains.
    """
    for annotation_relation in aliased_annotation_relations:
        aliased_annotation = annotation_relation.table
        stmt = stmt.outerjoin(
            aliased_annotation,
            onclause=sqlalchemy.and_(
                getattr(aliased_annotation, bindings.annotation_fk) == bindings.entity_id,
                aliased_annotation.name == annotation_relation.name,
            ),
        )
    return stmt


def _eval_globals(
    bindings: _FilterBindings,
    aliased_annotation_attributes: typing.Mapping[str, typing.Any],
    extra_bindings: typing.Optional[typing.Mapping[str, typing.Any]] = None,
) -> dict[str, typing.Any]:
    """Assemble the sandboxed namespace the compiled predicate is ``eval``'d against."""
    return {
        "__builtins__": {},
        **bindings.names,
        **(extra_bindings or {}),
        **aliased_annotation_attributes,
        "not_": sqlalchemy.not_,
        "and_": sqlalchemy.and_,
        "or_": sqlalchemy.or_,
        "cast": sqlalchemy.cast,
        "nullif": sqlalchemy.func.nullif,
        "Float": sqlalchemy.Float,
        "String": sqlalchemy.String,
        "TextContains": models.TextContains,
    }


@dataclass(frozen=True)
class SpanFilter:
    condition: str = ""
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    _aliased_annotation_relations: tuple[AliasedAnnotationRelation] = field(init=False, repr=False)
    _aliased_annotation_attributes: dict[str, Mapped[typing.Any]] = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        if not (source := self.condition):
            return
        compiled_condition = _compile_condition(source, SPAN_BINDINGS, self.valid_eval_names)
        object.__setattr__(self, "translated", compiled_condition.translated)
        object.__setattr__(self, "compiled", compiled_condition.compiled)
        object.__setattr__(
            self, "_aliased_annotation_relations", compiled_condition.aliased_annotation_relations
        )
        object.__setattr__(
            self, "_aliased_annotation_attributes", compiled_condition.aliased_annotation_attributes
        )

    def __call__(self, select: Select[typing.Any]) -> Select[typing.Any]:
        if not self.condition:
            return select
        stmt = _join_annotations(select, SPAN_BINDINGS, self._aliased_annotation_relations)
        return stmt.where(
            eval(
                self.compiled,
                _eval_globals(SPAN_BINDINGS, self._aliased_annotation_attributes),
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


def _is_uppercase_name(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Name]:
    """A bound name whose string comparands are folded to upper case (e.g. ``span_kind``)."""
    return isinstance(node, ast.Name) and node.id in bindings.uppercase_names


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


def _is_exists_name(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Name]:
    return isinstance(node, ast.Name) and node.id in bindings.exists_names


def _find_exists_name(node: ast.AST, bindings: _FilterBindings) -> typing.Optional[str]:
    for child in ast.walk(node):
        if _is_exists_name(child, bindings):
            return child.id
    return None


def _raise_invalid_exists_name_usage(name: str) -> typing.NoReturn:
    raise SyntaxError(f"`{name}` can only be used as the right-hand side of `in` or `not in`")


class _ExistsNameUsageValidator(ast.NodeVisitor):
    def __init__(self, bindings: _FilterBindings) -> None:
        self._bindings = bindings

    def visit_Compare(self, node: ast.Compare) -> None:
        if len(node.comparators) != 1:
            if name := _find_exists_name(node, self._bindings):
                _raise_invalid_exists_name_usage(name)
            self.generic_visit(node)
            return
        op = node.ops[0]
        comparator = node.comparators[0]
        if _is_exists_name(comparator, self._bindings):
            if isinstance(op, (ast.In, ast.NotIn)) and not _find_exists_name(
                node.left, self._bindings
            ):
                self.visit(node.left)
                return
            _raise_invalid_exists_name_usage(comparator.id)
        if name := _find_exists_name(node, self._bindings):
            _raise_invalid_exists_name_usage(name)
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if _is_exists_name(node, self._bindings):
            _raise_invalid_exists_name_usage(node.id)


def _validate_exists_name_usage(expression: ast.Expression, bindings: _FilterBindings) -> None:
    if bindings.exists_names:
        _ExistsNameUsageValidator(bindings).visit(expression.body)


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


def _nullif_zero(node: typing.Any) -> ast.Call:
    """Wrap a division denominator so a zero value compiles to SQL ``NULL``.

    ``x / 0`` diverges by dialect — PostgreSQL raises ``division by zero`` while SQLite yields
    ``NULL``. Aggregate denominators coalesce to 0 (e.g. ``total_cost`` on a session with no cost
    config, ``num_traces`` on a retention-orphaned session), so a bare ratio predicate hits this.
    Routing the denominator through ``nullif(y, 0)`` makes ``y == 0`` yield ``NULL`` on both
    dialects; the outer comparison is then ``NULL`` and the row is excluded consistently.
    """
    return ast.Call(
        func=ast.Name(id="nullif", ctx=ast.Load()),
        args=[node, ast.Constant(value=0)],
        keywords=[],
    )


def _is_string(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Name)
        and node.id in bindings.string_names
        or _is_cast(node, "String")
        or _is_string_constant(node)
        or _is_string_attribute(node)
        or isinstance(node, (ast.List, ast.Tuple))
        and len(node.elts) > 0
        and _is_string(node.elts[0], bindings)
    )


def _is_float(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Call]:
    return (
        isinstance(node, ast.Name)
        and (node.id in bindings.float_names or node.id in bindings.aggregate_names)
        or _is_cast(node, "Float")
        or _is_float_constant(node)
        or _is_float_attribute(node)
        or isinstance(node, (ast.List, ast.Tuple))
        and len(node.elts) > 0
        and _is_float(node.elts[0], bindings)
        or isinstance(node, ast.BinOp)
        and (
            not isinstance(node.op, ast.Add)
            or (_is_float(node.left, bindings) or _is_float(node.right, bindings))
        )
        or isinstance(node, ast.UnaryOp)
        and isinstance(node.op, (ast.USub, ast.UAdd))
    )


_CAST_FUNCTIONS: tuple[str, ...] = ("str", "float", "int")


class _ProjectionTranslator(ast.NodeTransformer):
    def __init__(
        self,
        reserved_keywords: typing.Iterable[str] = (),
        bindings: _FilterBindings = SPAN_BINDINGS,
    ) -> None:
        self._bindings = bindings
        self._reserved_keywords = frozenset(
            chain(
                reserved_keywords,
                bindings.string_names.keys(),
                bindings.float_names.keys(),
                bindings.datetime_names.keys(),
                bindings.aggregate_names,
                bindings.exists_names,
            )
        )

    def visit_generic(self, node: ast.AST) -> typing.Any:
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")

    def visit_Expression(self, node: ast.Expression) -> typing.Any:
        return ast.Expression(body=self.visit(node.body))

    def visit_Attribute(self, node: ast.Attribute) -> typing.Any:
        source_segment = ast.unparse(node)
        if replacement := self._bindings.legacy_replacements.get(source_segment):
            return ast.Name(id=replacement, ctx=ast.Load())
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {source_segment}")

    def visit_Name(self, node: ast.Name) -> typing.Any:
        source_segment = ast.unparse(node)
        if source_segment in self._reserved_keywords:
            return node
        if self._bindings.reject_unbound_names:
            choice, score = _find_best_match(source_segment, self._bindings.binding_names)
            suggestion = f', did you mean "{choice}"?' if choice and score > 0.75 else ""
            raise SyntaxError(f"invalid name `{source_segment}`{suggestion}")
        return _as_attribute([ast.Constant(value=source_segment, kind=None)])

    def visit_Subscript(self, node: ast.Subscript) -> typing.Any:
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")


class _FilterTranslator(_ProjectionTranslator):
    def visit_Compare(self, node: ast.Compare) -> typing.Any:
        if len(node.comparators) == 1 and _is_exists_name(
            comparator := node.comparators[0], self._bindings
        ):
            op = node.ops[0]
            if not isinstance(op, (ast.In, ast.NotIn)):
                _raise_invalid_exists_name_usage(comparator.id)
            left = self.visit(node.left)
            call = ast.Call(
                func=ast.Name(id=comparator.id, ctx=ast.Load()),
                args=[left],
                keywords=[],
            )
            if isinstance(op, ast.NotIn):
                call = ast.Call(func=ast.Name(id="not_", ctx=ast.Load()), args=[call], keywords=[])
            return call
        if name := _find_exists_name(node, self._bindings):
            _raise_invalid_exists_name_usage(name)
        if len(node.comparators) > 1:
            args: list[typing.Any] = []
            left = node.left
            for i, (op, comparator) in enumerate(zip(node.ops, node.comparators)):
                args.append(self.visit(ast.Compare(left=left, ops=[op], comparators=[comparator])))
                left = comparator
            return ast.Call(func=ast.Name(id="and_", ctx=ast.Load()), args=args, keywords=[])
        left, op, right = self.visit(node.left), node.ops[0], self.visit(node.comparators[0])
        if _is_uppercase_name(left, self._bindings):
            right = _convert_to_uppercase(right)
        elif _is_uppercase_name(right, self._bindings):
            left = _convert_to_uppercase(left)
        if _is_subscript(left, "attributes"):
            left = (
                _as_bool_attribute(left) if _is_bool_constant(right) else _cast_as("String", left)
            )
        if _is_subscript(right, "attributes"):
            right = (
                _as_bool_attribute(right) if _is_bool_constant(left) else _cast_as("String", right)
            )
        if _is_float(left, self._bindings) and not _is_float(right, self._bindings):
            right = _cast_as("Float", right)
        elif not _is_float(left, self._bindings) and _is_float(right, self._bindings):
            left = _cast_as("Float", left)
        if isinstance(op, (ast.In, ast.NotIn)):
            if _is_string_attribute(right) or ast.unparse(right) in self._bindings.names:
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
            if not _is_float(node.operand, self._bindings):
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
        if (
            not isinstance(op, ast.Add)
            or _is_float(left, self._bindings)
            or _is_float(right, self._bindings)
        ):
            type_ = "Float"
            if not _is_float(left, self._bindings):
                left = _cast_as(type_, left)
            if not _is_float(right, self._bindings):
                right = _cast_as(type_, right)
            if isinstance(op, (ast.Div, ast.FloorDiv, ast.Mod)):
                right = _nullif_zero(right)
            return ast.BinOp(left=left, op=op, right=right)
        return _cast_as(type_, ast.BinOp(left=left, op=op, right=right))

    def visit_Call(self, node: ast.Call) -> typing.Any:
        source_segment = ast.unparse(node)
        if len(node.args) != 1:
            raise SyntaxError(f"invalid expression: {source_segment}")
        allowed_calls = (*_CAST_FUNCTIONS, *self._bindings.quantifiers)
        if not isinstance(node.func, ast.Name) or node.func.id not in allowed_calls:
            raise SyntaxError(f"invalid expression: {ast.unparse(node.func)}")
        arg = self.visit(node.args[0])
        if node.func.id in ("float", "int") and not _is_float(arg, self._bindings):
            return _cast_as("Float", arg)
        if node.func.id in ("str",) and not _is_string(arg, self._bindings):
            return _cast_as("String", arg)
        return arg


def _validate_expression(
    expression: ast.Expression,
    bindings: _FilterBindings = SPAN_BINDINGS,
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
    _validate_exists_name_usage(expression, bindings)
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
            and node.func.id in (*_CAST_FUNCTIONS, *bindings.quantifiers)
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
    bindings: _FilterBindings = SPAN_BINDINGS,
) -> tuple[
    str,
    tuple[AliasedAnnotationRelation, ...],
]:
    """
    Substitutes `evals[<eval-name>].<attribute>` with aliases. Returns the
    updated source code in addition to the aliased relations. ``bindings`` selects
    the annotation model and alias prefix (span vs. session grain).

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

    def _relation(index: int, name: str) -> AliasedAnnotationRelation:
        return AliasedAnnotationRelation(
            index=index,
            name=name,
            annotation_model=bindings.annotation_model,
            table_prefix=bindings.annotation_table_prefix,
        )

    eval_aliases: dict[AnnotationName, AliasedAnnotationRelation] = {}
    for (
        annotation_expression,
        _annotation_type,
        annotation_name,
        annotation_attribute,
    ) in _parse_annotation_expressions_and_names(source):
        if (eval_alias := eval_aliases.get(annotation_name)) is None:
            eval_alias = _relation(len(eval_aliases), annotation_name)
            eval_aliases[annotation_name] = eval_alias
        alias_name = eval_alias.attribute_alias(annotation_attribute)
        source = source.replace(annotation_expression, alias_name)

    for match in EVAL_NAME_PATTERN.finditer(source):
        annotation_expression, _, quoted_eval_name = match.groups()
        annotation_name = quoted_eval_name[1:-1]
        if (eval_alias := eval_aliases.get(annotation_name)) is None:
            eval_alias = _relation(len(eval_aliases), annotation_name)
            eval_aliases[annotation_name] = eval_alias
        alias_name = eval_alias._exists_attribute_alias
        source = source.replace(annotation_expression, alias_name)
    return source, tuple(eval_aliases.values())


def _parse_annotation_expressions_and_names(
    source: str,
) -> typing.Iterator[
    tuple[AnnotationExpression, AnnotationType, AnnotationName, AnnotationAttribute]
]:
    """
    Parses filter conditions for evaluation expressions of the form:

    ```
    evals["<eval-name>"].<attribute>
    annotations["eval-name"].<attribute>
    ```
    """
    for match in EVAL_EXPRESSION_PATTERN.finditer(source):
        (
            annotation_expression,
            _annotation_type,
            quoted_eval_name,
            evaluation_attribute_name,
        ) = match.groups()
        annotation_type = typing.cast(AnnotationType, _annotation_type)
        yield (
            annotation_expression,
            annotation_type,
            quoted_eval_name[1:-1],
            typing.cast(AnnotationAttribute, evaluation_attribute_name),
        )
