from collections import defaultdict
from datetime import datetime
from typing import Any, Literal, Optional

import pandas as pd
from aioitertools.itertools import groupby
from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, func, or_, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.types import DbSessionFactory

Kind: TypeAlias = Literal["span", "trace"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
AnnotationName: TypeAlias = str

Segment: TypeAlias = tuple[Kind, ProjectRowId, TimeInterval, FilterCondition]
Param: TypeAlias = AnnotationName

Key: TypeAlias = tuple[Kind, ProjectRowId, Optional[TimeRange], FilterCondition, AnnotationName]
Result: TypeAlias = Optional[AnnotationSummary]
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = None


def _cache_key_fn(key: Key) -> tuple[Segment, Param]:
    kind, project_rowid, time_range, filter_condition, eval_name = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (kind, project_rowid, interval, filter_condition), eval_name


_Section: TypeAlias = tuple[ProjectRowId, AnnotationName, Kind]
_SubKey: TypeAlias = tuple[TimeInterval, FilterCondition]


class AnnotationSummaryCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    def __init__(self) -> None:
        super().__init__(
            # TTL=3600 (1-hour) because time intervals are always moving forward, but
            # interval endpoints are rounded down to the hour by the UI, so anything
            # older than an hour most likely won't be a cache-hit anyway.
            main_cache=TTLCache(maxsize=64 * 32 * 2, ttl=3600),
            sub_cache_factory=lambda: LFUCache(maxsize=2 * 2),
        )

    def invalidate_project(self, project_rowid: ProjectRowId) -> None:
        for section in self._cache.keys():
            if section[0] == project_rowid:
                del self._cache[section]

    def _cache_key(self, key: Key) -> tuple[_Section, _SubKey]:
        (kind, project_rowid, interval, filter_condition), annotation_name = _cache_key_fn(key)
        return (project_rowid, annotation_name, kind), (interval, filter_condition)


class AnnotationSummaryDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(
            load_fn=self._load_fn,
            cache_key_fn=_cache_key_fn,
            cache_map=cache_map,
        )
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        results: list[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: defaultdict[
            Segment,
            defaultdict[Param, list[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, param = _cache_key_fn(key)
            arguments[segment][param].append(position)
        for segment, params in arguments.items():
            stmt = _get_stmt(segment, *params.keys())
            async with self._db() as session:
                data = await session.stream(stmt)
                async for annotation_name, group in groupby(data, lambda row: row.name):
                    summary = AnnotationSummary(pd.DataFrame(group))
                    for position in params[annotation_name]:
                        results[position] = summary
        return results


def _get_stmt(
    segment: Segment,
    *annotation_names: Param,
) -> Select[Any]:
    kind, project_rowid, (start_time, end_time), filter_condition = segment

    if kind == "span":
        msa = models.SpanAnnotation
        # Define columns.
        name_column = msa.name
        label_column = msa.label
        score_column = msa.score
        span_id_column = models.Span.id.label("span_id")
        time_column = models.Span.start_time

        base_stmt = (
            select(
                span_id_column,
                name_column,
                label_column,
                func.count().label("record_count"),
                func.count(label_column).label("label_count"),
                func.count(score_column).label("score_count"),
                func.sum(score_column).label("score_sum"),
            )
            .join(models.Span)
            .join_from(models.Span, models.Trace)
            .where(models.Trace.project_rowid == project_rowid)
            .where(or_(score_column.is_not(None), label_column.is_not(None)))
            .where(name_column.in_(annotation_names))
        )
        if start_time:
            base_stmt = base_stmt.where(start_time <= time_column)
        if end_time:
            base_stmt = base_stmt.where(time_column < end_time)
        base_stmt = base_stmt.group_by(span_id_column, name_column, label_column)
        base_stmt = base_stmt.order_by(name_column, label_column)

        # Compute per-span label fraction:
        # For each (span, name, label) group, calculate:
        #   label_fraction = label_count / sum(label_count) OVER (PARTITION BY span_id, name)
        per_span_stmt = select(
            base_stmt.c.span_id,
            base_stmt.c.name,
            base_stmt.c.label,
            base_stmt.c.record_count,
            base_stmt.c.label_count,
            base_stmt.c.score_count,
            base_stmt.c.score_sum,
            (
                base_stmt.c.label_count
                * 1.0
                / func.sum(base_stmt.c.label_count).over(
                    partition_by=[base_stmt.c.span_id, base_stmt.c.name]
                )
            ).label("label_fraction"),
        ).subquery()

        final_stmt = (
            select(
                per_span_stmt.c.name,
                per_span_stmt.c.label,
                func.avg(per_span_stmt.c.label_fraction).label("avg_label_fraction"),
                func.sum(per_span_stmt.c.record_count).label("record_count"),
                func.sum(per_span_stmt.c.score_count).label("score_count"),
                func.sum(per_span_stmt.c.score_sum).label("score_sum"),
            )
            .group_by(per_span_stmt.c.name, per_span_stmt.c.label)
            .order_by(per_span_stmt.c.name, per_span_stmt.c.label)
        )
        return final_stmt

    elif kind == "trace":
        mta = models.TraceAnnotation
        name_column = mta.name
        label_column = mta.label
        score_column = mta.score
        trace_id_column = models.Trace.id.label("trace_id")
        time_column = models.Trace.start_time

        base_stmt = (
            select(
                trace_id_column,
                name_column,
                label_column,
                func.count().label("record_count"),
                func.count(label_column).label("label_count"),
                func.count(score_column).label("score_count"),
                func.sum(score_column).label("score_sum"),
            )
            .join(models.Trace)
            .where(models.Trace.project_rowid == project_rowid)
            .where(or_(score_column.is_not(None), label_column.is_not(None)))
            .where(name_column.in_(annotation_names))
        )
        if start_time:
            base_stmt = base_stmt.where(start_time <= time_column)
        if end_time:
            base_stmt = base_stmt.where(time_column < end_time)
        base_stmt = base_stmt.group_by(trace_id_column, name_column, label_column)
        base_stmt = base_stmt.order_by(name_column, label_column)

        per_trace_stmt = select(
            base_stmt.c.trace_id,
            base_stmt.c.name,
            base_stmt.c.label,
            base_stmt.c.record_count,
            base_stmt.c.label_count,
            base_stmt.c.score_count,
            base_stmt.c.score_sum,
            (
                base_stmt.c.label_count
                * 1.0
                / func.sum(base_stmt.c.label_count).over(
                    partition_by=[base_stmt.c.trace_id, base_stmt.c.name]
                )
            ).label("label_fraction"),
        ).subquery()

        final_stmt = (
            select(
                per_trace_stmt.c.name,
                per_trace_stmt.c.label,
                func.avg(per_trace_stmt.c.label_fraction).label("avg_label_fraction"),
                func.sum(per_trace_stmt.c.record_count).label("record_count"),
                func.sum(per_trace_stmt.c.score_count).label("score_count"),
                func.sum(per_trace_stmt.c.score_sum).label("score_sum"),
            )
            .group_by(per_trace_stmt.c.name, per_trace_stmt.c.label)
            .order_by(per_trace_stmt.c.name, per_trace_stmt.c.label)
        )
        return final_stmt

    else:
        assert_never(kind)
