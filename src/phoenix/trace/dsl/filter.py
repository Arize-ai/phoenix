import ast
import math
import re
import typing
from dataclasses import dataclass, field
from datetime import datetime
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
from phoenix.db.models import SafeJsonBoolean, SafeJsonFloat

_VALID_EVAL_ATTRIBUTES: tuple[str, ...] = ("score", "label", "explanation")


AnnotationAttribute: TypeAlias = typing.Literal["explanation", "label", "score"]
AnnotationName: TypeAlias = str


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

# The scalar fields a user may reference as a *bare identifier* -- exactly the
# names `_ProjectionTranslator.visit_Name` passes through untouched. Every other
# bare identifier falls through to `attributes['<name>']` (the schemaless
# contract). This set is therefore both the allow-list that suppresses a
# spurious warning and the suggestion vocabulary a near-miss is matched against.
# Dotted attribute fields (`_FLOAT_ATTRIBUTES`, e.g. `llm.token_count.total`)
# are deliberately excluded: they are never bare `ast.Name` nodes, so they can
# neither trigger nor repair a bare-identifier warning.
_BARE_FIELD_NAMES: frozenset[str] = frozenset(
    chain(_STRING_NAMES.keys(), _FLOAT_NAMES.keys(), _DATETIME_NAMES.keys())
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


class SpanFilterError(SyntaxError):
    """An invalid span filter condition supplied by a caller."""


@dataclass(frozen=True)
class SpanFilter:
    condition: str = ""
    translated: ast.Expression = field(init=False, repr=False)
    compiled: typing.Any = field(init=False, repr=False)
    root_scope: typing.Optional[RootSpanScope] = field(init=False, repr=False)
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
        except RecursionError:
            # Input nested deeply enough to exhaust the stack, which every stage
            # above is vulnerable to -- the parser, the translator, and
            # `compile` all recurse. A condition arrives from the API, so this
            # has to read as a malformed filter like any other rather than
            # escaping as a crash from whichever stage happened to run out
            # first.
            raise SpanFilterError("filter condition is nested too deeply") from None
        except SyntaxError as error:
            raise SpanFilterError(_format_syntax_error(error)) from error

    def _initialize(self) -> None:
        object.__setattr__(self, "root_scope", None)
        # Normalize the condition itself rather than a local copy, so that
        # `condition` and `to_dict()` expose the canonical text. Two spellings
        # that differ only in surrounding whitespace mean the same thing, and a
        # caller persisting or de-duplicating conditions should not have to
        # discover that on its own -- identity is only well defined if the
        # stored form is canonical.
        #
        # Stripping also avoids a poor error: Python reads a leading space as
        # indentation and fails with `IndentationError`. Accepting more input is
        # safe under the additive-only compatibility policy.
        object.__setattr__(self, "condition", self.condition.strip())
        if not (source := self.condition):
            return
        try:
            root = ast.parse(source, mode="eval")
        except ValueError as error:
            # A NUL anywhere in the source, which `ast.parse` reports as a
            # `ValueError` rather than a `SyntaxError`. Callers catch only the
            # latter, so it would escape as a server error.
            raise SyntaxError("condition cannot contain a NUL character") from error
        _validate_expression(root, source)
        # Derived from the tree parsed just above rather than from the source
        # again, so a caller holding a filter is spared a parse of its own.
        # Taken after validation so that a filter which escapes this
        # constructor always carries the scope of a condition known to be
        # valid, and so that invalid input is not analyzed for nothing.
        object.__setattr__(self, "root_scope", _scope_or_none(root.body))
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
                    **self._literal_bindings,
                    "not_": sqlalchemy.not_,
                    "and_": sqlalchemy.and_,
                    "or_": sqlalchemy.or_,
                    "nullif": sqlalchemy.func.nullif,
                    "cast": sqlalchemy.cast,
                    "Float": sqlalchemy.Float,
                    "String": sqlalchemy.String,
                    "SafeJsonBoolean": SafeJsonBoolean,
                    "SafeJsonFloat": SafeJsonFloat,
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
    ) -> "SpanFilter":
        return cls(condition=obj.get("condition") or "")

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
    # Normalize exactly as `SpanFilter` does at construction, so the two entry
    # points always analyze the same text. They diverged here once: a leading
    # space parses as an `IndentationError`, so `" parent_id is None "`
    # validated (stripped) while this function reported `None` (unstripped) --
    # and the UI chose metric columns from the wrong verdict.
    if not (condition := condition.strip()):
        return None
    try:
        body = ast.parse(condition, mode="eval").body
    except (SyntaxError, ValueError):
        # `ValueError` is a NUL in the source. This entry point takes arbitrary
        # strings from the API, so anything unparseable reads as "cannot tell".
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
        # The same inherited-Python-surface rules `SpanFilter` applies --
        # notably the NFKC check: a full-width projection name silently
        # resolved to the ASCII field the user never spelled, exactly the
        # confusable-identifier hazard the filter side already rejects.
        _validate_python_surface(root.body, source)
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
        f"`{_ellipsize(ast.unparse(node), 80)}` is not supported: `parent_span` traversal "
        "(`parent_span.<field>`) is not yet available; only `parent_span is None` "
        "and `parent_span is not None` are supported"
    )


