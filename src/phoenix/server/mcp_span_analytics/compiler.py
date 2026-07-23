"""Query compiler for the span analytics MCP tools.

Turns validated request models into SQLAlchemy statements. Three invariants
live here and nowhere else:

- **Single scoping path.** Every statement is built by ``scoped_base``,
  which joins spans to their project and binds the project row id and the
  time window. No statement in this package is constructed outside it, so
  an unscoped query is inexpressible rather than merely forbidden.
- **One identifier namespace.** ``fields``, ``filter``, and ``breakdowns``
  all resolve through ``resolve_field``: registry lookup first, then the
  canonical-attribute-path parse, and only then a nearest-name error. Any
  identifier discovery returns therefore works verbatim in every clause.
- **Structured errors.** Semantic failures raise :class:`QueryError`, which
  the tools render as a machine-readable error envelope
  (``{status: "error", code, path, message, suggestions}``) instead of a
  protocol-level exception that ends the caller's loop.
"""

from __future__ import annotations

import ast
import random
import re
from bisect import bisect_left
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from datetime import datetime, timedelta, timezone
from difflib import get_close_matches
from typing import Any, Literal, Mapping, Optional, Sequence, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import Select, SQLColumnExpression, and_, exists, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import ColumnElement
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.mcp_span_analytics import registry
from phoenix.trace.dsl.filter import SpanFilter

#: Row/group limits: the default is small enough to survey cheaply, the cap
#: bounds what one call can pull. Oversized limits are clamped, not
#: rejected — the applied value is echoed back.
ROW_LIMIT_DEFAULT = 50
ROW_LIMIT_MAX = 200
AGGREGATE_LIMIT_DEFAULT = 50
AGGREGATE_LIMIT_MAX = 200

#: When a row query omits ``time_range``, it resolves to this many recent
#: hours. An unbounded row scan must be a deliberate act, never an accident;
#: the resolved window is always echoed back.
ROW_WINDOW_DEFAULT_HOURS = 24

#: Per-statement timeout applied on PostgreSQL via ``SET LOCAL``. SQLite has
#: no equivalent in-scope backstop, and the tools say so rather than
#: implying one.
STATEMENT_TIMEOUT_MS = 30_000

#: Ceiling on the id scan backing sample-ordered row queries.
SAMPLE_ID_SCAN_CAP = 50_000

#: Fields a row query returns when ``fields`` is omitted.
DEFAULT_ROW_FIELDS: tuple[str, ...] = (
    "span_id",
    "trace_id",
    "name",
    "span_kind",
    "status_code",
    "start_time",
    "latency_ms",
)

#: Names the filter grammar resolves to span columns rather than attribute
#: paths. Used when scanning a filter's AST so that column references are
#: not mistaken for attribute paths.
_FILTER_COLUMN_NAMES: frozenset[str] = frozenset(
    {
        "span_id",
        "trace_id",
        "context",
        "parent_id",
        "span_kind",
        "name",
        "status_code",
        "status_message",
        "latency_ms",
        "start_time",
        "end_time",
        "cumulative_llm_token_count_prompt",
        "cumulative_llm_token_count_completion",
        "cumulative_llm_token_count_total",
    }
)


class QueryError(Exception):
    """A semantic query failure, rendered as a structured error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        path: Optional[str] = None,
        suggestions: Sequence[str] = (),
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.path = path
        self.suggestions = list(suggestions)

    def envelope(self) -> dict[str, Any]:
        return {
            "status": "error",
            "code": self.code,
            "path": self.path,
            "message": self.message,
            "suggestions": self.suggestions,
        }


# --------------------------------------------------------------------------
# Request models
# --------------------------------------------------------------------------


class TimeRange(BaseModel):
    """Half-open UTC time window over span start_time: start ≤ t < end."""

    model_config = ConfigDict(extra="forbid")

    start: datetime = Field(
        description=(
            "Inclusive lower bound on span start_time, ISO-8601 "
            "(e.g. '2026-07-22T00:00:00Z'). Naive timestamps are treated as UTC."
        )
    )
    end: datetime = Field(
        description="Exclusive upper bound on span start_time, ISO-8601.",
    )


class RowOrderField(BaseModel):
    """One ordering entry of a row query."""

    model_config = ConfigDict(extra="forbid")

    field: str = Field(description="Field to order by; must be one of the selected fields.")
    direction: Literal["asc", "desc"] = Field(
        default="desc", description="Sort direction (default desc)."
    )


class SampleSpec(BaseModel):
    """Seeded random sampling parameters."""

    model_config = ConfigDict(extra="forbid")

    seed: int = Field(description="PRNG seed; the same seed returns the same rows.")


class SampleOrder(BaseModel):
    """Sample order mode: representative rows instead of extremes.

    Ordering by an extreme (say latency desc) is biased by construction;
    a seeded random sample answers "show me representative failures"
    reproducibly. Deterministic given the seed; not pageable.
    """

    model_config = ConfigDict(extra="forbid")

    sample: SampleSpec = Field(description="Seeded sampling parameters.")


class TimeBucket(BaseModel):
    """A calculated breakdown grouping spans by hour of start_time (UTC)."""

    model_config = ConfigDict(extra="forbid")

    bucket: Literal["hour"] = Field(
        description="Bucket granularity; only 'hour' is supported.",
    )


class Calculation(BaseModel):
    """One named aggregate calculation."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, description="Result column name for this calculation.")
    fn: str = Field(
        description=(
            "Aggregation function: count, count_distinct, sum, avg, min, max, p50, p90, p95, p99."
        )
    )
    field: Optional[str] = Field(
        default=None,
        description=(
            "Field to aggregate. Required for every function except count; "
            "count with a field counts rows where the field is non-NULL. "
            "count and count_distinct accept any field, authored or observed; "
            "sum/avg/min/max/percentiles require a value-aggregatable field."
        ),
    )


