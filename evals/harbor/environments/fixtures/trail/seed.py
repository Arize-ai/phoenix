"""Create a complete Phoenix SQLite fixture from TRAIL rows.

Run this script with ``uv run`` from the repository root to use Phoenix from the current
checkout. The script checkpoints the write-ahead log before moving the database to
``--output``.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

LOADER = Path(__file__).resolve().parents[5] / "scripts" / "load_patronus_trail.py"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def graphql(base: str, query: str) -> Any:
    request = urllib.request.Request(
        base + "/graphql",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.load(response)
    if payload.get("errors"):
        raise RuntimeError(payload["errors"])
    return payload["data"]


def healthy(base: str) -> bool:
    try:
        with urllib.request.urlopen(base + "/healthz", timeout=3) as response:
            return bool(response.status == 200)
    except Exception:
        return False


def project_state(base: str, name: str) -> dict[str, Any] | None:
    data = graphql(
        base,
        "{ projects(first: 100) { edges { node { name traceCount "
        "costSummary { total { cost } } } } } }",
    )
    for edge in data["projects"]["edges"]:
        if edge["node"]["name"] == name:
            return dict(edge["node"])
    return None


def wait_for(predicate: Callable[[], bool], *, timeout: float, what: str) -> None:
    deadline = time.monotonic() + timeout
    while True:
        try:
            if predicate():
                return
        except Exception:
            pass
        if time.monotonic() >= deadline:
            raise TimeoutError(what)
        time.sleep(1)


def loads_labels(text: str) -> Any:
    """Parse a TRAIL labels row, which may carry trailing commas, as the loader does."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(re.sub(r",(\s*[\]}])", r"\1", text))


def check_annotations(connection: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    """Fail when the database is missing annotations that the TRAIL rows define.

    The loader upserts one ``trail_error`` per (span, category) and one set of trace
    scores per trace. A fixture that silently drops some of them grades every
    annotation question against the wrong reference.
    """
    errors: set[tuple[str, str]] = set()
    scored_traces = 0
    for row in rows:
        labels = loads_labels(row["labels"])
        for error in labels.get("errors") or []:
            if location := error.get("location"):
                category = str(error.get("category") or "unknown").replace("\x00", " ")
                errors.add((str(location), category))
        scored_traces += bool(labels.get("scores"))
    (seeded_errors,) = connection.execute(
        "SELECT COUNT(*) FROM span_annotations WHERE name = 'trail_error'"
    ).fetchone()
    (seeded_traces,) = connection.execute(
        "SELECT COUNT(DISTINCT trace_rowid) FROM trace_annotations WHERE name LIKE 'trail_%'"
    ).fetchone()
    if (seeded_errors, seeded_traces) != (len(errors), scored_traces):
        raise RuntimeError(
            f"seeded {seeded_errors} of {len(errors)} trail_error span annotations and "
            f"scores on {seeded_traces} of {scored_traces} traces"
        )


def seed(rows_path: Path, output: Path, project: str) -> dict[str, Any]:
    rows = json.loads(rows_path.read_text())
    expected_traces = len({json.loads(row["trace"])["trace_id"] for row in rows})
    port, grpc_port = free_port(), free_port()
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="phoenix-trail-seed-") as scratch:
        database = Path(scratch) / "phoenix.db"
        env = {
            **os.environ,
            "PHOENIX_WORKING_DIR": scratch,
            "PHOENIX_SQL_DATABASE_URL": f"sqlite:///{database}",
            "PHOENIX_PORT": str(port),
            "PHOENIX_GRPC_PORT": str(grpc_port),
            "PHOENIX_TELEMETRY_ENABLED": "false",
            "PHOENIX_DISABLE_AGENT_ASSISTANT": "true",
            "PHOENIX_ALLOWED_SANDBOX_PROVIDERS": "MONTY",
        }
        log_path = Path(scratch) / "phoenix.log"
        with open(log_path, "w") as log:
            server = subprocess.Popen(
                ["phoenix", "serve", "--no-ui"], env=env, stdout=log, stderr=subprocess.STDOUT
            )
            try:
                wait_for(lambda: healthy(base), timeout=120, what="Phoenix did not become healthy")
                subprocess.run(
                    [
                        "uv",
                        "run",
                        "--script",
                        str(LOADER),
                        "--source",
                        "gaia",
                        "--input",
                        str(rows_path),
                        "--project",
                        project,
                        "--no-regenerate-ids",
                        "--no-shift-to-now",
                        "--scores-on-trace",
                    ],
                    check=True,
                    # Remove inherited Phoenix settings so the loader sends every row to
                    # this server.
                    env={
                        **{k: v for k, v in os.environ.items() if not k.startswith("PHOENIX_")},
                        "PHOENIX_COLLECTOR_ENDPOINT": base,
                    },
                )

                def seeded() -> bool:
                    state = project_state(base, project)
                    if state is None or state["traceCount"] != expected_traces:
                        return False
                    cost = (state.get("costSummary") or {}).get("total") or {}
                    return bool(cost.get("cost"))

                wait_for(seeded, timeout=300, what="Seeded traces or costs did not appear")
                summary = {"project": project, **(project_state(base, project) or {})}
            except BaseException:
                server.terminate()
                server.wait(timeout=60)
                print(log_path.read_text()[-4000:], file=sys.stderr)
                raise
            server.terminate()
            try:
                server.wait(timeout=60)
            except subprocess.TimeoutExpired:
                server.kill()
        with sqlite3.connect(database) as connection:
            connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            check_annotations(connection, rows)
        for sidecar in (database.with_suffix(".db-wal"), database.with_suffix(".db-shm")):
            sidecar.unlink(missing_ok=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(database), output)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=Path, required=True, help="the downloaded TRAIL rows")
    parser.add_argument("--output", type=Path, required=True, help="where to write phoenix.db")
    parser.add_argument("--project", default="research-assistant")
    args = parser.parse_args()
    summary = seed(args.rows, args.output, args.project)
    args.output.with_name("summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
