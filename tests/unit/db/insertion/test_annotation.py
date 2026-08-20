from datetime import datetime, timezone
from secrets import token_hex

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.eval_work import ONLINE_EVAL_IDENTIFIER_PREFIX
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.annotation import insert_annotations, upsert_annotations
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace


async def _seed_annotation_target(db: DbSessionFactory) -> models.Span:
    """A span whose annotations route to a live session in a project carrying one rule."""
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        project_session.last_span_ingested_at = datetime.now(timezone.utc)
        trace = await _add_trace(session, project, project_session)
        span = await _add_span(session, trace)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        project_evaluators = models.ProjectEvaluator(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SESSION",
        )
        session.add(project_evaluator)
        await session.flush()
        session.add(
            models.ProjectEvaluatorTrigger(
                project_evaluator_id=project_evaluators.id,
                event_kind="annotation_upserted",
            )
        )
    return span


def _record(span_rowid: int, *, label: str, identifier: str = "") -> dict[str, object]:
    return {
        "span_rowid": span_rowid,
        "name": "human-review",
        "label": label,
        "score": None,
        "explanation": None,
        "metadata_": {},
        "annotator_kind": "HUMAN",
        "identifier": identifier,
        "source": "APP",
        "user_id": None,
    }


async def _requests(db: DbSessionFactory) -> list[models.EvaluationRequest]:
    async with db() as session:
        rows = await session.scalars(
            select(models.EvaluationRequest).order_by(models.EvaluationRequest.id)
        )
        return list(rows)


async def test_a_write_matching_a_rule_asks_for_an_evaluation(db: DbSessionFactory) -> None:
    span = await _seed_annotation_target(db)

    async with db() as session:
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        await upsert_annotations(
            session,
            _record(span.id, label="incorrect"),
            table=models.SpanAnnotation,
            dialect=dialect,
            unique_by=("name", "span_rowid", "identifier"),
        )

    (request,) = await _requests(db)
    assert request.requested_generation == 1


async def test_annotation_and_request_roll_back_together(db: DbSessionFactory) -> None:
    span = await _seed_annotation_target(db)

    with pytest.raises(RuntimeError, match="roll back"):
        async with db() as session:
            await insert_annotations(
                session,
                _record(span.id, label="incorrect"),
                table=models.SpanAnnotation,
            )
            raise RuntimeError("roll back")

    async with db() as session:
        assert await session.scalar(select(models.SpanAnnotation.id)) is None
    assert await _requests(db) == []


async def test_online_eval_annotation_asks_like_any_other_write(db: DbSessionFactory) -> None:
    span = await _seed_annotation_target(db)

    async with db() as session:
        await insert_annotations(
            session,
            _record(
                span.id,
                label="correct",
                identifier=f"{ONLINE_EVAL_IDENTIFIER_PREFIX}self-authored",
            ),
            table=models.SpanAnnotation,
        )

    async with db() as session:
        assert await session.scalar(select(models.SpanAnnotation.id)) is not None
    assert len(await _requests(db)) == 1


async def test_annotation_rule_gate_is_project_scoped(db: DbSessionFactory) -> None:
    await _seed_annotation_target(db)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        span = await _add_span(session, trace)

    async with db() as session:
        await insert_annotations(
            session,
            _record(span.id, label="incorrect"),
            table=models.SpanAnnotation,
        )

    async with db() as session:
        assert await session.scalar(select(models.SpanAnnotation.id)) is not None
    assert await _requests(db) == []