class AggregateOrderEntry(BaseModel):
    """One ordering entry of an aggregate query.

    References a declared calculation by name or a breakdown by field id
    ('time_bucket' for the hour bucket) — exactly one of the two.
    """

    model_config = ConfigDict(extra="forbid")

    calculation: Optional[str] = Field(
        default=None, description="Name of a declared calculation to order by."
    )
    field: Optional[str] = Field(
        default=None,
        description="Breakdown field id to order by ('time_bucket' for the hour bucket).",
    )
    direction: Literal["asc", "desc"] = Field(
        default="desc", description="Sort direction (default desc)."
    )

    @model_validator(mode="after")
    def _exactly_one_reference(self) -> "AggregateOrderEntry":
        if (self.calculation is None) == (self.field is None):
            raise ValueError("order entries reference exactly one of 'calculation' or 'field'")
        return self


def _normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_time_range(time_range: TimeRange) -> TimeRange:
    start = _normalize_utc(time_range.start)
    end = _normalize_utc(time_range.end)
    if not start < end:
        raise QueryError(
            code="invalid_time_range",
            path="time_range",
            message="time_range.start must be strictly before time_range.end.",
        )
    return TimeRange(start=start, end=end)


class RowQuery(BaseModel):
    """Validated request for a row retrieval."""

    model_config = ConfigDict(extra="forbid")

    project: str
    time_range: Optional[TimeRange] = None
    fields: Optional[list[str]] = None
    filter: Optional[str] = None
    order: Optional[Union[list[RowOrderField], SampleOrder]] = None
    limit: int = ROW_LIMIT_DEFAULT
    validate_only: bool = False

    @model_validator(mode="after")
    def _validate(self) -> "RowQuery":
        if self.time_range is not None:
            self.time_range = _validate_time_range(self.time_range)
        if self.fields is not None and not self.fields:
            raise QueryError(
                code="invalid_request",
                path="fields",
                message="fields must be omitted or non-empty.",
            )
        return self


class AggregateQuery(BaseModel):
    """Validated request for an aggregation."""

    model_config = ConfigDict(extra="forbid")

    project: str
    time_range: TimeRange
    filter: Optional[str] = None
    calculations: list[Calculation]
    breakdowns: list[Union[str, TimeBucket]] = Field(default_factory=list)
    order: Optional[list[AggregateOrderEntry]] = None
    limit: int = AGGREGATE_LIMIT_DEFAULT
    validate_only: bool = False

    @model_validator(mode="after")
    def _validate(self) -> "AggregateQuery":
        self.time_range = _validate_time_range(self.time_range)
        if not self.calculations:
            raise QueryError(
                code="invalid_request",
                path="calculations",
                message="calculations must contain at least one entry.",
            )
        names = [c.name for c in self.calculations]
        duplicates = sorted({n for n in names if names.count(n) > 1})
        if duplicates:
            raise QueryError(
                code="invalid_request",
                path="calculations",
                message=f"calculation names must be unique; duplicated: {', '.join(duplicates)}.",
            )
        return self


# --------------------------------------------------------------------------
# Resolution
# --------------------------------------------------------------------------


async def resolve_project_rowid(session: AsyncSession, identifier: str) -> Optional[int]:
    """Resolve a project by id or name to its row id.

    Accepts either form because neighboring tools emit both; a caller
    should never have to convert an identifier another tool just returned.
    Both forms produce the same ``None`` for a missing project, so neither
    is an existence oracle.
    """
    try:
        global_id = GlobalID.from_id(identifier)
        type_name, node_id = global_id.type_name, int(global_id.node_id)
    except Exception:
        pass
    else:
        if type_name == "Project":
            rowid: Optional[int] = await session.scalar(
                select(models.Project.id).where(models.Project.id == node_id)
            )
            return rowid
        return None
    by_name: Optional[int] = await session.scalar(
        select(models.Project.id).where(models.Project.name == identifier)
    )
    return by_name


def project_not_found(identifier: str) -> QueryError:
    """The not-found error, identical for id and name forms."""
    return QueryError(
        code="project_not_found",
        path="project",
        message=f"Project {identifier!r} not found.",
    )


