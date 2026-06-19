"""Reporting helpers for the PXI eval experiment runner.

Pure functions over :class:`RanExperiment` and :class:`EvalDataset` -- no
Phoenix network calls -- so the console summary and failure reports stay
unit-testable without a live server.
"""

from __future__ import annotations

import dataclasses
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence
from urllib.parse import urljoin

from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment

from evals.pxi.harness.datasets import DATASETS_DIR, EvalDataset
from evals.pxi.harness.gating import (
    PASSING_SCORE,
    GateDecision,
    attempt_outcomes,
    example_splits_by_id,
    is_failed_evaluation,
    score,
    stable_example_id,
    task_run_error,
)

MAX_TABLE_CELL_WIDTH = 80

# Repo-relative datasets dir for report links and repro commands, derived
# from the same constant the loader uses so a relocation updates both.
_DATASETS_DIR_RELATIVE = DATASETS_DIR.relative_to(DATASETS_DIR.parents[2])

REPORT_SCHEMA_VERSION = 1
# GitHub step summaries cap at 1 MiB and log lines at ~64 KiB. Keep the
# rendered Markdown comfortably under the summary cap; fall back to a
# digest-only report when a pathological dataset-wide failure would blow
# past it.
MAX_REPORT_MD_BYTES = 800_000
MAX_REPORT_LINE_CHARS = 16_000
_DIGEST_EXPLANATION_CHARS = 200


def _format_table(headers: tuple[str, ...], rows: Sequence[tuple[str, ...]]) -> str:
    widths = [
        max(len(header), *(len(row[index]) for row in rows)) for index, header in enumerate(headers)
    ]
    rule = "+" + "+".join("-" * (width + 2) for width in widths) + "+"

    def format_row(row: tuple[str, ...]) -> str:
        cells = [value.ljust(widths[index]) for index, value in enumerate(row)]
        return "| " + " | ".join(cells) + " |"

    lines = [rule, format_row(headers), rule]
    lines.extend(format_row(row) for row in rows)
    lines.append(rule)
    return "\n".join(lines)


def _truncate_cell(value: Any) -> str:
    text = str(value)
    if len(text) <= MAX_TABLE_CELL_WIDTH:
        return text
    return text[: MAX_TABLE_CELL_WIDTH - 3] + "..."


def _result_field(evaluation_run: ExperimentEvaluationRun, key: str) -> str:
    result = evaluation_run.result
    if not isinstance(result, dict):
        return ""
    value = result.get(key)
    return "" if value is None else _truncate_cell(value)


def _task_error_rows(experiment: RanExperiment) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for task_run in experiment.get("task_runs", []):
        error = task_run_error(task_run)
        if not error:
            continue
        rows.append((_truncate_cell(stable_example_id(task_run)), _truncate_cell(error)))
    return rows


def _score_display(error: str | None, score: float | None) -> str:
    """Single source of truth for rendering an evaluation's score state."""
    if error is not None:
        return "error"
    if score is None:
        return "missing"
    return f"{score:g}"


def _failed_evaluation_rows(
    experiment: RanExperiment,
    evaluation_runs: Sequence[ExperimentEvaluationRun],
) -> list[tuple[str, str, str, str, str]]:
    task_runs_by_id = {
        str(task_run["id"]): task_run
        for task_run in experiment.get("task_runs", [])
        if "id" in task_run
    }
    rows: list[tuple[str, str, str, str, str]] = []
    for evaluation_run in evaluation_runs:
        if not is_failed_evaluation(evaluation_run):
            continue
        task_run = task_runs_by_id.get(str(evaluation_run.experiment_run_id))
        example_id = (
            stable_example_id(task_run) if task_run else str(evaluation_run.experiment_run_id)
        )
        rows.append(
            (
                _truncate_cell(example_id),
                _truncate_cell(evaluation_run.name or "unknown"),
                _score_display(evaluation_run.error, score(evaluation_run)),
                _result_field(evaluation_run, "label"),
                _truncate_cell(
                    evaluation_run.error or _result_field(evaluation_run, "explanation")
                ),
            )
        )
    return rows


