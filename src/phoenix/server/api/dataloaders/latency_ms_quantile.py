from collections import defaultdict
from datetime import datetime
from typing import (
    Any,
    AsyncContextManager,
    AsyncIterator,
    Callable,
    DefaultDict,
    List,
    Literal,
    Mapping,
    Optional,
    Tuple,
    cast,
)

from cachetools import LFUCache, TTLCache
from sqlalchemy import (
    ARRAY,
    Float,
    Integer,
    Select,
    SQLColumnExpression,
    Values,
    column,
    func,
    select,
    values,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import percentile_cont
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.dataloaders.cache import TwoTierCache
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.trace.dsl import SpanFilter

Kind: TypeAlias = Literal["span", "trace"]
ProjectRowId: TypeAlias = int
TimeInterval: TypeAlias = Tuple[Optional[datetime], Optional[datetime]]
FilterCondition: TypeAlias = Optional[str]
Probability: TypeAlias = float
QuantileValue: TypeAlias = float

Segment: TypeAlias = Tuple[Kind, TimeInterval, FilterCondition]
Param: TypeAlias = Tuple[ProjectRowId, Probability]

Key: TypeAlias = Tuple[Kind, ProjectRowId, Optional[TimeRange], FilterCondition, Probability]
Result: TypeAlias = Optional[QuantileValue]
ResultPosition: TypeAlias = int
DEFAULT_VALUE: Result = None

FloatCol: TypeAlias = SQLColumnExpression[Float[float]]


def _cache_key_fn(key: Key) -> Tuple[Segment, Param]:
    kind, project_rowid, time_range, filter_condition, probability = key
    interval = (
        (time_range.start, time_range.end) if isinstance(time_range, TimeRange) else (None, None)
    )
    return (kind, interval, filter_condition), (project_rowid, probability)


_Section: TypeAlias = ProjectRowId
_SubKey: TypeAlias = Tuple[TimeInterval, FilterCondition, Kind, Probability]


class LatencyMsQuantileCache(
    TwoTierCache[Key, Result, _Section, _SubKey],
):
    def __init__(self) -> None:
        super().__init__(
            # TTL=3600 (1-hour) because time intervals are always moving forward, but
            # interval endpoints are rounded down to the hour by the UI, so anything
            # older than an hour most likely won't be a cache-hit anyway.
            main_cache=TTLCache(maxsize=64, ttl=3600),
            sub_cache_factory=lambda: LFUCache(maxsize=2 * 2 * 2 * 16),
        )

    def _cache_key(self, key: Key) -> Tuple[_Section, _SubKey]:
        (kind, interval, filter_condition), (project_rowid, probability) = _cache_key_fn(key)
        return project_rowid, (interval, filter_condition, kind, probability)


class LatencyMsQuantileDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
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
        async with self._db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            for segment, params in arguments.items():
                async for position, quantile_value in _get_results(
                    dialect, session, segment, params
                ):
                    results[position] = quantile_value
        return results


async def _get_results(
    dialect: SupportedSQLDialect,
    session: AsyncSession,
    segment: Segment,
    params: Mapping[Param, List[ResultPosition]],
) -> AsyncIterator[Tuple[ResultPosition, QuantileValue]]:
    kind, (start_time, end_time), filter_condition = segment
    stmt = select(models.Trace.project_rowid)
    if kind == "trace":
        latency_column = cast(FloatCol, models.Trace.latency_ms)
        time_column = models.Trace.start_time
    elif kind == "span":
        latency_column = cast(FloatCol, models.Span.latency_ms)
        time_column = models.Span.start_time
        stmt = stmt.join(models.Span)
        if filter_condition:
            sf = SpanFilter(filter_condition)
            stmt = sf(stmt)
    else:
        assert_never(kind)
    if start_time:
        stmt = stmt.where(start_time <= time_column)
    if end_time:
        stmt = stmt.where(time_column < end_time)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        results = _get_results_postgresql(session, stmt, latency_column, params)
    elif dialect is SupportedSQLDialect.SQLITE:
        results = _get_results_sqlite(session, stmt, latency_column, params)
    else:
        assert_never(dialect)
    async for position, quantile_value in results:
        yield position, quantile_value


async def _get_results_sqlite(
    session: AsyncSession,
    base_stmt: Select[Any],
    latency_column: FloatCol,
    params: Mapping[Param, List[ResultPosition]],
) -> AsyncIterator[Tuple[ResultPosition, QuantileValue]]:
    projects_per_prob: DefaultDict[Probability, List[ProjectRowId]] = defaultdict(list)
    for project_rowid, probability in params.keys():
        projects_per_prob[probability].append(project_rowid)
    pid = models.Trace.project_rowid
    for probability, project_rowids in projects_per_prob.items():
        pctl: FloatCol = func.percentile(latency_column, probability * 100)
        stmt = base_stmt.add_columns(pctl)
        stmt = stmt.where(pid.in_(project_rowids))
        stmt = stmt.group_by(pid)
        data = await session.stream(stmt)
        async for project_rowid, quantile_value in data:
            for position in params[(project_rowid, probability)]:
                yield position, quantile_value


async def _get_results_postgresql(
    session: AsyncSession,
    base_stmt: Select[Any],
    latency_column: FloatCol,
    params: Mapping[Param, List[ResultPosition]],
) -> AsyncIterator[Tuple[ResultPosition, QuantileValue]]:
    probs_per_project: DefaultDict[ProjectRowId, List[Probability]] = defaultdict(list)
    for project_rowid, probability in params.keys():
        probs_per_project[project_rowid].append(probability)
    pp: Values = values(
        column("project_rowid", Integer),
        column("probabilities", ARRAY(Float[float])),
        name="project_probabilities",
    ).data(probs_per_project.items())  # type: ignore
    pid = models.Trace.project_rowid
    pctl: FloatCol = percentile_cont(pp.c.probabilities).within_group(latency_column)
    stmt = base_stmt.add_columns(pp.c.probabilities, pctl)
    stmt = stmt.join(pp, pid == pp.c.project_rowid)
    stmt = stmt.group_by(pid, pp.c.probabilities)
    data = await session.stream(stmt)
    async for project_rowid, probabilities, quantile_values in data:
        for probability, quantile_value in zip(probabilities, quantile_values):
            for position in params[(project_rowid, probability)]:
                yield position, quantile_value