async def project_not_found_error(session: AsyncSession, identifier: str) -> QueryError:
    """The not-found error with nearest-name suggestions from existing projects.

    Suggestions are computed over the full project-name list, which is safe
    today because every project is listable by every caller (getProjects
    discloses the same names). If per-project authorization is ever
    introduced, the candidate list here must be filtered to the caller's
    visible set first — otherwise nearest-name suggestions become a
    project-enumeration channel that leaks names the caller may not list.
    """
    names = list((await session.execute(select(models.Project.name))).scalars())
    error = project_not_found(identifier)
    error.suggestions = get_close_matches(identifier, names, n=3)
    return error


def resolve_field(identifier: str) -> registry.ResolvedField:
    """Resolve one identifier: registry, then attribute path, then error."""
    if authored := registry.AUTHORED_BY_ID.get(identifier):
        return authored
    if identifier in registry.RESERVED_UNEXPOSED:
        raise QueryError(
            code="field_not_exposed",
            message=(
                f"{identifier!r} is a span column the filter grammar knows but this surface "
                "does not expose as a field. Use describeSpans to list available fields."
            ),
            suggestions=get_close_matches(identifier, registry.AUTHORED_BY_ID.keys(), n=3),
        )
    if re.match(r"^\s*(evals|annotations)\b", identifier):
        # Annotation *values* stay out of fields/breakdowns/calculations:
        # several annotators can score one span under one name, so
        # projecting or aggregating the value needs a declared reduction
        # this surface does not implement. The refusal carries its route.
        raise QueryError(
            code="annotation_values_not_supported",
            message=(
                f"{identifier!r} cannot be selected, grouped, or aggregated: a span "
                "can carry several annotation rows under one name, so value use "
                "requires declared reduction semantics. Decomposition: fetch rows "
                "with querySpanRows, then call listSpanAnnotationsBySpanIds with "
                "the returned span_ids and filter or aggregate client-side. "
                "Annotation *filters* are supported, e.g. "
                "\"evals['correctness'].score < 0.5\"."
            ),
            suggestions=["listSpanAnnotationsBySpanIds"],
        )
    keys = registry.parse_attribute_path(identifier)
    if keys is not None and keys[0] not in ("evals", "annotations"):
        # A bare name that closely resembles an authored field id is far
        # more likely a misspelling than a real top-level attribute; the
        # subscript spelling remains the unambiguous way to reference a
        # genuinely so-named attribute.
        if (
            len(keys) == 1
            and identifier.strip() == keys[0]
            and registry.bare_name_conflicts(keys[0])
        ):
            close = get_close_matches(keys[0], registry.AUTHORED_BY_ID.keys(), n=3)
            raise QueryError(
                code="unknown_field",
                message=(
                    f"Field {identifier!r} does not exist."
                    + (f" Did you mean: {', '.join(close)}?" if close else "")
                    + f" To read a literal top-level attribute named {identifier!r}, "
                    f'spell it attributes["{keys[0]}"].'
                ),
                suggestions=[*close, f'attributes["{keys[0]}"]'],
            )
        return registry.ObservedField(id=identifier, keys=keys)
    suggestions = get_close_matches(identifier, registry.AUTHORED_BY_ID.keys(), n=3)
    hint = f" Did you mean: {', '.join(suggestions)}?" if suggestions else ""
    raise QueryError(
        code="unknown_field",
        message=f"Field {identifier!r} does not exist.{hint}",
        suggestions=suggestions,
    )


# --------------------------------------------------------------------------
# Filter validation
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class AnnotationPredicate:
    """One annotation existence test: name plus a score or label comparison.

    Compiled as an EXISTS subquery against ``span_annotations``, which is
    what makes annotation *filtering* safe where annotation *aggregation*
    is not: an existence test never multiplies span rows, no matter how
    many annotation rows match, so counts and sums over the filtered spans
    stay correct under annotation multiplicity. The semantics are
    any-annotator — the predicate is true if any annotation row with the
    name matches — and are disclosed structurally in the envelope.
    """

    name: str
    attribute: Literal["score", "label"]
    op: str
    value: Union[float, str]

    def clause(self) -> ColumnElement[bool]:
        column: SQLColumnExpression[Any] = (
            models.SpanAnnotation.score
            if self.attribute == "score"
            else models.SpanAnnotation.label
        )
        comparisons: dict[str, ColumnElement[bool]] = {
            "<": column < self.value,
            "<=": column <= self.value,
            ">": column > self.value,
            ">=": column >= self.value,
            "==": column == self.value,
            "!=": column != self.value,
        }
        return exists().where(
            and_(
                models.SpanAnnotation.span_rowid == models.Span.id,
                models.SpanAnnotation.name == self.name,
                comparisons[self.op],
            )
        )


@dataclass(frozen=True)
class CompiledFilter:
    """A validated filter: the residual grammar expression plus any
    annotation existence predicates split out for EXISTS compilation."""

    span_filter: Optional[SpanFilter]
    annotation_predicates: list[AnnotationPredicate]

    @property
    def uses_annotations(self) -> bool:
        return bool(self.annotation_predicates)

    def __call__(self, stmt: Select[Any]) -> Select[Any]:
        if self.span_filter is not None:
            stmt = self.span_filter(stmt)
        for predicate in self.annotation_predicates:
            stmt = stmt.where(predicate.clause())
        return stmt


