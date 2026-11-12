from datetime import datetime, timezone
from secrets import token_hex
from typing import Any

from alembic.config import Config
from sqlalchemy import Connection, MetaData, Table, insert, inspect, select
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up

_DOWN = "b109a51ab9b6"
_UP = "31ec4c6dcfd4"

_TOTALS = {"total_cost": 1.5, "total_tokens": 30.0}
_OLD = {
    "prompt_cost": 1.0,
    "prompt_tokens": 10.0,
    "completion_cost": 0.5,
    "completion_tokens": 20.0,
}
_NEW = {
    "input_cost": 1.0,
    "input_tokens": 10.0,
    "output_cost": 0.5,
    "output_tokens": 20.0,
}


def _table(conn: Connection, name: str, schema: str) -> Table:
    return Table(name, MetaData(), autoload_with=conn, schema=schema or None)


def _columns(conn: Connection, schema: str) -> set[str]:
    columns = inspect(conn).get_columns("span_costs", schema=schema or None)
    return {column["name"] for column in columns}


def _insert_span_cost(schema: str) -> Any:
    def _do(conn: Connection) -> int:
        now = datetime.now(timezone.utc)
        projects = _table(conn, "projects", schema)
        traces = _table(conn, "traces", schema)
        spans = _table(conn, "spans", schema)
        span_costs = _table(conn, "span_costs", schema)
        project_rowid = conn.scalar(
            insert(projects).values(name=token_hex(8)).returning(projects.c.id)
        )
        trace_rowid = conn.scalar(
            insert(traces)
            .values(
                trace_id=token_hex(16),
                project_rowid=project_rowid,
                start_time=now,
                end_time=now,
            )
            .returning(traces.c.id)
        )
        span_rowid = conn.scalar(
            insert(spans)
            .values(
                trace_rowid=trace_rowid,
                span_id=token_hex(8),
                name="llm",
                span_kind="LLM",
                start_time=now,
                end_time=now,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(spans.c.id)
        )
        span_cost_id = conn.scalar(
            insert(span_costs)
            .values(
                span_rowid=span_rowid,
                trace_rowid=trace_rowid,
                span_start_time=now,
                **_TOTALS,
                **_OLD,
            )
            .returning(span_costs.c.id)
        )
        conn.commit()
        assert isinstance(span_cost_id, int)
        return span_cost_id

    return _do


def _read(span_cost_id: int, names: dict[str, float], schema: str) -> Any:
    def _do(conn: Connection) -> dict[str, Any]:
        span_costs = _table(conn, "span_costs", schema)
        columns = [span_costs.c[name] for name in (*names, *_TOTALS)]
        row = conn.execute(select(*columns).where(span_costs.c.id == span_cost_id)).one()
        return dict(row._mapping)

    return _do


async def test_rename_span_costs_prompt_completion_to_input_output(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    span_cost_id = await _run_async(_engine, _insert_span_cost(_schema))

    await _up(_engine, _alembic_config, _UP, _schema)

    columns = await _run_async(_engine, lambda conn: _columns(conn, _schema))
    assert columns.isdisjoint(_OLD)
    assert set(_NEW) <= columns
    assert await _run_async(_engine, _read(span_cost_id, _NEW, _schema)) == {**_NEW, **_TOTALS}

    await _down(_engine, _alembic_config, _DOWN, _schema)

    columns = await _run_async(_engine, lambda conn: _columns(conn, _schema))
    assert columns.isdisjoint(_NEW)
    assert set(_OLD) <= columns
    assert await _run_async(_engine, _read(span_cost_id, _OLD, _schema)) == {**_OLD, **_TOTALS}