def _evaluator_summary_rows(
    evaluation_runs: Sequence[ExperimentEvaluationRun],
) -> list[tuple[str, dict[str, int]]]:
    by_evaluator: dict[str, dict[str, int]] = {}
    for evaluation_run in evaluation_runs:
        name = str(evaluation_run.name or "unknown")
        summary = by_evaluator.setdefault(
            name,
            {"total": 0, "passing": 0, "failing": 0, "missing_score": 0, "errors": 0},
        )
        summary["total"] += 1
        run_score = score(evaluation_run)
        if evaluation_run.error is not None:
            summary["errors"] += 1
            summary["failing"] += 1
        elif run_score is None:
            summary["missing_score"] += 1
            summary["failing"] += 1
        elif run_score >= PASSING_SCORE:
            summary["passing"] += 1
        else:
            summary["failing"] += 1
    return sorted(by_evaluator.items())


def _has_regression_evaluator_failure(
    dataset: EvalDataset,
    experiment: RanExperiment,
    evaluation_runs: Sequence[ExperimentEvaluationRun],
) -> bool:
    splits_by_id = example_splits_by_id(dataset)
    task_runs_by_id = {
        str(task_run["id"]): task_run
        for task_run in experiment.get("task_runs", [])
        if "id" in task_run
    }
    for evaluation_run in evaluation_runs:
        if not is_failed_evaluation(evaluation_run):
            continue
        task_run = task_runs_by_id.get(str(evaluation_run.experiment_run_id))
        if task_run is None:
            continue
        if task_run_error(task_run) is not None:
            continue
        example_id = stable_example_id(task_run)
        if "regression" in splits_by_id.get(example_id, set()):
            return True
    return False


def _print_score_summary(dataset: EvalDataset, experiment: RanExperiment, *, base_url: str) -> bool:
    experiment_url = _experiment_url(experiment, base_url)
    if experiment_url:
        print(f"Experiment: {experiment_url}")
    evaluation_runs = list(experiment.get("evaluation_runs") or [])
    evaluator_summaries = _evaluator_summary_rows(evaluation_runs)

    print(f"Dataset: {dataset.dataset_name} ({len(experiment.get('task_runs', []))} examples run)")
    task_error_rows = _task_error_rows(experiment)
    if task_error_rows:
        print(f"Task errors: {len(task_error_rows)}/{len(experiment.get('task_runs', []))}")
        print(_format_table(("Example", "Error"), task_error_rows))
    if evaluator_summaries:
        rows = []
        for name, summary in evaluator_summaries:
            total = int(summary["total"])
            passing = int(summary["passing"])
            pass_rate = f"{passing / total:.0%}" if total else "n/a"
            rows.append(
                (
                    name,
                    str(total),
                    str(passing),
                    str(summary["failing"]),
                    str(summary["errors"]),
                    str(summary["missing_score"]),
                    pass_rate,
                )
            )
        print(f"Evaluator results (passing score >= {PASSING_SCORE:g}):")
        print(
            _format_table(
                ("Evaluator", "Total", "Passed", "Failed", "Errors", "Missing", "Pass Rate"),
                rows,
            )
        )
        failed_rows = _failed_evaluation_rows(experiment, evaluation_runs)
        if failed_rows:
            print("Failed evaluations:")
            print(_format_table(("Example", "Evaluator", "Score", "Label", "Details"), failed_rows))
    return _has_regression_evaluator_failure(dataset, experiment, evaluation_runs)


# ---------------------------------------------------------------------------
# Failure reports (closes #13668)
#
# Two output tiers per dataset run:
#   <dataset>.report.json  -- machine/agent-readable, full fidelity
#   <dataset>.report.md    -- human/agent-friendly; the "paste into a coding
#                             agent" artifact, embedded in the CI job log
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EvaluationRecord:
    """One evaluator's verdict on a single example, untruncated."""

    name: str
    score: float | None
    label: str | None
    explanation: str | None
    error: str | None
    passed: bool


