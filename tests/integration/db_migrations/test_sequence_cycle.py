"""
Tests that serial sequences with CYCLE wrap around correctly for spans and traces.

After the migration sets MINVALUE to -2147483648 and enables CYCLE, sequences
should wrap from MAXVALUE (2147483647) back to MINVALUE and continue inserting
without error.
"""

from datetime import datetime, timezone
from secrets import token_hex

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up

_MAX_INT32 = 2147483647
_MIN_INT32 = -2147483648


async def _set_sequence(engine: AsyncEngine, seq_name: str, value: int) -> None:
    """Set a sequence to a specific value (next nextval returns value + 1)."""

    def _do(conn: Connection) -> None:
        conn.execute(text(f"SELECT setval('{seq_name}', {value}, true)"))
        conn.commit()

    await _run_async(engine, _do)


async def _insert_trace(engine: AsyncEngine, project_rowid: int) -> int:
    """Insert a trace and return its id."""

    def _do(conn: Connection) -> int:
        trace_id = conn.execute(
            text(
                "INSERT INTO traces (project_rowid, trace_id, start_time, end_time)"
                " VALUES (:project_rowid, :trace_id, :start_time, :end_time)"
                " RETURNING id"
            ),
            {
                "project_rowid": project_rowid,
                "trace_id": token_hex(16),
                "start_time": datetime.now(timezone.utc),
                "end_time": datetime.now(timezone.utc),
            },
        ).scalar()
        conn.commit()
        assert isinstance(trace_id, int)
        return trace_id

    return await _run_async(engine, _do)


async def _insert_trace_with_id(engine: AsyncEngine, trace_rowid: int, project_rowid: int) -> int:
    """Insert a trace with an explicit id and return it."""

    def _do(conn: Connection) -> int:
        trace_id = conn.execute(
            text(
                "INSERT INTO traces (id, project_rowid, trace_id, start_time, end_time)"
                " VALUES (:id, :project_rowid, :trace_id, :start_time, :end_time)"
                " RETURNING id"
            ),
            {
                "id": trace_rowid,
                "project_rowid": project_rowid,
                "trace_id": token_hex(16),
                "start_time": datetime.now(timezone.utc),
                "end_time": datetime.now(timezone.utc),
            },
        ).scalar()
        conn.commit()
        assert isinstance(trace_id, int)
        return trace_id

    return await _run_async(engine, _do)


async def _insert_span(engine: AsyncEngine, trace_rowid: int) -> int:
    """Insert a span and return its id."""

    def _do(conn: Connection) -> int:
        span_id = conn.execute(
            text(
                "INSERT INTO spans"
                " (trace_rowid, span_id, parent_id, name, span_kind,"
                "  start_time, end_time, attributes, events,"
                "  status_code, status_message,"
                "  cumulative_error_count,"
                "  cumulative_llm_token_count_prompt,"
                "  cumulative_llm_token_count_completion)"
                " VALUES"
                " (:trace_rowid, :span_id, NULL, 'test', 'INTERNAL',"
                "  :start_time, :end_time, '{}', '[]',"
                "  'UNSET', '',"
                "  0, 0, 0)"
                " RETURNING id"
            ),
            {
                "trace_rowid": trace_rowid,
                "span_id": token_hex(16),
                "start_time": datetime.now(timezone.utc),
                "end_time": datetime.now(timezone.utc),
            },
        ).scalar()
        conn.commit()
        assert isinstance(span_id, int)
        return span_id

    return await _run_async(engine, _do)


