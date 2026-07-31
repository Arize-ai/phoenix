import ast
import math
import re
import typing
from dataclasses import dataclass, field
from datetime import datetime, timezone
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

NameMap: TypeAlias = typing.Mapping[str, "sqlalchemy.SQLColumnExpression[typing.Any]"]

_VALID_EVAL_ATTRIBUTES: tuple[str, ...] = ("score", "label", "explanation")


AnnotationAttribute: TypeAlias = typing.Literal["explanation", "label", "score"]
AnnotationName: TypeAlias = str
AnnotationRelationKind: TypeAlias = typing.Literal["span", "trace"]

_ANNOTATION_ACCESSORS: tuple[str, ...] = ("trace_annotations", "annotations", "evals")


@dataclass(frozen=True)
class AliasedAnnotationRelation:
    """
    Represents an aliased annotation relation (i.e., SQL table). Used to perform
    joins on span-, trace-, or session-level annotations during filtering. An
    alias is required because an annotation table may be joined multiple times
    for different annotation names.
    """

    index: int
    name: str
    kind: AnnotationRelationKind = "span"
    annotation_model: type[typing.Any] = models.SpanAnnotation
    table_prefix: str = "span_annotation"
    table: AliasedClass[typing.Any] = field(init=False, repr=False)
    _label_attribute_alias: str = field(init=False, repr=False)
    _score_attribute_alias: str = field(init=False, repr=False)
    _explanation_attribute_alias: str = field(init=False, repr=False)
    _exists_attribute_alias: str = field(init=False, repr=False)

    def __post_init__(self) -> None:
        table_alias = f"{self.table_prefix}_{self.index}"
        alias_id = uuid4().hex
        label_attribute_alias = f"{table_alias}_label_{alias_id}"
        score_attribute_alias = f"{table_alias}_score_{alias_id}"
        explanation_attribute_alias = f"{table_alias}_explanation_{alias_id}"
        exists_attribute_alias = f"{table_alias}_exists_{alias_id}"

        table = aliased(self.annotation_model, name=table_alias)
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

# The reserved `parent_span` keyword refers to a span's parent span (the span whose
# `span_id` equals this span's `parent_id`). Only `parent_span is None` /
# `parent_span is not None` are supported (root-ness by parent existence); the
# translator rewrites those into references to the names below, which are bound
# to correlated `EXISTS` predicates in `SpanFilter.__call__`.
_PARENT_KEYWORD = "parent_span"
_PARENT_IS_NULL = "__parent_is_null__"
_PARENT_IS_NOT_NULL = "__parent_is_not_null__"

_STRICT_ROOT_KEYWORD = "parent_id"

# Comprehension forms: `any`/`all` yield a boolean, the rest yield a number. Each extracted
# comprehension is replaced by a reserved name carrying the matching prefix, which is how the
# translator types the result without a per-instance name map.
QUANTIFIER_NAMES: frozenset[str] = frozenset({"any", "all"})
REDUCTION_NAMES: frozenset[str] = frozenset({"len", "max", "min", "sum"})
COMPREHENSION_NAMES: frozenset[str] = QUANTIFIER_NAMES | REDUCTION_NAMES

_QUANTIFIER_RESULT_PREFIX = "__quantifier_"
_REDUCTION_RESULT_PREFIX = "__reduction_"

# The two string-containment lowerings `in` can translate to, named in the compiled expression so
# the rendered tree states which polarity a grain got.
_TEXT_CONTAINS = "TextContains"
_CASE_INSENSITIVE_CONTAINS = "CaseInsensitiveContains"


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
class _FilterBindings:
    """The entity-specific surface the shared filter compiler is parameterized over."""

    string_names: NameMap
    float_names: NameMap
    datetime_names: NameMap
    extra_names: NameMap
    # float-typed in inference but bound per-instance by the caller — no entry in `names`
    aggregate_names: frozenset[str]
    legacy_replacements: typing.Mapping[str, str]
    uppercase_names: frozenset[str]
    annotation_model: type[typing.Any]
    annotation_fk: str
    entity_id: "sqlalchemy.SQLColumnExpression[typing.Any]"
    annotation_table_prefix: str
    reject_unbound_names: bool
    caller_bound_string_names: frozenset[str] = frozenset()
    boolean_names: NameMap = MappingProxyType({})
    quantifiers: frozenset[str] = frozenset()
    exists_names: frozenset[str] = frozenset()
    supports_parent_keyword: bool = False
    iterables: typing.Mapping[str, "_IterableGrammar"] = MappingProxyType({})
    # The iterable that reads this grain's annotations element-wise, named when an
    # `annotations[...]` expression is rejected for being out of scope.
    annotation_iterable: typing.Optional[str] = None
    # Whether `in` against a string haystack ignores case. Every grain shipped so far sets it,
    # so the family answers text search the same way; `==` stays exact everywhere.
    case_insensitive_containment: bool = False
    # Whether the grain resolves every expression to a type before SQL is built, so a form the
    # translator would lower into something other than what Python spells is rejected outright
    # rather than compiled. See :class:`_SemanticPolicy`.
    strict_semantics: bool = False
    # Dotted spellings accepted as shorthands for a root-span attribute key, e.g. `user.id`.
    # Under `strict_semantics` every other dotted root is rejected.
    attribute_proxies: frozenset[str] = frozenset()

    @property
    def names(self) -> NameMap:
        """Static eval globals: the scalar columns usable directly in a compiled predicate."""
        return MappingProxyType(
            {
                **self.string_names,
                **self.float_names,
                **self.datetime_names,
                **self.boolean_names,
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
                self.boolean_names,
                self.aggregate_names,
                self.exists_names,
                self.caller_bound_string_names,
            )
        )


class _IterableGrammar(typing.NamedTuple):
    """One iterable as the compiler sees it: how its elements are named, typed, and nested.

    ``element_bindings`` is the language a predicate inside ``for x in <iterable>`` is compiled
    against, so an inner predicate inherits the casting, coercion, and did-you-mean behavior of a
    top-level one. ``nested`` maps a loop-variable attribute to the iterable it stands for
    (e.g. ``traces`` elements expose ``spans``).
    """

    element_bindings: _FilterBindings
    nested: typing.Mapping[str, str] = MappingProxyType({})


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
    supports_parent_keyword=True,
    case_insensitive_containment=True,
)


class ComprehensionSpec(typing.NamedTuple):
    """One extracted comprehension, ready to be built into a correlated subquery.

    ``predicate`` is the compiled element expression -- the condition for a quantifier, the
    reduced value for ``sum``/``max``/``min``, and ``None`` for ``len``, which counts rows.
    ``condition`` is the compiled ``if`` clause, if any. Both are compiled against the
    iterable's element bindings and are evaluated by the caller against its own element columns.
    """

    name: str
    kind: str
    iterable: str
    nested_attribute: typing.Optional[str]
    predicate: typing.Any
    condition: typing.Any
    children: tuple["ComprehensionSpec", ...]
    literal_bindings: typing.Mapping[str, typing.Any]
    """Safe values bound while compiling ``predicate`` / ``condition`` (e.g.
    datetime literals); the caller merges them into the element eval globals."""


class _ElementScope(typing.NamedTuple):
    """A loop variable in scope: what it is called and what it ranges over."""

    variable: str
    iterable: str
    grammar: _IterableGrammar


def _comprehension_argument(
    node: ast.AST,
    bindings: _FilterBindings,
) -> typing.Optional[typing.Union[ast.GeneratorExp, ast.ListComp]]:
    """The comprehension `node` reduces over, if it is a call of a sanctioned reduction."""
    if not (
        isinstance(node, ast.Call)
        and isinstance(func := node.func, ast.Name)
        and func.id in bindings.quantifiers
        and func.id in COMPREHENSION_NAMES
        and len(node.args) == 1
        and not node.keywords
    ):
        return None
    argument = node.args[0]
    return argument if isinstance(argument, (ast.GeneratorExp, ast.ListComp)) else None


