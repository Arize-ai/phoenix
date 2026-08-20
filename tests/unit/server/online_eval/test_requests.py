from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import token_hex

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, mark_session_content_incomplete
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.utils import delete_traces
from phoenix.server.app import _db
from phoenix.server.online_eval.requests import (
    EvaluationAsk,
    EvaluationRequestRejected,
    RequestRejection,
    SessionTarget,
    _session_facts_query,
    acknowledge_materialization,
    request_evaluation,
    request_evaluations,
    select_pending_requests,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session, _add_trace


def test_postgresql_session_facts_query_uses_key_share_lock() -> None:
    sql = str(
        _session_facts_query([2, 1], SupportedSQLDialect.POSTGRESQL).compile(
            dialect=postgresql.dialect(),  # type: ignore[no-untyped-call]
            compile_kwargs={"literal_binds": True},
        )
    )

    assert sql.endswith("ORDER BY project_sessions.id FOR KEY SHARE")


@dataclass(frozen=True)
class _Pair:
    project_session_rowid: int
    project_evaluator_id: int
    work_unit_id: int
    trace_id: str

    @property
    def target(self) -> SessionTarget:
        return SessionTarget(project_session_rowid=self.project_session_rowid)


async def _seed_pair(session: AsyncSession) -> _Pair:
    """A session with content identity, a SESSION project evaluator on it, and one work unit."""
    now = datetime.now(timezone.utc)
    project = await _add_project(session)
    project_session = await _add_project_session(session, project)
    project_session.last_span_ingested_at = now
    trace = await _add_trace(session, project, project_session)
    evaluator = models.BuiltinEvaluator(
        name=Identifier(root=f"eval-{token_hex(4)}"),
        kind="BUILTIN",
        key=token_hex(8),
        input_schema={},
        output_configs=[],
    )
    session.add(evaluator)
    await session.flush()
    project_evaluator = models.ProjectEvaluator(
        project_id=project.id,
        evaluator_id=evaluator.id,
        name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
        filter_condition="",
        sampling_rate=1.0,
        evaluation_target="SESSION",
    )
    session.add(project_evaluator)
    await session.flush()
    work_unit = models.EvalSessionWorkUnit(
        project_session_rowid=project_session.id,
        evaluator_id=evaluator.id,
        project_evaluator_id=project_evaluator.id,
        config_fingerprint=token_hex(8),
        evaluated_through=now,
    )
    session.add(work_unit)
    await session.flush()
    return _Pair(
        project_session_rowid=project_session.id,
        project_evaluator_id=project_evaluator.id,
        work_unit_id=work_unit.id,
        trace_id=trace.trace_id,
    )


async def test_requesting_an_evaluation_advances_the_generation_and_latches_the_force_flag(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session)

    async with db() as session:
        first = await request_evaluation(session, pair.target, pair.project_evaluator_id)
    assert first.requested_generation == 1

    async with db() as session:
        forced = await request_evaluation(session, pair.target, pair.project_evaluator_id, force=True)
    assert forced.requested_generation == 2

    # A later unforced ask does not unset what the forced one latched.
    async with db() as session:
        unforced = await request_evaluation(session, pair.target, pair.project_evaluator_id)
    assert unforced.requested_generation == 3

    async with db() as session:
        (pending,) = await select_pending_requests(session, project_evaluator_ids=[pair.project_evaluator_id])
    assert pending.evaluation_request_id == first.evaluation_request_id
    assert pending.observed_generation == 3
    assert pending.forced is True


async def test_the_force_flag_clears_only_when_no_later_ask_raced_the_acknowledgment(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session)

    async with db() as session:
        forced = await request_evaluation(session, pair.target, pair.project_evaluator_id, force=True)
        # An unforced ask arrives after the eligibility read observed the forced one.
        await request_evaluation(session, pair.target, pair.project_evaluator_id)
        await acknowledge_materialization(
            session,
            evaluation_request_id=forced.evaluation_request_id,
            observed_generation=forced.requested_generation,
            session_work_unit_id=pair.work_unit_id,
        )

    async with db() as session:
        (pending,) = await select_pending_requests(session, project_evaluator_ids=[pair.project_evaluator_id])
        assert pending.forced is True

        await acknowledge_materialization(
            session,
            evaluation_request_id=pending.evaluation_request_id,
            observed_generation=pending.observed_generation,
            session_work_unit_id=pair.work_unit_id,
        )

    async with db() as session:
        answered = await session.get(models.EvaluationRequest, forced.evaluation_request_id)
        assert answered is not None
        assert answered.force_requested is False


async def test_a_batch_advances_one_generation_per_ask_and_none_for_a_rejected_pair(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session)
        other = await _seed_pair(session)

    # Three asks for one pair, one for another, plus an ask naming no project_evaluators at all.
    asks = [
        EvaluationAsk(target=pair.target, project_evaluator_id=pair.project_evaluator_id),
        EvaluationAsk(target=pair.target, project_evaluator_id=pair.project_evaluator_id),
        EvaluationAsk(target=pair.target, project_evaluator_id=pair.project_evaluator_id),
        EvaluationAsk(target=other.target, project_evaluator_id=other.project_evaluator_id),
        EvaluationAsk(target=pair.target, project_evaluator_id=-1),
    ]
    async with db() as session:
        outcome = await request_evaluations(session, asks)

    granted = {row.project_evaluator_id: row for row in outcome.granted}
    assert granted[pair.project_evaluator_id].requested_generation == 3
    assert granted[other.project_evaluator_id].requested_generation == 1
    assert [rejected.rejection for rejected in outcome.rejected] == [
        RequestRejection.CRITERIA_NOT_FOUND
    ]

    async with db() as session:
        again = await request_evaluations(
            session, [EvaluationAsk(target=pair.target, project_evaluator_id=pair.project_evaluator_id)] * 2
        )
    assert again.granted[0].requested_generation == 5


async def test_standing_a_session_down_closes_its_request_and_bars_the_next_one(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session)

    async with db() as session:
        requested = await request_evaluation(session, pair.target, pair.project_evaluator_id)
        await acknowledge_materialization(
            session,
            evaluation_request_id=requested.evaluation_request_id,
            observed_generation=requested.requested_generation,
            session_work_unit_id=pair.work_unit_id,
        )
        await request_evaluation(session, pair.target, pair.project_evaluator_id, force=True)

    async with db() as session:
        await mark_session_content_incomplete(session, [pair.project_session_rowid])

    async with db() as session:
        closed = await session.get(models.EvaluationRequest, requested.evaluation_request_id)
        assert closed is not None
        assert closed.requested_generation == 2
        assert closed.materialized_generation == 2
        assert closed.materialized_by_session_work_unit_id is None
        assert closed.force_requested is False
        assert await select_pending_requests(session, project_evaluator_ids=[pair.project_evaluator_id]) == ()

    async with db() as session:
        with pytest.raises(EvaluationRequestRejected) as rejection:
            await request_evaluation(session, pair.target, pair.project_evaluator_id)
    assert rejection.value.rejection is RequestRejection.SESSION_CONTENT_INCOMPLETE


async def test_deleting_traces_through_the_api_helper_closes_the_session_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session)
    async with db() as session:
        requested = await request_evaluation(session, pair.target, pair.project_evaluator_id)

    assert await delete_traces(db, pair.trace_id)

    async with db() as session:
        project_session = await session.get(models.ProjectSession, pair.project_session_rowid)
        assert project_session is not None
        assert project_session.content_complete is False
        closed = await session.get(models.EvaluationRequest, requested.evaluation_request_id)
        assert closed is not None
        assert closed.materialized_generation == requested.requested_generation


