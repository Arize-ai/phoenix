"""SQLite store for benchmark results.

One ``bench.db`` across every run, so runs can be compared with a query and the
file can be handed to a teammate as-is. Rows are written as each cell finishes,
which is what lets a served report show progress live and a killed run leave
usable results behind.

Raw transcripts stay on disk as the artifact of record; this holds only what was
derived from them, so re-deriving is always possible.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable, Optional

#: Column name -> SQLite type. The single source of truth: the CREATE, the
#: INSERT, and the migration all read this, so adding a metric means adding one
#: line here.
RUN_COLUMNS: dict[str, str] = {
    "run_id": "TEXT NOT NULL",
    "label": "TEXT NOT NULL",
    "task": "TEXT NOT NULL",
    "trial": "INTEGER NOT NULL",
    "task_class": "TEXT",
    # Content hash of the prompt that produced this row. Lets a stale pairing --
    # results kept beside a since-edited task -- be found with a join instead of
    # going unnoticed.
    "task_hash": "TEXT",
    "model": "TEXT",
    "effort": "TEXT",
    "cli_version": "TEXT",
    "phoenix_git_sha": "TEXT",
    "total_context_tokens": "INTEGER",
    "peak_context_tokens": "INTEGER",
    "input_tokens": "INTEGER",
    "output_tokens": "INTEGER",
    "cache_creation_input_tokens": "INTEGER",
    "cache_read_input_tokens": "INTEGER",
    "cache_read_ratio": "REAL",
    "thinking_tokens": "INTEGER",
    "num_turns": "INTEGER",
    "duration_ms": "INTEGER",
    "duration_api_ms": "INTEGER",
    "ttft_ms": "INTEGER",
    "total_cost_usd": "REAL",
    "n_tool_calls": "INTEGER",
    "n_execute_calls": "INTEGER",
    "n_discovery_calls": "INTEGER",
    "n_tool_errors": "INTEGER",
    "n_sandbox_errors": "INTEGER",
    "code_bytes": "INTEGER",
    "tool_result_bytes": "INTEGER",
    "max_tool_result_bytes": "INTEGER",
    "mcp_status": "TEXT",
    "n_mcp_tools": "INTEGER",
    "subtype": "TEXT",
    "api_error_status": "TEXT",
    "n_permission_denials": "INTEGER",
    "invalid": "INTEGER",
    "invalid_reason": "TEXT",
    "passed": "INTEGER",
    "graded": "INTEGER",
    "session_id": "TEXT",
    "answer": "TEXT",
    "transcript": "TEXT",
}

TURN_COLUMNS: dict[str, str] = {
    "run_id": "TEXT NOT NULL",
    "label": "TEXT NOT NULL",
    "task": "TEXT NOT NULL",
    "trial": "INTEGER NOT NULL",
    "task_class": "TEXT",
    "turn_idx": "INTEGER NOT NULL",
    "input_tokens": "INTEGER",
    "output_tokens": "INTEGER",
    "cache_creation_input_tokens": "INTEGER",
    "cache_read_input_tokens": "INTEGER",
}

TOOL_CALL_COLUMNS: dict[str, str] = {
    "run_id": "TEXT NOT NULL",
    "label": "TEXT NOT NULL",
    "task": "TEXT NOT NULL",
    "trial": "INTEGER NOT NULL",
    "task_class": "TEXT",
    "call_idx": "INTEGER NOT NULL",
    "turn_idx": "INTEGER",
    "tool_name": "TEXT",
    "short_name": "TEXT",
    "is_discovery": "INTEGER",
    "input_bytes": "INTEGER",
    "result_bytes": "INTEGER",
    "is_error": "INTEGER",
    "error_kind": "TEXT",
}

TASK_COLUMNS: dict[str, str] = {
    # Keyed by content, not name: editing a prompt adds a version rather than
    # overwriting the definition older results were produced under.
    "task_hash": "TEXT NOT NULL",
    "name": "TEXT NOT NULL",
    "task_class": "TEXT",
    "prompt": "TEXT",
    "expect_json": "TEXT",
    "structured": "INTEGER",
}

META_COLUMNS: dict[str, str] = {
    "run_id": "TEXT NOT NULL",
    "created_at": "TEXT",
    "model": "TEXT",
    "effort": "TEXT",
    "trials": "INTEGER",
    "phoenix_git_sha": "TEXT",
    "tracing_enabled": "INTEGER",
    "trace_sink": "TEXT",
    "target": "TEXT",
    "label": "TEXT",
    # Free text you set with `mcpbench annotate` -- what this run was for.
    "note": "TEXT",
}

#: Tables safe to rebuild when their key changes -- purely derived, rewritten on
#: the next run or analyze. Never applies to measured rows.
_REBUILDABLE = frozenset({"tasks"})

_CELL_KEY = ("run_id", "label", "task", "trial")
_TABLES: dict[str, tuple[dict[str, str], tuple[str, ...]]] = {
    "runs": (RUN_COLUMNS, _CELL_KEY),
    "turns": (TURN_COLUMNS, _CELL_KEY + ("turn_idx",)),
    "tool_calls": (TOOL_CALL_COLUMNS, _CELL_KEY + ("call_idx",)),
    "tasks": (TASK_COLUMNS, ("task_hash",)),
    "run_meta": (META_COLUMNS, ("run_id",)),
}


def _ddl(table: str, columns: dict[str, str], key: tuple[str, ...]) -> str:
    body = ",\n  ".join(f"{name} {kind}" for name, kind in columns.items())
    return f"CREATE TABLE IF NOT EXISTS {table} (\n  {body},\n  PRIMARY KEY ({', '.join(key)})\n)"


@contextmanager
def connect(path: Path) -> Generator[sqlite3.Connection]:
    """Open ``bench.db``, creating or migrating the schema as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        # WAL so a reader (the served report) never blocks the writer mid-run.
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        for table, (columns, key) in _TABLES.items():
            # SQLite cannot alter a primary key, so a derived table whose key
            # changed is rebuilt rather than left on the old shape.
            if table in _REBUILDABLE:
                current = tuple(
                    r["name"] for r in conn.execute(f"PRAGMA table_info({table})") if r["pk"]
                )
                if current and current != key:
                    conn.execute(f"DROP TABLE {table}")
            conn.execute(_ddl(table, columns, key))
            existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            # Additive migration: a metric added later appears on an old db
            # without anyone running a migration step.
            for name, kind in columns.items():
                if name not in existing:
                    conn.execute(
                        f"ALTER TABLE {table} ADD COLUMN {name} {kind.replace(' NOT NULL', '')}"
                    )
        conn.commit()
        yield conn
    finally:
        conn.close()


