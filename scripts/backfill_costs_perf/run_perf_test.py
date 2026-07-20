#!/usr/bin/env python3
"""Performance harness for the historical cost-backfill endpoint.

This script stands up a Phoenix stack (SQLite or Postgres) from the local
source tree, seeds it with mock historical LLM spans, deletes their cost
records to simulate traces ingested before cost tracking existed, and then
exercises the backfill endpoint

    POST /v1/projects/{project_identifier}/spans/backfill_costs

while simultaneously firing *new* spans at the OTLP ingestion endpoint
(/v1/traces). It measures how the two workloads interact:

  * backfill throughput and per-batch latency, and
  * ingestion request latency / error rate during a quiet baseline window
    versus during the backfill.

Everything is driven through the real HTTP surface (OTLP protobuf for
ingestion, JSON for backfill), so the numbers reflect end-to-end behavior of
the server, not an in-process shortcut.

Usage:
    uv run scripts/backfill_costs_perf/run_perf_test.py --backend sqlite
    uv run scripts/backfill_costs_perf/run_perf_test.py --backend postgres \
        --seed-spans 40000 --load-rate 300 --backfill-batch-size 1000

Requirements: Docker (with the `docker compose` v2 plugin) and the Python
dependencies used below (httpx, opentelemetry-proto), which are already part
of the Phoenix dev environment.
"""

from __future__ import annotations

import argparse
import os
import random
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import httpx
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.common.v1 import common_pb2
from opentelemetry.proto.resource.v1 import resource_pb2
from opentelemetry.proto.trace.v1 import trace_pb2

HERE = Path(__file__).resolve().parent
COMPOSE_FILES = {
    "sqlite": HERE / "docker-compose.sqlite.yml",
    "postgres": HERE / "docker-compose.postgres.yml",
}
COMPOSE_PROJECT = "backfillperf"
HISTORICAL_PROJECT = "HISTORICAL_BACKFILL"
LIVE_PROJECT = "LIVE_INGESTION"

# A handful of real models present in Phoenix's built-in pricing manifest, so
# that costs actually resolve to a price at ingestion / backfill time.
MODELS = [
    ("gpt-4o", "openai"),
    ("gpt-4o-mini", "openai"),
    ("gpt-4-turbo", "openai"),
    ("o3-mini", "openai"),
    ("claude-3-7-sonnet-20250219", "anthropic"),
    ("claude-3-haiku-20240307", "anthropic"),
    ("claude-3-opus-20240229", "anthropic"),
]


# --------------------------------------------------------------------------- #
# OTLP request construction
# --------------------------------------------------------------------------- #
def _any_value(value: object) -> common_pb2.AnyValue:
    av = common_pb2.AnyValue()
    if isinstance(value, bool):
        av.bool_value = value
    elif isinstance(value, int):
        av.int_value = value
    elif isinstance(value, float):
        av.double_value = value
    else:
        av.string_value = str(value)
    return av


def _kv(key: str, value: object) -> common_pb2.KeyValue:
    return common_pb2.KeyValue(key=key, value=_any_value(value))


def build_otlp_request(project_name: str, count: int, start_ns: int) -> bytes:
    """Build an OTLP ExportTraceServiceRequest with `count` mock LLM spans."""
    spans = []
    for _ in range(count):
        model, provider = random.choice(MODELS)
        prompt = random.randint(50, 5000)
        completion = random.randint(50, 5000)
        spans.append(
            trace_pb2.Span(
                trace_id=os.urandom(16),
                span_id=os.urandom(8),
                name="llm_call",
                kind=trace_pb2.Span.SPAN_KIND_INTERNAL,
                start_time_unix_nano=start_ns,
                end_time_unix_nano=start_ns + 1_000_000,
                attributes=[
                    _kv("openinference.span.kind", "LLM"),
                    _kv("llm.model_name", model),
                    _kv("llm.provider", provider),
                    _kv("llm.token_count.prompt", prompt),
                    _kv("llm.token_count.completion", completion),
                    _kv("llm.token_count.total", prompt + completion),
                ],
                status=trace_pb2.Status(code=trace_pb2.Status.STATUS_CODE_OK),
            )
        )
    resource_spans = trace_pb2.ResourceSpans(
        resource=resource_pb2.Resource(
            attributes=[_kv("openinference.project.name", project_name)]
        ),
        scope_spans=[trace_pb2.ScopeSpans(spans=spans)],
    )
    return ExportTraceServiceRequest(resource_spans=[resource_spans]).SerializeToString()