async def test_a_session_without_content_identity_is_rejected(db: DbSessionFactory) -> None:
    async with db() as session:
        pair = await _seed_pair(session)
        project_session = await session.get(models.ProjectSession, pair.project_session_rowid)
        assert project_session is not None
        project_session.last_span_ingested_at = None

    async with db() as session:
        with pytest.raises(EvaluationRequestRejected) as rejection:
            await request_evaluation(session, pair.target, pair.project_evaluator_id)
    assert rejection.value.rejection is RequestRejection.SESSION_CONTENT_IDENTITY_MISSING


@pytest.mark.postgres_only
async def test_a_request_made_after_the_eligibility_read_survives_the_acknowledgment(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        pair = await _seed_pair(session)
        request = models.EvaluationRequest(
            project_session_rowid=pair.project_session_rowid,
            project_evaluator_id=pair.project_evaluator_id,
            requested_generation=5,
            materialized_generation=4,
        )
        session.add(request)
        await session.flush()
        request_id = request.id

    async with db() as sweep:
        (pending,) = await select_pending_requests(sweep, project_evaluator_ids=[pair.project_evaluator_id])
        assert pending.observed_generation == 5

        # A sixth ask commits on its own connection while the sweep's read is still open.
        async with db() as requester:
            await request_evaluation(requester, pair.target, pair.project_evaluator_id)

        await acknowledge_materialization(
            sweep,
            evaluation_request_id=pending.evaluation_request_id,
            observed_generation=pending.observed_generation,
            session_work_unit_id=pair.work_unit_id,
        )

    async with db() as session:
        answered = await session.get(models.EvaluationRequest, request_id)
        assert answered is not None
        assert answered.requested_generation == 6
        assert answered.materialized_generation == 5
        assert answered.materialized_by_session_work_unit_id == pair.work_unit_id
        (still_pending,) = await select_pending_requests(session, project_evaluator_ids=[pair.project_evaluator_id])
        assert still_pending.observed_generation == 6

