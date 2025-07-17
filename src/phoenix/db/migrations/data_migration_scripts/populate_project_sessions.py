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
from datetime import datetime
from time import perf_counter
from typing import Any, Optional, Union

import sqlean
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import (
    JSON,
    Engine,
    NullPool,
    create_engine,
    event,
    func,
    insert,
    make_url,
    select,
    update,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA, get_env_database_connection_str
from phoenix.db.engines import set_postgresql_search_path


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),  # type: ignore
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


class Base(DeclarativeBase): ...


class ProjectSession(Base):
    __tablename__ = "project_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[str]
    project_id: Mapped[int]
    start_time: Mapped[datetime]
    end_time: Mapped[datetime]


class Trace(Base):
    __tablename__ = "traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_session_rowid: Mapped[Union[int, None]]
    project_rowid: Mapped[int]
    start_time: Mapped[datetime]
    end_time: Mapped[datetime]


class Span(Base):
    __tablename__ = "spans"
    id: Mapped[int] = mapped_column(primary_key=True)
    trace_rowid: Mapped[int]
    parent_id: Mapped[Optional[str]]
    attributes: Mapped[dict[str, Any]] = mapped_column(JSON_, nullable=False)


SESSION_ID = SpanAttributes.SESSION_ID.split(".")
USER_ID = SpanAttributes.USER_ID.split(".")


def populate_project_sessions(
    engine: Engine,
) -> None:
    sessions_from_span = (
        select(
            Span.attributes[SESSION_ID].as_string().label("session_id"),
            Trace.project_rowid.label("project_id"),
            Trace.start_time.label("start_time"),
            func.row_number()
            .over(
                partition_by=Span.attributes[SESSION_ID],
                order_by=[Trace.start_time, Trace.id, Span.id],
            )
            .label("rank"),
            func.max(Trace.end_time)
            .over(partition_by=Span.attributes[SESSION_ID])
            .label("end_time"),
        )
        .join_from(Span, Trace, Span.trace_rowid == Trace.id)
        .where(Span.parent_id.is_(None))
        .where(Span.attributes[SESSION_ID].as_string() != "")
        .subquery()
    )
    sessions_for_trace_id = (
        select(
            Span.trace_rowid,
            ProjectSession.id.label("project_session_rowid"),
        )
        .join_from(
            Span,
            ProjectSession,
            Span.attributes[SESSION_ID].as_string() == ProjectSession.session_id,
        )
        .where(Span.parent_id.is_(None))
        .where(Span.attributes[SESSION_ID].as_string() != "")
        .subquery()
    )
    start_time = perf_counter()
    with sessionmaker(engine).begin() as session:
        session.execute(
            insert(ProjectSession).from_select(
                [
                    "session_id",
                    "project_id",
                    "start_time",
                    "end_time",
                ],
                select(
                    sessions_from_span.c.session_id,
                    sessions_from_span.c.project_id,
                    sessions_from_span.c.start_time,
                    sessions_from_span.c.end_time,
                ).where(sessions_from_span.c.rank == 1),
            )
        )
        session.execute(
            (
                update(Trace)
                .values(project_session_rowid=sessions_for_trace_id.c.project_session_rowid)
                .where(Trace.id == sessions_for_trace_id.c.trace_rowid)
            )
        )
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
    elif backend == "postgresql":
        schema = os.getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA)
        if schema:
            print(f"Using schema: {schema}")
        else:
            print("No PostgreSQL schema set. (This is the default.)")
        ans = input("Is that correct? [y]/n: ")
        if ans.lower().startswith("n"):
            schema = input("Please enter the correct schema: ")
        engine = create_engine(
            url=sql_database_url.set(drivername="postgresql+psycopg"),
            poolclass=NullPool,
            echo=True,
        )
        if schema:
            event.listen(engine, "connect", set_postgresql_search_path(schema))
    else:
        raise ValueError(f"Unknown database backend: {backend}")
    populate_project_sessions(engine)
