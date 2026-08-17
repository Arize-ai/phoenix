from dataclasses import replace
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select, update

from phoenix.db import models
from phoenix.server.online_eval.derivation import annotation_identifier
from phoenix.server.online_eval.triggering import annotations_adapter
from phoenix.server.online_eval.triggering.annotations_adapter import AnnotationDeltaAdapter
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace

_ONLINE_EVAL_IDENTIFIER = annotation_identifier("a" * 64)


def _adapter(db: DbSessionFactory, *, frontier_lag_seconds: float = 0.0) -> AnnotationDeltaAdapter:
    adapter = AnnotationDeltaAdapter(db)
    adapter._frontier_lag_seconds = frontier_lag_seconds
    return adapter


async def _seed_span_in_session(
    db: DbSessionFactory,
) -> tuple[models.Project, models.ProjectSession, models.Span]:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        span = await _add_span(session, trace)
    return project, project_session, span


async def _add_span_annotation(
    db: DbSessionFactory,
    span: models.Span,
    *,
    name: str = "human-review",
    label: str = "incorrect",
    identifier: str = "",
) -> models.SpanAnnotation:
    async with db() as session:
        annotation = models.SpanAnnotation(
            span_rowid=span.id,
            name=name,
            label=label,
            score=None,
            explanation="why the label was chosen",
            metadata_={"reviewer": "someone"},
            annotator_kind="HUMAN",
            identifier=identifier,
            source="APP",
            user_id=None,
        )
        session.add(annotation)
        await session.flush()
    return annotation


async def _updated_at(db: DbSessionFactory, annotation_id: int) -> datetime:
    async with db() as session:
        updated_at = await session.scalar(
            select(models.SpanAnnotation.updated_at).where(
                models.SpanAnnotation.id == annotation_id
            )
        )
    assert updated_at is not None
    return updated_at


async def _signals(db: DbSessionFactory) -> list[models.EvaluatorSignal]:
    async with db() as session:
        return list(
            await session.scalars(
                select(models.EvaluatorSignal).order_by(models.EvaluatorSignal.id)
            )
        )


async def _cursor(db: DbSessionFactory) -> models.EvalWorkCursor:
    async with db() as session:
        cursor = await session.scalar(
            select(models.EvalWorkCursor).where(
                models.EvalWorkCursor.evaluation_target == "SPAN",
                models.EvalWorkCursor.consumer_group == "annotation-delta",
            )
        )
    assert cursor is not None
    return cursor


async def test_tick_announces_an_upserted_annotation_against_its_session(
    db: DbSessionFactory,
) -> None:
    project, project_session, span = await _seed_span_in_session(db)
    adapter = _adapter(db)
    await adapter._tick()

    annotation = await _add_span_annotation(db, span)
    await adapter._tick()

    (signal,) = await _signals(db)
    assert signal.kind == "annotation_upserted"
    assert signal.project_id == project.id
    assert signal.project_session_rowid == project_session.id
    assert signal.payload == {
        "annotation_kind": "span",
        "annotation_id": annotation.id,
        "target_rowid": span.id,
        "edge": "created",
        "updated_at": (await _updated_at(db, annotation.id)).isoformat(),
        "name": "human-review",
        "label": "incorrect",
        "score": None,
        "annotator_kind": "HUMAN",
        "source": "APP",
        "user_id": None,
        "identifier": "",
    }

    await adapter._tick()
    assert len(await _signals(db)) == 1


async def test_annotation_written_by_online_evaluation_is_never_announced(
    db: DbSessionFactory,
) -> None:
    _, _, span = await _seed_span_in_session(db)
    adapter = _adapter(db)
    await adapter._tick()

    self_written = await _add_span_annotation(db, span, identifier=_ONLINE_EVAL_IDENTIFIER)
    user_written = await _add_span_annotation(db, span)
    await adapter._tick()

    (signal,) = await _signals(db)
    assert signal.payload["annotation_id"] == user_written.id
    # The walk passed the online-eval row rather than leaving it for a later tick, so its
    # absence from the log is the scan query excluding it.
    assert (await _cursor(db)).produced_through_id >= self_written.id


