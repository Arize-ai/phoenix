import asyncio
from asyncio import Future
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Literal, Optional

import pytest
from sqlalchemy import delete
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.annotation_metrics import build_entity_weighted_annotation_metrics_stmt
from phoenix.server.api.dataloaders import CacheForDataLoaders, build_data_loaders
from phoenix.server.api.dataloaders.annotation_mean_score_time_series import (
    AnnotationMeanScoreTimeSeriesCache,
    AnnotationMeanScoreTimeSeriesDataLoader,
    Key,
    MeanScoreBin,
    Result,
    _as_datetime,
)
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.dml_event import (
    DmlEvent,
    SpanAnnotationDeleteEvent,
    SpanAnnotationInsertEvent,
    SpanDeleteEvent,
)
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.types import DbSessionFactory, LastUpdatedAt

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace


def _key(
    kind: str = "span",
    project_rowid: int = 1,
    annotation_name: str = "quality",
    unit: str = "day",
    start_day: int = 0,
) -> Key:
    interval = (datetime(2024, 6, 10, tzinfo=timezone.utc) + timedelta(days=start_day), None)
    time_bins = TimeBucketSpec(unit=unit)  # type: ignore[arg-type]
    return (kind, project_rowid, interval, time_bins, annotation_name)  # type: ignore[return-value]


def _entry() -> "Future[Result]":
    # Created via the running loop: bare Future() requires a current event
    # loop, which pytest-xdist workers do not guarantee at import time.
    future = asyncio.get_running_loop().create_future()
    future.set_result({})
    return future


class TestAnnotationMeanScoreTimeSeriesCache:
    async def test_round_trips_by_full_key(self) -> None:
        cache = AnnotationMeanScoreTimeSeriesCache()
        entry = _entry()
        cache.set(_key(), entry)
        assert cache.get(_key()) is entry
        # A different bin scale is a different sub-key within the same section
        assert cache.get(_key(unit="hour")) is None

    async def test_invalidate_clears_one_annotation_kind_section(self) -> None:
        cache = AnnotationMeanScoreTimeSeriesCache()
        cache.set(_key(kind="span"), _entry())
        cache.set(_key(kind="trace"), _entry())
        cache.set(_key(annotation_name="other"), _entry())
        # The same section tuple the annotation DML handlers pass
        cache.invalidate((1, "quality", "span"))
        assert cache.get(_key(kind="span")) is None
        assert cache.get(_key(kind="trace")) is not None
        assert cache.get(_key(annotation_name="other")) is not None

    async def test_invalidate_project_clears_every_section_of_the_project(self) -> None:
        cache = AnnotationMeanScoreTimeSeriesCache()
        cache.set(_key(project_rowid=1), _entry())
        cache.set(_key(project_rowid=1, annotation_name="other"), _entry())
        cache.set(_key(project_rowid=2), _entry())
        cache.invalidate_project(1)
        assert cache.get(_key(project_rowid=1)) is None
        assert cache.get(_key(project_rowid=1, annotation_name="other")) is None
        assert cache.get(_key(project_rowid=2)) is not None

    async def test_evicts_the_least_recently_read_window(self) -> None:
        """A section keeps its eight most recently read windows. Under LFU the
        window read last would be the victim here, since the others were read
        more often."""
        cache = AnnotationMeanScoreTimeSeriesCache()
        for day in range(8):
            cache.set(_key(start_day=day), _entry())
        for _ in range(2):
            for day in range(1, 8):
                assert cache.get(_key(start_day=day)) is not None
        assert cache.get(_key(start_day=0)) is not None
        cache.set(_key(start_day=8), _entry())
        assert cache.get(_key(start_day=0)) is not None
        assert cache.get(_key(start_day=1)) is None
        assert cache.get(_key(start_day=8)) is not None


_POSTGRESQL = postgresql.dialect()  # type: ignore[no-untyped-call]

_DAY_0 = datetime(2024, 6, 10, tzinfo=timezone.utc)
_DAY_BINS = TimeBucketSpec(unit="day")


async def _add_entity(
    session: AsyncSession,
    project: models.Project,
    kind: Literal["span", "trace", "session"],
    start_time: datetime,
) -> int:
    if kind == "session":
        project_session = await _add_project_session(
            session, project, start_time=start_time, end_time=start_time
        )
        return project_session.id
    trace = await _add_trace(session, project, start_time=start_time)
    if kind == "trace":
        return trace.id
    span = await _add_span(session, trace, start_time=start_time)
    return span.id


def _annotation(
    kind: Literal["span", "trace", "session"],
    entity_id: int,
    name: str,
    label: Optional[str],
    score: Optional[float],
) -> models.Base:
    fields: dict[str, Any] = dict(
        name=name,
        label=label,
        score=score,
        explanation=None,
        metadata_={},
        annotator_kind="CODE",
        source="API",
        identifier=token_hex(4),
    )
    if kind == "span":
        return models.SpanAnnotation(span_rowid=entity_id, **fields)
    if kind == "trace":
        return models.TraceAnnotation(trace_rowid=entity_id, **fields)
    return models.ProjectSessionAnnotation(project_session_id=entity_id, **fields)


