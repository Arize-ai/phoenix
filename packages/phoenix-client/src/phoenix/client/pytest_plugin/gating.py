"""Aggregate gating + terminal-summary rendering (D9).

At run end the reporter fetches ``GET /v1/experiments/{id}/summary`` (with ``ancestor_commits``
derived from ``repo_info``), prints per-score baseline diffs, and decides the process exit code:
nonzero on a configured regression / min-score failure, or on inability to evaluate a configured
gate. With no gate configured, uploads/reporting stay best-effort.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from .session import SuiteState

logger = logging.getLogger(__name__)


@dataclass
class GateResult:
    should_fail: bool = False
    reasons: list[str] = field(default_factory=list)
    summaries: dict[str, Any] = field(default_factory=dict)  # dataset_name -> ExperimentSummary
    error: Optional[str] = None


def _is_regression(row: dict[str, Any]) -> bool:
    """Direction-aware regression test for one annotation summary row.

    A score regressed when more examples got worse than improved AND the mean moved in the
    worse direction per the row's ``optimization_direction`` (as echoed by the summary).
    """
    num_regressed = row.get("num_regressed")
    num_improved = row.get("num_improved")
    diff = row.get("diff")
    if num_regressed is None or num_improved is None or diff is None:
        return False
    if num_regressed <= num_improved:
        return False
    direction = row.get("optimization_direction", "maximize")
    if direction == "maximize":
        return bool(diff < 0)
    return bool(diff > 0)


def evaluate_gate(state: "SuiteState", *, pass_annotation: str) -> GateResult:
    result = GateResult()
    cfg = state.config

    # A configured gate that cannot even initialize recording is a gate-evaluation error.
    if cfg.gate_configured and state.bootstrap_error is not None:
        result.should_fail = True
        result.error = f"gate configured but experiment recording failed: {state.bootstrap_error}"
        result.reasons.append(result.error)
        return result

    ancestor_commits = _ancestor_commits(state)
    minimize = list(cfg.min_score) if cfg.min_score else None

    for name, group in state.groups.items():
        if group.experiment_id is None:
            if cfg.gate_configured:
                result.should_fail = True
                result.error = f"no experiment for dataset {name!r}; cannot evaluate gate"
                result.reasons.append(result.error)
            continue
        try:
            summary = state.client.experiments.get_experiment_summary(
                experiment_id=group.experiment_id,
                ancestor_commits=ancestor_commits,
                minimize_scores=minimize,
            )
        except Exception as e:  # noqa: BLE001
            if cfg.gate_configured:
                result.should_fail = True
                result.error = f"failed to fetch summary for dataset {name!r}: {e}"
                result.reasons.append(result.error)
            else:
                logger.warning("Phoenix plugin: summary fetch failed for %s: %s", name, e)
            continue
        result.summaries[name] = summary

        if not cfg.gate_configured:
            continue

        for row in summary.get("annotation_summaries", []):
            ann_name = row.get("annotation_name")
            if cfg.fail_on_regression and _is_regression(row):
                result.should_fail = True
                result.reasons.append(
                    f"[{name}] {ann_name} regressed (diff={row.get('diff')}, "
                    f"regressed={row.get('num_regressed')}, improved={row.get('num_improved')})"
                )
            if ann_name in cfg.min_score:
                threshold = cfg.min_score[ann_name]
                mean = row.get("mean_score")
                if mean is None or mean < threshold:
                    result.should_fail = True
                    result.reasons.append(
                        f"[{name}] {ann_name} mean {mean} below min_score {threshold}"
                    )

    return result


def _ancestor_commits(state: "SuiteState") -> Optional[list[str]]:
    # Baseline resolution uses the parent commit chain; collect from git when available so the
    # server can pick the most recent prior experiment on the same dataset version.
    from .repo_info import _git

    log = (
        _git("log", "--pretty=%H", "-n", "100", "HEAD~1")
        if state.config.collect_repo_info
        else None
    )
    if not log:
        return None
    return [line.strip() for line in log.splitlines() if line.strip()]


def render_summary(state: "SuiteState", gate: GateResult) -> list[str]:
    lines: list[str] = []
    n_runs = len(state.recorded_runs)
    n_groups = len(state.groups)
    lines.append(f"Phoenix: recorded {n_runs} run(s) across {n_groups} experiment(s).")

    for name, summary in gate.summaries.items():
        baseline = summary.get("baseline_experiment_id")
        rows = summary.get("annotation_summaries", [])
        if not rows:
            continue
        header = f"  [{name}]" + (
            f" vs baseline {baseline}" if baseline else " (no comparable baseline)"
        )
        lines.append(header)
        for row in rows:
            ann = row.get("annotation_name")
            mean = row.get("mean_score")
            diff = row.get("diff")
            direction = row.get("optimization_direction", "maximize")
            diff_str = "" if diff is None else f" (diff {diff:+.4f}, {direction})"
            lines.append(f"    {ann}: {mean}{diff_str}")

    if gate.reasons:
        lines.append("  Phoenix gate FAILED:")
        for reason in gate.reasons:
            lines.append(f"    - {reason}")
    elif gate.summaries and state.config.gate_configured:
        lines.append("  Phoenix gate passed.")

    return lines
