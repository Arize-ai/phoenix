import json
from datetime import datetime, timedelta, timezone
from itertools import cycle
from secrets import token_bytes, token_hex, token_urlsafe
from typing import Any, Iterable, Iterator, Sequence, Union, cast

import pandas as pd
import pytest
from alembic.config import Config
from phoenix.db.migrations.data_migration_scripts.populate_project_sessions import (
    populate_project_sessions,
)
from phoenix.db.models import JSON_
from sqlalchemy import Column, Engine, MetaData, Table, insert

from . import _down, _up, _version_num


def test_data_migration_for_project_sessions(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine, _schema)

    _up(_engine, _alembic_config, "cd164e83824f", _schema)

    metadata = MetaData()
    metadata.reflect(bind=_engine)
    table_projects = metadata.tables["projects"]
    table_traces = metadata.tables["traces"]
    table_spans = Table(
        "spans",
        MetaData(),
        Column("attributes", JSON_),
        Column("events", JSON_),
        autoload_with=_engine,
    )

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

    with _engine.connect() as conn:
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

    for _ in range(2):
        _down(_engine, _alembic_config, "cd164e83824f", _schema)
        metadata = MetaData()
        metadata.reflect(bind=_engine)
        assert metadata.tables.get("project_sessions") is None
        _up(_engine, _alembic_config, "4ded9e43755f", _schema)
        populate_project_sessions(_engine)

        with _engine.connect() as conn:
            df_spans = pd.read_sql_table("spans", conn, index_col="id")
            df_traces = pd.read_sql_table("traces", conn, index_col="id")
            df_project_sessions = pd.read_sql_table("project_sessions", conn, index_col="id")

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
