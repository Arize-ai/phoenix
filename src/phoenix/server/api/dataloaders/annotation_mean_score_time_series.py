"""Batched per-name, per-bin mean annotation scores and label fractions for
sparkline and stacked-column series.

One SQL statement serves every annotation name requested for the same
(kind, project, window, binning) segment, so a page of evaluator rows loads
its score series in a single query.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal, NamedTuple, Optional, Type, Union

from cachetools import LRUCache, TTLCache
from sqlalchemy import Select, and_, case, func, or_, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.types import DbSessionFactory

Kind: TypeAlias = Literal["span", "trace", "session"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[datetime, Optional[datetime]]
AnnotationName: TypeAlias = str

Segment: TypeAlias = tuple[Kind, ProjectRowId, TimeInterval, TimeBucketSpec]
Key: TypeAlias = tuple[Kind, ProjectRowId, TimeInterval, TimeBucketSpec, AnnotationName]


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
Result: TypeAlias = SeriesBinsByBucket
ResultPosition: TypeAlias = int


def _segment(key: Key) -> tuple[Segment, AnnotationName]:
    kind, project_rowid, interval, time_bins, annotation_name = key
    return (kind, project_rowid, interval, time_bins), annotation_name


_Section: TypeAlias = tuple[ProjectRowId, AnnotationName, Kind]
_SubKey: TypeAlias = tuple[TimeInterval, TimeBucketSpec]


class AnnotationMeanScoreTimeSeriesCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    """Sections match AnnotationSummaryCache's `(project, name, kind)`, so the
    same annotation-write events invalidate both caches. Live windows are sent
    open-ended with snapped starts (to the hour for day-scale keys, finer for
    shorter ones), so sub-keys hold still between snap boundaries and
    day-scale entries stay useful for the whole main-cache TTL.
    """

    def __init__(self) -> None:
        super().__init__(
            # TTL=3600 (1-hour): day-scale window starts snap to the hour, so
            # an entry older than that no longer matches any live window;
            # shorter windows snap finer and churn their sub-keys sooner.
            main_cache=TTLCache(maxsize=64 * 32 * 2, ttl=3600),
            # LRU, not LFU: a user hops between a handful of windows, and
            # under LFU a fresh window's key enters at frequency 1 — the
            # immediate eviction victim while stale high-frequency windows
            # squat, so new windows never cache. LRU keeps the recently
            # viewed windows, which is the actual access pattern.
            # Each viewed window costs one sub-key per bin scale, so eight
            # entries retain the four most recently viewed windows even when
            # each was shown at two bin scales.
            sub_cache_factory=lambda: LRUCache(maxsize=2 * 4),
        )

    def invalidate_project(self, project_rowid: ProjectRowId) -> None:
        self.invalidate_matching(lambda section: section[0] == project_rowid)

    def _cache_key(self, key: Key) -> tuple[_Section, _SubKey]:
        (kind, project_rowid, interval, time_bins), annotation_name = _segment(key)
        return (project_rowid, annotation_name, kind), (interval, time_bins)


class AnnotationMeanScoreTimeSeriesDataLoader(DataLoader[Key, Result]):
    """Loads `{bucket: SeriesBin}` for one annotation name; buckets with no
    result are absent and left for the caller to fill along its time axis."""

    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(load_fn=self._load_fn, cache_map=cache_map)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        results: list[Result] = [{} for _ in keys]
        arguments: defaultdict[
            Segment,
            defaultdict[AnnotationName, list[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, annotation_name = _segment(key)
            arguments[segment][annotation_name].append(position)
        for segment, names in arguments.items():
            stmt = self._get_stmt(segment, *names.keys())
            # One row per (bucket, name, label), in label order, each repeating
            # its bucket's aggregates; a bucket without labels has one row
            # with a null label.
            bins: defaultdict[AnnotationName, SeriesBinsByBucket] = defaultdict(dict)
            async with self._db.read() as session:
                data = await session.stream(stmt)
                async for row in data:
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
            for annotation_name, positions in names.items():
                for position in positions:
                    results[position] = bins[annotation_name]
        return results

    def _get_stmt(
        self, segment: Segment, *annotation_names: AnnotationName
    ) -> Select[*tuple[Any, ...]]:
        """Per bucket, name and label: the label's entity-weighted fraction,
        alongside the bucket's mean of per-entity mean scores, its scored and
        result-bearing entity counts.

        Follows the single-scan shape of the annotation summary statement
        (`dataloaders/annotation_summaries.py`), partitioned by bucket: the
        scoped rows are grouped once per (bucket, entity, name, label) into a
        CTE, entity totals come from window aggregates over it rather than a
        self-join, and both aggregates below read that second CTE, which
        Postgres (12+) and SQLite materialize because it is referenced twice.
        The means and counts equal the `avg_score` and `scored_entity_count`
        of `build_entity_weighted_annotation_metrics_stmt`, and the fractions
        its `avg_label_fraction`, which takes several passes over the rows.
        """
        rows = self._get_rows_stmt(segment, *annotation_names).subquery()
        entity_label_counts = (
            select(
                rows.c.bucket,
                rows.c.entity_id,
                rows.c.name,
                rows.c.label,
                func.count(rows.c.label).label("label_count"),
                func.count(rows.c.score).label("score_count"),
                func.sum(rows.c.score).label("score_sum"),
            )
            .group_by(rows.c.bucket, rows.c.entity_id, rows.c.name, rows.c.label)
            .cte("series_entity_label_counts")
        )
        entity = [
            entity_label_counts.c.bucket,
            entity_label_counts.c.entity_id,
            entity_label_counts.c.name,
        ]
        entity_label_rows = select(
            entity_label_counts.c.bucket,
            entity_label_counts.c.name,
            entity_label_counts.c.label,
            entity_label_counts.c.label_count,
            func.sum(entity_label_counts.c.label_count)
            .over(partition_by=entity)
            .label("entity_label_count"),
            func.sum(entity_label_counts.c.score_count)
            .over(partition_by=entity)
            .label("entity_score_count"),
            func.sum(entity_label_counts.c.score_sum)
            .over(partition_by=entity)
            .label("entity_score_sum"),
            func.row_number().over(partition_by=entity).label("entity_row"),
        ).cte("series_entity_label_rows")
        # Per bucket and name, each entity once.
        bucket_aggregates = (
            select(
                entity_label_rows.c.bucket,
                entity_label_rows.c.name,
                func.count().label("result_entity_count"),
                func.avg(
                    case(
                        (
                            entity_label_rows.c.entity_score_count > 0,
                            entity_label_rows.c.entity_score_sum
                            * 1.0
                            / entity_label_rows.c.entity_score_count,
                        ),
                        else_=None,
                    )
                ).label("mean_score"),
                func.count(case((entity_label_rows.c.entity_score_count > 0, 1), else_=None)).label(
                    "scored_entity_count"
                ),
            )
            .where(entity_label_rows.c.entity_row == 1)
            .group_by(entity_label_rows.c.bucket, entity_label_rows.c.name)
            .subquery()
        )
        # Rows are unique per (bucket, entity, name, label), so summing each
        # entity's share of its labels sums over the entities with the label.
        label_shares = (
            select(
                entity_label_rows.c.bucket,
                entity_label_rows.c.name,
                entity_label_rows.c.label,
                func.sum(
                    entity_label_rows.c.label_count * 1.0 / entity_label_rows.c.entity_label_count
                ).label("label_share_sum"),
            )
            .where(entity_label_rows.c.label.is_not(None))
            .group_by(
                entity_label_rows.c.bucket,
                entity_label_rows.c.name,
                entity_label_rows.c.label,
            )
            .subquery()
        )
        return (
            select(
                bucket_aggregates.c.bucket,
                bucket_aggregates.c.name,
                bucket_aggregates.c.mean_score,
                bucket_aggregates.c.scored_entity_count,
                bucket_aggregates.c.result_entity_count,
                label_shares.c.label,
                # Score-only entities stay in the denominator, as in the
                # summaries, leaving their share to read as "other".
                (
                    label_shares.c.label_share_sum * 1.0 / bucket_aggregates.c.result_entity_count
                ).label("label_fraction"),
            )
            .join_from(
                bucket_aggregates,
                label_shares,
                and_(
                    bucket_aggregates.c.bucket == label_shares.c.bucket,
                    bucket_aggregates.c.name == label_shares.c.name,
                ),
                isouter=True,
            )
            .order_by(bucket_aggregates.c.bucket, bucket_aggregates.c.name, label_shares.c.label)
        )

    def _get_rows_stmt(
        self, segment: Segment, *annotation_names: AnnotationName
    ) -> Select[*tuple[Any, ...]]:
        """One row per result-bearing annotation in the window, with its bucket."""
        kind, project_rowid, (start_time, end_time), time_bins = segment

        annotation_model: Union[
            Type[models.SpanAnnotation],
            Type[models.TraceAnnotation],
            Type[models.ProjectSessionAnnotation],
        ]
        # Bucketing follows the project-level metrics time series: spans and
        # traces bucket by their trace's start time, sessions by their own.
        if kind == "span":
            annotation_model = models.SpanAnnotation
            bucket_time_column = models.Trace.start_time
            bucket = time_bins.truncate(self._db.dialect, models.Trace.start_time)
            stmt: Select[*tuple[Any, ...]] = (
                select(
                    bucket.label("bucket"),
                    models.Span.id.label("entity_id"),
                    models.SpanAnnotation.name.label("name"),
                    models.SpanAnnotation.label.label("label"),
                    models.SpanAnnotation.score.label("score"),
                )
                .join_from(
                    models.SpanAnnotation,
                    models.Span,
                    onclause=models.SpanAnnotation.span_rowid == models.Span.id,
                )
                .join_from(
                    models.Span,
                    models.Trace,
                    onclause=models.Span.trace_rowid == models.Trace.id,
                )
                .where(models.Trace.project_rowid == project_rowid)
            )
        elif kind == "trace":
            annotation_model = models.TraceAnnotation
            bucket_time_column = models.Trace.start_time
            bucket = time_bins.truncate(self._db.dialect, models.Trace.start_time)
            stmt = (
                select(
                    bucket.label("bucket"),
                    models.Trace.id.label("entity_id"),
                    models.TraceAnnotation.name.label("name"),
                    models.TraceAnnotation.label.label("label"),
                    models.TraceAnnotation.score.label("score"),
                )
                .join_from(
                    models.TraceAnnotation,
                    models.Trace,
                    onclause=models.TraceAnnotation.trace_rowid == models.Trace.id,
                )
                .where(models.Trace.project_rowid == project_rowid)
            )
        elif kind == "session":
            annotation_model = models.ProjectSessionAnnotation
            bucket_time_column = models.ProjectSession.start_time
            bucket = time_bins.truncate(self._db.dialect, models.ProjectSession.start_time)
            stmt = (
                select(
                    bucket.label("bucket"),
                    models.ProjectSession.id.label("entity_id"),
                    models.ProjectSessionAnnotation.name.label("name"),
                    models.ProjectSessionAnnotation.label.label("label"),
                    models.ProjectSessionAnnotation.score.label("score"),
                )
                .join_from(
                    models.ProjectSessionAnnotation,
                    models.ProjectSession,
                    onclause=models.ProjectSessionAnnotation.project_session_id
                    == models.ProjectSession.id,
                )
                .where(models.ProjectSession.project_id == project_rowid)
            )
        else:
            assert_never(kind)

        stmt = stmt.where(
            or_(
                annotation_model.score.is_not(None),
                annotation_model.label.is_not(None),
            )
        )
        stmt = stmt.where(annotation_model.name.in_(annotation_names))
        stmt = stmt.where(start_time <= bucket_time_column)
        if end_time is not None:
            # An absent end means "up to now": leaving the range open keeps
            # the cache key stable while writes invalidate stale entries.
            stmt = stmt.where(bucket_time_column < end_time)
        return stmt


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
