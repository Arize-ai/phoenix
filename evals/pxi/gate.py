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

from evals.pxi.rowstate import SCHEMA_VERSION, row_state

DEFAULT_THRESHOLDS = Path(__file__).resolve().parent / "thresholds.yaml"

EXIT_OK = 0
EXIT_BREACH = 1
EXIT_INVALID = 2

# Past this many examples needing a retry, mass failure is structural, not a
# coin flip worth confirming individually -- retrying dozens of examples (a
# second live agent run each) just delays a result that was never in doubt.
# Ported from PR #13845's ``RETRY_FAILED_CAP``.
RETRY_FAILED_CAP = 15

RowKey = tuple[str, str, str, str]

# Machine-readable outcome kinds. This is the stable contract shell/doc
# consumers key off -- never the human ``label`` wording, which can be reworded
# freely. Every ``Decision`` carries exactly one of these.
Kind = Literal[
    "pass",  # measured pass, exit 0
    "flaky",  # a miss recovered on retry, exit 0
    "tolerated",  # a miss reproduced but the cell stayed above its threshold, exit 0
    "retry_required",  # planning mode emitted node IDs to rerun, exit 0
    "regression",  # a threshold breach, exit 1
    "too_many_failures",  # over the retry cap, gated on attempt 1 alone, exit 1
    "unmeasurable",  # invalid/partial artifact or no assessable rows, exit 2
]


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
    kind: Kind = "unmeasurable"
    retry_nodeids: tuple[str, ...] = ()
    confirmed: list[Evidence] = field(default_factory=list)
    flaky: list[Evidence] = field(default_factory=list)
    infra: list[Evidence] = field(default_factory=list)
    cells: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_summary(self) -> dict[str, Any]:
        """Structured decision for machine consumers (the CI workflow).

        Consumers read ``kind`` (stable token) and ``exit_code``; ``label`` is
        display text only. This is what lets the workflow avoid scraping
        semantics out of the Markdown digest.
        """
        return {
            "kind": self.kind,
            "label": self.label,
            "exit_code": self.exit_code,
            "retry_nodeids": list(self.retry_nodeids),
            "counts": {
                "confirmed": len(self.confirmed),
                "flaky": len(self.flaky),
                "infra": len(self.infra),
                "breached_cells": sum(1 for cell in self.cells if cell.get("breached")),
            },
        }


def _row_key(row: Mapping[str, Any]) -> RowKey:
    return (
        str(row["dataset"]),
        str(row["example_id"]),
        str(row["evaluator"]),
        str(row["split"]),
    )


def _cell_key(row: Mapping[str, Any]) -> tuple[str, str, str]:
    return str(row["dataset"]), str(row["evaluator"]), str(row["split"])


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
    """Rows worth a second attempt: clean evaluator misses, and rows whose task

    never produced output at all. A task error carries no behavioral signal
    either way -- it could be a transient provider hiccup or a genuine agent
    crash we can't distinguish here -- so give it the same second look as a
    clean miss rather than writing the example off after one try. Evaluator-side
    breakage (the task ran, scoring didn't) is a different failure surface and
    is not retried here.
    """
    retryable: list[Mapping[str, Any]] = []
    for row in rows:
        dataset, _, evaluator, split = _row_key(row)
        resolved = _resolve_policy(policy, dataset, evaluator, split)
        if not (_is_gating(resolved) and _policy_error(resolved) is None):
            continue
        state = row_state(row)
        if state == "failed" or (state == "infra" and row.get("task_error")):
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


def _unassessed_reason(row: Mapping[str, Any]) -> str:
    """Describe why a row couldn't be scored, without guessing at blame."""
    task_error = row.get("task_error")
    if task_error:
        return f"task error: {task_error}"
    evaluator_error = row.get("evaluator_error")
    if evaluator_error:
        return f"evaluator error: {evaluator_error}"
    return "no finite numeric score recorded"


def _infra_evidence(rows: Iterable[Mapping[str, Any]]) -> list[Evidence]:
    evidence: list[Evidence] = []
    seen: set[tuple[str, str, str, str]] = set()
    for row in rows:
        if row_state(row) != "infra":
            continue
        # Task errors repeat once per evaluator. One entry per example/error is
        # enough; evaluator errors remain evaluator-specific.
        evaluator = "*" if row.get("task_error") else str(row.get("evaluator", "unknown"))
        reason = _unassessed_reason(row)
        key = (str(row.get("dataset")), str(row.get("example_id")), evaluator, reason)
        if key in seen:
            continue
        seen.add(key)
        evidence.append(Evidence(category="infra", first=row, reason=reason))
    return evidence


