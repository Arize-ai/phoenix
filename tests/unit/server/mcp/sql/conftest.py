from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator, cast

import pytest
from sqlalchemy import URL, Table
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from phoenix.db import models
from phoenix.db.engines import aio_sqlite_engine
from phoenix.server.app import _db
from phoenix.server.types import DbSessionFactory


async def _seed_analytics_rows(conn: AsyncConnection) -> None:
    """The rows every analytics liveness case is measured against.

    Shared by both backends so a construct proven on one is proven on the
    same data on the other. A construct evaluated over zero rows is only a
    syntax check, so a backend without these rows can assert that a statement
    ran and nothing about what it computed.
    """
    await conn.execute(
        cast(Table, models.Project.__table__).insert(),
        {
            "name": "demo",
            "description": None,
            "gradient_start_color": "#000000",
            "gradient_end_color": "#ffffff",
        },
    )
    # A trace and three spans, because the liveness suite executes every
    # permitted construct and a construct evaluated over zero rows is only
    # a syntax check. Rewrites that render valid SQL with the wrong
    # semantics -- a mis-parenthesised product, a reversed EXTRACT, a JSON
    # accessor that returns text where a number was meant -- all execute
    # cleanly against an empty table. The values are chosen so those show
    # up: distinct span kinds, a parent link, sub-second durations, token
    # counts, and the two JSON paths the manifest advertises.
    await conn.execute(
        cast(Table, models.Trace.__table__).insert(),
        {
            "project_rowid": 1,
            "trace_id": "trace-1",
            "start_time": datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
            "end_time": datetime(2024, 1, 1, 0, 0, 2, tzinfo=timezone.utc),
        },
    )
    await conn.execute(
        cast(Table, models.Span.__table__).insert(),
        [
            {
                "trace_rowid": 1,
                "span_id": "span-1",
                "parent_id": None,
                "name": "root",
                "span_kind": "CHAIN",
                "start_time": datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                "end_time": datetime(2024, 1, 1, 0, 0, 1, 500000, tzinfo=timezone.utc),
                "attributes": {"session": {"id": "sess-1"}, "user": {"id": "user-1"}},
                "events": [],
                "status_code": "OK",
                "status_message": "",
                "cumulative_error_count": 0,
                "cumulative_llm_token_count_prompt": 30,
                "cumulative_llm_token_count_completion": 12,
                "llm_token_count_prompt": None,
                "llm_token_count_completion": None,
            },
            {
                "trace_rowid": 1,
                "span_id": "span-2",
                "parent_id": "span-1",
                "name": "llm call",
                "span_kind": "LLM",
                "start_time": datetime(2024, 1, 1, 0, 0, 0, 250000, tzinfo=timezone.utc),
                "end_time": datetime(2024, 1, 1, 0, 0, 0, 900000, tzinfo=timezone.utc),
                "attributes": {"llm": {"model_name": "gpt-4"}},
                "events": [],
                "status_code": "OK",
                "status_message": "",
                "cumulative_error_count": 0,
                "cumulative_llm_token_count_prompt": 30,
                "cumulative_llm_token_count_completion": 12,
                "llm_token_count_prompt": 30,
                "llm_token_count_completion": 12,
            },
            {
                "trace_rowid": 1,
                "span_id": "span-3",
                "parent_id": "span-1",
                "name": "tool call",
                "span_kind": "TOOL",
                "start_time": datetime(2024, 1, 1, 0, 0, 1, tzinfo=timezone.utc),
                "end_time": datetime(2024, 1, 1, 0, 0, 1, 100000, tzinfo=timezone.utc),
                "attributes": {"tool": {"name": "search"}},
                "events": [],
                "status_code": "ERROR",
                "status_message": "boom",
                "cumulative_error_count": 1,
                "cumulative_llm_token_count_prompt": 0,
                "cumulative_llm_token_count_completion": 0,
                "llm_token_count_prompt": None,
                "llm_token_count_completion": None,
            },
        ],
    )
    # One annotation, so the liveness case that joins span_annotations to
    # spans has something to join. Without it that case returns no rows and
    # proves only that the statement parsed.
    await conn.execute(
        cast(Table, models.SpanAnnotation.__table__).insert(),
        {
            "span_rowid": 2,
            "name": "correctness",
            "label": "good",
            "score": 0.9,
            "explanation": None,
            "metadata": {},
            "annotator_kind": "LLM",
            "created_at": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "updated_at": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "identifier": "",
            "source": "API",
            "user_id": None,
        },
    )


@pytest.fixture(scope="function")
async def analytics_sqlite_engine(tmp_path: Path) -> AsyncIterator[AsyncEngine]:
    """A file-backed SQLite database with committed data.

    The shared unit-test SQLite fixture is an in-memory database whose writes sit
    in a transaction that is rolled back after each test. Neither property works
    here: analytics execution refuses in-memory databases, and it reads through a
    separate read-only connection, which cannot see another connection's
    uncommitted writes. So these tests need a real file and real commits.
    """
    db_file = tmp_path / "analytics_commit.db"
    url = URL.create("sqlite+aiosqlite", database=str(db_file))
    engine = aio_sqlite_engine(url, migrate=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def analytics_sqlite_db(
    analytics_sqlite_engine: AsyncEngine,
    tmp_path: Path,
) -> AsyncIterator[tuple[DbSessionFactory, str]]:
    async with analytics_sqlite_engine.begin() as conn:
        await _seed_analytics_rows(conn)
    db_path = str(tmp_path / "analytics_commit.db")
    db = DbSessionFactory(db=_db(analytics_sqlite_engine), dialect="sqlite")
    yield db, db_path


@pytest.fixture(scope="function")
async def analytics_postgres_db(db: DbSessionFactory) -> AsyncIterator[DbSessionFactory]:
    """The same seeded rows on PostgreSQL, for tests that read them back.

    PostgreSQL needs no file and no separate path: analytics reads there go
    through `db.read()` rather than a second connection opened by name, and this
    fixture's database is a real per-test one rather than a rolled-back
    transaction, so a committed write is visible to the reader.

    Skips unless the suite is running on PostgreSQL.
    """
    if db.dialect.value != "postgresql":
        pytest.skip("postgresql only")
    async with db() as session:
        await _seed_analytics_rows(await session.connection())
    yield db
