import random
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

import pytest
from sqlalchemy import delete, func, select

from phoenix.db import models
from phoenix.server.api.dataloaders import CacheForDataLoaders, build_data_loaders
from phoenix.server.api.dataloaders.annotation_score_metrics import (
    AnnotationScoreMetricsCache,
    AnnotationScoreMetricsDataLoader,
    Key,
    Kind,
    SeriesBin,
)
from phoenix.server.api.dataloaders.annotation_summaries import AnnotationSummaryDataLoader
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.dml_event import (
    DmlEvent,
    SpanAnnotationDeleteEvent,
    SpanAnnotationInsertEvent,
    SpanDeleteEvent,
)
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.types import DbSessionFactory, LastUpdatedAt

from ...._helpers import _add_project, _add_span, _add_trace
from .annotation_mean_score_time_series import AnnotationMeanScoreTimeSeriesDataLoader

_DAY0 = datetime(2026, 3, 1, tzinfo=timezone.utc)
_NAMES = ("quality", "verdict", "tone")
_LABELS = ("good", "bad", "Neutral", "n/a")


async def _seed(db: DbSessionFactory, seed: int) -> int:
    """Ten days of traces, spans and sessions with random results under three names, in
    two projects that share the names: scores with and without labels, labels without
    scores, repeated results on one entity (repeated and different labels), and rows with
    neither, which every statement drops. Spans start after their trace, sometimes in the
    next bin or window.

    In the first project, whose id is returned, each window also gets entities exactly on
    its edges and a microsecond either side, a span that starts at or after the window's
    end under a trace that starts inside it (in the series, not the summary), a span that
    starts inside it under a trace that starts before it (in the summary, not the series),
    and a session that ends before it starts, which nothing prevents on ingest.
    """
    rng = random.Random(seed)

    def result() -> tuple[Optional[str], Optional[float]]:
        kind = rng.random()
        if kind < 0.35:
            return rng.choice(_LABELS), round(rng.uniform(0, 1), 3)
        if kind < 0.65:
            return None, round(rng.uniform(-1, 2), 3)
        if kind < 0.95:
            return rng.choice(_LABELS), None
        return None, None

    def results() -> list[tuple[str, Optional[str], Optional[float]]]:
        out = []
        for name in _NAMES:
            for _ in range(rng.choice((0, 1, 1, 1, 2, 3))):
                out.append((name, *result()))
        return out

    def fixed_results() -> list[tuple[str, Optional[str], Optional[float]]]:
        return [(name, "good", 0.5) for name in _NAMES] + [(_NAMES[0], "bad", None)]

    def annotation_fields(label: Optional[str], score: Optional[float]) -> dict[str, Any]:
        return dict(
            label=label,
            score=score,
            explanation=None,
            metadata_={},
            annotator_kind="LLM",
            source="API",
            identifier=token_hex(4),
        )

    async with db() as session:

        async def add_session(
            project: models.Project, start: datetime, end: datetime, fixed: bool = False
        ) -> models.ProjectSession:
            project_session = models.ProjectSession(
                session_id=token_hex(4), project_id=project.id, start_time=start, end_time=end
            )
            session.add(project_session)
            await session.flush()
            for name, label, score in fixed_results() if fixed else results():
                session.add(
                    models.ProjectSessionAnnotation(
                        project_session_id=project_session.id,
                        name=name,
                        **annotation_fields(label, score),
                    )
                )
            return project_session

        async def add_trace(
            project: models.Project,
            project_session: models.ProjectSession,
            start: datetime,
            fixed: bool = False,
        ) -> models.Trace:
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=project.id,
                project_session_rowid=project_session.id,
                start_time=start,
                end_time=start + timedelta(hours=3),
            )
            session.add(trace)
            await session.flush()
            for name, label, score in fixed_results() if fixed else results():
                session.add(
                    models.TraceAnnotation(
                        trace_rowid=trace.id, name=name, **annotation_fields(label, score)
                    )
                )
            return trace

        async def add_span(trace: models.Trace, start: datetime, fixed: bool = False) -> None:
            span = models.Span(
                trace_rowid=trace.id,
                span_id=token_hex(8),
                parent_id=None,
                name="span",
                span_kind="LLM",
                start_time=start,
                end_time=start + timedelta(seconds=1),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.flush()
            for name, label, score in fixed_results() if fixed else results():
                session.add(
                    models.SpanAnnotation(
                        span_rowid=span.id, name=name, **annotation_fields(label, score)
                    )
                )

        projects = [models.Project(name=token_hex(4)) for _ in range(2)]
        session.add_all(projects)
        await session.flush()
        for project in projects:
            for _ in range(60):
                start = _DAY0 + timedelta(minutes=rng.randrange(0, 10 * 24 * 60))
                end = start + timedelta(minutes=rng.choice((0, 30, 600, 2000)))
                project_session = await add_session(project, start, end)
                for _ in range(rng.choice((1, 2, 3))):
                    trace_start = start + timedelta(minutes=rng.randrange(0, 600))
                    trace = await add_trace(project, project_session, trace_start)
                    for _ in range(rng.choice((1, 2, 3))):
                        offset = timedelta(minutes=rng.choice((0, 5, 50, 170)))
                        await add_span(trace, trace_start + offset)

        project = projects[0]
        minute, microsecond = timedelta(minutes=1), timedelta(microseconds=1)
        edges = {edge for window in _WINDOWS for edge in window if edge is not None}
        for edge in sorted(edges):
            for at in (edge - microsecond, edge, edge + microsecond):
                project_session = await add_session(project, at, at, fixed=True)
                trace = await add_trace(project, project_session, at, fixed=True)
                await add_span(trace, at, fixed=True)
        for window_start, window_end in _WINDOWS:
            project_session = await add_session(
                project, window_start + timedelta(hours=1), window_start - timedelta(hours=1)
            )
            trace = await add_trace(project, project_session, window_start - minute)
            await add_span(trace, window_start + minute, fixed=True)
            if window_end is not None:
                trace = await add_trace(project, project_session, window_end - minute)
                await add_span(trace, window_end, fixed=True)
                await add_span(trace, window_end + minute, fixed=True)
        await session.flush()
        return project.id


def _same(value: Optional[float]) -> Any:
    # The one scan adds the same per-entity values as the summary and series statements,
    # in another order, and PostgreSQL fixes neither order, so means can differ in the last
    # digits. The bound holds for this data's scores, three decimals between -1 and 2 (at
    # most 2e-15 relative here, 2e-14 on a seeded project with 30 evaluators), not for any
    # scores: the difference grows with the scores' magnitudes rather than with their mean,
    # so scores that cancel, such as 1e16, 1 and -1e16, can move a mean outright.
    return None if value is None else pytest.approx(value, rel=1e-13, abs=1e-15)


def _summary_fields(summary: Any) -> Any:
    if summary is None:
        return None
    return {
        "count": summary.count(),
        "labels": summary.labels(),
        "label_fractions": [
            (fraction.label, _same(fraction.fraction)) for fraction in summary.label_fractions()
        ],
        "mean_score": _same(summary.mean_score()),
        "score_count": summary.score_count(),
        "label_count": summary.label_count(),
    }


def _bin_fields(series_bin: SeriesBin) -> Any:
    return (
        _same(series_bin.mean_score),
        series_bin.scored_entity_count,
        series_bin.result_entity_count,
        [(label, _same(fraction)) for label, fraction in series_bin.label_fractions],
    )


_WINDOWS: list[tuple[datetime, Optional[datetime]]] = [
    (_DAY0 + timedelta(days=5), _DAY0 + timedelta(days=8)),
    # an open-ended window from an unaligned start, as a live window up to now
    (_DAY0 + timedelta(days=6, hours=13, minutes=37), None),
    (_DAY0 + timedelta(days=1), _DAY0 + timedelta(days=4)),
    # every result
    (_DAY0 - timedelta(days=1), None),
]

_BINS = [
    TimeBucketSpec(unit="day", utc_offset_minutes=-300),
    TimeBucketSpec(unit="day", utc_offset_minutes=330),
    TimeBucketSpec(unit="hour", units_per_bin=6, utc_offset_minutes=-210),
    TimeBucketSpec(unit="week", utc_offset_minutes=0),
]


@pytest.mark.parametrize("seed", [1, 2])
async def test_matches_the_summary_and_series_statements(db: DbSessionFactory, seed: int) -> None:
    """The one-scan loader returns what the summary loader gives for the window and the
    series loader gives for each bin, for every kind, window, binning and name: counts
    and labels exactly, means and label fractions to within `_same`'s bound."""
    project_rowid = await _seed(db, seed)
    kinds: tuple[Kind, ...] = ("span", "trace", "session")
    for kind in kinds:
        for window in _WINDOWS:
            for time_bins in _BINS:
                keys: list[Key] = [
                    (kind, project_rowid, window, time_bins, name) for name in _NAMES
                ]
                new = await AnnotationScoreMetricsDataLoader(db).load_many(keys)
                summaries = AnnotationSummaryDataLoader(db)
                series = AnnotationMeanScoreTimeSeriesDataLoader(db)
                for name, metrics in zip(_NAMES, new):
                    case = (kind, window, time_bins, name)
                    summary = await summaries.load(
                        (
                            kind,
                            project_rowid,
                            TimeRange(start=window[0], end=window[1]),
                            None,
                            None,
                            name,
                        )
                    )
                    bins = await series.load((kind, project_rowid, window, time_bins, name))
                    assert _summary_fields(metrics.summary) == _summary_fields(summary), case
                    assert list(metrics.series) == sorted(bins), case
                    assert [_bin_fields(metrics.series[bucket]) for bucket in metrics.series] == [
                        _bin_fields(bins[bucket]) for bucket in sorted(bins)
                    ], case


async def test_seeded_spans_straddle_and_precede_the_windows(db: DbSessionFactory) -> None:
    """The comparison above covers the rows the one scan's span start bound touches: in
    the first three windows, spans that start before the window (which the bound leaves
    out, and neither statement counts) and spans that start in the window under a trace
    that starts before it (in the summary, not in the series)."""
    project_rowid = await _seed(db, 1)
    span_starts_before = trace_starts_before = 0
    async with db() as session:
        for start, _ in _WINDOWS[:3]:
            before, straddling = (
                await session.execute(
                    select(
                        func.count().filter(models.Span.start_time < start),
                        func.count().filter(
                            models.Trace.start_time < start, start <= models.Span.start_time
                        ),
                    )
                    .select_from(models.SpanAnnotation)
                    .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .where(models.Trace.project_rowid == project_rowid)
                )
            ).one()
            span_starts_before += before
            trace_starts_before += straddling
    assert span_starts_before > 0
    assert trace_starts_before > 0


async def test_names_without_results_have_no_summaries_or_bins(db: DbSessionFactory) -> None:
    project_rowid = await _seed(db, 3)
    metrics = await AnnotationScoreMetricsDataLoader(db).load(
        ("span", project_rowid, (_DAY0, None), TimeBucketSpec(unit="day"), "absent")
    )
    assert metrics.summary is None
    assert metrics.series == {}


def test_cache_sections_match_the_annotation_summary_cache() -> None:
    cache = AnnotationScoreMetricsCache()
    window = (_DAY0, None)
    key: Key = ("span", 1, window, TimeBucketSpec(unit="day"), "quality")
    other: Key = ("span", 1, window, TimeBucketSpec(unit="day"), "tone")
    for k in (key, other):
        cache.set(k, object())  # type: ignore[arg-type]
    cache.invalidate((1, "quality", "span"))
    assert cache.get(key) is None
    assert cache.get(other) is not None
    cache.invalidate_project(1)
    assert cache.get(other) is None


def _span_annotation(
    span_rowid: int, label: Optional[str], score: Optional[float]
) -> models.SpanAnnotation:
    return models.SpanAnnotation(
        span_rowid=span_rowid,
        name="quality",
        label=label,
        score=score,
        explanation=None,
        metadata_={},
        annotator_kind="CODE",
        source="API",
        identifier=token_hex(4),
    )


async def test_annotation_events_refresh_the_cached_series(db: DbSessionFactory) -> None:
    """The cache that `build_data_loaders` wires in serves repeat loads, and the DML events
    for annotation writes, annotation deletes and span deletes clear it."""
    async with db() as session:
        project = await _add_project(session)
        span_rowids = []
        for hour in (1, 2):
            trace = await _add_trace(session, project, start_time=_DAY0 + timedelta(hours=hour))
            span = await _add_span(session, trace, start_time=_DAY0 + timedelta(hours=hour))
            span_rowids.append(span.id)
        session.add(_span_annotation(span_rowids[0], None, 1.0))
        await session.flush()
    key: Key = ("span", project.id, (_DAY0, None), TimeBucketSpec(unit="day"), "quality")
    cache = CacheForDataLoaders()

    async def load() -> Any:
        # A new set of loaders per call, as each request gets, so only the shared
        # cache can carry a result from one load to the next.
        return (await build_data_loaders(db, cache).annotation_score_metrics.load(key)).series

    handler = DmlEventHandler(db=db, last_updated_at=LastUpdatedAt(), cache_for_dataloaders=cache)

    async def handle(event: DmlEvent) -> None:
        # One pass of each handler's daemon loop, run inline
        handler.put(event)
        for batched in handler._all_handlers:
            if not batched._batch.empty:
                await batched()
                batched._batch.clear()

    assert await load() == {_DAY0: SeriesBin(1.0, 1, 1)}
    async with db() as session:
        written = _span_annotation(span_rowids[1], None, 0.0)
        session.add(written)
        await session.flush()
    # Served from the cache until an event says the annotations changed.
    assert await load() == {_DAY0: SeriesBin(1.0, 1, 1)}

    await handle(SpanAnnotationInsertEvent((written.id,)))
    assert await load() == {_DAY0: SeriesBin(0.5, 2, 2)}

    async with db() as session:
        await session.execute(
            delete(models.SpanAnnotation).where(models.SpanAnnotation.id == written.id)
        )
    # Still the cached series until the delete event arrives
    assert await load() == {_DAY0: SeriesBin(0.5, 2, 2)}
    await handle(SpanAnnotationDeleteEvent((written.id,)))
    assert await load() == {_DAY0: SeriesBin(1.0, 1, 1)}

    # A label write lands in the cached fractions the same way.
    async with db() as session:
        labeled = _span_annotation(span_rowids[1], "good", None)
        session.add(labeled)
        await session.flush()
    assert await load() == {_DAY0: SeriesBin(1.0, 1, 1)}
    await handle(SpanAnnotationInsertEvent((labeled.id,)))
    assert await load() == {_DAY0: SeriesBin(1.0, 1, 2, (("good", 0.5),))}

    assert cache.annotation_score_metrics.get(key) is not None
    await handle(SpanDeleteEvent((project.id,)))
    assert cache.annotation_score_metrics.get(key) is None
