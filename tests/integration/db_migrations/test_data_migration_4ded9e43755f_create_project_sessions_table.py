import json
from datetime import datetime, timedelta, timezone
from itertools import cycle
from secrets import token_bytes, token_hex, token_urlsafe
from typing import Any, Iterable, Iterator, Sequence, Union, cast

import pandas as pd
import pytest
from alembic.config import Config
from sqlalchemy import Column, Connection, MetaData, Table, insert
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.db.migrations.data_migration_scripts.populate_project_sessions import (
    populate_project_sessions,
)
from phoenix.db.models import JSON_

from . import _down, _run_async, _up, _version_num


async def test_data_migration_for_project_sessions(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        await _version_num(_engine, _schema)

    await _up(_engine, _alembic_config, "cd164e83824f", _schema)

    def _reflect_tables(conn: Connection) -> tuple[Table, Table, Table]:
        metadata = MetaData()
        metadata.reflect(bind=conn)
        t_projects = metadata.tables["projects"]
        t_traces = metadata.tables["traces"]
        t_spans = Table(
            "spans",
            MetaData(),
            Column("attributes", JSON_),
            Column("events", JSON_),
            autoload_with=conn,
        )
        return t_projects, t_traces, t_spans

    table_projects, table_traces, table_spans = await _run_async(_engine, _reflect_tables)

    def time_gen(
        t: datetime,
        delta: timedelta = timedelta(seconds=10),
    ) -> Iterator[datetime]:
        while True:
            yield t
            t += delta

    gen_time = time_gen(datetime.now(timezone.utc))

    def rand_id_gen() -> Iterator[Union[str, int]]:
        while True:
            yield token_urlsafe(16)
            yield int.from_bytes(token_bytes(4), "big")

    gen_session_id = rand_id_gen()
    gen_user_id = rand_id_gen()

    def rand_session_attr() -> dict[str, Any]:
        return {"session": {"id": next(gen_session_id)}, "user": {"id": next(gen_user_id)}}

    num_project_sessions = 7
    num_projects = 5
    num_traces_per_project = 11
    num_spans_per_trace = 3

    session_attrs = [rand_session_attr() for _ in range(num_project_sessions)]
    session_attrs_iter = cycle(session_attrs)

    def get_spans(traces: Iterable[tuple[int, datetime]]) -> Iterator[dict[str, Any]]:
        for trace_rowid, start_time in traces:
            t = time_gen(start_time)
            parent_id = None
            for _ in range(num_spans_per_trace):
                # session attributes on non-root spans should be ignored
                attributes = rand_session_attr() if parent_id else next(session_attrs_iter)
                span_id = token_hex(8)
                yield {
                    "span_id": span_id,
                    "parent_id": parent_id,
                    "name": token_urlsafe(16),
                    "span_kind": token_urlsafe(16),
                    "trace_rowid": trace_rowid,
                    "start_time": next(t) if parent_id else start_time,
                    "end_time": next(t),
                    "status_message": token_urlsafe(16),
                    "cumulative_error_count": 0,
                    "cumulative_llm_token_count_prompt": 0,
                    "cumulative_llm_token_count_completion": 0,
                    "events": [],
                    "attributes": attributes,
                }
                parent_id = span_id

    def _insert_data(conn: Connection) -> None:
        project_rowids = conn.scalars(
            insert(table_projects).returning(table_projects.c.id),
            [{"name": token_urlsafe(16)} for _ in range(num_projects)],
        ).all()
        traces = cast(
            Sequence[tuple[int, datetime]],
            conn.execute(
                insert(table_traces).returning(
                    table_traces.c.id,
                    table_traces.c.start_time,
                ),
                [
                    {
                        "trace_id": token_hex(16),
                        "project_rowid": project_rowid,
                        "start_time": next(gen_time),
                        "end_time": next(gen_time),
                    }
                    for _ in range(num_traces_per_project)
                    for project_rowid in project_rowids
                ],
            ).all(),
        )
        conn.execute(insert(table_spans), list(get_spans(traces)))
        conn.commit()

    await _run_async(_engine, _insert_data)

    for _ in range(2):
        await _down(_engine, _alembic_config, "cd164e83824f", _schema)

        def _check_no_project_sessions(conn: Connection) -> None:
            metadata = MetaData()
            metadata.reflect(bind=conn)
            assert metadata.tables.get("project_sessions") is None

        await _run_async(_engine, _check_no_project_sessions)
        await _up(_engine, _alembic_config, "4ded9e43755f", _schema)

        def _populate(conn: Connection) -> None:
            populate_project_sessions(conn)

        await _run_async(_engine, _populate)

        def _read_tables(conn: Connection) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
            df_spans = pd.read_sql_table("spans", conn)
            df_traces = pd.read_sql_table("traces", conn)
            df_project_sessions = pd.read_sql_table("project_sessions", conn)
            return df_spans, df_traces, df_project_sessions

        df_spans, df_traces, df_project_sessions = await _run_async(_engine, _read_tables)
        # Set index after reading since read_sql_table with index_col
        # may not work consistently across sync/async
        df_spans = df_spans.set_index("id")
        df_traces = df_traces.set_index("id")
        df_project_sessions = df_project_sessions.set_index("id")

        assert len(df_project_sessions) == num_project_sessions
        assert len(df_traces) == num_projects * num_traces_per_project
        assert len(df_spans) == len(df_traces) * num_spans_per_trace

        assert df_project_sessions.session_id.nunique() == num_project_sessions
        assert df_traces.project_session_rowid.nunique() == num_project_sessions

        df_span_session_attrs = df_spans.apply(
            lambda row: pd.Series(
                {
                    "trace_rowid": row["trace_rowid"],
                    "span_id": row["span_id"],
                    "parent_id": row["parent_id"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "session_id": str(
                        (
                            json.loads(row["attributes"])  # type: ignore[unused-ignore]
                            if _engine.dialect.name == "sqlite"
                            else row["attributes"]
                        )["session"]["id"]
                    ),  # type: ignore[dict-item, unused-ignore]
                },
            ),
            axis=1,
        )
        assert sum(df_span_session_attrs.session_id.isna()) == 0

        df_traces_joined_spans = pd.merge(
            df_traces.loc[:, ["project_session_rowid", "start_time", "end_time", "project_rowid"]],
            df_span_session_attrs.loc[df_span_session_attrs.parent_id.isna()],
            how="left",
            left_index=True,
            right_on="trace_rowid",
            suffixes=("_trace", ""),
        )
        df_project_sessions_joined_spans = pd.merge(
            df_project_sessions,
            df_traces_joined_spans,
            how="left",
            left_index=True,
            right_on="project_session_rowid",
            suffixes=("", "_span"),
        ).sort_values(["session_id", "start_time_trace"])

        assert df_project_sessions_joined_spans.span_id.nunique() == len(
            df_project_sessions_joined_spans
        )
        assert (
            df_project_sessions_joined_spans.session_id
            == df_project_sessions_joined_spans.session_id_span
        ).all()
        assert (
            df_project_sessions_joined_spans.groupby("session_id")
            .apply(lambda s: s.end_time.min() == s.end_time_trace.max())  # type: ignore[attr-defined, unused-ignore]
            .all()
        )

        is_first = df_project_sessions_joined_spans.groupby("session_id").cumcount() == 0

        assert (
            df_project_sessions_joined_spans.loc[is_first]
            .apply(lambda row: row.start_time == row.start_time_trace, axis=1)
            .all()
        )
        assert (
            df_project_sessions_joined_spans.loc[is_first]
            .apply(lambda row: row.project_id == row.project_rowid, axis=1)
            .all()
        )