# --------------------------------------------------------------------------- #
# docker compose helpers
# --------------------------------------------------------------------------- #
def compose_cmd(compose_file: Path, *args: str) -> list[str]:
    return [
        "docker",
        "compose",
        "-p",
        COMPOSE_PROJECT,
        "-f",
        str(compose_file),
        *args,
    ]


def run(
    cmd: list[str], *, capture: bool = False, check: bool = True
) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
    )


def delete_span_costs(backend: str, compose_file: Path) -> int:
    """Delete historical-project span costs and return the deleted count."""
    before = count_span_costs(backend, compose_file)
    if backend == "postgres":
        sql = (
            "DELETE FROM span_costs c USING spans s, traces t, projects p "
            "WHERE c.span_rowid=s.id AND s.trace_rowid=t.id AND t.project_rowid=p.id "
            f"AND p.name='{HISTORICAL_PROJECT}';"
        )
        run(
            compose_cmd(
                compose_file,
                "exec",
                "-T",
                "db",
                "psql",
                "-U",
                "postgres",
                "-d",
                "postgres",
                "-tAc",
                sql,
            ),
            capture=True,
        )
    else:
        code = (
            "import sqlite3;"
            "c=sqlite3.connect('/phoenix-data/phoenix.db');"
            "c.execute('PRAGMA foreign_keys=ON');"
            "c.execute('PRAGMA busy_timeout=30000');"
            'n=c.execute("DELETE FROM span_costs WHERE span_rowid IN '
            "(SELECT s.id FROM spans s JOIN traces t ON s.trace_rowid=t.id "
            "JOIN projects p ON t.project_rowid=p.id "
            f"WHERE p.name='{HISTORICAL_PROJECT}')\").rowcount;"
            "c.commit();print(n)"
        )
        run(compose_cmd(compose_file, "exec", "-T", "dbtools", "python", "-c", code), capture=True)
    after = count_span_costs(backend, compose_file)
    return before - after


def count_span_costs(backend: str, compose_file: Path) -> int:
    joins = (
        " FROM span_costs c JOIN spans s ON c.span_rowid=s.id "
        "JOIN traces t ON s.trace_rowid=t.id JOIN projects p ON t.project_rowid=p.id "
        f"WHERE p.name='{HISTORICAL_PROJECT}'"
    )
    if backend == "postgres":
        proc = run(
            compose_cmd(
                compose_file,
                "exec",
                "-T",
                "db",
                "psql",
                "-U",
                "postgres",
                "-d",
                "postgres",
                "-tAc",
                f"SELECT count(*){joins};",
            ),
            capture=True,
        )
    else:
        code = (
            "import sqlite3;"
            "c=sqlite3.connect('/phoenix-data/phoenix.db');"
            "c.execute('PRAGMA busy_timeout=30000');"
            f'print(c.execute("SELECT count(*){joins}").fetchone()[0])'
        )
        proc = run(
            compose_cmd(compose_file, "exec", "-T", "dbtools", "python", "-c", code), capture=True
        )
    out = (proc.stdout or "").strip().splitlines()
    return int(out[-1]) if out and out[-1].strip().isdigit() else 0


