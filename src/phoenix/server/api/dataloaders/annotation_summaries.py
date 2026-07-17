from collections import defaultdict
from datetime import datetime
from typing import Any, Literal, Optional, Type, Union

import pandas as pd
from aioitertools.itertools import groupby
from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, and_, case, distinct, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.session_filters import get_filtered_session_rowids_subquery
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter

Kind: TypeAlias = Literal["span", "trace", "session"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
SessionFilterCondition: TypeAlias = Optional[str]
# Rowid of a single session to scope the summary to, used when the sessions
# table search resolves to an exact session-ID match.
SessionRowId: TypeAlias = Optional[int]
AnnotationName: TypeAlias = str

Segment: TypeAlias = tuple[
    Kind,
    ProjectRowId,
    TimeInterval,
    FilterCondition,
    SessionFilterCondition,
    SessionRowId,
]
Param: TypeAlias = AnnotationName

Key: TypeAlias = tuple[
    Kind,
    ProjectRowId,
    Optional[TimeRange],
    FilterCondition,
    SessionFilterCondition,
    SessionRowId,
    AnnotationName,
]
Result: TypeAlias = Optional[AnnotationSummary]
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = None


def _cache_key_fn(key: Key) -> tuple[Segment, Param]:
    (
        kind,
        project_rowid,
        time_range,
        filter_condition,
        session_filter_condition,
        session_rowid,
        eval_name,
    ) = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (
        kind,
        project_rowid,
        interval,
        filter_condition,
        session_filter_condition,
        session_rowid,
    ), eval_name


_Section: TypeAlias = tuple[ProjectRowId, AnnotationName, Kind]
_SubKey: TypeAlias = tuple[TimeInterval, FilterCondition, SessionFilterCondition, SessionRowId]


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
        (
            (
                kind,
                project_rowid,
                interval,
                filter_condition,
                session_filter_condition,
                session_rowid,
            ),
            annotation_name,
        ) = _cache_key_fn(key)
        return (project_rowid, annotation_name, kind), (
            interval,
            filter_condition,
            session_filter_condition,
            session_rowid,
        )


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
            async with self._db.read() as session:
                data = await session.stream(stmt)
                async for annotation_name, group in groupby(data, lambda row: row.name):
                    summary = AnnotationSummary(name=annotation_name, df=pd.DataFrame(group))
                    for position in params[annotation_name]:
                        results[position] = summary
        return results


def _get_stmt(
    segment: Segment,
    *annotation_names: Param,
) -> Select[Any]:
    (
        kind,
        project_rowid,
        (start_time, end_time),
        filter_condition,
        session_filter_condition,
        session_rowid,
    ) = segment

    annotation_model: Union[
        Type[models.SpanAnnotation],
        Type[models.TraceAnnotation],
        Type[models.ProjectSessionAnnotation],
    ]
    entity_model: Union[Type[models.Span], Type[models.Trace], Type[models.ProjectSession]]
    entity_join_model: Optional[Type[models.Base]]
    entity_id_column: Any
    # The column holding the session rowid, used when a session filter narrows
    # the summary to sessions whose root span input/output matches a substring.
    session_rowid_column: Any
    # The column holding the project rowid, used to scope the (possibly
    # joined) entity rows to a project.
    project_rowid_column: InstrumentedAttribute[int]

    if kind == "span":
        annotation_model = models.SpanAnnotation
        entity_model = models.Span
        entity_join_model = models.Trace
        entity_id_column = models.Span.id.label("entity_id")
        session_rowid_column = models.Trace.project_session_rowid
        project_rowid_column = models.Trace.project_rowid
    elif kind == "trace":
        annotation_model = models.TraceAnnotation
        entity_model = models.Trace
        entity_join_model = None
        entity_id_column = models.Trace.id.label("entity_id")
        session_rowid_column = models.Trace.project_session_rowid
        project_rowid_column = models.Trace.project_rowid
    elif kind == "session":
        annotation_model = models.ProjectSessionAnnotation
        entity_model = models.ProjectSession
        entity_join_model = None
        entity_id_column = models.ProjectSession.id.label("entity_id")
        session_rowid_column = models.ProjectSession.id
        project_rowid_column = models.ProjectSession.project_id
    else:
        assert_never(kind)

    name_column = annotation_model.name
    label_column = annotation_model.label
    score_column = annotation_model.score

    # Time-range filters, applied to both queries below. Sessions use
    # interval-overlap semantics, matching the sessions table: a session is
    # included iff [start_time, end_time] intersects [start, end).
    time_range_conditions = []
    if kind == "session":
        if start_time:
            time_range_conditions.append(start_time <= models.ProjectSession.end_time)
        if end_time:
            time_range_conditions.append(models.ProjectSession.start_time < end_time)
    else:
        time_column = entity_model.start_time
        if start_time:
            time_range_conditions.append(start_time <= time_column)
        if end_time:
            time_range_conditions.append(time_column < end_time)

    # First query: count distinct entities per annotation name
    # This is used later to calculate accurate fractions that account for entities without labels
    entity_count_query = select(
        name_column, func.count(distinct(entity_id_column)).label("entity_count")
    )

    entity_count_query = entity_count_query.join(entity_model)
    if entity_join_model is not None:
        entity_count_query = entity_count_query.join_from(entity_model, entity_join_model)
    entity_count_query = entity_count_query.where(project_rowid_column == project_rowid)

    if session_filter_condition:
        filtered_session_rowids = get_filtered_session_rowids_subquery(
            session_filter_condition=session_filter_condition,
            project_rowids=[project_rowid],
            start_time=start_time,
            end_time=end_time,
        )
        entity_count_query = entity_count_query.where(
            session_rowid_column.in_(filtered_session_rowids)
        )
    if session_rowid is not None:
        entity_count_query = entity_count_query.where(session_rowid_column == session_rowid)

    entity_count_query = entity_count_query.where(
        or_(score_column.is_not(None), label_column.is_not(None))
    )
    entity_count_query = entity_count_query.where(name_column.in_(annotation_names))
    entity_count_query = entity_count_query.where(*time_range_conditions)

    entity_count_query = entity_count_query.group_by(name_column)
    entity_count_subquery = entity_count_query.subquery()

    # Main query: gets raw annotation data with counts per (span/trace)+name+label
    base_stmt = select(
        entity_id_column,
        name_column,
        label_column,
        func.count().label("record_count"),
        func.count(label_column).label("label_count"),
        func.count(score_column).label("score_count"),
        func.sum(score_column).label("score_sum"),
    )

    base_stmt = base_stmt.join(entity_model)
    if entity_join_model is not None:
        base_stmt = base_stmt.join_from(entity_model, entity_join_model)
    base_stmt = base_stmt.where(project_rowid_column == project_rowid)
    if kind == "span" and filter_condition:
        sf = SpanFilter(filter_condition)
        base_stmt = sf(base_stmt)

    if session_filter_condition:
        filtered_session_rowids = get_filtered_session_rowids_subquery(
            session_filter_condition=session_filter_condition,
            project_rowids=[project_rowid],
            start_time=start_time,
            end_time=end_time,
        )
        base_stmt = base_stmt.where(session_rowid_column.in_(filtered_session_rowids))
    if session_rowid is not None:
        base_stmt = base_stmt.where(session_rowid_column == session_rowid)

    base_stmt = base_stmt.where(or_(score_column.is_not(None), label_column.is_not(None)))
    base_stmt = base_stmt.where(name_column.in_(annotation_names))
    base_stmt = base_stmt.where(*time_range_conditions)

    # Group to get one row per (span/trace)+name+label combination
    base_stmt = base_stmt.group_by(entity_id_column, name_column, label_column)

    base_subquery = base_stmt.subquery()

    # Calculate total counts per (span/trace)+name for computing fractions
    entity_totals = (
        select(
            base_subquery.c.entity_id,
            base_subquery.c.name,
            func.sum(base_subquery.c.label_count).label("total_label_count"),
            func.sum(base_subquery.c.score_count).label("total_score_count"),
            func.sum(base_subquery.c.score_sum).label("entity_score_sum"),
        )
        .group_by(base_subquery.c.entity_id, base_subquery.c.name)
        .subquery()
    )

    per_entity_fractions = (
        select(
            base_subquery.c.entity_id,
            base_subquery.c.name,
            base_subquery.c.label,
            base_subquery.c.record_count,
            base_subquery.c.label_count,
            base_subquery.c.score_count,
            base_subquery.c.score_sum,
            # Calculate label fraction, avoiding division by zero when total_label_count is 0
            case(
                (
                    entity_totals.c.total_label_count > 0,
                    base_subquery.c.label_count * 1.0 / entity_totals.c.total_label_count,
                ),
                else_=None,
            ).label("label_fraction"),
            # Calculate average score for the entity (if there are any scores)
            case(
                (
                    entity_totals.c.total_score_count > 0,
                    entity_totals.c.entity_score_sum * 1.0 / entity_totals.c.total_score_count,
                ),
                else_=None,
            ).label("entity_avg_score"),
        )
        .join(
            entity_totals,
            and_(
                base_subquery.c.entity_id == entity_totals.c.entity_id,
                base_subquery.c.name == entity_totals.c.name,
            ),
        )
        .subquery()
    )

    # Aggregate metrics across (spans/traces) for each name+label combination.
    label_entity_metrics = (
        select(
            per_entity_fractions.c.name,
            per_entity_fractions.c.label,
            func.count(distinct(per_entity_fractions.c.entity_id)).label("entities_with_label"),
            func.sum(per_entity_fractions.c.label_count).label("total_label_count"),
            func.sum(per_entity_fractions.c.score_count).label("total_score_count"),
            func.sum(per_entity_fractions.c.score_sum).label("total_score_sum"),
            # Average of label fractions for entities that have this label
            func.avg(per_entity_fractions.c.label_fraction).label("avg_label_fraction_present"),
            # Average of per-entity average scores (but we handle overall aggregation separately)
        )
        .group_by(per_entity_fractions.c.name, per_entity_fractions.c.label)
        .subquery()
    )

    # Compute distinct per-entity average scores to ensure each entity counts only once.
    distinct_entity_scores = (
        select(
            per_entity_fractions.c.entity_id,
            per_entity_fractions.c.name,
            per_entity_fractions.c.entity_avg_score,
        )
        .distinct()
        .subquery()
    )

    overall_score_aggregates = (
        select(
            distinct_entity_scores.c.name,
            func.avg(distinct_entity_scores.c.entity_avg_score).label("overall_avg_score"),
        )
        .group_by(distinct_entity_scores.c.name)
        .subquery()
    )

    # Final result: adjust label fractions by the proportion of entities reporting this label
    # and include the overall average score per annotation name.
    final_stmt = (
        select(
            label_entity_metrics.c.name,
            label_entity_metrics.c.label,
            # Adjust label fraction, guarding against division by zero in entity_count
            case(
                (
                    entity_count_subquery.c.entity_count > 0,
                    label_entity_metrics.c.avg_label_fraction_present
                    * label_entity_metrics.c.entities_with_label
                    / entity_count_subquery.c.entity_count,
                ),
                else_=None,
            ).label("avg_label_fraction"),
            overall_score_aggregates.c.overall_avg_score.label("avg_score"),  # same for all labels
            label_entity_metrics.c.total_label_count.label("label_count"),
            label_entity_metrics.c.total_score_count.label("score_count"),
            label_entity_metrics.c.total_score_sum.label("score_sum"),
            label_entity_metrics.c.entities_with_label.label("record_count"),
        )
        .join(entity_count_subquery, label_entity_metrics.c.name == entity_count_subquery.c.name)
        .join(
            overall_score_aggregates,
            label_entity_metrics.c.name == overall_score_aggregates.c.name,
        )
        .order_by(label_entity_metrics.c.name, label_entity_metrics.c.label)
    )

    return final_stmt
