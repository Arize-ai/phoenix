"""Hand-authored MCP tools for span analytics.

Five tools over one project-scoped span surface:

- ``describeSpans`` — the field catalog as data: authored fields merged with
  attribute paths observed in a recent sample, every entry in canonical
  query spelling so discovery output is copy-paste usable in every clause.
- ``aggregateSpans`` — grouped calculations (counts, sums, averages,
  percentiles, hourly buckets) with explicit completeness metadata.
- ``querySpanRows`` — ordered, bounded row retrieval with per-cell preview
  clipping and an always-present ``span_id`` row identity.
- ``getSpan`` — full-fidelity drill-down for one span, the recovery path
  every clipped preview points at.
- ``getTrace`` — the parent/child span tree of one trace.

Every tool returns a discriminated union: ``{status: "ok", ...}`` on
success or ``{status: "error", code, path, message, suggestions}`` on
semantic failure, so callers branch on data instead of parsing prose.
``ToolError`` is reserved for transport-level failures.

Field declarations use the ``param: T = Field(default=..., description=...)``
style; ``Annotated`` wrapping nests descriptions inside an extra ``anyOf``
level where JSON-schema consumers do not look.
"""

from __future__ import annotations

import json
import os
import random
import re
from collections import Counter
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence, Union
from urllib.parse import urlencode

from fastmcp.server.dependencies import get_http_request
from fastmcp.tools.base import Tool
from mcp.types import ToolAnnotations
from pydantic import Field, TypeAdapter, ValidationError
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import ENV_PHOENIX_ROOT_URL, get_env_root_url
from phoenix.db import models
from phoenix.server.mcp_span_analytics import compiler, registry
from phoenix.server.mcp_span_analytics.compiler import (
    AggregateOrderEntry,
    AggregateQuery,
    Calculation,
    QueryError,
    RowOrderField,
    RowQuery,
    SampleOrder,
    TimeBucket,
    TimeRange,
)
from phoenix.server.utils import prepend_root_path

if TYPE_CHECKING:
    from fastapi import FastAPI

    from phoenix.server.types import DbSessionFactory

#: REST router tag of the generated span tools. Carrying it makes these
#: tools gate and reveal together with the ``spans`` group, and share that
#: vocabulary in code mode's ``tags`` browser.
SPANS_GROUP_TAG = "spans"

#: A second tag marking the analytical query surface. Catalog search ranks
#: by vocabulary overlap, and "spans" alone ranks CRUD tools above these
#: for analytics-shaped queries (aggregate, group by, error rate); the tag
#: gives that vocabulary a first-class home.
ANALYTICS_TAG = "analytics"

#: Every tool here only reads span data — the same annotation profile the
#: generated GET tools receive: safe to retry, no side effects, and scoped
#: to the server's own database rather than the open world.
_READ_ONLY_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False
)

#: Size budget defaults, in characters (~4 characters per token of the
#: caller's context). Row surveys stay small because ``getSpan`` exists for
#: full recovery; ``getSpan`` itself gets a larger default because it *is*
#: the recovery path.
_DEFAULT_MAX_RESULT_CHARS = 50_000
_GET_SPAN_MAX_RESULT_CHARS = 100_000
_DEFAULT_MAX_CELL_CHARS = 400

#: Upper bound on spans scanned for observed-field discovery and
#: zero-result diagnosis. A bounded sample drawn evenly across the
#: project's span id range, never a full scan.
_DISCOVERY_SAMPLE_SIZE = 500

#: Declared sampling strategy of the discovery scan: up to N span ids
#: drawn uniformly across the project's id range (approximately
#: time-ordered, since ids are allocated in ingestion order).
_DISCOVERY_STRATEGY = f"id_spread_{_DISCOVERY_SAMPLE_SIZE}"

#: Fixed seed of the discovery draw: the same project state always yields
#: the same sample, so repeated discovery calls agree with each other.
_DISCOVERY_SAMPLE_SEED = 0

#: Cap on observed-field entries in one describeSpans response.
_DISCOVERY_MAX_OBSERVED_FIELDS = 100

#: Observed values are tracked for top-value reporting only up to this many
#: distinct values per path and this many characters per value.
_TOP_VALUES_LIMIT = 20
_TOP_VALUE_MAX_CHARS = 100

_FILTER_DESCRIPTION = (
    "Boolean expression selecting spans, written in Python syntax and compiled to SQL. "
    "Names you can reference: span fields `name`, `span_kind` ('LLM', 'CHAIN', "
    "'RETRIEVER', 'TOOL', 'AGENT', 'EMBEDDING', ...), `status_code` ('OK', 'ERROR', "
    "'UNSET'), `status_message`, `parent_id`, `span_id`, `trace_id`, `latency_ms`; and "
    "attribute paths such as `input.value`, `output.value`, `llm.model_name`, "
    "`llm.token_count.total`, `metadata['key']` — any field id or observed path from "
    "describeSpans works verbatim. Operators: comparisons (==, !=, <, <=, >, >=), "
    "`and`/`or`/`not`, `in`/`not in` (substring test on strings, membership on a list), "
    "`is None`/`is not None`; casts `str(...)`, `float(...)`, `int(...)`. Function "
    "calls other than casts are rejected. Temporal predicates are rejected here — "
    "scope time with time_range, its only home. Examples: "
    "\"span_kind == 'LLM' and latency_ms > 1000\"; \"status_code == 'ERROR'\"; "
    "\"'rate limit' in output.value\"; \"metadata['release'] == 'v42'\"."
)

_PROJECT_DESCRIPTION = "Project id or name (either form works; list projects with getProjects)."

_VALIDATE_ONLY_DESCRIPTION = (
    "If true, resolve and validate the query without executing anything: returns "
    "{status: 'ok', valid: true} or the structured error the real call would return."
)


# --------------------------------------------------------------------------
# Structured-parameter shape validation
# --------------------------------------------------------------------------
#
# Structured parameters are declared loosely (``Any`` plus a hand-authored
# JSON schema) and validated inside the tool body: validation in the MCP
# argument-parsing layer would surface malformed shapes as raw pydantic
# text — stacked errors, internal model names, vendor URLs — instead of
# the structured error union every other failure uses. In-body validation
# turns a wrong shape into ``{status: "error", code: "invalid_shape", ...}``
# with a plain-language expected form.

_TIME_RANGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "start": {
            "type": "string",
            "format": "date-time",
            "description": (
                "Inclusive lower bound on span start_time, ISO-8601 (e.g. "
                "'2026-07-22T00:00:00Z'). Naive timestamps are treated as UTC."
            ),
        },
        "end": {
            "type": "string",
            "format": "date-time",
            "description": "Exclusive upper bound on span start_time, ISO-8601.",
        },
    },
    "required": ["start", "end"],
}

_OPTIONAL_TIME_RANGE_SCHEMA: dict[str, Any] = {
    "anyOf": [_TIME_RANGE_SCHEMA, {"type": "null"}],
}

_CALCULATIONS_SCHEMA: dict[str, Any] = {
    "type": "array",
    "minItems": 1,
    "items": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Result column name for this calculation.",
            },
            "fn": {
                "type": "string",
                "description": (
                    "Aggregation function: count, count_distinct, sum, avg, min, max, "
                    "p50, p90, p95, p99."
                ),
            },
            "field": {
                "type": ["string", "null"],
                "description": (
                    "Field to aggregate. Required for every function except count; "
                    "count with a field counts rows where the field is non-NULL."
                ),
            },
        },
        "required": ["name", "fn"],
    },
}

