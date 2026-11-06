# /// script
# dependencies = [
#   "arize-phoenix[pg]",
# ]
# ///
"""
Populate the `project_sessions` table with data from the traces and spans tables.

Environment variables.

- `PHOENIX_SQL_DATABASE_URL` must be set to the database connection string.
- (optional) Postgresql schema can be set via `PHOENIX_SQL_DATABASE_SCHEMA`.
"""

import os
from time import perf_counter
from typing import Any, Union

import sqlean
from sqlalchemy import (
    Connection,
    Engine,
    NullPool,
    create_engine,
    make_url,
    text,
)

from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA, get_env_database_connection_str

_SQLITE_INSERT_SESSIONS = text("""
    INSERT INTO project_sessions (session_id, project_id, start_time, end_time)
    SELECT
        sub.session_id,
        sub.project_id,
        sub.start_time,
        sub.end_time
    FROM (
        SELECT
            CAST(JSON_EXTRACT(s.attributes, '$.session.id') AS VARCHAR) AS session_id,
            t.project_rowid AS project_id,
            t.start_time AS start_time,
            ROW_NUMBER() OVER (
                PARTITION BY JSON_EXTRACT(s.attributes, '$.session.id')
                ORDER BY t.start_time, t.id, s.id
            ) AS rank,
            MAX(t.end_time) OVER (
                PARTITION BY JSON_EXTRACT(s.attributes, '$.session.id')
            ) AS end_time
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        WHERE s.parent_id IS NULL
        AND CAST(JSON_EXTRACT(s.attributes, '$.session.id') AS VARCHAR) != ''
    ) sub
    WHERE sub.rank = 1
""")

_SQLITE_UPDATE_TRACES = text("""
    UPDATE traces
    SET project_session_rowid = (
        SELECT ps.id
        FROM project_sessions ps
        JOIN spans s ON CAST(JSON_EXTRACT(s.attributes, '$.session.id') AS VARCHAR) = ps.session_id
        WHERE s.trace_rowid = traces.id
        AND s.parent_id IS NULL
        AND CAST(JSON_EXTRACT(s.attributes, '$.session.id') AS VARCHAR) != ''
    )
    WHERE EXISTS (
        SELECT 1
        FROM spans s
        WHERE s.trace_rowid = traces.id
        AND s.parent_id IS NULL
        AND CAST(JSON_EXTRACT(s.attributes, '$.session.id') AS VARCHAR) != ''
    )
""")

_PG_INSERT_SESSIONS = text("""
    INSERT INTO project_sessions (session_id, project_id, start_time, end_time)
    SELECT
        sub.session_id,
        sub.project_id,
        sub.start_time,
        sub.end_time
    FROM (
        SELECT
            CAST(s.attributes #>> '{session,id}' AS VARCHAR) AS session_id,
            t.project_rowid AS project_id,
            t.start_time AS start_time,
            ROW_NUMBER() OVER (
                PARTITION BY s.attributes #> '{session,id}'
                ORDER BY t.start_time, t.id, s.id
            ) AS rank,
            MAX(t.end_time) OVER (
                PARTITION BY s.attributes #> '{session,id}'
            ) AS end_time
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        WHERE s.parent_id IS NULL
        AND CAST(s.attributes #>> '{session,id}' AS VARCHAR) != ''
    ) sub
    WHERE sub.rank = 1
""")

_PG_UPDATE_TRACES = text("""
    UPDATE traces
    SET project_session_rowid = sub.project_session_rowid
    FROM (
        SELECT
            s.trace_rowid,
            ps.id AS project_session_rowid
        FROM spans s
        JOIN project_sessions ps
            ON CAST(s.attributes #>> '{session,id}' AS VARCHAR) = ps.session_id
        WHERE s.parent_id IS NULL
        AND CAST(s.attributes #>> '{session,id}' AS VARCHAR) != ''
    ) sub
    WHERE traces.id = sub.trace_rowid
""")


def populate_project_sessions(
    engine_or_connection: Union[Engine, Connection],
) -> None:
    start_time = perf_counter()
    if isinstance(engine_or_connection, Connection):
        conn = engine_or_connection
        dialect = conn.engine.dialect.name
        insert_stmt = _PG_INSERT_SESSIONS if dialect == "postgresql" else _SQLITE_INSERT_SESSIONS
        update_stmt = _PG_UPDATE_TRACES if dialect == "postgresql" else _SQLITE_UPDATE_TRACES
        conn.execute(insert_stmt)
        conn.execute(update_stmt)
        conn.commit()
    else:
        engine = engine_or_connection
        dialect = engine.dialect.name
        insert_stmt = _PG_INSERT_SESSIONS if dialect == "postgresql" else _SQLITE_INSERT_SESSIONS
        update_stmt = _PG_UPDATE_TRACES if dialect == "postgresql" else _SQLITE_UPDATE_TRACES
        with engine.connect() as conn:
            conn.execute(insert_stmt)
            conn.execute(update_stmt)
            conn.commit()
    elapsed_time = perf_counter() - start_time
    print(f"✅ Populated project_sessions in {elapsed_time:.3f} seconds.")


if __name__ == "__main__":
    sql_database_url = make_url(get_env_database_connection_str())
    print(f"Using database URL: {sql_database_url}")
    ans = input("Is that correct? [y]/n: ")
    if ans.lower().startswith("n"):
        url = input("Please enter the correct database URL: ")
        sql_database_url = make_url(url)
    backend = sql_database_url.get_backend_name()
    if backend == "sqlite":
        file = sql_database_url.database
        engine = create_engine(
            url=sql_database_url.set(drivername="sqlite"),
            creator=lambda: sqlean.connect(f"file:///{file}", uri=True),
            poolclass=NullPool,
            echo=True,
        )
        populate_project_sessions(engine)
    elif backend == "postgresql":
        import asyncio

        from sqlalchemy.ext.asyncio import create_async_engine

        from phoenix.db.engines import get_async_db_url

        schema = os.getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA)
        if schema:
            print(f"Using schema: {schema}")
        else:
            print("No PostgreSQL schema set. (This is the default.)")
        ans = input("Is that correct? [y]/n: ")
        if ans.lower().startswith("n"):
            schema = input("Please enter the correct schema: ")
        async_url = get_async_db_url(sql_database_url.render_as_string(hide_password=False))
        async_engine = create_async_engine(url=async_url, poolclass=NullPool, echo=True)

        def _run_with_schema(connection: Any) -> None:
            if schema:
                connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
                connection.execute(text(f"SET search_path TO {schema}"))
                connection.commit()
            populate_project_sessions(connection)

        async def _run() -> None:
            async with async_engine.connect() as conn:
                await conn.run_sync(_run_with_schema)
            await async_engine.dispose()

        asyncio.run(_run())
    else:
        raise ValueError(f"Unknown database backend: {backend}")