def _is_none_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and node.value is None


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


def _is_singleton_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    """`None`, `True`, `False` -- the only values Python's `is` is meaningful
    against, and the only ones SQL can express (`IS NULL`/`IS TRUE`/`IS FALSE`)."""
    return isinstance(node, ast.Constant) and (node.value is None or isinstance(node.value, bool))


def _is_bool_constant(node: typing.Any) -> TypeGuard[ast.Constant]:
    return isinstance(node, ast.Constant) and isinstance(node.value, bool)


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


def _require_condition(node: ast.expr) -> None:
    """Require `node` to be a condition rather than a value.

    Each operand of `and` / `or` / `not` becomes an argument of SQL `AND` / `OR`
    / `NOT`, which only accepts a predicate. A value in that position is
    accepted by Python's grammar and by the structural pass, so without this it
    reaches the database, and the two backends disagree about what happens
    next: PostgreSQL rejects the statement (`argument of AND must be type
    boolean, not type jsonb`) while SQLite coerces to a truth value and quietly
    returns the wrong rows.

    Unknown-typed operands -- a bare JSON attribute such as `metadata['flag']`
    -- are deliberately included. Their type cannot be known statically, so
    allowing them as truthy values is what let the raw JSON through in the
    first place. Truthiness is not offered as an explicit cast either: the
    overwhelmingly common source of this shape is a half-typed expression
    (`name == 'x' and ` plus one more character), and reporting that as an
    error is more useful than silently filtering on whatever was typed.

    `_get_filter_value_type` already answers this exactly -- it returns
    ``"boolean"`` for comparisons, logical expressions, boolean literals, and
    bare annotations (an existence check) -- so this is a use of that judgment,
    not a second one.
    """
    if _get_filter_value_type(node) == "boolean":
        return
    # Bounded at the format site: this fragment *precedes* the advice, so the
    # whole-message backstop cannot protect the guidance here.
    source_segment = _ellipsize(ast.unparse(node), 80)
    raise SyntaxError(
        f"`{source_segment}` is not a condition"
        f", expected a comparison such as `{source_segment} == ...`"
    )


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
            # `int()` is an alias for `float()` and does not truncate, so
            # `int(1.9)` compares against 1.9. It is kept rather than corrected:
            # truncation cannot be expressed portably (`CAST(x AS INTEGER)`
            # rounds on PostgreSQL, 1.9 -> 2, and truncates on SQLite, 1.9 -> 1),
            # and the name is already load-bearing in the SpanQuery surface. The
            # behavior is documented rather than changed.
            if len(node.args) != 1:
                raise SyntaxError(f"invalid expression: {ast.unparse(node)}")
            argument = node.args[0]
            if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
                # The same grammar as an implicitly-cast numeric string, so an
                # explicit cast cannot smuggle in a literal the databases
                # disagree about (`float('1_000')`, `float('nan')`).
                if not _is_numeric_string(argument.value):
                    raise SyntaxError("cannot cast string to number")
                # The grammar bounds the spelling, not the magnitude:
                # `float('1e400')` passes it and overflows to `inf`, the exact
                # value the literal rule rejects. Check the converted value,
                # not the text.
                if not _is_finite_number(argument.value):
                    raise SyntaxError(f"invalid numeric literal: {argument.value}")
            elif _get_filter_value_type(argument) == "string":
                raise SyntaxError("cannot cast string to number")
            elif _get_filter_value_type(argument) == "boolean":
                # `CAST(true AS FLOAT)` is rejected by PostgreSQL, and the cast
                # compiles either way, so the condition validated and then
                # failed when the query ran.
                raise SyntaxError("cannot cast boolean to number")
            continue
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "str":
            if len(node.args) != 1:
                raise SyntaxError(f"invalid expression: {ast.unparse(node)}")
            argument = node.args[0]
            argument_type = _get_filter_value_type(argument)
            if argument_type == "boolean":
                # `true`/`false` on PostgreSQL, `1`/`0` on SQLite, so the same
                # condition matches opposite rows. Arrives as a literal
                # (`str(True)`) or as any boolean-valued expression, notably the
                # annotation existence check, which compiles to `CASE WHEN ...
                # THEN <bind> ELSE <bind> END` over Python bools.
                raise SyntaxError("cannot cast boolean to text")
            if argument_type == "number":
                # A float renders its integral values differently -- PostgreSQL
                # prints 1.0 as `1`, SQLite as `1.0` -- so `str(score) == '1'`
                # matches on one backend only. The divergence is *per value*:
                # 0.1 agrees and 1.0 does not, which means no fixture of
                # convenient numbers can find it and no user can predict it.
                raise SyntaxError("cannot cast number to text")
            if argument_type == "datetime":
                # No shared spelling at all: PostgreSQL renders in the session
                # time zone (`2025-12-31 16:00:00-08`) and SQLite in UTC with
                # microseconds (`2026-01-01 00:00:00.000000`) -- different
                # format and a different instant on the page.
                raise SyntaxError("cannot cast datetime to text")
            if isinstance(argument, ast.Constant) and not isinstance(argument.value, str):
                raise SyntaxError(
                    f"cannot cast the literal {_ellipsize(ast.unparse(argument), 80)} to text"
                    ", the backends spell it differently"
                )
            continue
        if isinstance(node, ast.BoolOp):
            for value in node.values:
                _require_condition(value)
            continue
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            _require_condition(node.operand)
            continue
        if not isinstance(node, ast.Compare):
            continue
        left = node.left
        for operator, right in zip(node.ops, node.comparators):
            if isinstance(operator, (ast.Lt, ast.LtE, ast.Gt, ast.GtE)) and "boolean" in (
                _get_filter_value_type(left),
                _get_filter_value_type(right),
            ):
                # `attributes['x'] > False` validated and then crashed at
                # *evaluation* -- SQLAlchemy refuses to order against a raw
                # True/False -- which happens in `SpanFilter.__call__`, outside
                # the error boundary, so it surfaced as a server error rather
                # than a filter error. Ordering a boolean is a confusion with a
                # clearer spelling in every case, so the rule is by type: it
                # also covers boolean-valued expressions like the bare
                # annotation existence check.
                raise SyntaxError(
                    f"`{_ellipsize(ast.unparse(node), 80)}` orders a boolean"
                    ", use `==`, `!=`, or `is` instead of `<` / `>`"
                )
            if isinstance(operator, (ast.Is, ast.IsNot)) and not (
                _is_singleton_constant(left) or _is_singleton_constant(right)
            ):
                # Python's `is` is only meaningful against the singletons, and
                # those are exactly the ones SQL can express: `IS NULL`,
                # `IS TRUE`, `IS FALSE`. Against any other value it silently
                # degrades to `==`, so `name is 'abc'` compiles to something the
                # user did not write.
                raise SyntaxError(
                    f"`{_ellipsize(ast.unparse(node), 80)}` uses `is` with a value"
                    ", which SQL cannot express; use `==`, or `is` with None/True/False"
                )
            if not isinstance(operator, (ast.In, ast.NotIn)) and isinstance(
                left if isinstance(left, (ast.List, ast.Tuple)) else right, (ast.List, ast.Tuple)
            ):
                # A collection is only meaningful on the right of `in`/`not in`.
                # Elsewhere it is bound whole as a scalar comparand, which no
                # column can equal.
                raise SyntaxError(
                    f"`{_ellipsize(ast.unparse(node), 80)}` compares against a collection"
                    ", which is only supported with `in` / `not in`"
                )
            if isinstance(operator, (ast.In, ast.NotIn)) and isinstance(
                right, (ast.List, ast.Tuple)
            ):
                for element in right.elts:
                    if isinstance(element, (ast.List, ast.Tuple)):
                        # A nested container has no scalar value to match a
                        # column against.
                        raise SyntaxError(
                            f"`{_ellipsize(ast.unparse(element), 80)}` is not a value"
                            ", collections cannot be nested"
                        )
                    if isinstance(element, ast.Constant) and element.value is None:
                        # SQL `IN` compares elements with `=`, and `= NULL` is
                        # never true, so a None element can never match --
                        # worse, `NOT IN ('a', NULL)` is never true for *any*
                        # row, silently emptying the result set.
                        raise SyntaxError(
                            f"`{_ellipsize(ast.unparse(node), 80)}` includes None"
                            ", which never matches in SQL"
                            "; test for missing values with `is None` / `is not None`"
                        )
                if isinstance(left, ast.Constant):
                    # Membership against a literal collection is translated to
                    # `left.in_(...)`, which needs `left` to be a column
                    # expression. A constant there reaches evaluation as
                    # `1.in_([1, 2])` and raises a bare `AttributeError` from
                    # inside `SpanFilter.__call__` -- the wrong exception type
                    # for what is simply an invalid condition.
                    raise SyntaxError(
                        f"`{_ellipsize(ast.unparse(node), 80)}` compares two literals"
                        ", expected a span field on the left"
                    )
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
    if "datetime" in (left_type, right_type) and None in (left_type, right_type):
        # An unknown-typed operand -- a JSON attribute -- has no datetime
        # reading either backend can perform: PostgreSQL has no comparison
        # operator between timestamp and varchar at all, so
        # `start_time > attributes['x']` validated and then failed at plan
        # time, while SQLite quietly compared text. No total datetime
        # conversion exists to define the shape with, so it is rejected;
        # only a datetime *literal* has a portable binding.
        raise SyntaxError(
            "cannot compare a datetime field and an attribute"
            ", use an ISO 8601 string literal (e.g. '2024-01-01T00:00:00+00:00')"
        )
    if (
        left_type is not None
        and right_type is not None
        and left_type != right_type
        and "null" not in (left_type, right_type)
    ):
        # A quoted number against a numeric field (`latency_ms > '100'`) is
        # rejected rather than coerced. The type of both sides is known here, so
        # there is nothing to infer -- and the coercion never worked on
        # PostgreSQL anyway: it bound the string as a float parameter, which
        # asyncpg refuses, so the condition validated and then failed when the
        # query ran. It only appeared to work because SQLite is loosely typed.
        # Users who want a string parsed as a number can say so with `float()`.
        hint = ""
        if {left_type, right_type} == {"number", "string"}:
            string_node = left if left_type == "string" else right
            # Only suggest dropping the quotes when doing so would actually be
            # valid. `score == ''` would otherwise read "write  instead of ''".
            if (
                isinstance(string_node, ast.Constant)
                and isinstance(string_node.value, str)
                and _is_numeric_string(string_node.value)
            ):
                hint = f", write {string_node.value} instead of '{string_node.value}'"
        raise SyntaxError(f"cannot compare {left_type} and {right_type}{hint}")


