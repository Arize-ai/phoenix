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


async def _seed_event_target(db: DbSessionFactory) -> models.Span:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
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
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SESSION",
        )
        session.add(criteria)
        await session.flush()
        session.add(
            models.ProjectEvaluatorTrigger(
                criteria_id=criteria.id,
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


async def test_upsert_reports_created_then_updated(db: DbSessionFactory) -> None:
    span = await _seed_event_target(db)

    async with db() as session:
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        await upsert_annotations(
            session,
            _record(span.id, label="incorrect"),
            table=models.SpanAnnotation,
            dialect=dialect,
            unique_by=("name", "span_rowid", "identifier"),
        )
        await upsert_annotations(
            session,
            _record(span.id, label="correct"),
            table=models.SpanAnnotation,
            dialect=dialect,
            unique_by=("name", "span_rowid", "identifier"),
        )

    async with db() as session:
        events = list(
            await session.scalars(select(models.EvaluatorEvent).order_by(models.EvaluatorEvent.id))
        )
    assert [event.payload["change"] for event in events] == ["created", "updated"]
    assert [event.payload["label"] for event in events] == ["incorrect", "correct"]
    assert set(events[0].payload) == {
        "annotation_target",
        "annotation_id",
        "target_rowid",
        "change",
        "updated_at",
        "name",
        "label",
        "score",
        "annotator_kind",
        "source",
        "user_id",
        "identifier",
        "criteria_id",
    }
    # No project evaluator wrote these, so nothing names one.
    assert [event.payload["criteria_id"] for event in events] == [None, None]


async def test_annotation_and_event_roll_back_together(db: DbSessionFactory) -> None:
    span = await _seed_event_target(db)

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
        assert await session.scalar(select(models.EvaluatorEvent.id)) is None


async def test_online_eval_annotation_does_not_append_an_event(db: DbSessionFactory) -> None:
    span = await _seed_event_target(db)

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
        assert await session.scalar(select(models.EvaluatorEvent.id)) is None


async def test_annotation_rule_gate_is_project_scoped(db: DbSessionFactory) -> None:
    await _seed_event_target(db)
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
        assert await session.scalar(select(models.EvaluatorEvent.id)) is None
