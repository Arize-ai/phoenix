import json
import sqlite3
from datetime import datetime
from enum import Enum
from pathlib import Path
from sqlite3 import Connection
from typing import Any, Iterator, Optional, Tuple, cast

import numpy as np
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import sessionmaker

from phoenix.db.models import Base, Trace
from phoenix.trace.schemas import (
    ComputedValues,
    Span,
    SpanContext,
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)

_CONFIG = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = OFF;
PRAGMA cache_size = -32000;
PRAGMA busy_timeout = 10000;
"""

_INIT_DB = """
BEGIN;
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO projects(name) VALUES('default');
CREATE TABLE traces (
    id INTEGER PRIMARY KEY,
    trace_id TEXT UNIQUE NOT NULL,
    project_rowid INTEGER NOT NULL,
    session_id TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    FOREIGN KEY(project_rowid) REFERENCES projects(id)
);
CREATE INDEX idx_trace_start_time ON traces(start_time);
CREATE TABLE spans (
    id INTEGER PRIMARY KEY,
    span_id TEXT UNIQUE NOT NULL,
    trace_rowid INTEGER NOT NULL,
    parent_span_id TEXT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    attributes JSON,
    events JSON,
    status TEXT CHECK(status IN ('UNSET','OK','ERROR')) NOT NULL DEFAULT('UNSET'),
    status_message TEXT,
    latency_ms REAL,
    cumulative_error_count INTEGER NOT NULL DEFAULT 0,
    cumulative_llm_token_count_prompt INTEGER NOT NULL DEFAULT 0,
    cumulative_llm_token_count_completion INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(trace_rowid) REFERENCES traces(id)
);
CREATE INDEX idx_parent_span_id ON spans(parent_span_id);
PRAGMA user_version = 1;
COMMIT;
"""


_MEM_DB_STR = "file::memory:?cache=shared"


def _mem_db_creator() -> Any:
    return sqlite3.connect(_MEM_DB_STR, uri=True)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection: Connection, _: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -32000;")
    cursor.execute("PRAGMA busy_timeout = 10000;")
    cursor.close()


class SqliteDatabase:
    def __init__(self, db_path: Optional[Path] = None) -> None:
        """
        :param db_path: The path to the database file to be opened.
        """
        self.con = sqlite3.connect(
            database=db_path or _MEM_DB_STR,
            uri=True,
            check_same_thread=False,
        )
        # self.con.set_trace_callback(print)
        cur = self.con.cursor()
        cur.executescript(_CONFIG)

        engine = (
            create_engine(f"sqlite:///{db_path}", echo=True)
            if db_path
            else create_engine(
                "sqlite:///:memory:",
                echo=True,
                creator=_mem_db_creator,
            )
        )
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine)

    def insert_span(self, span: Span, project_name: str) -> None:
        cur = self.con.cursor()
        cur.execute("BEGIN;")
        try:
            if not (
                projects := cur.execute(
                    "SELECT rowid FROM projects WHERE name = ?;",
                    (project_name,),
                ).fetchone()
            ):
                projects = cur.execute(
                    "INSERT INTO projects(name) VALUES(?) RETURNING rowid;",
                    (project_name,),
                ).fetchone()
            project_rowid = projects[0]
            if (
                trace_row := cur.execute(
                    """
                INSERT INTO traces(trace_id, project_rowid, session_id, start_time, end_time)
                VALUES(?,?,?,?,?)
                ON CONFLICT DO UPDATE SET
                start_time = CASE WHEN excluded.start_time < start_time THEN excluded.start_time ELSE start_time END,
                end_time = CASE WHEN end_time < excluded.end_time THEN excluded.end_time ELSE end_time END
                WHERE excluded.start_time < start_time OR end_time < excluded.end_time
                RETURNING rowid;
                """,  # noqa E501
                    (
                        span.context.trace_id,
                        project_rowid,
                        None,
                        span.start_time,
                        span.end_time,
                    ),
                ).fetchone()
            ) is None:
                trace_row = cur.execute(
                    "SELECT rowid from traces where trace_id = ?", (span.context.trace_id,)
                ).fetchone()
            trace_rowid = trace_row[0]
            cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
            cumulative_llm_token_count_prompt = cast(
                int, span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, 0)
            )
            cumulative_llm_token_count_completion = cast(
                int, span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, 0)
            )
            if accumulation := cur.execute(
                """
                SELECT
                sum(cumulative_error_count),
                sum(cumulative_llm_token_count_prompt),
                sum(cumulative_llm_token_count_completion)
                FROM spans
                WHERE parent_span_id = ?
                """,  # noqa E501
                (span.context.span_id,),
            ).fetchone():
                cumulative_error_count += cast(int, accumulation[0] or 0)
                cumulative_llm_token_count_prompt += cast(int, accumulation[1] or 0)
                cumulative_llm_token_count_completion += cast(int, accumulation[2] or 0)
            latency_ms = (span.end_time - span.start_time).total_seconds() * 1000
            cur.execute(
                """
                INSERT INTO spans(span_id, trace_rowid, parent_span_id, kind, name, start_time, end_time, attributes, events, status, status_message, latency_ms, cumulative_error_count, cumulative_llm_token_count_prompt, cumulative_llm_token_count_completion)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                RETURNING rowid;
                """,  # noqa E501
                (
                    span.context.span_id,
                    trace_rowid,
                    span.parent_id,
                    span.span_kind.value,
                    span.name,
                    span.start_time,
                    span.end_time,
                    json.dumps(span.attributes, cls=_Encoder),
                    json.dumps(span.events, cls=_Encoder),
                    span.status_code.value,
                    span.status_message,
                    latency_ms,
                    cumulative_error_count,
                    cumulative_llm_token_count_prompt,
                    cumulative_llm_token_count_completion,
                ),
            )
            parent_id = span.parent_id
            while parent_id:
                if parent_span := cur.execute(
                    """
                    SELECT rowid, parent_span_id
                    FROM spans
                    WHERE span_id = ?
                    """,
                    (parent_id,),
                ).fetchone():
                    rowid, parent_id = parent_span[0], parent_span[1]
                    cur.execute(
                        """
                        UPDATE spans SET
                        cumulative_error_count = cumulative_error_count + ?,
                        cumulative_llm_token_count_prompt = cumulative_llm_token_count_prompt + ?,
                        cumulative_llm_token_count_completion = cumulative_llm_token_count_completion + ?
                        WHERE rowid = ?;
                        """,  # noqa E501
                        (
                            cumulative_error_count,
                            cumulative_llm_token_count_prompt,
                            cumulative_llm_token_count_completion,
                            rowid,
                        ),
                    )
                else:
                    break
        except Exception:
            cur.execute("ROLLBACK;")
        else:
            cur.execute("COMMIT;")

    def get_projects(self) -> Iterator[Tuple[int, str]]:
        cur = self.con.cursor()
        for project in cur.execute("SELECT rowid, name FROM projects;").fetchall():
            yield cast(Tuple[int, str], (project[0], project[1]))

    def trace_count(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int:
        query = """
            SELECT COUNT(*)
            FROM traces
            JOIN projects ON projects.rowid = traces.project_rowid
            WHERE projects.name = ?
            """
        cur = self.con.cursor()
        if start_time and stop_time:
            cur = cur.execute(
                query + " AND ? <= traces.start_time AND traces.start_time < ?;",
                (project_name, start_time, stop_time),
            )
        elif start_time:
            cur = cur.execute(query + " AND ? <= traces.start_time;", (project_name, start_time))
        elif stop_time:
            cur = cur.execute(query + " AND traces.start_time < ?;", (project_name, stop_time))
        else:
            cur = cur.execute(query + ";", (project_name,))
        if res := cur.fetchone():
            return cast(int, res[0] or 0)
        return 0

    def span_count(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int:
        query = """
            SELECT COUNT(*)
            FROM spans
            JOIN traces ON traces.rowid = spans.trace_rowid
            JOIN projects ON projects.rowid = traces.project_rowid
            WHERE projects.name = ?
            """
        cur = self.con.cursor()
        if start_time and stop_time:
            cur = cur.execute(
                query + " AND ? <= spans.start_time AND spans.start_time < ?;",
                (project_name, start_time, stop_time),
            )
        elif start_time:
            cur = cur.execute(query + " AND ? <= spans.start_time;", (project_name, start_time))
        elif stop_time:
            cur = cur.execute(query + " AND spans.start_time < ?;", (project_name, stop_time))
        else:
            cur = cur.execute(query + ";", (project_name,))
        if res := cur.fetchone():
            return cast(int, res[0] or 0)
        return 0

    def llm_token_count_total(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int:
        query = """
        SELECT
        SUM(COALESCE(json_extract(spans.attributes, '$."llm.token_count.prompt"'), 0) + 
            COALESCE(json_extract(spans.attributes, '$."llm.token_count.completion"'), 0))
        FROM spans
        JOIN traces ON traces.rowid = spans.trace_rowid
        JOIN projects ON projects.rowid = traces.project_rowid
        WHERE projects.name = ?
        """  # noqa E501
        cur = self.con.cursor()
        if start_time and stop_time:
            cur = cur.execute(
                query + " AND ? <= spans.start_time AND spans.start_time < ?;",
                (project_name, start_time, stop_time),
            )
        elif start_time:
            cur = cur.execute(query + " AND ? <= spans.start_time;", (project_name, start_time))
        elif stop_time:
            cur = cur.execute(query + " AND spans.start_time < ?;", (project_name, stop_time))
        else:
            cur = cur.execute(query + ";", (project_name,))
        if res := cur.fetchone():
            return cast(int, res[0] or 0)
        return 0

    def get_trace(self, trace_id: str) -> Iterator[Tuple[Span, ComputedValues]]:
        with self.Session.begin() as session:
            trace = session.query(Trace).where(Trace.trace_id == trace_id).one_or_none()
            if not trace:
                return
            for span in trace.spans:
                yield (
                    Span(
                        name=span.name,
                        context=SpanContext(trace_id=span.trace.trace_id, span_id=span.span_id),
                        parent_id=span.parent_span_id,
                        span_kind=SpanKind(span.kind),
                        start_time=span.start_time,
                        end_time=span.end_time,
                        attributes=span.attributes,
                        events=[
                            SpanEvent(
                                name=obj["name"],
                                attributes=obj["attributes"],
                                timestamp=obj["timestamp"],
                            )
                            for obj in span.events
                        ],
                        status_code=SpanStatusCode(span.status),
                        status_message=span.status_message,
                        conversation=None,
                    ),
                    ComputedValues(
                        latency_ms=span.latency_ms,
                        cumulative_error_count=span.cumulative_error_count,
                        cumulative_llm_token_count_prompt=span.cumulative_llm_token_count_prompt,
                        cumulative_llm_token_count_completion=span.cumulative_llm_token_count_completion,
                        cumulative_llm_token_count_total=span.cumulative_llm_token_count_prompt
                        + span.cumulative_llm_token_count_completion,
                    ),
                )


class _Encoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, np.ndarray):
            return list(obj)
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)