_BREAKDOWNS_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {
            "type": "array",
            "items": {
                "anyOf": [
                    {"type": "string", "description": "A groupable field id."},
                    {
                        "type": "object",
                        "properties": {"bucket": {"type": "string", "enum": ["hour"]}},
                        "required": ["bucket"],
                        "description": "Hourly time bucket of start_time.",
                    },
                ]
            },
        },
        {"type": "null"},
    ],
}

_ROW_ORDER_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {
                        "type": "string",
                        "description": "Field to order by; must be a selected field.",
                    },
                    "direction": {"type": "string", "enum": ["asc", "desc"], "default": "desc"},
                },
                "required": ["field"],
            },
        },
        {
            "type": "object",
            "properties": {
                "sample": {
                    "type": "object",
                    "properties": {"seed": {"type": "integer"}},
                    "required": ["seed"],
                }
            },
            "required": ["sample"],
        },
        {"type": "null"},
    ],
}

_AGGREGATE_ORDER_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "calculation": {
                        "type": ["string", "null"],
                        "description": "Name of a declared calculation to order by.",
                    },
                    "field": {
                        "type": ["string", "null"],
                        "description": (
                            "Breakdown field id to order by ('time_bucket' for the hour bucket)."
                        ),
                    },
                    "direction": {"type": "string", "enum": ["asc", "desc"], "default": "desc"},
                },
            },
        },
        {"type": "null"},
    ],
}

_ROW_FIELDS_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {"type": "array", "items": {"type": "string"}, "minItems": 1},
        {"type": "null"},
    ],
}

_TIME_RANGE_ADAPTER: TypeAdapter[TimeRange] = TypeAdapter(TimeRange)
_OPTIONAL_TIME_RANGE_ADAPTER: TypeAdapter[Optional[TimeRange]] = TypeAdapter(Optional[TimeRange])
_CALCULATIONS_ADAPTER: TypeAdapter[list[Calculation]] = TypeAdapter(list[Calculation])
_BREAKDOWNS_ADAPTER: TypeAdapter[Optional[list[Union[str, TimeBucket]]]] = TypeAdapter(
    Optional[list[Union[str, TimeBucket]]]
)
_ROW_ORDER_ADAPTER: TypeAdapter[Optional[Union[list[RowOrderField], SampleOrder]]] = TypeAdapter(
    Optional[Union[list[RowOrderField], SampleOrder]]
)
_AGGREGATE_ORDER_ADAPTER: TypeAdapter[Optional[list[AggregateOrderEntry]]] = TypeAdapter(
    Optional[list[AggregateOrderEntry]]
)
_ROW_FIELDS_ADAPTER: TypeAdapter[Optional[list[str]]] = TypeAdapter(Optional[list[str]])

#: Location parts worth showing in an invalid_shape path: list indices and
#: plain lowercase field names. Union-arm labels (class names, generic
#: forms) and scalar type names are internal vocabulary and are dropped.
_PLAIN_LOC_PART = re.compile(r"^[a-z][a-z0-9_]*$")
_TYPE_NAME_LOC_PARTS = frozenset({"null", "str", "int", "float", "bool", "list", "dict"})


def _shape_error_path(param: str, error: ValidationError) -> str:
    parts = [param]
    errors = error.errors(include_url=False)
    if errors:
        for part in errors[0]["loc"]:
            if isinstance(part, int):
                parts[-1] = f"{parts[-1]}[{part}]"
            elif (
                isinstance(part, str)
                and _PLAIN_LOC_PART.match(part)
                and part not in _TYPE_NAME_LOC_PARTS
            ):
                parts.append(part)
    return ".".join(parts)


def _parse_shape(adapter: TypeAdapter[Any], value: Any, param: str, expected: str) -> Any:
    """Validate one structured parameter, mapping failure to the error union."""
    try:
        return adapter.validate_python(value)
    except ValidationError as error:
        raise QueryError(
            code="invalid_shape",
            path=_shape_error_path(param, error),
            message=f"{param} has an invalid shape; expected {expected}.",
        )


#: Structural disclosure attached whenever a filter used an annotation
#: predicate: existence tests are any-annotator by construction.
_ANNOTATION_SEMANTICS_NOTE = (
    "The filter's annotation predicate uses any-annotator semantics: any "
    "matching annotation row satisfies it; consensus or reduced semantics "
    "are not implemented."
)

_ANNOTATION_SEMANTICS_SCHEMA: dict[str, Any] = {
    "type": "string",
    "enum": ["any"],
    "description": (
        "Present when the filter used an annotation predicate: the predicate "
        "is satisfied by any matching annotation row (any-annotator "
        "semantics); consensus/reduced semantics are not implemented."
    ),
}


# --------------------------------------------------------------------------
# Output schemas
# --------------------------------------------------------------------------

_ERROR_ARM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {"const": "error"},
        "code": {
            "type": "string",
            "description": (
                "Machine-readable failure class, e.g. unknown_field, invalid_filter, "
                "invalid_shape, field_not_groupable, project_not_found."
            ),
        },
        "path": {
            "type": ["string", "null"],
            "description": "Request location the error anchors to, e.g. 'order[0].field'.",
        },
        "message": {"type": "string"},
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Nearest-name or alternative-usage candidates, directly usable.",
        },
    },
    "required": ["status", "code", "message"],
}

_VALIDATE_ARM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {"const": "ok"},
        "valid": {"const": True},
        "applied": {"type": "object"},
    },
    "required": ["status", "valid"],
}


def _union_schema(
    ok_properties: dict[str, Any],
    ok_required: Sequence[str],
    validate_arm: bool = False,
) -> dict[str, Any]:
    ok_arm: dict[str, Any] = {
        "type": "object",
        "properties": {"status": {"const": "ok"}, **ok_properties},
        "required": ["status", *ok_required],
    }
    arms = [ok_arm, *([_VALIDATE_ARM] if validate_arm else []), _ERROR_ARM]
    return {"type": "object", "oneOf": arms}


_COLUMNS_SCHEMA: dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "type": {"type": "string"},
            "unit": {"type": ["string", "null"]},
        },
    },
    "description": "Typed metadata of the result columns, in order.",
}

_GUIDANCE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "cause": {
            "type": "string",
            "enum": ["window_empty", "path_not_observed", "no_matches"],
        },
        "detail": {"type": "string"},
    },
    "description": (
        "Present when the result is empty: which of the enumerated causes applies. "
        "path_not_observed is sampled evidence, not proof of absence."
    ),
}


# --------------------------------------------------------------------------
# Serialization helpers
# --------------------------------------------------------------------------