def _upsert(conn: sqlite3.Connection, table: str, rows: Iterable[dict[str, Any]]) -> int:
    columns, _ = _TABLES[table]
    names = list(columns)
    sql = (
        f"INSERT OR REPLACE INTO {table} ({', '.join(names)}) "
        f"VALUES ({', '.join('?' for _ in names)})"
    )
    payload = [tuple(_coerce(row.get(n)) for n in names) for row in rows]
    if not payload:
        return 0
    conn.executemany(sql, payload)
    return len(payload)


def _coerce(value: Any) -> Any:
    """Map Python values onto the five types SQLite stores."""
    if isinstance(value, bool):
        return int(value)
    if value is None or isinstance(value, (int, float, str, bytes)):
        return value
    return json.dumps(value, default=str)


def write_cell(
    db: Path,
    *,
    run: dict[str, Any],
    turns: list[dict[str, Any]],
    tool_calls: list[dict[str, Any]],
) -> None:
    """Persist one finished cell. Committed immediately so a reader sees it."""
    with connect(db) as conn:
        _upsert(conn, "runs", [run])
        _upsert(conn, "turns", turns)
        _upsert(conn, "tool_calls", tool_calls)
        conn.commit()


def write_tasks(db: Path, tasks: list[dict[str, Any]]) -> None:
    with connect(db) as conn:
        _upsert(conn, "tasks", tasks)
        conn.commit()


def write_meta(db: Path, meta: dict[str, Any]) -> None:
    with connect(db) as conn:
        _upsert(conn, "run_meta", [meta])
        conn.commit()


def annotate_run(
    db: Path, run_id: str, *, label: Optional[str] = None, note: Optional[str] = None
) -> dict[str, Any]:
    """Set a stored run's label and/or note.

    Relabelling rewrites the label on that run's rows too, so the comparison axis
    and the provenance never disagree.
    """
    changed: dict[str, Any] = {}
    with connect(db) as conn:
        exists = conn.execute("SELECT 1 FROM run_meta WHERE run_id = ?", (run_id,)).fetchone()
        if not exists:
            return {}
        if note is not None:
            conn.execute("UPDATE run_meta SET note = ? WHERE run_id = ?", (note, run_id))
            changed["note"] = note
        if label is not None:
            # A run executes against one target, so its rows carry one label.
            # Runs made before labels existed can hold several; collapsing those
            # would merge distinct measurements onto the same key, so refuse.
            present = [
                r["label"]
                for r in conn.execute("SELECT DISTINCT label FROM runs WHERE run_id = ?", (run_id,))
            ]
            if len(present) > 1:
                raise ValueError(
                    f"{run_id} holds {len(present)} labels ({', '.join(sorted(present))}); "
                    "relabelling would merge them. Annotate the note instead, or split "
                    "the run."
                )
            conn.execute("UPDATE run_meta SET label = ? WHERE run_id = ?", (label, run_id))
            for table in ("runs", "turns", "tool_calls"):
                conn.execute(f"UPDATE {table} SET label = ? WHERE run_id = ?", (label, run_id))
            changed["label"] = label
        conn.commit()
    return changed


def read_rows(db: Path, table: str, run_id: Optional[str] = None) -> list[dict[str, Any]]:
    """Every row of ``table``, optionally scoped to one run."""
    if not db.exists():
        return []
    with connect(db) as conn:
        if run_id and "run_id" in _TABLES[table][0]:
            cur = conn.execute(f"SELECT * FROM {table} WHERE run_id = ?", (run_id,))
        else:
            cur = conn.execute(f"SELECT * FROM {table}")
        return [dict(r) for r in cur.fetchall()]


def completed_cells(db: Path, run_id: str) -> set[tuple[str, str, int]]:
    """Cells already stored for a run, for resume."""
    return {(r["label"], r["task"], int(r["trial"])) for r in read_rows(db, "runs", run_id)}


def run_ids(db: Path) -> list[str]:
    if not db.exists():
        return []
    with connect(db) as conn:
        cur = conn.execute(
            "SELECT run_id, MAX(created_at) c FROM run_meta GROUP BY run_id ORDER BY c DESC"
        )
        return [r["run_id"] for r in cur.fetchall()]
