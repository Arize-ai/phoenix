"""Load TRAIL into the fresh Phoenix service and write its reference answers."""

import asyncio
import hashlib
import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from evals.mcp.scoring.references import compute


def seed(client: Any, payload: dict[str, Any]) -> None:
    """Create the seed project and load its spans and annotations through Phoenix."""
    project = payload["project"]
    # Refuse accidental reuse. Never delete existing resources to make a seed pass.
    if any(item["name"] == project for item in client.projects.list()):
        raise ValueError("Fixture project already exists; use a fresh target")
    client.projects.create(name=project)
    client.spans.log_spans(project_identifier=project, spans=payload["spans"])
    if payload["span_annotations"]:
        client.spans.log_span_annotations(span_annotations=payload["span_annotations"])
    if payload["trace_annotations"]:
        client.traces.log_trace_annotations(trace_annotations=payload["trace_annotations"])


def validate_seed(payload: dict[str, Any], manifest: dict[str, Any], truth: dict[str, Any]) -> None:
    """Verify the staged seed's content identity before creating any target records."""
    content = {
        "version": manifest["converter_version"],
        "revision": manifest["revision"],
        "source_hash": manifest["source_hash"],
        "payload": payload,
    }
    encoded = json.dumps(
        content, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()
    if hashlib.sha256(encoded).hexdigest() != manifest["fixture_hash"]:
        raise ValueError("Private payload differs from its manifest hash")
    if payload["project"] != manifest["project"] or truth["project"] != manifest["project"]:
        raise ValueError("Seed project identities disagree")


def read_seed_state(database: Path, project: str) -> dict:
    """Read the loaded project's record counts and trace/span identities."""
    with sqlite3.connect(f"file:{database.resolve()}?mode=ro", uri=True) as conn:
        rows = conn.execute("SELECT id FROM projects WHERE name = ?", (project,)).fetchall()
        if len(rows) != 1:
            raise ValueError("Expected one seeded project")
        project_id = rows[0][0]
        counts = {
            table: conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in ("traces", "spans", "span_annotations", "trace_annotations")
        }
        # Phoenix may also create its empty default project during startup.
        counts["projects"] = 1
        return {
            "project_id": project_id,
            "counts": counts,
            "trace_ids": sorted(row[0] for row in conn.execute("SELECT trace_id FROM traces")),
            "span_ids": sorted(row[0] for row in conn.execute("SELECT span_id FROM spans")),
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


def main() -> None:
    from phoenix.client import Client

    database = Path("/data/phoenix.db")
    if not Path("/seed/payload.json").is_file():
        raise RuntimeError("Missing private seed")
    payload = json.loads(Path("/seed/payload.json").read_text())
    truth = json.loads(Path("/seed/truth.json").read_text())
    manifest = json.loads(Path("/seed/manifest.json").read_text())
    validate_seed(payload, manifest, truth)
    pricing = json.loads(Path("/opt/benchmark/evals/mcp/environment/pricing.json").read_text())
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
            state = read_seed_state(database, payload["project"])
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
    # Setup calls must not contribute to the evaluated agent's SQL measurements.
    Path("/evidence/operations.jsonl").write_text("")
    ready = {"ready": True, "counts": state["counts"], "total_cost": cost}
    Path("/evidence/ready.json").write_text(json.dumps(ready))
    print(json.dumps(ready))


if __name__ == "__main__":
    main()
