"""Field registry for the span analytics MCP tools.

The registry is the semantic layer of the analytics surface: the single
authority on which fields exist, what they mean, and what each one may be
used for (select, filter, group, aggregate). Two field classes share one
namespace:

- **Authored fields** are hand-defined with full type, unit, and capability
  metadata. The registry authors only semantics that hold across all
  Phoenix projects: physical span columns (``span_id``, ``latency_ms``, ...),
  documented OpenInference conventions (``llm.model_name``,
  ``llm.token_count.total``, ``input.value``, ``output.value``), and the
  computed ``is_error`` indicator. Field ids are the same raw paths the span
  filter grammar already understands, so a field id read from discovery
  output works verbatim in ``fields``, ``filter``, and ``breakdowns`` — the
  caller copies identifiers instead of constructing them.
- **Observed attribute fields** are constructed on demand from any canonical
  attribute path (``metadata.release``, ``metadata["build.version"]``,
  ``custom_flag``). Project-specific context lives in the free-form
  attribute blob and varies per deployment, so it is discovered from the
  data rather than assumed. Observed fields are selectable, filterable, and
  groupable, but never aggregatable: cast and mixed-type semantics for
  arbitrary JSON paths are undefined, so typed aggregation stays on
  authored fields.

Expressions are built per SQL dialect because JSON access and percentile
aggregation genuinely differ between PostgreSQL and SQLite; every factory in
this module must compile — and agree in behavior — on both.
"""

from __future__ import annotations

import ast
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import get_close_matches
from types import MappingProxyType
from typing import Any, Optional, Union, cast

# Attribute names defined by the OpenInference semantic conventions come
# from the convention package itself: the registry's ids stay in lockstep
# with the conventions, and a renamed constant fails at import time instead
# of silently drifting.
from openinference.semconv.trace import MessageAttributes, SpanAttributes
from sqlalchemy import SQLColumnExpression, case, distinct, func, null
from sqlalchemy import select as sqlalchemy_select
from sqlalchemy.sql.expression import ColumnElement
from sqlalchemy.sql.functions import percentile_cont

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect

FieldTypeName = str  # "string" | "integer" | "float" | "datetime"

_ExprFactory = Callable[[SupportedSQLDialect], SQLColumnExpression[Any]]


