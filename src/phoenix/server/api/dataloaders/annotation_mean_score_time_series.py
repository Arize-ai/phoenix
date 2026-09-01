"""Batched per-name, per-bin mean annotation scores for sparkline series.

One SQL statement serves every annotation name requested for the same
(kind, project, window, binning) segment, so a page of evaluator rows loads
its score series in a single query.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Literal, Type, Union

from sqlalchemy import Select, or_, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import date_trunc
from phoenix.server.api.annotation_metrics import build_entity_weighted_annotation_metrics_stmt
from phoenix.server.types import DbSessionFactory

Kind: TypeAlias = Literal["span", "trace", "session"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[datetime, datetime]
Stride: TypeAlias = Literal["minute", "hour", "day", "week", "month", "year"]
UtcOffsetMinutes: TypeAlias = int
AnnotationName: TypeAlias = str

Segment: TypeAlias = tuple[Kind, ProjectRowId, TimeInterval, Stride, UtcOffsetMinutes]
Key: TypeAlias = tuple[Kind, ProjectRowId, TimeInterval, Stride, UtcOffsetMinutes, AnnotationName]
MeanScoresByBucket: TypeAlias = dict[datetime, float]
Result: TypeAlias = MeanScoresByBucket
ResultPosition: TypeAlias = int


def _segment(key: Key) -> tuple[Segment, AnnotationName]:
    kind, project_rowid, interval, stride, utc_offset_minutes, annotation_name = key
    return (kind, project_rowid, interval, stride, utc_offset_minutes), annotation_name


class AnnotationMeanScoreTimeSeriesDataLoader(DataLoader[Key, Result]):
    """Loads `{bucket: mean_score}` for one annotation name; empty buckets are
    absent and left for the caller to fill along its time axis."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
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
            mean_scores: defaultdict[AnnotationName, MeanScoresByBucket] = defaultdict(dict)
            async with self._db.read() as session:
                data = await session.stream(stmt)
                async for row in data:
                    # `avg_score` repeats per label row of the same bucket, so
                    # the first sighting is the bucket's entity-weighted mean.
                    if row.avg_score is not None:
                        mean_scores[row.name].setdefault(
                            _as_datetime(row.bucket), float(row.avg_score)
                        )
            for annotation_name, positions in names.items():
                for position in positions:
                    results[position] = mean_scores[annotation_name]
        return results

    def _get_stmt(self, segment: Segment, *annotation_names: AnnotationName) -> Select[Any]:
        kind, project_rowid, (start_time, end_time), stride, utc_offset_minutes = segment

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
            bucket = date_trunc(
                self._db.dialect, stride, models.Trace.start_time, utc_offset_minutes
            )
            stmt: Select[Any] = (
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
            bucket = date_trunc(
                self._db.dialect, stride, models.Trace.start_time, utc_offset_minutes
            )
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
            bucket = date_trunc(
                self._db.dialect, stride, models.ProjectSession.start_time, utc_offset_minutes
            )
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
        stmt = stmt.where(bucket_time_column < end_time)
        return build_entity_weighted_annotation_metrics_stmt(stmt)


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
