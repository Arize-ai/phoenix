"""Aggregate gate for the PXI eval harness.

Reads ``pxi-eval-results.json`` (written by ``conftest.py``) and decides
pass/fail. It fails closed: a missing, malformed, partial, or dirty-session
artifact, a session that scored fewer evaluator rows than it completed
examples, or any ``(evaluator, split)`` datapoint with no matching threshold
policy, exits nonzero before any pass-rate comparison. Only a structurally
complete, clean-session artifact proceeds to the per-(evaluator, split)
pass-rate check.

Run as ``python -m evals.pxi.gate <artifact> [--thresholds <path>]``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Optional

import yaml

DEFAULT_THRESHOLDS = Path(__file__).resolve().parent / "thresholds.yaml"

EXIT_OK = 0
EXIT_BREACH = 1
EXIT_INVALID = 2


def _validate_artifact(artifact: Any) -> list[str]:
    """Return the reasons the artifact is unfit to gate on; empty means valid."""
    if not isinstance(artifact, dict):
        return ["artifact is not a JSON object"]

    errors: list[str] = []
    if artifact.get("schema_version") != 3:
        errors.append(f"unexpected schema_version {artifact.get('schema_version')!r} (want 3)")

    session = artifact.get("session")
    if not isinstance(session, dict):
        return errors + ["missing or malformed 'session' health block"]
    for key in ("status", "collected", "completed", "errors"):
        if not isinstance(session.get(key), int):
            errors.append(f"session.{key} is missing or not an integer")
    if errors:
        return errors

    if session["status"] != 0:
        errors.append(f"pytest session status was {session['status']} (nonzero)")
    if session["errors"] != 0:
        errors.append(f"{session['errors']} collection/setup/eval error(s) during the run")
    if session["collected"] <= 0:
        errors.append("no items were collected")
    if session["completed"] < session["collected"]:
        errors.append(
            f"only {session['completed']}/{session['collected']} collected items completed"
        )
    datasets = artifact.get("datasets")
    if not isinstance(datasets, list):
        errors.append("missing 'datasets' list")
    elif session["completed"] > 0:
        # Every completed example scores >= 1 evaluator row, so fewer scored
        # rows than completed examples means evaluations silently dropped (an
        # id-rewrite bug that skips scoring, say). The per-split pass-rate check
        # can't catch it -- an empty or short datasets list has nothing to fail.
        total_scored = _total_scored(datasets)
        if total_scored < session["completed"]:
            errors.append(
                f"only {total_scored} evaluator row(s) scored for "
                f"{session['completed']} completed example(s); expected at least "
                f"one row per completed example"
            )

    recording = artifact.get("recording")
    if not isinstance(recording, dict):
        errors.append("missing or malformed 'recording' block")
    else:
        for key in ("expected", "bootstrapped"):
            if not isinstance(recording.get(key), bool):
                errors.append(f"recording.{key} is missing or not a boolean")
        # A green gate must mean results reached Phoenix. When a key was present the plugin was
        # meant to record, but bootstrap failure degrades to a warning there, so assert it here.
        if recording.get("expected") and not recording.get("bootstrapped"):
            detail = recording.get("error") or "no experiment was bootstrapped"
            errors.append(f"recording was expected but did not happen: {detail}")
    return errors


def _total_scored(datasets: list[Any]) -> int:
    """Sum ``scored`` over every (dataset, evaluator, split) in the aggregate.

    Tolerates a malformed entry by skipping it: a dropped or non-integer count
    lowers the total, which fails the shortfall check closed rather than raising.
    """
    total = 0
    for dataset in datasets:
        evaluators = dataset.get("evaluators") if isinstance(dataset, dict) else None
        for evaluator in evaluators or []:
            splits = evaluator.get("splits") if isinstance(evaluator, dict) else None
            if not isinstance(splits, dict):
                continue
            for stats in splits.values():
                scored = stats.get("scored") if isinstance(stats, dict) else None
                if isinstance(scored, int):
                    total += scored
    return total


def _resolve_policy(
    policy: dict[str, Any], dataset: str, evaluator: str, split: str
) -> Optional[dict[str, Any]]:
    override = (
        policy["overrides"].get(dataset, {}).get(evaluator, {}).get(split)
        if isinstance(policy.get("overrides"), dict)
        else None
    )
    if isinstance(override, dict):
        return override
    default = policy["splits"].get(split) if isinstance(policy.get("splits"), dict) else None
    return default if isinstance(default, dict) else None


def _check_thresholds(artifact: dict[str, Any], policy: dict[str, Any]) -> list[str]:
    breaches: list[str] = []
    for dataset in artifact["datasets"]:
        dataset_name = str(dataset["dataset"])
        for evaluator in dataset["evaluators"]:
            evaluator_name = str(evaluator["evaluator"])
            for split, stats in evaluator["splits"].items():
                where = f"{dataset_name} / {evaluator_name} / {split}"
                resolved = _resolve_policy(policy, dataset_name, evaluator_name, split)
                if resolved is None:
                    breaches.append(f"{where}: no threshold policy and no gating:false")
                    continue
                if resolved.get("gating") is False:
                    continue
                min_pass_rate = resolved.get("min_pass_rate")
                if not isinstance(min_pass_rate, (int, float)):
                    breaches.append(f"{where}: malformed policy {resolved!r}")
                    continue
                if stats["pass_rate"] < min_pass_rate:
                    breaches.append(
                        f"{where}: pass_rate {stats['pass_rate']:.3f} < {min_pass_rate} "
                        f"({stats['passed']}/{stats['scored']})"
                    )
    return breaches


def _load_policy(path: Path) -> dict[str, Any]:
    raw = yaml.safe_load(path.read_text())
    if not isinstance(raw, dict):
        raise ValueError(f"thresholds file {path} must be a mapping")
    return {"splits": raw.get("splits") or {}, "overrides": raw.get("overrides") or {}}


def _parse_args(argv: Optional[list[str]]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gate a PXI eval results artifact against per-(evaluator, split) thresholds."
    )
    parser.add_argument("artifact", help="Path to pxi-eval-results.json")
    parser.add_argument(
        "--thresholds",
        type=Path,
        default=DEFAULT_THRESHOLDS,
        help="Path to thresholds.yaml (default: evals/pxi/thresholds.yaml)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    artifact_path = Path(args.artifact)
    if not artifact_path.exists():
        print(f"gate: results artifact not found: {artifact_path}", file=sys.stderr)
        return EXIT_INVALID
    try:
        artifact = json.loads(artifact_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"gate: could not read/parse artifact: {exc}", file=sys.stderr)
        return EXIT_INVALID

    validity_errors = _validate_artifact(artifact)
    if validity_errors:
        print("gate: artifact failed the validity check (fail-closed):", file=sys.stderr)
        for error in validity_errors:
            print(f"  - {error}", file=sys.stderr)
        return EXIT_INVALID

    policy = _load_policy(args.thresholds)
    breaches = _check_thresholds(artifact, policy)
    if breaches:
        print("gate: threshold breaches:", file=sys.stderr)
        for breach in breaches:
            print(f"  - {breach}", file=sys.stderr)
        return EXIT_BREACH

    print("gate: clean session; every (evaluator, split) pass-rate met its threshold.")
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main())
