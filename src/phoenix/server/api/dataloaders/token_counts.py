from collections import defaultdict
from datetime import datetime
from typing import (
    Any,
    AsyncContextManager,
    Callable,
    DefaultDict,
    List,
    Literal,
    Optional,
    Tuple,
)

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.trace.dsl import SpanFilter

Kind: TypeAlias = Literal["prompt", "completion", "total"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = Tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
TokenCount: TypeAlias = int

Segment: TypeAlias = Tuple[TimeInterval, FilterCondition]
Param: TypeAlias = Tuple[ProjectRowId, Kind]

Key: TypeAlias = Tuple[Kind, ProjectRowId, Optional[TimeRange], FilterCondition]
Result: TypeAlias = TokenCount
ResultPosition: TypeAlias = int
DEFAULT_VALUE = 0


class TokenCountDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn, cache_key_fn=self._cache_key_fn)
        self._db = db

    @staticmethod
    def _cache_key_fn(key: Key) -> Tuple[Segment, Param]:
        kind, project_rowid, time_range, filter_condition = key
        interval = (
            (time_range.start, time_range.end)
            if isinstance(time_range, TimeRange)
            else (None, None)
        )
        return (interval, filter_condition), (project_rowid, kind)

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        results: List[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: DefaultDict[
            Segment,
            DefaultDict[Param, List[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, param = self._cache_key_fn(key)
            arguments[segment][param].append(position)
        async with self._db() as session:
            for segment, params in arguments.items():
                stmt = _get_stmt(segment, *params.keys())
                if not (data := await session.execute(stmt)):
                    continue
                for project_rowid, prompt, completion, total in data:
                    for position in params[(project_rowid, "prompt")]:
                        results[position] = prompt
                    for position in params[(project_rowid, "completion")]:
                        results[position] = completion
                    for position in params[(project_rowid, "total")]:
                        results[position] = total
        return results


def _get_stmt(
    segment: Segment,
    *params: Param,
) -> Select[Any]:
    (start_time, end_time), filter_condition = segment
    pid = models.Trace.project_rowid
    prompt = func.sum(models.Span.attributes[LLM_TOKEN_COUNT_PROMPT].as_float())
    completion = func.sum(models.Span.attributes[LLM_TOKEN_COUNT_COMPLETION].as_float())
    total = coalesce(prompt, 0) + coalesce(completion, 0)
    stmt: Select[Any] = (
        select(
            pid,
            prompt.label("prompt"),
            completion.label("completion"),
            total.label("total"),
        )
        .join(models.Span)
        .group_by(pid)
    )
    if start_time:
        stmt = stmt.where(models.Span.start_time >= start_time)
    if end_time:
        stmt = stmt.where(models.Span.end_time < end_time)
    if filter_condition:
        span_filter = SpanFilter(condition=filter_condition)
        stmt = span_filter(stmt)
    rowids = list(set(rowid for (rowid, _) in params))
    stmt = stmt.where(pid.in_(rowids))
    return stmt


LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT.split(".")
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION.split(".")