async def _insert_span_with_id(engine: AsyncEngine, span_rowid: int, trace_rowid: int) -> int:
    """Insert a span with an explicit id and return it."""

    def _do(conn: Connection) -> int:
        span_id = conn.execute(
            text(
                "INSERT INTO spans"
                " (id, trace_rowid, span_id, parent_id, name, span_kind,"
                "  start_time, end_time, attributes, events,"
                "  status_code, status_message,"
                "  cumulative_error_count,"
                "  cumulative_llm_token_count_prompt,"
                "  cumulative_llm_token_count_completion)"
                " VALUES"
                " (:id, :trace_rowid, :span_id, NULL, 'test', 'INTERNAL',"
                "  :start_time, :end_time, '{}', '[]',"
                "  'UNSET', '',"
                "  0, 0, 0)"
                " RETURNING id"
            ),
            {
                "id": span_rowid,
                "trace_rowid": trace_rowid,
                "span_id": token_hex(16),
                "start_time": datetime.now(timezone.utc),
                "end_time": datetime.now(timezone.utc),
            },
        ).scalar()
        conn.commit()
        assert isinstance(span_id, int)
        return span_id

    return await _run_async(engine, _do)


async def _get_default_project_id(engine: AsyncEngine) -> int:
    def _do(conn: Connection) -> int:
        result = conn.execute(text("SELECT id FROM projects WHERE name = 'default'")).scalar()
        assert isinstance(result, int)
        return result

    return await _run_async(engine, _do)


@pytest.mark.skipif(
    "os.environ.get('CI_TEST_DB_BACKEND', 'sqlite').lower() != 'postgresql'",
    reason="Sequence CYCLE only applies to PostgreSQL",
)
async def test_traces_and_spans_sequence_cycle(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    """Test that traces and spans sequences wrap around from MAXVALUE to MINVALUE."""
    await _up(_engine, _alembic_config, "head", _schema)
    project_id = await _get_default_project_id(_engine)
    existing_positive_trace_id = await _insert_trace_with_id(_engine, 1, project_id)
    existing_positive_span_id = await _insert_span_with_id(_engine, 1, existing_positive_trace_id)

    # Position both sequences 2 before MAXVALUE
    await _set_sequence(_engine, "traces_id_seq", _MAX_INT32 - 2)
    await _set_sequence(_engine, "spans_id_seq", _MAX_INT32 - 2)

    # Insert 4 traces: 2 before max, 2 after wrap-around
    trace_ids = [await _insert_trace(_engine, project_id) for _ in range(4)]
    assert trace_ids[0] == _MAX_INT32 - 1
    assert trace_ids[1] == _MAX_INT32
    assert trace_ids[2] == _MIN_INT32
    assert trace_ids[3] == _MIN_INT32 + 1

    # Insert 4 spans: 2 before max, 2 after wrap-around
    span_ids = [await _insert_span(_engine, trace_ids[0]) for _ in range(4)]
    assert span_ids[0] == _MAX_INT32 - 1
    assert span_ids[1] == _MAX_INT32
    assert span_ids[2] == _MIN_INT32
    assert span_ids[3] == _MIN_INT32 + 1

    # Verify the down migration succeeds and the rows are still accessible
    await _down(_engine, _alembic_config, "aba52fffe1a1", _schema)

    async def _get_all_trace_ids(engine: AsyncEngine) -> list[int]:
        def _do(conn: Connection) -> list[int]:
            rows = conn.execute(text("SELECT id FROM traces ORDER BY id")).fetchall()
            return [row[0] for row in rows]

        return await _run_async(engine, _do)

    async def _get_all_span_ids(engine: AsyncEngine) -> list[int]:
        def _do(conn: Connection) -> list[int]:
            rows = conn.execute(text("SELECT id FROM spans ORDER BY id")).fetchall()
            return [row[0] for row in rows]

        return await _run_async(engine, _do)

    assert sorted([existing_positive_trace_id, *trace_ids]) == await _get_all_trace_ids(_engine)
    assert sorted([existing_positive_span_id, *span_ids]) == await _get_all_span_ids(_engine)

    # After downgrade, sequences restart at the first unused positive id.
    new_trace_id = await _insert_trace(_engine, project_id)
    assert new_trace_id == 2
    new_span_id = await _insert_span(_engine, new_trace_id)
    assert new_span_id == 2
