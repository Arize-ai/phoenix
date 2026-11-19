import asyncio
import dataclasses
import importlib.metadata
import random
import time
from collections.abc import Awaitable, Iterator
from typing import Any, Optional, cast

import pytest
import strawberry
import strawberry.dataloader
from fastapi import FastAPI
from strawberry.dataloader import DataLoader

from phoenix.server.api.dataloaders.batch import (
    CancellationTrackingBatch,
)

# The Strawberry release CancellationTrackingBatch was checked against. See the steps in
# _BUMP_STEPS before changing it.
VERIFIED_STRAWBERRY_VERSION = "0.341.2"

STRAWBERRY_BATCH = CancellationTrackingBatch.__base__

_BUMP_STEPS = """\
strawberry-graphql is {installed}; Phoenix's loader patch was verified against {verified}.

Why: Phoenix replaces Strawberry's Batch._on_future_done, which rescans a whole batch for
each cancelled future and freezes the server for seconds when a large batch is cancelled
(strawberry-graphql/strawberry#4803).
Measured just now: Strawberry {verdict}.

1. Run: pytest tests/unit/server/api/dataloaders/test_batch.py -k still_rescans
   passes: Strawberry still rescans, keep the patch (step 3).
   fails: Strawberry no longer rescans, remove the patch (step 2).
2. Remove: delete src/phoenix/server/api/dataloaders/batch.py and
   tests/unit/server/api/dataloaders/test_batch.py, and the
   install_cancellation_tracking_batch import and call in create_app,
   src/phoenix/server/app.py.
3. Keep: run pytest tests/unit/server/api/dataloaders (it includes
   test_matches_strawberrys_batch). If it passes, set VERIFIED_STRAWBERRY_VERSION to
   "{installed}" in tests/unit/server/api/dataloaders/test_batch.py. If it fails, fix the
   patch against the new Strawberry. Do not move the Strawberry pin back."""


