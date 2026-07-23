"""Observed-path discovery sampling for the span analytics MCP tools.

Project-specific context lives in the free-form attribute blob, so the
queryable paths of a project are discovered from its data: a bounded,
seeded sample of spans drawn evenly across the project's span id range is
scanned and its scalar attribute paths collected with per-path statistics.
The same sample backs discovery output (``describeSpans``), zero-result
diagnosis, and per-request observed-path checks — one sampling strategy,
one epistemic contract: an unobserved path means not-seen-in-sample, never
nonexistent.
"""

from __future__ import annotations

import random
from collections import Counter
from typing import Any, Mapping, Optional

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.mcp_span_analytics import compiler, registry
from phoenix.server.mcp_span_analytics.compiler import TimeRange
from phoenix.server.mcp_span_analytics.envelope import iso

#: Upper bound on spans scanned for observed-field discovery and
#: zero-result diagnosis. A bounded sample drawn evenly across the
#: project's span id range, never a full scan.
SAMPLE_SIZE = 500

#: Declared sampling strategy of the discovery scan: up to N span ids
#: drawn uniformly across the project's id range (approximately
#: time-ordered, since ids are allocated in ingestion order).
STRATEGY = f"id_spread_{SAMPLE_SIZE}"

#: Fixed seed of the discovery draw: the same project state always yields
#: the same sample, so repeated discovery calls agree with each other.
SAMPLE_SEED = 0

#: Cap on observed-field entries in one describeSpans response.
MAX_OBSERVED_FIELDS = 100

#: Observed values are tracked for top-value reporting only up to this many
#: distinct values per path and this many characters per value.
TOP_VALUES_LIMIT = 20
TOP_VALUE_MAX_CHARS = 100


class PathStats:
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
        trackable = not isinstance(value, str) or len(value) <= TOP_VALUE_MAX_CHARS
        if not trackable:
            self.values_complete = False
            return
        if value in self.values or len(self.values) < TOP_VALUES_LIMIT + 1:
            self.values[value] += 1
        else:
            self.values_complete = False

    def top_values(self) -> Optional[list[dict[str, Any]]]:
        if not self.values_complete or not self.values or len(self.values) > TOP_VALUES_LIMIT:
            return None
        return [
            {"value": value, "count": count}
            for value, count in sorted(self.values.items(), key=lambda kv: (-kv[1], str(kv[0])))
        ]


def _flatten_scalars(
    blob: Mapping[str, Any],
    prefix: tuple[str, ...],
    out: dict[tuple[str, ...], PathStats],
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
            out.setdefault(path, PathStats()).record(value)
        # None and list values are skipped: only scalar paths are fields.
        # List-valued paths (message lists, retrieval documents) are
        # deliberately omitted from observed discovery rather than emitted
        # with empty capabilities — list-entry access is defined by authored
        # convention fields, not by arbitrary observed indexing.


async def sample_observed_paths(
    session: AsyncSession,
    project_rowid: int,
) -> tuple[int, dict[tuple[str, ...], PathStats]]:
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
    if len(id_range) <= SAMPLE_SIZE:
        candidate_ids = list(id_range)
    else:
        rng = random.Random(SAMPLE_SEED)
        candidate_ids = sorted(rng.sample(id_range, SAMPLE_SIZE))
    stmt = (
        compiler.scoped_base([models.Span.attributes], project_rowid, None)
        .where(models.Span.id.in_(candidate_ids))
        .order_by(models.Span.id.asc())
        .limit(SAMPLE_SIZE)
    )
    stats: dict[tuple[str, ...], PathStats] = {}
    sample_count = 0
    for attributes in (await session.execute(stmt)).scalars():
        sample_count += 1
        if isinstance(attributes, dict):
            _flatten_scalars(attributes, (), stats)
    return sample_count, stats


async def zero_result_guidance(
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
                f" between {iso(time_range.start)} and {iso(time_range.end)}"
                " (the check counted only within this window)"
            )
        return {"cause": "window_empty", "detail": detail + "."}
    if filter_condition:
        referenced = compiler.attribute_paths_in_filter(filter_condition)
        if referenced:
            sample_count, stats = await sample_observed_paths(session, project_rowid)
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
