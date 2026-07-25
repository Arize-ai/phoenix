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
    _exists_attribute_alias: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        table_alias = f"span_annotation_{self.index}"
        alias_id = uuid4().hex
        label_attribute_alias = f"{table_alias}_label_{alias_id}"
        score_attribute_alias = f"{table_alias}_score_{alias_id}"
        exists_attribute_alias = f"{table_alias}_exists_{alias_id}"

        table = aliased(models.SpanAnnotation, name=table_alias)
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

# The reserved `parent_span` keyword refers to a span's parent span (the span whose
# `span_id` equals this span's `parent_id`). Only `parent_span is None` /
# `parent_span is not None` are supported (root-ness by parent existence); the
# translator rewrites those into references to the names below, which are bound
# to correlated `EXISTS` predicates in `SpanFilter.__call__`.
_PARENT_KEYWORD = "parent_span"
_PARENT_IS_NULL = "__parent_is_null__"
_PARENT_IS_NOT_NULL = "__parent_is_not_null__"

_STRICT_ROOT_KEYWORD = "parent_id"


RootSpanScope = typing.Literal["strict", "orphan_aware"]
"""Which definition of "root span" a filter condition restricts to.

The two are nested rather than alternatives, and the order matters when
comparing them: ``"strict"`` (`parent_id is None` -- only spans with no parent
pointer) selects a subset of ``"orphan_aware"`` (`parent_span is None` -- no
parent pointer, or a pointer to a span absent from the table).
"""


