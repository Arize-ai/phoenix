import json
import sqlite3
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Iterator, Optional, Tuple, cast

import numpy as np
from openinference.semconv.trace import SpanAttributes

from phoenix.trace.schemas import ComputedValues, Span, SpanContext, SpanKind, SpanStatusCode

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
    rowid INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO projects(name) VALUES('default');
CREATE TABLE traces (
    rowid INTEGER PRIMARY KEY,
    trace_id TEXT UNIQUE NOT NULL,
    project_rowid INTEGER NOT NULL,
    session_id TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    FOREIGN KEY(project_rowid) REFERENCES projects(rowid)
);
CREATE INDEX idx_trace_start_time ON traces(start_time);
CREATE TABLE spans (
    rowid INTEGER PRIMARY KEY,
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
    cumulative_error_count INTEGER NOT NULL DEFAULT 0,
    cumulative_llm_token_count_prompt INTEGER NOT NULL DEFAULT 0,
    cumulative_llm_token_count_completion INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(trace_rowid) REFERENCES traces(rowid)
);
CREATE INDEX idx_parent_span_id ON spans(parent_span_id);
PRAGMA user_version = 1;
COMMIT;
"""


class SqliteDatabase:
    def __init__(self, database: Optional[Path] = None) -> None:
        """
        :param database: The path to the database file to be opened.
        """
        self.con = sqlite3.connect(
            database=database or ":memory:",
            uri=True,
            check_same_thread=False,
        )
        # self.con.set_trace_callback(print)
        cur = self.con.cursor()
        cur.executescript(_CONFIG)
        if int(cur.execute("PRAGMA user_version;").fetchone()[0]) < 1:
            cur.executescript(_INIT_DB)

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
            cur.execute(
                """
                INSERT INTO spans(span_id, trace_rowid, parent_span_id, kind, name, start_time, end_time, attributes, events, status, status_message, cumulative_error_count, cumulative_llm_token_count_prompt, cumulative_llm_token_count_completion)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        cur = self.con.cursor()
        for span in cur.execute(
            """
            SELECT
                spans.span_id,
                traces.trace_id,
                spans.parent_span_id,
                spans.kind,
                spans.name,
                spans.start_time,
                spans.end_time,
                spans.attributes,
                spans.events,
                spans.status,
                spans.status_message,
                spans.cumulative_error_count,
                spans.cumulative_llm_token_count_prompt,
                spans.cumulative_llm_token_count_completion
            FROM spans
            JOIN traces ON traces.rowid = spans.trace_rowid
            WHERE traces.trace_id = ?
            """,
            (trace_id,),
        ).fetchall():
            start_time = datetime.fromisoformat(span[5])
            end_time = datetime.fromisoformat(span[6])
            latency_ms = (end_time - start_time).total_seconds() * 1000
            yield (
                Span(
                    name=span[4],
                    context=SpanContext(trace_id=span[1], span_id=span[0]),
                    parent_id=span[2],
                    span_kind=SpanKind(span[3]),
                    start_time=start_time,
                    end_time=end_time,
                    attributes=json.loads(span[7]),
                    events=json.loads(span[8]),
                    status_code=SpanStatusCode(span[9]),
                    status_message=span[10],
                    conversation=None,
                ),
                ComputedValues(
                    latency_ms=latency_ms,
                    cumulative_error_count=span[11],
                    cumulative_llm_token_count_prompt=span[12],
                    cumulative_llm_token_count_completion=span[13],
                    cumulative_llm_token_count_total=span[12] + span[13],
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
