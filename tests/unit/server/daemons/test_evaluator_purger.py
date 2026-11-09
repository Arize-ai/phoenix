import asyncio
from secrets import token_hex
from typing import Any, NamedTuple
from unittest.mock import patch

import pytest
import sqlalchemy as sa

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.daemons import evaluator_purger
from phoenix.server.daemons.evaluator_purger import (
    EvaluatorPurger,
    purge_deleted_bindings,
)
from phoenix.server.evaluators.services.management import mark_bindings_deleted
from phoenix.server.online_eval.leases import ScanLease
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace


class _ProjectBinding(NamedTuple):
    id: int
    evaluator_id: int
    project_id: int
    trace_project_id: int


async def _builtin_evaluator(db: DbSessionFactory) -> int:
    async with db() as session:
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"builtin-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        return evaluator.id


async def _add_project_binding(
    db: DbSessionFactory,
    *,
    project_id: int | None = None,
    evaluated_spans: int = 0,
    evaluator_traces: int = 0,
) -> _ProjectBinding:
    evaluator_id = await _builtin_evaluator(db)
    async with db() as session:
        if project_id is None:
            project_id = (await _add_project(session)).id
        binding = models.ProjectEvaluator(
            trace_project=models.Project(name=f"trace-project-{token_hex(8)}"),
            project_id=project_id,
            evaluator_id=evaluator_id,
            name=Identifier(root=f"binding-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(binding)
        await session.flush()
        project = await session.get(models.Project, project_id)
        assert project is not None
        trace = await _add_trace(session, project)
        for _ in range(evaluated_spans):
            span = await _add_span(session, trace)
            session.add(models.EvalWorkUnit(span_rowid=span.id, project_evaluator_id=binding.id))
        for _ in range(evaluator_traces):
            await _add_trace(session, binding.trace_project)
        await session.flush()
        return _ProjectBinding(binding.id, evaluator_id, project_id, binding.trace_project_id)


async def _add_dataset_binding(db: DbSessionFactory, *, evaluator_traces: int = 0) -> int:
    evaluator_id = await _builtin_evaluator(db)
    async with db() as session:
        dataset = models.Dataset(name=f"dataset-{token_hex(4)}", metadata_={})
        trace_project = models.Project(name=f"dataset-trace-project-{token_hex(8)}")
        binding = models.DatasetEvaluators(
            dataset=dataset,
            evaluator_id=evaluator_id,
            name=Identifier(root=f"binding-{token_hex(4)}"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            project=trace_project,
        )
        session.add(binding)
        await session.flush()
        for _ in range(evaluator_traces):
            await _add_trace(session, trace_project)
        return binding.id


async def _mark(
    db: DbSessionFactory,
    model: type[models.DatasetEvaluators] | type[models.ProjectEvaluator],
    binding_id: int,
) -> None:
    async with db() as session:
        assert await mark_bindings_deleted(
            session,
            model,
            [binding_id],
            delete_unused_evaluator=True,
            delete_associated_prompt=False,
        ) == [binding_id]


async def _count(db: DbSessionFactory, model: Any, condition: Any) -> int:
    async with db() as session:
        return (
            await session.scalar(sa.select(sa.func.count()).select_from(model).where(condition))
            or 0
        )


async def _project_exists(db: DbSessionFactory, project_id: int) -> bool:
    async with db() as session:
        return await session.get(models.Project, project_id) is not None


async def test_purge_removes_a_project_evaluator_in_batches(db: DbSessionFactory) -> None:
    binding = await _add_project_binding(db, evaluated_spans=5, evaluator_traces=5)
    untouched = await _add_project_binding(db, evaluated_spans=1, evaluator_traces=1)
    await _mark(db, models.ProjectEvaluator, binding.id)

    with patch.object(evaluator_purger, "PURGE_BATCH_ROWS", 2):
        await purge_deleted_bindings(db)

    async with db() as session:
        assert await session.get(models.ProjectEvaluator, binding.id) is None
        assert await session.get(models.ProjectEvaluator, untouched.id) is not None
        assert await session.get(models.BuiltinEvaluator, binding.evaluator_id) is not None
    work_units = models.EvalWorkUnit.project_evaluator_id == binding.id
    assert await _count(db, models.EvalWorkUnit, work_units) == 0
    assert not await _project_exists(db, binding.trace_project_id)
    assert await _project_exists(db, binding.project_id)
    evaluated_spans = models.Trace.project_rowid == binding.project_id
    assert await _count(db, models.Trace, evaluated_spans) == 1
    assert await _project_exists(db, untouched.trace_project_id)


async def test_purge_leaves_bindings_that_are_not_deleted(db: DbSessionFactory) -> None:
    binding = await _add_project_binding(db, evaluated_spans=1, evaluator_traces=1)
    await evaluator_purger.purge_project_evaluator(db, binding.id)
    async with db() as session:
        assert await session.get(models.ProjectEvaluator, binding.id) is not None
    assert await _project_exists(db, binding.trace_project_id)


async def test_purge_takes_project_evaluators_attached_to_a_dataset_trace_project(
    db: DbSessionFactory,
) -> None:
    dataset_binding_id = await _add_dataset_binding(db, evaluator_traces=2)
    async with db() as session:
        dataset_binding = await session.get(models.DatasetEvaluators, dataset_binding_id)
        assert dataset_binding is not None
        dataset_trace_project_id = dataset_binding.project_id
    attached = await _add_project_binding(
        db, project_id=dataset_trace_project_id, evaluated_spans=2, evaluator_traces=2
    )
    await _mark(db, models.DatasetEvaluators, dataset_binding_id)

    await purge_deleted_bindings(db)

    async with db() as session:
        assert await session.get(models.DatasetEvaluators, dataset_binding_id) is None
        assert await session.get(models.ProjectEvaluator, attached.id) is None
    assert not await _project_exists(db, dataset_trace_project_id)
    assert not await _project_exists(db, attached.trace_project_id)


async def test_interrupted_purge_resumes_on_the_next_run(db: DbSessionFactory) -> None:
    binding = await _add_project_binding(db, evaluated_spans=3, evaluator_traces=3)
    await _mark(db, models.ProjectEvaluator, binding.id)

    class _Interrupted(Exception):
        pass

    async def _interrupt() -> None:
        raise _Interrupted

    with patch.object(evaluator_purger, "PURGE_BATCH_ROWS", 2):
        with pytest.raises(_Interrupted):
            await evaluator_purger.purge_project_evaluator(db, binding.id, heartbeat=_interrupt)

    work_units = models.EvalWorkUnit.project_evaluator_id == binding.id
    assert await _count(db, models.EvalWorkUnit, work_units) == 1
    async with db() as session:
        row = await session.get(models.ProjectEvaluator, binding.id)
        assert row is not None and row.deleted_at is not None

    await purge_deleted_bindings(db)

    async with db() as session:
        assert await session.get(models.ProjectEvaluator, binding.id) is None
    assert not await _project_exists(db, binding.trace_project_id)


async def test_only_the_lease_holder_purges(db: DbSessionFactory) -> None:
    binding = await _add_project_binding(db, evaluator_traces=1)
    await _mark(db, models.ProjectEvaluator, binding.id)
    other_replica = ScanLease(db, name="evaluator-purger", holder="other-replica")
    assert await other_replica.acquire()

    purger = EvaluatorPurger(db)
    await purger.purge_deleted_bindings()
    assert await _project_exists(db, binding.trace_project_id)

    await other_replica.release()
    await purger.purge_deleted_bindings()
    assert not await _project_exists(db, binding.trace_project_id)
    assert await other_replica.acquire()


async def test_wake_ends_the_sleep_early(db: DbSessionFactory) -> None:
    purger = EvaluatorPurger(db)
    purger.wake()
    await asyncio.wait_for(purger._sleep(), timeout=5)


class _Parking:
    def __init__(self) -> None:
        self.parked = asyncio.Event()
        self.release = asyncio.Event()

    async def park(self, *_: Any, **__: Any) -> None:
        self.parked.set()
        await self.release.wait()
        self.release.clear()

    async def wait_parked(self) -> None:
        try:
            await asyncio.wait_for(self.parked.wait(), timeout=30)
        except asyncio.TimeoutError:
            pytest.fail("the purger never finished a cycle within 30s")
        self.parked.clear()


async def test_daemon_purges_deleted_bindings_each_cycle(db: DbSessionFactory) -> None:
    parking = _Parking()
    with patch.object(EvaluatorPurger, "_sleep", parking.park):
        purger = EvaluatorPurger(db)
        await purger.start()
        try:
            await parking.wait_parked()
            binding = await _add_project_binding(db, evaluator_traces=1)
            await _mark(db, models.ProjectEvaluator, binding.id)
            parking.release.set()
            await parking.wait_parked()
            assert not await _project_exists(db, binding.trace_project_id)
        finally:
            await purger.stop()


async def test_marking_skips_bindings_already_deleted(db: DbSessionFactory) -> None:
    binding = await _add_project_binding(db)
    await _mark(db, models.ProjectEvaluator, binding.id)
    async with db() as session:
        first = await session.scalar(
            sa.select(models.ProjectEvaluator.deleted_at).where(
                models.ProjectEvaluator.id == binding.id
            )
        )
        assert (
            await mark_bindings_deleted(
                session,
                models.ProjectEvaluator,
                [binding.id],
                delete_unused_evaluator=False,
                delete_associated_prompt=True,
            )
            == []
        )
        row = await session.get(models.ProjectEvaluator, binding.id)
        assert row is not None
        assert row.deleted_at == first
        assert row.delete_unused_evaluator and not row.delete_associated_prompt
