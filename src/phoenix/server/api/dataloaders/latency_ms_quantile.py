from collections import defaultdict
from datetime import datetime
from typing import (
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

from sqlalchemy import (
    ARRAY,
    Float,
    Integer,
    SQLColumnExpression,
    Values,
    column,
    func,
    select,
    values,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import percentile_cont
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import POSTGRESQL, SQLITE, SUPPORTED_DIALECTS
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
DEFAULT_VALUE = None


class LatencyMsQuantileDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn, cache_key_fn=self._cache_key_fn)
        self._db = db

    @staticmethod
    def _cache_key_fn(key: Key) -> Tuple[Segment, Param]:
        kind, project_rowid, time_range, filter_condition, probability = key
        interval = (
            (time_range.start, time_range.end)
            if isinstance(time_range, TimeRange)
            else (None, None)
        )
        return (kind, interval, filter_condition), (project_rowid, probability)

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        results: List[Result] = [DEFAULT_VALUE] * len(keys)
        arguments: DefaultDict[
            Segment,
            DefaultDict[Param, List[ResultPosition]],
        ] = defaultdict(lambda: defaultdict(list))
        for position, key in enumerate(keys):
            segment, parameters = self._cache_key_fn(key)
            arguments[segment][parameters].append(position)
        async with self._db() as session:
            dialect = cast(SUPPORTED_DIALECTS, session.bind.dialect.name)
            for segment, parameters_positions in arguments.items():
                async for position, quantile_value in _get_results(
                    dialect, session, segment, parameters_positions
                ):
                    results[position] = quantile_value
        return results


async def _get_results(
    dialect: SUPPORTED_DIALECTS,
    session: AsyncSession,
    segment: Segment,
    params: Mapping[Param, List[ResultPosition]],
) -> AsyncIterator[Tuple[ResultPosition, QuantileValue]]:
    if dialect == POSTGRESQL:
        results = _get_results_postgresql(session, segment, params)
    elif dialect == SQLITE:
        results = _get_results_sqlite(session, segment, params)
    else:
        assert_never(dialect)
    async for position, quantile_value in results:
        yield position, quantile_value


async def _get_results_sqlite(
    session: AsyncSession,
    segment: Segment,
    params: Mapping[Param, List[ResultPosition]],
) -> AsyncIterator[Tuple[ResultPosition, QuantileValue]]:
    kind, (start_time, end_time), filter_condition = segment
    projects_per_prob: DefaultDict[Probability, List[ProjectRowId]] = defaultdict(list)
    for project_rowid, probability in params.keys():
        projects_per_prob[probability].append(project_rowid)
    for probability, project_rowids in projects_per_prob.items():
        if kind == "trace":
            pctl = func.percentile(models.Trace.latency_ms, probability * 100)
        elif kind == "span":
            pctl = func.percentile(models.Span.latency_ms, probability * 100)
        else:
            assert_never(kind)
        stmt = (
            select(
                models.Trace.project_rowid,
                pctl,
            )
            .where(models.Trace.project_rowid.in_(project_rowids))
            .group_by(models.Trace.project_rowid)
        )
        if kind == "trace":
            if start_time:
                stmt = stmt.where(start_time <= models.Trace.start_time)
            if end_time:
                stmt = stmt.where(models.Trace.start_time < end_time)
        elif kind == "span":
            stmt = stmt.join(models.Span)
            if start_time:
                stmt = stmt.where(start_time <= models.Span.start_time)
            if end_time:
                stmt = stmt.where(models.Span.start_time < end_time)
            if filter_condition:
                span_filter = SpanFilter(condition=filter_condition)
                stmt = span_filter(stmt)
        else:
            assert_never(kind)
        if not (data := await session.execute(stmt)):
            return
        for project_rowid, quantile_value in data:
            for position in params[(project_rowid, probability)]:
                yield position, quantile_value


async def _get_results_postgresql(
    session: AsyncSession,
    segment: Segment,
    params: Mapping[Param, List[ResultPosition]],
) -> AsyncIterator[Tuple[ResultPosition, QuantileValue]]:
    kind, (start_time, end_time), filter_condition = segment
    probs_per_project: DefaultDict[ProjectRowId, List[Probability]] = defaultdict(list)
    for project_rowid, probability in params.keys():
        probs_per_project[project_rowid].append(probability)
    pp: Values = values(
        column("project_rowid", Integer),
        column("probabilities", ARRAY(Float[float])),
        name="project_probabilities",
    ).data(
        (project_rowid, sorted(set(probabilities)))
        for project_rowid, probabilities in probs_per_project.items()
    )  # type: ignore
    pctl: SQLColumnExpression[Float[float]]
    if kind == "trace":
        pctl = percentile_cont(pp.c.probabilities).within_group(models.Trace.latency_ms)
    elif kind == "span":
        pctl = percentile_cont(pp.c.probabilities).within_group(models.Span.latency_ms)
    else:
        assert_never(kind)
    stmt = (
        select(
            models.Trace.project_rowid,
            pp.c.probabilities,
            pctl,
        )
        .join_from(
            pp,
            models.Trace,
            models.Trace.project_rowid == pp.c.project_rowid,
        )
        .group_by(models.Trace.project_rowid, pp.c.probabilities)
    )
    if kind == "trace":
        if start_time:
            stmt = stmt.where(start_time <= models.Trace.start_time)
        if end_time:
            stmt = stmt.where(models.Trace.start_time < end_time)
    elif kind == "span":
        stmt = stmt.join_from(models.Trace, models.Span, models.Span.trace_rowid == models.Trace.id)
        if start_time:
            stmt = stmt.where(start_time <= models.Span.start_time)
        if end_time:
            stmt = stmt.where(models.Span.start_time < end_time)
        if filter_condition:
            span_filter = SpanFilter(condition=filter_condition)
            stmt = span_filter(stmt)
    else:
        assert_never(kind)
    if not (data := await session.execute(stmt)):
        return
    for project_rowid, probabilities, quantile_values in data:
        for probability, quantile_value in zip(probabilities, quantile_values):
            for position in params[(project_rowid, probability)]:
                yield position, quantile_value