# A numeric string literal is cast to a number in SQL, so the accepted grammar
# has to be one both backends agree on. Python's `float()` is deliberately not
# used as the test: it also accepts `1_000`, `nan`, `inf`, and surrounding
# whitespace, none of which the two databases treat alike -- SQLite casts
# `'1_000'` to 1.0 while PostgreSQL rejects it, and the infinities and NaN have
# dialect-dependent behavior. Anything outside this grammar has to be written as
# an explicit `float(...)` cast, which is checked against the same rule.
_NUMERIC_STRING_PATTERN = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")


def _is_numeric_string(value: str) -> bool:
    # `fullmatch` rather than `match` with anchors: `$` would also accept a
    # trailing newline, which neither database does.
    return _NUMERIC_STRING_PATTERN.fullmatch(value) is not None


def _is_finite_number(value: typing.Union[int, float, str]) -> bool:
    """Whether the value converts to a finite float -- the portability bound
    every numeric spelling must satisfy, whatever its shape.

    One predicate on purpose: the bound was previously re-derived at each
    site, and two encodings of one rule drift -- `float('1e400')` passed the
    cast check (which tested only the spelling) while the literal rule
    rejected `1e400` (which tested the value). Every numeric admission point
    consults this instead.
    """
    try:
        return math.isfinite(float(value))
    except (OverflowError, ValueError):
        # `OverflowError`: an int too large for a float. `ValueError` cannot
        # arise from callers (they pre-check the spelling), but a total
        # predicate should not crash on a string it was never promised.
        return False


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


