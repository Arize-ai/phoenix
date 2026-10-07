"""The one limit on queued online evaluations: span, trace, and session evaluations share
one queue, which stops taking new evaluations once this many are queued (PENDING, RUNNING,
or ERROR awaiting a retry), and resumes as they drain.

The span producer and the trace and session sweepers admit new evaluations only into the
room left under it, and queue health reads the same limit to report the queue at capacity.
Each producer locks, counts, and writes the evaluations it admits in one transaction, so
two of them never both fill the same room.
"""

from __future__ import annotations

from sqlalchemy import func, select, text, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import get_env_online_eval_max_outstanding
from phoenix.db import models
from phoenix.db.eval_work import live_eval_work_index_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.leases import lock_until_commit

ADMISSION_LOCK = "online-eval-admission"

_WORK_UNIT_MODELS = (models.EvalWorkUnit, models.EvalTraceWorkUnit, models.EvalSessionWorkUnit)


def max_queued() -> int:
    return get_env_online_eval_max_outstanding()


async def count_queued(session: AsyncSession, limit: int) -> int:
    """How many evaluations are queued across every evaluation target, counting no further
    than ``limit``, so the read stops after that many rows however many are queued.

    RUNNING evaluations are claimed but unfinished, and ERROR ones return to the line after
    a cooldown, so both count: under a provider outage the whole line moves into ERROR, and
    a count of PENDING alone would keep queueing into the outage.
    """
    queued = (
        union_all(
            *(
                select(1)
                .select_from(model)
                # SQLite reads a partial index only when the query repeats its predicate.
                .where(text(live_eval_work_index_predicate()))
                for model in _WORK_UNIT_MODELS
            )
        )
        .limit(limit)
        .subquery()
    )
    return await session.scalar(select(func.count()).select_from(queued)) or 0


async def room(session: AsyncSession) -> int:
    """How many more evaluations the queue has room for. Another producer can take that
    room before this session writes, so a producer admits only against ``lock_room``."""
    limit = max_queued()
    return max(0, limit - await count_queued(session, limit))


async def lock_room(session: AsyncSession, dialect: SupportedSQLDialect) -> int:
    """Lock admission until this session's transaction ends, and return the room left.

    Call it in the transaction that writes the admitted evaluations, after any long read:
    every other producer waits on the lock until that transaction ends.
    """
    await lock_until_commit(session, dialect, ADMISSION_LOCK)
    return await room(session)