def _group_cells(
    rows: Iterable[Mapping[str, Any]],
) -> dict[tuple[str, str, str], list[Mapping[str, Any]]]:
    cells: dict[tuple[str, str, str], list[Mapping[str, Any]]] = {}
    for row in rows:
        cells.setdefault(_cell_key(row), []).append(row)
    return cells


def _evaluate_cells(
    rows: Sequence[Mapping[str, Any]],
    policy: Mapping[str, Any],
    retryable_keys: frozenset[RowKey] = frozenset(),
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    """Resolve each (dataset, evaluator, split) cell against threshold policy.

    ``retryable_keys`` defers the zero-assessable-rows verdict for a cell whose
    only rows are still-retryable task errors: those examples haven't had
    their one shot at producing a real result yet, so calling the cell
    unmeasurable before retry runs would deny them that chance. Pass the
    default (empty) once retry has already happened (or was never available)
    -- at that point zero assessable rows is a final verdict, not a pending one.
    """
    cells_out: list[dict[str, Any]] = []
    breaches: list[str] = []
    invalid: list[str] = []
    for (dataset, evaluator, split), cell_rows in sorted(_group_cells(rows).items()):
        where = f"{dataset} / {evaluator} / {split}"
        resolved = _resolve_policy(policy, dataset, evaluator, split)
        policy_error = _policy_error(resolved)
        if policy_error:
            invalid.append(f"{where}: {policy_error}")
            continue
        assert resolved is not None
        states = [row_state(row) for row in cell_rows]
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
            "breached": False,
        }
        cells_out.append(cell)
        if not gating:
            continue
        # An evaluator that *raised* is not per-example infrastructure noise the
        # way a task error is -- it's a defect in the scoring apparatus itself,
        # and (unlike a task error) it is deliberately not retried. We cannot
        # measure a trustworthy pass rate for a cell whose scoring code blew up,
        # so fail closed rather than letting the surviving rows carry the cell to
        # a green PASSED. Bystander evaluator errors surfaced during a *retry*
        # never reach here: reconciliation records them as evidence only and
        # keeps them out of ``rows``.
        evaluator_errors = [row for row in cell_rows if row.get("evaluator_error")]
        if evaluator_errors:
            for row in evaluator_errors:
                invalid.append(
                    f"{where}: evaluator error on example {row.get('example_id')!r}: "
                    f"{row.get('evaluator_error')} (scoring unreliable, not an agent regression)"
                )
            continue
        if assessed == 0:
            pending_retry = any(_row_key(row) in retryable_keys for row in cell_rows)
            if not pending_retry:
                invalid.append(f"{where}: zero assessable rows (unmeasurable)")
            continue
        minimum = float(resolved["min_pass_rate"])
        if pass_rate < minimum:
            cell["breached"] = True
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
    retry_cap: int = RETRY_FAILED_CAP,
) -> Decision:
    initial_errors = _validate_artifact(initial)
    if initial_errors:
        return Decision("UNMEASURABLE", EXIT_INVALID, errors=initial_errors)

    first_rows = _artifact_rows(initial)
    all_retryable = _retryable_rows(first_rows, policy)
    all_retry_nodeids = tuple(sorted({str(row["nodeid"]) for row in all_retryable}))

    retry_skip_reason: str | None = None
    if len(all_retry_nodeids) > retry_cap:
        retry_skip_reason = (
            f"{len(all_retry_nodeids)} example(s) need a retry, exceeding the cap of "
            f"{retry_cap} -- too many to confirm individually, skipping retry and "
            "gating on attempt 1 alone"
        )
        retryable: Sequence[Mapping[str, Any]] = ()
        retry_nodeids: tuple[str, ...] = ()
    else:
        retryable = all_retryable
        retry_nodeids = all_retry_nodeids
    retryable_keys = frozenset(_row_key(row) for row in retryable)

    # Policy validity must fail before retry planning: there is no threshold to
    # confirm against. A cell with zero assessable rows is only a final verdict
    # if nothing in it is still pending a retry -- a cell that's entirely
    # unretried task errors gets its one shot before being called unmeasurable.
    initial_cells, initial_breaches, initial_invalid = _evaluate_cells(
        first_rows, policy, retryable_keys
    )
    if initial_invalid:
        return Decision(
            "UNMEASURABLE",
            EXIT_INVALID,
            retry_nodeids=retry_nodeids,
            infra=_infra_evidence(first_rows),
            cells=initial_cells,
            errors=[*([retry_skip_reason] if retry_skip_reason else []), *initial_invalid],
        )

    if retry_skip_reason is not None:
        # retryable_keys is empty here, so initial_cells/initial_breaches above
        # already reflect a strict (no-deferral) evaluation -- this is the
        # final verdict, gated on attempt 1 alone.
        skipped_task_errors = [row for row in all_retryable if row.get("task_error")]
        if initial_breaches:
            # Enough examples missed a gating threshold on attempt 1 that
            # confirming each individually is pointless -- this is a real, if
            # unconfirmed-per-example, failure.
            return Decision(
                "TOO MANY FAILURES TO CONFIRM",
                EXIT_BREACH,
                kind="too_many_failures",
                retry_nodeids=(),
                infra=_infra_evidence(first_rows),
                cells=initial_cells,
                errors=[retry_skip_reason, *initial_breaches],
            )
        if skipped_task_errors:
            # No cell breached, but the cap was tripped with unresolved task
            # errors we deliberately did not retry. Those examples never
            # produced an assessable result, so a surviving passing row must not
            # carry the run to a green PASSED -- we cannot stand behind a pass we
            # never measured. This is mass infrastructure failure, not a pass and
            # not a regression.
            return Decision(
                "UNMEASURABLE",
                EXIT_INVALID,
                kind="unmeasurable",
                retry_nodeids=(),
                infra=_infra_evidence(first_rows),
                cells=initial_cells,
                errors=[
                    retry_skip_reason,
                    f"{len(skipped_task_errors)} example(s) left as unresolved task errors "
                    "above the retry cap; most of the run was never assessed, so the result "
                    "is unmeasurable rather than a pass",
                ],
            )
        return Decision(
            "PASSED",
            EXIT_OK,
            kind="pass",
            retry_nodeids=(),
            infra=_infra_evidence(first_rows),
            cells=initial_cells,
            errors=[retry_skip_reason],
        )

    if planning and retry_nodeids:
        return Decision(
            "RETRY REQUIRED",
            EXIT_OK,
            kind="retry_required",
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
                kind="unmeasurable",
                retry_nodeids=retry_nodeids,
                infra=_infra_evidence(first_rows),
                cells=cells,
                errors=invalid,
            )
        return Decision(
            "REGRESSION" if breaches else "PASSED",
            EXIT_BREACH if breaches else EXIT_OK,
            kind="regression" if breaches else "pass",
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
            kind="unmeasurable",
            retry_nodeids=retry_nodeids,
            infra=_infra_evidence([*first_rows, *_artifact_rows(retry)]),
            cells=initial_cells,
            errors=[f"retry artifact: {error}" for error in retry_errors],
        )

    retry_rows = _artifact_rows(retry)
    retry_by_key = {_row_key(row): row for row in retry_rows}
    effective_rows: list[Mapping[str, Any]] = []
    confirmed: list[Evidence] = []
    flaky: list[Evidence] = []
    # Rows being reconciled below get their final classification from the
    # retry attempt, not the first one -- exclude them here so each retried
    # row is reported exactly once.
    infra = [
        item for item in _infra_evidence(first_rows) if _row_key(item.first) not in retryable_keys
    ]
    # A targeted node reruns all of its evaluators. Surface incidental retry
    # infrastructure even for an evaluator that passed (or wasn't a task
    # error) initially and therefore isn't part of reconciliation below --
    # including when the shared task itself crashed on retry, since that
    # crash affects every evaluator on the node, not just the one being
    # confirmed. Per-row rather than via ``_infra_evidence``: that helper
    # collapses every evaluator of a task-errored example into one wildcard
    # entry, which would also swallow the reconciled evaluator's own row and
    # erase every bystander but the first.
    infra.extend(
        Evidence("infra", row, reason=_unassessed_reason(row))
        for row in retry_rows
        if row_state(row) == "infra" and _row_key(row) not in retryable_keys
    )
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
        state = row_state(second)
        if state == "passed":
            effective_rows.append(second)
            flaky.append(Evidence("flaky", first, retry=second))
        elif state == "failed" and row_state(first) == "failed":
            # A clean miss on BOTH attempts -- the reproduced regression the
            # gate exists to catch.
            effective_rows.append(second)
            confirmed.append(Evidence("confirmed", first, retry=second))
        elif state == "failed":
            # Attempt 1 was a task error (no behavioral signal), so the retry
            # miss is the only assessable read of this example. One miss is not
            # the "same miss twice" the confirm-on-retry contract requires, and
            # we have already spent our one retry -- so we cannot confirm it.
            # Record it as unassessable (never a confirmed regression) rather
            # than reddening the gate on a single, unreproduced miss. It lands
            # in ``effective_rows`` as infra (score cleared), so a cell whose
            # only row this is becomes zero-assessable -> unmeasurable.
            effective_rows.append({**second, "score": None, "passed": False})
            infra.append(
                Evidence(
                    "infra",
                    first,
                    retry=second,
                    reason=(
                        "task error on attempt 1, single miss on retry -- cannot confirm a "
                        "regression from one assessable attempt"
                    ),
                )
            )
        else:
            effective_rows.append(second)
            if first.get("task_error") and second.get("task_error"):
                reason = f"recurring task error: {second['task_error']}"
            else:
                reason = f"retry attempt's {_unassessed_reason(second)}"
            infra.append(Evidence("infra", first, retry=second, reason=reason))

    cells, breaches, invalid = _evaluate_cells(effective_rows, policy)
    if invalid:
        return Decision(
            "UNMEASURABLE",
            EXIT_INVALID,
            kind="unmeasurable",
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
            kind="regression",
            retry_nodeids=retry_nodeids,
            confirmed=confirmed,
            flaky=flaky,
            infra=infra,
            cells=cells,
            errors=breaches,
        )
    if confirmed:
        # Misses reproduced on both attempts but every gating cell stayed at or
        # above its threshold, so no breach fired. This is still a pass under the
        # current policy, but it is NOT a clean one: surfacing it distinctly (not
        # a bare "PASSED") keeps a reproduced miss that a sub-1.0 override happens
        # to tolerate from disappearing behind a green headline. The thresholds
        # themselves are ratcheted toward 1.0 in the corpus/policy stage, not
        # here.
        confirmed_notes = [
            f"confirmed miss within tolerated threshold: {item.first.get('dataset')} / "
            f"{item.first.get('evaluator')} / {item.first.get('example_id')}"
            for item in confirmed
        ]
        return Decision(
            "PASSED WITH TOLERATED MISSES",
            EXIT_OK,
            kind="tolerated",
            retry_nodeids=retry_nodeids,
            confirmed=confirmed,
            flaky=flaky,
            infra=infra,
            cells=cells,
            errors=confirmed_notes,
        )
    return Decision(
        "FLAKY RECOVERY" if flaky else "PASSED",
        EXIT_OK,
        kind="flaky" if flaky else "pass",
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
    if row.get("task_error") or row.get("evaluator_error"):
        return _md(_unassessed_reason(row))
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
        f"flaky recoveries: {len(decision.flaky)}; unassessed examples: {len(decision.infra)}.",
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
                "| Dataset | Evaluator | Split | Assessed | Unassessed | Passed | Pass rate | Minimum |",
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
        ("Unassessed", decision.infra),
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
    # Planning (--retry-nodeids-out) and reconciliation (--retry-artifact) are
    # the two mutually exclusive phases of the two-attempt flow. Passing both
    # would silently run planning and ignore the retry artifact, so a reproduced
    # miss could exit 0 -- make it an argparse error instead of a footgun.
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--retry-artifact", type=Path, help="Targeted retry results artifact")
    mode.add_argument(
        "--retry-nodeids-out",
        type=Path,
        help="Planning mode: write failed gating pytest node IDs, one per line",
    )
    parser.add_argument("--report-out", type=Path, help="Also write the Markdown digest here")
    parser.add_argument(
        "--decision-out",
        type=Path,
        help=(
            "Write the structured decision as JSON here (kind, label, exit_code, "
            "retry_nodeids, counts) for machine consumers"
        ),
    )
    parser.add_argument(
        "--thresholds",
        type=Path,
        default=DEFAULT_THRESHOLDS,
        help="Path to thresholds.yaml",
    )
    parser.add_argument(
        "--retry-cap",
        type=int,
        default=RETRY_FAILED_CAP,
        help=(
            "Skip confirm-on-retry and gate on attempt 1 alone once more than this "
            f"many examples need a retry (default: {RETRY_FAILED_CAP})"
        ),
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
        decision = Decision("UNMEASURABLE", EXIT_INVALID, kind="unmeasurable", errors=errors)
    else:
        assert initial is not None
        try:
            policy = _load_policy(args.thresholds)
        except (OSError, ValueError, yaml.YAMLError) as exc:
            decision = Decision(
                "UNMEASURABLE", EXIT_INVALID, kind="unmeasurable", errors=[str(exc)]
            )
        else:
            decision = decide(
                initial,
                policy,
                retry=retry,
                planning=args.retry_nodeids_out is not None,
                retry_cap=args.retry_cap,
            )

    if args.retry_nodeids_out is not None and decision.exit_code != EXIT_INVALID:
        payload = "".join(f"{nodeid}\n" for nodeid in decision.retry_nodeids)
        args.retry_nodeids_out.write_text(payload)

    if args.decision_out is not None:
        args.decision_out.parent.mkdir(parents=True, exist_ok=True)
        args.decision_out.write_text(json.dumps(decision.to_summary(), indent=2) + "\n")

    digest = render_digest(decision, initial, retry)
    print(digest, end="", file=sys.stderr if decision.exit_code else sys.stdout)
    if args.report_out is not None:
        args.report_out.parent.mkdir(parents=True, exist_ok=True)
        args.report_out.write_text(digest)
    return decision.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