def count_historical_spans(backend: str, compose_file: Path) -> int:
    joins = (
        " FROM spans s JOIN traces t ON s.trace_rowid=t.id "
        "JOIN projects p ON t.project_rowid=p.id "
        f"WHERE p.name='{HISTORICAL_PROJECT}'"
    )
    if backend == "postgres":
        proc = run(
            compose_cmd(
                compose_file,
                "exec",
                "-T",
                "db",
                "psql",
                "-U",
                "postgres",
                "-d",
                "postgres",
                "-tAc",
                f"SELECT count(*){joins};",
            ),
            capture=True,
        )
    else:
        code = (
            "import sqlite3;"
            "c=sqlite3.connect('/phoenix-data/phoenix.db');"
            "c.execute('PRAGMA busy_timeout=30000');"
            f'print(c.execute("SELECT count(*){joins}").fetchone()[0])'
        )
        proc = run(
            compose_cmd(compose_file, "exec", "-T", "dbtools", "python", "-c", code),
            capture=True,
        )
    out = (proc.stdout or "").strip().splitlines()
    return int(out[-1]) if out and out[-1].strip().isdigit() else 0


# --------------------------------------------------------------------------- #
# Load generator
# --------------------------------------------------------------------------- #
@dataclass
class Sample:
    t: float
    latency_ms: float
    status: int


@dataclass
class LoadGenerator:
    base_url: str
    rate: int  # target spans/second
    batch: int
    samples: list[Sample] = field(default_factory=list)
    _stop: threading.Event = field(default_factory=threading.Event)
    _thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=30)

    def _run(self) -> None:
        if self.rate == 0:
            self._stop.wait()
            return
        interval = self.batch / self.rate if self.rate else 0.1
        headers = {"content-type": "application/x-protobuf"}
        url = f"{self.base_url}/v1/traces"
        with httpx.Client(timeout=30.0) as client:
            while not self._stop.is_set():
                now_ns = time.time_ns()
                payload = build_otlp_request(LIVE_PROJECT, self.batch, now_ns)
                t0 = time.perf_counter()
                try:
                    resp = client.post(url, content=payload, headers=headers)
                    status = resp.status_code
                except httpx.HTTPError:
                    status = -1
                latency_ms = (time.perf_counter() - t0) * 1000
                self.samples.append(Sample(time.time(), latency_ms, status))
                sleep_for = interval - (time.perf_counter() - t0)
                if sleep_for > 0:
                    self._stop.wait(sleep_for)


# --------------------------------------------------------------------------- #
# Metrics
# --------------------------------------------------------------------------- #
def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, int(round((p / 100.0) * (len(ordered) - 1)))))
    return ordered[k]


def summarize_window(samples: list[Sample], lo: float, hi: float, label: str) -> str:
    window = [s for s in samples if lo <= s.t <= hi]
    if not window:
        return f"  {label:<22} (no ingestion samples in window)"
    latencies = [s.latency_ms for s in window]
    duration = max(hi - lo, 1e-9)
    at_capacity = sum(1 for s in window if s.status == 503)
    errors = sum(1 for s in window if s.status not in (200, 503))
    reqs_per_sec = len(window) / duration
    return (
        f"  {label:<22} reqs={len(window):<5d} "
        f"p50={pct(latencies, 50):6.1f}ms p95={pct(latencies, 95):7.1f}ms "
        f"reqs/s={reqs_per_sec:5.1f} 503s={at_capacity} errors={errors}"
    )


# --------------------------------------------------------------------------- #
# Main flow
# --------------------------------------------------------------------------- #
def wait_for_health(base_url: str, timeout: float) -> None:
    deadline = time.time() + timeout
    last_err: Optional[str] = None
    with httpx.Client(timeout=5.0) as client:
        while time.time() < deadline:
            try:
                if client.get(f"{base_url}/healthz").status_code == 200:
                    return
            except httpx.HTTPError as e:
                last_err = str(e)
            time.sleep(2)
    raise SystemExit(f"Phoenix did not become healthy within {timeout}s (last error: {last_err})")


def seed_historical_spans(base_url: str, total: int, request_batch: int) -> None:
    # Historical spans get a start time ~30 days in the past.
    start_ns = time.time_ns() - 30 * 24 * 3600 * 1_000_000_000
    headers = {"content-type": "application/x-protobuf"}
    url = f"{base_url}/v1/traces"
    sent = 0
    with httpx.Client(timeout=60.0) as client:
        while sent < total:
            n = min(request_batch, total - sent)
            payload = build_otlp_request(HISTORICAL_PROJECT, n, start_ns)
            resp = client.post(url, content=payload, headers=headers)
            if resp.status_code == 503:
                time.sleep(0.5)  # back off if the ingestion queue is full
                continue
            resp.raise_for_status()
            sent += n
            print(f"\r  seeded {sent}/{total} spans", end="", flush=True)
    print()


