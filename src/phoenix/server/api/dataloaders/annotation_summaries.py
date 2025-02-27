from collections import defaultdict
from datetime import datetime
from typing import Any, Literal, Optional, Type, Union, cast

import pandas as pd
from aioitertools.itertools import groupby
from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, and_, func, or_, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter

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

    annotation_model: Union[Type[models.SpanAnnotation], Type[models.TraceAnnotation]]
    entity_model: Union[Type[models.Span], Type[models.Trace]]
    entity_join_model: Optional[Type[models.Base]]
    entity_id_column: Any

    if kind == "span":
        annotation_model = models.SpanAnnotation
        entity_model = models.Span
        entity_join_model = models.Trace
        entity_id_column = models.Span.id.label("entity_id")
    elif kind == "trace":
        annotation_model = models.TraceAnnotation
        entity_model = models.Trace
        entity_join_model = None
        entity_id_column = models.Trace.id.label("entity_id")
    else:
        assert_never(kind)

    name_column = annotation_model.name
    label_column = annotation_model.label
    score_column = annotation_model.score
    time_column = entity_model.start_time

    base_stmt = select(
        entity_id_column,
        name_column,
        label_column,
        func.count().label("record_count"),
        func.count(label_column).label("label_count"),
        func.count(score_column).label("score_count"),
        func.sum(score_column).label("score_sum"),
    )

    if kind == "span":
        base_stmt = base_stmt.join(cast(Type[models.Span], entity_model))
        base_stmt = base_stmt.join_from(
            cast(Type[models.Span], entity_model), cast(Type[models.Trace], entity_join_model)
        )
        base_stmt = base_stmt.where(models.Trace.project_rowid == project_rowid)
        if filter_condition:
            sf = SpanFilter(filter_condition)
            base_stmt = sf(base_stmt)
    elif kind == "trace":
        base_stmt = base_stmt.join(cast(Type[models.Trace], entity_model))
        base_stmt = base_stmt.where(
            cast(Type[models.Trace], entity_model).project_rowid == project_rowid
        )
    else:
        assert_never(kind)

    base_stmt = base_stmt.where(or_(score_column.is_not(None), label_column.is_not(None)))
    base_stmt = base_stmt.where(name_column.in_(annotation_names))

    if start_time:
        base_stmt = base_stmt.where(start_time <= time_column)
    if end_time:
        base_stmt = base_stmt.where(time_column < end_time)

    base_stmt = base_stmt.group_by(entity_id_column, name_column, label_column)

    base_subquery = base_stmt.subquery()

    # Get total annotation count per entity and name
    total_counts = (
        select(
            base_subquery.c.entity_id,
            base_subquery.c.name,
            func.sum(base_subquery.c.label_count).label("total_label_count"),
        )
        .group_by(base_subquery.c.entity_id, base_subquery.c.name)
        .subquery()
    )

    # Get all distinct entity+name combinations in the dataset
    entity_name_pairs = (
        select(base_subquery.c.entity_id, base_subquery.c.name)
        .group_by(base_subquery.c.entity_id, base_subquery.c.name)
        .subquery()
    )

    # Get all distinct labels used for each annotation name
    all_labels = (
        select(base_subquery.c.name, base_subquery.c.label)
        .group_by(base_subquery.c.name, base_subquery.c.label)
        .subquery()
    )

    # Create a cartesian product of all entity+name pairs with all possible labels
    # This ensures we account for missing labels in some entities
    entity_name_label_combos = (
        select(entity_name_pairs.c.entity_id, entity_name_pairs.c.name, all_labels.c.label)
        .join(all_labels, entity_name_pairs.c.name == all_labels.c.name)
        .subquery()
    )

    # Left join with the actual data to get counts (or 0 for missing labels)
    complete_data = (
        select(
            entity_name_label_combos.c.entity_id,
            entity_name_label_combos.c.name,
            entity_name_label_combos.c.label,
            func.coalesce(base_subquery.c.label_count, 0).label("label_count"),
            func.coalesce(base_subquery.c.record_count, 0).label("record_count"),
            func.coalesce(base_subquery.c.score_count, 0).label("score_count"),
            func.coalesce(base_subquery.c.score_sum, 0).label("score_sum"),
        )
        .outerjoin(
            base_subquery,
            and_(
                entity_name_label_combos.c.entity_id == base_subquery.c.entity_id,
                entity_name_label_combos.c.name == base_subquery.c.name,
                entity_name_label_combos.c.label == base_subquery.c.label,
            ),
        )
        .subquery()
    )

    # Join with total counts to calculate fractions
    fractions = (
        select(
            complete_data.c.entity_id,
            complete_data.c.name,
            complete_data.c.label,
            complete_data.c.record_count,
            complete_data.c.label_count,
            complete_data.c.score_count,
            complete_data.c.score_sum,
            (complete_data.c.label_count * 1.0 / total_counts.c.total_label_count).label(
                "label_fraction"
            ),
        )
        .join(
            total_counts,
            and_(
                complete_data.c.entity_id == total_counts.c.entity_id,
                complete_data.c.name == total_counts.c.name,
            ),
        )
        .subquery()
    )

    final_stmt = (
        select(
            fractions.c.name,
            fractions.c.label,
            func.avg(fractions.c.label_fraction).label("avg_label_fraction"),
            func.sum(fractions.c.record_count).label("record_count"),
            func.sum(fractions.c.score_count).label("score_count"),
            func.sum(fractions.c.score_sum).label("score_sum"),
        )
        .group_by(fractions.c.name, fractions.c.label)
        .order_by(fractions.c.name, fractions.c.label)
    )

    return final_stmt