@dataclass(frozen=True)
class AuthoredField:
    """A hand-defined field with declared type, unit, and capabilities.

    ``source`` records the field's provenance so a caller can tell which
    identifiers are portable across projects and which are not:
    ``"column"`` for physical span columns, ``"computed"`` for derived
    indicators, and ``"openinference_convention"`` for attributes whose
    names and meanings are defined by the OpenInference semantic
    conventions. (Discovered paths report ``"observed_attribute"`` and are
    project-specific by nature.)
    """

    id: str
    label: str
    type: FieldTypeName
    description: str
    factory: _ExprFactory
    unit: Optional[str] = None
    filterable: bool = True
    groupable: bool = False
    aggregatable: bool = False
    source: str = "column"

    def expr(self, dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
        return self.factory(dialect)


@dataclass(frozen=True)
class ObservedField:
    """A field resolved dynamically from a canonical attribute path.

    The value is extracted as the raw JSON value (deserialized by the JSON
    result processor on both dialects), so strings and numbers come back
    natively typed. Observed fields carry no declared type and are never
    aggregatable.
    """

    id: str
    keys: tuple[str, ...]

    #: Observed fields support everything except aggregation.
    filterable: bool = True
    groupable: bool = True
    aggregatable: bool = False

    def expr(self, dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
        return cast(
            SQLColumnExpression[Any],
            models.Span.attributes[list(self.keys)],
        )


ResolvedField = Union[AuthoredField, ObservedField]


def _plain(column: SQLColumnExpression[Any]) -> _ExprFactory:
    def factory(dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
        return column

    return factory


def _string_attribute(keys: Sequence[Union[str, int]]) -> _ExprFactory:
    """Text extraction of one attribute path.

    Integer segments index into JSON lists and compile on both dialects
    (``#>> '{llm,input_messages,0,...}'`` on PostgreSQL, ``$[0]`` path
    syntax on SQLite). ``as_string`` extracts text on both dialects, so
    string values come back unquoted and identical.
    """

    def factory(dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
        return cast(
            SQLColumnExpression[Any],
            models.Span.attributes[list(keys)].as_string(),
        )

    return factory


def _input_chars(dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
    """Character length of the span's input payload.

    A derived scalar declared in the registry because callers cannot
    supply expressions; ``LENGTH`` over the text extraction is NULL when
    no input was recorded, so absence stays countable rather than reading
    as zero.
    """
    input_value = models.Span.attributes[list(SpanAttributes.INPUT_VALUE.split("."))].as_string()
    return cast(SQLColumnExpression[Any], func.length(input_value))


def _guarded_array_length(keys: Sequence[str]) -> _ExprFactory:
    """Array length of one attribute path, NULL unless it is an array.

    The guarded-cast doctrine extended to arrays: an unguarded array
    length diverges between backends when the value is absent or not an
    array, so the length is taken only when the backend's JSON type
    introspection says ``array`` — anything else reads NULL on both
    engines, excluded from aggregates and countable as missing.
    """

    def factory(dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
        json_value = models.Span.attributes[list(keys)]
        if dialect is SupportedSQLDialect.POSTGRESQL:
            guard = func.jsonb_typeof(json_value) == "array"
            length = func.jsonb_array_length(json_value)
        else:
            guard = func.json_type(json_value) == "array"
            length = func.json_array_length(json_value)
        return case((guard, length), else_=null())

    return factory


def _cost_total(dialect: SupportedSQLDialect) -> SQLColumnExpression[Any]:
    """The span's total cost, as a declared sum reduction.

    Cost rows live in their own table whose span linkage is not
    unique-constrained: a span may carry zero or several cost rows, so a
    join would multiply span rows and silently corrupt every aggregate
    around it. The field is therefore defined as a correlated scalar
    subquery with an explicit reduction — ``sum`` over the span's cost
    rows — which is structurally incapable of row multiplication and
    stays correct under multiplicity (the sum of a span's cost rows *is*
    the span's cost). A span with no cost rows reads as NULL, excluded
    from aggregates by standard SQL semantics and countable as missing
    via ``count(cost.total)`` versus ``count()``.
    """
    return (
        sqlalchemy_select(func.sum(models.SpanCost.total_cost))
        .where(models.SpanCost.span_rowid == models.Span.id)
        .correlate(models.Span)
        .scalar_subquery()
    )


def _message_field(index: int, message_attribute: str) -> tuple[str, _ExprFactory]:
    """Id and expression of one input-message subfield, from the convention
    constants: ``llm.input_messages[<index>].message.<role|content>``.

    The id uses list-index subscript spelling; these fields are authored
    (resolved by registry lookup), so the spelling is presentation, not
    something the attribute-path parser needs to accept.
    """
    field_id = f"{SpanAttributes.LLM_INPUT_MESSAGES}[{index}].{message_attribute}"
    keys: tuple[Union[str, int], ...] = (
        *SpanAttributes.LLM_INPUT_MESSAGES.split("."),
        index,
        *message_attribute.split("."),
    )
    return field_id, _string_attribute(keys)


def _guarded_numeric(keys: Sequence[str]) -> _ExprFactory:
    """A numeric JSON extraction that maps wrongly-typed values to NULL.

    A plain CAST on a JSON value makes the two backends disagree about
    failure: PostgreSQL aborts the entire query on one non-numeric value
    (``invalid input syntax``), while SQLite silently coerces garbage to
    ``0.0`` and returns a confident wrong number. Guarding the cast with the
    backend's JSON type introspection turns a wrongly-typed value into NULL
    on both engines: excluded from ``sum``/``avg`` by standard SQL
    semantics, countable as missing, and identical across backends.

    The cast itself is float-typed even for integer fields because
    ``jsonb_typeof`` cannot distinguish integers from reals — an
    integer-only guard is not expressible symmetrically. Float arithmetic is
    exact for values of token-count magnitude, and integral inputs produce
    integral results.
    """

    def factory(dialect: SupportedSQLDialect) -> ColumnElement[Any]:
        json_value = models.Span.attributes[list(keys)]
        cast_value = json_value.as_float()
        guard: ColumnElement[bool]
        if dialect is SupportedSQLDialect.POSTGRESQL:
            guard = func.jsonb_typeof(json_value) == "number"
        else:
            guard = func.json_type(json_value).in_(("integer", "real"))
        return case((guard, cast_value), else_=null())

    return factory


def _is_error(dialect: SupportedSQLDialect) -> ColumnElement[Any]:
    return case((models.Span.status_code == "ERROR", 1), else_=0)


AUTHORED_FIELDS: tuple[AuthoredField, ...] = (
    AuthoredField(
        id="span_id",
        label="Span ID",
        type="string",
        description=(
            "OpenTelemetry span id (hex). The stable row identity of every result row; "
            "pass it to getSpan for the full record."
        ),
        factory=_plain(models.Span.span_id),
    ),
    AuthoredField(
        id="trace_id",
        label="Trace ID",
        type="string",
        description="OpenTelemetry trace id (hex); pass it to getTrace for the span tree.",
        factory=_plain(models.Trace.trace_id),
    ),
    AuthoredField(
        id="name",
        label="Span name",
        type="string",
        description="Operation name of the span.",
        factory=_plain(models.Span.name),
        groupable=True,
    ),
    AuthoredField(
        id="span_kind",
        label="Span kind",
        type="string",
        description="OpenInference span kind: 'LLM', 'CHAIN', 'RETRIEVER', 'TOOL', 'AGENT', ...",
        factory=_plain(models.Span.span_kind),
        groupable=True,
    ),
    AuthoredField(
        id="status_code",
        label="Status",
        type="string",
        description=("'OK', 'ERROR', or 'UNSET'. Filter failures with \"status_code == 'ERROR'\"."),
        factory=_plain(models.Span.status_code),
        groupable=True,
    ),
    AuthoredField(
        id="start_time",
        label="Start time",
        type="datetime",
        description=(
            "Span start, UTC. Not filterable: temporal scope has exactly one home, the "
            "time_range parameter."
        ),
        factory=_plain(models.Span.start_time),
        filterable=False,
    ),
    AuthoredField(
        id="latency_ms",
        label="Latency",
        type="float",
        unit="ms",
        description="Span duration in milliseconds.",
        factory=_plain(models.Span.latency_ms),
        aggregatable=True,
    ),
    AuthoredField(
        id="is_error",
        label="Error indicator",
        type="integer",
        description=(
            "1 when status_code is 'ERROR', else 0. Aggregate-only: avg(is_error) is the "
            "error rate, sum(is_error) the error count. To filter failures use "
            "\"status_code == 'ERROR'\" instead."
        ),
        factory=_is_error,
        filterable=False,
        aggregatable=True,
        source="computed",
    ),
    AuthoredField(
        id=SpanAttributes.LLM_MODEL_NAME,
        label="Model",
        type="string",
        description="Model name recorded on LLM spans, e.g. 'gpt-4'.",
        factory=_string_attribute(tuple(SpanAttributes.LLM_MODEL_NAME.split("."))),
        groupable=True,
        source="openinference_convention",
    ),
    AuthoredField(
        id=SpanAttributes.LLM_TOKEN_COUNT_TOTAL,
        label="Total tokens",
        type="integer",
        unit="tokens",
        description=(
            "Total token count of the span. Wrongly-typed recorded values (e.g. a string) "
            "read as NULL and are excluded from aggregates; count them via "
            "count(llm.token_count.total) versus count()."
        ),
        factory=_guarded_numeric(tuple(SpanAttributes.LLM_TOKEN_COUNT_TOTAL.split("."))),
        aggregatable=True,
        source="openinference_convention",
    ),
    AuthoredField(
        id=SpanAttributes.INPUT_VALUE,
        label="Input",
        type="string",
        description="Span input payload. Often large; row results clip it to a preview.",
        factory=_string_attribute(tuple(SpanAttributes.INPUT_VALUE.split("."))),
        source="openinference_convention",
    ),
    AuthoredField(
        id=SpanAttributes.OUTPUT_VALUE,
        label="Output",
        type="string",
        description="Span output payload. Often large; row results clip it to a preview.",
        factory=_string_attribute(tuple(SpanAttributes.OUTPUT_VALUE.split("."))),
        source="openinference_convention",
    ),
    AuthoredField(
        id="cost.total",
        label="Cost",
        type="float",
        unit="USD",
        description=(
            "Total recorded cost of the span in USD, summed over its cost records. "
            "NULL when no cost was recorded — count spans with cost via "
            "count(cost.total) versus count(). Select-and-aggregate only: cost is "
            "not a filter predicate on this surface."
        ),
        factory=_cost_total,
        filterable=False,
        aggregatable=True,
        source="computed",
    ),
    AuthoredField(
        id=SpanAttributes.LLM_TOKEN_COUNT_PROMPT,
        label="Prompt tokens",
        type="integer",
        unit="tokens",
        description=(
            "Prompt token count of the span. Wrongly-typed recorded values read as "
            "NULL and are excluded from aggregates."
        ),
        factory=_guarded_numeric(tuple(SpanAttributes.LLM_TOKEN_COUNT_PROMPT.split("."))),
        aggregatable=True,
        source="openinference_convention",
    ),
    AuthoredField(
        id=SpanAttributes.LLM_TOKEN_COUNT_COMPLETION,
        label="Completion tokens",
        type="integer",
        unit="tokens",
        description=(
            "Completion token count of the span. Wrongly-typed recorded values read "
            "as NULL and are excluded from aggregates."
        ),
        factory=_guarded_numeric(tuple(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION.split("."))),
        aggregatable=True,
        source="openinference_convention",
    ),
    AuthoredField(
        id="input.chars",
        label="Input length",
        type="integer",
        unit="chars",
        description=(
            "Character length of the span's input payload; NULL when no input was "
            "recorded. Distinct from input.turns: this measures text volume, not "
            "conversation depth. Select-and-aggregate only."
        ),
        factory=_input_chars,
        filterable=False,
        aggregatable=True,
        source="computed",
    ),
    AuthoredField(
        id="input.turns",
        label="Input messages",
        type="integer",
        unit="messages",
        description=(
            "Number of LLM input messages (the conversation depth carried into the "
            "call); NULL when the span records no message list. Distinct from "
            "input.chars: depth in messages, not character volume. Groupable — "
            "conversation depth is a bounded small-integer dimension, so grouping "
            "by it (e.g. avg cost by depth) is safe — but not filterable."
        ),
        factory=_guarded_array_length(tuple(SpanAttributes.LLM_INPUT_MESSAGES.split("."))),
        filterable=False,
        groupable=True,
        aggregatable=True,
        source="computed",
    ),
    # The first two input messages, per the OpenInference message
    # convention. Select-only: the filter grammar does not accept
    # list-index paths, so these carry no filter capability, and list
    # entries are neither groupable nor aggregatable.
    AuthoredField(
        id=_message_field(0, MessageAttributes.MESSAGE_ROLE)[0],
        label="First input message role",
        type="string",
        description="Role of the first LLM input message (e.g. 'system'); NULL when absent.",
        factory=_message_field(0, MessageAttributes.MESSAGE_ROLE)[1],
        filterable=False,
        source="openinference_convention",
    ),
    AuthoredField(
        id=_message_field(0, MessageAttributes.MESSAGE_CONTENT)[0],
        label="First input message content",
        type="string",
        description=(
            "Content of the first LLM input message; NULL when absent. Often large; "
            "row results clip it to a preview."
        ),
        factory=_message_field(0, MessageAttributes.MESSAGE_CONTENT)[1],
        filterable=False,
        source="openinference_convention",
    ),
    AuthoredField(
        id=_message_field(1, MessageAttributes.MESSAGE_ROLE)[0],
        label="Second input message role",
        type="string",
        description=(
            "Role of the second LLM input message (e.g. 'user'); NULL when the span "
            "has fewer than two input messages."
        ),
        factory=_message_field(1, MessageAttributes.MESSAGE_ROLE)[1],
        filterable=False,
        source="openinference_convention",
    ),
    AuthoredField(
        id=_message_field(1, MessageAttributes.MESSAGE_CONTENT)[0],
        label="Second input message content",
        type="string",
        description=(
            "Content of the second LLM input message; NULL when the span has fewer "
            "than two input messages. Often large; row results clip it to a preview."
        ),
        factory=_message_field(1, MessageAttributes.MESSAGE_CONTENT)[1],
        filterable=False,
        source="openinference_convention",
    ),
)

AUTHORED_BY_ID: Mapping[str, AuthoredField] = MappingProxyType({f.id: f for f in AUTHORED_FIELDS})

#: Names the span filter grammar reserves for real span columns that this
#: surface does not expose as fields. They must not fall through to the
#: attribute-path parser: ``cumulative_llm_token_count_total`` as a field
#: would silently read ``attributes["cumulative_llm_token_count_total"]``
#: (always NULL) instead of the column the filter grammar means.
RESERVED_UNEXPOSED: frozenset[str] = frozenset(
    {
        "context.span_id",
        "context.trace_id",
        "parent_id",
        "status_message",
        "end_time",
        "cumulative_llm_token_count_prompt",
        "cumulative_llm_token_count_completion",
        "cumulative_llm_token_count_total",
        "attributes",
        "events",
    }
)


# --------------------------------------------------------------------------
# Canonical attribute paths
# --------------------------------------------------------------------------

_IDENTIFIER_SEGMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

#: Similarity threshold above which a bare name is treated as a probable
#: misspelling of an authored field id rather than a real attribute name.
_BARE_NAME_CONFLICT_CUTOFF = 0.75


def bare_name_conflicts(name: str) -> bool:
    """Whether a bare top-level attribute name collides with the field
    namespace: it is (or closely resembles) an authored field id, or it is a
    reserved span-column name. Conflicting bare names are far more likely
    typos than real attributes, so they do not silently fall through to an
    attribute read; the subscript spelling (``attributes["name"]``) remains
    the unambiguous way to reference a genuinely so-named attribute.
    """
    if name in AUTHORED_BY_ID or name in RESERVED_UNEXPOSED:
        return True
    return bool(
        get_close_matches(name, AUTHORED_BY_ID.keys(), n=1, cutoff=_BARE_NAME_CONFLICT_CUTOFF)
    )


def canonical_attribute_spelling(keys: Sequence[str]) -> str:
    """The canonical query spelling of an attribute path.

    Plain identifier segments join with dots (``llm.model_name``); paths
    with awkward segments (a key containing a literal dot, say) use the
    subscript form the filter grammar accepts (``metadata["build.version"]``,
    ``attributes["a"]["b.c"]``); a single-segment name that collides with
    the field namespace is spelled in subscript form so it stays
    resolvable. Discovery output uses this spelling so that every returned
    identifier works verbatim in every clause.
    """
    if len(keys) == 1 and bare_name_conflicts(keys[0]):
        return f'attributes["{keys[0]}"]'
    if all(_IDENTIFIER_SEGMENT.match(key) for key in keys):
        return ".".join(keys)
    if keys[0] == "metadata":
        return "metadata" + "".join(f'["{key}"]' for key in keys[1:])
    return "attributes" + "".join(f'["{key}"]' for key in keys)


def parse_attribute_path(identifier: str) -> Optional[tuple[str, ...]]:
    """Parse a canonical attribute path into its key sequence.

    Accepts the same spellings the filter grammar does — bare names, dotted
    paths, and ``attributes[...]``/``metadata[...]`` subscripts — and
    returns ``None`` for anything else (calls, operators, subscripts of
    other names such as ``evals[...]``).
    """
    try:
        body = ast.parse(identifier.strip(), mode="eval").body
    except SyntaxError:
        return None
    if isinstance(body, ast.Name):
        return (body.id,)
    if isinstance(body, ast.Attribute):
        keys: list[str] = []
        node: ast.expr = body
        while isinstance(node, ast.Attribute):
            keys.append(node.attr)
            node = node.value
        if isinstance(node, ast.Name):
            keys.append(node.id)
            return tuple(reversed(keys))
        return None
    if isinstance(body, ast.Subscript):
        keys = []
        node = body
        while isinstance(node, ast.Subscript):
            slice_node = node.slice
            if isinstance(slice_node, ast.Constant) and isinstance(slice_node.value, str):
                keys.append(slice_node.value)
            elif isinstance(slice_node, ast.List):
                slice_keys: list[str] = []
                for elt in slice_node.elts:
                    if not (isinstance(elt, ast.Constant) and isinstance(elt.value, str)):
                        return None
                    slice_keys.append(elt.value)
                keys.extend(reversed(slice_keys))
            else:
                return None
            node = node.value
        if isinstance(node, ast.Name) and node.id == "attributes":
            return tuple(reversed(keys))
        if isinstance(node, ast.Name) and node.id == "metadata":
            return ("metadata", *reversed(keys))
        return None
    return None


# --------------------------------------------------------------------------
# Aggregations
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Aggregation:
    """One aggregation function and its calculation-level semantics.

    ``additive`` marks functions whose per-group values sum to the overall
    value (``count``, ``sum``); share-of-total is meaningful only for those.
    An average or percentile of a subgroup carries no share of the overall
    average, so shares are omitted for non-additive calculations.
    """

    fn: str
    additive: bool
    requires_field: bool
    accepts_field: bool = True
    description: str = ""


AGGREGATIONS: Mapping[str, Aggregation] = MappingProxyType(
    {
        "count": Aggregation(
            fn="count",
            additive=True,
            requires_field=False,
            description=(
                "Row count. With a field, counts rows where the field is non-NULL — "
                "the missingness probe for guarded numeric fields."
            ),
        ),
        "count_distinct": Aggregation(
            fn="count_distinct",
            additive=False,
            requires_field=True,
            description="Number of distinct non-NULL values of the field.",
        ),
        "sum": Aggregation(fn="sum", additive=True, requires_field=True),
        "avg": Aggregation(fn="avg", additive=False, requires_field=True),
        "min": Aggregation(fn="min", additive=False, requires_field=True),
        "max": Aggregation(fn="max", additive=False, requires_field=True),
        "p50": Aggregation(fn="p50", additive=False, requires_field=True),
        "p90": Aggregation(fn="p90", additive=False, requires_field=True),
        "p95": Aggregation(fn="p95", additive=False, requires_field=True),
        "p99": Aggregation(fn="p99", additive=False, requires_field=True),
    }
)

_PERCENTILE_FRACTIONS: Mapping[str, float] = MappingProxyType(
    {"p50": 0.5, "p90": 0.9, "p95": 0.95, "p99": 0.99}
)


def aggregation_expr(
    fn: str,
    field_expr: Optional[SQLColumnExpression[Any]],
    dialect: SupportedSQLDialect,
) -> ColumnElement[Any]:
    """Build the SQL expression for one calculation.

    Percentiles are dialect-branched: PostgreSQL has ``percentile_cont``
    (ordered-set aggregate, linear interpolation); SQLite gets the sqlean
    ``stats`` extension's ``median``/``percentile`` functions, which use the
    same linear interpolation — their agreement is covered by executing
    tests, not assumed.
    """
    if fn == "count":
        return func.count() if field_expr is None else func.count(field_expr)
    assert field_expr is not None
    if fn == "count_distinct":
        return func.count(distinct(field_expr))
    if fn == "sum":
        return func.sum(field_expr)
    if fn == "avg":
        return func.avg(field_expr)
    if fn == "min":
        return func.min(field_expr)
    if fn == "max":
        return func.max(field_expr)
    fraction = _PERCENTILE_FRACTIONS[fn]
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return percentile_cont(fraction).within_group(field_expr.asc())
    # sqlean names its percentile functions by percent: median(x) is the
    # 50th percentile; percentile(x, K) takes K in [0, 100].
    if fn == "p50":
        return func.median(field_expr)
    return func.percentile(field_expr, int(fraction * 100))


# --------------------------------------------------------------------------
# Time buckets
# --------------------------------------------------------------------------

#: Column id of the calculated hour-bucket breakdown.
TIME_BUCKET_ID = "time_bucket"


def time_bucket_expr(dialect: SupportedSQLDialect) -> ColumnElement[Any]:
    """Truncate ``start_time`` to the hour, per dialect.

    Timestamps are stored in UTC on both backends, so both renderings
    produce the same UTC hour boundary.
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        return func.date_trunc("hour", models.Span.start_time)
    return func.strftime("%Y-%m-%dT%H:00:00", models.Span.start_time)


def normalize_time_bucket_value(value: Any) -> Any:
    """Render a bucket key identically on both dialects.

    PostgreSQL's ``date_trunc`` returns a datetime; SQLite's ``strftime``
    returns the ISO string without an offset. Both become
    ``YYYY-MM-DDTHH:00:00+00:00``.
    """
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, str) and value:
        return f"{value}+00:00"
    return value
