"""Seed and validate only the fresh target; invoked by docker exec before the agent."""

import asyncio
import hashlib
import json
import os
import sqlite3
import time
from pathlib import Path

from fixture import seed, validate_seed
from references import compute


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


async def check_mcp(trace_count: int) -> None:
    from fastmcp import Client

    async with Client("http://localhost:6006/mcp") as mcp:
        # Test native nested dispatch, not text mentioning SQL.
        for name, args in (
            ("describeSqlSchema", {}),
            ("executeSql", {"sql": "SELECT count(*) AS n FROM traces"}),
        ):
            result = await mcp.call_tool(
                "execute", {"code": f"return await call_tool({name!r}, {args!r})"}
            )
            if result.is_error:
                raise RuntimeError("Native code-mode/SQL capability failed")
            if name == "executeSql":
                content = result.structured_content
                if not isinstance(content, dict) or content.get("rows") != [[trace_count]]:
                    raise RuntimeError("Native SQL count differs from seed")
        if os.environ.get("BENCHMARK_ACCEPTANCE") == "true":
            # The CLI deletes this temporary project before the oracle starts.
            result = await mcp.call_tool(
                "execute",
                {
                    "code": "return await call_tool('createProject', "
                    "{'name': 'interface-write-probe'})"
                },
            )
            if result.is_error or '"error"' in json.dumps(result.structured_content):
                raise RuntimeError("Native MCP write failed")


def main() -> None:
    from phoenix.client import Client

    database = Path("/data/phoenix.db")
    if not Path("/seed/payload.json").is_file():
        raise RuntimeError("Missing private seed")
    payload = json.loads(Path("/seed/payload.json").read_text())
    truth = json.loads(Path("/seed/truth.json").read_text())
    manifest = json.loads(Path("/seed/manifest.json").read_text())
    validate_seed(payload, manifest, truth)
    pricing = json.loads(Path("/opt/benchmark/pricing.json").read_text())
    client = Client(base_url="http://localhost:6006")
    deadline = time.monotonic() + 120
    while True:
        try:
            list(client.projects.list())
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise TimeoutError("Target did not become ready")
            time.sleep(0.5)
    with sqlite3.connect(f"file:{database}?mode=ro", uri=True) as conn:
        if any(
            conn.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ("traces", "spans", "datasets", "experiments")
        ):
            raise RuntimeError("Target is not fresh")
    seed(client, payload)
    references = compute(payload, pricing)
    if references["count-traces"]["value"] != truth["trace_count"]:
        raise RuntimeError("Source trace identity count differs from converted payload")
    expected = {
        "projects": 1,
        "traces": truth["trace_count"],
        "spans": len(truth["span_ids"]),
        "span_annotations": len(
            {(a["span_id"], a["name"], a["identifier"]) for a in payload["span_annotations"]}
        ),
        "trace_annotations": len(
            {(a["trace_id"], a["name"], a["identifier"]) for a in payload["trace_annotations"]}
        ),
    }
    deadline = time.monotonic() + 120
    while True:
        try:
            state = snapshot(database, payload["project"])
            validate_annotations(database, state["project_id"], payload)
            with sqlite3.connect(f"file:{database}?mode=ro", uri=True) as conn:
                cost = conn.execute(
                    "SELECT coalesce(sum(total_cost),0) FROM span_costs"
                ).fetchone()[0]
            if (
                state["counts"] != expected
                or state["trace_ids"] != truth["trace_ids"]
                or state["span_ids"] != truth["span_ids"]
                or abs(cost - references["total-cost"]["value"]) > 0.000001
            ):
                raise ValueError("Seed state or pinned application costs differ from source")
            break
        except (ValueError, sqlite3.OperationalError):
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.5)
    Path("/evidence/reference.json").write_text(json.dumps(references))
    Path("/evidence/seed-state.json").write_text(json.dumps(state))
    asyncio.run(check_mcp(truth["trace_count"]))
    print(json.dumps({"ready": True, "counts": state["counts"], "total_cost": cost}))


if __name__ == "__main__":
    main()
