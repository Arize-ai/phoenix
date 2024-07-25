from collections import defaultdict
from datetime import datetime
from typing import (
    Any,
    DefaultDict,
    List,
    Optional,
    Tuple,
)

import numpy as np
from aioitertools.itertools import groupby
from cachetools import LFUCache, TTLCache
from sqlalchemy import Select, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, num_docs_col
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.DocumentEvaluationSummary import DocumentEvaluationSummary
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanFilter

ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = Tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
EvalName: TypeAlias = str

Segment: TypeAlias = Tuple[ProjectRowId, TimeInterval, FilterCondition]
Param: TypeAlias = EvalName

Key: TypeAlias = Tuple[ProjectRowId, Optional[TimeRange], FilterCondition, EvalName]
Result: TypeAlias = Optional[DocumentEvaluationSummary]
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = None


def _cache_key_fn(key: Key) -> Tuple[Segment, Param]:
    project_rowid, time_range, filter_condition, eval_name = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (project_rowid, interval, filter_condition), eval_name


_Section: TypeAlias = Tuple[ProjectRowId, EvalName]
_SubKey: TypeAlias = Tuple[TimeInterval, FilterCondition]


class DocumentEvaluationSummaryCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    def __init__(self) -> None:
        super().__init__(
            # TTL=3600 (1-hour) because time intervals are always moving forward, but
            # interval endpoints are rounded down to the hour by the UI, so anything
            # older than an hour most likely won't be a cache-hit anyway.
            main_cache=TTLCache(maxsize=64 * 32, ttl=3600),
            sub_cache_factory=lambda: LFUCache(maxsize=2 * 2),
        )

    def invalidate_project(self, project_rowid: ProjectRowId) -> None:
        for section in self._cache.keys():
            if section[0] == project_rowid:
                del self._cache[section]

    def _cache_key(self, key: Key) -> Tuple[_Section, _SubKey]:
        (project_rowid, interval, filter_condition), eval_name = _cache_key_fn(key)
        return (project_rowid, eval_name), (interval, filter_condition)


class DocumentEvaluationSummaryDataLoader(DataLoader[Key, Result]):
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

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        results: List[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: DefaultDict[
            Segment,
            DefaultDict[Param, List[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, param = _cache_key_fn(key)
            arguments[segment][param].append(position)
        for segment, params in arguments.items():
            async with self._db() as session:
                dialect = SupportedSQLDialect(session.bind.dialect.name)
                stmt = _get_stmt(dialect, segment, *params.keys())
                data = await session.stream(stmt)
                async for eval_name, group in groupby(data, lambda d: d.name):
                    metrics_collection = []
                    async for (_, num_docs), subgroup in groupby(
                        group, lambda g: (g.id, g.num_docs)
                    ):
                        scores = [np.nan] * num_docs
                        for row in subgroup:
                            scores[row.document_position] = row.score
                        metrics_collection.append(RetrievalMetrics(scores))
                    summary = DocumentEvaluationSummary(
                        evaluation_name=eval_name,
                        metrics_collection=metrics_collection,
                    )
                    for position in params[eval_name]:
                        results[position] = summary
        return results


def _get_stmt(
    dialect: SupportedSQLDialect,
    segment: Segment,
    *eval_names: Param,
) -> Select[Any]:
    project_rowid, (start_time, end_time), filter_condition = segment
    mda = models.DocumentAnnotation
    stmt = (
        select(
            mda.name,
            models.Span.id,
            num_docs_col(dialect),
            mda.score,
            mda.document_position,
        )
        .join(models.Trace)
        .where(models.Trace.project_rowid == project_rowid)
        .join(mda)
        .where(mda.name.in_(eval_names))
        .where(mda.annotator_kind == "LLM")
        .where(mda.score.is_not(None))
        .order_by(mda.name, models.Span.id)
    )
    if start_time:
        stmt = stmt.where(start_time <= models.Span.start_time)
    if end_time:
        stmt = stmt.where(models.Span.start_time < end_time)
    if filter_condition:
        span_filter = SpanFilter(condition=filter_condition)
        stmt = span_filter(stmt)
    return stmt