def wait_until_costed(backend: str, compose_file: Path, expected: int, timeout: float) -> int:
    deadline = time.time() + timeout
    while time.time() < deadline:
        spans = count_historical_spans(backend, compose_file)
        costs = count_span_costs(backend, compose_file)
        print(f"\r  spans: {spans}/{expected}, span_costs: {costs}/{expected}", end="", flush=True)
        if spans == expected and costs == expected:
            print()
            return costs
        time.sleep(2)
    print()
    raise SystemExit(
        f"Timed out waiting for ingestion: spans={count_historical_spans(backend, compose_file)}, "
        f"costs={count_span_costs(backend, compose_file)}, expected={expected}"
    )


def run_backfill(base_url: str, batch_size: int) -> tuple[int, int, int, int, list[float]]:
    url = f"{base_url}/v1/projects/{HISTORICAL_PROJECT}/spans/backfill_costs"
    cursor: Optional[str] = None
    total_inserted = 0
    total_scanned = 0
    total_skipped = 0
    batches = 0
    latencies: list[float] = []
    with httpx.Client(timeout=120.0) as client:
        while True:
            params: dict[str, object] = {"limit": batch_size}
            if cursor is not None:
                params["cursor"] = cursor
            t0 = time.perf_counter()
            resp = client.post(url, params=params)
            latencies.append((time.perf_counter() - t0) * 1000)
            resp.raise_for_status()
            body = resp.json()
            batches += 1
            total_inserted += body["data"]["costs_inserted"]
            total_scanned += body["data"]["spans_scanned"]
            total_skipped += body["data"]["spans_skipped"]
            cursor = body["next_cursor"]
            if cursor is None:
                break
    return total_scanned, total_inserted, total_skipped, batches, latencies


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def nonnegative_int(value: str) -> int:
    parsed = int(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def nonnegative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", choices=["sqlite", "postgres"], required=True)
    parser.add_argument(
        "--seed-spans",
        type=positive_int,
        default=20000,
        help="Number of historical LLM spans to seed and backfill.",
    )
    parser.add_argument(
        "--load-rate",
        type=nonnegative_int,
        default=200,
        help="Target live ingestion rate in spans/second during the test.",
    )
    parser.add_argument(
        "--load-batch",
        type=positive_int,
        default=50,
        help="Spans per OTLP request from the live load generator.",
    )
    parser.add_argument(
        "--seed-batch",
        type=positive_int,
        default=500,
        help="Spans per OTLP request while seeding historical data.",
    )
    parser.add_argument(
        "--backfill-batch-size",
        type=positive_int,
        default=100,
        help="`limit` query param for each backfill request.",
    )
    parser.add_argument(
        "--baseline-seconds",
        type=positive_float,
        default=15.0,
        help="Duration to measure ingestion before backfill starts.",
    )
    parser.add_argument("--cooldown-seconds", type=nonnegative_float, default=5.0)
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="Skip `--build` on compose up (reuse an existing image).",
    )
    parser.add_argument(
        "--keep-up",
        action="store_true",
        help="Leave the stack running (and volumes intact) after the test.",
    )
    args = parser.parse_args()
    if args.backfill_batch_size > 1000:
        parser.error("--backfill-batch-size must not exceed 1000")

    compose_file = COMPOSE_FILES[args.backend]
    base_url = "http://localhost:6006"

    print(f"=== Cost-backfill performance harness (backend={args.backend}) ===\n")

    print("Removing any retained benchmark stack and data...")
    run(compose_cmd(compose_file, "down", "-v", "--remove-orphans"), check=False)

    up = compose_cmd(compose_file, "up", "-d")
    if not args.no_build:
        up.append("--build")
    try:
        print("Starting stack (first build can take several minutes)...")
        run(up)
        print("Waiting for Phoenix to become healthy...")
        wait_for_health(base_url, timeout=300)

        print(f"Seeding {args.seed_spans} historical LLM spans into '{HISTORICAL_PROJECT}'...")
        seed_historical_spans(base_url, args.seed_spans, args.seed_batch)

        print("Waiting for ingestion to compute costs...")
        costed = wait_until_costed(args.backend, compose_file, args.seed_spans, timeout=300)

        print("Deleting span_cost rows to simulate historical, un-costed traces...")
        deleted = delete_span_costs(args.backend, compose_file)
        remaining = count_span_costs(args.backend, compose_file)
        print(f"  span_costs before={costed}, deleted={deleted}, after={remaining}")
        if deleted != costed or remaining != 0:
            raise SystemExit("Failed to remove all historical span costs before backfill")

        gen = LoadGenerator(base_url=base_url, rate=args.load_rate, batch=args.load_batch)
        print(f"Starting live ingestion load (~{args.load_rate} spans/s) into '{LIVE_PROJECT}'...")
        gen.start()
        try:
            print(f"Measuring ingestion baseline for {args.baseline_seconds}s...")
            time.sleep(args.baseline_seconds)

            print(f"Running backfill (limit={args.backfill_batch_size}) under load...")
            backfill_start = time.time()
            scanned, inserted, skipped, batches, bf_latencies = run_backfill(
                base_url, args.backfill_batch_size
            )
            backfill_end = time.time()

            time.sleep(args.cooldown_seconds)
        finally:
            gen.stop()

        # ---------------------------------------------------------------- #
        # Report
        # ---------------------------------------------------------------- #
        final_costs = count_span_costs(args.backend, compose_file)
        if scanned != costed or inserted != costed or skipped != 0 or final_costs != costed:
            raise SystemExit(
                "Backfill validation failed: "
                f"scanned={scanned}, inserted={inserted}, skipped={skipped}, "
                f"final_costs={final_costs}, expected={costed}"
            )
        wall = max(backfill_end - backfill_start, 1e-9)
        print("\n================= RESULTS =================")
        print(f"Backend:              {args.backend}")
        print(f"Historical spans:     {costed} seeded, {inserted} re-costed by backfill")
        print()
        print("Backfill:")
        print(f"  batches:            {batches} (limit={args.backfill_batch_size})")
        print(f"  wall time:          {wall:.1f}s")
        print(f"  throughput:         {inserted / wall:.0f} spans/s")
        print(
            f"  batch latency:      p50={pct(bf_latencies, 50):.0f}ms "
            f"p95={pct(bf_latencies, 95):.0f}ms max={max(bf_latencies):.0f}ms"
        )
        print()
        print(f"Live ingestion ({args.load_rate} spans/s target, {gen.batch} spans/request):")
        print(
            summarize_window(
                gen.samples, backfill_start - args.baseline_seconds, backfill_start, "baseline"
            )
        )
        print(summarize_window(gen.samples, backfill_start, backfill_end, "during backfill"))

        base_lat = [
            s.latency_ms
            for s in gen.samples
            if backfill_start - args.baseline_seconds <= s.t < backfill_start
        ]
        dur_lat = [s.latency_ms for s in gen.samples if backfill_start <= s.t <= backfill_end]
        if base_lat and dur_lat:
            b95, d95 = pct(base_lat, 95), pct(dur_lat, 95)
            delta = (d95 - b95) / b95 * 100 if b95 else float("nan")
            rejects = sum(
                1 for s in gen.samples if backfill_start <= s.t <= backfill_end and s.status == 503
            )
            print()
            print(
                f"Ingestion impact:     p95 request latency {b95:.1f}ms -> {d95:.1f}ms "
                f"({delta:+.0f}%), {rejects} rejected (503) during backfill"
            )
        print("===========================================")
    finally:
        if args.keep_up:
            print(
                f"\nStack left running (project '{COMPOSE_PROJECT}'). "
                f"Tear down with:\n  docker compose -p {COMPOSE_PROJECT} "
                f"-f {compose_file} down -v"
            )
        else:
            print("\nTearing down stack...")
            run(compose_cmd(compose_file, "down", "-v", "--remove-orphans"), check=False)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
