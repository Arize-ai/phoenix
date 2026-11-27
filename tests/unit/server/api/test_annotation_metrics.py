import json
import re
from datetime import datetime, timezone
from typing import Any, Optional

import pytest
from sqlalchemy import Select, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import date_trunc
from phoenix.server.api.annotation_metrics import build_entity_weighted_annotation_metrics_stmt
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace

_HOUR_ONE = datetime.fromisoformat("2024-01-01T01:00:00+00:00")
_HOUR_TWO = datetime.fromisoformat("2024-01-01T02:00:00+00:00")


def _span_annotation_rows(db: DbSessionFactory, project_id: int) -> Select[*tuple[Any, ...]]:
    # Mirrors the base rows built by `Project.span_annotation_metrics_time_series`.
    bucket = date_trunc(db.dialect, "hour", models.Trace.start_time)
    return (
        select(
            bucket.label("bucket"),
            models.Span.id.label("entity_id"),
            models.SpanAnnotation.name.label("name"),
            models.SpanAnnotation.label.label("label"),
            models.SpanAnnotation.score.label("score"),
        )
        .join_from(
            models.SpanAnnotation,
            models.Span,
            onclause=models.SpanAnnotation.span_rowid == models.Span.id,
        )
        .join_from(
            models.Span,
            models.Trace,
            onclause=models.Span.trace_rowid == models.Trace.id,
        )
        .where(models.Trace.project_rowid == project_id)
        .where(
            or_(
                models.SpanAnnotation.score.is_not(None),
                models.SpanAnnotation.label.is_not(None),
            )
        )
    )


async def _add_annotation(
    session: AsyncSession,
    span: models.Span,
    name: str,
    label: Optional[str],
    score: Optional[float],
    identifier: str,
) -> None:
    session.add(
        models.SpanAnnotation(
            span_rowid=span.id,
            name=name,
            label=label,
            score=score,
            explanation=None,
            metadata_={},
            annotator_kind="HUMAN",
            identifier=identifier,
            source="APP",
            user_id=None,
        )
    )
    await session.flush()


@pytest.fixture
async def _project_id(db: DbSessionFactory) -> int:
    async with db() as session:
        project = await _add_project(session)
        trace_one = await _add_trace(session, project, start_time=_HOUR_ONE.replace(minute=10))
        trace_two = await _add_trace(session, project, start_time=_HOUR_TWO.replace(minute=20))
        span_a = await _add_span(session, trace_one)
        span_b = await _add_span(session, trace_one)
        span_c = await _add_span(session, trace_one)
        span_d = await _add_span(session, trace_two)
        annotations = [
            # span A: repeated label within one entity, plus a different label
            (span_a, "quality", "good", 1.0),
            (span_a, "quality", "good", 0.8),
            (span_a, "quality", "bad", 0.0),
            # span B: one label-only row and one score-only row
            (span_b, "quality", "good", None),
            (span_b, "quality", None, 0.4),
            # span C: score-only
            (span_c, "quality", None, 0.2),
            # a score-only annotation name with repeated rows on one entity
            (span_a, "score-only", None, 0.9),
            (span_b, "score-only", None, 0.3),
            (span_b, "score-only", None, 0.5),
            # second bucket: label-only
            (span_d, "quality", "bad", None),
        ]
        for i, (span, name, label, score) in enumerate(annotations):
            await _add_annotation(session, span, name, label, score, identifier=str(i))
        # another project's annotations must not leak into the metrics
        other_project = await _add_project(session)
        other_trace = await _add_trace(session, other_project, start_time=_HOUR_ONE)
        other_span = await _add_span(session, other_trace)
        await _add_annotation(session, other_span, "quality", "good", 1.0, identifier="other")
        return project.id


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    assert isinstance(value, datetime)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def test_entity_weighted_annotation_metrics_values(
    db: DbSessionFactory,
    _project_id: int,
) -> None:
    stmt = build_entity_weighted_annotation_metrics_stmt(_span_annotation_rows(db, _project_id))
    async with db() as session:
        rows = (await session.execute(stmt)).all()
    actual = {
        (_as_datetime(row.bucket), row.name, row.label): (
            row.record_count,
            row.label_count,
            row.score_count,
            row.score_sum,
            row.avg_label_fraction,
            row.avg_score,
        )
        for row in rows
    }
    assert len(actual) == len(rows)
    approx = pytest.approx
    assert actual == {
        # entities A (good 2/3, bad 1/3), B (good 1/1) and C (score-only) weigh equally
        (_HOUR_ONE, "quality", "bad"): (0, 0, 0, 0, approx(1 / 9), None),
        (_HOUR_ONE, "quality", "good"): (0, 0, 0, 0, approx(5 / 9), None),
        # entity mean scores: A 0.6, B 0.4, C 0.2
        (_HOUR_ONE, "quality", None): (6, 4, 5, approx(2.4), None, approx(0.4)),
        # entity mean scores: A 0.9, B 0.4
        (_HOUR_ONE, "score-only", None): (3, 0, 3, approx(1.7), None, approx(0.65)),
        (_HOUR_TWO, "quality", "bad"): (0, 0, 0, 0, approx(1.0), None),
        (_HOUR_TWO, "quality", None): (1, 1, 0, None, None, None),
    }


async def test_entity_weighted_annotation_metrics_reads_annotation_table_once(
    db: DbSessionFactory,
    _project_id: int,
) -> None:
    """The base annotation join must be scanned once, not once per derived aggregate."""
    stmt = build_entity_weighted_annotation_metrics_stmt(_span_annotation_rows(db, _project_id))
    async with db() as session:
        sql = str(
            stmt.compile(
                dialect=session.get_bind().dialect,
                compile_kwargs={"literal_binds": True},
            )
        )
        sources_in_sql = len(re.findall(r"\b(?:FROM|JOIN)\s+span_annotations\b", sql, re.I))
        if db.dialect.value == "postgresql":
            plan = (await session.execute(text(f"EXPLAIN (FORMAT JSON) {sql}"))).scalar_one()
            if isinstance(plan, str):
                plan = json.loads(plan)
            scans_in_plan = _count_relation_scans(plan, "span_annotations")
        else:
            plan_rows = (await session.execute(text(f"EXPLAIN QUERY PLAN {sql}"))).all()
            scans_in_plan = sum(
                1
                for plan_row in plan_rows
                if re.search(r"\b(?:SCAN|SEARCH)\s+span_annotations\b", str(plan_row[-1]))
            )
    # (FROM/JOIN sources in the compiled SQL, scan nodes in the database's query plan)
    assert (sources_in_sql, scans_in_plan) == (1, 1)


def _count_relation_scans(node: Any, relation: str) -> int:
    if isinstance(node, list):
        return sum(_count_relation_scans(child, relation) for child in node)
    if isinstance(node, dict):
        own = 1 if node.get("Relation Name") == relation else 0
        return own + sum(_count_relation_scans(child, relation) for child in node.values())
    return 0