class TestAnnotationMeanScoreTimeSeriesDataLoader:
    @pytest.mark.parametrize("kind", ["span", "trace", "session"])
    async def test_series_matches_the_entity_weighted_metrics(
        self,
        db: DbSessionFactory,
        kind: Literal["span", "trace", "session"],
    ) -> None:
        """The series' lean statement reports the same per-bucket mean and
        scored-entity count as the shared metrics statement it replaces."""
        async with db() as session:
            project = await _add_project(session)
            # (day offset, [(name, label, score), ...]) per entity
            entities: list[tuple[int, list[tuple[str, Optional[str], Optional[float]]]]] = [
                # Repeated annotations on one entity average first: weight 1, mean 0.5.
                (0, [("quality", "pass", 1.0), ("quality", "fail", 0.0)]),
                # Label-only: neither a mean nor a scored entity.
                (0, [("quality", "pass", None)]),
                (0, [("quality", None, 1.0)]),
                (1, [("quality", "meh", 0.25), ("other", None, 0.0)]),
                # Before the window.
                (-1, [("quality", None, 1.0)]),
            ]
            for day, annotations in entities:
                entity_id = await _add_entity(
                    session, project, kind, _DAY_0 + timedelta(days=day, hours=1)
                )
                for name, label, score in annotations:
                    session.add(_annotation(kind, entity_id, name, label, score))
            await session.flush()

        segment = (kind, project.id, (_DAY_0, None), _DAY_BINS)
        loader = AnnotationMeanScoreTimeSeriesDataLoader(db)
        quality, other = await loader.load_many([(*segment, "quality"), (*segment, "other")])
        assert quality == {
            _DAY_0: MeanScoreBin(0.75, 2),
            _DAY_0 + timedelta(days=1): MeanScoreBin(0.25, 1),
        }
        assert other == {_DAY_0 + timedelta(days=1): MeanScoreBin(0.0, 1)}

        reference: dict[tuple[str, datetime], MeanScoreBin] = {}
        rows_stmt = loader._get_rows_stmt(segment, "quality", "other")
        async with db() as session:
            for row in await session.execute(
                build_entity_weighted_annotation_metrics_stmt(rows_stmt)
            ):
                if row.avg_score is not None:
                    reference.setdefault(
                        (row.name, _as_datetime(row.bucket)),
                        MeanScoreBin(float(row.avg_score), int(row.scored_entity_count)),
                    )
        lean = {("quality", bucket): mean_bin for bucket, mean_bin in quality.items()}
        lean.update({("other", bucket): mean_bin for bucket, mean_bin in other.items()})
        assert lean == reference

    @pytest.mark.parametrize("kind", ["span", "trace", "session"])
    @pytest.mark.parametrize(
        "dialect",
        [
            (SupportedSQLDialect.SQLITE, sqlite.dialect()),
            (SupportedSQLDialect.POSTGRESQL, _POSTGRESQL),
        ],
    )
    def test_statement_scans_the_annotations_once(
        self, kind: Literal["span", "trace", "session"], dialect: tuple[SupportedSQLDialect, Any]
    ) -> None:
        """The shared metrics statement inlined its rows into five branches, and on
        Postgres a mis-estimated join between those branches took minutes."""
        supported_dialect, sa_dialect = dialect

        class _Db:
            pass

        db = _Db()
        db.dialect = supported_dialect  # type: ignore[attr-defined]
        loader = AnnotationMeanScoreTimeSeriesDataLoader(db)  # type: ignore[arg-type]
        stmt = loader._get_stmt((kind, 1, (_DAY_0, None), _DAY_BINS), "quality", "other")
        annotation_table = {
            "span": "span_annotations",
            "trace": "trace_annotations",
            "session": "project_session_annotations",
        }[kind]
        assert str(stmt.compile(dialect=sa_dialect)).count(f"FROM {annotation_table}") == 1


class TestSeriesCacheInvalidation:
    async def test_annotation_events_refresh_the_cached_series(self, db: DbSessionFactory) -> None:
        """The series cache that `build_data_loaders` wires in serves repeat loads, and the
        DML events for annotation writes, annotation deletes and span deletes clear it."""
        async with db() as session:
            project = await _add_project(session)
            span_rowids = [
                await _add_entity(session, project, "span", _DAY_0 + timedelta(hours=hour))
                for hour in (1, 2)
            ]
            session.add(_annotation("span", span_rowids[0], "quality", None, 1.0))
            await session.flush()
        key: Key = ("span", project.id, (_DAY_0, None), _DAY_BINS, "quality")
        cache = CacheForDataLoaders()

        async def load() -> Result:
            # A new set of loaders per call, as each request gets, so only the shared
            # cache can carry a result from one load to the next.
            return await build_data_loaders(db, cache).annotation_mean_score_time_series.load(key)

        async def put_and_wait_for_invalidation(handler: DmlEventHandler, event: DmlEvent) -> None:
            handler.put(event)
            for _ in range(200):
                if cache.annotation_mean_score_time_series.get(key) is None:
                    return
                await asyncio.sleep(0.01)
            pytest.fail(f"{type(event).__name__} did not invalidate the series cache")

        assert await load() == {_DAY_0: MeanScoreBin(1.0, 1)}
        async with db() as session:
            written = _annotation("span", span_rowids[1], "quality", None, 0.0)
            assert isinstance(written, models.SpanAnnotation)
            session.add(written)
            await session.flush()
        # Served from the cache until an event says the annotations changed.
        assert await load() == {_DAY_0: MeanScoreBin(1.0, 1)}

        handler = DmlEventHandler(
            db=db,
            last_updated_at=LastUpdatedAt(),
            cache_for_dataloaders=cache,
            sleep_seconds=0.01,
        )
        async with handler:
            await put_and_wait_for_invalidation(handler, SpanAnnotationInsertEvent((written.id,)))
            assert await load() == {_DAY_0: MeanScoreBin(0.5, 2)}

            async with db() as session:
                await session.execute(
                    delete(models.SpanAnnotation).where(models.SpanAnnotation.id == written.id)
                )
            await put_and_wait_for_invalidation(handler, SpanAnnotationDeleteEvent((written.id,)))
            assert await load() == {_DAY_0: MeanScoreBin(1.0, 1)}

            await put_and_wait_for_invalidation(handler, SpanDeleteEvent((project.id,)))