def _conjoin(nodes: typing.Sequence[ast.expr]) -> ast.expr:
    return nodes[0] if len(nodes) == 1 else ast.BoolOp(op=ast.And(), values=list(nodes))


def _element_access_path(node: ast.expr) -> tuple[typing.Optional[str], list[typing.Optional[str]]]:
    """Splits an attribute/subscript chain into its root name and one step per link.

    A subscript step is ``None``: elements expose named fields only, so `s["a"]` has to be
    distinguishable from `s.a` here.
    """
    steps: list[typing.Optional[str]] = []
    current: ast.AST = node
    while True:
        if isinstance(current, ast.Attribute):
            steps.append(current.attr)
            current = current.value
        elif isinstance(current, ast.Subscript):
            steps.append(None)
            current = current.value
        else:
            break
    return (current.id, steps[::-1]) if isinstance(current, ast.Name) else (None, [])


def _scope_of(name: str, scopes: typing.Sequence[_ElementScope]) -> typing.Optional[_ElementScope]:
    for scope in reversed(scopes):
        if scope.variable == name:
            return scope
    return None


def _nested_iterable_error(iterable: str, scope: _ElementScope) -> SyntaxError:
    nested = _disjunction(
        sorted(f"`{scope.variable}.{attribute}`" for attribute in scope.grammar.nested)
    )
    return SyntaxError(
        f"`{iterable}` cannot be iterated inside a comprehension"
        + (f"; a {scope.iterable} element iterates {nested}" if nested else "")
    )


def _resolve_iterable(
    node: ast.expr,
    scopes: typing.Sequence[_ElementScope],
    bindings: _FilterBindings,
) -> tuple[str, typing.Optional[str]]:
    """The iterable a `for ... in <node>` clause ranges over, plus the attribute that named it.

    The attribute is ``None`` for a top-level iterable and the loop-variable attribute for a
    nested one (`for s in t.spans`), which is what tells the caller to correlate the subquery to
    the enclosing element instead of the session.
    """
    if isinstance(node, ast.Name):
        if node.id in bindings.iterables:
            if scopes:
                # A top-level collection named inside a comprehension has no correlation to the
                # element being iterated, so the subquery builder has nothing to key it on.
                # Only the nesting an element declares is reachable from one scope down.
                raise _nested_iterable_error(node.id, scopes[-1])
            return node.id, None
        choice, score = _find_best_match(node.id, bindings.iterables)
        suggestion = (
            f', did you mean "{choice}"?'
            if choice and score > 0.75
            else f", expected {_disjunction(sorted(bindings.iterables))}"
        )
        raise SyntaxError(f"invalid iterable `{node.id}`{suggestion}")
    if isinstance(node, ast.Attribute) and isinstance(value := node.value, ast.Name):
        if (scope := _scope_of(value.id, scopes)) is not None:
            if (nested := scope.grammar.nested.get(node.attr)) is not None:
                return nested, node.attr
            expected = _disjunction(sorted(scope.grammar.nested))
            raise SyntaxError(
                f"`{ast.unparse(node)}` is not iterable"
                + (f"; a {scope.iterable} element iterates {expected}" if expected else "")
            )
    raise SyntaxError(f"cannot iterate `{ast.unparse(node)}`")


def _is_predicate_shaped(
    node: ast.expr,
    scope: _ElementScope,
    bindings: _FilterBindings,
) -> bool:
    if isinstance(node, (ast.Compare, ast.BoolOp)):
        return True
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return True
    if _comprehension_argument(node, bindings) is not None:
        # A nested comprehension is shaped by its own reduction, not by the enclosing one.
        return typing.cast(ast.Name, typing.cast(ast.Call, node).func).id in QUANTIFIER_NAMES
    if (
        isinstance(node, ast.Attribute)
        and isinstance(value := node.value, ast.Name)
        and value.id == scope.variable
    ):
        return node.attr in scope.grammar.element_bindings.boolean_names
    return False


def _validate_comprehension_shape(
    comprehension: typing.Union[ast.GeneratorExp, ast.ListComp],
    kind: str,
) -> ast.comprehension:
    if kind == "len" and not isinstance(comprehension, ast.ListComp):
        # Inherited from CPython, where `len(genexp)` raises TypeError.
        raise SyntaxError(
            "`len(...)` takes a list comprehension: write "
            f"`len([{ast.unparse(comprehension.elt)} for ...])`, not `len(... for ...)`"
        )
    if len(comprehension.generators) != 1:
        raise SyntaxError("a comprehension may have only one `for` clause")
    generator = comprehension.generators[0]
    if generator.is_async:
        raise SyntaxError("`async for` is not supported")
    if not isinstance(generator.target, ast.Name):
        raise SyntaxError(
            f"`for {ast.unparse(generator.target)} in ...` is not supported: "
            "the loop variable must be a simple name"
        )
    return generator


def _validate_element_expression(
    node: ast.expr,
    kind: str,
    scope: _ElementScope,
    bindings: _FilterBindings,
) -> None:
    if kind == "len":
        if not (isinstance(node, ast.Name) and node.id == scope.variable):
            raise SyntaxError(
                f"`len(...)` counts elements: write "
                f"`len([{scope.variable} for {scope.variable} in {scope.iterable} if ...])`"
            )
        return
    if _is_predicate_shaped(node, scope, bindings) is (kind in QUANTIFIER_NAMES):
        return
    expected = "a condition" if kind in QUANTIFIER_NAMES else "a value"
    raise SyntaxError(f"`{kind}(...)` takes {expected} over `{scope.variable}`")


def _validate_element_access(
    node: ast.expr,
    scopes: typing.Sequence[_ElementScope],
) -> None:
    root, steps = _element_access_path(node)
    if root is None or (scope := _scope_of(root, scopes)) is None:
        return
    fields = scope.grammar.element_bindings.binding_names
    if len(steps) != 1 or (attribute := steps[0]) is None:
        raise SyntaxError(
            f"`{ast.unparse(node)}` is not a {scope.iterable} field; "
            f"a {scope.iterable} element exposes {_disjunction(sorted(fields))}"
        )
    if attribute in fields:
        return
    choice, score = _find_best_match(attribute, fields)
    suggestion = (
        f', did you mean "{choice}"?'
        if choice and score > 0.75
        else f", expected {_disjunction(sorted(fields))}"
    )
    raise SyntaxError(f"invalid field `{root}.{attribute}`{suggestion}")


def _validate_comprehensions(expression: ast.Expression, bindings: _FilterBindings) -> None:
    """Admit comprehensions only in the shapes the compiler can build a subquery from.

    A comprehension has to be the sole argument of one of the sanctioned reductions, range over a
    declared iterable through a single non-async `for` with a simple loop variable, and reference
    the loop variable only through its declared fields. Grains that declare no iterables reject
    comprehensions outright, via the node-type whitelist in :func:`_validate_expression`.
    """
    if not bindings.iterables:
        return
    iterable_slots: set[int] = set()

    def check(node: ast.AST, scopes: tuple[_ElementScope, ...]) -> None:
        if (comprehension := _comprehension_argument(node, bindings)) is not None:
            kind = typing.cast(ast.Name, typing.cast(ast.Call, node).func).id
            generator = _validate_comprehension_shape(comprehension, kind)
            iterable, _ = _resolve_iterable(generator.iter, scopes, bindings)
            iterable_slots.add(id(generator.iter))
            variable = typing.cast(ast.Name, generator.target).id
            if _scope_of(variable, scopes) is not None:
                raise SyntaxError(f"`{variable}` is already in use as a loop variable")
            scope = _ElementScope(variable, iterable, bindings.iterables[iterable])
            _validate_element_expression(comprehension.elt, kind, scope, bindings)
            for inner in (*generator.ifs, comprehension.elt):
                check(inner, (*scopes, scope))
            return
        if (
            isinstance(node, ast.Call)
            and isinstance(func := node.func, ast.Name)
            and func.id in COMPREHENSION_NAMES
            and func.id in bindings.quantifiers
        ):
            raise SyntaxError(
                f"`{func.id}(...)` takes a comprehension over "
                f"{_disjunction(sorted(bindings.iterables))}, "
                f'e.g. `{func.id}(x.<field> == "..." for x in <collection>)`'
            )
        if isinstance(node, (ast.GeneratorExp, ast.ListComp, ast.SetComp, ast.DictComp)):
            raise SyntaxError(
                f"invalid expression: {ast.unparse(node)}; a comprehension may appear only as the "
                f"argument of {_disjunction(sorted(COMPREHENSION_NAMES & bindings.quantifiers))}"
            )
        if isinstance(node, (ast.Attribute, ast.Subscript)):
            _validate_element_access(typing.cast(ast.expr, node), scopes)
        for child in ast.iter_child_nodes(node):
            check(child, scopes)

    check(expression.body, ())
    for node in ast.walk(expression.body):
        if (
            isinstance(node, ast.Name)
            and node.id in bindings.iterables
            and id(node) not in iterable_slots
        ):
            raise SyntaxError(
                f"`{node.id}` is a collection and can only be iterated, "
                f'e.g. `any(x.<field> == "..." for x in {node.id})`'
            )


