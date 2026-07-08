#!/usr/bin/env python3
"""Verify ATIF-to-trace conversion against a local Phoenix instance.

Usage:
    uv run python packages/phoenix-client/scripts/verify_atif_upload.py

Requires Phoenix running at http://localhost:6006.
Uploads multiple ATIF trajectories into projects so you can inspect
the resulting traces in the Phoenix UI.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Sequence

from phoenix.client import Client
from phoenix.client.helpers.atif import upload_atif_trajectories_as_spans
from phoenix.client.helpers.atif._convert import _base_session_id, _sha256_trace_id

PHOENIX_URL = os.environ.get("PHOENIX_URL", "http://localhost:6006")
# Append a timestamp suffix so re-runs don't hit duplicate span errors
# from deterministic IDs. Override with ATIF_PROJECT_SUFFIX env var.
_SUFFIX = os.environ.get("ATIF_PROJECT_SUFFIX", str(int(time.time())))
PROJECT_NAME = f"atif-verify-{_SUFFIX}"

FIXTURES_DIR = (
    Path(__file__).resolve().parent.parent / "tests" / "client" / "helpers" / "atif" / "fixtures"
)


# ---------------------------------------------------------------------------
# Rich hand-crafted trajectory: a realistic debugging assistant session
# with multi-turn conversation, parallel tool calls, a system reminder,
# and a follow-up investigation.
# ---------------------------------------------------------------------------
DEBUGGING_TRAJECTORY: Dict[str, Any] = {
    "schema_version": "ATIF-v1.4",
    "session_id": "verify-debug-session-001",
    "agent": {
        "name": "debug-assistant",
        "version": "3.0.0",
        "model_name": "claude-sonnet-4-20250514",
        "extra": {"framework": "custom", "temperature": 0.2},
    },
    "steps": [
        {
            "step_id": 1,
            "timestamp": "2026-03-26T10:00:00Z",
            "source": "user",
            "message": (
                "Our /api/orders endpoint is returning 500 errors intermittently. "
                "Can you investigate? The service is running in Kubernetes pod "
                "orders-api-7f8b9c-xk4wn."
            ),
        },
        {
            "step_id": 2,
            "timestamp": "2026-03-26T10:00:03Z",
            "source": "agent",
            "model_name": "claude-sonnet-4-20250514",
            "message": (
                "I'll check the pod logs and the endpoint health simultaneously "
                "to understand the failure pattern."
            ),
            "reasoning_content": (
                "Intermittent 500s could be OOM, connection pool exhaustion, "
                "or a flaky downstream dependency. Let me check logs and hit "
                "the health endpoint in parallel to narrow it down."
            ),
            "tool_calls": [
                {
                    "tool_call_id": "call_logs",
                    "function_name": "kubectl_logs",
                    "arguments": {
                        "pod": "orders-api-7f8b9c-xk4wn",
                        "namespace": "production",
                        "tail": 200,
                        "since": "30m",
                    },
                },
                {
                    "tool_call_id": "call_health",
                    "function_name": "http_request",
                    "arguments": {
                        "method": "GET",
                        "url": "http://orders-api.production.svc:8080/health",
                        "timeout_seconds": 5,
                    },
                },
                {
                    "tool_call_id": "call_metrics",
                    "function_name": "prometheus_query",
                    "arguments": {
                        "query": (
                            'rate(http_requests_total{service="orders-api",status="500"}[5m])'
                        ),
                        "time_range": "1h",
                    },
                },
            ],
            "observation": {
                "results": [
                    {
                        "source_call_id": "call_logs",
                        "content": (
                            "2026-03-26T09:52:14Z ERROR database connection pool "
                            "exhausted: max_connections=10, active=10, waiting=47\n"
                            "2026-03-26T09:52:14Z ERROR Failed to process order "
                            "ORD-88421: connection timeout after 30s\n"
                            "2026-03-26T09:55:02Z ERROR database connection pool "
                            "exhausted: max_connections=10, active=10, waiting=52\n"
                            "2026-03-26T09:58:31Z WARN slow query detected: "
                            "SELECT * FROM order_items WHERE order_id IN (...) "
                            "took 28.4s"
                        ),
                    },
                    {
                        "source_call_id": "call_health",
                        "content": (
                            '{"status": "degraded", "database": "timeout", '
                            '"cache": "ok", "uptime_seconds": 43291}'
                        ),
                    },
                    {
                        "source_call_id": "call_metrics",
                        "content": (
                            "orders-api 500 rate: 0.0 (09:30), 0.0 (09:40), "
                            "2.3/s (09:50), 4.1/s (09:55), 1.8/s (10:00). "
                            "Spike correlates with connection pool errors."
                        ),
                    },
                ],
            },
            "metrics": {
                "prompt_tokens": 1850,
                "completion_tokens": 120,
                "cached_tokens": 0,
                "cost_usd": 0.0032,
            },
        },
        {
            "step_id": 3,
            "timestamp": "2026-03-26T10:00:08Z",
            "source": "system",
            "message": (
                "Alert: orders-api pod orders-api-7f8b9c-xk4wn memory usage "
                "at 89% (1.78Gi / 2.0Gi limit). OOMKill risk detected."
            ),
        },
        {
            "step_id": 4,
            "timestamp": "2026-03-26T10:00:10Z",
            "source": "agent",
            "model_name": "claude-sonnet-4-20250514",
            "message": (
                "The root cause is clear: database connection pool exhaustion. "
                "Let me check the database server directly and the pool "
                "configuration."
            ),
            "reasoning_content": (
                "Logs show max_connections=10 with 47+ waiting requests. "
                "Health says database timeout. Metrics confirm 500 spike at "
                "09:50. The slow query (28.4s) is likely holding connections "
                "open. Also memory is at 89% — the waiting requests are "
                "accumulating in memory. Need to check the DB side and the "
                "app config."
            ),
            "tool_calls": [
                {
                    "tool_call_id": "call_db",
                    "function_name": "sql_query",
                    "arguments": {
                        "database": "orders_production",
                        "query": (
                            "SELECT state, count(*) FROM pg_stat_activity "
                            "WHERE datname = 'orders' GROUP BY state"
                        ),
                    },
                },
                {
                    "tool_call_id": "call_config",
                    "function_name": "file_read",
                    "arguments": {
                        "path": "/app/config/database.yaml",
                    },
                },
            ],
            "observation": {
                "results": [
                    {
                        "source_call_id": "call_db",
                        "content": (
                            "active: 10, idle: 0, idle_in_transaction: 8, "
                            "waiting: 3. Total backend connections: 21/100. "
                            "8 connections stuck in idle_in_transaction state "
                            "for >60s — likely uncommitted transactions from "
                            "the slow ORDER_ITEMS query."
                        ),
                    },
                    {
                        "source_call_id": "call_config",
                        "content": (
                            "pool:\n  max_connections: 10\n  min_connections: 2\n"
                            "  acquire_timeout: 30s\n  idle_timeout: 300s\n"
                            "  max_lifetime: 3600s\n"
                            "# NOTE: no statement_timeout configured"
                        ),
                    },
                ],
            },
            "metrics": {
                "prompt_tokens": 3400,
                "completion_tokens": 95,
                "cached_tokens": 1850,
                "cost_usd": 0.0028,
            },
        },
        {
            "step_id": 5,
            "timestamp": "2026-03-26T10:00:16Z",
            "source": "agent",
            "model_name": "claude-sonnet-4-20250514",
            "message": (
                "## Root Cause Analysis\n\n"
                "The intermittent 500 errors are caused by **database connection "
                "pool exhaustion**, triggered by a cascade:\n\n"
                "1. **Slow query**: `SELECT * FROM order_items WHERE order_id "
                "IN (...)` is taking ~28s due to a missing index or large "
                "result set\n"
                "2. **Idle-in-transaction connections**: 8 of 10 pool connections "
                "are stuck in `idle_in_transaction` state from these slow queries\n"
                "3. **Pool starvation**: With only `max_connections: 10` and no "
                "`statement_timeout`, new requests queue up (47-52 waiting)\n"
                "4. **Memory pressure**: Queued requests push memory to 89%, "
                "risking OOMKill\n\n"
                "## Recommended Fixes\n\n"
                "**Immediate (mitigate now)**:\n"
                "- Add `statement_timeout: 10s` to database.yaml\n"
                "- Increase `max_connections: 10` → `25`\n"
                "- Add `idle_in_transaction_session_timeout: 30s` on the "
                "Postgres server\n\n"
                "**Short-term**:\n"
                "- Add an index: `CREATE INDEX idx_order_items_order_id ON "
                "order_items(order_id)`\n"
                "- Paginate the ORDER_ITEMS query instead of `IN (...)` with "
                "unbounded lists\n\n"
                "**Monitoring**:\n"
                "- Alert on connection pool utilization > 80%\n"
                "- Alert on `idle_in_transaction` count > 3"
            ),
            "metrics": {
                "prompt_tokens": 4200,
                "completion_tokens": 340,
                "cached_tokens": 3400,
                "cost_usd": 0.0041,
            },
        },
    ],
    "final_metrics": {
        "total_prompt_tokens": 9450,
        "total_completion_tokens": 555,
        "total_cached_tokens": 5250,
        "total_cost_usd": 0.0101,
        "total_steps": 5,
        "extra": {
            "total_tool_calls": 5,
        },
    },
}


def _upload_batch(
    client: Client,
    trajectories: Sequence[Dict[str, Any]],
    label: str,
    project: str = PROJECT_NAME,
) -> int:
    """Upload a batch and print results. Returns span count."""
    n_trajs = len(trajectories)
    total_steps = sum(len(t.get("steps", [])) for t in trajectories)
    try:
        result = upload_atif_trajectories_as_spans(
            client,
            trajectories,
            project_name=project,
        )
        received = result["total_received"]
        queued = result["total_queued"]
        # Compute trace IDs for display
        trace_ids = set()
        for t in trajectories:
            trace_ids.add(_sha256_trace_id(f"{_base_session_id(t['session_id'])}:trace")[:12])
        trace_str = ", ".join(sorted(trace_ids))
        print(
            f"  ✓ {label:<45} | trajs={n_trajs} steps={total_steps:>3} "
            f"| spans={received:>3} queued={queued:>3} | traces={trace_str}"
        )
        return int(received)
    except Exception as e:
        print(f"  ✗ {label}: {e}")
        return 0


def main() -> None:
    print(f"Connecting to Phoenix at {PHOENIX_URL}...")
    client = Client(base_url=PHOENIX_URL)
    print(f"Uploading trajectories to project '{PROJECT_NAME}'\n")

    total_spans = 0

    # ── 1. All test fixtures (individual uploads) ────────────────────
    print("── Test Fixtures (individual) ──")
    for fixture_file in sorted(FIXTURES_DIR.glob("*.json")):
        with open(fixture_file) as f:
            data = json.load(f)
        # subagent_trajectories.json has a different structure (parent/child)
        if fixture_file.name == "subagent_trajectories.json":
            continue
        total_spans += _upload_batch(client, [data], f"fixture: {fixture_file.name}")

    # ── 2. Synthetic subagent linking (batch) ────────────────────────
    print("\n── Subagent Linking (batch) ──")
    subagent_path = FIXTURES_DIR / "subagent_trajectories.json"
    if subagent_path.exists():
        with open(subagent_path) as f:
            subagent_data = json.load(f)
        parent = subagent_data["parent"]
        child = subagent_data["child"]
        total_spans += _upload_batch(
            client,
            [parent, child],
            "batch: synthetic parent + child",
        )

    # ── 3. Harbor Terminus-2 subagent batch ──────────────────────────
    print("\n── Harbor Terminus-2 Subagent Batch ──")
    harbor_parent_path = FIXTURES_DIR / "harbor_terminus2_summarization.json"
    harbor_sub_paths = [
        FIXTURES_DIR / "harbor_terminus2_sub_summary.json",
        FIXTURES_DIR / "harbor_terminus2_sub_answers.json",
        FIXTURES_DIR / "harbor_terminus2_sub_questions.json",
    ]
    if harbor_parent_path.exists() and all(p.exists() for p in harbor_sub_paths):
        with open(harbor_parent_path) as f:
            harbor_parent = json.load(f)
        harbor_children = []
        for p in harbor_sub_paths:
            with open(p) as f:
                harbor_children.append(json.load(f))
        total_spans += _upload_batch(
            client,
            [harbor_parent] + harbor_children,
            "batch: terminus-2 + 3 subagents (real)",
        )

    # ── 4. Harbor continuation pair ──────────────────────────────────
    print("\n── Harbor Terminus-2 Continuation Pair ──")
    cont_path = FIXTURES_DIR / "harbor_terminus2_continuation.json"
    cont1_path = FIXTURES_DIR / "harbor_terminus2_continuation_cont1.json"
    if cont_path.exists() and cont1_path.exists():
        with open(cont_path) as f:
            cont_traj = json.load(f)
        with open(cont1_path) as f:
            cont1_traj = json.load(f)
        total_spans += _upload_batch(
            client,
            [cont_traj, cont1_traj],
            "batch: continuation + cont-1",
        )

    # ── 5. Rich hand-crafted trajectory ──────────────────────────────
    print("\n── Hand-Crafted Debugging Trajectory ──")
    total_spans += _upload_batch(client, [DEBUGGING_TRAJECTORY], "inline: debug-assistant")

    # ── Summary ──────────────────────────────────────────────────────
    print(
        f"\n{'=' * 70}\n"
        f"Done! Total spans uploaded: {total_spans}\n"
        f"Open Phoenix to inspect the traces:\n"
        f"  {PHOENIX_URL}/projects/{PROJECT_NAME}/traces\n"
        f"{'=' * 70}"
    )


if __name__ == "__main__":
    main()
