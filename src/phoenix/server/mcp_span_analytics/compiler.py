"""Query compiler for the span analytics MCP tools.

Turns validated request models into SQLAlchemy statements. Three invariants
live here and nowhere else:

- **Single scoping path.** Every statement is built by ``scoped_base``,
  which delegates to the grain's own scope: the project row id and the time
  window are bound there and only there. No statement in this package is
  constructed outside it, so an unscoped query is inexpressible rather than
  merely forbidden.
- **One identifier namespace per grain.** ``fields``, ``filter``, and
  ``breakdowns`` all resolve through ``resolve_field`` against the grain
  the request names: grain lookup first, then — on the spans grain only —
  annotation enrichment and the canonical-attribute-path parse, and only
  then a nearest-name error. Any identifier discovery returns for a grain
  therefore works verbatim in every clause of a query on that grain.
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
from typing import Any, Iterable, Literal, Mapping, Optional, Sequence, Union, cast

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import Select, SQLColumnExpression, and_, exists, not_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import ColumnElement
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.mcp_span_analytics import grains, registry
from phoenix.server.mcp_span_analytics.grains import Grain
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


def resolve_grain(identifier: Optional[str]) -> Grain:
    """Resolve the grain a request names, defaulting to spans.

    A wrong grain is a wrong question, not a wrong spelling, so the
    rejection says what each grain's rows *are* rather than only listing
    names.
    """
    if identifier is None:
        return grains.SPANS_GRAIN
    grain = grains.GRAINS.get(identifier)
    if grain is not None:
        return grain
    raise QueryError(
        code="unknown_grain",
        path="from",
        message=(
            f"Unknown grain {identifier!r}. Available: "
            + "; ".join(
                f"{g.id} ({g.label.lower()}: {g.description})" for g in grains.GRAINS.values()
            )
        ),
        suggestions=[
            *get_close_matches(identifier, grains.GRAINS.keys(), n=2),
            *grains.GRAINS.keys(),
        ],
    )


class RowQuery(BaseModel):
    """Validated request for a row retrieval."""

    model_config = ConfigDict(extra="forbid")

    project: str
    grain: str = grains.SPANS
    time_range: Optional[TimeRange] = None
    fields: Optional[list[str]] = None
    filter: Optional[str] = None
    order: Optional[Union[list[RowOrderField], SampleOrder]] = None
    limit: int = ROW_LIMIT_DEFAULT
    validate_only: bool = False

    @model_validator(mode="after")
    def _validate(self) -> "RowQuery":
        resolve_grain(self.grain)
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
    grain: str = grains.SPANS
    time_range: TimeRange
    filter: Optional[str] = None
    calculations: list[Calculation]
    breakdowns: list[Union[str, TimeBucket]] = Field(default_factory=list)
    order: Optional[list[AggregateOrderEntry]] = None
    limit: int = AGGREGATE_LIMIT_DEFAULT
    validate_only: bool = False

    @model_validator(mode="after")
    def _validate(self) -> "AggregateQuery":
        resolve_grain(self.grain)
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


def _resolve_annotation_enrichment(identifier: str, grain: Grain) -> registry.AuthoredField:
    """Resolve one annotation enrichment identifier on the spans grain.

    The reference has parsed; what remains is whether its attribute and
    annotator kind are ones the registry defines. Both rejections are
    field-anchored and name the legal values, because an agent that guessed
    ``.value`` or ``"human"`` is one correction away from a working query.
    """
    reference = registry.parse_annotation_field(identifier)
    assert reference is not None
    if not grain.admits_annotation_enrichment:
        raise QueryError(
            code="field_not_on_grain",
            message=(
                f"{identifier!r} is a spans-grain enrichment: it reduces a span's "
                f"annotations to one value. On the {grain.id} grain the annotation "
                "is already the row, so read its columns directly — 'score', "
                "'label', 'name', 'annotator_kind'."
            ),
            suggestions=["score", "label", "annotator_kind"],
        )
    if reference.attribute not in registry.ANNOTATION_ATTRIBUTES:
        readable = sorted(registry.ANNOTATION_ATTRIBUTES)
        raise QueryError(
            code="unknown_annotation_attribute",
            message=(
                f"Annotations have no {reference.attribute!r} attribute on this "
                f"surface. Readable attributes: {', '.join(readable)} — e.g. "
                f'annotations["{reference.name}"].score.'
            ),
            suggestions=[f'annotations["{reference.name}"].{attribute}' for attribute in readable],
        )
    if (
        reference.annotator_kind is not None
        and reference.annotator_kind not in registry.ANNOTATOR_KINDS
    ):
        raise QueryError(
            code="unknown_annotator_kind",
            message=(
                f"{reference.annotator_kind!r} is not an annotator kind. Phoenix "
                f"records exactly {', '.join(registry.ANNOTATOR_KINDS)} (case "
                "sensitive); omit the second subscript to reduce over every "
                "annotator."
            ),
            suggestions=[
                f'annotations["{reference.name}", "{kind}"].{reference.attribute}'
                for kind in registry.ANNOTATOR_KINDS
            ],
        )
    return registry.annotation_enrichment_field(reference)


def resolve_field(identifier: str, grain: Grain = grains.SPANS_GRAIN) -> registry.ResolvedField:
    """Resolve one identifier against a grain: the grain's own fields, then
    — on the spans grain only — annotation enrichment and attribute paths,
    then a nearest-name error."""
    if authored := grain.fields_by_id.get(identifier):
        return authored
    if registry.parse_annotation_field(identifier) is not None:
        return _resolve_annotation_enrichment(identifier, grain)
    if not grain.admits_observed_paths:
        # A closed field set: no attribute blob to fall through to, so an
        # unknown identifier is an error here rather than a discovered path.
        # Fields of the other grain are the likeliest mistake, so they are
        # named as such instead of being reported as nonexistent.
        elsewhere = [
            other.id
            for other in grains.GRAINS.values()
            if other.id != grain.id and identifier in other.fields_by_id
        ]
        if elsewhere:
            raise QueryError(
                code="field_not_on_grain",
                message=(
                    f"{identifier!r} is a field of the {', '.join(elsewhere)} grain, not "
                    f"of {grain.id}. Query it with from='{elsewhere[0]}', or pick one of "
                    f"the {grain.id} grain's own fields: "
                    f"{', '.join(sorted(grain.fields_by_id))}."
                ),
                suggestions=sorted(grain.fields_by_id),
            )
        close = get_close_matches(identifier, grain.fields_by_id.keys(), n=3)
        raise QueryError(
            code="unknown_field",
            message=(
                f"Field {identifier!r} does not exist on the {grain.id} grain, whose "
                f"fields are: {', '.join(sorted(grain.fields_by_id))}."
                + (f" Did you mean: {', '.join(close)}?" if close else "")
            ),
            suggestions=close or sorted(grain.fields_by_id),
        )
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
        # Annotation shaped but not parseable as an enrichment reference:
        # the supported spellings are worth showing, since the difference is
        # usually one subscript.
        raise QueryError(
            code="invalid_annotation_field",
            message=(
                f"{identifier!r} is not a readable annotation field. Supported "
                'spellings: annotations["<name>"].score (mean over every '
                'annotator), annotations["<name>", "HUMAN"].score (one annotator '
                "kind), plus .label and .count. Annotation *filters* use the "
                "predicate form instead, e.g. \"evals['correctness'].score < 0.5\"."
            ),
            suggestions=['annotations["correctness"].score', 'annotations["correctness"].count'],
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


@dataclass(frozen=True)
class ColumnFilter:
    """A validated filter compiled to one boolean column expression.

    The annotations grain's columns are typed columns of a relation, so its
    filter compiles directly instead of routing through the span filter
    DSL, whose names resolve to span columns and attribute paths that do
    not exist here.
    """

    clause: ColumnElement[bool]

    @property
    def uses_annotations(self) -> bool:
        # Annotation predicates are a spans-grain construct: on this grain
        # the annotation is the row, so there is no any-annotator existence
        # semantics to disclose.
        return False

    def __call__(self, stmt: Select[Any]) -> Select[Any]:
        return stmt.where(self.clause)


FilterPlan = Union[CompiledFilter, ColumnFilter]

_COMPARE_METHODS: Mapping[type, str] = {
    ast.Lt: "__lt__",
    ast.LtE: "__le__",
    ast.Gt: "__gt__",
    ast.GtE: "__ge__",
    ast.Eq: "__eq__",
    ast.NotEq: "__ne__",
}


def _invalid_filter(message: str, suggestions: Sequence[str] = ()) -> QueryError:
    return QueryError(
        code="invalid_filter", path="filter", message=message, suggestions=list(suggestions)
    )


def _grain_filter_field(
    node: ast.expr, grain: Grain, dialect: SupportedSQLDialect
) -> Optional[tuple[registry.AuthoredField, SQLColumnExpression[Any]]]:
    """The field one operand names, or None when the operand is not a field."""
    if not isinstance(node, ast.Name):
        return None
    resolved = resolve_field(node.id, grain)
    assert isinstance(resolved, registry.AuthoredField)
    if not resolved.filterable:
        raise QueryError(
            code="temporal_filter" if resolved.type == "datetime" else "field_not_filterable",
            path="filter",
            message=(
                f"{resolved.id} is not filterable on the {grain.id} grain. "
                + (
                    "Temporal scope has exactly one home, the time_range parameter."
                    if resolved.type == "datetime"
                    else "Select or aggregate it instead."
                )
            ),
            suggestions=["time_range"] if resolved.type == "datetime" else [],
        )
    return resolved, resolved.expr(dialect)


def _grain_literal(node: ast.expr, field: registry.AuthoredField) -> Any:
    """One comparison operand's literal value, type-checked against the field.

    A type mismatch is caught here rather than at the database, where
    PostgreSQL aborts the statement and SQLite compares across types by its
    own storage-class rules — two different wrong answers to one mistake.
    """
    if not isinstance(node, ast.Constant) or isinstance(node.value, bool):
        raise _invalid_filter(
            f"Comparisons on the {field.id} field take a literal value, not {ast.unparse(node)!r}."
        )
    value = node.value
    numeric = field.type in ("float", "integer")
    if numeric and not isinstance(value, (int, float)):
        raise _invalid_filter(f"{field.id} is {field.type}; compare it to a number.")
    if not numeric and not isinstance(value, str):
        raise _invalid_filter(f"{field.id} is a string; compare it to a quoted string.")
    return value


def _grain_comparison(
    node: ast.Compare, grain: Grain, dialect: SupportedSQLDialect
) -> ColumnElement[bool]:
    if len(node.ops) != 1:
        raise _invalid_filter(
            "Chained comparisons (a < b < c) are not supported; write them as two "
            "conditions joined by 'and'."
        )
    operator_node, left, right = node.ops[0], node.left, node.comparators[0]
    left_field = _grain_filter_field(left, grain, dialect)
    right_field = _grain_filter_field(right, grain, dialect)

    if isinstance(operator_node, (ast.Is, ast.IsNot)):
        if left_field is None or not (isinstance(right, ast.Constant) and right.value is None):
            raise _invalid_filter("'is' comparisons are supported only as 'field is (not) None'.")
        column = left_field[1]
        return column.isnot(None) if isinstance(operator_node, ast.IsNot) else column.is_(None)

    if isinstance(operator_node, (ast.In, ast.NotIn)):
        # Two readings, both borrowed from the span filter grammar so one
        # vocabulary carries across grains: a substring test when the left
        # side is a string literal, membership when the right side is a list.
        if left_field is None and right_field is not None and isinstance(left, ast.Constant):
            field, column = right_field
            if field.type != "string":
                raise _invalid_filter(f"Substring tests apply to string fields, not {field.id}.")
            clause = column.contains(_grain_literal(left, field))
            return ~clause if isinstance(operator_node, ast.NotIn) else clause
        if left_field is not None and isinstance(right, (ast.List, ast.Tuple)):
            field, column = left_field
            values = [_grain_literal(element, field) for element in right.elts]
            clause = column.in_(values)
            return ~clause if isinstance(operator_node, ast.NotIn) else clause
        raise _invalid_filter(
            "'in' is supported as a substring test (\"'timeout' in explanation\") or "
            "membership in a literal list (\"annotator_kind in ['HUMAN', 'LLM']\")."
        )

    method = _COMPARE_METHODS.get(type(operator_node))
    if method is None:
        raise _invalid_filter(f"Operator {type(operator_node).__name__} is not supported.")
    if left_field is not None and right_field is None:
        field, column = left_field
        value: Any = _grain_literal(right, field)
    elif right_field is not None and left_field is None:
        field, column = right_field
        value = _grain_literal(left, field)
        method = {
            "__lt__": "__gt__",
            "__le__": "__ge__",
            "__gt__": "__lt__",
            "__ge__": "__le__",
        }.get(method, method)
    else:
        raise _invalid_filter(
            "Each comparison relates one field to one literal value; field-to-field "
            "and literal-to-literal comparisons are not supported."
        )
    return cast("ColumnElement[bool]", getattr(column, method)(value))


def _grain_filter_clause(
    node: ast.expr, grain: Grain, dialect: SupportedSQLDialect
) -> ColumnElement[bool]:
    if isinstance(node, ast.BoolOp):
        clauses = [_grain_filter_clause(value, grain, dialect) for value in node.values]
        return and_(*clauses) if isinstance(node.op, ast.And) else or_(*clauses)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return not_(_grain_filter_clause(node.operand, grain, dialect))
    if isinstance(node, ast.Compare):
        return _grain_comparison(node, grain, dialect)
    raise _invalid_filter(
        f"{ast.unparse(node)!r} is not a supported filter expression: write comparisons "
        "of a field to a literal, combined with and/or/not."
    )


def grain_filter(
    condition: Optional[str], grain: Grain, dialect: SupportedSQLDialect
) -> Optional[ColumnFilter]:
    """Validate and compile a filter over a closed-field-set grain.

    Every name resolves to one of the grain's declared fields, every
    comparison relates a field to a type-checked literal, and anything else
    is refused with the supported forms — the same admission discipline the
    span filter grammar applies, over a different namespace.
    """
    if not condition:
        return None
    try:
        root = ast.parse(condition, mode="eval")
    except SyntaxError as error:
        raise _invalid_filter(f"Invalid filter expression: {error.msg}.")
    return ColumnFilter(clause=_grain_filter_clause(root.body, grain, dialect))


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


def filter_for_grain(
    condition: Optional[str], grain: Grain, dialect: SupportedSQLDialect
) -> Optional[FilterPlan]:
    """Compile a filter in the grain's own namespace.

    The spans grain routes through the span filter DSL, which resolves span
    columns, attribute paths, and annotation existence predicates; every
    other grain compiles against its declared columns.
    """
    if grain.admits_observed_paths:
        return validated_filter(condition)
    return grain_filter(condition, grain, dialect)


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
    grain: Grain = grains.SPANS_GRAIN,
) -> Select[Any]:
    """The single statement base, delegated to the grain's own scope: its
    rows bound to one project and restricted to the time window.
    Deliberately carries no ordering — aggregates must not inherit row
    ordering, and PostgreSQL rejects ordering by ungrouped columns.
    """
    return grain.scoped(
        columns,
        project_rowid,
        time_range.start if time_range is not None else None,
        time_range.end if time_range is not None else None,
    )


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
    grain: Grain = grains.SPANS_GRAIN
    _project_rowid: int = dataclass_field(default=0, repr=False)
    _selected: list[registry.ResolvedField] = dataclass_field(default_factory=list, repr=False)
    _filter: Optional[FilterPlan] = dataclass_field(default=None, repr=False)
    uses_annotation_filter: bool = False
    _dialect: SupportedSQLDialect = dataclass_field(default=SupportedSQLDialect.SQLITE, repr=False)

    @property
    def reductions(self) -> list[registry.AuthoredField]:
        """Selected fields that collapsed a to-many relationship, for
        disclosure: a reduced value means nothing without its rule."""
        return [
            f
            for f in self._selected
            if isinstance(f, registry.AuthoredField) and f.reduction is not None
        ]

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
            self.grain,
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
    grain = resolve_grain(query.grain)
    if query.time_range is not None:
        time_range, defaulted = query.time_range, False
    else:
        time_range = TimeRange(start=now - timedelta(hours=ROW_WINDOW_DEFAULT_HOURS), end=now)
        defaulted = True

    field_ids = list(query.fields) if query.fields else list(grain.default_row_fields)
    # Row identity is implicit: the grain's identity field is always
    # included whether or not it was selected, so no returned row is
    # unrecoverable.
    if grain.identity_field not in field_ids:
        field_ids.insert(0, grain.identity_field)
    selected: list[registry.ResolvedField] = []
    seen: set[str] = set()
    for index, field_id in enumerate(field_ids):
        try:
            resolved = resolve_field(field_id, grain)
        except QueryError as error:
            error.path = error.path or f"fields[{index}]"
            raise
        if resolved.id not in seen:
            seen.add(resolved.id)
            selected.append(resolved)

    filter_ = filter_for_grain(query.filter, grain, dialect)
    applied_limit = max(1, min(query.limit, ROW_LIMIT_MAX))
    columns = [_column_spec(f) for f in selected]

    if isinstance(query.order, SampleOrder):
        if not grain.supports_sampling:
            raise QueryError(
                code="sample_not_supported",
                path="order.sample",
                message=(
                    f"Seeded sampling is not available on the {grain.id} grain: it "
                    "probes a dense integer row id, and this grain's rows are unioned "
                    "across tables that number themselves independently. Order "
                    "explicitly instead — results stay deterministic."
                ),
                suggestions=[f'[{{"field": "{grain.time_field}", "direction": "desc"}}]'],
            )
        ids_stmt = scoped_base([models.Span.id], project_rowid, time_range, grain)
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
            grain=grain,
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
        order_exprs.append(grain.time_column.desc())
    # Deterministic tie-break: the grain's unique key ends every ordering.
    order_exprs.append(grain.tiebreak_column.asc())

    stmt = scoped_base(
        [f.expr(dialect).label(f.id) for f in selected], project_rowid, time_range, grain
    )
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
        grain=grain,
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


@dataclass(frozen=True)
class CompositionProbe:
    """One hidden per-group count of the annotations behind a reduced value.

    A blended average moves when the annotator mix moves, with no annotator
    having changed its scoring. The probe makes the mix a returned number
    rather than an inference the caller has to think to make: for every
    kind-unrestricted reduction the query asked for, the response reports
    how many annotations of each kind each group actually contained.
    """

    annotation_name: str
    annotator_kind: str
    expr: ColumnElement[Any]


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
    grain: Grain = grains.SPANS_GRAIN
    #: Fields whose values were reduced from a to-many relationship, for
    #: disclosure of the rule that produced them.
    reductions: list[registry.AuthoredField] = dataclass_field(default_factory=list)
    #: Hidden per-group annotator counts appended after the visible
    #: calculations; stripped from the result rows into their own block.
    composition: list[CompositionProbe] = dataclass_field(default_factory=list)


def _composition_probes(
    reductions: Iterable[registry.AuthoredField],
    dialect: SupportedSQLDialect,
) -> list[CompositionProbe]:
    """Per-annotator-kind counts behind every kind-unrestricted reduction.

    Only unrestricted reductions get probes. A caller who already asked for
    one annotator kind has excluded the mix from the number, so there is no
    composition artifact left to disclose — and no reason to pay for three
    extra correlated subqueries.
    """
    probes: list[CompositionProbe] = []
    seen: set[str] = set()
    for field in reductions:
        reference = field.annotation
        if reference is None or reference.annotator_kind is not None:
            continue
        if reference.name in seen:
            continue
        seen.add(reference.name)
        for kind in registry.ANNOTATOR_KINDS:
            counter = registry.annotation_enrichment_field(
                registry.AnnotationRef(name=reference.name, annotator_kind=kind, attribute="count")
            )
            probes.append(
                CompositionProbe(
                    annotation_name=reference.name,
                    annotator_kind=kind,
                    expr=registry.aggregation_expr("sum", counter.expr(dialect), dialect),
                )
            )
    return probes


def compile_aggregate(
    query: AggregateQuery,
    project_rowid: int,
    dialect: SupportedSQLDialect,
) -> AggregatePlan:
    """Compile an aggregation into its three statements."""
    grain = resolve_grain(query.grain)
    observed_fields: dict[str, registry.ObservedField] = {}
    reductions: dict[str, registry.AuthoredField] = {}
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
                resolved = resolve_field(calc.field, grain)
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
            elif resolved.reduction is not None:
                reductions[resolved.id] = resolved
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
                    expr=registry.time_bucket_expr(dialect, grain.time_column),
                    is_time_bucket=True,
                    column=ColumnSpec(id=registry.TIME_BUCKET_ID, type="datetime"),
                )
            )
            continue
        try:
            resolved = resolve_field(breakdown, grain)
        except QueryError as error:
            error.path = error.path or f"breakdowns[{index}]"
            raise
        if not resolved.groupable:
            groupable = sorted(f.id for f in grain.fields if f.groupable)
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
        elif resolved.reduction is not None:
            reductions[resolved.id] = resolved
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

    filter_ = filter_for_grain(query.filter, grain, dialect)
    applied_limit = max(1, min(query.limit, AGGREGATE_LIMIT_MAX))
    composition = _composition_probes(reductions.values(), dialect)

    select_columns: list[Any] = [b.expr.label(b.id) for b in breakdowns]
    select_columns.extend(c.expr.label(c.name) for c in calculations)
    select_columns.extend(
        probe.expr.label(f"_composition_{index}") for index, probe in enumerate(composition)
    )
    stmt = scoped_base(select_columns, project_rowid, query.time_range, grain)
    if filter_ is not None:
        stmt = filter_(stmt)
    grouped = stmt.group_by(*(b.expr for b in breakdowns)) if breakdowns else stmt
    final_stmt = grouped.order_by(*order_exprs).limit(applied_limit) if breakdowns else grouped

    groups_total_stmt: Optional[Select[Any]] = None
    if breakdowns:
        from sqlalchemy import func as sqla_func

        groups_total_stmt = select(sqla_func.count()).select_from(grouped.subquery())

    overall_stmt = scoped_base(
        [c.expr.label(c.name) for c in calculations]
        + [probe.expr.label(f"_composition_{index}") for index, probe in enumerate(composition)],
        project_rowid,
        query.time_range,
        grain,
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
        grain=grain,
        reductions=list(reductions.values()),
        composition=composition,
    )