def _as_float_operand(node: ast.expr) -> ast.expr:
    """Coerce an operand being compared against a number.

    A numeric string *literal* is converted here rather than wrapped in a SQL
    cast. `cast('1000', Float)` binds the Python `str` as a float-typed
    parameter, which asyncpg refuses to encode -- `invalid input for query
    argument $1: '1000' (must be real number, not str)` -- so the condition
    validates and then fails when the query runs. Converting the literal makes
    it a real number before it is ever bound.

    Dynamic values still take the cast, which is total by construction
    (`SafeJsonFloat`), so an uncastable row excludes itself rather than
    aborting the statement.
    """
    if (
        isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and _is_numeric_string(node.value)
    ):
        # A spelling within the grammar can still overflow (`'1e400'` -> inf).
        # The cast validation already rejects the shapes it sees; checking the
        # converted value here keeps the guarantee local to the conversion
        # rather than trusting every caller to have validated first.
        if not _is_finite_number(node.value):
            raise SyntaxError(f"invalid numeric literal: {node.value}")
        return ast.Constant(value=float(node.value), kind=None)
    return _cast_as("Float", node)


def _is_json_attribute(node: typing.Any) -> TypeGuard[ast.Subscript]:
    """An unknown-typed JSON operand: a subscript rooted at `attributes`.

    Every syntactic gate that decides JSON behavior -- String casting, the
    ordered-comparison numeric conversion -- consults this one predicate, so a
    future namespace (`parent_span.<column>` traversal) has a single place to
    register its own JSON operands instead of auditing scattered
    `_is_subscript` calls. See principle 12 in the spec: this is the "derive
    both encodings from one source" remedy applied to the translator's gates.
    """
    return _is_subscript(node, "attributes")


