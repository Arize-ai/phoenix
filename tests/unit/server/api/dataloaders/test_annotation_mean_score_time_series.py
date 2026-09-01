import asyncio
from asyncio import Future
from datetime import datetime, timezone

from phoenix.server.api.dataloaders.annotation_mean_score_time_series import (
    AnnotationMeanScoreTimeSeriesCache,
    Key,
)


def _key(
    kind: str = "span",
    project_rowid: int = 1,
    annotation_name: str = "quality",
    stride: str = "day",
) -> Key:
    interval = (datetime(2024, 6, 10, tzinfo=timezone.utc), None)
    return (kind, project_rowid, interval, stride, 0, annotation_name)  # type: ignore[return-value]


def _entry() -> "Future[dict[datetime, float]]":
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
        assert cache.get(_key(stride="hour")) is None

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