class _ComprehensionExtractor(ast.NodeTransformer):
    """Replaces each sanctioned comprehension with a reserved name and records how to build it.

    The element expression and `if` clause are compiled separately against the iterable's element
    bindings, so a predicate one scope down speaks exactly the language it does at the top level.
    Loop-variable field access (`s.latency_ms`) becomes a bare name (`latency_ms`) in that scope,
    which is what lets the ordinary translator handle it.
    """

    def __init__(
        self,
        bindings: _FilterBindings,
        aliased_annotation_relations: typing.Iterable[AliasedAnnotationRelation] = (),
    ) -> None:
        self._bindings = bindings
        self._scopes: list[_ElementScope] = []
        self._collected: list[list[ComprehensionSpec]] = [[]]
        self._count = 0
        # Session-scope annotation reads are aliased before extraction runs, so
        # inside a comprehension they surface as opaque alias names. Map them
        # back to their source spelling for the rejection message below.
        self._annotation_aliases: dict[str, tuple[str, typing.Optional[str]]] = {}
        for relation in aliased_annotation_relations:
            self._annotation_aliases[relation._label_attribute_alias] = (relation.name, "label")
            self._annotation_aliases[relation._score_attribute_alias] = (relation.name, "score")
            self._annotation_aliases[relation._explanation_attribute_alias] = (
                relation.name,
                "explanation",
            )
            self._annotation_aliases[relation._exists_attribute_alias] = (relation.name, None)

    def _reject_annotation_alias_reads(self, node: ast.AST) -> None:
        for child in ast.walk(node):
            if isinstance(child, ast.Name) and (read := self._annotation_aliases.get(child.id)):
                annotation_name, attribute = read
                reference = f"annotations[{annotation_name!r}]" + (
                    f".{attribute}" if attribute else ""
                )
                hint = (
                    f"; use `{self._bindings.annotation_iterable}` to read annotations element-wise"
                    if self._bindings.annotation_iterable
                    else ""
                )
                raise SyntaxError(
                    f"`{reference}` is joined at session scope and cannot be read"
                    f" inside a comprehension{hint}"
                )

    @property
    def specs(self) -> tuple[ComprehensionSpec, ...]:
        return tuple(self._collected[0])

    def visit_Call(self, node: ast.Call) -> typing.Any:
        if (comprehension := _comprehension_argument(node, self._bindings)) is None:
            return self.generic_visit(node)
        kind = typing.cast(ast.Name, node.func).id
        generator = comprehension.generators[0]
        iterable, nested_attribute = _resolve_iterable(generator.iter, self._scopes, self._bindings)
        grammar = self._bindings.iterables[iterable]
        variable = typing.cast(ast.Name, generator.target).id
        self._scopes.append(_ElementScope(variable, iterable, grammar))
        self._collected.append([])
        try:
            condition = self.visit(_conjoin(generator.ifs)) if generator.ifs else None
            element = None if kind == "len" else self.visit(comprehension.elt)
        finally:
            children = tuple(self._collected.pop())
            self._scopes.pop()
        reserved = tuple(child.name for child in children)
        prefix = _QUANTIFIER_RESULT_PREFIX if kind in QUANTIFIER_NAMES else _REDUCTION_RESULT_PREFIX
        name = f"{prefix}{self._count}__"
        self._count += 1
        for part in (element, condition):
            if part is not None:
                self._reject_annotation_alias_reads(part)
        literal_bindings: dict[str, typing.Any] = {}
        spec = ComprehensionSpec(
            name=name,
            kind=kind,
            iterable=iterable,
            nested_attribute=nested_attribute,
            predicate=None
            if element is None
            else _compile_element(element, grammar, reserved, literal_bindings),
            condition=None
            if condition is None
            else _compile_element(condition, grammar, reserved, literal_bindings),
            children=children,
            literal_bindings=literal_bindings,
        )
        self._collected[-1].append(spec)
        return ast.Name(id=name, ctx=ast.Load())

    def visit_Attribute(self, node: ast.Attribute) -> typing.Any:
        if (
            isinstance(value := node.value, ast.Name)
            and _scope_of(value.id, self._scopes) is not None
        ):
            return ast.Name(id=node.attr, ctx=ast.Load())
        return self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> typing.Any:
        if (scope := _scope_of(node.id, self._scopes)) is not None:
            raise SyntaxError(
                f"`{node.id}` is a whole {scope.iterable} element; compare one of its fields"
            )
        return node


def _compile_element(
    node: ast.expr,
    grammar: _IterableGrammar,
    reserved_keywords: typing.Sequence[str],
    literal_bindings: dict[str, typing.Any],
) -> typing.Any:
    translator = _FilterTranslator(
        bindings=grammar.element_bindings,
        reserved_keywords=reserved_keywords,
    )
    # Share one bindings dict across the predicate and the `if` clause so the
    # generated literal names stay unique within the spec's eval globals.
    translator.literal_bindings = literal_bindings
    translated = translator.visit(ast.Expression(body=node))
    ast.fix_missing_locations(translated)
    return compile(translated, filename="", mode="eval")


def _extract_comprehensions(
    root: ast.Expression,
    bindings: _FilterBindings,
    aliased_annotation_relations: typing.Iterable[AliasedAnnotationRelation] = (),
) -> tuple[ast.Expression, tuple[ComprehensionSpec, ...]]:
    if not bindings.iterables:
        return root, ()
    extractor = _ComprehensionExtractor(bindings, aliased_annotation_relations)
    return ast.Expression(body=extractor.visit(root.body)), extractor.specs


class _CompiledCondition(typing.NamedTuple):
    validated: ast.Expression
    """The pre-aliasing parse tree, as it stood when validation passed."""
    translated: ast.Expression
    compiled: typing.Any
    aliased_annotation_relations: tuple[AliasedAnnotationRelation, ...]
    aliased_annotation_attributes: dict[str, ColumnElement[typing.Any]]
    literal_bindings: dict[str, typing.Any]
    """Safe values bound by the translator (e.g. datetime literals) that must be
    present in the eval globals for the compiled expression to evaluate."""
    comprehensions: tuple["ComprehensionSpec", ...] = ()


