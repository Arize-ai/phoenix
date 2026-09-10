"""Read-only snapshots of the shared SQLite fixture for the trusted smoke runner."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path


def snapshot(database: Path, project: str) -> dict:
    with sqlite3.connect(f"file:{database.resolve()}?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM projects WHERE name = ?", (project,)).fetchall()
        if len(rows) != 1:
            raise ValueError("Expected exactly one existing fixture project")
        project_id = rows[0]["id"]
        queries = {
            "projects": "SELECT * FROM projects WHERE id = ?",
            "traces": "SELECT * FROM traces WHERE project_rowid = ?",
            "spans": (
                "SELECT * FROM spans WHERE trace_rowid IN "
                "(SELECT id FROM traces WHERE project_rowid = ?)"
            ),
            "span_annotations": (
                "SELECT * FROM span_annotations WHERE span_rowid IN "
                "(SELECT id FROM spans WHERE trace_rowid IN "
                "(SELECT id FROM traces WHERE project_rowid = ?))"
            ),
            "trace_annotations": (
                "SELECT * FROM trace_annotations WHERE trace_rowid IN "
                "(SELECT id FROM traces WHERE project_rowid = ?)"
            ),
        }
        data = {
            name: [dict(row) for row in conn.execute(query + " ORDER BY id", (project_id,))]
            for name, query in queries.items()
        }
    encoded = json.dumps(data, sort_keys=True, default=str).encode()
    return {
        "project_id": project_id,
        "counts": {name: len(rows) for name, rows in data.items()},
        "trace_ids": sorted(row["trace_id"] for row in data["traces"]),
        "span_ids": sorted(row["span_id"] for row in data["spans"]),
        "sha256": hashlib.sha256(encoded).hexdigest(),
    }


def validate_annotations(database: Path, project_id: int, payload: dict) -> None:
    """Check target IDs and all annotation content using the loader's upsert semantics."""
    queries = {
        "span_annotations": (
            "SELECT a.*, s.span_id AS target_id FROM span_annotations a "
            "JOIN spans s ON s.id=a.span_rowid JOIN traces t ON t.id=s.trace_rowid "
            "WHERE t.project_rowid=?",
            "span_id",
        ),
        "trace_annotations": (
            "SELECT a.*, t.trace_id AS target_id FROM trace_annotations a "
            "JOIN traces t ON t.id=a.trace_rowid WHERE t.project_rowid=?",
            "trace_id",
        ),
    }
    with sqlite3.connect(f"file:{database.resolve()}?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        for table, (query, target_key) in queries.items():
            expected = {annotation["identifier"]: annotation for annotation in payload[table]}
            actual = {row["identifier"]: dict(row) for row in conn.execute(query, (project_id,))}
            if actual.keys() != expected.keys():
                raise ValueError("Stored annotation identifiers differ from the fixture")
            for identifier, annotation in expected.items():
                row = actual[identifier]
                if (
                    row["target_id"] != annotation[target_key]
                    or row["name"] != annotation["name"]
                    or row["annotator_kind"] != annotation["annotator_kind"]
                    or any(
                        row[key] != annotation["result"].get(key)
                        for key in ("label", "score", "explanation")
                    )
                ):
                    raise ValueError("Stored annotation content differs from the fixture")