@dataclass(frozen=True)
class ExampleFailure:
    """A failed or errored example with everything an agent needs to act."""

    example_id: str
    splits: list[str]
    trace_id: str | None
    trace_url: str | None
    input: Any
    expected: Any
    actual_output: Any
    task_error: str | None
    evaluations: list[EvaluationRecord]
    attempts: list[dict[str, Any]] = field(default_factory=list)
    flaky: bool = False


@dataclass(frozen=True)
class Report:
    """Full failure report for one dataset run."""

    dataset_name: str
    # CLI stem (``--dataset <stem>``): keys the report file names, sentinel
    # markers, and repro command, matching how CI iterates dataset files.
    dataset_stem: str
    dataset_file: str
    experiment_name: str | None
    experiment_url: str | None
    git_sha: str
    git_branch: str
    assistant_provider: str
    assistant_model: str
    splits: list[str]
    generated_at: str
    examples_run: int
    examples_passed: int
    confirmed_regression_count: int
    infra_failure_count: int
    flaky_count: int
    evaluator_summary: list[dict[str, Any]]
    failures: list[ExampleFailure]
    attempts: list[dict[str, Any]]
    repro_command: str
    schema_version: int = REPORT_SCHEMA_VERSION
    notes: list[str] = field(default_factory=list)


def _experiment_url(experiment: RanExperiment, base_url: str) -> str | None:
    if not experiment.get("experiment_id"):
        return None
    return urljoin(
        base_url.rstrip("/") + "/",
        f"datasets/{experiment['dataset_id']}/compare?experimentId={experiment['experiment_id']}",
    )


def _trace_url(trace_id: str | None, base_url: str) -> str | None:
    """Per-trace deep link via Phoenix's OTEL-id redirect route.

    ``/redirects/traces/<trace_otel_id>`` resolves a bare OTEL trace id to
    the project trace page without needing the project node id.
    """
    if not trace_id:
        return None
    return urljoin(base_url.rstrip("/") + "/", f"redirects/traces/{trace_id}")


# The serialized pydantic_ai messages repeat the full static system prompt
# (~55 KB) on every model request under ``instructions``. That is product
# prompt, not example data -- it dominates report size and drowns the signal
# when pasted into an agent. Replace anything past this threshold with a
# placeholder; the untouched prompt is viewable via the trace URL.
_MAX_INLINE_INSTRUCTIONS_CHARS = 2_000


def _strip_static_instructions(actual_output: Any) -> tuple[Any, bool]:
    """Replace oversized static ``instructions`` fields in the task output's
    serialized messages with a placeholder. Returns the (possibly copied)
    output and whether anything was replaced."""
    if not isinstance(actual_output, dict) or not isinstance(actual_output.get("messages"), list):
        return actual_output, False
    stripped = False
    messages: list[Any] = []
    for message in actual_output["messages"]:
        instructions = message.get("instructions") if isinstance(message, dict) else None
        if isinstance(instructions, str) and len(instructions) > _MAX_INLINE_INSTRUCTIONS_CHARS:
            message = {
                **message,
                "instructions": (
                    f"<static system instructions omitted ({len(instructions)} chars); "
                    "see the trace URL for the full prompt>"
                ),
            }
            stripped = True
        messages.append(message)
    if not stripped:
        return actual_output, False
    return {**actual_output, "messages": messages}, True


def _evaluation_record(evaluation_run: ExperimentEvaluationRun) -> EvaluationRecord:
    result = evaluation_run.result if isinstance(evaluation_run.result, dict) else {}
    label = result.get("label")
    explanation = result.get("explanation")
    return EvaluationRecord(
        name=str(evaluation_run.name or "unknown"),
        score=score(evaluation_run),
        label=str(label) if label is not None else None,
        explanation=str(explanation) if explanation is not None else None,
        error=evaluation_run.error,
        passed=not is_failed_evaluation(evaluation_run),
    )