def validated_filter(condition: Optional[str]) -> Optional[CompiledFilter]:
    """Validate and compile a filter expression, enforcing surface rules.

    Annotation references get special treatment: a simple comparison of
    ``evals['name'].score`` / ``.label`` appearing as a top-level AND
    conjunct compiles to an EXISTS predicate (safe under annotation
    multiplicity — see :class:`AnnotationPredicate`); any other annotation
    use is rejected with the supported shape and the two-call
    decomposition. Beyond that, temporal predicates are rejected (temporal
    scope has exactly one home, the ``time_range`` parameter), as are
    computed-field names the grammar would silently misread.
    """
    if not condition:
        return None
    try:
        root = ast.parse(condition, mode="eval")
    except SyntaxError as error:
        raise QueryError(
            code="invalid_filter",
            path="filter",
            message=f"Invalid filter expression: {error.msg}.",
        )
    conjuncts = (
        list(root.body.values)
        if isinstance(root.body, ast.BoolOp) and isinstance(root.body.op, ast.And)
        else [root.body]
    )
    residual_parts: list[str] = []
    predicates: list[AnnotationPredicate] = []
    for conjunct in conjuncts:
        predicate = _annotation_predicate(conjunct)
        if predicate is not None:
            predicates.append(predicate)
            continue
        _reject_unsupported_filter_nodes(conjunct)
        residual_parts.append(ast.unparse(conjunct))
    span_filter: Optional[SpanFilter] = None
    if residual_parts:
        try:
            span_filter = SpanFilter(" and ".join(residual_parts))
        except SyntaxError as error:
            raise QueryError(
                code="invalid_filter",
                path="filter",
                message=f"Invalid filter expression: {error}.",
            )
    return CompiledFilter(span_filter=span_filter, annotation_predicates=predicates)


_ANNOTATION_COMPARE_OPS: Mapping[type, str] = {
    ast.Lt: "<",
    ast.LtE: "<=",
    ast.Gt: ">",
    ast.GtE: ">=",
    ast.Eq: "==",
    ast.NotEq: "!=",
}

_MIRRORED_OPS: Mapping[str, str] = {
    "<": ">",
    "<=": ">=",
    ">": "<",
    ">=": "<=",
    "==": "==",
    "!=": "!=",
}


def _annotation_reference(node: ast.expr) -> Optional[tuple[str, str]]:
    """(annotation name, attribute) for ``evals['x'].score``-shaped nodes."""
    if not (isinstance(node, ast.Attribute) and node.attr in ("score", "label")):
        return None
    subscript = node.value
    if not (
        isinstance(subscript, ast.Subscript)
        and isinstance(subscript.value, ast.Name)
        and subscript.value.id in ("evals", "annotations")
        and isinstance(subscript.slice, ast.Constant)
        and isinstance(subscript.slice.value, str)
    ):
        return None
    return subscript.slice.value, node.attr


def _annotation_predicate(node: ast.expr) -> Optional["AnnotationPredicate"]:
    """Recognize one supported annotation comparison, either operand order:
    ``evals['name'].score <op> <number>`` or ``evals['name'].label ==/!= <string>``.
    """
    if not (isinstance(node, ast.Compare) and len(node.ops) == 1):
        return None
    op_symbol = _ANNOTATION_COMPARE_OPS.get(type(node.ops[0]))
    if op_symbol is None:
        return None
    left, right = node.left, node.comparators[0]
    reference = _annotation_reference(left)
    constant = right
    if reference is None:
        reference = _annotation_reference(right)
        constant = left
        op_symbol = _MIRRORED_OPS[op_symbol]
    if reference is None or not isinstance(constant, ast.Constant):
        return None
    name, attribute = reference
    value = constant.value
    if attribute == "score":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        return AnnotationPredicate(name=name, attribute="score", op=op_symbol, value=float(value))
    if op_symbol in ("==", "!=") and isinstance(value, str):
        return AnnotationPredicate(name=name, attribute="label", op=op_symbol, value=value)
    return None