@pytest.fixture
def tracking_batch(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(strawberry.dataloader, "Batch", CancellationTrackingBatch)
    yield


@pytest.fixture
def strawberry_batch(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(strawberry.dataloader, "Batch", STRAWBERRY_BATCH)
    yield


class _CountingTask:
    """Stands in for one of a batch's tasks and counts every read of its future."""

    def __init__(self, task: Any, reads: list[int]) -> None:
        self.key = task.key
        self._future = task.future
        self._reads = reads

    @property
    def future(self) -> Any:
        self._reads[0] += 1
        return self._future


async def _future_reads_when_a_batch_is_cancelled(batch_class: Any, size: int) -> int:
    """How many times `batch_class` reads its tasks' futures when all `size` futures of a
    batch whose load is in progress are cancelled in one turn."""
    namespace = vars(strawberry.dataloader)
    previous, namespace["Batch"] = namespace["Batch"], batch_class
    try:

        async def load(keys: list[int]) -> list[int]:
            await asyncio.Event().wait()
            return keys

        loader = DataLoader(load_fn=load)
        futures = [loader.load(key) for key in range(size)]
        for _ in range(3):
            await asyncio.sleep(0)
        batch = loader.batch
        assert batch is not None and batch.dispatched
        reads = [0]
        batch.tasks = cast(Any, [_CountingTask(task, reads) for task in batch.tasks])
        for future in futures:
            future.cancel()  # type: ignore[attr-defined]
        for _ in range(5):
            await asyncio.sleep(0)
        return reads[0]
    finally:
        namespace["Batch"] = previous


_SIZE = 200


def _rescans(reads: int) -> bool:
    return reads >= _SIZE * (_SIZE - 1) // 2


async def test_the_installed_strawberry_is_the_verified_one() -> None:
    installed = importlib.metadata.version("strawberry-graphql")
    if installed == VERIFIED_STRAWBERRY_VERSION:
        return
    try:
        reads = await _future_reads_when_a_batch_is_cancelled(STRAWBERRY_BATCH, _SIZE)
        verdict = "still rescans" if _rescans(reads) else "no longer rescans"
    except Exception as error:  # noqa: BLE001
        verdict = f"could not be checked, its Batch changed ({type(error).__name__}: {error})"
    pytest.fail(
        _BUMP_STEPS.format(
            installed=installed, verified=VERIFIED_STRAWBERRY_VERSION, verdict=verdict
        ),
        pytrace=False,
    )


async def test_strawberry_still_rescans_a_cancelled_batch() -> None:
    """Strawberry's own batch, cancelled whole: each cancelled future rereads them all."""
    reads = await _future_reads_when_a_batch_is_cancelled(STRAWBERRY_BATCH, _SIZE)
    assert _rescans(reads), (
        f"Strawberry no longer rescans a cancelled batch ({reads} future reads for "
        f"{_SIZE} futures): delete phoenix's override, its install line and these tests "
        "(the steps are in _BUMP_STEPS in this file)."
    )


async def test_cancelling_a_batch_reads_each_future_about_once() -> None:
    reads = await _future_reads_when_a_batch_is_cancelled(CancellationTrackingBatch, _SIZE)
    assert reads <= 2 * _SIZE


def test_the_override_fits_strawberrys_batch() -> None:
    """What CancellationTrackingBatch relies on in Strawberry's batch, checked by name, so a
    Strawberry that moved them fails here and not deep inside a loader."""
    assert dataclasses.is_dataclass(STRAWBERRY_BATCH), "Strawberry's Batch is not a dataclass"
    fields = {field.name for field in dataclasses.fields(STRAWBERRY_BATCH)}
    assert {"tasks", "_dispatch_task"} <= fields, f"Strawberry's Batch fields are {fields}"
    assert "_on_future_done" in vars(STRAWBERRY_BATCH), (
        "Strawberry's Batch no longer defines _on_future_done, the method the patch replaces"
    )


async def test_loaders_start_their_batches_from_the_installed_class(
    tracking_batch: None,
) -> None:
    loader = DataLoader(load_fn=_identity)
    assert await loader.load(1) == 1
    assert type(loader.batch) is CancellationTrackingBatch


async def _identity(keys: list[int]) -> list[int]:
    return keys


async def test_create_app_installs_the_batch(strawberry_batch: None, app: FastAPI) -> None:
    assert strawberry.dataloader.Batch is CancellationTrackingBatch


async def _longest_stall(work: Awaitable[Any]) -> float:
    """Runs `work` beside a task that wakes every 5 ms, and returns the longest it went
    without waking: how long the event loop was blocked."""
    longest = 0.0
    done = False

    async def tick() -> None:
        nonlocal longest
        last = time.perf_counter()
        while not done:
            await asyncio.sleep(0.005)
            now = time.perf_counter()
            longest = max(longest, now - last)
            last = now

    ticker = asyncio.create_task(tick())
    try:
        await work
    finally:
        done = True
        await ticker
    return longest


async def test_cancelling_every_future_of_a_large_batch_keeps_the_loop_responsive(
    tracking_batch: None,
) -> None:
    """All 20,000 futures of a pending batch are cancelled in one turn, as when a request is
    dropped. Strawberry's own batch blocks the loop for about 6 s here; this one for about
    5 ms."""
    load_cancelled = asyncio.Event()

    async def load(keys: list[int]) -> list[int]:
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            load_cancelled.set()
            raise
        return keys

    loader = DataLoader(load_fn=load)
    futures = [loader.load(key) for key in range(20_000)]
    await asyncio.sleep(0.01)

    async def cancel_all() -> None:
        for future in futures:
            future.cancel()  # type: ignore[attr-defined]
        await asyncio.wait_for(load_cancelled.wait(), 60)

    assert await _longest_stall(cancel_all()) < 1.0


async def test_a_failing_field_cancels_a_pending_batch_reading_each_future_about_once(
    tracking_batch: None,
) -> None:
    """A non-null field fails while 3,000 sibling fields wait on one pending batch, and
    graphql-core cancels the siblings and, with them, every future of the batch: the path a
    failing page takes. Strawberry's own batch reads the futures 9 million times here."""
    rows = 3_000
    reads = [0]
    load_started = asyncio.Event()

    async def load(keys: list[int]) -> list[int]:
        assert loader.batch is not None
        loader.batch.tasks = cast(Any, [_CountingTask(task, reads) for task in loader.batch.tasks])
        load_started.set()
        await asyncio.Event().wait()
        return keys

    loader = DataLoader(load_fn=load)

    @strawberry.type
    class Row:
        key: strawberry.Private[int]

        @strawberry.field
        async def value(self, info: strawberry.Info) -> int:
            return int(await info.context["loader"].load(self.key))

    @strawberry.type
    class Query:
        @strawberry.field
        def rows(self) -> list[Row]:
            return [Row(key=key) for key in range(rows)]

        @strawberry.field
        async def broken(self) -> int:
            await load_started.wait()
            raise RuntimeError("fails while its siblings wait on the batch")

    schema = strawberry.Schema(query=Query)
    result = await schema.execute("{ rows { value } broken }", context_value={"loader": loader})
    assert result.data is None and result.errors
    assert 0 < reads[0] <= 2 * rows


class _Run:
    """Plays one random sequence of loads, cancellations, primes and event-loop turns
    against a loader, and logs what its load function saw and what became of every future.
    Futures are cancelled before, during and after their batch's load, more than once, and
    after a prime or a load has already resolved them; keys join batches that already hold
    cancelled futures, and prime replaces a pending batch's tasks."""

    def __init__(self, seed: int) -> None:
        self.rng = random.Random(seed)
        self.log: list[tuple[Any, ...]] = []
        self.step = 0
        self.release = asyncio.Event()
        self.cache = self.rng.random() < 0.5
        self.max_batch_size: Optional[int] = self.rng.choice((None, None, 2, 3, 5))

    async def play(self) -> list[tuple[Any, ...]]:
        async def load(keys: list[int]) -> list[Any]:
            self.log.append((self.step, "load", tuple(keys)))
            try:
                await self.release.wait()
            except asyncio.CancelledError:
                self.log.append((self.step, "load cancelled", tuple(keys)))
                raise
            self.log.append((self.step, "load done", tuple(keys)))
            return [key * 10 if key % 7 else ValueError(key) for key in keys]

        loader = DataLoader(load_fn=load, cache=self.cache, max_batch_size=self.max_batch_size)
        futures: list[Any] = []
        for self.step in range(self.rng.randrange(1, 40)):
            op = self.rng.choices(
                ("load", "cancel", "prime", "turn", "release"), weights=(5, 5, 1, 4, 1)
            )[0]
            if op == "load":
                futures.append(loader.load(self.rng.randrange(12)))
            elif op == "cancel" and futures:
                self.rng.choice(futures).cancel()
            elif op == "prime":
                try:
                    loader.prime(self.rng.randrange(12), -2, force=self.rng.random() < 0.5)
                except asyncio.InvalidStateError:
                    # Strawberry's prime sets results on pending futures, cancelled or not.
                    self.log.append((self.step, "prime raised"))
            elif op == "turn":
                for _ in range(self.rng.randrange(1, 4)):
                    await asyncio.sleep(0)
            elif op == "release":
                self.release.set()
        self.step += 1
        self.release.set()
        for _ in range(10):
            await asyncio.sleep(0)
        for index, future in enumerate(futures):
            if future.cancelled():
                outcome: Any = "cancelled"
            elif not future.done():
                outcome = "pending"
                future.cancel()
            elif future.exception() is not None:
                outcome = ("raised", type(future.exception()).__name__)
            else:
                outcome = ("result", future.result())
            self.log.append(("future", index, outcome))
        return self.log


@pytest.mark.parametrize("seed", range(400))
async def test_matches_strawberrys_batch(monkeypatch: pytest.MonkeyPatch, seed: int) -> None:
    """The same random sequence against Strawberry's batch and this one: the load function
    is called, cancelled and completed at the same steps, and every future ends the same."""
    logs = []
    for batch_class in (STRAWBERRY_BATCH, CancellationTrackingBatch):
        monkeypatch.setattr(strawberry.dataloader, "Batch", batch_class)
        logs.append(await _Run(seed).play())
    assert logs[0] == logs[1]


async def test_the_random_sequences_reach_every_outcome(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keeps the comparison above meaningful: the sequences start, cancel and complete
    loads, and their futures end cancelled, resolved and failed."""
    monkeypatch.setattr(strawberry.dataloader, "Batch", CancellationTrackingBatch)
    events = {entry[1] for seed in range(400) for entry in await _Run(seed).play()}
    outcomes = {
        entry[2] if isinstance(entry[2], str) else entry[2][0]
        for seed in range(400)
        for entry in await _Run(seed).play()
        if entry[0] == "future"
    }
    assert {"load", "load cancelled", "load done"} <= events
    assert {"cancelled", "result", "raised"} <= outcomes