async def test_annotation_on_a_span_in_no_session_is_not_announced(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    adapter = _adapter(db)
    await adapter._tick()

    await _add_span_annotation(db, span)
    await adapter._tick()

    assert await _signals(db) == []


async def test_frontier_gate_opens_only_once_the_observation_has_aged(
    db: DbSessionFactory,
) -> None:
    _, _, span = await _seed_span_in_session(db)
    adapter = _adapter(db, frontier_lag_seconds=60.0)
    await adapter._tick()

    annotation = await _add_span_annotation(db, span)
    for _ in range(3):
        await adapter._tick()

    assert await _signals(db) == []
    # Ticking faster than the lag must leave the observation's age growing; re-reading the
    # high water mark every tick would hold the gate shut forever.
    observation = adapter._observations["span"]
    assert observation.high_water_id == annotation.id

    adapter._observations["span"] = replace(
        observation,
        observed_at=observation.observed_at - timedelta(seconds=61),
    )
    await adapter._tick()

    (signal,) = await _signals(db)
    assert signal.payload["annotation_id"] == annotation.id


async def test_both_walks_reaching_one_annotation_leave_one_occurrence(
    db: DbSessionFactory,
) -> None:
    _, _, span = await _seed_span_in_session(db)
    adapter = _adapter(db)
    await adapter._tick()

    annotation = await _add_span_annotation(db, span)
    await adapter._tick()
    (announced,) = await _signals(db)
    assert announced.payload["edge"] == "created"

    # Rewind the edit walk behind the annotation so it reaches a row the insert walk has
    # already announced.
    cursor_id = (await _cursor(db)).id
    rewound = await _updated_at(db, annotation.id) - timedelta(seconds=1)
    async with db() as session:
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor_id)
            .values(observed_at=rewound)
        )
    await adapter._tick()

    (still_one,) = await _signals(db)
    assert still_one.id == announced.id
    assert still_one.payload["edge"] == "created"


async def _add_session_annotation(
    db: DbSessionFactory,
    project_session: models.ProjectSession,
    *,
    name: str = "human-review",
    label: str = "incorrect",
    identifier: str = "",
) -> models.ProjectSessionAnnotation:
    async with db() as session:
        annotation = models.ProjectSessionAnnotation(
            project_session_id=project_session.id,
            name=name,
            label=label,
            score=None,
            explanation="why the label was chosen",
            metadata_={"reviewer": "someone"},
            annotator_kind="HUMAN",
            identifier=identifier,
            source="APP",
            user_id=None,
        )
        session.add(annotation)
        await session.flush()
    return annotation


async def test_session_annotation_written_by_online_evaluation_is_never_announced(
    db: DbSessionFactory,
) -> None:
    # The session table is the one where the loop can close: an announced online-eval
    # annotation would request the evaluation that wrote it.
    _, project_session, _ = await _seed_span_in_session(db)
    adapter = _adapter(db)
    await adapter._tick()

    self_written = await _add_session_annotation(
        db, project_session, identifier=_ONLINE_EVAL_IDENTIFIER
    )
    user_written = await _add_session_annotation(db, project_session)
    await adapter._tick()

    (signal,) = await _signals(db)
    assert signal.payload["annotation_kind"] == "session"
    assert signal.payload["annotation_id"] == user_written.id
    assert signal.project_session_rowid == project_session.id
    # The walk passed the online-eval row rather than leaving it for a later tick, so its
    # absence from the log is the scan query excluding it.
    async with db() as session:
        cursor = await session.scalar(
            select(models.EvalWorkCursor).where(
                models.EvalWorkCursor.evaluation_target == "SESSION",
                models.EvalWorkCursor.consumer_group == "annotation-delta",
            )
        )
    assert cursor is not None
    assert cursor.produced_through_id >= self_written.id


async def test_edit_window_larger_than_the_row_cap_completes_over_several_ticks(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, _, span = await _seed_span_in_session(db)
    adapter = _adapter(db)
    await adapter._tick()

    annotations = [
        await _add_span_annotation(db, span, name=f"review-{index}") for index in range(3)
    ]
    await adapter._tick()
    created = await _signals(db)
    assert len(created) == 3
    assert {signal.payload["edge"] for signal in created} == {"created"}

    # One tick can no longer drain the window, so the walk has to resume inside it. The
    # edits share a stamp, which is the ordinary case rather than a contrived one: on
    # SQLite `updated_at` is coarse enough that a batch of edits lands on one value, so
    # the position has to carry an id to make progress at all.
    monkeypatch.setattr(annotations_adapter, "_MAX_EDIT_ROWS_PER_TICK", 2)
    edited_at = await _updated_at(db, annotations[0].id) + timedelta(seconds=60)
    async with db() as session:
        await session.execute(
            update(models.SpanAnnotation)
            .where(models.SpanAnnotation.id.in_([annotation.id for annotation in annotations]))
            .values(label="corrected", updated_at=edited_at)
        )

    await adapter._tick()
    assert len(await _updates(db)) == 2

    await adapter._tick()
    updated = await _updates(db)
    # Every edit announced exactly once across the two ticks, and none of them twice.
    assert len(updated) == 3
    assert {signal.payload["annotation_id"] for signal in updated} == {
        annotation.id for annotation in annotations
    }

    await adapter._tick()
    assert len(await _updates(db)) == 3


async def _updates(db: DbSessionFactory) -> list[models.EvaluatorSignal]:
    return [signal for signal in await _signals(db) if signal.payload["edge"] == "updated"]