def _cell(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _serialized_size(obj: Any) -> int:
    return len(json.dumps(obj, ensure_ascii=False, default=str))


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _time_range_resolved(time_range: TimeRange) -> dict[str, str]:
    return {"start": _iso(time_range.start), "end": _iso(time_range.end)}


def _public_url(path: str) -> str:
    """Compose an absolute Phoenix UI link for ``path``.

    Behind a reverse proxy, only two parties can know the public origin:
    explicit configuration, or the incoming request itself — the server's
    own host/port settings describe where it listens, not where clients
    reach it. Precedence follows the OAuth machinery's ``public_origin``:
    ``PHOENIX_ROOT_URL`` when set; otherwise the current MCP request's
    origin with its ASGI ``root_path`` prepended; and the
    environment-composed URL only as the last resort when no request
    context exists.
    """
    if os.getenv(ENV_PHOENIX_ROOT_URL):
        return f"{str(get_env_root_url()).rstrip('/')}{path}"
    try:
        request = get_http_request()
    except RuntimeError:
        return f"{str(get_env_root_url()).rstrip('/')}{path}"
    origin = f"{request.base_url.scheme}://{request.base_url.netloc}"
    # The request is seen inside the mounted MCP app, so its ASGI root_path
    # is "<deployment prefix><MCP mount>". The deployment prefix (a reverse
    # proxy's) belongs in UI links; the app's own MCP mount does not — a UI
    # route lives at /projects/..., never /mcp/projects/....
    from phoenix.server.mcp_server import MCP_MOUNT_PATH

    root_path = str(request.scope.get("root_path", "")).rstrip("/")
    if root_path.endswith(MCP_MOUNT_PATH):
        root_path = root_path[: -len(MCP_MOUNT_PATH)]
    return f"{origin}{prepend_root_path({'root_path': root_path}, path)}"


def _ui_span_url(span_id: str) -> str:
    return _public_url(f"/redirects/spans/{span_id}")


def _ui_trace_url(trace_id: str) -> str:
    return _public_url(f"/redirects/traces/{trace_id}")


def _filter_literal(value: Any) -> str:
    """Render one group-key value as a filter-grammar literal.

    Strings are escaped for the grammar (which parses Python string
    literals): backslashes first, then single quotes — a value like
    ``o'brien-corp`` must survive both the grammar and URL encoding.
    """
    if isinstance(value, str):
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        return f"'{escaped}'"
    return repr(value)


def _bucket_start(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    return None


def _cohort_ui_url(
    base: str,
    breakdowns: Sequence[Any],
    raw_values: Sequence[Any],
    time_range: "TimeRange",
) -> str:
    """Deep link to the group's cohort in the Phoenix UI span view.

    The link carries the group's condition as a ``filter`` in the filter
    grammar (breakdown-key equalities ANDed) plus ``start``/``end``. A
    time bucket contributes nothing to ``filter``; it narrows the time
    params to its hour instead. A **null group key is skipped**: the UI
    filter grammar cannot express "attribute is absent" today, so the
    null bucket links to the window without that conjunct — a wider
    cohort than the row, by declared necessity.
    """
    conjuncts: list[str] = []
    window_start, window_end = time_range.start, time_range.end
    for breakdown, value in zip(breakdowns, raw_values):
        if breakdown.is_time_bucket:
            bucket = _bucket_start(value)
            if bucket is not None:
                window_start, window_end = bucket, bucket + timedelta(hours=1)
        elif value is not None:
            conjuncts.append(f"{breakdown.id} == {_filter_literal(value)}")
    params: dict[str, str] = {}
    if conjuncts:
        params["filter"] = " and ".join(conjuncts)
    params["start"] = _iso(window_start)
    params["end"] = _iso(window_end)
    return f"{base}?{urlencode(params)}"


def _clip_strings_to_budget(
    obj: Any,
    budget: int,
    marker: str,
    min_keep: int = 500,
) -> tuple[Any, list[str]]:
    """Clip the largest string leaves of a JSON-like object until it fits.

    Returns the (possibly copied and clipped) object and the dotted paths of
    clipped leaves. Whole values are never dropped — clipping a cell and
    pointing at the recovery path degrades better than losing the row.
    """
    size = _serialized_size(obj)
    if size <= budget:
        return obj, []
    obj = deepcopy(obj)
    leaves: list[tuple[int, Any, Any, str]] = []

    def collect(node: Any, path: str) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                child_path = f"{path}.{key}" if path else str(key)
                if isinstance(value, str) and len(value) > min_keep:
                    leaves.append((len(value), node, key, child_path))
                else:
                    collect(value, child_path)
        elif isinstance(node, list):
            for index, value in enumerate(node):
                child_path = f"{path}[{index}]"
                if isinstance(value, str) and len(value) > min_keep:
                    leaves.append((len(value), node, index, child_path))
                else:
                    collect(value, child_path)

    collect(obj, "")
    leaves.sort(key=lambda item: item[0], reverse=True)
    clipped: list[str] = []
    for length, container, key, path in leaves:
        if size <= budget:
            break
        text_value = container[key]
        excess = size - budget
        keep = max(min_keep, len(text_value) - excess - len(marker))
        if keep >= len(text_value):
            continue
        suffix = f"…[clipped {len(text_value) - keep} chars; {marker}]"
        container[key] = text_value[:keep] + suffix
        size += len(suffix) + keep - len(text_value)
        clipped.append(path)
    return obj, clipped


# --------------------------------------------------------------------------
# Observed-path sampling
# --------------------------------------------------------------------------


class _PathStats:
    """Streaming statistics for one attribute path in the discovery sample."""

    __slots__ = ("count", "types", "values", "values_complete")

    def __init__(self) -> None:
        self.count = 0
        self.types: Counter[str] = Counter()
        self.values: Counter[Any] = Counter()
        #: True while every observed value has been tracked; long values and
        #: high cardinality forfeit top-value reporting rather than
        #: misreport it as complete.
        self.values_complete = True

    def record(self, value: Any) -> None:
        self.count += 1
        if isinstance(value, bool):
            self.types["boolean"] += 1
        elif isinstance(value, int):
            self.types["integer"] += 1
        elif isinstance(value, float):
            self.types["float"] += 1
        else:
            self.types["string"] += 1
        trackable = not isinstance(value, str) or len(value) <= _TOP_VALUE_MAX_CHARS
        if not trackable:
            self.values_complete = False
            return
        if value in self.values or len(self.values) < _TOP_VALUES_LIMIT + 1:
            self.values[value] += 1
        else:
            self.values_complete = False

    def top_values(self) -> Optional[list[dict[str, Any]]]:
        if not self.values_complete or not self.values or len(self.values) > _TOP_VALUES_LIMIT:
            return None
        return [
            {"value": value, "count": count}
            for value, count in sorted(self.values.items(), key=lambda kv: (-kv[1], str(kv[0])))
        ]


def _flatten_scalars(
    blob: Mapping[str, Any],
    prefix: tuple[str, ...],
    out: dict[tuple[str, ...], _PathStats],
    depth: int = 0,
) -> None:
    if depth > 6:
        return
    for key, value in blob.items():
        if not isinstance(key, str):
            continue
        path = (*prefix, key)
        if isinstance(value, dict):
            _flatten_scalars(value, path, out, depth + 1)
        elif isinstance(value, (str, int, float, bool)):
            out.setdefault(path, _PathStats()).record(value)
        # None and list values are skipped: only scalar paths are fields.
        # List-valued paths (message lists, retrieval documents) are
        # deliberately omitted from observed discovery rather than emitted
        # with empty capabilities — list-entry access is defined by authored
        # convention fields, not by arbitrary observed indexing.


async def _sample_observed_paths(
    session: AsyncSession,
    project_rowid: int,
) -> tuple[int, dict[tuple[str, ...], _PathStats]]:
    """Scan a bounded, time-spread sample of the project's spans.

    Value discovery biased toward recent rows hides dimension values that
    stopped occurring — exactly the values an investigation of a change
    needs (the pre-cut release tag, the retired model name). So instead of
    the most recent N spans, the sample draws span ids uniformly across
    the project's whole id range: ids are allocated in ingestion order, so
    the draw reaches old and new rows alike, in one bounded IN-list query.
    The draw is seeded and therefore deterministic across calls, and it is
    random rather than fixed-stride because trace structure is periodic
    (root/child spans alternate ids) and a stride aliases with that period
    — an even stride can sample only root spans and miss every LLM
    attribute. Drawn ids that do not exist (gaps, other projects'
    interleaved rows) simply reduce the scanned row count, which is
    reported as ``sample_count``.
    """
    min_id, max_id = (
        await session.execute(
            compiler.scoped_base(
                [func.min(models.Span.id), func.max(models.Span.id)], project_rowid, None
            )
        )
    ).one()
    if min_id is None or max_id is None:
        return 0, {}
    id_range = range(min_id, max_id + 1)
    if len(id_range) <= _DISCOVERY_SAMPLE_SIZE:
        candidate_ids = list(id_range)
    else:
        rng = random.Random(_DISCOVERY_SAMPLE_SEED)
        candidate_ids = sorted(rng.sample(id_range, _DISCOVERY_SAMPLE_SIZE))
    stmt = (
        compiler.scoped_base([models.Span.attributes], project_rowid, None)
        .where(models.Span.id.in_(candidate_ids))
        .order_by(models.Span.id.asc())
        .limit(_DISCOVERY_SAMPLE_SIZE)
    )
    stats: dict[tuple[str, ...], _PathStats] = {}
    sample_count = 0
    for attributes in (await session.execute(stmt)).scalars():
        sample_count += 1
        if isinstance(attributes, dict):
            _flatten_scalars(attributes, (), stats)
    return sample_count, stats


async def _zero_result_guidance(
    session: AsyncSession,
    project_rowid: int,
    time_range: Optional[TimeRange],
    filter_condition: Optional[str],
) -> dict[str, str]:
    """Diagnose an empty result with bounded checks only.

    The window check counts spans within the queried window — never an
    unrestricted historical scan — and the path check reads the same
    bounded time-spread sample discovery uses.
    """
    window_count = await session.scalar(
        compiler.scoped_base([func.count()], project_rowid, time_range)
    )
    if not window_count:
        detail = "The project has no spans"
        if time_range is not None:
            detail += (
                f" between {_iso(time_range.start)} and {_iso(time_range.end)}"
                " (the check counted only within this window)"
            )
        return {"cause": "window_empty", "detail": detail + "."}
    if filter_condition:
        referenced = compiler.attribute_paths_in_filter(filter_condition)
        if referenced:
            sample_count, stats = await _sample_observed_paths(session, project_rowid)
            missing = sorted(
                registry.canonical_attribute_spelling(keys)
                for keys in referenced
                if keys not in stats
            )
            if missing:
                return {
                    "cause": "path_not_observed",
                    "detail": (
                        f"Attribute path(s) {', '.join(missing)} did not appear in a "
                        f"sample of {sample_count} spans drawn across the project's "
                        "history — sampled evidence, not proof of absence."
                    ),
                }
    return {
        "cause": "no_matches",
        "detail": (
            "The window contains spans and the query is well-formed; nothing matched the filter."
        ),
    }


# --------------------------------------------------------------------------
# Tool construction
# --------------------------------------------------------------------------


def _db(app: "FastAPI") -> "DbSessionFactory":
    # ``app.state.db`` is assigned after the MCP app is built, so it must be
    # resolved lazily at call time, never captured at build time.
    db: "DbSessionFactory" = app.state.db
    return db


def _capabilities(field: registry.AuthoredField) -> list[str]:
    capabilities = ["select"]
    if field.filterable:
        capabilities.append("filter")
    if field.groupable:
        capabilities.append("breakdown")
    if field.aggregatable:
        capabilities.append("aggregate")
    return capabilities


def _build_describe_spans(app: "FastAPI") -> Tool:
    async def describe_spans(
        project: str = Field(description=_PROJECT_DESCRIPTION),
    ) -> dict[str, Any]:
        try:
            db = _db(app)
            async with db.read() as session:
                project_rowid = await compiler.resolve_project_rowid(session, project)
                if project_rowid is None:
                    raise compiler.project_not_found(project)
                sample_count, stats = await _sample_observed_paths(session, project_rowid)
        except QueryError as error:
            return error.envelope()

        stats_by_spelling = {
            registry.canonical_attribute_spelling(keys): path_stats
            for keys, path_stats in stats.items()
        }
        fields: list[dict[str, Any]] = []
        for authored in registry.AUTHORED_FIELDS:
            entry: dict[str, Any] = {
                "field": authored.id,
                "label": authored.label,
                # Provenance tells the caller which identifiers are portable
                # across projects (columns, computed indicators, OpenInference
                # convention attributes) versus discovered in this project's
                # data (observed_attribute).
                "source": authored.source,
                "type": authored.type,
                "unit": authored.unit,
                "description": authored.description,
                "capabilities": _capabilities(authored),
            }
            observed = stats_by_spelling.pop(authored.id, None)
            if observed is not None:
                entry["observed_count"] = observed.count
                entry["sample_count"] = sample_count
                entry["sampled"] = True
            fields.append(entry)

        observed_spellings = sorted(
            stats_by_spelling, key=lambda spelling: -stats_by_spelling[spelling].count
        )
        capped = len(observed_spellings) > _DISCOVERY_MAX_OBSERVED_FIELDS
        for spelling in observed_spellings[:_DISCOVERY_MAX_OBSERVED_FIELDS]:
            path_stats = stats_by_spelling[spelling]
            observed_types = sorted(path_stats.types)
            entry = {
                "field": spelling,
                "source": "observed_attribute",
                "observed_types": observed_types,
                "observed_count": path_stats.count,
                "sample_count": sample_count,
                "missing_frequency": round(1 - path_stats.count / sample_count, 4)
                if sample_count
                else None,
                "capabilities": ["select", "filter", "breakdown"],
                "sampled": True,
            }
            if len(observed_types) > 1:
                entry["type_conflicts"] = observed_types
            top_values = path_stats.top_values()
            if top_values is not None:
                entry["top_values"] = top_values
            fields.append(entry)

        result: dict[str, Any] = {
            "status": "ok",
            "project": project,
            "fields": fields,
            "sampling": {
                "strategy": _DISCOVERY_STRATEGY,
                "sample_count": sample_count,
                "note": (
                    f"Observed fields come from a bounded sample of {sample_count} "
                    "spans drawn evenly across the project's span id range "
                    "(approximately time-ordered): observed, not exhaustive. An "
                    "unobserved path or value means not-seen-in-sample, never "
                    "nonexistent."
                ),
            },
        }
        if capped:
            result["note"] = (
                f"Observed fields were capped at {_DISCOVERY_MAX_OBSERVED_FIELDS} "
                "entries (ordered by observation count)."
            )
        return result

    return Tool.from_function(
        describe_spans,
        name="describeSpans",
        description=(
            "Discover the queryable span fields of a project — the dimensions and "
            "metrics for analytics: authored fields (typed, with units and "
            "capabilities) merged with attribute paths observed in a bounded sample "
            "drawn across the project's history (with types, frequencies, and top "
            "values for low-cardinality paths). Every returned `field` string is in "
            "canonical query spelling and works verbatim in querySpanRows "
            "fields/filter and aggregateSpans filter/breakdowns — copy identifiers "
            "from here instead of constructing them. Capabilities per entry: select, "
            "filter, breakdown, aggregate. Start here before aggregating or "
            "filtering. Full field-level documentation is in the JSON schema's "
            "descriptions (get_schema detail='full')."
        ),
        tags={SPANS_GROUP_TAG, ANALYTICS_TAG},
        annotations=_READ_ONLY_ANNOTATIONS,
        output_schema=_union_schema(
            {
                "project": {"type": "string"},
                "fields": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "The merged field catalog: authored entries carry type/unit/"
                        "capabilities; observed entries carry observed_types, counts, "
                        "and top_values where cardinality is low."
                    ),
                },
                "sampling": {"type": "object"},
                "note": {"type": "string"},
            },
            ["project", "fields", "sampling"],
        ),
    )