def _attempt_dicts(
    dataset: EvalDataset,
    experiment: RanExperiment,
    *,
    attempt: int,
    base_url: str,
    include_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    outcomes = attempt_outcomes(dataset, experiment, attempt=attempt)
    experiment_url = _experiment_url(experiment, base_url)
    return [
        {
            "example_id": outcome.example_id,
            "attempt": outcome.attempt,
            "experiment_id": outcome.experiment_id,
            "experiment_url": experiment_url,
            "task_error": outcome.task_error,
            "failed_evaluators": list(outcome.failed_evaluators),
            "failed": outcome.failed,
        }
        for outcome in outcomes.values()
        if outcome.failed or (include_ids is not None and outcome.example_id in include_ids)
    ]


def build_report(
    dataset: EvalDataset,
    experiment: RanExperiment,
    *,
    base_url: str,
    splits: Sequence[str],
    experiment_name: str | None = None,
    generated_at: str | None = None,
    dataset_arg: str | None = None,
    retry_experiment: RanExperiment | None = None,
    gate_decision: GateDecision | None = None,
) -> Report:
    """Build a failure report from a completed experiment.

    Pure function over ``RanExperiment`` + ``EvalDataset`` -- no Phoenix
    calls. Only failed or errored examples carry full payloads; passing
    examples contribute to counts only, keeping artifacts small.
    """
    metadata = dict(experiment.get("experiment_metadata") or {})
    examples_by_id = {str(example["id"]): example for example in dataset.examples}
    evaluations_by_run_id: dict[str, list[ExperimentEvaluationRun]] = {}
    for evaluation_run in experiment.get("evaluation_runs") or []:
        evaluations_by_run_id.setdefault(str(evaluation_run.experiment_run_id), []).append(
            evaluation_run
        )

    attempt_records: list[dict[str, Any]] = []
    if gate_decision is not None or retry_experiment is not None:
        include_ids = set(gate_decision.failed_once_ids) if gate_decision is not None else None
        attempt_records.extend(
            _attempt_dicts(
                dataset,
                experiment,
                attempt=1,
                base_url=base_url,
                include_ids=include_ids,
            )
        )
    if retry_experiment is not None:
        include_ids = set(gate_decision.retry_ids) if gate_decision is not None else None
        attempt_records.extend(
            _attempt_dicts(
                dataset,
                retry_experiment,
                attempt=2,
                base_url=base_url,
                include_ids=include_ids,
            )
        )
    attempts_by_example: dict[str, list[dict[str, Any]]] = {}
    for attempt in attempt_records:
        attempts_by_example.setdefault(str(attempt["example_id"]), []).append(attempt)
    report_example_ids = set(attempts_by_example)
    if gate_decision is not None:
        report_example_ids.update(gate_decision.confirmed_regression_ids)
        report_example_ids.update(gate_decision.infra_ids)
        report_example_ids.update(gate_decision.flaky_ids)

    failures: list[ExampleFailure] = []
    instructions_stripped = False
    task_runs = list(experiment.get("task_runs") or [])
    for task_run in task_runs:
        task_error = task_run_error(task_run)
        evaluations = [
            _evaluation_record(run)
            for run in evaluations_by_run_id.get(str(task_run.get("id", "")), [])
        ]
        example_id = stable_example_id(task_run)
        if (
            task_error is None
            and all(record.passed for record in evaluations)
            and example_id not in report_example_ids
        ):
            continue
        example = examples_by_id.get(example_id, {})
        trace_id = task_run.get("trace_id")
        actual_output, stripped = _strip_static_instructions(task_run.get("output"))
        instructions_stripped = instructions_stripped or stripped
        failures.append(
            ExampleFailure(
                example_id=example_id,
                splits=[str(split) for split in example.get("splits", [])],
                trace_id=str(trace_id) if trace_id else None,
                trace_url=_trace_url(str(trace_id) if trace_id else None, base_url),
                input=example.get("input"),
                expected=example.get("expected"),
                actual_output=actual_output,
                task_error=task_error,
                evaluations=evaluations,
                attempts=attempts_by_example.get(example_id, []),
                flaky=(gate_decision is not None and example_id in gate_decision.flaky_ids),
            )
        )

    evaluator_summary = [
        {"name": name, **summary}
        for name, summary in _evaluator_summary_rows(list(experiment.get("evaluation_runs") or []))
    ]
    # ``dataset_arg`` is the CLI stem (``--dataset <stem>``), which is what
    # both the YAML path and the repro command actually need; the YAML's
    # ``dataset_name`` is only a fallback that usually matches the stem.
    dataset_stem = dataset_arg or dataset.dataset_name
    return Report(
        dataset_name=dataset.dataset_name,
        dataset_stem=dataset_stem,
        # ``as_posix`` keeps forward slashes so the repo-relative path renders
        # and compares identically on Windows (avoids backslash separators).
        dataset_file=(_DATASETS_DIR_RELATIVE / f"{dataset_stem}.yaml").as_posix(),
        experiment_name=experiment_name,
        experiment_url=_experiment_url(experiment, base_url),
        git_sha=str(metadata.get("git_sha", "unknown")),
        git_branch=str(metadata.get("git_branch", "unknown")),
        assistant_provider=str(metadata.get("assistant_provider", "unknown")),
        assistant_model=str(metadata.get("assistant_model", "unknown")),
        splits=[str(split) for split in splits],
        generated_at=generated_at or datetime.now(timezone.utc).isoformat(),
        examples_run=len(task_runs),
        examples_passed=len(task_runs) - len(failures),
        confirmed_regression_count=(
            len(gate_decision.confirmed_regression_ids) if gate_decision is not None else 0
        ),
        infra_failure_count=len(gate_decision.infra_ids) if gate_decision is not None else 0,
        flaky_count=len(gate_decision.flaky_ids) if gate_decision is not None else 0,
        evaluator_summary=evaluator_summary,
        failures=failures,
        attempts=attempt_records,
        repro_command=(
            "uv run python -m evals.pxi.harness.run_experiment "
            f"--dataset {dataset_stem} --splits {' '.join(str(s) for s in splits)}"
        ),
        notes=(
            [
                "Static system instructions were replaced with a placeholder in "
                "actual_output.messages; open the trace URL for the full prompt."
            ]
            if instructions_stripped
            else []
        ),
    )


def report_to_json(report: Report) -> str:
    """Serialize the full-fidelity report as indented JSON (untruncated)."""
    return json.dumps(dataclasses.asdict(report), indent=2, default=str)


def _first_line(text: str | None, limit: int = _DIGEST_EXPLANATION_CHARS) -> str:
    if not text:
        return ""
    line = text.strip().splitlines()[0] if text.strip() else ""
    if len(line) > limit:
        return line[: limit - 1] + "…"
    return line


def _wrap_long_lines(text: str, width: int = MAX_REPORT_LINE_CHARS) -> str:
    """Soft-wrap pathological single-line payloads so log lines stay under
    GitHub's ~64 KiB per-line cap."""
    lines = text.splitlines()
    if all(len(line) <= width for line in lines):
        return text
    wrapped: list[str] = []
    for line in lines:
        if len(line) <= width:
            wrapped.append(line)
        else:
            wrapped.extend(line[start : start + width] for start in range(0, len(line), width))
    return "\n".join(wrapped)


def _fenced_block(text: str, lang: str = "") -> str:
    """Fence ``text`` with enough backticks that no backtick run inside it
    (e.g. an evaluator explanation quoting a code fence) can close the block
    early and corrupt the rest of the report."""
    longest_run = max((len(match.group(0)) for match in re.finditer(r"`+", text)), default=0)
    fence = "`" * max(3, longest_run + 1)
    return f"{fence}{lang}\n{text}\n{fence}"


def _json_block(value: Any) -> str:
    return _fenced_block(json.dumps(value, indent=2, default=str), "json")


def _payload_section(title: str, value: Any) -> list[str]:
    """Render an input/output payload, collapsing message histories (which can
    be very long post-#13474) under ``<details>`` while keeping everything
    else open."""
    lines = [f"**{title}:**", ""]
    if isinstance(value, dict) and isinstance(value.get("messages"), list):
        rest = {key: val for key, val in value.items() if key != "messages"}
        if rest:
            lines.extend([_json_block(rest), ""])
        messages = value["messages"]
        lines.extend(
            [
                "<details>",
                f"<summary>{title.lower()} messages ({len(messages)})</summary>",
                "",
                _json_block(messages),
                "",
                "</details>",
                "",
            ]
        )
    else:
        lines.extend([_json_block(value), ""])
    return lines


def _tool_calls_from_output(actual_output: Any) -> list[dict[str, Any]]:
    """Extract ``tool-call`` parts from the serialized pydantic_ai messages in
    the task output, so the report surfaces what the agent actually did."""
    if not isinstance(actual_output, dict):
        return []
    calls: list[dict[str, Any]] = []
    for message in actual_output.get("messages") or []:
        if not isinstance(message, dict):
            continue
        for part in message.get("parts") or []:
            if isinstance(part, dict) and part.get("part_kind") == "tool-call":
                calls.append({"tool_name": part.get("tool_name"), "args": part.get("args")})
    return calls


def _digest_rows(report: Report) -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    for failure in report.failures:
        if failure.task_error is not None:
            rows.append((failure.example_id, "(task)", "error", _first_line(failure.task_error)))
        for record in failure.evaluations:
            if record.passed:
                continue
            rows.append(
                (
                    failure.example_id,
                    record.name,
                    _score_display(record.error, record.score),
                    _first_line(record.error or record.explanation),
                )
            )
    return rows


def _md_header(report: Report) -> list[str]:
    failed = len(report.failures)
    lines = [
        f"# PXI Eval Failure Report: {report.dataset_name}",
        "",
        f"- **Experiment**: {report.experiment_name or 'unknown'}"
        + (f" — {report.experiment_url}" if report.experiment_url else ""),
        f"- **Dataset file**: `{report.dataset_file}`",
        f"- **Git**: `{report.git_branch}` @ `{report.git_sha}`",
        f"- **Model**: {report.assistant_provider}/{report.assistant_model}",
        f"- **Splits**: {', '.join(report.splits)}",
        f"- **Generated**: {report.generated_at}",
        f"- **Examples**: {report.examples_run} run, "
        f"{report.examples_passed} passed, {failed} failed",
        f"- **Gate**: {report.confirmed_regression_count} confirmed regression, "
        f"{report.infra_failure_count} infra, {report.flaky_count} flaky-passed",
        "",
    ]
    digest = _digest_rows(report)
    if digest:
        lines.extend(
            [
                "## Digest",
                "",
                "| Example | Evaluator | Score | Explanation |",
                "| --- | --- | --- | --- |",
            ]
        )
        lines.extend(
            f"| `{example}` | `{evaluator}` | {score} | {_md_escape_cell(explanation)} |"
            for example, evaluator, score, explanation in digest
        )
        lines.append("")
    return lines


def _md_escape_cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def _md_failure_section(failure: ExampleFailure) -> list[str]:
    lines = [f"### Example: `{failure.example_id}`", ""]
    if failure.flaky:
        lines.append("- **Flaky**: failed first attempt, passed retry")
    if failure.splits:
        lines.append(f"- **Splits**: {', '.join(failure.splits)}")
    if failure.trace_url:
        lines.append(f"- **Trace**: {failure.trace_url}")
    lines.append("")
    if failure.attempts:
        lines.extend(["**Attempts:**", ""])
        lines.extend(
            [
                "| Attempt | Result | Experiment | Details |",
                "| --- | --- | --- | --- |",
            ]
        )
        for attempt in sorted(failure.attempts, key=lambda item: int(item["attempt"])):
            details: list[str] = []
            if attempt.get("task_error"):
                details.append(_first_line(str(attempt["task_error"])))
            failed_evaluators = attempt.get("failed_evaluators") or []
            if failed_evaluators:
                details.append("failed evaluators: " + ", ".join(map(str, failed_evaluators)))
            result = "failed" if attempt.get("failed") else "passed"
            experiment = attempt.get("experiment_url") or attempt.get("experiment_id") or ""
            lines.append(
                f"| {attempt['attempt']} | {result} | {_md_escape_cell(str(experiment))} "
                f"| {_md_escape_cell('; '.join(details))} |"
            )
        lines.append("")
    if failure.task_error is not None:
        lines.extend(["**Task error:**", "", _fenced_block(failure.task_error, "text"), ""])
    failed_evaluations = [record for record in failure.evaluations if not record.passed]
    for record in failed_evaluations:
        token = _score_display(record.error, record.score)
        score = {"error": "error", "missing": "missing score"}.get(token, f"score {token}")
        label = f" — label `{record.label}`" if record.label else ""
        lines.extend([f"#### `{record.name}` — {score}{label}", ""])
        detail = record.error or record.explanation
        if detail:
            lines.extend([_fenced_block(detail, "text"), ""])
    tool_calls = _tool_calls_from_output(failure.actual_output)
    if tool_calls:
        lines.extend(["**Tool calls made:**", "", _json_block(tool_calls), ""])
    if failure.input is not None:
        lines.extend(_payload_section("Input", failure.input))
    if failure.expected is not None:
        lines.extend(_payload_section("Expected", failure.expected))
    if failure.actual_output is not None:
        lines.extend(_payload_section("Actual output", failure.actual_output))
    return lines


def _md_footer(report: Report) -> list[str]:
    lines = [
        "## Repro",
        "",
        "Run this dataset locally:",
        "",
        "```bash",
        report.repro_command,
        "```",
        "",
    ]
    if report.experiment_url:
        lines.extend([f"Experiment (Phoenix): {report.experiment_url}", ""])
    return lines


def report_to_markdown(report: Report, *, max_bytes: int = MAX_REPORT_MD_BYTES) -> str:
    """Render the Markdown report, wrapped in sentinel markers so it can be
    grepped out of a CI job log.

    If the full render would exceed ``max_bytes`` (GitHub step-summary /
    log-embedding limits), fall back to the digest plus a pointer at the
    JSON artifact instead of truncating fields silently.
    """
    begin = f"===== BEGIN PXI EVAL REPORT: {report.dataset_stem} ====="
    end = f"===== END PXI EVAL REPORT: {report.dataset_stem} ====="

    def render(include_failures: bool, notes: Sequence[str]) -> str:
        lines = [begin, ""]
        lines.extend(_md_header(report))
        for note in notes:
            lines.extend([f"> **Note**: {note}", ""])
        if include_failures and report.failures:
            lines.append("## Failures")
            lines.append("")
            for failure in report.failures:
                lines.extend(_md_failure_section(failure))
        lines.extend(_md_footer(report))
        lines.append(end)
        return _wrap_long_lines("\n".join(lines))

    full = render(True, report.notes)
    if len(full.encode("utf-8")) <= max_bytes:
        return full
    return render(
        False,
        [
            *report.notes,
            "Full failure payloads exceeded the report size limit and were "
            f"omitted ({len(report.failures)} failed examples). Download the "
            f"untruncated JSON report ({report.dataset_stem}.report.json) from "
            "the `pxi-eval-reports-<run-id>` workflow artifact: "
            "`gh run download <run-id> -n pxi-eval-reports-<run-id>`.",
        ],
    )


def write_reports(report: Report, report_dir: Path) -> tuple[Path, Path]:
    """Write ``<stem>.report.json`` and ``<stem>.report.md`` under
    ``report_dir`` (created if missing). Returns the two paths.

    File names are keyed by ``dataset_stem`` (the ``--dataset`` CLI value),
    NOT the YAML's free-form ``dataset_name``: the CI workflow looks reports
    up by the dataset file stem, and nothing forces the two to match.
    """
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / f"{report.dataset_stem}.report.json"
    md_path = report_dir / f"{report.dataset_stem}.report.md"
    json_path.write_text(report_to_json(report) + "\n")
    md_path.write_text(report_to_markdown(report) + "\n")
    return json_path, md_path
