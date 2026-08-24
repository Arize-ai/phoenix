from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.session_retention import reap_session_history
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_project_session


async def _add_terminal_work_unit(
    session: AsyncSession,
    project_session: models.ProjectSession,
    *,
    at: datetime,
) -> models.EvalSessionWorkUnit:
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
        trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
        project_id=project_session.project_id,
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
        evaluated_through=at,
        status="DONE",
        created_at=at,
        updated_at=at,
    )
    session.add(work_unit)
    await session.flush()
    return work_unit


async def test_reap_skips_a_session_whose_only_aged_work_is_the_permanent_survivor(
    db: DbSessionFactory,
) -> None:
    """The newest terminal work unit in its group is kept as brake evidence and its
    ``updated_at`` never advances, so selecting its session would lock the whole
    history on every sweep tick and delete nothing."""
    aged_at = datetime.now(timezone.utc) - timedelta(days=8)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        survivor = await _add_terminal_work_unit(session, project_session, at=aged_at)
        survivor_id = survivor.id

    async with db() as session:
        statements: list[Any] = []
        scalars = session.scalars

        async def _record(statement: Any, *args: Any, **kwargs: Any) -> Any:
            statements.append(statement)
            return await scalars(statement, *args, **kwargs)

        session.scalars = _record  # type: ignore[method-assign]
        await reap_session_history(
            session,
            retention_cutoff=datetime.now(timezone.utc) - timedelta(days=7),
        )

    assert len(statements) == 1
    async with db() as session:
        assert list(await session.scalars(select(models.EvalSessionWorkUnit.id))) == [survivor_id]