def _reject_unsupported_filter_nodes(tree: ast.AST) -> None:
    """Structured rejections for names the residual filter must not reach."""
    for node in ast.walk(tree):
        # Computed dotted fields would otherwise compile as lookups of
        # nonexistent attributes and silently match nothing.
        if isinstance(node, ast.Attribute) and ast.unparse(node) in (
            "input.chars",
            "input.turns",
        ):
            raise QueryError(
                code="field_not_filterable",
                path="filter",
                message=(
                    f"{ast.unparse(node)} is a computed field, select-and-aggregate "
                    "only: the filter grammar reads attribute paths, not computed "
                    "expressions. Filter on recorded attributes (e.g. input.value "
                    "content) instead."
                ),
                suggestions=["input.value"],
            )
        if not isinstance(node, ast.Name):
            continue
        if node.id in ("start_time", "end_time"):
            raise QueryError(
                code="temporal_filter",
                path="filter",
                message=(
                    f"Temporal predicates ({node.id}) are not allowed in filter; "
                    "temporal scope has exactly one home, the time_range parameter."
                ),
                suggestions=["time_range"],
            )
        if node.id in ("evals", "annotations"):
            raise QueryError(
                code="unsupported_filter_reference",
                path="filter",
                message=(
                    f"{node.id}[...] filters are supported only as simple top-level "
                    "AND conditions comparing .score to a number or .label to a "
                    "string (e.g. \"evals['correctness'].score < 0.5\"); nested or "
                    "composite annotation expressions are not. For anything richer, "
                    "fetch rows with querySpanRows, then call "
                    "listSpanAnnotationsBySpanIds with the returned span_ids and "
                    "filter client-side."
                ),
                suggestions=["evals['correctness'].score < 0.5"],
            )
        if node.id == "is_error":
            raise QueryError(
                code="field_not_filterable",
                path="filter",
                message=(
                    "is_error is aggregate-only. Filter failures with "
                    "\"status_code == 'ERROR'\" instead."
                ),
                suggestions=["status_code == 'ERROR'"],
            )
        if node.id == "cost":
            # Without this guard, "cost.total" in a filter would compile as
            # a lookup of a (nonexistent) "cost" attribute and silently
            # match nothing — the silent-wrong failure this surface exists
            # to prevent.
            raise QueryError(
                code="field_not_filterable",
                path="filter",
                message=(
                    "cost.total is select-and-aggregate only: the filter grammar has no "
                    "cost predicate on this surface. Select cost.total and inspect rows, "
                    "aggregate it, or filter on llm.token_count.total instead."
                ),
                suggestions=["llm.token_count.total"],
            )


def attribute_paths_in_filter(condition: str) -> set[tuple[str, ...]]:
    """Attribute paths a filter references, for zero-result diagnosis."""
    try:
        root = ast.parse(condition, mode="eval")
    except SyntaxError:
        return set()
    paths: set[tuple[str, ...]] = set()

    def visit(node: ast.AST) -> None:
        if isinstance(node, ast.Name) and node.id in _FILTER_COLUMN_NAMES:
            return
        # Annotation references are predicates against their own table, not
        # attribute paths; they must not feed path_not_observed diagnosis.
        if isinstance(node, ast.Name) and node.id in ("evals", "annotations"):
            return
        if isinstance(node, (ast.Name, ast.Attribute, ast.Subscript)):
            keys = registry.parse_attribute_path(ast.unparse(node))
            if keys is not None and keys[0] not in _FILTER_COLUMN_NAMES:
                paths.add(keys)
                return
        for child in ast.iter_child_nodes(node):
            visit(child)

    visit(root.body)
    return paths


# --------------------------------------------------------------------------
# Scoped statement base
# --------------------------------------------------------------------------


def scoped_base(
    columns: Sequence[Any],
    project_rowid: int,
    time_range: Optional[TimeRange],
) -> Select[Any]:
    """The single statement base: spans joined to traces, bound to one
    project, restricted to the time window. Deliberately carries no
    ordering — aggregates must not inherit row ordering, and PostgreSQL
    rejects ordering by ungrouped columns.
    """
    stmt: Select[Any] = (
        select(*columns)
        .select_from(models.Span)
        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
        .where(models.Trace.project_rowid == project_rowid)
    )
    if time_range is not None:
        stmt = stmt.where(
            models.Span.start_time >= time_range.start,
            models.Span.start_time < time_range.end,
        )
    return stmt