def _compile_condition(
    source: str,
    bindings: _FilterBindings,
    valid_annotation_names: typing.Optional[typing.Sequence[str]],
) -> _CompiledCondition:
    # Outer whitespace is normalized before anything reads the source: a leading space would
    # otherwise reach the parser as an indented statement and surface as `IndentationError`,
    # which is not a statement about the filter the user wrote.
    source = source.strip()
    try:
        try:
            validated = ast.parse(source, mode="eval")
        except ValueError:
            # A NUL in the source, which CPython 3.10 reports as `ValueError`
            # rather than `SyntaxError` (3.11+ raises the latter, normalized by
            # `_format_syntax_error` at the boundary).
            raise SyntaxError("condition cannot contain a NUL character") from None
        _validate_expression(validated, source, bindings, valid_eval_names=valid_annotation_names)
        _validate_semantics(validated, source, bindings)
        source, aliased_annotation_relations = _apply_eval_aliasing(source, bindings)
        root = ast.parse(source, mode="eval")
        root, comprehensions = _extract_comprehensions(root, bindings, aliased_annotation_relations)
        translator = _FilterTranslator(
            bindings=bindings,
            reserved_keywords=chain(
                (
                    alias
                    for aliased_annotation in aliased_annotation_relations
                    for alias, _ in aliased_annotation.attributes
                ),
                (comprehension.name for comprehension in comprehensions),
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
    except RecursionError:
        # Input nested deeply enough to exhaust the stack, which every stage
        # above is vulnerable to -- the parser, the translator, and `compile`
        # all recurse. A condition arrives from the API, so this has to read as
        # a malformed filter like any other rather than escaping as a crash
        # from whichever stage happened to run out first.
        raise SyntaxError("filter condition is nested too deeply") from None
    aliased_annotation_attributes = {
        alias: attribute
        for aliased_annotation in aliased_annotation_relations
        for alias, attribute in aliased_annotation.attributes
    }
    return _CompiledCondition(
        validated,
        translated,
        compiled,
        aliased_annotation_relations,
        aliased_annotation_attributes,
        translator.literal_bindings,
        comprehensions,
    )


def _join_annotations(
    stmt: Select[typing.Any],
    bindings: _FilterBindings,
    aliased_annotation_relations: typing.Iterable[AliasedAnnotationRelation],
) -> Select[typing.Any]:
    """Outer-join each aliased annotation relation to its entity and matching name.

    E.g. for ``evals["Hallucination"].score > 0.5`` an alias ``A`` is generated and
    ``select(Span)`` becomes
    ``select(Span).outerjoin(A, and_(A.span_rowid == Span.id, A.name == "Hallucination"))``.

    Trace annotations are the exception to the grain's default relation: they
    join a span through its trace row ID.
    """
    for annotation_relation in aliased_annotation_relations:
        aliased_annotation = annotation_relation.table
        entity_id: sqlalchemy.SQLColumnExpression[typing.Any]
        if annotation_relation.kind == "trace":
            annotation_foreign_key = aliased_annotation.trace_rowid
            entity_id = models.Span.trace_rowid
        else:
            annotation_foreign_key = getattr(aliased_annotation, bindings.annotation_fk)
            entity_id = bindings.entity_id
        stmt = stmt.outerjoin(
            aliased_annotation,
            onclause=sqlalchemy.and_(
                annotation_foreign_key == entity_id,
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
        **aliased_annotation_attributes,
        "not_": sqlalchemy.not_,
        "and_": sqlalchemy.and_,
        "or_": sqlalchemy.or_,
        "nullif": sqlalchemy.func.nullif,
        "cast": sqlalchemy.cast,
        "Float": sqlalchemy.Float,
        "String": sqlalchemy.String,
        "SafeJsonBoolean": SafeJsonBoolean,
        "SafeJsonFloat": SafeJsonFloat,
        _TEXT_CONTAINS: models.TextContains,
        _CASE_INSENSITIVE_CONTAINS: models.CaseInsensitiveContains,
        _DATETIME_CONVERTER: _parse_datetime_literal,
        # Last so a caller can override an entry -- e.g. the session grain
        # swaps in SafeJson* shims that understand its root-span attribute
        # reader.
        **(extra_bindings or {}),
    }


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
        predicate = eval(
            self.compiled,
            _eval_globals(
                SPAN_BINDINGS,
                self._aliased_annotation_attributes,
                {
                    **self._literal_bindings,
                    _PARENT_IS_NULL: ~parent_exists,
                    _PARENT_IS_NOT_NULL: parent_exists,
                },
            ),
        )
        if not self._aliased_annotation_relations:
            return select.where(predicate)
        return select.where(self._annotation_predicate_exists(predicate))

    def _annotation_predicate_exists(self, predicate: ColumnElement[bool]) -> ColumnElement[bool]:
        """Evaluate annotation predicates without duplicating spans.

        The one-row seed preserves outer-join semantics for missing annotations.
        The correlated ``EXISTS`` prevents annotations with multiple identifiers
        from duplicating spans in the outer query.
        """
        seed = sqlalchemy.select(literal(True).label("seed")).subquery()
        statement = sqlalchemy.select(literal(True)).select_from(seed)
        for annotation_relation in self._aliased_annotation_relations:
            aliased_annotation = annotation_relation.table
            if annotation_relation.kind == "trace":
                foreign_key_clause = aliased_annotation.trace_rowid == models.Span.trace_rowid
            else:
                foreign_key_clause = aliased_annotation.span_rowid == models.Span.id
            statement = statement.outerjoin(
                aliased_annotation,
                onclause=sqlalchemy.and_(
                    foreign_key_clause,
                    aliased_annotation.name == annotation_relation.name,
                ),
            )
        return statement.where(predicate).correlate(models.Span).exists()

    def to_dict(self) -> dict[str, typing.Any]:
        return {"condition": self.condition}

    @classmethod
    def from_dict(
        cls,
        obj: typing.Mapping[str, typing.Any],
    ) -> "SpanFilter":
        return cls(condition=obj.get("condition") or "")


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


_DATETIME_CONVERTER = "__to_datetime__"


def _parse_datetime_literal(value: str) -> datetime:
    """Parse an ISO 8601 string comparand for a datetime-bound name; naive values read as UTC.

    Without this conversion the string would reach the column's bind processor, which
    turns non-datetime input into SQL NULL — a predicate that silently matches nothing.
    """
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise SyntaxError(
            f"invalid datetime literal {value!r}; use ISO 8601, "
            "e.g. '2026-07-01' or '2026-07-01T12:00:00+00:00'"
        ) from None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _is_datetime_name(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Name]:
    return isinstance(node, ast.Name) and node.id in bindings.datetime_names


def _as_datetime_literal(node: ast.Constant) -> ast.Call:
    _parse_datetime_literal(typing.cast(str, node.value))  # reject malformed input early
    return ast.Call(func=ast.Name(id=_DATETIME_CONVERTER, ctx=ast.Load()), args=[node], keywords=[])


def _is_uppercase_name(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Name]:
    return isinstance(node, ast.Name) and node.id in bindings.uppercase_names


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
        # Comprehension calls are typed by their kind: quantifiers (`any`/`all`)
        # are predicates, reductions aggregate to a number. Grains that do not
        # admit them (`bindings.quantifiers` empty) reject the call by name in
        # the structural pass before this type is ever consulted.
        if node.func.id in QUANTIFIER_NAMES:
            return "boolean"
        if node.func.id in REDUCTION_NAMES:
            return "number"
    if isinstance(node, ast.BinOp):
        if not isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod)):
            raise SyntaxError(f"invalid arithmetic operator: {_symbol(node.op)}")
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


def _nullif_zero(node: typing.Any) -> ast.Call:
    """Wrap a division denominator so a zero value compiles to SQL ``NULL``.

    PostgreSQL raises ``division by zero`` where SQLite yields ``NULL``; this excludes the row on
    both dialects.
    """
    return ast.Call(
        func=ast.Name(id="nullif", ctx=ast.Load()),
        args=[node, ast.Constant(value=0)],
        keywords=[],
    )


def _is_string(node: typing.Any, bindings: _FilterBindings) -> TypeGuard[ast.Call]:
    # A list or tuple is typed from its first element only, which makes membership acceptance
    # depend on element order. Grains with `strict_semantics` never reach that: the policy
    # requires a homogeneous literal list and exempts membership from coercion entirely. The
    # inference stays as it is for the grain whose accepted surface it already defines.
    return (
        isinstance(node, ast.Name)
        and (node.id in bindings.string_names or node.id in bindings.caller_bound_string_names)
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
        and (
            node.id in bindings.float_names
            or node.id in bindings.aggregate_names
            or node.id.startswith(_REDUCTION_RESULT_PREFIX)
        )
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
                bindings.boolean_names.keys(),
                bindings.aggregate_names,
                bindings.exists_names,
                bindings.caller_bound_string_names,
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
            _raise_invalid_name(source_segment, self._bindings)
        return _as_attribute([ast.Constant(value=source_segment, kind=None)])

    def visit_Subscript(self, node: ast.Subscript) -> typing.Any:
        if (keys := _get_attribute_keys_list(node)) is not None:
            return _as_attribute(keys)
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")


class _FilterTranslator(_ProjectionTranslator):
    def __init__(
        self,
        reserved_keywords: typing.Iterable[str] = (),
        string_keywords: typing.Iterable[str] = (),
        bindings: _FilterBindings = SPAN_BINDINGS,
    ) -> None:
        super().__init__(reserved_keywords, bindings)
        self._string_keywords = frozenset(string_keywords)
        self.literal_bindings: dict[str, typing.Any] = {}

    @property
    def _containment_function(self) -> str:
        return (
            _CASE_INSENSITIVE_CONTAINS
            if self._bindings.case_insensitive_containment
            else _TEXT_CONTAINS
        )

    def visit_Name(self, node: ast.Name) -> typing.Any:
        if self._bindings.supports_parent_keyword and _is_parent_name(node):
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

    def _reject_parent_traversal(self, node: ast.expr) -> None:
        # The `parent_span` keyword is fully reserved: `parent_span.<field>` traversal is
        # not supported yet (a follow-up), so reject it clearly here rather than
        # letting it fall through to the pre-existing `attributes['parent_span'][...]`
        # attribute-path behavior, which would silently mean something else.
        if self._bindings.supports_parent_keyword and _is_parent_rooted(node):
            raise _parent_traversal_error(node)

    def _parent_root_predicate(self, node: ast.Compare) -> typing.Optional[ast.expr]:
        """
        Rewrites `parent_span is None` / `parent_span == None` into a root-existence
        predicate (and the negations into non-root). Returns ``None`` when the
        comparison does not involve the bare `parent_span` keyword, or when the
        grain does not bind it at all.
        """
        if not self._bindings.supports_parent_keyword:
            return None
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
        left_node, right_node = node.left, node.comparators[0]
        left, op, right = self.visit(left_node), node.ops[0], self.visit(right_node)
        if _is_datetime_name(left_node, self._bindings):
            right = self._bind_datetime_literal(right_node, right)
        elif _is_datetime_name(right_node, self._bindings):
            left = self._bind_datetime_literal(left_node, left)
        if _is_uppercase_name(left, self._bindings):
            right = _convert_to_uppercase(right)
        elif _is_uppercase_name(right, self._bindings):
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
        # `None` is exempt from numeric coercion: casting it produces `= CAST(NULL AS FLOAT)`,
        # which is NULL rather than the `IS NULL` test `x is None` asks for, so the comparison
        # would silently match nothing.
        # A membership list is also exempt under the semantic policy, which has already settled
        # that its elements match the needle: coercing the list would rewrite it into a cast and
        # lose the `IN` shape entirely (`num_traces in []` being the clearest case).
        coerce = not (
            self._bindings.strict_semantics
            and isinstance(op, (ast.In, ast.NotIn))
            and isinstance(right, (ast.List, ast.Tuple))
        )
        if (
            coerce
            and _is_float(left, self._bindings)
            and not _is_float(right, self._bindings)
            and not _is_none_constant(right)
        ):
            if isinstance(op, (ast.In, ast.NotIn)) and isinstance(right, (ast.List, ast.Tuple)):
                # Coerce the elements, not the collection. Casting the collection
                # replaces the `List` node with a `Call`, which then misses the
                # membership branch below and lands on its `else` -- reported as
                # `invalid expression: ` (empty, because `ast.unparse` of a bare
                # operator is the empty string).
                elements: list[ast.expr] = [
                    element if _is_float(element, self._bindings) else _as_float_operand(element)
                    for element in right.elts
                ]
                right = (
                    ast.List(elts=elements, ctx=ast.Load())
                    if isinstance(right, ast.List)
                    else ast.Tuple(elts=elements, ctx=ast.Load())
                )
            else:
                right = _as_float_operand(right)
        elif (
            coerce
            and not _is_float(left, self._bindings)
            and not _is_none_constant(left)
            and _is_float(right, self._bindings)
        ):
            left = _as_float_operand(left)
        if isinstance(op, (ast.In, ast.NotIn)):
            if (
                _is_string_attribute(right)
                or ast.unparse(right) in self._bindings.names
                or isinstance(right, ast.Name)
                and right.id in self._string_keywords
                or ast.unparse(right) in self._bindings.caller_bound_string_names
            ):
                call = ast.Call(
                    func=ast.Name(id=self._containment_function, ctx=ast.Load()),
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
        if isinstance(node.op, (ast.USub, ast.UAdd)):
            numeric = operand if _is_float(operand, self._bindings) else _cast_as("Float", operand)
            if isinstance(node.op, ast.UAdd):
                # Unary plus is the identity on a number, so it is dropped
                # rather than translated. Emitting it was wrong twice over: the
                # cast branch hardcoded `USub`, so `+attributes['x'] > 5`
                # silently filtered on the negation, and SQLAlchemy expressions
                # implement no `__pos__`, so keeping the operator raises
                # `bad operand type for unary +` when the filter is evaluated.
                return numeric
            return ast.UnaryOp(op=ast.USub(), operand=numeric)
        return ast.UnaryOp(op=node.op, operand=operand)

    def visit_BinOp(self, node: ast.BinOp) -> typing.Any:
        left, op, right = self.visit(node.left), node.op, self.visit(node.right)
        if _is_json_attribute(left):
            left = _cast_as("String", left)
        if _is_json_attribute(right):
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
            # `_as_float_operand`, not `_cast_as`: a string literal has to be
            # converted here rather than wrapped in a SQL cast, or it is bound
            # as a float-typed parameter that asyncpg refuses to encode.
            return _as_float_operand(arg)
        if node.func.id in ("str",) and not _is_string(arg, self._bindings):
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


_Kind: TypeAlias = typing.Literal["string", "float", "datetime", "boolean", "json", "none", "text"]
"""What a sub-expression denotes under the semantic policy.

``json`` is a root-span attribute read, whose stored type is not known until the row is read, so
it compares against any scalar. ``text`` is an existential containment term (`any_input`), which
is not a value at all: it only ever sits on the right of `in`.
"""

_KIND_NOUNS: typing.Mapping[str, str] = MappingProxyType(
    {
        "string": "text",
        "float": "a number",
        "datetime": "a timestamp",
        "boolean": "a condition",
        "json": "an attribute value",
        "none": "None",
        "text": "a containment term",
    }
)

_ARITHMETIC_OPERATORS: tuple[type, ...] = (
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.Mod,
)
_ORDERING_OPERATORS: tuple[type, ...] = (ast.Lt, ast.LtE, ast.Gt, ast.GtE)
_ORDERED_KINDS: frozenset[str] = frozenset({"float", "datetime", "json"})
"""What `<`, `<=`, `>`, `>=` may range over.

Text is absent on purpose: SQLite orders text by byte value while PostgreSQL orders it by the
database's collation, so the same `first_input > last_output` sorts differently on the two
backends. It is the same reason `max(...)` over text is rejected, and the same remedy — a
declared collation — would lift both at once.
"""
_LOOKUP_KINDS: frozenset[str] = frozenset({"string", "float", "json"})

_OPERATOR_SYMBOLS: typing.Mapping[type, str] = MappingProxyType(
    {
        ast.Add: "+",
        ast.Sub: "-",
        ast.Mult: "*",
        ast.Div: "/",
        ast.FloorDiv: "//",
        ast.Mod: "%",
        ast.Pow: "**",
        ast.LShift: "<<",
        ast.RShift: ">>",
        ast.BitOr: "|",
        ast.BitXor: "^",
        ast.BitAnd: "&",
        ast.MatMult: "@",
        ast.Invert: "~",
        ast.UAdd: "+",
        ast.USub: "-",
        ast.Not: "not",
        ast.Lt: "<",
        ast.LtE: "<=",
        ast.Gt: ">",
        ast.GtE: ">=",
        ast.Eq: "==",
        ast.NotEq: "!=",
    }
)


def _symbol(op: ast.AST) -> str:
    return _OPERATOR_SYMBOLS.get(type(op), type(op).__name__)


def _raise_invalid_name(source_segment: str, bindings: _FilterBindings) -> typing.NoReturn:
    choice, score = _find_best_match(source_segment, bindings.binding_names)
    suggestion = f', did you mean "{choice}"?' if choice and score > 0.75 else ""
    raise SyntaxError(f"invalid name `{source_segment}`{suggestion}")


class _SemanticPolicy:
    """Resolves every sub-expression to a type and rejects the combinations the DSL never meant.

    The translator below coerces rather than checks: it casts an operand to Float when the other
    side is numeric, reads `is` as `==`, and lets any Python operator through to whatever SQLAlchemy
    does with it. That is fine for a grain whose accepted surface predates this policy, but a grain
    that declares its conditions to *be* Python cannot also accept `session_id == 1` as a Float
    comparison. So a grain opts in with ``strict_semantics``, and this pass runs between structural
    validation and SQL construction: an expression either types, or it is a `SyntaxError` naming the
    operand that does not fit.
    """

    def __init__(self, bindings: _FilterBindings) -> None:
        self._bindings = bindings

    def check(self, expression: ast.Expression, source: str) -> None:
        self._check_spelling(expression, source)
        if self._kind(expression.body, ()) != "boolean":
            raise SyntaxError(
                f"`{ast.unparse(expression.body)}` is not a condition: a filter condition "
                "compares values, quantifies over a collection, or combines those with and/or/not"
            )

    def _check_spelling(self, expression: ast.Expression, source: str) -> None:
        """Reject a name whose source spelling is not the one the vocabulary serves.

        `ast.parse` NFKC-normalizes identifiers, so a full-width `ｓｅｓｓｉｏｎ＿ｉｄ` would
        otherwise resolve as `session_id` — the parser silently defining aliases for a namespace
        the vocabulary endpoint has no way to advertise. Subscript keys are data and keep their
        spelling, which is why this looks at identifiers only.
        """
        for node in ast.walk(expression):
            spelled = (
                node.id
                if isinstance(node, ast.Name)
                else node.attr
                if isinstance(node, ast.Attribute)
                else None
            )
            if spelled is not None and spelled not in source:
                raise SyntaxError(
                    f"invalid name `{spelled}`: write names exactly as the vocabulary spells them"
                )

    def _kind(self, node: ast.expr, scopes: tuple[_ElementScope, ...]) -> _Kind:
        if isinstance(node, ast.Constant):
            return self._constant(node)
        if isinstance(node, ast.Name):
            return self._name(node, scopes)
        if isinstance(node, ast.Attribute):
            return self._attribute(node, scopes)
        if isinstance(node, ast.Subscript):
            return self._subscript(node)
        if isinstance(node, ast.BoolOp):
            for value in node.values:
                self._expect(value, scopes, "boolean")
            return "boolean"
        if isinstance(node, ast.UnaryOp):
            return self._unary(node, scopes)
        if isinstance(node, ast.BinOp):
            return self._binary(node, scopes)
        if isinstance(node, ast.Compare):
            return self._compare(node, scopes)
        if isinstance(node, ast.Call):
            return self._call(node, scopes)
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")

    def _expect(self, node: ast.expr, scopes: tuple[_ElementScope, ...], expected: _Kind) -> None:
        if (actual := self._kind(node, scopes)) == expected:
            return
        hint = ""
        if actual == "json" and expected in ("float", "string"):
            cast = "float" if expected == "float" else "str"
            hint = f"; cast it with `{cast}({ast.unparse(node)})`"
        raise SyntaxError(
            f"`{ast.unparse(node)}` is {_KIND_NOUNS[actual]}, "
            f"expected {_KIND_NOUNS[expected]}{hint}"
        )

    def _constant(self, node: ast.Constant) -> _Kind:
        value = node.value
        if value is None:
            return "none"
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, (int, float)):
            if isinstance(value, float) and not math.isfinite(value):
                raise SyntaxError(f"`{ast.unparse(node)}` is not a finite number")
            return "float"
        if isinstance(value, str):
            if "\x00" in value:
                # PostgreSQL rejects a NUL in a text value outright, where SQLite stores it.
                raise SyntaxError("a text literal cannot contain a NUL character")
            return "string"
        raise SyntaxError(
            f"`{ast.unparse(node)}` is not a supported literal: "
            "write text, a number, True/False, or None"
        )

    def _name(self, node: ast.Name, scopes: tuple[_ElementScope, ...]) -> _Kind:
        name = node.id
        if (scope := _scope_of(name, scopes)) is not None:
            raise SyntaxError(
                f"`{name}` is a whole {scope.iterable} element; compare one of its fields"
            )
        if name in self._bindings.iterables:
            raise SyntaxError(
                f"`{name}` is a collection and can only be iterated, "
                f'e.g. `any(x.<field> == "..." for x in {name})`'
            )
        if scopes:
            scope = scopes[-1]
            if name in self._bindings.binding_names:
                fields = scope.grammar.element_bindings.binding_names
                raise SyntaxError(
                    f"`{name}` is a top-level term, not a {scope.iterable} element field; "
                    f"a {scope.iterable} element exposes {_disjunction(sorted(fields))}"
                )
            _raise_invalid_name(name, scope.grammar.element_bindings)
        return self._binding(name, self._bindings)

    def _binding(self, name: str, bindings: _FilterBindings) -> _Kind:
        if name in bindings.string_names or name in bindings.caller_bound_string_names:
            return "string"
        if name in bindings.float_names or name in bindings.aggregate_names:
            return "float"
        if name in bindings.datetime_names:
            return "datetime"
        if name in bindings.boolean_names:
            return "boolean"
        if name in bindings.exists_names:
            return "text"
        _raise_invalid_name(name, bindings)

    def _attribute(self, node: ast.Attribute, scopes: tuple[_ElementScope, ...]) -> _Kind:
        if (
            isinstance(value := node.value, ast.Name)
            and (scope := _scope_of(value.id, scopes)) is not None
        ):
            return self._binding(node.attr, scope.grammar.element_bindings)
        if _is_annotation(node.value):
            return "float" if node.attr == "score" else "string"
        source = ast.unparse(node)
        if replacement := self._bindings.legacy_replacements.get(source):
            return self._binding(replacement, self._bindings)
        if source in self._bindings.attribute_proxies:
            return "json"
        proxies = _disjunction(sorted(f"`{proxy}`" for proxy in self._bindings.attribute_proxies))
        raise SyntaxError(
            f"invalid name `{source}`"
            + (f"; the only dotted name is {proxies}" if proxies else "")
            + f'. Read an arbitrary root-span attribute as `attributes["{source}"]`'
        )

    def _subscript(self, node: ast.Subscript) -> _Kind:
        if _is_subscript(node, "attributes") or _is_subscript(node, "metadata"):
            if _get_attribute_keys_list(node) is None:
                raise SyntaxError(f"invalid expression: {ast.unparse(node)}")
            return "json"
        if _is_annotation(node):
            # A bare annotation reference is the existence check `annotations["q"]`.
            return "boolean"
        raise SyntaxError(f"invalid expression: {ast.unparse(node)}")

    def _unary(self, node: ast.UnaryOp, scopes: tuple[_ElementScope, ...]) -> _Kind:
        if isinstance(node.op, ast.Not):
            self._expect(node.operand, scopes, "boolean")
            return "boolean"
        if isinstance(node.op, (ast.USub, ast.UAdd)):
            self._expect(node.operand, scopes, "float")
            return "float"
        raise SyntaxError(f"`{_symbol(node.op)}` is not a supported operator")

    def _binary(self, node: ast.BinOp, scopes: tuple[_ElementScope, ...]) -> _Kind:
        if not isinstance(node.op, _ARITHMETIC_OPERATORS):
            raise SyntaxError(
                f"`{_symbol(node.op)}` is not a supported operator; "
                "arithmetic is limited to + - * / %"
            )
        self._expect(node.left, scopes, "float")
        self._expect(node.right, scopes, "float")
        return "float"

    def _compare(self, node: ast.Compare, scopes: tuple[_ElementScope, ...]) -> _Kind:
        left = node.left
        for op, right in zip(node.ops, node.comparators):
            self._link(left, op, right, scopes)
            left = right
        return "boolean"

    def _link(
        self,
        left_node: ast.expr,
        op: ast.cmpop,
        right_node: ast.expr,
        scopes: tuple[_ElementScope, ...],
    ) -> None:
        if isinstance(op, (ast.In, ast.NotIn)):
            self._containment(left_node, right_node, scopes)
            return
        if isinstance(op, (ast.Is, ast.IsNot)) and not (
            _is_none_constant(left_node) or _is_none_constant(right_node)
        ):
            # CPython's `is` is object identity, which no column comparison can mean. Reading it
            # as `==` would make the two spellings differ from Python in the same expression.
            raise SyntaxError(
                "`is` / `is not` compare against None only; use `==` / `!=` to compare values"
            )
        for node in (left_node, right_node):
            if isinstance(node, (ast.List, ast.Tuple)):
                raise SyntaxError(
                    f"`{ast.unparse(node)}` is a list, which compares with `in` / `not in` only"
                )
        left = self._kind(left_node, scopes)
        right = self._kind(right_node, scopes)
        if "none" in (left, right):
            if not isinstance(op, (ast.Is, ast.IsNot, ast.Eq, ast.NotEq)):
                raise SyntaxError(f"`{_symbol(op)}` cannot compare against None; use `is None`")
            return
        if not self._comparable(left, right, left_node, right_node):
            raise SyntaxError(
                f"cannot compare `{ast.unparse(left_node)}` ({_KIND_NOUNS[left]}) "
                f"with `{ast.unparse(right_node)}` ({_KIND_NOUNS[right]})"
            )
        if (
            isinstance(op, _ORDERING_OPERATORS)
            # A timestamp compared against its ISO literal orders as a timestamp.
            and {left, right} != {"datetime", "string"}
            and not {left, right} <= _ORDERED_KINDS
        ):
            unordered = left if left not in _ORDERED_KINDS else right
            raise SyntaxError(f"`{_symbol(op)}` does not order {_KIND_NOUNS[unordered]}")

    def _comparable(
        self,
        left: _Kind,
        right: _Kind,
        left_node: ast.expr,
        right_node: ast.expr,
    ) -> bool:
        if "json" in (left, right):
            other = right if left == "json" else left
            return other in ("json", "string", "float", "boolean")
        if left == right:
            return True
        if {left, right} == {"datetime", "string"}:
            # Only a literal is read as a timestamp; a string-typed column is not parsed per row.
            return _is_string_constant(right_node if right == "string" else left_node)
        return False

    def _containment(
        self,
        needle_node: ast.expr,
        haystack_node: ast.expr,
        scopes: tuple[_ElementScope, ...],
    ) -> None:
        if isinstance(haystack_node, (ast.List, ast.Tuple)):
            self._membership(needle_node, haystack_node, scopes)
            return
        haystack = self._kind(haystack_node, scopes)
        if haystack not in ("string", "json", "text"):
            raise SyntaxError(
                f"`in` searches text or a list, and `{ast.unparse(haystack_node)}` "
                f"is {_KIND_NOUNS[haystack]}"
            )
        if not _is_string_constant(needle_node):
            # A column needle is a cross-column substring search — a real feature, but one whose
            # cost and index behavior have not been designed; a literal keeps that door open.
            raise SyntaxError(
                f"`{ast.unparse(haystack_node)}` is searched for a text literal, "
                f"e.g. `'text' in {ast.unparse(haystack_node)}`"
            )

    def _membership(
        self,
        needle_node: ast.expr,
        haystack_node: typing.Union[ast.List, ast.Tuple],
        scopes: tuple[_ElementScope, ...],
    ) -> None:
        if isinstance(needle_node, ast.Constant):
            comparison = f"{ast.unparse(needle_node)} in {ast.unparse(haystack_node)}"
            raise SyntaxError(
                # The noun stays grain-neutral: this check also fires inside
                # comprehensions, where the correct left operand is an element
                # field rather than a session one.
                f"`{comparison}` compares two literals, expected a field on the left"
            )
        needle = self._kind(needle_node, scopes)
        if needle not in _LOOKUP_KINDS:
            raise SyntaxError(
                f"`{ast.unparse(needle_node)}` is {_KIND_NOUNS[needle]} "
                "and cannot be looked up in a list"
            )
        element_kinds: set[_Kind] = set()
        for element in haystack_node.elts:
            if not isinstance(element, ast.Constant):
                raise SyntaxError(
                    f"a list holds literal values only: `{ast.unparse(element)}` is not one"
                )
            kind = self._constant(element)
            if kind != "none":
                element_kinds.add(kind)
        if len(element_kinds) > 1:
            ordered_kinds: tuple[_Kind, ...] = ("boolean", "datetime", "float", "string")
            kind_names: typing.Mapping[_Kind, str] = {
                "boolean": "boolean",
                "datetime": "datetime",
                "float": "number",
                "string": "string",
            }
            present_kinds = [kind for kind in ordered_kinds if kind in element_kinds]
            first_kind, second_kind = present_kinds[0], present_kinds[1]
            raise SyntaxError(
                f"cannot compare {kind_names[first_kind]} and {kind_names[second_kind]}"
            )
        for element in haystack_node.elts:
            assert isinstance(element, ast.Constant)
            kind = self._constant(element)
            if kind == "none" or not self._comparable(needle, kind, needle_node, element):
                raise SyntaxError(
                    f"`{ast.unparse(element)}` does not match `{ast.unparse(needle_node)}` "
                    f"({_KIND_NOUNS[needle]}); a list is all text or all numbers"
                )

    def _call(self, node: ast.Call, scopes: tuple[_ElementScope, ...]) -> _Kind:
        if not isinstance(func := node.func, ast.Name) or len(node.args) != 1 or node.keywords:
            raise SyntaxError(f"invalid expression: {ast.unparse(node)}")
        if func.id in self._bindings.quantifiers:
            return self._comprehension(node, func.id, scopes)
        if func.id == "int":
            # `int(...)` and `float(...)` share one Float cast, so `int(1.9)` would compare as
            # 1.9 — the opposite of what the Python spelling promises.
            raise SyntaxError(
                "`int(...)` is not supported: it would not truncate. "
                "Compare the number directly, or cast with `float(...)`"
            )
        if func.id not in ("str", "float"):
            raise SyntaxError(f"invalid expression: {ast.unparse(func)}")
        argument = node.args[0]
        if isinstance(argument, ast.Constant):
            raise SyntaxError(f"`{func.id}(...)` casts a term, not a literal")
        if (kind := self._kind(argument, scopes)) in (
            "boolean",
            "none",
            "text",
            "string",
            "float",
            "datetime",
        ):
            raise SyntaxError(
                f"`{func.id}(...)` cannot cast {_KIND_NOUNS[kind]}: {ast.unparse(argument)}"
            )
        return "string" if func.id == "str" else "float"

    def _comprehension(
        self,
        node: ast.Call,
        kind: str,
        scopes: tuple[_ElementScope, ...],
    ) -> _Kind:
        # Shape (single non-async `for`, simple loop variable, declared iterable, declared element
        # fields) is already settled by `_validate_comprehensions`; only types are open here.
        comprehension = typing.cast(
            typing.Union[ast.GeneratorExp, ast.ListComp],
            _comprehension_argument(node, self._bindings),
        )
        generator = comprehension.generators[0]
        iterable, _ = _resolve_iterable(generator.iter, scopes, self._bindings)
        variable = typing.cast(ast.Name, generator.target).id
        inner = (*scopes, _ElementScope(variable, iterable, self._bindings.iterables[iterable]))
        for condition in generator.ifs:
            self._expect(condition, inner, "boolean")
        if kind in QUANTIFIER_NAMES:
            self._expect(comprehension.elt, inner, "boolean")
            return "boolean"
        if kind == "len":
            return "float"
        if (element := self._kind(comprehension.elt, inner)) != "float":
            remedy = (
                "text and timestamp ordering have no cross-dialect definition here"
                if kind in ("max", "min")
                else f"count matching elements with "
                f"`len([{variable} for {variable} in {iterable} if ...])`"
            )
            raise SyntaxError(
                f"`{kind}(...)` reduces numbers, and `{ast.unparse(comprehension.elt)}` "
                f"is {_KIND_NOUNS[element]}; {remedy}"
            )
        return "float"


def _validate_semantics(
    expression: ast.Expression,
    source: str,
    bindings: _FilterBindings,
) -> None:
    if bindings.strict_semantics:
        _SemanticPolicy(bindings).check(expression, source)


def _validate_expression(
    expression: ast.Expression,
    source: str,
    bindings: _FilterBindings = SPAN_BINDINGS,
    valid_eval_names: typing.Optional[typing.Sequence[str]] = None,
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
    _validate_exists_name_usage(expression, bindings)
    _validate_comprehensions(expression, bindings)
    for i, node in enumerate(ast.walk(expression.body)):
        if i == 0:
            if (
                isinstance(node, (ast.BoolOp, ast.Compare))
                or isinstance(node, ast.UnaryOp)
                and isinstance(node.op, ast.Not)
                or _is_annotation(node)
                or _comprehension_argument(node, bindings) is not None
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
        elif (
            bindings.supports_parent_keyword
            and isinstance(node, (ast.Attribute, ast.Subscript))
            and _is_parent_rooted(node)
        ):
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
        elif (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Attribute)
            and _is_annotation(node.value.value)
        ) or (isinstance(node, ast.Subscript) and _is_annotation(node.value)):
            # e.g. `annotations["q"].score.label` or `annotations["q"]["k"]`:
            # traversal past an annotation reads as a reference to something an
            # annotation does not expose; reject it by name instead of letting
            # it fall through to the generic attribute-path handling, which
            # would validate true and silently match nothing.
            expected = _disjunction([f"`.{attribute}`" for attribute in valid_eval_attributes])
            raise SyntaxError(
                f"invalid expression: {_ellipsize(ast.unparse(node), 80)}"
                f"; an annotation exposes only {expected}"
            )
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
            and node.func.id in (*_CAST_FUNCTIONS, *bindings.quantifiers)
        ):
            # allow type casting functions
            continue
        elif bindings.iterables and isinstance(
            node, (ast.GeneratorExp, ast.ListComp, ast.comprehension, ast.Store)
        ):
            # Comprehension nodes are admitted only for grains that declare iterables, and only
            # in the shapes `_validate_comprehensions` has already accepted above.
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
    if not bindings.strict_semantics:
        # Grains with `strict_semantics` run their own bindings-aware typed
        # pass (`_validate_semantics`); the span-vocabulary operand rules here
        # would second-guess it with span-shaped wording.
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
    # e.g. `evals["name"]`, `annotations["name"]`, `trace_annotations["name"]`
    return (
        isinstance(node, ast.Subscript)
        and isinstance(value := node.value, ast.Name)
        and value.id in _ANNOTATION_ACCESSORS
    )


def _is_annotation_rooted(node: typing.Any) -> bool:
    # e.g. `evals["name"]`, `evals["name"].score`, `evals["name"]["key"]`
    while isinstance(node, (ast.Attribute, ast.Subscript)):
        if _is_annotation(node):
            return True
        node = node.value
    return False


def _annotation_attribute_error(
    node: ast.Attribute,
    valid_eval_attributes: typing.Sequence[str],
) -> SyntaxError:
    """The one authority on how an unsupported annotation attribute is reported.

    Validation and aliasing both reach it, so the set they accept cannot drift apart.
    """
    source_segment = ast.unparse(node)
    attr = node.attr
    # suggest a valid attribute most similar to the one given
    choice, score = _find_best_match(attr, valid_eval_attributes)
    if choice and score > 0.75:  # arbitrary threshold
        return SyntaxError(
            f"invalid attribute `.{attr}` in `{source_segment}`" + f", did you mean `.{choice}`?"
        )
    expected = _disjunction([f"`.{attribute}`" for attribute in valid_eval_attributes])
    return SyntaxError(
        f"invalid eval attribute `.{attr}` in `{source_segment}`" + f", expected {expected}"
        if expected
        else ""
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
    Substitutes annotation attributes with aliases. Returns the updated source
    code in addition to the aliased relations. ``bindings`` selects the default
    annotation model and alias prefix (span vs. session grain), while
    ``trace_annotations`` explicitly selects trace annotations for span filters.

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
    aliaser = _AnnotationExpressionAliaser(source, bindings)
    aliaser.visit(root)
    encoded = source.encode()
    for start, end, alias in sorted(aliaser.replacements, reverse=True):
        encoded = encoded[:start] + alias.encode() + encoded[end:]
    return encoded.decode(), aliaser.relations


class _AnnotationExpressionAliaser(ast.NodeVisitor):
    def __init__(self, source: str, bindings: _FilterBindings = SPAN_BINDINGS) -> None:
        self._bindings = bindings
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
        self._relations_by_key: dict[
            tuple[AnnotationRelationKind, AnnotationName], AliasedAnnotationRelation
        ] = {}
        self.replacements: list[tuple[int, int, str]] = []

    @property
    def relations(self) -> tuple[AliasedAnnotationRelation, ...]:
        return tuple(self._relations_by_key.values())

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if not _is_annotation(node.value):
            self.generic_visit(node)
            return
        if node.attr not in _VALID_EVAL_ATTRIBUTES:
            return
        annotation_name = _get_subscript_key(node.value)
        if annotation_name is None:
            return
        relation = self._get_relation(node.value, annotation_name)
        attribute = typing.cast(AnnotationAttribute, node.attr)
        self._add_replacement(node, relation.attribute_alias(attribute))

    def visit_Subscript(self, node: ast.Subscript) -> None:
        if not _is_annotation(node):
            self.generic_visit(node)
            return
        annotation_name = _get_subscript_key(node)
        if annotation_name is None:
            return
        relation = self._get_relation(node, annotation_name)
        self._add_replacement(node, relation._exists_attribute_alias)

    def _get_relation(self, node: ast.Subscript, annotation_name: str) -> AliasedAnnotationRelation:
        annotation_accessor = typing.cast(ast.Name, node.value).id
        kind: AnnotationRelationKind = (
            "trace" if annotation_accessor == "trace_annotations" else "span"
        )
        key = (kind, annotation_name)
        if (relation := self._relations_by_key.get(key)) is None:
            if kind == "trace":
                if self._bindings is not SPAN_BINDINGS:
                    raise SyntaxError("`trace_annotations` is only available when filtering spans")
                annotation_model = models.TraceAnnotation
                table_prefix = "trace_annotation"
            else:
                annotation_model = self._bindings.annotation_model
                table_prefix = self._bindings.annotation_table_prefix
            relation = AliasedAnnotationRelation(
                index=len(self._relations_by_key),
                name=annotation_name,
                kind=kind,
                annotation_model=annotation_model,
                table_prefix=table_prefix,
            )
            self._relations_by_key[key] = relation
        return relation

    def _add_replacement(self, node: ast.expr, alias: str) -> None:
        if node.end_lineno is not None and node.end_col_offset is not None:
            start = self._line_offsets[node.lineno - 1] + node.col_offset
            end = self._line_offsets[node.end_lineno - 1] + node.end_col_offset
            self.replacements.append((start, end, alias))
