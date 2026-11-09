from datetime import datetime, timezone
from secrets import token_hex

import pytest
from alembic.config import Config
from sqlalchemy import Column, Connection, MetaData, Table, func, insert, select
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.db.models import JSON_

from . import _down, _run_async, _up, _version_num

_BEFORE = "4aad9107d196"
_AFTER = "c3f8a1d24b70"


def _reflect(conn: Connection) -> dict[str, Table]:
    metadata = MetaData()
    metadata.reflect(bind=conn)
    tables = dict(metadata.tables)
    tables["spans"] = Table(
        "spans",
        MetaData(),
        Column("attributes", JSON_),
        Column("events", JSON_),
        autoload_with=conn,
    )
    return tables


def _insert_cost(conn: Connection, tables: dict[str, Table], span_rowid: int) -> int:
    span_cost_id: int = conn.scalar(
        insert(tables["span_costs"])
        .values(
            span_rowid=span_rowid,
            trace_rowid=select(tables["spans"].c.trace_rowid)
            .where(tables["spans"].c.id == span_rowid)
            .scalar_subquery(),
            span_start_time=datetime.now(timezone.utc),
            total_cost=1.0,
        )
        .returning(tables["span_costs"].c.id)
    )
    conn.execute(
        insert(tables["span_cost_details"]).values(
            span_cost_id=span_cost_id, token_type="input", is_prompt=True, cost=1.0
        )
    )
    return span_cost_id


def _insert_two_spans(conn: Connection, tables: dict[str, Table]) -> list[int]:
    now = datetime.now(timezone.utc)
    project_rowid = conn.scalar(
        insert(tables["projects"]).values(name=token_hex(8)).returning(tables["projects"].c.id)
    )
    trace_rowid = conn.scalar(
        insert(tables["traces"])
        .values(project_rowid=project_rowid, trace_id=token_hex(16), start_time=now, end_time=now)
        .returning(tables["traces"].c.id)
    )
    span = {
        "trace_rowid": trace_rowid,
        "name": "llm",
        "span_kind": "LLM",
        "start_time": now,
        "end_time": now,
        "attributes": {},
        "events": [],
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 0,
        "cumulative_llm_token_count_completion": 0,
    }
    return list(
        conn.scalars(
            insert(tables["spans"]).returning(tables["spans"].c.id),
            [{**span, "span_id": token_hex(8)} for _ in range(2)],
        )
    )


async def test_data_migration_unique_span_costs_span_rowid(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        await _version_num(_engine, _schema)

    await _up(_engine, _alembic_config, _BEFORE, _schema)
    tables = await _run_async(_engine, _reflect)

    def _seed(conn: Connection) -> list[int]:
        span_rowids = _insert_two_spans(conn, tables)
        _insert_cost(conn, tables, span_rowids[1])
        conn.commit()
        return span_rowids

    duplicated, single = await _run_async(_engine, _seed)

    def _insert_duplicates(conn: Connection) -> int:
        latest = [_insert_cost(conn, tables, duplicated) for _ in range(3)][-1]
        conn.commit()
        return latest

    def _read(conn: Connection) -> tuple[dict[int, list[int]], int | None]:
        costs, details = tables["span_costs"], tables["span_cost_details"]
        by_span: dict[int, list[int]] = {}
        for span_rowid, span_cost_id in conn.execute(select(costs.c.span_rowid, costs.c.id)):
            by_span.setdefault(span_rowid, []).append(span_cost_id)
        orphans = conn.scalar(
            select(func.count())
            .select_from(details)
            .where(details.c.span_cost_id.not_in(select(costs.c.id)))
        )
        return by_span, orphans

    def _insert_second_cost(conn: Connection) -> None:
        _insert_cost(conn, tables, single)
        conn.commit()

    for _ in range(2):
        latest = await _run_async(_engine, _insert_duplicates)
        await _up(_engine, _alembic_config, _AFTER, _schema)

        by_span, orphans = await _run_async(_engine, _read)
        assert by_span == {duplicated: [latest], single: by_span[single]}
        assert len(by_span[single]) == 1
        assert orphans == 0

        with pytest.raises(BaseException, match=r"(?i)unique"):
            await _run_async(_engine, _insert_second_cost)

        await _down(_engine, _alembic_config, _BEFORE, _schema)