async def apply_statement_timeout(
    session: AsyncSession, dialect: SupportedSQLDialect
) -> Optional[int]:
    """Bound statement runtime on PostgreSQL for the current transaction.

    Returns the applied timeout in milliseconds, or ``None`` on SQLite,
    which has no equivalent per-statement backstop.
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        await session.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
        return STATEMENT_TIMEOUT_MS
    return None


# --------------------------------------------------------------------------
# Row compilation
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ColumnSpec:
    """Typed metadata for one result column."""

    id: str
    type: str
    unit: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {"id": self.id, "type": self.type, "unit": self.unit}


@dataclass
class RowPlan:
    """Compiled row query: statements plus the metadata the envelope needs."""

    columns: list[ColumnSpec]
    time_range: TimeRange
    time_range_defaulted: bool
    applied_limit: int
    sample: Optional[SampleSpec]
    stmt: Optional[Select[Any]]
    #: Sample mode: the bounded id scan feeding the seeded probe.
    ids_stmt: Optional[Select[Any]]
    _project_rowid: int = dataclass_field(default=0, repr=False)
    _selected: list[registry.ResolvedField] = dataclass_field(default_factory=list, repr=False)
    _filter: Optional[CompiledFilter] = dataclass_field(default=None, repr=False)
    uses_annotation_filter: bool = False
    _dialect: SupportedSQLDialect = dataclass_field(default=SupportedSQLDialect.SQLITE, repr=False)

    def choose_sample_ids(self, ids: Sequence[int]) -> list[int]:
        """Choose up to ``applied_limit`` ids by seeded rowid probing.

        The PRNG draws candidate ids in ``[min(id), max(id)]``; each probe
        seeks forward to the first not-yet-chosen existing id. Deterministic
        given the seed and the id set; not pageable.
        """
        assert self.sample is not None
        sorted_ids = sorted(ids)
        if not sorted_ids:
            return []
        rng = random.Random(self.sample.seed)
        chosen: list[int] = []
        chosen_set: set[int] = set()
        max_attempts = self.applied_limit * 20
        attempts = 0
        while (
            len(chosen) < self.applied_limit
            and len(chosen) < len(sorted_ids)
            and attempts < max_attempts
        ):
            attempts += 1
            probe = rng.randint(sorted_ids[0], sorted_ids[-1])
            index = bisect_left(sorted_ids, probe)
            while index < len(sorted_ids) and sorted_ids[index] in chosen_set:
                index += 1
            if index == len(sorted_ids):
                continue
            chosen_set.add(sorted_ids[index])
            chosen.append(sorted_ids[index])
        return sorted(chosen)

    @property
    def observed_fields(self) -> list[registry.ObservedField]:
        """The selected observed attribute fields, for admission checks
        against the discovery sample."""
        return [f for f in self._selected if isinstance(f, registry.ObservedField)]

    def rows_stmt_for_ids(self, ids: Sequence[int]) -> Select[Any]:
        """The one IN-list fetch of the sampled rows."""
        stmt = scoped_base(
            [f.expr(self._dialect).label(f.id) for f in self._selected],
            self._project_rowid,
            self.time_range,
        ).where(models.Span.id.in_(list(ids)))
        if self._filter is not None:
            stmt = self._filter(stmt)
        return stmt.order_by(models.Span.id.asc())


def _column_spec(resolved: registry.ResolvedField) -> ColumnSpec:
    if isinstance(resolved, registry.AuthoredField):
        return ColumnSpec(id=resolved.id, type=resolved.type, unit=resolved.unit)
    return ColumnSpec(id=resolved.id, type="json", unit=None)


def compile_rows(
    query: RowQuery,
    project_rowid: int,
    dialect: SupportedSQLDialect,
    now: Optional[datetime] = None,
) -> RowPlan:
    """Compile a row query into an ordered, bounded statement."""
    now = now or datetime.now(timezone.utc)
    if query.time_range is not None:
        time_range, defaulted = query.time_range, False
    else:
        time_range = TimeRange(start=now - timedelta(hours=ROW_WINDOW_DEFAULT_HOURS), end=now)
        defaulted = True

    field_ids = list(query.fields) if query.fields else list(DEFAULT_ROW_FIELDS)
    # Row identity is implicit: span_id is always included whether or not it
    # was selected, so every row can be recovered in full via getSpan.
    if "span_id" not in field_ids:
        field_ids.insert(0, "span_id")
    selected: list[registry.ResolvedField] = []
    seen: set[str] = set()
    for index, field_id in enumerate(field_ids):
        try:
            resolved = resolve_field(field_id)
        except QueryError as error:
            error.path = error.path or f"fields[{index}]"
            raise
        if resolved.id not in seen:
            seen.add(resolved.id)
            selected.append(resolved)

    filter_ = validated_filter(query.filter)
    applied_limit = max(1, min(query.limit, ROW_LIMIT_MAX))
    columns = [_column_spec(f) for f in selected]

    if isinstance(query.order, SampleOrder):
        ids_stmt = scoped_base([models.Span.id], project_rowid, time_range)
        if filter_ is not None:
            ids_stmt = filter_(ids_stmt)
        ids_stmt = ids_stmt.order_by(models.Span.id.asc()).limit(SAMPLE_ID_SCAN_CAP)
        return RowPlan(
            columns=columns,
            time_range=time_range,
            time_range_defaulted=defaulted,
            applied_limit=applied_limit,
            sample=query.order.sample,
            stmt=None,
            ids_stmt=ids_stmt,
            _project_rowid=project_rowid,
            _selected=selected,
            _filter=filter_,
            _dialect=dialect,
            uses_annotation_filter=filter_.uses_annotations if filter_ else False,
        )

    order_exprs: list[ColumnElement[Any]] = []
    if query.order:
        by_id = {f.id: f for f in selected}
        for index, entry in enumerate(query.order):
            resolved_order = by_id.get(entry.field)
            if resolved_order is None:
                raise QueryError(
                    code="invalid_order",
                    path=f"order[{index}].field",
                    message=(
                        f"order references {entry.field!r}, which is not among the selected "
                        "fields; add it to fields or order by a selected field."
                    ),
                    suggestions=get_close_matches(entry.field, by_id.keys(), n=3),
                )
            expr = resolved_order.expr(dialect)
            # NULL placement is declared, not inherited: the backends
            # disagree by default (PostgreSQL puts NULLs first on DESC,
            # SQLite last), and a nullable ordering field (guarded numeric
            # extraction, cost) would return backend-dependent row order.
            # NULLs always sort last — values are what an ordering asks for.
            order_exprs.append(
                expr.desc().nulls_last() if entry.direction == "desc" else expr.asc().nulls_last()
            )
    else:
        order_exprs.append(models.Span.start_time.desc())
    # Deterministic tie-break: the primary key ends every ordering.
    order_exprs.append(models.Span.id.asc())

    stmt = scoped_base([f.expr(dialect).label(f.id) for f in selected], project_rowid, time_range)
    if filter_ is not None:
        stmt = filter_(stmt)
    stmt = stmt.order_by(*order_exprs).limit(applied_limit)
    return RowPlan(
        columns=columns,
        time_range=time_range,
        time_range_defaulted=defaulted,
        applied_limit=applied_limit,
        sample=None,
        stmt=stmt,
        ids_stmt=None,
        _project_rowid=project_rowid,
        _selected=selected,
        _filter=filter_,
        _dialect=dialect,
        uses_annotation_filter=filter_.uses_annotations if filter_ else False,
    )


# --------------------------------------------------------------------------
# Aggregate compilation
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ResolvedCalculation:
    name: str
    fn: str
    additive: bool
    expr: ColumnElement[Any]


@dataclass(frozen=True)
class ResolvedBreakdown:
    id: str
    expr: SQLColumnExpression[Any]
    is_time_bucket: bool
    column: ColumnSpec


@dataclass
class AggregatePlan:
    """Compiled aggregation: the grouped top-K statement, the explicit
    group-count statement, and the ungrouped overall-totals statement."""

    calculations: list[ResolvedCalculation]
    breakdowns: list[ResolvedBreakdown]
    stmt: Select[Any]
    groups_total_stmt: Optional[Select[Any]]
    overall_stmt: Select[Any]
    applied_limit: int
    time_range: TimeRange
    share_basis: Optional[str]
    #: The project's relay GlobalID — the identifier the UI's routes use —
    #: resolved once here so every group row can carry a cohort deep link.
    project_gid: str
    #: Whether the filter used annotation existence predicates; the tools
    #: disclose the any-annotator semantics structurally when it did.
    uses_annotation_filter: bool
    #: Observed attribute fields the query references in breakdowns or
    #: calculations, for admission checks against the discovery sample.
    observed_fields: list[registry.ObservedField] = dataclass_field(default_factory=list)


def compile_aggregate(
    query: AggregateQuery,
    project_rowid: int,
    dialect: SupportedSQLDialect,
) -> AggregatePlan:
    """Compile an aggregation into its three statements."""
    observed_fields: dict[str, registry.ObservedField] = {}
    calculations: list[ResolvedCalculation] = []
    for index, calc in enumerate(query.calculations):
        spec = registry.AGGREGATIONS.get(calc.fn)
        if spec is None:
            raise QueryError(
                code="unknown_aggregation",
                path=f"calculations[{index}].fn",
                message=f"Unknown aggregation {calc.fn!r}.",
                suggestions=get_close_matches(calc.fn, registry.AGGREGATIONS.keys(), n=3),
            )
        field_expr: Optional[SQLColumnExpression[Any]] = None
        if calc.field is not None:
            try:
                resolved = resolve_field(calc.field)
            except QueryError as error:
                error.path = error.path or f"calculations[{index}].field"
                raise
            if not spec.presence and not resolved.aggregatable:
                # Presence aggregations (count, count_distinct) never compute
                # on the value, so they pass for any field; only value
                # aggregations are gated on declared numeric semantics.
                aggregatable = sorted(f.id for f in registry.AUTHORED_FIELDS if f.aggregatable)
                reason = (
                    " Cast semantics for arbitrary observed JSON paths are "
                    "undefined, so value aggregation is limited to authored fields."
                    if isinstance(resolved, registry.ObservedField)
                    else ""
                )
                raise QueryError(
                    code="field_not_aggregatable",
                    path=f"calculations[{index}].field",
                    message=(
                        f"{calc.field!r} supports only presence aggregations (count, "
                        "count_distinct), which count rows and distinct values without "
                        "computing on them; value aggregations (sum, avg, min, max, "
                        f"percentiles) require a value-aggregatable field.{reason} "
                        f"Value-aggregatable fields: {', '.join(aggregatable)}."
                    ),
                    suggestions=aggregatable,
                )
            if isinstance(resolved, registry.ObservedField):
                observed_fields[resolved.id] = resolved
            field_expr = resolved.expr(dialect)
        elif spec.requires_field:
            raise QueryError(
                code="invalid_request",
                path=f"calculations[{index}].field",
                message=f"Aggregation {calc.fn!r} requires a field.",
            )
        calculations.append(
            ResolvedCalculation(
                name=calc.name,
                fn=calc.fn,
                additive=spec.additive,
                expr=registry.aggregation_expr(calc.fn, field_expr, dialect),
            )
        )

    breakdowns: list[ResolvedBreakdown] = []
    for index, breakdown in enumerate(query.breakdowns):
        if isinstance(breakdown, TimeBucket):
            breakdowns.append(
                ResolvedBreakdown(
                    id=registry.TIME_BUCKET_ID,
                    expr=registry.time_bucket_expr(dialect),
                    is_time_bucket=True,
                    column=ColumnSpec(id=registry.TIME_BUCKET_ID, type="datetime"),
                )
            )
            continue
        try:
            resolved = resolve_field(breakdown)
        except QueryError as error:
            error.path = error.path or f"breakdowns[{index}]"
            raise
        if not resolved.groupable:
            groupable = sorted(f.id for f in registry.AUTHORED_FIELDS if f.groupable)
            alternatives = [*groupable, '{"bucket": "hour"} (hourly time bucket)']
            raise QueryError(
                code="field_not_groupable",
                path=f"breakdowns[{index}]",
                message=(
                    f"{breakdown!r} cannot be used as a breakdown: grouping is limited to "
                    "declared-groupable fields to keep group cardinality bounded. "
                    f"Alternatives: {', '.join(alternatives)}."
                ),
                suggestions=alternatives,
            )
        if isinstance(resolved, registry.ObservedField):
            observed_fields[resolved.id] = resolved
        breakdowns.append(
            ResolvedBreakdown(
                id=resolved.id,
                expr=resolved.expr(dialect),
                is_time_bucket=False,
                column=_column_spec(resolved),
            )
        )
    breakdown_ids = [b.id for b in breakdowns]
    if len(set(breakdown_ids)) != len(breakdown_ids):
        raise QueryError(
            code="invalid_request",
            path="breakdowns",
            message="breakdowns must not repeat.",
        )

    order_exprs: list[ColumnElement[Any]] = []
    ordered_breakdown_ids: set[str] = set()
    if query.order:
        calc_by_name = {c.name: c for c in calculations}
        breakdown_by_id = {b.id: b for b in breakdowns}
        for index, entry in enumerate(query.order):
            if entry.calculation is not None:
                calc_ref = calc_by_name.get(entry.calculation)
                if calc_ref is None:
                    raise QueryError(
                        code="invalid_order",
                        path=f"order[{index}].calculation",
                        message=(
                            f"order[{index}].calculation references no declared calculation: "
                            f"{entry.calculation!r}."
                        ),
                        suggestions=get_close_matches(entry.calculation, calc_by_name.keys(), n=3),
                    )
                expr: SQLColumnExpression[Any] = calc_ref.expr
            else:
                assert entry.field is not None
                breakdown_ref = breakdown_by_id.get(entry.field)
                if breakdown_ref is None:
                    raise QueryError(
                        code="invalid_order",
                        path=f"order[{index}].field",
                        message=(
                            f"order[{index}].field references no declared breakdown: "
                            f"{entry.field!r}."
                        ),
                        suggestions=get_close_matches(entry.field, breakdown_by_id.keys(), n=3),
                    )
                expr = breakdown_ref.expr
                ordered_breakdown_ids.add(breakdown_ref.id)
            # Declared NULL placement, as in row ordering: backends disagree
            # on the default, so NULL calculation values and null group keys
            # always sort last.
            order_exprs.append(
                expr.desc().nulls_last() if entry.direction == "desc" else expr.asc().nulls_last()
            )
    # Breakdown keys always terminate the ordering (default order when no
    # explicit order was given): group results are deterministic and ties
    # at the limit boundary break reproducibly.
    for breakdown_entry in breakdowns:
        if breakdown_entry.id not in ordered_breakdown_ids:
            order_exprs.append(breakdown_entry.expr.asc())

    filter_ = validated_filter(query.filter)
    applied_limit = max(1, min(query.limit, AGGREGATE_LIMIT_MAX))

    select_columns: list[Any] = [b.expr.label(b.id) for b in breakdowns]
    select_columns.extend(c.expr.label(c.name) for c in calculations)
    stmt = scoped_base(select_columns, project_rowid, query.time_range)
    if filter_ is not None:
        stmt = filter_(stmt)
    grouped = stmt.group_by(*(b.expr for b in breakdowns)) if breakdowns else stmt
    final_stmt = grouped.order_by(*order_exprs).limit(applied_limit) if breakdowns else grouped

    groups_total_stmt: Optional[Select[Any]] = None
    if breakdowns:
        from sqlalchemy import func as sqla_func

        groups_total_stmt = select(sqla_func.count()).select_from(grouped.subquery())

    overall_stmt = scoped_base(
        [c.expr.label(c.name) for c in calculations], project_rowid, query.time_range
    )
    if filter_ is not None:
        overall_stmt = filter_(overall_stmt)

    share_basis = next((c.name for c in calculations if c.additive), None)
    return AggregatePlan(
        calculations=calculations,
        breakdowns=breakdowns,
        stmt=final_stmt,
        groups_total_stmt=groups_total_stmt,
        overall_stmt=overall_stmt,
        applied_limit=applied_limit,
        time_range=query.time_range,
        share_basis=share_basis,
        project_gid=str(GlobalID("Project", str(project_rowid))),
        uses_annotation_filter=filter_.uses_annotations if filter_ else False,
        observed_fields=list(observed_fields.values()),
    )
