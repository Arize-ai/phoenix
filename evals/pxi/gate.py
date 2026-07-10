"""Trustworthy two-attempt gate for the PXI eval harness.

The record-only pytest suite writes schema-4 artifacts. This module is the
sole decider: it excludes infrastructure rows from behavioral denominators,
emits the exact pytest node IDs for a targeted retry, reconciles the two
artifacts by evaluator, and renders a compact agent-readable digest.

Exit codes are deliberately semantic:

* 0 -- measured pass (including flaky recovery),
* 1 -- confirmed behavioral regression, and
* 2 -- unmeasurable (invalid/partial artifact or no assessable gating rows).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Literal, Mapping, Sequence

import yaml

DEFAULT_THRESHOLDS = Path(__file__).resolve().parent / "thresholds.yaml"

EXIT_OK = 0
EXIT_BREACH = 1
EXIT_INVALID = 2
SCHEMA_VERSION = 4

RowState = Literal["passed", "failed", "infra"]
RowKey = tuple[str, str, str, str]


@dataclass(frozen=True)
class Evidence:
    category: Literal["confirmed", "flaky", "infra"]
    first: Mapping[str, Any]
    retry: Mapping[str, Any] | None = None
    reason: str | None = None


@dataclass
class Decision:
    label: str
    exit_code: int
    retry_nodeids: tuple[str, ...] = ()
    confirmed: list[Evidence] = field(default_factory=list)
    flaky: list[Evidence] = field(default_factory=list)
    infra: list[Evidence] = field(default_factory=list)
    cells: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _row_key(row: Mapping[str, Any]) -> RowKey:
    return (
        str(row["dataset"]),
        str(row["example_id"]),
        str(row["evaluator"]),
        str(row["split"]),
    )


def _cell_key(row: Mapping[str, Any]) -> tuple[str, str, str]:
    return str(row["dataset"]), str(row["evaluator"]), str(row["split"])


def _row_state(row: Mapping[str, Any]) -> RowState:
    if row.get("task_error") or row.get("evaluator_error"):
        return "infra"
    score = row.get("score")
    if isinstance(score, bool) or not isinstance(score, (int, float)):
        return "infra"
    if not math.isfinite(float(score)):
        return "infra"
    return "passed" if row.get("passed") is True else "failed"


def _validate_artifact(artifact: Any) -> list[str]:
    """Return reasons an artifact cannot participate in a gate decision."""
    if not isinstance(artifact, dict):
        return ["artifact is not a JSON object"]

    errors: list[str] = []
    if artifact.get("schema_version") != SCHEMA_VERSION:
        errors.append(
            f"unexpected schema_version {artifact.get('schema_version')!r} (want {SCHEMA_VERSION})"
        )

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
    if session["completed"] != session["collected"]:
        errors.append(
            f"only {session['completed']}/{session['collected']} collected items completed"
        )

    rows = artifact.get("rows")
    if not isinstance(rows, list):
        errors.append("missing or malformed 'rows' list")
    else:
        required = ("dataset", "example_id", "nodeid", "evaluator", "split", "passed")
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                errors.append(f"rows[{index}] is not an object")
                continue
            missing = [key for key in required if key not in row]
            if missing:
                errors.append(f"rows[{index}] is missing {', '.join(missing)}")
            if "passed" in row and not isinstance(row["passed"], bool):
                errors.append(f"rows[{index}].passed is not a boolean")
        if session["completed"] > 0 and len(rows) < session["completed"]:
            errors.append(
                f"only {len(rows)} evaluator row(s) recorded for "
                f"{session['completed']} completed example(s); expected at least "
                "one row per completed example"
            )

    if not isinstance(artifact.get("datasets"), list):
        errors.append("missing 'datasets' list")

    recording = artifact.get("recording")
    if not isinstance(recording, dict):
        errors.append("missing or malformed 'recording' block")
    else:
        for key in ("expected", "bootstrapped"):
            if not isinstance(recording.get(key), bool):
                errors.append(f"recording.{key} is missing or not a boolean")
        if recording.get("expected") and not recording.get("bootstrapped"):
            detail = recording.get("error") or "no experiment was bootstrapped"
            errors.append(f"recording was expected but did not happen: {detail}")
    return errors


def _resolve_policy(
    policy: Mapping[str, Any], dataset: str, evaluator: str, split: str
) -> Mapping[str, Any] | None:
    overrides = policy.get("overrides")
    override = (
        overrides.get(dataset, {}).get(evaluator, {}).get(split)
        if isinstance(overrides, dict)
        else None
    )
    if isinstance(override, dict):
        return override
    splits = policy.get("splits")
    default = splits.get(split) if isinstance(splits, dict) else None
    return default if isinstance(default, dict) else None


def _policy_error(resolved: Mapping[str, Any] | None) -> str | None:
    if resolved is None:
        return "no threshold policy and no gating:false"
    if resolved.get("gating") is False:
        return None
    value = resolved.get("min_pass_rate")
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(float(value))
        or not 0 <= float(value) <= 1
    ):
        return f"malformed policy {dict(resolved)!r}"
    return None


def _is_gating(resolved: Mapping[str, Any] | None) -> bool:
    return resolved is not None and resolved.get("gating") is not False


def _load_policy(path: Path) -> dict[str, Any]:
    raw = yaml.safe_load(path.read_text())
    if not isinstance(raw, dict):
        raise ValueError(f"thresholds file {path} must be a mapping")
    return {"splits": raw.get("splits") or {}, "overrides": raw.get("overrides") or {}}


def _artifact_rows(artifact: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [dict(row) for row in artifact.get("rows", []) if isinstance(row, dict)]


def _retryable_rows(
    rows: Iterable[Mapping[str, Any]], policy: Mapping[str, Any]
) -> list[Mapping[str, Any]]:
    retryable: list[Mapping[str, Any]] = []
    for row in rows:
        dataset, _, evaluator, split = _row_key(row)
        resolved = _resolve_policy(policy, dataset, evaluator, split)
        if _is_gating(resolved) and _policy_error(resolved) is None and _row_state(row) == "failed":
            retryable.append(row)
    return retryable


def _recording_urls(artifact: Mapping[str, Any]) -> dict[str, str]:
    recording = artifact.get("recording")
    datasets = recording.get("datasets") if isinstance(recording, dict) else None
    if not isinstance(datasets, list):
        return {}
    urls: dict[str, str] = {}
    for item in datasets:
        if not isinstance(item, dict):
            continue
        dataset = item.get("dataset")
        url = item.get("experiment_url")
        if isinstance(dataset, str) and isinstance(url, str):
            urls[dataset] = url
    return urls


def _infra_evidence(rows: Iterable[Mapping[str, Any]]) -> list[Evidence]:
    evidence: list[Evidence] = []
    seen: set[tuple[str, str, str, str]] = set()
    for row in rows:
        if _row_state(row) != "infra":
            continue
        # Task errors repeat once per evaluator. One entry per example/error is
        # enough; evaluator errors remain evaluator-specific.
        evaluator = "*" if row.get("task_error") else str(row.get("evaluator", "unknown"))
        reason = str(
            row.get("task_error")
            or row.get("evaluator_error")
            or "evaluation produced no finite numeric score"
        )
        key = (str(row.get("dataset")), str(row.get("example_id")), evaluator, reason)
        if key in seen:
            continue
        seen.add(key)
        evidence.append(Evidence(category="infra", first=row, reason=reason))
    return evidence


def _group_cells(rows: Iterable[Mapping[str, Any]]) -> dict[tuple[str, str, str], list[RowState]]:
    cells: dict[tuple[str, str, str], list[RowState]] = {}
    for row in rows:
        cells.setdefault(_cell_key(row), []).append(_row_state(row))
    return cells


def _evaluate_cells(
    rows: Sequence[Mapping[str, Any]], policy: Mapping[str, Any]
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    cells_out: list[dict[str, Any]] = []
    breaches: list[str] = []
    invalid: list[str] = []
    for (dataset, evaluator, split), states in sorted(_group_cells(rows).items()):
        where = f"{dataset} / {evaluator} / {split}"
        resolved = _resolve_policy(policy, dataset, evaluator, split)
        policy_error = _policy_error(resolved)
        if policy_error:
            invalid.append(f"{where}: {policy_error}")
            continue
        assert resolved is not None
        assessed = sum(state != "infra" for state in states)
        infra = sum(state == "infra" for state in states)
        passed = sum(state == "passed" for state in states)
        pass_rate = passed / assessed if assessed else 0.0
        gating = resolved.get("gating") is not False
        cell = {
            "dataset": dataset,
            "evaluator": evaluator,
            "split": split,
            "gating": gating,
            "assessed": assessed,
            "infra": infra,
            "passed": passed,
            "failed": assessed - passed,
            "pass_rate": pass_rate,
            "min_pass_rate": resolved.get("min_pass_rate"),
        }
        cells_out.append(cell)
        if not gating:
            continue
        if assessed == 0:
            invalid.append(f"{where}: zero assessable rows (unmeasurable)")
            continue
        minimum = float(resolved["min_pass_rate"])
        if pass_rate < minimum:
            breaches.append(
                f"{where}: pass_rate {pass_rate:.3f} < {minimum:g} "
                f"({passed}/{assessed}; {infra} infra excluded)"
            )
    return cells_out, breaches, invalid


def _validate_retry_scope(retry: Mapping[str, Any], expected_nodeids: Sequence[str]) -> list[str]:
    expected = set(expected_nodeids)
    rows = _artifact_rows(retry)
    actual = {str(row.get("nodeid")) for row in rows}
    errors: list[str] = []
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing:
        errors.append(f"targeted retry omitted node IDs: {', '.join(missing)}")
    if unexpected:
        errors.append(f"targeted retry included unexpected node IDs: {', '.join(unexpected)}")
    session = retry.get("session")
    collected = session.get("collected") if isinstance(session, dict) else None
    if collected != len(expected):
        errors.append(f"targeted retry collected {collected!r} items; expected {len(expected)}")
    return errors


def decide(
    initial: Mapping[str, Any],
    policy: Mapping[str, Any],
    *,
    retry: Mapping[str, Any] | None = None,
    planning: bool = False,
) -> Decision:
    initial_errors = _validate_artifact(initial)
    if initial_errors:
        return Decision("UNMEASURABLE", EXIT_INVALID, errors=initial_errors)

    first_rows = _artifact_rows(initial)
    retryable = _retryable_rows(first_rows, policy)
    retry_nodeids = tuple(sorted({str(row["nodeid"]) for row in retryable}))

    # Policy validity and zero-assessable cells must fail before retry planning:
    # there is no behavioral signal to confirm in those cells.
    initial_cells, _, initial_invalid = _evaluate_cells(first_rows, policy)
    if initial_invalid:
        return Decision(
            "UNMEASURABLE",
            EXIT_INVALID,
            retry_nodeids=retry_nodeids,
            infra=_infra_evidence(first_rows),
            cells=initial_cells,
            errors=initial_invalid,
        )

    if planning and retry_nodeids:
        return Decision(
            "RETRY REQUIRED",
            EXIT_OK,
            retry_nodeids=retry_nodeids,
            infra=_infra_evidence(first_rows),
            cells=initial_cells,
        )

    if retry is None:
        cells, breaches, invalid = _evaluate_cells(first_rows, policy)
        if invalid:
            return Decision(
                "UNMEASURABLE",
                EXIT_INVALID,
                retry_nodeids=retry_nodeids,
                infra=_infra_evidence(first_rows),
                cells=cells,
                errors=invalid,
            )
        return Decision(
            "REGRESSION" if breaches else "PASSED",
            EXIT_BREACH if breaches else EXIT_OK,
            retry_nodeids=retry_nodeids,
            infra=_infra_evidence(first_rows),
            cells=cells,
            errors=breaches,
        )

    retry_errors = _validate_artifact(retry)
    if not retry_errors:
        retry_errors.extend(_validate_retry_scope(retry, retry_nodeids))
    if retry_errors:
        return Decision(
            "UNMEASURABLE",
            EXIT_INVALID,
            retry_nodeids=retry_nodeids,
            infra=_infra_evidence([*first_rows, *_artifact_rows(retry)]),
            cells=initial_cells,
            errors=[f"retry artifact: {error}" for error in retry_errors],
        )

    retry_by_key = {_row_key(row): row for row in _artifact_rows(retry)}
    retryable_keys = {_row_key(row) for row in retryable}
    effective_rows: list[Mapping[str, Any]] = []
    confirmed: list[Evidence] = []
    flaky: list[Evidence] = []
    infra = _infra_evidence(first_rows)
    for first in first_rows:
        key = _row_key(first)
        if key not in retryable_keys:
            effective_rows.append(first)
            continue
        second = retry_by_key.get(key)
        if second is None:
            synthetic = {
                **first,
                "score": None,
                "passed": False,
                "evaluator_error": "missing retry row",
            }
            effective_rows.append(synthetic)
            item = Evidence("infra", first, reason="missing retry row")
            infra.append(item)
            continue
        state = _row_state(second)
        effective_rows.append(second)
        if state == "passed":
            flaky.append(Evidence("flaky", first, retry=second))
        elif state == "failed":
            confirmed.append(Evidence("confirmed", first, retry=second))
        else:
            reason = str(
                second.get("task_error")
                or second.get("evaluator_error")
                or "retry produced no finite numeric score"
            )
            infra.append(Evidence("infra", first, retry=second, reason=reason))

    cells, breaches, invalid = _evaluate_cells(effective_rows, policy)
    if invalid:
        return Decision(
            "UNMEASURABLE",
            EXIT_INVALID,
            retry_nodeids=retry_nodeids,
            confirmed=confirmed,
            flaky=flaky,
            infra=infra,
            cells=cells,
            errors=invalid,
        )
    if breaches:
        return Decision(
            "CONFIRMED REGRESSION",
            EXIT_BREACH,
            retry_nodeids=retry_nodeids,
            confirmed=confirmed,
            flaky=flaky,
            infra=infra,
            cells=cells,
            errors=breaches,
        )
    label = "FLAKY RECOVERY" if flaky else "PASSED"
    return Decision(
        label,
        EXIT_OK,
        retry_nodeids=retry_nodeids,
        confirmed=confirmed,
        flaky=flaky,
        infra=infra,
        cells=cells,
    )


def _md(value: Any, *, limit: int = 240) -> str:
    text = "" if value is None else str(value)
    text = " ".join(text.split())
    if len(text) > limit:
        text = text[: limit - 1] + "…"
    return text.replace("|", "\\|")


def _row_details(row: Mapping[str, Any] | None) -> str:
    if row is None:
        return "missing"
    error = row.get("task_error") or row.get("evaluator_error")
    if error:
        return f"infra: {_md(error)}"
    parts = [f"score={row.get('score')!r}"]
    if row.get("label") is not None:
        parts.append(f"label={_md(row['label'])}")
    if row.get("explanation"):
        parts.append(_md(row["explanation"]))
    return "; ".join(parts)


def _evidence_lines(
    evidence: Sequence[Evidence],
    initial_urls: Mapping[str, str],
    retry_urls: Mapping[str, str],
) -> list[str]:
    lines: list[str] = []
    for item in evidence:
        row = item.first
        dataset = str(row.get("dataset", "unknown"))
        evaluator = "all" if row.get("task_error") else str(row.get("evaluator", "unknown"))
        first_link = initial_urls.get(dataset)
        retry_link = retry_urls.get(dataset)
        links = []
        if first_link:
            links.append(f"[first]({first_link})")
        if retry_link:
            links.append(f"[retry]({retry_link})")
        attempt = _row_details(row)
        if item.retry is not None:
            attempt += f" → {_row_details(item.retry)}"
        elif item.reason:
            attempt = _md(item.reason)
        lines.append(
            "| "
            + " | ".join(
                (
                    _md(dataset),
                    _md(row.get("example_id", "unknown")),
                    _md(evaluator),
                    _md(row.get("nodeid", "unknown")),
                    attempt,
                    " ".join(links) or "n/a",
                )
            )
            + " |"
        )
    return lines


def render_digest(
    decision: Decision,
    initial: Mapping[str, Any] | None,
    retry: Mapping[str, Any] | None,
) -> str:
    initial_urls = _recording_urls(initial or {})
    retry_urls = _recording_urls(retry or {})
    lines = [
        "# PXI trustworthy gate",
        "",
        f"**Result: {decision.label} (exit {decision.exit_code})**",
        "",
        f"Confirmed evaluator misses: {len(decision.confirmed)}; "
        f"flaky recoveries: {len(decision.flaky)}; infra examples: {len(decision.infra)}.",
    ]
    if decision.errors:
        lines.extend(["", "## Decision details", ""])
        lines.extend(f"- {_md(error, limit=1000)}" for error in decision.errors)
    if decision.cells:
        lines.extend(
            [
                "",
                "## Gating cells",
                "",
                "| Dataset | Evaluator | Split | Assessed | Infra | Passed | Pass rate | Minimum |",
                "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
            ]
        )
        for cell in decision.cells:
            minimum = cell["min_pass_rate"] if cell["gating"] else "non-gating"
            lines.append(
                f"| {_md(cell['dataset'])} | {_md(cell['evaluator'])} | {_md(cell['split'])} "
                f"| {cell['assessed']} | {cell['infra']} | {cell['passed']} "
                f"| {cell['pass_rate']:.3f} | {minimum} |"
            )
    sections = (
        ("Confirmed regressions", decision.confirmed),
        ("Flaky recoveries", decision.flaky),
        ("Infrastructure", decision.infra),
    )
    for title, evidence in sections:
        if not evidence:
            continue
        lines.extend(
            [
                "",
                f"## {title}",
                "",
                "| Dataset | Example | Evaluator | Pytest node ID | Evidence | Phoenix |",
                "| --- | --- | --- | --- | --- | --- |",
                *_evidence_lines(evidence, initial_urls, retry_urls),
            ]
        )
    if decision.retry_nodeids:
        lines.extend(["", "## Targeted retry node IDs", "", "```text"])
        lines.extend(decision.retry_nodeids)
        lines.append("```")
    return "\n".join(lines) + "\n"


def _read_artifact(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    if not path.exists():
        return None, f"results artifact not found: {path}"
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"could not read/parse artifact {path}: {exc}"
    return value if isinstance(value, dict) else None, None if isinstance(value, dict) else (
        f"artifact {path} is not a JSON object"
    )


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Decide the two-attempt PXI behavioral gate.")
    parser.add_argument("artifact", type=Path, help="Initial pxi-eval-results.json")
    parser.add_argument("--retry-artifact", type=Path, help="Targeted retry results artifact")
    parser.add_argument(
        "--retry-nodeids-out",
        type=Path,
        help="Planning mode: write failed gating pytest node IDs, one per line",
    )
    parser.add_argument("--report-out", type=Path, help="Also write the Markdown digest here")
    parser.add_argument(
        "--thresholds",
        type=Path,
        default=DEFAULT_THRESHOLDS,
        help="Path to thresholds.yaml",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.retry_nodeids_out is not None:
        args.retry_nodeids_out.write_text("")

    initial, initial_read_error = _read_artifact(args.artifact)
    retry: dict[str, Any] | None = None
    retry_read_error: str | None = None
    if args.retry_artifact is not None:
        retry, retry_read_error = _read_artifact(args.retry_artifact)

    if initial_read_error or retry_read_error:
        errors = [error for error in (initial_read_error, retry_read_error) if error]
        decision = Decision("UNMEASURABLE", EXIT_INVALID, errors=errors)
    else:
        assert initial is not None
        try:
            policy = _load_policy(args.thresholds)
        except (OSError, ValueError, yaml.YAMLError) as exc:
            decision = Decision("UNMEASURABLE", EXIT_INVALID, errors=[str(exc)])
        else:
            decision = decide(
                initial,
                policy,
                retry=retry,
                planning=args.retry_nodeids_out is not None,
            )

    if args.retry_nodeids_out is not None and decision.exit_code != EXIT_INVALID:
        payload = "".join(f"{nodeid}\n" for nodeid in decision.retry_nodeids)
        args.retry_nodeids_out.write_text(payload)

    digest = render_digest(decision, initial, retry)
    print(digest, end="", file=sys.stderr if decision.exit_code else sys.stdout)
    if args.report_out is not None:
        args.report_out.parent.mkdir(parents=True, exist_ok=True)
        args.report_out.write_text(digest)
    return decision.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
