#!/usr/bin/env python3
"""Record a ``claude plugin eval`` run to Phoenix as an experiment.

Reads the harness's ``--json`` output (``aggregate-result.json``) and replays it
into Phoenix: one dataset per suite (one example per case), one experiment per
run. The replay task and evaluators just echo the already-computed scores, so
nothing is re-run and no model is called.

Usage:
    python record_to_phoenix.py <aggregate-result.json> \
        [--dataset-name plugin-eval-phoenix-evals] \
        [--endpoint http://localhost:6006] \
        [--experiment-name ...]

The endpoint defaults to $PHOENIX_COLLECTOR_ENDPOINT, else http://localhost:6006.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _branch() -> str:
    for var in ("GITHUB_HEAD_REF", "GITHUB_REF_NAME"):
        if os.environ.get(var):
            return os.environ[var]
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True
        ).strip()
    except Exception:
        return "local"


def _case_summary(case: dict[str, Any]) -> dict[str, Any]:
    """Collapse a case's with-arm runs into one JSON-serializable summary."""
    aggregates = case.get("aggregates", {})
    with_runs = case.get("arms", {}).get("with", [])

    # Majority pass per grader across the with-arm runs, with one explanation.
    tallies: dict[str, dict[str, Any]] = {}
    for run in with_runs:
        for grader in run.get("graders", []):
            name = grader["name"]
            entry = tallies.setdefault(
                name, {"passed": 0, "total": 0, "explanation": grader.get("explanation", "")}
            )
            entry["total"] += 1
            if grader.get("passed"):
                entry["passed"] += 1

    graders = {
        name: "pass" if t["passed"] * 2 >= t["total"] else "fail" for name, t in tallies.items()
    }
    explanations = {name: t["explanation"] for name, t in tallies.items()}

    return {
        "score": aggregates.get("score"),
        "passed": bool(aggregates.get("passRate", 0) >= 1.0),
        "delta": aggregates.get("delta"),
        "score_without": aggregates.get("scoreWithout"),
        "graders": graders,
        "explanations": explanations,
    }


# Evaluators: plain functions whose names become the Phoenix eval names. They
# read the replayed summary the task returns; per-grader pass/fail lives in the
# task output so a failing grader is visible on its case in the experiment table.
def score(output: dict[str, Any]) -> float:
    return float(output.get("score") or 0.0)


def delta(output: dict[str, Any]) -> float:
    return float(output.get("delta") or 0.0)


def passed(output: dict[str, Any]) -> float:
    return 1.0 if output.get("passed") else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("results", type=Path, help="path to aggregate-result.json")
    parser.add_argument("--dataset-name", default="plugin-eval-phoenix-evals")
    parser.add_argument("--endpoint", default=None, help="Phoenix base URL")
    parser.add_argument("--experiment-name", default=None)
    args = parser.parse_args()

    endpoint = args.endpoint or os.environ.get(
        "PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006"
    )
    os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = endpoint

    data = json.loads(args.results.read_text())
    cases = data.get("cases", [])
    if not cases:
        raise SystemExit(f"no cases in {args.results}")

    # One example per case; the recorded with-arm summary is stored as the
    # example `output` so the replay task can return it unchanged (bound as
    # `expected`). Stable `id` = case name, so re-runs update rows in place.
    examples = [
        {
            "id": c["name"],
            "input": {"case": c["name"], "prompt": c.get("promptMarkdown", "")},
            "output": _case_summary(c),
            "metadata": {
                "dir": c.get("dir", ""),
                "graders": [g["name"] for g in c.get("graders", [])],
            },
        }
        for c in cases
    ]

    from phoenix.client import Client
    from phoenix.client.experiments import run_experiment

    client = Client()
    dataset = client.datasets.create_dataset(name=args.dataset_name, examples=examples)

    def replay_task(expected: dict[str, Any]) -> dict[str, Any]:
        return expected

    experiment_name = args.experiment_name or (
        f"{args.dataset_name}-{_branch()}-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
    )

    experiment = run_experiment(
        dataset=dataset,
        task=replay_task,
        evaluators=[score, delta, passed],
        experiment_name=experiment_name,
    )

    print(f"recorded experiment '{experiment_name}' to {endpoint}")
    print(f"dataset '{args.dataset_name}': {len(examples)} examples")
    url = getattr(experiment, "url", None)
    if url:
        print(url)


if __name__ == "__main__":
    main()