@dataclass(frozen=True)
class SpanFilter:
    condition: str = ""
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    root_scope: typing.Optional[RootSpanScope] = field(init=False, repr=False)
    _aliased_annotation_relations: tuple[AliasedAnnotationRelation] = field(init=False, repr=False)
    _aliased_annotation_attributes: dict[str, Mapped[typing.Any]] = field(init=False, repr=False)

    def __bool__(self) -> bool:
        return bool(self.condition)

    def __post_init__(self) -> None:
        object.__setattr__(self, "root_scope", None)
        if not (source := self.condition):
            return
        try:
            root = ast.parse(source, mode="eval")
            _validate_expression(root, valid_eval_names=self.valid_eval_names)
            # Derived from the tree parsed just above rather than from the source
            # again, so a caller holding a filter is spared a parse of its own.
            # Taken after validation so that a filter which escapes this
            # constructor always carries the scope of a condition known to be
            # valid, and so that invalid input is not analyzed for nothing.
            object.__setattr__(self, "root_scope", _scope_or_none(root.body))
            source, aliased_annotation_relations = _apply_eval_aliasing(source)
            root = ast.parse(source, mode="eval")
            translated = _FilterTranslator(
                reserved_keywords=(
                    alias
                    for aliased_annotation in aliased_annotation_relations
                    for alias, _ in aliased_annotation.attributes
                ),
            ).visit(root)
            ast.fix_missing_locations(translated)
            compiled = compile(translated, filename="", mode="eval")
        except RecursionError:
            # Input nested deeply enough to exhaust the stack, which every stage
            # above is vulnerable to -- the parser, the translator, and
            # `compile` all recurse. A condition arrives from the API, so this
            # has to read as a malformed filter like any other rather than
            # escaping as a crash from whichever stage happened to run out
            # first.
            raise SyntaxError("filter condition is nested too deeply") from None
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
        # `parent_span is None` / `parent_span is not None` select spans whose parent span does
        # not / does exist. A correlated `NOT EXISTS` is used deliberately: it is true
        # both when `parent_id` is NULL and when it points to a span absent from the
        # table (an orphan), and it is the shape the existing root query uses to avoid
        # a measured PostgreSQL regression (see `query.py`). An `OR ... parent_id IS
        # NULL` form is intentionally NOT used here.
        parent_span = aliased(models.Span)
        parent_exists = (
            sqlalchemy.select(1).where(parent_span.span_id == models.Span.parent_id).exists()
        )
        return self._join_aliased_relations(select).where(
            eval(
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
                    _PARENT_IS_NULL: ~parent_exists,
                    _PARENT_IS_NOT_NULL: parent_exists,
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


def root_span_scope(condition: str) -> typing.Optional[RootSpanScope]:
    """
    The root-span restriction `condition` imposes, or ``None`` if it imposes
    none.

    The test is whether a root predicate binds every row the condition can
    match, not where it sits in the expression. A conjunct qualifies; so does a
    branch of an `or` when every other branch is root-scoped too, since a row
    need satisfy only one of them; so does a predicate under `not` whose
    negation restricts (`not (parent_id is not None)`). Where several
    restrictions apply, conjoined ones compound to the narrowest and disjoined
    ones union to the widest.

    Recognition is deliberately incomplete: it covers the boolean structure of
    the expression and nothing more, so equivalent-but-unrecognized rewritings
    fall to ``None``. That is the safe direction -- see the note on soundness
    below. An unparseable condition, an expression still being typed say, also
    yields ``None`` rather than raising.

    Soundness is the invariant that matters: a non-``None`` answer is a
    guarantee that every matching row is a root span, never a guess.

    This answers one question, from the condition alone: what does this
    condition decide? Callers layer their own question on top. A client asking
    "is this view root-scoped?" -- to choose between cumulative and per-span
    metric columns, say -- only needs to know whether the answer is ``None``. A
    query builder that also has a `root_spans_only` flag compares the two and
    can drop its flag when this scope is at least as narrow, which is worth
    doing because applying both means paying for two correlated subqueries
    (and, in the orphan-aware branch, a CTE over `spans`) that select what one
    of them already selects.
    """
    if not condition.strip():
        return None
    try:
        body = ast.parse(condition, mode="eval").body
    except SyntaxError:
        return None
    except RecursionError:
        # Deeply nested input, e.g. a long chain of `not`. Both the parser and
        # the walk below recurse, and this entry point takes arbitrary strings
        # straight from the API, so exhausting the stack has to read as "cannot
        # tell" rather than escaping to the caller.
        return None
    return _scope_or_none(body)


def _scope_or_none(body: ast.expr) -> typing.Optional[RootSpanScope]:
    """`_scope` with stack exhaustion folded into the unrecognized case."""
    try:
        return _scope(body, negated=False)
    except RecursionError:
        return None


def _scope(node: ast.expr, *, negated: bool) -> typing.Optional[RootSpanScope]:
    """The restriction imposed by `node`, or by ``not node`` when `negated`.

    Carrying the polarity down the walk is negation-normal form applied lazily:
    rather than rewriting every `not` toward the leaves and then traversing the
    result, the traversal itself flips sense as it passes a `not`. Under a
    flipped sense `and` and `or` trade places -- which is De Morgan -- so each
    connective's rule is stated once rather than once per polarity.
    """
    if (scope := _leaf_scope(node, negated=negated)) is not None:
        return scope
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return _scope(node.operand, negated=not negated)
    if isinstance(node, ast.Compare) and len(node.ops) > 1:
        # A chained comparison is a conjunction of its links: `a is b is c` is
        # `(a is b) and (b is c)`, which is how the translator compiles it too.
        return _combine(_comparison_links(node), negated=negated, conjunction=not negated)
    if isinstance(node, ast.BoolOp):
        conjunction = isinstance(node.op, ast.And) is not negated
        return _combine(node.values, negated=negated, conjunction=conjunction)
    return None


def _combine(
    parts: typing.Sequence[ast.expr],
    *,
    negated: bool,
    conjunction: bool,
) -> typing.Optional[RootSpanScope]:
    """Folds the restrictions of `parts` under one connective."""
    scopes = [_scope(part, negated=negated) for part in parts]
    if conjunction:
        # One restricting part bounds the whole, since a conjunction only
        # narrows, so an unrestricting part drops out rather than disqualifying
        # the result. Where several restrict, they compound to the narrowest.
        restricting = [scope for scope in scopes if scope is not None]
        if not restricting:
            return None
        return "strict" if "strict" in restricting else "orphan_aware"
    # A row need satisfy only one part, so every part must restrict or the
    # result admits unrestricted rows. What remains unions, so the widest wins.
    if any(scope is None for scope in scopes):
        return None
    return "orphan_aware" if "orphan_aware" in scopes else "strict"


def _comparison_links(node: ast.Compare) -> list[ast.Compare]:
    """Splits a chained comparison into its pairwise links."""
    links = []
    left = node.left
    for op, comparator in zip(node.ops, node.comparators):
        links.append(ast.Compare(left=left, ops=[op], comparators=[comparator]))
        left = comparator
    return links


def _leaf_scope(node: ast.expr, *, negated: bool) -> typing.Optional[RootSpanScope]:
    if _matches_no_rows(node, negated=negated):
        # An expression that can never be TRUE returns nothing, and every row of
        # an empty result is vacuously a root span. `"strict"` is the narrowest
        # such claim and so the strongest sound one, which is also what makes
        # constant folding unnecessary: a never-TRUE branch of an `or` cannot
        # widen anything and so drops out on its own, and a never-TRUE conjunct
        # makes the whole conjunction empty.
        return "strict"
    return _root_predicate_scope(node, negated=negated)


def _matches_no_rows(node: ast.expr, *, negated: bool) -> bool:
    """Whether `node` -- or ``not node`` when `negated` -- is a literal that can
    never be TRUE, and so returns no rows.

    `False` and `None` are both never TRUE, but they diverge under negation:
    `not False` is always TRUE, while `not None` is NULL, which is still never
    TRUE. So `None` returns nothing in either sense, and `True`/`False` swap.
    """
    if not isinstance(node, ast.Constant):
        return False
    if node.value is None:
        return True
    return node.value is (True if negated else False)


_ROOT_PREDICATE_SCOPES: typing.Mapping[str, RootSpanScope] = {
    _PARENT_KEYWORD: "orphan_aware",
    _STRICT_ROOT_KEYWORD: "strict",
}


def _root_predicate_scope(
    node: ast.expr,
    *,
    negated: bool = False,
) -> typing.Optional[RootSpanScope]:
    # `parent_span is None` / `parent_id is None` (and the `==` spellings), in
    # either operand order. Under `negated`, the inverted spellings are matched
    # instead, so a predicate under `not` maps to the scope it restricts to.
    if not isinstance(node, ast.Compare) or len(node.ops) != 1:
        return None
    accepted = (ast.IsNot, ast.NotEq) if negated else (ast.Is, ast.Eq)
    if not isinstance(node.ops[0], accepted):
        return None
    left, right = node.left, node.comparators[0]
    for name, other in ((left, right), (right, left)):
        if isinstance(name, ast.Name) and name.id in _ROOT_PREDICATE_SCOPES:
            return _ROOT_PREDICATE_SCOPES[name.id] if _is_none_constant(other) else None
    return None


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


def _is_parent_name(node: typing.Any) -> TypeGuard[ast.Name]:
    # the bare reserved keyword `parent_span`
    return isinstance(node, ast.Name) and node.id == _PARENT_KEYWORD


def _is_parent_rooted(node: typing.Any) -> bool:
    # an attribute/subscript chain rooted at the bare `parent_span` keyword, e.g.
    # `parent_span.span_kind`, `parent_span.a.b`, `parent_span.attributes['x']`.
    # (Not `attributes['parent_span']`, whose root is `attributes`.)
    while isinstance(node, (ast.Attribute, ast.Subscript)):
        node = node.value
    return _is_parent_name(node)


def _parent_traversal_error(node: ast.expr) -> SyntaxError:
    # `parent_span.<field>` traversal is not supported yet (a follow-up).
    return SyntaxError(
        f"`{ast.unparse(node)}` is not supported: `parent_span` traversal "
        "(`parent_span.<field>`) is not yet available; only `parent_span is None` "
        "and `parent_span is not None` are supported"
    )


def _is_none_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and node.value is None


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
    def visit_Name(self, node: ast.Name) -> typing.Any:
        if _is_parent_name(node):
            # A bare `parent_span` that reaches this point is not part of a supported
            # `parent_span is None` / `parent_span is not None` comparison (those are
            # intercepted in visit_Compare before their operands are visited).
            raise SyntaxError(
                "`parent_span` can only be used as `parent_span is None` "
                "or `parent_span is not None`"
            )
        return super().visit_Name(node)

    def visit_Attribute(self, node: ast.Attribute) -> typing.Any:
        self._reject_parent_traversal(node)
        return super().visit_Attribute(node)

    def visit_Subscript(self, node: ast.Subscript) -> typing.Any:
        self._reject_parent_traversal(node)
        return super().visit_Subscript(node)

    @staticmethod
    def _reject_parent_traversal(node: ast.expr) -> None:
        # The `parent_span` keyword is fully reserved: `parent_span.<field>` traversal is
        # not supported yet (a follow-up), so reject it clearly here rather than
        # letting it fall through to the pre-existing `attributes['parent_span'][...]`
        # attribute-path behavior, which would silently mean something else.
        if _is_parent_rooted(node):
            raise _parent_traversal_error(node)

    def _parent_root_predicate(self, node: ast.Compare) -> typing.Optional[ast.expr]:
        """
        Rewrites `parent_span is None` / `parent_span == None` into a root-existence
        predicate (and the negations into non-root). Returns ``None`` when the
        comparison does not involve the bare `parent_span` keyword.
        """
        op = node.ops[0]
        left, right = node.left, node.comparators[0]
        if _is_parent_name(left):
            other = right
        elif _is_parent_name(right):
            other = left
        else:
            return None
        if not _is_none_constant(other):
            raise SyntaxError(
                "`parent_span` can only be compared to None (e.g. `parent_span is None`)"
            )
        if isinstance(op, (ast.Is, ast.Eq)):
            return ast.Name(id=_PARENT_IS_NULL, ctx=ast.Load())
        if isinstance(op, (ast.IsNot, ast.NotEq)):
            return ast.Name(id=_PARENT_IS_NOT_NULL, ctx=ast.Load())
        raise SyntaxError("`parent_span` supports only `is` / `is not` (or `==` / `!=`) with None")

    def visit_Compare(self, node: ast.Compare) -> typing.Any:
        if len(node.ops) == 1 and (predicate := self._parent_root_predicate(node)) is not None:
            return predicate
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
            if _is_string_attribute(right) or ast.unparse(right) in _NAMES:
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
        elif isinstance(node, (ast.Attribute, ast.Subscript)) and _is_parent_rooted(node):
            # `parent_span.<field>` traversal is not supported yet (the `parent_span`
            # keyword is fully reserved); reject with a clear message rather than
            # the generic "invalid expression" below. Bare `parent_span` (valid in
            # `parent_span is None`) is a Name, not matched here.
            raise _parent_traversal_error(node)
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
    eval_aliases: dict[AnnotationName, AliasedAnnotationRelation] = {}
    for (
        annotation_expression,
        _annotation_type,
        annotation_name,
        annotation_attribute,
    ) in _parse_annotation_expressions_and_names(source):
        if (eval_alias := eval_aliases.get(annotation_name)) is None:
            eval_alias = AliasedAnnotationRelation(index=len(eval_aliases), name=annotation_name)
            eval_aliases[annotation_name] = eval_alias
        alias_name = eval_alias.attribute_alias(annotation_attribute)
        source = source.replace(annotation_expression, alias_name)

    for match in EVAL_NAME_PATTERN.finditer(source):
        annotation_expression, _, quoted_eval_name = match.groups()
        annotation_name = quoted_eval_name[1:-1]
        if (eval_alias := eval_aliases.get(annotation_name)) is None:
            eval_alias = AliasedAnnotationRelation(index=len(eval_aliases), name=annotation_name)
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
