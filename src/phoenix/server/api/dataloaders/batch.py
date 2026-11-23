"""Keeps a cancelled DataLoader batch from stalling the server.

Strawberry's `Batch._on_future_done` (strawberry-graphql 0.341.2) rescans every future of a
batch each time one of them is cancelled. When a request is dropped, or a field of a query
fails and graphql-core cancels its siblings, every future of a pending batch is cancelled in
one event-loop turn, so a batch of N keys costs N² checks before the server can answer
anyone: about 3 s for 13,500 keys, 11 s or more for 27,000. Upstream,
strawberry-graphql/strawberry#4803 replaces the scan.

When Strawberry is bumped, `test_the_installed_strawberry_is_the_verified_one` in
tests/unit/server/api/dataloaders/test_batch.py fails and lists the steps: run
`test_strawberry_still_rescans_a_cancelled_batch` to see whether this is still needed; if it
is not, delete this module, its install call in `create_app` (src/phoenix/server/app.py) and
that test file; if it is, run the loader tests and update the verified version in that test.
"""

import asyncio
import dataclasses
from typing import Any, Optional

import strawberry.dataloader
from strawberry.dataloader import Batch


@dataclasses.dataclass(slots=True)
class CancellationTrackingBatch(Batch):  # type: ignore[type-arg]
    """Strawberry's batch, with its cancellation check resumed where the previous check
    stopped: a cancelled future stays cancelled and `add_task` only appends, so the tasks
    before that point are still cancelled. It cancels its dispatch at the same moments as
    Strawberry's, and checks each future about once."""

    _checked_tasks: Optional[list[Any]] = dataclasses.field(default=None, repr=False)
    _cancelled_before: int = dataclasses.field(default=0, repr=False)

    def _on_future_done(self, future: "asyncio.Future[Any]") -> None:
        if not (
            future.cancelled()
            and self._dispatch_task is not None
            and not self._dispatch_task.done()
        ):
            return
        tasks = self.tasks
        if tasks is not self._checked_tasks:
            # `DataLoader.prime_many` replaces the list with the tasks still pending.
            self._checked_tasks, self._cancelled_before = tasks, 0
        index = self._cancelled_before
        while index < len(tasks) and tasks[index].future.cancelled():
            index += 1
        self._cancelled_before = index
        if index == len(tasks):
            self._dispatch_task.cancel()


def install_cancellation_tracking_batch() -> None:
    """Makes every Strawberry DataLoader start its batches as `CancellationTrackingBatch`es:
    `strawberry.dataloader.get_current_batch` looks `Batch` up in its module for each one."""
    strawberry.dataloader.Batch = CancellationTrackingBatch  # type: ignore[misc]