def _cast_as(
    type_: typing.Literal["Float", "String"],
    node: typing.Any,
) -> ast.Call:
    if type_ == "Float" and (_is_json_attribute(node) or _is_string_attribute(node)):
        return _as_float_attribute(node)
    if type_ == "String" and (_is_json_attribute(node) or _is_float_attribute(node)):
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
        if (
            isinstance(op, (ast.Lt, ast.LtE, ast.Gt, ast.GtE))
            and _is_json_attribute(left)
            and _is_json_attribute(right)
        ):
            # An ordered comparison between two unknown JSON operands. Extracted
            # as text (the branch below), the backends order differently:
            # PostgreSQL compares the renderings, where `'9' > '10'` is true,
            # and SQLite compares native values, where `9 > 10` is false -- the
            # same stored numbers order oppositely. Order is only portable in
            # one type, so both sides take the total numeric conversion, exactly
            # as a comparison against a numeric literal would; a value with no
            # number in it becomes NULL and its row drops out.
            left, right = _as_float_attribute(left), _as_float_attribute(right)
        if _is_json_attribute(left):
            left = (
                _as_bool_attribute(left)
                if _is_bool_constant(right) or _is_bool_sequence(right)
                else _cast_as("String", left)
            )
        if _is_json_attribute(right):
            right = (
                _as_bool_attribute(right)
                if _is_bool_constant(left) or _is_bool_sequence(left)
                else _cast_as("String", right)
            )
        if _is_float(left) and not _is_float(right) and not _is_none_constant(right):
            if isinstance(op, (ast.In, ast.NotIn)) and isinstance(right, (ast.List, ast.Tuple)):
                # Coerce the elements, not the collection. Casting the collection
                # replaces the `List` node with a `Call`, which then misses the
                # membership branch below and lands on its `else` -- reported as
                # `invalid expression: ` (empty, because `ast.unparse` of a bare
                # operator is the empty string).
                elements: list[ast.expr] = [
                    element if _is_float(element) else _as_float_operand(element)
                    for element in right.elts
                ]
                right = (
                    ast.List(elts=elements, ctx=ast.Load())
                    if isinstance(right, ast.List)
                    else ast.Tuple(elts=elements, ctx=ast.Load())
                )
            else:
                right = _as_float_operand(right)
        elif not _is_float(left) and not _is_none_constant(left) and _is_float(right):
            left = _as_float_operand(left)
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
                # `ast.unparse` of a bare operator node is the empty string, so
                # naming the operator here produced `invalid expression: ` with
                # nothing after it. Report the comparison instead.
                keyword = "not in" if isinstance(op, ast.NotIn) else "in"
                raise SyntaxError(
                    f"`{keyword}` expects a collection or a text field on the right"
                    f", got `{ast.unparse(right)}`"
                )
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
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            # A naive literal has no single defensible meaning here. Phoenix's
            # own `datetime_utils` reads naive values as server-local, so
            # binding one would give the same saved filter a different boundary
            # in deployments with different timezones -- and filter conditions
            # travel in URLs. Reading it as UTC instead would be deterministic
            # but would silently disagree with that existing convention. Asking
            # for the offset is the only reading that cannot be wrong.
            raise SyntaxError(
                f"datetime literal {_ellipsize(source.value, 80)!r} has no timezone"
                ", add an offset (e.g. 'Z' for UTC)"
            )
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
            numeric = node.operand if _is_float(node.operand) else _cast_as("Float", node.operand)
            if isinstance(node.op, ast.UAdd):
                # Unary plus is the identity on a number, so it is dropped
                # rather than translated. Emitting it was wrong twice over: the
                # cast branch hardcoded `USub`, so `+attributes['x'] > 5`
                # silently filtered on the negation, and SQLAlchemy expressions
                # implement no `__pos__`, so keeping the operator raises
                # `bad operand type for unary +` when the filter is evaluated.
                return numeric
            return ast.UnaryOp(op=ast.USub(), operand=numeric)
        return node

    def visit_BinOp(self, node: ast.BinOp) -> typing.Any:
        left, op, right = self.visit(node.left), node.op, self.visit(node.right)
        if _is_json_attribute(left):
            left = _cast_as("String", left)
        if _is_json_attribute(right):
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
            # `_as_float_operand`, not `_cast_as`: a string literal has to be
            # converted here rather than wrapped in a SQL cast, or it is bound
            # as a float-typed parameter that asyncpg refuses to encode.
            return _as_float_operand(arg)
        if node.func.id in ("str",) and not _is_string(arg):
            return _cast_as("String", arg)
        return arg


