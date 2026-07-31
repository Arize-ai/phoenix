#!/usr/bin/env python
"""Seed the span-filter DSL corpus onto SQLite or PostgreSQL.

    uv run scripts/dsl-testing/span-filter/seed.py --url sqlite:///dsl.db
    uv run scripts/dsl-testing/span-filter/seed.py --url postgresql://postgres:postgres@localhost:5433/postgres

The same rows land on both backends. That is the whole point: the DSL's job is
to mean the same thing on each, and a corpus that differs between them cannot
show whether it does.

Two things this deliberately does *not* do by hand:

- **Build the engine itself.** `phoenix.db.engines.create_engine` is used so
  SQLite gets `sqlean` rather than the stdlib driver. Phoenix compiles some
  filters to SQLite functions (`text_contains`) that only `sqlean` provides, so
  a hand-rolled `create_engine("sqlite://")` produces a database where valid
  conditions fail with "no such function".
- **Write SQL.** Rows go through the ORM, so JSON columns, timestamps, and
  defaults are handled per dialect instead of being hand-encoded for one.

Re-running is safe: the corpus project is dropped and rebuilt, and nothing
outside it is touched.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

sys.path.insert(0, str(Path(__file__).parent))

from corpus import ANNOTATIONS, PROJECT_NAME, SPANS, TRACE_PREFIX, annotation_names  # noqa: E402

from phoenix.db import models  # noqa: E402
from phoenix.db.engines import create_engine  # noqa: E402

# Fixed so runs are reproducible and rows are ordered predictably by time.
EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)


async def drop_corpus(session: AsyncSession) -> None:
    """Remove a previous run. Scoped to the corpus project, so a database that
    also holds real data keeps it."""
    project_rowid = await session.scalar(
        select(models.Project.id).where(models.Project.name == PROJECT_NAME)
    )
    if project_rowid is None:
        return
    trace_rowids = (
        select(models.Trace.id).where(models.Trace.project_rowid == project_rowid).scalar_subquery()
    )
    span_rowids = (
        select(models.Span.id).where(models.Span.trace_rowid.in_(trace_rowids)).scalar_subquery()
    )
    await session.execute(
        delete(models.SpanAnnotation).where(models.SpanAnnotation.span_rowid.in_(span_rowids))
    )
    await session.execute(delete(models.Span).where(models.Span.trace_rowid.in_(trace_rowids)))
    await session.execute(delete(models.Trace).where(models.Trace.project_rowid == project_rowid))
    await session.execute(delete(models.Project).where(models.Project.id == project_rowid))


async def seed(session: AsyncSession) -> dict[str, int]:
    project = models.Project(
        name=PROJECT_NAME,
        description="Hostile data for span-filter DSL testing. Safe to delete.",
    )
    session.add(project)
    await session.flush()

    span_rowids: dict[str, int] = {}
    for index, spec in enumerate(SPANS):
        # One trace per span keeps the corpus flat: every span is a root unless
        # it names a parent that does not exist, which is how the orphan cases
        # are built.
        start = EPOCH + timedelta(minutes=index)
        trace = models.Trace(
            project_rowid=project.id,
            trace_id=f"{TRACE_PREFIX}{spec.key}",
            start_time=start,
            end_time=start + timedelta(seconds=spec.latency_seconds),
        )
        session.add(trace)
        await session.flush()

        span = models.Span(
            trace_rowid=trace.id,
            span_id=spec.key,
            parent_id=spec.parent_id,
            name=spec.key,
            span_kind=spec.span_kind,
            start_time=start,
            end_time=start + timedelta(seconds=spec.latency_seconds),
            attributes=spec.attributes,
            events=[],
            status_code=spec.status_code,
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        session.add(span)
        await session.flush()
        span_rowids[spec.key] = span.id

    for annotation in ANNOTATIONS:
        session.add(
            models.SpanAnnotation(
                span_rowid=span_rowids[annotation.span_key],
                name=annotation.name,
                label=annotation.label,
                score=annotation.score,
                explanation=f"seeded explanation for {annotation.span_key}",
                metadata_={},
                annotator_kind="HUMAN",
                identifier="",
                source="APP",
            )
        )

    return {"spans": len(SPANS), "annotations": len(ANNOTATIONS)}


async def verify(session: AsyncSession) -> dict[str, int]:
    """Read back through the ORM so the caller learns the seed is queryable, not
    merely inserted."""
    project_rowid = await session.scalar(
        select(models.Project.id).where(models.Project.name == PROJECT_NAME)
    )
    traces = select(models.Trace.id).where(models.Trace.project_rowid == project_rowid)
    spans = select(models.Span.id).where(models.Span.trace_rowid.in_(traces.scalar_subquery()))
    return {
        "spans": await session.scalar(select(func.count()).select_from(spans.subquery())) or 0,
        "annotations": await session.scalar(
            select(func.count()).where(
                models.SpanAnnotation.span_rowid.in_(spans.scalar_subquery())
            )
        )
        or 0,
        "orphans": await session.scalar(
            select(func.count()).select_from(
                spans.where(models.Span.parent_id.is_not(None)).subquery()
            )
        )
        or 0,
    }


async def main_async(url: str) -> int:
    engine: AsyncEngine = create_engine(url, migrate=True, log_migrations=False)
    try:
        async with AsyncSession(engine) as session, session.begin():
            await drop_corpus(session)
            written = await seed(session)
        async with AsyncSession(engine) as session:
            counts = await verify(session)
    finally:
        await engine.dispose()

    if counts["spans"] != written["spans"] or counts["annotations"] != written["annotations"]:
        print(f"  MISMATCH: wrote {written}, read back {counts}", file=sys.stderr)
        return 1

    print(f"  project      {PROJECT_NAME}")
    print(f"  spans        {counts['spans']}  ({counts['orphans']} with a missing parent)")
    print(f"  annotations  {counts['annotations']}  across {len(annotation_names())} names")
    print(f"  names        {', '.join(annotation_names())}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed the span-filter DSL corpus onto SQLite or PostgreSQL.",
        epilog=(
            "Seed both backends and run the same conditions against each; any "
            "difference in what they accept or return is a DSL defect."
        ),
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("PHOENIX_SQL_DATABASE_URL"),
        help="SQLAlchemy URL. Defaults to $PHOENIX_SQL_DATABASE_URL.",
    )
    args = parser.parse_args()
    if not args.url:
        parser.error("no database URL: pass --url or set PHOENIX_SQL_DATABASE_URL")

    print(f"seeding {args.url.split('@')[-1]}")
    return asyncio.run(main_async(args.url))


if __name__ == "__main__":
    raise SystemExit(main())