def _build_aggregate_spans(app: "FastAPI") -> Tool:
    async def aggregate_spans(
        project: str = Field(description=_PROJECT_DESCRIPTION),
        time_range: Any = Field(
            description="Required time window (UTC, start-inclusive, end-exclusive).",
            json_schema_extra=_TIME_RANGE_SCHEMA,
        ),
        calculations: Any = Field(
            description=(
                "Named aggregate calculations, e.g. "
                '[{"name": "calls", "fn": "count"}, '
                '{"name": "error_rate", "fn": "avg", "field": "is_error"}].'
            ),
            json_schema_extra=_CALCULATIONS_SCHEMA,
        ),
        filter: Optional[str] = Field(default=None, description=_FILTER_DESCRIPTION),
        breakdowns: Any = Field(
            default=None,
            description=(
                "Group-by dimensions: groupable field ids (see describeSpans "
                'capabilities) and/or {"bucket": "hour"} for hourly buckets of '
                'start_time, e.g. ["llm.model_name", {"bucket": "hour"}].'
            ),
            json_schema_extra=_BREAKDOWNS_SCHEMA,
        ),
        order: Any = Field(
            default=None,
            description=(
                "Ordering over declared calculations or breakdowns, e.g. "
                '[{"calculation": "error_rate", "direction": "desc"}] or '
                '[{"field": "time_bucket", "direction": "asc"}]. Breakdown keys '
                "are always appended as deterministic tie-breakers."
            ),
            json_schema_extra=_AGGREGATE_ORDER_SCHEMA,
        ),
        limit: int = Field(
            default=compiler.AGGREGATE_LIMIT_DEFAULT,
            gt=0,
            description=(
                f"Maximum groups returned (top-K; default "
                f"{compiler.AGGREGATE_LIMIT_DEFAULT}, capped at "
                f"{compiler.AGGREGATE_LIMIT_MAX} — larger values are clamped and the "
                "applied value reported). Calculations always run over the full "
                "matching set; the limit bounds only how many groups come back."
            ),
        ),
        validate_only: bool = Field(default=False, description=_VALIDATE_ONLY_DESCRIPTION),
        max_result_chars: int = Field(
            default=_DEFAULT_MAX_RESULT_CHARS,
            ge=1_000,
            le=500_000,
            description="Size budget for the returned rows, in characters.",
        ),
    ) -> dict[str, Any]:
        try:
            query = AggregateQuery(
                project=project,
                time_range=_parse_shape(
                    _TIME_RANGE_ADAPTER,
                    time_range,
                    "time_range",
                    '{"start": "<ISO-8601>", "end": "<ISO-8601>"}',
                ),
                filter=filter,
                calculations=_parse_shape(
                    _CALCULATIONS_ADAPTER,
                    calculations,
                    "calculations",
                    'a non-empty list like [{"name": "calls", "fn": "count"}, '
                    '{"name": "error_rate", "fn": "avg", "field": "is_error"}]',
                ),
                breakdowns=_parse_shape(
                    _BREAKDOWNS_ADAPTER,
                    breakdowns,
                    "breakdowns",
                    'a list of field ids and/or {"bucket": "hour"}, e.g. '
                    '["llm.model_name", {"bucket": "hour"}]',
                )
                or [],
                order=_parse_shape(
                    _AGGREGATE_ORDER_ADAPTER,
                    order,
                    "order",
                    'a list of entries like [{"calculation": "error_rate", '
                    '"direction": "desc"}] or [{"field": "time_bucket", '
                    '"direction": "asc"}]',
                ),
                limit=limit,
                validate_only=validate_only,
            )
            db = _db(app)
            async with db.read() as session:
                project_rowid = await compiler.resolve_project_rowid(session, project)
                if project_rowid is None:
                    raise compiler.project_not_found(project)
                plan = compiler.compile_aggregate(query, project_rowid, db.dialect)
                applied: dict[str, Any] = {
                    "limit": plan.applied_limit,
                    "time_range_resolved": _time_range_resolved(plan.time_range),
                    "timeout": {
                        "statement_timeout_ms": compiler.STATEMENT_TIMEOUT_MS
                        if db.dialect.value == "postgresql"
                        else None
                    },
                }
                if validate_only:
                    return {"status": "ok", "valid": True, "applied": applied}
                await compiler.apply_statement_timeout(session, db.dialect)
                raw_rows = (await session.execute(plan.stmt)).all()
                groups_total = (
                    await session.scalar(plan.groups_total_stmt)
                    if plan.groups_total_stmt is not None
                    else 1
                )
                overall_row = (await session.execute(plan.overall_stmt)).one()
                guidance = (
                    await _zero_result_guidance(
                        session, project_rowid, plan.time_range, query.filter
                    )
                    if not raw_rows
                    else None
                )
        except QueryError as error:
            return error.envelope()
        except ValidationError as error:
            # Safety net: any shape failure not caught by per-parameter
            # parsing still surfaces on the error union, never as raw
            # validation text.
            return QueryError(
                code="invalid_shape",
                path=_shape_error_path("request", error),
                message="The request has an invalid shape; check the parameter descriptions.",
            ).envelope()

        overall = {calc.name: _cell(value) for calc, value in zip(plan.calculations, overall_row)}
        columns = [b.column.as_dict() for b in plan.breakdowns] + [
            {"id": c.name, "type": "float", "unit": None} for c in plan.calculations
        ]
        share_basis = plan.share_basis
        overall_basis = overall.get(share_basis) if share_basis else None
        if share_basis is not None and overall_basis:
            columns.append(
                {
                    "id": "share",
                    "type": "float",
                    "unit": None,
                }
            )
        cohort_base = _public_url(f"/projects/{plan.project_gid}/spans")
        rows: list[dict[str, Any]] = []
        for raw in raw_rows:
            row: dict[str, Any] = {}
            for breakdown, value in zip(plan.breakdowns, raw):
                row[breakdown.id] = (
                    registry.normalize_time_bucket_value(value)
                    if breakdown.is_time_bucket
                    else _cell(value)
                )
            offset = len(plan.breakdowns)
            for calc, value in zip(plan.calculations, raw[offset:]):
                row[calc.name] = _cell(value)
            if share_basis is not None and overall_basis:
                basis_value = row.get(share_basis)
                if isinstance(basis_value, (int, float)):
                    row["share"] = basis_value / overall_basis
            row["ui_url"] = _cohort_ui_url(
                cohort_base,
                plan.breakdowns,
                raw[: len(plan.breakdowns)],
                plan.time_range,
            )
            rows.append(row)

        result: dict[str, Any] = {
            "status": "ok",
            "columns": columns,
            "rows": rows,
            "groups_total": groups_total,
            "groups_returned": len(rows),
            "overall": overall,
            "share_basis": share_basis,
            "applied": applied,
        }
        if guidance is not None:
            result["guidance"] = guidance
        notes: list[str] = []
        if plan.uses_annotation_filter:
            result["annotation_semantics"] = "any"
            notes.append(_ANNOTATION_SEMANTICS_NOTE)
        if groups_total is not None and groups_total > len(rows):
            notes.append(
                f"Top {len(rows)} of {groups_total} groups returned; ordering ties at "
                "the boundary break deterministically on the breakdown keys."
            )
        if share_basis is None and any(not c.additive for c in plan.calculations):
            notes.append(
                "share is omitted: none of the calculations is additive (only count "
                "and sum have meaningful shares of the overall total)."
            )
        if _serialized_size(rows) > max_result_chars:
            kept: list[dict[str, Any]] = []
            used = 0
            for row in rows:
                cost = _serialized_size(row)
                if kept and used + cost > max_result_chars:
                    break
                kept.append(row)
                used += cost
            notes.append(
                f"Only {len(kept)} of {len(rows)} groups fit max_result_chars; narrow "
                "breakdowns or raise the budget."
            )
            result["rows"] = kept
            result["groups_returned"] = len(kept)
        if notes:
            result["note"] = " ".join(notes)
        return result

    return Tool.from_function(
        aggregate_spans,
        name="aggregateSpans",
        description=(
            "Aggregate (group by) a project's spans into metrics: named calculations "
            "(count, count_distinct, sum, avg, min, max, p50/p90/p95/p99 percentiles) "
            "over aggregatable fields, grouped by breakdowns (groupable fields and/or "
            "hourly time buckets), filtered, ordered, and bounded to the top-N "
            "groups. Answers analytics questions like error rate by model, token "
            "totals by release, or latency percentiles per hour: error rate is "
            "avg(is_error), error count is sum(is_error). Returns typed columns, "
            "rows, groups_total vs groups_returned, the overall (ungrouped) totals, "
            "and per-group share of total for the first additive calculation; each "
            "group row carries a ui_url deep-linking the Phoenix UI to that cohort. "
            "Use describeSpans first to discover fields. The nested parameter shapes "
            "(time_range, calculations, breakdowns, order) and the filter grammar "
            "are documented in the JSON schema's field descriptions (get_schema "
            "detail='full')."
        ),
        tags={SPANS_GROUP_TAG, ANALYTICS_TAG},
        annotations=_READ_ONLY_ANNOTATIONS,
        output_schema=_union_schema(
            {
                "columns": _COLUMNS_SCHEMA,
                "rows": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "One record per group, keyed by breakdown ids and calculation names."
                    ),
                },
                "groups_total": {
                    "type": ["integer", "null"],
                    "description": "Total number of groups the query produced (before top-K).",
                },
                "groups_returned": {"type": "integer"},
                "overall": {
                    "type": "object",
                    "description": "The same calculations over the full matching set, ungrouped.",
                },
                "share_basis": {
                    "type": ["string", "null"],
                    "description": (
                        "Calculation whose per-group share of the overall total is "
                        "reported (first additive calculation), or null."
                    ),
                },
                "applied": {"type": "object"},
                "annotation_semantics": _ANNOTATION_SEMANTICS_SCHEMA,
                "guidance": _GUIDANCE_SCHEMA,
                "note": {"type": "string"},
            },
            ["columns", "rows", "groups_total", "groups_returned", "overall", "applied"],
            validate_arm=True,
        ),
    )


