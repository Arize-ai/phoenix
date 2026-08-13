#!/usr/bin/env python3
"""Verify common-parent ATIF grouping against a local Phoenix instance.

Exercises the path the Harbor plugin will use: a caller creates one span for
an enclosing operation (a trial), converts every trajectory produced by that
trial beneath it, and uploads the whole batch as a single trace.

Uses real Harbor terminus-2 trajectories: one main run plus the three
sub-trajectories its summarization step produced. Normally these convert to
four unrelated traces; under a common parent they must become one.

Usage:
    uv run python packages/phoenix-client/scripts/verify_atif_common_parent.py

Requires Phoenix running at http://localhost:6006.
"""

from __future__ import annotations

import json
import os
import secrets
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from phoenix.client import Client
from phoenix.client.helpers.atif import _convert_atif_trajectories_to_spans

PHOENIX_URL = os.environ.get("PHOENIX_URL", "http://localhost:6006")
_SUFFIX = os.environ.get("ATIF_PROJECT_SUFFIX", str(int(time.time())))
PROJECT_NAME = f"atif-common-parent-{_SUFFIX}"

FIXTURES_DIR = (
    Path(__file__).resolve().parent.parent / "tests" / "client" / "helpers" / "atif" / "fixtures"
)

# One realistic Harbor trial: the main trajectory plus the sub-trajectories
# spawned by its summarization step.
TRIAL_FIXTURES = [
    "harbor_terminus2_summarization.json",
    "harbor_terminus2_sub_questions.json",
    "harbor_terminus2_sub_answers.json",
    "harbor_terminus2_sub_summary.json",
]


def load(name: str) -> Dict[str, Any]:
    return json.loads((FIXTURES_DIR / name).read_text())


def trial_span(trace_id: str, span_id: str) -> Dict[str, Any]:
    """The caller-owned span standing in for a Harbor trial."""
    return {
        "name": "harbor.trial",
        "context": {"trace_id": trace_id, "span_id": span_id},
        "span_kind": "CHAIN",
        "start_time": "2026-03-26T10:00:00+00:00",
        "end_time": "2026-03-26T10:05:00+00:00",
        "status_code": "OK",
        "attributes": {
            "input": {"value": "terminus-2 summarization task"},
            "metadata": {"harbor.trial_id": "trial-001"},
        },
    }


def main() -> int:
    trajectories = [load(name) for name in TRIAL_FIXTURES]
    print(f"Loaded {len(trajectories)} real Harbor trajectories:")
    for t in trajectories:
        print(f"  - {t['agent']['name']:<45} session={t.get('session_id')}")

    trace_id = secrets.token_hex(16)
    parent_span_id = secrets.token_hex(8)

    # Baseline: no common parent -> independent traces.
    ungrouped = _convert_atif_trajectories_to_spans(trajectories)
    ungrouped_traces = {s["context"]["trace_id"] for s in ungrouped}

    # Grouped: everything under the trial span.
    grouped = _convert_atif_trajectories_to_spans(
        trajectories,
        common_parent_span_context={"trace_id": trace_id, "span_id": parent_span_id},
    )

    print(f"\nWithout common parent: {len(ungrouped)} spans across {len(ungrouped_traces)} traces")
    grouped_traces = {s["context"]["trace_id"] for s in grouped}
    roots = [s for s in grouped if s.get("parent_id") == parent_span_id]
    print(f"With common parent:    {len(grouped)} spans across {len(grouped_traces)} trace(s)")
    print(f"  roots attached to trial span: {[s['name'] for s in roots]}")

    # --- local invariants -------------------------------------------------
    assert len(grouped_traces) == 1, f"expected one trace, got {grouped_traces}"
    assert grouped_traces == {trace_id}, "grouped spans must join the trial's trace"
    assert len(grouped) == len(ungrouped), "grouping must not add or drop spans"

    span_ids = [s["context"]["span_id"] for s in grouped]
    assert len(set(span_ids)) == len(span_ids), "span IDs must be unique"

    known = set(span_ids) | {parent_span_id}
    dangling = [s["name"] for s in grouped if s.get("parent_id") not in known]
    assert not dangling, f"spans with dangling parents: {dangling}"
    print("  local invariants: OK (one trace, no dangling parents, unique IDs)")

    # --- upload -----------------------------------------------------------
    client = Client(base_url=PHOENIX_URL)
    all_spans: List[Any] = [trial_span(trace_id, parent_span_id), *grouped]
    result = client.spans.log_spans(project_identifier=PROJECT_NAME, spans=all_spans)
    print(f"\nUploaded to project {PROJECT_NAME!r}: {result}")

    received = result.get("total_received", 0)
    queued = result.get("total_queued", 0)
    if queued != len(all_spans):
        print(f"FAIL: expected {len(all_spans)} spans queued, got {queued} (received {received})")
        return 1

    # --- read back --------------------------------------------------------
    time.sleep(3)
    fetched = client.spans.get_spans(project_identifier=PROJECT_NAME, limit=1000)
    print(f"Read back {len(fetched)} spans from Phoenix")
    if len(fetched) != len(all_spans):
        print(f"FAIL: expected {len(all_spans)} spans in Phoenix, found {len(fetched)}")
        return 1

    by_id = {s["context"]["span_id"]: s for s in fetched}
    persisted_roots = [
        s for s in fetched if s.get("parent_id") == parent_span_id and s["name"] != "harbor.trial"
    ]
    print(f"  children of the trial span in Phoenix: {[s['name'] for s in persisted_roots]}")
    if len(persisted_roots) != len(roots):
        print(
            f"FAIL: expected {len(roots)} roots under the trial span, found {len(persisted_roots)}"
        )
        return 1

    orphans = [
        s["name"]
        for s in fetched
        if s.get("parent_id") and s["parent_id"] not in by_id and s["parent_id"] != parent_span_id
    ]
    if orphans:
        print(f"FAIL: spans persisted with unresolvable parents: {orphans}")
        return 1

    traces_in_phoenix = {s["context"]["trace_id"] for s in fetched}
    if len(traces_in_phoenix) != 1:
        print(f"FAIL: expected a single trace in Phoenix, found {len(traces_in_phoenix)}")
        return 1

    print("\nPASS: the trial and all four trajectories form one connected trace.")
    print(f"Inspect it at {PHOENIX_URL}/projects -> {PROJECT_NAME}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