def _format_syntax_error(error: SyntaxError) -> str:
    """Render a `SyntaxError` as a message about the condition.

    `str()` on a parser error appends the filename and line -- `invalid syntax
    (<unknown>, line 1)` -- which describes a file the user never wrote in.
    Half-typed input is the most common thing this language sees, so that
    wording is what most rejections would say.

    `msg` carries the useful part on its own, and `offset` gives the column,
    which is worth keeping: for a one-line condition it is the only thing that
    locates the problem. Errors raised inside this module have no offset and
    pass through as their message alone.
    """
    message = error.msg or "invalid syntax"
    if "null bytes" in message:
        # A NUL in the source. CPython reports it as `ValueError` on 3.10
        # (handled at the parse site) and as `SyntaxError` from 3.11 on;
        # either way the message is the tokenizer's ("source code string
        # cannot contain null bytes"), which describes source code the user
        # never wrote. One canonical message, whatever the interpreter.
        return "condition cannot contain a NUL character"
    if "integer string conversion" in message:
        # CPython's 4300-digit guard fires during parsing, and its message
        # advises `sys.set_int_max_str_digits()` -- Python's remedy, not the
        # condition's. Every such literal is invalid here anyway (nothing that
        # long is a finite float), so say that instead.
        return "invalid numeric literal: too many digits"
    # Single-line conditions make the line number noise.
    message = message.replace(" (detected at line 1)", "")
    offset = error.offset
    if offset is not None and offset > 0:
        return _ellipsize(f"{message} at character {offset}")
    return _ellipsize(message)


def _ellipsize(message: str, limit: int = 300) -> str:
    """Bound text that echoes user-controlled input.

    Messages name the offending fragment, which means reflecting condition
    text into the UI, logs, and GraphQL responses -- and a fragment can be a
    320-digit literal or a multi-kilobyte expression. Bounding happens at two
    layers, and both are needed:

    - **Format sites whose fragment precedes the advice** bound the fragment
      itself (limit 80), because tail truncation there would eat the guidance
      -- a 1000-character literal in boolean position once produced 300
      characters of echo and no "expected a comparison" at all.
    - **The error boundary** bounds the whole message as the backstop, so a
      format site that forgets cannot ship an unbounded echo -- it can only
      ship a worse message.
    """
    return message if len(message) <= limit else message[: limit - 1] + "…"


def _validate_python_surface(body: ast.expr, source: str) -> None:
    """Reject Python constructs that have no meaning in SQL.

    This DSL began as a Python-evaluated filter and only later gained a SQL
    backend, so it inherited the whole of Python's literal and operator surface.
    Much of that surface cannot be expressed faithfully in SQL: it either binds a
    value the driver cannot encode, compiles to something unrelated to what was
    written, or means different things on the two dialects.

    Each rule below closes one such inheritance. They are grouped here rather
    than scattered through the structural walk because they share a rationale --
    the language should admit exactly what a SQL backend can evaluate honestly.
    """
    for node in ast.walk(body):
        if isinstance(node, ast.Constant):
            _validate_literal(node)
        elif isinstance(node, ast.UnaryOp) and not isinstance(
            node.op, (ast.Not, ast.USub, ast.UAdd)
        ):
            # `~x` reaches SQLAlchemy as `NOT x`, so `~latency_ms == 1` compiles
            # to `CAST(NOT latency_ms AS FLOAT) = 1` -- unrelated to what was
            # written. The binary bitwise operators are already rejected as
            # arithmetic; this closes the unary hole beside them.
            raise SyntaxError(f"unsupported operator: {ast.unparse(node)}")
        elif isinstance(node, (ast.Name, ast.Attribute)):
            # Python NFKC-normalizes identifiers while parsing, so a full-width
            # `ｎａｍｅ` silently becomes `name` and resolves to a real column the
            # user never spelled. Attribute segments normalize too, which is how
            # `context.ｓｐａｎ_id` and `annotations['q'].ｓｃｏｒｅ` reach real fields.
            #
            # Compared against the node's own source span, not against the whole
            # condition: searching the text would pass whenever the normalized
            # spelling appears anywhere else -- inside a string literal
            # (`ｎａｍｅ == 'name'`) or in another operand
            # (`ｎａｍｅ == 'x' or name == 'y'`).
            written = ast.get_source_segment(source, node)
            normalized = node.id if isinstance(node, ast.Name) else node.attr
            # An attribute's span covers its whole chain, so compare only the
            # trailing segment the parser normalized.
            if written is not None and isinstance(node, ast.Attribute):
                written = written.rpartition(".")[2].strip()
            if written and written != normalized:
                raise SyntaxError(
                    f"`{_ellipsize(written, 80)}` is interpreted as `{_ellipsize(normalized, 80)}`"
                    ", use unaccented ASCII for field names"
                )


