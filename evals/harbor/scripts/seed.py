"""Load the TRAIL rows into a throwaway Phoenix and leave a complete database behind.

Runs inside scripts/seed.Dockerfile. Starts the server on /data, loads the rows
through the repository's TRAIL loader (public client API only), waits until the
public API reports every trace and computed costs, stops the server, and
checkpoints the write-ahead log so /data/phoenix.db is the whole database.
"""

import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

SEED = Path("/seed")
ROWS = SEED / "trail-gaia.json"
LOADER = SEED / "load_patronus_trail.py"
DATABASE = Path("/data/phoenix.db")
BASE = "http://127.0.0.1:6006"


def graphql(query: str) -> Any:
    request = urllib.request.Request(
        BASE + "/graphql",
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.load(response)
    if payload.get("errors"):
        raise RuntimeError(payload["errors"])
    return payload["data"]


def healthy() -> bool:
    try:
        with urllib.request.urlopen(BASE + "/healthz", timeout=3) as response:
            return bool(response.status == 200)
    except Exception:
        return False


def project_state(name: str) -> dict[str, Any] | None:
    data = graphql(
        "{ projects(first: 100) { edges { node { name traceCount "
        "costSummary { total { cost } } } } } }"
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


def main() -> None:
    project = os.environ["SEED_PROJECT"]
    rows = json.loads(ROWS.read_text())
    expected_traces = len({json.loads(row["trace"])["trace_id"] for row in rows})
    log = open("/seed/phoenix.log", "w")
    server = subprocess.Popen(["phoenix", "serve", "--no-ui"], stdout=log, stderr=subprocess.STDOUT)
    try:
        wait_for(healthy, timeout=120, what="Phoenix did not become healthy")
        subprocess.run(
            [
                sys.executable,
                str(LOADER),
                "--source",
                "gaia",
                "--input",
                str(ROWS),
                "--project",
                project,
                "--no-regenerate-ids",
                "--no-shift-to-now",
                "--scores-on-trace",
            ],
            check=True,
            env={**os.environ, "PHOENIX_ENDPOINT": BASE},
        )

        def seeded() -> bool:
            state = project_state(project)
            if state is None or state["traceCount"] != expected_traces:
                return False
            cost = (state.get("costSummary") or {}).get("total") or {}
            return bool(cost.get("cost"))

        wait_for(seeded, timeout=300, what="Seeded traces or costs did not appear")
        summary = {"project": project, **(project_state(project) or {})}
    finally:
        server.terminate()
        try:
            server.wait(timeout=60)
        except subprocess.TimeoutExpired:
            server.kill()
        log.close()
    with sqlite3.connect(DATABASE) as connection:
        connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    for sidecar in (DATABASE.with_suffix(".db-wal"), DATABASE.with_suffix(".db-shm")):
        sidecar.unlink(missing_ok=True)
    (SEED / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
