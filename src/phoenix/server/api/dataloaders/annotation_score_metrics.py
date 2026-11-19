"""Batched score aggregates for the project evaluators table's results column: for each
annotation name, the summary over the window and the binned mean-score series over it,
from one scan.

The values are those of `AnnotationSummaryDataLoader` and of the series loader this one
replaced, which read the same rows in two statements: the aggregates below are theirs,
over the same per-entity rows, in the same order.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal, NamedTuple, Optional, Type, Union

import pandas as pd
from cachetools import LRUCache, TTLCache
from sqlalchemy import (
    TIMESTAMP,
    ColumnElement,
    Select,
    and_,
    case,
    cast,
    func,
    literal,
    null,
    or_,
    select,
    true,
    type_coerce,
    union_all,
)
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.types import DbSessionFactory

Kind: TypeAlias = Literal["span", "trace", "session"]
ProjectRowId: TypeAlias = int
OpenInterval: TypeAlias = tuple[datetime, Optional[datetime]]
AnnotationName: TypeAlias = str

Segment: TypeAlias = tuple[Kind, ProjectRowId, OpenInterval, TimeBucketSpec]
Key: TypeAlias = tuple[Kind, ProjectRowId, OpenInterval, TimeBucketSpec, AnnotationName]


class SeriesBin(NamedTuple):
    """One bucket's entity-weighted aggregates, with the weights that let
    adjacent buckets be merged: the mean score over the `scored_entity_count`
    entities that carry a score (None when none does), and each label's
    entity-weighted share of the `result_entity_count` entities that carry
    any result, in label order."""

    mean_score: Optional[float]
    scored_entity_count: int
    result_entity_count: int
    label_fractions: tuple[tuple[str, float], ...] = ()


SeriesBinsByBucket: TypeAlias = dict[datetime, SeriesBin]


class AnnotationScoreMetrics(NamedTuple):
    summary: Optional[AnnotationSummary]
    series: SeriesBinsByBucket


Result: TypeAlias = AnnotationScoreMetrics
ResultPosition: TypeAlias = int


def _segment(key: Key) -> tuple[Segment, AnnotationName]:
    kind, project_rowid, window, time_bins, annotation_name = key
    return (kind, project_rowid, window, time_bins), annotation_name


_Section: TypeAlias = tuple[ProjectRowId, AnnotationName, Kind]
_SubKey: TypeAlias = tuple[OpenInterval, TimeBucketSpec]


class AnnotationScoreMetricsCache(TwoTierCache[Key, Result, _Section, _SubKey]):
    """Sections match AnnotationSummaryCache's `(project, name, kind)`, so the same
    annotation-write events invalidate both."""

    def __init__(self) -> None:
        super().__init__(
            main_cache=TTLCache(maxsize=64 * 32 * 2, ttl=3600),
            sub_cache_factory=lambda: LRUCache(maxsize=2 * 4),
        )

    def invalidate_project(self, project_rowid: ProjectRowId) -> None:
        self.invalidate_matching(lambda section: section[0] == project_rowid)

    def _cache_key(self, key: Key) -> tuple[_Section, _SubKey]:
        (kind, project_rowid, window, time_bins), annotation_name = _segment(key)
        return (project_rowid, annotation_name, kind), (window, time_bins)


class AnnotationScoreMetricsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(load_fn=self._load_fn, cache_map=cache_map)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        arguments: defaultdict[
            Segment,
            defaultdict[AnnotationName, list[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, annotation_name = _segment(key)
            arguments[segment][annotation_name].append(position)
        results: list[Result] = [AnnotationScoreMetrics(None, {}) for _ in keys]
        for segment, names in arguments.items():
            stmt = get_stmt(self._db.dialect, segment, *names.keys())
            async with self._db.read() as session:
                rows = [row async for row in await session.stream(stmt)]
            metrics = _assemble(rows)
            for annotation_name, positions in names.items():
                for position in positions:
                    results[position] = metrics.get(
                        annotation_name, AnnotationScoreMetrics(None, {})
                    )
        return results


def get_stmt(
    dialect: SupportedSQLDialect,
    segment: Segment,
    *annotation_names: AnnotationName,
) -> Select[*tuple[Any, ...]]:
    """The summary statement's rows (scope "current") followed by the series statement's
    (scope "series").

    The summary takes spans and traces by their own start time and sessions by overlap
    with the window; the series takes spans and traces by their trace's start time and
    sessions by their start time. Each result is grouped once per entity, name and label,
    marked with whether its entity is in the summary and which bin it falls in, and both
    statements' aggregates read those rows.
    """
    kind, project_rowid, (start, end), time_bins = segment
    annotation_model: Union[
        Type[models.SpanAnnotation],
        Type[models.TraceAnnotation],
        Type[models.ProjectSessionAnnotation],
    ]
    stmt: Select[*tuple[Any, ...]]
    if kind == "span":
        annotation_model = models.SpanAnnotation
        entity_id: Any = models.Span.id
        summary_start: Any = models.Span.start_time
        summary_end: Any = models.Span.start_time
        series_time: Any = models.Trace.start_time
        # A span is no older than its trace, so this bounds the series' rows too.
        lower_bound: ColumnElement[bool] = start <= models.Span.start_time
        stmt = (
            select()
            .select_from(models.SpanAnnotation)
            .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == project_rowid)
        )
    elif kind == "trace":
        annotation_model = models.TraceAnnotation
        entity_id = models.Trace.id
        summary_start = summary_end = series_time = models.Trace.start_time
        lower_bound = start <= models.Trace.start_time
        stmt = (
            select()
            .select_from(models.TraceAnnotation)
            .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == project_rowid)
        )
    elif kind == "session":
        annotation_model = models.ProjectSessionAnnotation
        entity_id = models.ProjectSession.id
        summary_start = models.ProjectSession.end_time
        summary_end = models.ProjectSession.start_time
        series_time = models.ProjectSession.start_time
        # Nothing keeps a session's end after its start, so either time can place it in
        # the window: its end for the summary, its start for the series.
        lower_bound = or_(
            start <= models.ProjectSession.start_time, start <= models.ProjectSession.end_time
        )
        stmt = (
            select()
            .select_from(models.ProjectSessionAnnotation)
            .join(
                models.ProjectSession,
                models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
            )
            .where(models.ProjectSession.project_id == project_rowid)
        )
    else:
        assert_never(kind)

    in_summary: ColumnElement[bool] = and_(
        start <= summary_start, summary_end < end if end else true()
    )
    in_series = and_(start <= series_time, series_time < end if end else true())
    rows = (
        stmt.add_columns(
            entity_id.label("entity_id"),
            annotation_model.name.label("name"),
            annotation_model.label.label("label"),
            annotation_model.score.label("score"),
            in_summary.label("in_summary"),
            case((in_series, time_bins.truncate(dialect, series_time)), else_=None).label("bucket"),
        )
        .where(annotation_model.name.in_(annotation_names))
        .where(or_(annotation_model.score.is_not(None), annotation_model.label.is_not(None)))
        .where(lower_bound)
        .where(or_(in_summary, in_series))
        .subquery()
    )
    # An entity's summary flag and bin are its own, so these are the groups both
    # statements form.
    entity_label_counts = (
        select(
            rows.c.entity_id,
            rows.c.name,
            rows.c.label,
            rows.c.in_summary,
            rows.c.bucket,
            func.count(rows.c.label).label("label_count"),
            func.count(rows.c.score).label("score_count"),
            func.sum(rows.c.score).label("score_sum"),
        )
        .group_by(rows.c.entity_id, rows.c.name, rows.c.label, rows.c.in_summary, rows.c.bucket)
        .cte("score_metrics_entity_label_counts")
    )
    c = entity_label_counts.c
    entity = [c.entity_id, c.name]
    entity_label_rows = select(
        c.name,
        c.label,
        c.in_summary,
        c.bucket,
        c.label_count,
        c.score_count,
        c.score_sum,
        func.sum(c.label_count).over(partition_by=entity).label("entity_label_count"),
        func.sum(c.score_count).over(partition_by=entity).label("entity_score_count"),
        func.sum(c.score_sum).over(partition_by=entity).label("entity_score_sum"),
        func.row_number().over(partition_by=entity).label("entity_row"),
    ).cte("score_metrics_entity_label_rows")
    r = entity_label_rows.c
    entity_mean_score = case(
        (r.entity_score_count > 0, r.entity_score_sum * 1.0 / r.entity_score_count),
        else_=None,
    )

    # Filtered within the aggregate rather than in the WHERE clause, so the planner
    # estimates its input as it does the series' and hashes it instead of sorting every row.
    name_aggregates = (
        select(
            r.name,
            func.count().filter(r.in_summary).label("entity_count"),
            func.avg(entity_mean_score).filter(r.in_summary).label("overall_avg_score"),
        )
        .where(r.entity_row == 1)
        .group_by(r.name)
        .subquery()
    )
    label_entity_metrics = (
        select(
            r.name,
            r.label,
            func.count().label("entities_with_label"),
            func.sum(r.label_count).label("total_label_count"),
            func.sum(r.score_count).label("total_score_count"),
            func.sum(r.score_sum).label("total_score_sum"),
            func.avg(
                case(
                    (r.entity_label_count > 0, r.label_count * 1.0 / r.entity_label_count),
                    else_=None,
                )
            ).label("avg_label_fraction_present"),
        )
        .where(r.in_summary)
        .group_by(r.name, r.label)
        .subquery()
    )
    bucket_aggregates = (
        select(
            r.bucket,
            r.name,
            func.count().label("result_entity_count"),
            func.avg(entity_mean_score).label("mean_score"),
            func.count(case((r.entity_score_count > 0, 1), else_=None)).label(
                "scored_entity_count"
            ),
        )
        .where(r.bucket.is_not(None), r.entity_row == 1)
        .group_by(r.bucket, r.name)
        .subquery()
    )
    label_shares = (
        select(
            r.bucket,
            r.name,
            r.label,
            func.sum(r.label_count * 1.0 / r.entity_label_count).label("label_share_sum"),
        )
        .where(r.bucket.is_not(None), r.label.is_not(None))
        .group_by(r.bucket, r.name, r.label)
        .subquery()
    )

    n, m, b, s = name_aggregates.c, label_entity_metrics.c, bucket_aggregates.c, label_shares.c
    summary_columns: dict[str, Any] = {
        "avg_label_fraction": case(
            (
                n.entity_count > 0,
                m.avg_label_fraction_present * m.entities_with_label / n.entity_count,
            ),
            else_=None,
        ),
        "avg_score": n.overall_avg_score,
        "label_count": m.total_label_count,
        "score_count": m.total_score_count,
        "score_sum": m.total_score_sum,
        "record_count": m.entities_with_label,
    }
    series_columns: dict[str, Any] = {
        "mean_score": b.mean_score,
        "scored_entity_count": b.scored_entity_count,
        "result_entity_count": b.result_entity_count,
        "label_fraction": s.label_share_sum * 1.0 / b.result_entity_count,
    }
    no_bucket = (
        cast(null(), TIMESTAMP(timezone=True))
        if dialect is SupportedSQLDialect.POSTGRESQL
        else null()
    )
    # The first select types the union's columns, so each statement's values are read
    # back as that statement types them.
    summary = select(
        literal(_SUMMARY).label("scope"),
        no_bucket.label("bucket"),
        m.name,
        m.label,
        *(column.label(key) for key, column in summary_columns.items()),
        *(type_coerce(null(), column.type).label(key) for key, column in series_columns.items()),
    ).join_from(label_entity_metrics, name_aggregates, m.name == n.name)
    series = select(
        literal(_SERIES).label("scope"),
        b.bucket,
        b.name,
        s.label,
        *(null().label(key) for key in summary_columns),
        *(column.label(key) for key, column in series_columns.items()),
    ).join_from(
        bucket_aggregates,
        label_shares,
        and_(b.bucket == s.bucket, b.name == s.name),
        isouter=True,
    )
    union = union_all(summary, series).subquery()
    return select(union).order_by(union.c.scope, union.c.bucket, union.c.name, union.c.label)


_SUMMARY = "current"
_SERIES = "series"


def _assemble(rows: list[Any]) -> dict[AnnotationName, AnnotationScoreMetrics]:
    """Rows arrive in scope, bin, name and label order, the order of the summary and
    series statements' own rows."""
    summaries: dict[AnnotationName, list[dict[str, Any]]] = defaultdict(list)
    bins: defaultdict[AnnotationName, SeriesBinsByBucket] = defaultdict(dict)
    for row in rows:
        if row.scope == _SERIES:
            bucket = _as_datetime(row.bucket)
            by_bucket = bins[row.name]
            series_bin = by_bucket.get(bucket) or SeriesBin(
                mean_score=None if row.mean_score is None else float(row.mean_score),
                scored_entity_count=int(row.scored_entity_count),
                result_entity_count=int(row.result_entity_count),
            )
            if row.label is not None:
                series_bin = series_bin._replace(
                    label_fractions=(
                        *series_bin.label_fractions,
                        (str(row.label), float(row.label_fraction)),
                    )
                )
            by_bucket[bucket] = series_bin
            continue
        summaries[row.name].append(
            {
                "name": row.name,
                "label": row.label,
                "avg_label_fraction": row.avg_label_fraction,
                "avg_score": row.avg_score,
                "label_count": row.label_count,
                "score_count": row.score_count,
                "score_sum": row.score_sum,
                "record_count": row.record_count,
            }
        )
    return {
        name: AnnotationScoreMetrics(
            summary=(
                AnnotationSummary(name=name, df=pd.DataFrame(summaries[name]))
                if name in summaries
                else None
            ),
            series=bins.get(name, {}),
        )
        for name in set(summaries) | set(bins)
    }


def _as_datetime(value: Any) -> datetime:
    # Mirrors the project metrics time series: SQLite returns buckets as naive
    # ISO strings, which normalize to UTC.
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = normalize_datetime(datetime.fromisoformat(value), timezone.utc)
        assert normalized is not None
        return normalized
    raise ValueError(f"Cannot convert {value} to datetime")
