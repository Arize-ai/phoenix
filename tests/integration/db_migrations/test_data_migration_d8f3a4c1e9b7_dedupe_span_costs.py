from datetime import datetime, timedelta, timezone
from secrets import token_hex

import pytest
from alembic.config import Config
from sqlalchemy import Column, Connection, MetaData, Table, insert, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from phoenix.db.models import JSON_

from . import _run_async, _up, _verify_clean_state

_DOWN = "4aad9107d196"
_UP = "d8f3a4c1e9b7"


async def test_dedupe_span_costs_before_enforcing_unique_span_rowid(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """A legacy database may already contain more than one span_costs row for
    the same span_rowid, since nothing enforced uniqueness before this
    migration. Upgrading must prune the extras (keeping the most recently
    written row) without leaving their span_cost_details orphaned, must leave
    an unrelated span's cost untouched, and must come out the other side
    actually rejecting a second span_costs row for the same span.
    """
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)

    def _reflect(conn: Connection) -> tuple[Table, Table, Table, Table, Table]:
        metadata = MetaData()
        metadata.reflect(bind=conn)
        t_projects = metadata.tables["projects"]
        t_traces = metadata.tables["traces"]
        # attributes/events are JSON columns; override their reflected type so
        # Python dict/list values serialize correctly on insert (see the
        # project_sessions data migration test for the same pattern).
        t_spans = Table(
            "spans",
            MetaData(),
            Column("attributes", JSON_),
            Column("events", JSON_),
            autoload_with=conn,
        )
        t_span_costs = metadata.tables["span_costs"]
        t_span_cost_details = metadata.tables["span_cost_details"]
        return t_projects, t_traces, t_spans, t_span_costs, t_span_cost_details

    (
        table_projects,
        table_traces,
        table_spans,
        table_span_costs,
        table_span_cost_details,
    ) = await _run_async(_engine, _reflect)

    now = datetime.now(timezone.utc)

    def _seed(conn: Connection) -> tuple[int, int, int, int, int, int]:
        project_id = conn.scalar(
            insert(table_projects).returning(table_projects.c.id),
            {"name": token_hex(8)},
        )
        assert project_id is not None
        trace_id = conn.scalar(
            insert(table_traces).returning(table_traces.c.id),
            {
                "trace_id": token_hex(16),
                "project_rowid": project_id,
                "start_time": now,
                "end_time": now + timedelta(seconds=1),
            },
        )
        assert trace_id is not None

        def span_row(name: str) -> dict[str, object]:
            return {
                "span_id": token_hex(8),
                "parent_id": None,
                "name": name,
                "span_kind": "LLM",
                "trace_rowid": trace_id,
                "start_time": now,
                "end_time": now + timedelta(milliseconds=10),
                "attributes": {},
                "events": [],
                "status_message": "",
                "cumulative_error_count": 0,
                "cumulative_llm_token_count_prompt": 0,
                "cumulative_llm_token_count_completion": 0,
            }

        duplicated_span_id, lone_span_id = conn.scalars(
            insert(table_spans).returning(table_spans.c.id),
            [span_row("duplicated"), span_row("lone")],
        ).all()

        def cost_row(span_rowid: int, total_cost: float) -> dict[str, object]:
            return {
                "span_rowid": span_rowid,
                "trace_rowid": trace_id,
                "span_start_time": now,
                "total_cost": total_cost,
            }

        stale_cost_id, fresh_cost_id = conn.scalars(
            insert(table_span_costs).returning(table_span_costs.c.id),
            [
                cost_row(duplicated_span_id, 1.0),
                cost_row(duplicated_span_id, 2.0),
            ],
        ).all()
        lone_cost_id = conn.scalar(
            insert(table_span_costs).returning(table_span_costs.c.id),
            cost_row(lone_span_id, 3.0),
        )
        assert lone_cost_id is not None

        def detail_row(span_cost_id: int, cost: float) -> dict[str, object]:
            return {
                "span_cost_id": span_cost_id,
                "token_type": "input",
                "is_prompt": True,
                "cost": cost,
                "tokens": 10,
                "cost_per_token": 0.1,
            }

        conn.execute(
            insert(table_span_cost_details),
            [
                detail_row(stale_cost_id, 1.0),
                detail_row(fresh_cost_id, 2.0),
                detail_row(lone_cost_id, 3.0),
            ],
        )
        conn.commit()
        return (
            duplicated_span_id,
            lone_span_id,
            stale_cost_id,
            fresh_cost_id,
            lone_cost_id,
            trace_id,
        )

    (
        duplicated_span_id,
        lone_span_id,
        stale_cost_id,
        fresh_cost_id,
        lone_cost_id,
        trace_id,
    ) = await _run_async(_engine, _seed)

    await _up(_engine, _alembic_config, _UP, _schema)

    def _check(conn: Connection) -> None:
        remaining_cost_ids = set(
            conn.execute(
                select(table_span_costs.c.id).where(
                    table_span_costs.c.span_rowid == duplicated_span_id
                )
            )
            .scalars()
            .all()
        )
        # Only the most recently written duplicate survives.
        assert remaining_cost_ids == {fresh_cost_id}

        remaining_detail_cost_ids = set(
            conn.execute(select(table_span_cost_details.c.span_cost_id)).scalars().all()
        )
        # The pruned duplicate's details are gone...
        assert stale_cost_id not in remaining_detail_cost_ids
        # ...but the surviving duplicate's and the unrelated span's are intact.
        assert fresh_cost_id in remaining_detail_cost_ids
        assert lone_cost_id in remaining_detail_cost_ids

        # span_rowid is now unique: a second cost row for the same span cannot commit.
        with pytest.raises((PostgreSQLIntegrityError, SQLiteIntegrityError)):
            conn.execute(
                insert(table_span_costs),
                {
                    "span_rowid": lone_span_id,
                    "trace_rowid": trace_id,
                    "span_start_time": now,
                    "total_cost": 99.0,
                },
            )
            conn.commit()
        conn.rollback()

    await _run_async(_engine, _check)