def _validate_literal(node: ast.Constant) -> None:
    """Literals are limited to the DSL's own value types.

    `b'x'`, `1j`, and `...` are Python values with no column type to compare
    against; the driver either refuses them or binds something meaningless.
    Non-finite floats and embedded NULs are accepted by SQLite and rejected by
    PostgreSQL, so admitting them would make a stored condition's validity
    depend on the backend.
    """
    value = node.value
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, str):
        if "\x00" in value:
            raise SyntaxError("string literals cannot contain a NUL character")
        return
    if isinstance(value, (int, float)):
        # Python ints are unbounded and floats admit inf/nan; both backends
        # evaluate numeric fields in float, so a value with no faithful finite
        # float has nothing to bind -- asyncpg refuses it while SQLite quietly
        # stores infinity.
        if not _is_finite_number(value):
            raise SyntaxError(f"invalid numeric literal: {ast.unparse(node)}")
        return
    raise SyntaxError(f"unsupported literal: {ast.unparse(node)}")


def _validate_expression(
    expression: ast.Expression,
    source: str,
    valid_eval_attributes: tuple[str, ...] = _VALID_EVAL_ATTRIBUTES,
) -> None:
    """Validate the expression's structure, names, attributes, and operand types.

    Annotation *name* existence is deliberately not validated: an unknown name
    is valid and matches nothing, exactly as an unknown attribute path does --
    the schemaless contract. A dormant hook that could have checked names
    against the project at validation time was removed: it had no caller, and
    as a hard gate it would have made a condition's validity depend on the
    live annotation table rather than on the text.
    """
    if not isinstance(expression, ast.Expression):
        raise SyntaxError(f"invalid expression: {ast.unparse(expression)}")
    _validate_python_surface(expression.body, source)
    for i, node in enumerate(ast.walk(expression.body)):
        if i == 0:
            if (
                isinstance(node, (ast.BoolOp, ast.Compare))
                or isinstance(node, ast.UnaryOp)
                and isinstance(node.op, ast.Not)
                or _is_annotation(node)
            ):
                continue
            if isinstance(node, (ast.Name, ast.Attribute, ast.Subscript, ast.Constant)):
                # A value as the whole condition, which is the same mistake as a
                # value in `and` / `or` position and deserves the same wording.
                # Falling through to the generic message below would name the
                # fragment without saying what is wrong with it.
                source_segment = _ellipsize(ast.unparse(node), 80)
                if _is_singleton_constant(node):
                    # `True == ...` is not a repair anyone wants; the literals
                    # are only meaningful beside a real condition.
                    raise SyntaxError(
                        f"`{source_segment}` is not a condition on its own"
                        ", it can only be used as an operand of `and` / `or` / `not`"
                    )
                raise SyntaxError(
                    f"`{source_segment}` is not a condition"
                    f", expected a comparison such as `{source_segment} == ...`"
                )
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
            # e.g. `evals["name"]`. The name itself is not checked for
            # existence (see the docstring); only the empty name is rejected,
            # since it can never match an annotation and previously fell to
            # the generic "invalid syntax" via an empty error message.
            if not _get_subscript_key(node):
                raise SyntaxError(f"missing eval name in `{ast.unparse(node)}`")
            continue
        elif isinstance(node, ast.Attribute) and _is_annotation(node.value):
            # e.g. `evals["name"].score`
            if (attr := node.attr) not in valid_eval_attributes:
                attr = _ellipsize(attr, 80)
                source_segment = _ellipsize(ast.unparse(node), 80)
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
        slice=ast.List(elts=keys, ctx=ast.Load()),  # type: ignore[arg-type]
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


# The similarity above which a near-miss field name is offered as a repair.
# Shared with the eval-attribute suggestion at the same threshold, and kept
# conservative: a wrong guess ("did you mean X?" when the user meant an
# attribute) is worse than no guess, because the warning is advisory and the
# attribute reading is a legitimate outcome.
_FIELD_SUGGESTION_THRESHOLD = 0.75

# Shortest identifier eligible for the substring heuristic below. A one- or
# two-character fragment (`id`) is contained in too many field names to point
# at one honestly, so only fuzzy matching applies to it.
_MIN_SUBSTRING_SUGGESTION_LEN = 3