def _build_query_span_rows(app: "FastAPI") -> Tool:
    async def query_span_rows(
        project: str = Field(description=_PROJECT_DESCRIPTION),
        time_range: Any = Field(
            default=None,
            description=(
                "Time window (UTC, start-inclusive, end-exclusive). Defaults to the "
                f"last {compiler.ROW_WINDOW_DEFAULT_HOURS} hours; the resolved window "
                "is always echoed in applied.time_range_resolved."
            ),
            json_schema_extra=_OPTIONAL_TIME_RANGE_SCHEMA,
        ),
        fields: Any = Field(
            default=None,
            description=(
                "Field ids to return (authored ids or observed attribute paths from "
                "describeSpans). span_id is always included as the row identity. "
                "Defaults to: " + ", ".join(compiler.DEFAULT_ROW_FIELDS) + "."
            ),
            json_schema_extra=_ROW_FIELDS_SCHEMA,
        ),
        filter: Optional[str] = Field(default=None, description=_FILTER_DESCRIPTION),
        order: Any = Field(
            default=None,
            description=(
                "Two spellings. Ordered rows: a list of entries over selected "
                'fields, e.g. [{"field": "latency_ms", "direction": "desc"}] '
                "(default: start_time desc). Seeded random sample: an object, e.g. "
                '{"sample": {"seed": 42}} — representative rows instead of '
                "extremes, deterministic given the seed. The primary key always "
                "terminates the ordering, so results are deterministic."
            ),
            json_schema_extra=_ROW_ORDER_SCHEMA,
        ),
        limit: int = Field(
            default=compiler.ROW_LIMIT_DEFAULT,
            gt=0,
            description=(
                f"Maximum rows (default {compiler.ROW_LIMIT_DEFAULT}, capped at "
                f"{compiler.ROW_LIMIT_MAX} — larger values are clamped and the applied "
                "value reported)."
            ),
        ),
        validate_only: bool = Field(default=False, description=_VALIDATE_ONLY_DESCRIPTION),
        max_cell_chars: int = Field(
            default=_DEFAULT_MAX_CELL_CHARS,
            ge=50,
            le=10_000,
            description=(
                "Per-cell preview budget: longer string values are clipped and listed "
                "in `clipped`; recover any full value via getSpan."
            ),
        ),
        max_result_chars: int = Field(
            default=_DEFAULT_MAX_RESULT_CHARS,
            ge=1_000,
            le=500_000,
            description="Size budget for the returned rows, in characters.",
        ),
    ) -> dict[str, Any]:
        try:
            query = RowQuery(
                project=project,
                time_range=_parse_shape(
                    _OPTIONAL_TIME_RANGE_ADAPTER,
                    time_range,
                    "time_range",
                    '{"start": "<ISO-8601>", "end": "<ISO-8601>"}',
                ),
                fields=_parse_shape(
                    _ROW_FIELDS_ADAPTER,
                    fields,
                    "fields",
                    'a non-empty list of field ids, e.g. ["span_id", "latency_ms"]',
                ),
                filter=filter,
                order=_parse_shape(
                    _ROW_ORDER_ADAPTER,
                    order,
                    "order",
                    'either a list like [{"field": "latency_ms", "direction": '
                    '"desc"}] or a sample object like {"sample": {"seed": 42}}',
                ),
                limit=limit,
                validate_only=validate_only,
            )
            db = _db(app)
            async with db.read() as session:
                project_rowid = await compiler.resolve_project_rowid(session, project)
                if project_rowid is None:
                    raise compiler.project_not_found(project)
                plan = compiler.compile_rows(query, project_rowid, db.dialect)
                applied: dict[str, Any] = {
                    "limit": plan.applied_limit,
                    "time_range_resolved": _time_range_resolved(plan.time_range),
                    "time_range_defaulted": plan.time_range_defaulted,
                    "max_cell_chars": max_cell_chars,
                    "max_result_chars": max_result_chars,
                    "timeout": {
                        "statement_timeout_ms": compiler.STATEMENT_TIMEOUT_MS
                        if db.dialect.value == "postgresql"
                        else None
                    },
                }
                if validate_only:
                    return {"status": "ok", "valid": True, "applied": applied}
                await compiler.apply_statement_timeout(session, db.dialect)
                sample_note: Optional[str] = None
                if plan.sample is not None:
                    assert plan.ids_stmt is not None
                    ids = list((await session.execute(plan.ids_stmt)).scalars())
                    chosen = plan.choose_sample_ids(ids)
                    raw_rows = (
                        (await session.execute(plan.rows_stmt_for_ids(chosen))).all()
                        if chosen
                        else []
                    )
                    applied["sample"] = {"seed": plan.sample.seed}
                    if len(ids) >= compiler.SAMPLE_ID_SCAN_CAP:
                        sample_note = (
                            f"The sample was drawn from the first "
                            f"{compiler.SAMPLE_ID_SCAN_CAP} matching row ids; narrow "
                            "the window for full coverage."
                        )
                else:
                    assert plan.stmt is not None
                    raw_rows = (await session.execute(plan.stmt)).all()
                guidance = (
                    await _zero_result_guidance(
                        session, project_rowid, plan.time_range, query.filter
                    )
                    if not raw_rows
                    else None
                )
        except QueryError as error:
            return error.envelope()
        except ValidationError as error:
            # Safety net: any shape failure not caught by per-parameter
            # parsing still surfaces on the error union, never as raw
            # validation text.
            return QueryError(
                code="invalid_shape",
                path=_shape_error_path("request", error),
                message="The request has an invalid shape; check the parameter descriptions.",
            ).envelope()

        column_ids = [c.id for c in plan.columns]
        clipped: list[dict[str, Any]] = []
        rows: list[dict[str, Any]] = []
        for raw in raw_rows:
            row = {column_id: _cell(value) for column_id, value in zip(column_ids, raw)}
            span_id = row.get("span_id")
            for column_id, value in row.items():
                if isinstance(value, str) and len(value) > max_cell_chars:
                    row[column_id] = value[:max_cell_chars] + (
                        f"…[clipped {len(value) - max_cell_chars} chars]"
                    )
                    clipped.append({"row": span_id, "field": column_id})
            rows.append(row)

        kept_rows: list[dict[str, Any]] = []
        used = 0
        for row in rows:
            cost = _serialized_size(row)
            if kept_rows and used + cost > max_result_chars:
                break
            kept_rows.append(row)
            used += cost

        result: dict[str, Any] = {
            "status": "ok",
            "columns": [c.as_dict() for c in plan.columns],
            "rows": kept_rows,
            "row_count": len(rows),
            "applied": applied,
            "clipped": [
                marker
                for marker in clipped
                if any(r.get("span_id") == marker["row"] for r in kept_rows)
            ],
        }
        if guidance is not None:
            result["guidance"] = guidance
        # An observed-path column that is NULL on every returned row is
        # indistinguishable from a misspelled path: the projection compiles,
        # returns, and quietly says nothing. Say so per column instead of
        # letting the silence read as data. Authored fields are exempt —
        # their NULLs carry documented meaning (no cost recorded, fewer
        # than two messages).
        if kept_rows:
            column_notes = [
                {
                    "column": spec.id,
                    "note": (
                        "path not observed in these results — verify the spelling "
                        "via describeSpans."
                    ),
                }
                for spec in plan.columns
                if spec.type == "json" and all(row.get(spec.id) is None for row in kept_rows)
            ]
            if column_notes:
                result["column_notes"] = column_notes
        notes: list[str] = []
        if plan.uses_annotation_filter:
            result["annotation_semantics"] = "any"
            notes.append(_ANNOTATION_SEMANTICS_NOTE)
        if sample_note:
            notes.append(sample_note)
        if clipped:
            notes.append(
                "Some cells were clipped to max_cell_chars previews; recover any full "
                "value with getSpan(project, span_id)."
            )
        if len(kept_rows) < len(rows):
            notes.append(
                f"Only {len(kept_rows)} of {len(rows)} rows fit max_result_chars; "
                "select fewer or smaller fields, narrow the filter, or raise the "
                "budget."
            )
        if plan.sample is None and len(rows) >= plan.applied_limit:
            notes.append(
                f"Row count is at the limit ({plan.applied_limit}); results may be "
                "incomplete — raise limit or narrow filter/time_range."
            )
        if notes:
            result["note"] = " ".join(notes)
        return result

    return Tool.from_function(
        query_span_rows,
        name="querySpanRows",
        description=(
            "Retrieve individual spans as ordered, bounded rows — top-N listings "
            "(order + limit, e.g. the slowest failures), filtered slices, or a "
            "seeded random sample: select fields (authored ids or observed attribute "
            "paths from describeSpans), filter, order, and limit. Results are "
            "deterministic; span_id is always included as the row identity; long "
            "values are clipped to previews with getSpan as the recovery path. "
            "Defaults to the last 24 hours when time_range is omitted. The nested "
            "parameter shapes (time_range, fields, order) and the filter grammar are "
            "documented in the JSON schema's field descriptions (get_schema "
            "detail='full')."
        ),
        tags={SPANS_GROUP_TAG, ANALYTICS_TAG},
        annotations=_READ_ONLY_ANNOTATIONS,
        output_schema=_union_schema(
            {
                "columns": _COLUMNS_SCHEMA,
                "rows": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "One record per span, keyed by field id.",
                },
                "row_count": {"type": "integer"},
                "applied": {"type": "object"},
                "clipped": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "row": {"type": ["string", "null"]},
                            "field": {"type": "string"},
                        },
                    },
                    "description": (
                        "Cells clipped to the preview budget, identified by row "
                        "span_id and field id; getSpan returns full values."
                    ),
                },
                "column_notes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "column": {"type": "string"},
                            "note": {"type": "string"},
                        },
                    },
                    "description": (
                        "Present when a selected observed attribute path was NULL on "
                        "every returned row — usually a misspelled path; verify via "
                        "describeSpans."
                    ),
                },
                "annotation_semantics": _ANNOTATION_SEMANTICS_SCHEMA,
                "guidance": _GUIDANCE_SCHEMA,
                "note": {"type": "string"},
            },
            ["columns", "rows", "row_count", "applied", "clipped"],
            validate_arm=True,
        ),
    )


