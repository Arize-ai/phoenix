"""Local control panel: the report, plus the ability to start a run from it.

Bound to loopback only and never given a credential. Keys stay in this process's
environment; the page posts a job description and reads back progress, so a
viewer can spend money on models but can never see or set a secret.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional

from . import store
from .analyze import rows_for_run, task_rows
from .config import BenchConfig, ConfigError, apply_overrides, load_tasks
from .preflight import run_preflight
from .report import payload, render
from .runner import BudgetExhausted, Cell, run_matrix

#: Offered in the panel's cost dropdown. Always clamped to the config's
#: max_total_usd server-side -- the page proposes, the server decides.
_CAP_CHOICES = (1.0, 5.0, 10.0, 25.0)

#: A run is long; keep only the tail so the status payload stays small.
_MAX_LOG_LINES = 400


@dataclass
class Job:
    """The one run this server will have in flight at a time."""

    lines: list[str] = field(default_factory=list)
    running: bool = False
    thread: Optional[threading.Thread] = None
    cancel: threading.Event = field(default_factory=threading.Event)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def log(self, message: str) -> None:
        with self.lock:
            self.lines.append(f"{datetime.now():%H:%M:%S}  {message}")
            del self.lines[:-_MAX_LOG_LINES]

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return {"running": self.running, "lines": list(self.lines)}


def serve(config: BenchConfig, out_dir: Path, *, host: str = "127.0.0.1", port: int = 8765) -> None:
    """Serve the report and a run panel until interrupted."""
    out_dir.mkdir(parents=True, exist_ok=True)
    job = Job()

    db = out_dir.parent / "bench.db"

    def results() -> dict[str, Any]:
        """Current results, straight from the store.

        Read rather than re-derived, so polling during a run is cheap and shows
        exactly the cells the runner has committed so far.
        """
        runs = store.read_rows(db, "runs", out_dir.name)
        if not runs:  # nothing stored yet -- derive from transcripts if any exist
            try:
                runs = rows_for_run(config, load_tasks(config), out_dir)["runs"]
            except (FileNotFoundError, ConfigError):
                runs = []
        data = payload(
            runs,
            store.read_rows(db, "turns", out_dir.name),
            tasks=store.read_rows(db, "tasks") or task_rows(load_tasks(config)),
            meta={"run_id": out_dir.name, "model": config.model},
        )
        data["running"] = job.snapshot()["running"]
        return data

    def render_report() -> bytes:
        return render(results()).encode()

    def start(request: dict[str, Any]) -> Optional[str]:
        tasks = load_tasks(config, request.get("tasks") or None)
        trials = max(1, min(int(request.get("trials", 1)), 50))
        cap = min(float(request.get("max_total_usd", config.max_total_usd)), config.max_total_usd)

        # Claimed under one lock: two near-simultaneous POSTs could otherwise both
        # pass the check and launch two matrices spending in parallel.
        with job.lock:
            if job.running:
                return "A run is already in flight."
            job.lines.clear()
            job.running = True
        job.cancel.clear()

        def work() -> None:
            try:
                job.log("preflight…")
                checks = run_preflight(config, out_dir / "preflight")
                for check in checks:
                    job.log(f"{'PASS' if check.ok else 'FAIL'} {check.name}: {check.detail}")
                if any(not c.ok for c in checks):
                    job.log("preflight failed; not spending the matrix.")
                    return

                run_config = apply_overrides(config, trials=trials, max_total_usd=cap)
                done = 0

                def progress(cell: Cell, info: dict[str, Any]) -> None:
                    nonlocal done
                    done += 1
                    status = "cached" if info.get("cached") else f"turns={info.get('num_turns')}"
                    job.log(f"[{done}] {cell.cell_id}  {status}  ${info.get('spend', 0.0):.2f}")

                run_matrix(run_config, tasks, out_dir, on_cell=progress, cancel=job.cancel)
                job.log("cancelled." if job.cancel.is_set() else "run complete.")
            except BudgetExhausted as exc:
                job.log(str(exc))
            except Exception as exc:  # surfaced in the panel rather than only in the terminal
                job.log(f"error: {exc}")
            finally:
                with job.lock:
                    job.running = False

        job.thread = threading.Thread(target=work, daemon=True)
        job.thread.start()
        return None

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # quiet; the panel is the log
            pass

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, payload: Any, status: int = 200) -> None:
            self._send(status, json.dumps(payload).encode(), "application/json")

        def do_GET(self) -> None:
            path = self.path.split("?")[0].rstrip("/") or "/"
            if path == "/":
                try:
                    self._send(200, render_report(), "text/html; charset=utf-8")
                except (ValueError, FileNotFoundError, ConfigError) as exc:
                    self._send(200, f"<p>No results yet: {exc}</p>".encode(), "text/html")
            elif path == "/api/config":
                caps = [c for c in _CAP_CHOICES if c <= config.max_total_usd] or [
                    config.max_total_usd
                ]
                self._json(
                    {
                        "label": config.resolved_label(),
                        "tasks": [t.name for t in load_tasks(config)],
                        "cost_caps": caps,
                        "default_cap": caps[0],
                    }
                )
            elif path == "/api/status":
                self._json(job.snapshot())
            elif path == "/api/results":
                self._json(results())
            else:
                self._send(404, b"not found", "text/plain")

        def do_POST(self) -> None:
            path = self.path.split("?")[0].rstrip("/")
            if path == "/api/cancel":
                job.cancel.set()
                job.log("cancel requested; finishing the cell in flight.")
                self._json({"ok": True})
                return
            if path != "/api/run":
                self._send(404, b"not found", "text/plain")
                return
            length = int(self.headers.get("Content-Length") or 0)
            try:
                request = json.loads(self.rfile.read(length) or b"{}")
                error = start(request)
            except (ValueError, ConfigError) as exc:
                error = str(exc)
            if error:
                self._send(400, error.encode(), "text/plain")
            else:
                self._json({"ok": True})

    server = ThreadingHTTPServer((host, port), Handler)
    if host not in ("127.0.0.1", "localhost", "::1"):
        # This endpoint starts model runs and has no authentication, so off-loopback
        # it lets anyone who can reach the port spend money against your keys.
        print(
            f"WARNING: bound to {host}, not loopback. This endpoint has no auth and can "
            "start runs that cost money. Anyone who can reach this port can spend against "
            "your keys."
        )
    print(f"mcpbench serving {out_dir.name} at http://{host}:{port}  (ctrl-c to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping…")
    finally:
        job.cancel.set()
        server.server_close()