def _suggest_field(identifier: str) -> typing.Optional[str]:
    """The closest span field to a bare identifier, or None if none is close.

    Two signals, because they catch different mistakes. Edit-distance
    (`_find_best_match`) catches a genuine typo (`stat_code`). Substring
    containment catches a *shorter* spelling of a real field -- `kind` for
    `span_kind`, `latency` for `latency_ms` -- where the edit ratio stays under
    the threshold precisely because the field name is longer. The containment
    check is one-directional (identifier inside field) and length-gated so it
    suggests a field the user under-typed, not one that merely shares a
    fragment.
    """
    choice, score = _find_best_match(identifier, _BARE_FIELD_NAMES)
    if choice and score > _FIELD_SUGGESTION_THRESHOLD:
        return choice
    if len(identifier) < _MIN_SUBSTRING_SUGGESTION_LEN:
        return None
    lowered = identifier.lower()
    contained_in = [field for field in _BARE_FIELD_NAMES if lowered in field.lower()]
    if not contained_in:
        return None
    # Ambiguous fragments (`status` in both status_code and status_message)
    # resolve to the nearest by the same ratio, keeping the choice stable.
    return max(
        contained_in,
        key=lambda field: SequenceMatcher(None, identifier, field).ratio(),
    )


@dataclass(frozen=True)
class FilterConditionWarning:
    """A non-blocking diagnostic about an otherwise-valid filter condition.

    Emitted for a bare identifier that resolves to a JSON attribute path rather
    than to a span field -- the silent `kind == 'AGENT'` -> `attributes['kind']`
    footgun. The condition is valid and runs; the warning only explains why it
    may match nothing and offers a field name when one is close.
    """

    message: str
    identifier: str
    suggestion: typing.Optional[str]


def collect_filter_condition_warnings(condition: str) -> list[FilterConditionWarning]:
    """Advisory diagnostics for a filter condition, distinct from validity.

    Reports each bare identifier that falls through to the attribute namespace
    (`attributes['<name>']`) instead of naming a span field -- the shape that
    silently returns zero rows because no such attribute exists. This is the
    schemaless contract working as designed, so it is a *warning*, never an
    error: the grammar is unchanged and the condition still applies.

    Returns an empty list for an empty or invalid condition -- an invalid one is
    the province of `validateSpanFilterCondition`, and surfacing a warning
    beside a hard error would only compete with it.

    Only *terminal* bare names are reported. The root of a subscript or
    attribute chain (`attributes['x']`, `metadata['k']`, `llm.model_name`,
    `annotations['q']`) is the intended way to reach schemaless data, and the
    callee of a cast (`str(...)`) is not a field reference -- neither is a
    mistake, so neither warns.
    """
    if not (condition := condition.strip()):
        return []
    try:
        # Gate on real validity so warnings accompany only conditions that run.
        # `SpanFilter` normalizes and fully validates; a failure here means the
        # error path owns this condition, not us.
        SpanFilter(condition=condition)
        # Re-parse the original source: `SpanFilter` keeps only the *translated*
        # tree, in which every bare name has already become `attributes[...]`,
        # erasing exactly the distinction this walk depends on.
        tree = ast.parse(condition, mode="eval")
    except (SpanFilterError, SyntaxError, ValueError):
        return []
    parent_by_child: dict[int, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parent_by_child[id(child)] = parent
    warnings: list[FilterConditionWarning] = []
    reported: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Name):
            continue
        name = node.id
        if name in _BARE_FIELD_NAMES or name == _PARENT_KEYWORD or name in reported:
            continue
        parent_node = parent_by_child.get(id(node))
        # The root of `attributes['x']` / `llm.model_name` / `annotations['q']`:
        # the whole chain is the intended attribute access, not a stray field.
        if isinstance(parent_node, (ast.Attribute, ast.Subscript)) and parent_node.value is node:
            continue
        # The callee of `str(...)` / `float(...)` / `int(...)`.
        if isinstance(parent_node, ast.Call) and parent_node.func is node:
            continue
        reported.add(name)
        suggestion = _suggest_field(name)
        message = (
            f"`{name}` is not a known span field, so it is read as the "
            f"attribute `attributes['{name}']` and matches only spans with "
            f"that attribute."
        )
        if suggestion:
            message += f" Did you mean the field `{suggestion}`?"
        warnings.append(
            FilterConditionWarning(
                message=message,
                identifier=name,
                suggestion=suggestion,
            )
        )
    return warnings


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
        # Split on "\n" only. `str.splitlines` also breaks on \v, \f, \x1c-\x1e,
        # \x85, \u2028 and \u2029, while the tokenizer that produced the AST
        # positions these offsets are matched against counts none of them. One
        # of those characters inside an earlier string literal would start a
        # line here that the tokenizer never saw, shifting every later offset
        # and splicing the alias at the wrong byte.
        lines = source.split("\n")
        self._line_offsets = [0]
        for line in lines:
            # +1 for the "\n" that `split` consumed. A trailing "\r" of a CRLF
            # pair stays in `line`, so its byte is already counted.
            self._line_offsets.append(self._line_offsets[-1] + len(line.encode()) + 1)
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