def _build_get_span(app: "FastAPI") -> Tool:
    async def get_span(
        project: str = Field(description=_PROJECT_DESCRIPTION),
        span_id: str = Field(description="OpenTelemetry span id (hex), e.g. from querySpanRows."),
        max_result_chars: int = Field(
            default=_GET_SPAN_MAX_RESULT_CHARS,
            ge=1_000,
            le=500_000,
            description=(
                "Size budget in characters; oversized string values are clipped "
                "largest-first and listed in `clipped`."
            ),
        ),
    ) -> dict[str, Any]:
        try:
            db = _db(app)
            async with db.read() as session:
                project_rowid = await compiler.resolve_project_rowid(session, project)
                if project_rowid is None:
                    raise compiler.project_not_found(project)
                stmt = compiler.scoped_base(
                    [models.Span, models.Trace.trace_id], project_rowid, None
                ).where(models.Span.span_id == span_id)
                row = (await session.execute(stmt)).first()
                if row is None:
                    # Identical for a span in another project and a span that
                    # does not exist: not-found must not be an existence oracle.
                    raise QueryError(
                        code="span_not_found",
                        path="span_id",
                        message=f"Span {span_id!r} not found in project {project!r}.",
                    )
                span, trace_id = row
                # The flat registry-field echo, computed through the same
                # registry expressions row queries use (so guarded numeric
                # semantics are identical): the survey and the drill-down
                # keep one naming scheme, instead of remapping flat ids like
                # status_code onto the nested record at the handoff.
                fields_stmt = compiler.scoped_base(
                    [f.expr(db.dialect).label(f.id) for f in registry.AUTHORED_FIELDS],
                    project_rowid,
                    None,
                ).where(models.Span.span_id == span_id)
                fields_row = (await session.execute(fields_stmt)).first()
        except QueryError as error:
            return error.envelope()

        registry_fields = (
            {field.id: _cell(value) for field, value in zip(registry.AUTHORED_FIELDS, fields_row)}
            if fields_row is not None
            else {}
        )
        payload: dict[str, Any] = {
            "span_id": span.span_id,
            "trace_id": trace_id,
            "parent_id": span.parent_id,
            "name": span.name,
            "span_kind": span.span_kind,
            "status": {"code": span.status_code, "message": span.status_message},
            "start_time": _cell(span.start_time),
            "end_time": _cell(span.end_time),
            "latency_ms": span.latency_ms,
            "attributes": span.attributes,
            "events": span.events,
        }
        payload, clipped_paths = _clip_strings_to_budget(
            payload,
            max_result_chars,
            marker="raise max_result_chars for more",
        )
        result: dict[str, Any] = {
            "status": "ok",
            "span": payload,
            "fields": registry_fields,
            "ui_url": _ui_span_url(span.span_id),
            "applied": {"max_result_chars": max_result_chars},
            "clipped": clipped_paths,
        }
        if clipped_paths:
            result["note"] = (
                "Some values exceeded max_result_chars and were clipped largest-first; "
                "raise max_result_chars to recover them."
            )
        return result

    return Tool.from_function(
        get_span,
        name="getSpan",
        description=(
            "Fetch one span in full: attributes, events (including exception details), "
            "status, timing, trace_id, and a Phoenix UI link (ui_url). Also echoes "
            "`fields` — the flat registry field values (status_code, latency_ms, "
            "llm.model_name, ...) exactly as querySpanRows returns them, so the "
            "survey and the drill-down share one naming scheme. The recovery path "
            "for every clipped preview in querySpanRows. Parameter documentation is "
            "in the JSON schema's field descriptions (get_schema detail='full')."
        ),
        tags={SPANS_GROUP_TAG, ANALYTICS_TAG},
        annotations=_READ_ONLY_ANNOTATIONS,
        output_schema=_union_schema(
            {
                "span": {
                    "type": "object",
                    "description": (
                        "The full span record: identity, name, kind, status, timing, "
                        "attributes, and events."
                    ),
                },
                "fields": {
                    "type": "object",
                    "description": (
                        "Flat registry field values for this span, keyed by the same "
                        "field ids querySpanRows uses (status_code, latency_ms, "
                        "llm.model_name, ...) and computed through the same "
                        "expressions, guarded numeric semantics included."
                    ),
                },
                "ui_url": {
                    "type": "string",
                    "description": "Phoenix UI link opening this span.",
                },
                "applied": {"type": "object"},
                "clipped": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Dotted paths of values clipped to fit max_result_chars.",
                },
                "note": {"type": "string"},
            },
            ["span", "fields", "ui_url"],
        ),
    )


def _build_get_trace(app: "FastAPI") -> Tool:
    async def get_trace(
        project: str = Field(description=_PROJECT_DESCRIPTION),
        trace_id: str = Field(description="OpenTelemetry trace id (hex), e.g. from querySpanRows."),
        max_result_chars: int = Field(
            default=_DEFAULT_MAX_RESULT_CHARS,
            ge=1_000,
            le=500_000,
            description=(
                "Size budget in characters; if the tree exceeds it, latest-started "
                "spans are omitted and counted in `note`."
            ),
        ),
    ) -> dict[str, Any]:
        try:
            db = _db(app)
            async with db.read() as session:
                project_rowid = await compiler.resolve_project_rowid(session, project)
                if project_rowid is None:
                    raise compiler.project_not_found(project)
                stmt = (
                    compiler.scoped_base(
                        [
                            models.Span.span_id,
                            models.Span.parent_id,
                            models.Span.name,
                            models.Span.span_kind,
                            models.Span.status_code,
                            models.Span.start_time,
                            models.Span.latency_ms,
                        ],
                        project_rowid,
                        None,
                    )
                    .where(models.Trace.trace_id == trace_id)
                    .order_by(models.Span.start_time.asc(), models.Span.id.asc())
                )
                raw_rows = (await session.execute(stmt)).all()
                if not raw_rows:
                    # Identical for a trace in another project and a trace that
                    # does not exist: not-found must not be an existence oracle.
                    raise QueryError(
                        code="trace_not_found",
                        path="trace_id",
                        message=f"Trace {trace_id!r} not found in project {project!r}.",
                    )
        except QueryError as error:
            return error.envelope()

        summaries = [
            {
                "span_id": span_id,
                "parent_id": parent_id,
                "name": name,
                "span_kind": span_kind,
                "status_code": status_code,
                "start_time": _cell(start_time),
                "latency_ms": latency_ms,
                "ui_url": _ui_span_url(span_id),
            }
            for span_id, parent_id, name, span_kind, status_code, start_time, latency_ms in (
                raw_rows
            )
        ]
        total = len(summaries)
        omitted = 0
        while True:
            roots = _assemble_tree(summaries)
            result: dict[str, Any] = {
                "status": "ok",
                "trace_id": trace_id,
                "span_count": total,
                "roots": roots,
                "ui_url": _ui_trace_url(trace_id),
                "applied": {"max_result_chars": max_result_chars},
            }
            if omitted:
                result["note"] = (
                    f"{omitted} of {total} spans were omitted (latest-started first) "
                    "to fit max_result_chars; raise it or drill into spans with "
                    "getSpan."
                )
            if _serialized_size(result) <= max_result_chars or len(summaries) <= 1:
                return result
            drop = max(1, len(summaries) // 10)
            summaries = summaries[:-drop]
            omitted += drop

    return Tool.from_function(
        get_trace,
        name="getTrace",
        description=(
            "Fetch one trace's spans with parent/child structure assembled as a tree "
            "of summaries (identity, name, kind, status, timing, ui_url per span; "
            "orphaned spans surface as roots and are flagged). Full span values come "
            "from getSpan."
        ),
        tags={SPANS_GROUP_TAG},
        annotations=_READ_ONLY_ANNOTATIONS,
        output_schema=_union_schema(
            {
                "trace_id": {"type": "string"},
                "span_count": {"type": "integer"},
                "roots": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "Root span summaries, each with a nested `children` list; "
                        "orphaned spans (parent never received) appear as roots with "
                        "orphan: true."
                    ),
                },
                "ui_url": {
                    "type": "string",
                    "description": "Phoenix UI link opening this trace.",
                },
                "applied": {"type": "object"},
                "note": {"type": "string"},
            },
            ["trace_id", "span_count", "roots", "ui_url"],
        ),
    )


def _assemble_tree(summaries: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Nest span summaries into parent/child structure.

    Spans whose parent is absent from the set (orphans) become roots with an
    ``orphan: true`` flag — absence of the parent is data, not an error.
    """
    nodes: dict[str, dict[str, Any]] = {}
    for summary in summaries:
        node = dict(summary)
        node["children"] = []
        nodes[node["span_id"]] = node
    roots: list[dict[str, Any]] = []
    for node in nodes.values():
        parent_id = node["parent_id"]
        if parent_id is None:
            roots.append(node)
        elif parent_id in nodes:
            nodes[parent_id]["children"].append(node)
        else:
            node["orphan"] = True
            roots.append(node)
    return roots


def build_span_analytics_tools(app: "FastAPI") -> list[Tool]:
    """Build the five span analytics tools bound to ``app``.

    The tools resolve ``app.state.db`` lazily at call time because it is
    assigned after the MCP app is constructed.
    """
    return [
        _build_describe_spans(app),
        _build_aggregate_spans(app),
        _build_query_span_rows(app),
        _build_get_span(app),
        _build_get_trace(app),
    ]
