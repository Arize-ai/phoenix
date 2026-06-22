"""Unit tests for the PXI eval failure report builders.

Synthetic ``RanExperiment`` fixtures only -- no Phoenix calls.

Run directly:

    uv run pytest tests/unit/pxi/evals/test_reporting.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from phoenix.client.resources.experiments.types import (
    ExperimentEvaluation,
    ExperimentEvaluationRun,
    ExperimentRun,
    RanExperiment,
)

from evals.pxi.harness.datasets import EvalDataset
from evals.pxi.harness.reporting import (
    build_report,
    report_to_json,
    report_to_markdown,
    write_reports,
)

BASE_URL = "http://phoenix.example.com"
NOW = datetime.now(timezone.utc)


def _dataset() -> EvalDataset:
    return EvalDataset.model_validate(
        {
            "dataset_name": "example_suite",
            "evaluators": ["correct_tools_called"],
            "examples": [
                {
                    "id": "passing-example",
                    "splits": ["regression"],
                    "input": {"messages": [{"role": "user", "content": "list LLM spans"}]},
                    "expected": {"tools": {"required": ["set_spans_filter"]}},
                },
                {
                    "id": "failing-example",
                    "splits": ["regression"],
                    "input": {
                        "messages": [{"role": "user", "content": "show errors"}],
                        "contexts": [{"type": "project", "projectNodeId": "UHJvamVjdDox"}],
                    },
                    "expected": {"tools": {"required": ["set_spans_filter"]}},
                },
                {
                    "id": "task-error-example",
                    "splits": ["dev"],
                    "input": {"messages": [{"role": "user", "content": "boom"}]},
                    "expected": {"tools": {"required": []}},
                },
                {
                    "id": "missing-score-example",
                    "splits": ["regression"],
                    "input": {"messages": [{"role": "user", "content": "hmm"}]},
                    "expected": {"tools": {"required": []}},
                },
            ],
        }
    )


def _task_run(
    run_id: str,
    example_id: str,
    *,
    output: Any = None,
    error: str | None = None,
    trace_id: str | None = None,
) -> ExperimentRun:
    task_run: ExperimentRun = {
        "id": run_id,
        "dataset_example_id": example_id,
        "output": output if output is not None else {"assistant_text": "ok", "messages": []},
        "repetition_number": 1,
        "start_time": NOW.isoformat(),
        "end_time": NOW.isoformat(),
        "experiment_id": "experiment-1",
    }
    if error is not None:
        task_run["error"] = error
    if trace_id is not None:
        task_run["trace_id"] = trace_id
    return task_run


def _evaluation(
    run_id: str,
    *,
    name: str = "correct_tools_called",
    score: float | None = None,
    label: str | None = None,
    explanation: str | None = None,
    error: str | None = None,
) -> ExperimentEvaluationRun:
    result: ExperimentEvaluation | None = None
    if error is None:
        result = {}
        if score is not None:
            result["score"] = score
        if label is not None:
            result["label"] = label
        if explanation is not None:
            result["explanation"] = explanation
    return ExperimentEvaluationRun(
        experiment_run_id=run_id,
        start_time=NOW,
        end_time=NOW,
        name=name,
        annotator_kind="CODE",
        result=result,
        error=error,
    )


def _experiment() -> RanExperiment:
    """One passing, one eval-fail (with trace), one task-error, one
    missing-score example."""
    return {
        "experiment_id": "RXhwZXJpbWVudDox",
        "dataset_id": "RGF0YXNldDox",
        "dataset_version_id": "version-1",
        "task_runs": [
            _task_run("run-pass", "passing-example"),
            _task_run(
                "run-fail",
                "failing-example",
                output={
                    "assistant_text": "done",
                    "messages": [
                        {
                            "parts": [
                                {
                                    "part_kind": "tool-call",
                                    "tool_name": "set_time_range",
                                    "args": {"preset": "7d"},
                                }
                            ]
                        }
                    ],
                    "stable_example_id": "failing-example",
                },
                trace_id="abc123def456",
            ),
            _task_run(
                "run-error",
                "task-error-example",
                error="TimeoutError: task timed out",
            ),
            _task_run("run-missing", "missing-score-example"),
        ],
        "evaluation_runs": [
            _evaluation("run-pass", score=1.0, label="pass"),
            _evaluation(
                "run-fail",
                score=0.0,
                label="fail",
                explanation="expected set_spans_filter, agent called set_time_range",
            ),
            _evaluation("run-missing", label="indeterminate"),
        ],
        "experiment_metadata": {
            "git_sha": "deadbeef",
            "git_branch": "ehutt/eval-harness",
            "assistant_provider": "OPENAI",
            "assistant_model": "gpt-5.4",
            "started_at": NOW.isoformat(),
        },
        "project_name": None,
    }


def _report() -> Any:
    return build_report(
        _dataset(),
        _experiment(),
        base_url=BASE_URL,
        splits=["regression", "dev"],
        experiment_name="ci-pxi-eval-example_suite",
        generated_at="2026-06-12T00:00:00+00:00",
    )


def test_report_counts_and_metadata() -> None:
    report = _report()

    assert report.dataset_name == "example_suite"
    assert report.examples_run == 4
    assert report.examples_passed == 1
    assert len(report.failures) == 3
    assert report.git_sha == "deadbeef"
    assert report.git_branch == "ehutt/eval-harness"
    assert report.assistant_provider == "OPENAI"
    assert report.assistant_model == "gpt-5.4"
    assert report.experiment_url == (
        f"{BASE_URL}/datasets/RGF0YXNldDox/compare?experimentId=RXhwZXJpbWVudDox"
    )
    assert report.repro_command == (
        "uv run python -m evals.pxi.harness.run_experiment "
        "--dataset example_suite --splits regression dev"
    )
    assert report.dataset_file == "evals/pxi/datasets/example_suite.yaml"


def test_report_uses_cli_dataset_stem_when_it_differs_from_dataset_name() -> None:
    report = build_report(
        _dataset(),
        _experiment(),
        base_url=BASE_URL,
        splits=["regression"],
        dataset_arg="example_suite_v2",
    )

    assert report.dataset_file == "evals/pxi/datasets/example_suite_v2.yaml"
    assert "--dataset example_suite_v2" in report.repro_command
    # Sentinels are keyed by the stem too, matching the CI lookup.
    markdown = report_to_markdown(report)
    assert markdown.startswith("===== BEGIN PXI EVAL REPORT: example_suite_v2 =====")


def test_write_reports_names_files_by_cli_stem(tmp_path: Path) -> None:
    """CI looks reports up by the dataset file stem; file names must follow
    the stem even when the YAML dataset_name differs."""
    report = build_report(
        _dataset(),
        _experiment(),
        base_url=BASE_URL,
        splits=["regression"],
        dataset_arg="example_suite_v2",
    )

    json_path, md_path = write_reports(report, tmp_path)

    assert json_path.name == "example_suite_v2.report.json"
    assert md_path.name == "example_suite_v2.report.md"


def test_markdown_fences_survive_embedded_backtick_runs() -> None:
    """An explanation quoting a code fence must not terminate the report's
    own fenced block early."""
    dataset = _dataset()
    experiment = _experiment()
    experiment["evaluation_runs"][1] = _evaluation(
        "run-fail",
        score=0.0,
        label="fail",
        explanation='agent emitted:\n```json\n{"bad": true}\n```\nwhich is wrong',
    )

    markdown = report_to_markdown(
        build_report(dataset, experiment, base_url=BASE_URL, splits=["regression"])
    )

    # The fence wrapping the explanation must be longer than the embedded one.
    assert "````text" in markdown
    assert 'agent emitted:\n```json\n{"bad": true}\n```\nwhich is wrong\n````' in markdown


def test_report_excludes_passing_examples_from_failures() -> None:
    report = _report()

    assert "passing-example" not in {failure.example_id for failure in report.failures}


def test_eval_failure_record_has_full_untruncated_fields() -> None:
    report = _report()
    failure = next(f for f in report.failures if f.example_id == "failing-example")

    assert failure.splits == ["regression"]
    assert failure.input == {
        "messages": [{"role": "user", "content": "show errors"}],
        "contexts": [{"type": "project", "projectNodeId": "UHJvamVjdDox"}],
    }
    assert failure.expected == {"tools": {"required": ["set_spans_filter"]}}
    assert failure.actual_output["assistant_text"] == "done"
    assert failure.task_error is None
    assert failure.trace_id == "abc123def456"
    assert failure.trace_url == f"{BASE_URL}/redirects/traces/abc123def456"
    [evaluation] = failure.evaluations
    assert evaluation.name == "correct_tools_called"
    assert evaluation.score == 0.0
    assert evaluation.label == "fail"
    assert evaluation.explanation == ("expected set_spans_filter, agent called set_time_range")
    assert evaluation.error is None
    assert evaluation.passed is False


def test_task_error_record() -> None:
    report = _report()
    failure = next(f for f in report.failures if f.example_id == "task-error-example")

    assert failure.task_error == "TimeoutError: task timed out"
    assert failure.trace_id is None
    assert failure.trace_url is None


def test_missing_score_counts_as_failure() -> None:
    report = _report()
    failure = next(f for f in report.failures if f.example_id == "missing-score-example")

    [evaluation] = failure.evaluations
    assert evaluation.score is None
    assert evaluation.passed is False


def test_json_round_trips_with_schema_fields() -> None:
    payload = json.loads(report_to_json(_report()))

    assert payload["schema_version"] == 1
    assert payload["dataset_name"] == "example_suite"
    assert payload["examples_run"] == 4
    assert payload["examples_passed"] == 1
    assert {f["example_id"] for f in payload["failures"]} == {
        "failing-example",
        "task-error-example",
        "missing-score-example",
    }
    failing = next(f for f in payload["failures"] if f["example_id"] == "failing-example")
    assert failing["evaluations"][0]["explanation"] == (
        "expected set_spans_filter, agent called set_time_range"
    )
    assert payload["evaluator_summary"][0]["name"] == "correct_tools_called"


def test_markdown_has_sentinels_digest_payloads_and_repro_footer() -> None:
    markdown = report_to_markdown(_report())

    assert markdown.startswith("===== BEGIN PXI EVAL REPORT: example_suite =====")
    assert markdown.endswith("===== END PXI EVAL REPORT: example_suite =====")
    assert "## Digest" in markdown
    assert "expected set_spans_filter, agent called set_time_range" in markdown
    assert "### Example: `failing-example`" in markdown
    assert "**Task error:**" in markdown
    assert "TimeoutError: task timed out" in markdown
    # Tool calls the agent actually made are surfaced openly.
    assert "set_time_range" in markdown
    # Message histories are collapsed, not dumped inline.
    assert "<details>" in markdown
    # Repro footer makes a pasted report self-sufficient.
    assert "uv run python -m evals.pxi.harness.run_experiment" in markdown
    assert f"{BASE_URL}/datasets/RGF0YXNldDox/compare" in markdown
    assert f"{BASE_URL}/redirects/traces/abc123def456" in markdown


def test_static_instructions_replaced_with_placeholder() -> None:
    dataset = _dataset()
    experiment = _experiment()
    big_prompt = "you are a helpful assistant " * 1_000
    experiment["task_runs"][1]["output"]["messages"][0]["instructions"] = big_prompt

    report = build_report(dataset, experiment, base_url=BASE_URL, splits=["regression"])

    failure = next(f for f in report.failures if f.example_id == "failing-example")
    instructions = failure.actual_output["messages"][0]["instructions"]
    assert big_prompt not in instructions
    assert "static system instructions omitted" in instructions
    assert f"({len(big_prompt)} chars)" in instructions
    assert any("Static system instructions" in note for note in report.notes)
    assert "Static system instructions" in report_to_markdown(report)
    # The experiment dict itself is not mutated.
    assert experiment["task_runs"][1]["output"]["messages"][0]["instructions"] == big_prompt


def test_short_instructions_kept_inline() -> None:
    dataset = _dataset()
    experiment = _experiment()
    experiment["task_runs"][1]["output"]["messages"][0]["instructions"] = "be brief"

    report = build_report(dataset, experiment, base_url=BASE_URL, splits=["regression"])

    failure = next(f for f in report.failures if f.example_id == "failing-example")
    assert failure.actual_output["messages"][0]["instructions"] == "be brief"
    assert report.notes == []


def test_markdown_falls_back_to_digest_when_oversized() -> None:
    markdown = report_to_markdown(_report(), max_bytes=2_000)

    assert "## Failures" not in markdown
    assert "## Digest" in markdown
    assert "pxi-eval-reports-<run-id>" in markdown
    assert markdown.startswith("===== BEGIN PXI EVAL REPORT: example_suite =====")


def test_markdown_wraps_pathologically_long_lines() -> None:
    dataset = _dataset()
    experiment = _experiment()
    experiment["task_runs"][1]["output"]["assistant_text"] = "x" * 70_000

    markdown = report_to_markdown(
        build_report(dataset, experiment, base_url=BASE_URL, splits=["regression"])
    )

    assert all(len(line) <= 16_000 for line in markdown.splitlines())


def test_write_reports_writes_both_files(tmp_path: Path) -> None:
    report = _report()

    json_path, md_path = write_reports(report, tmp_path / "reports")

    assert json_path == tmp_path / "reports" / "example_suite.report.json"
    assert md_path == tmp_path / "reports" / "example_suite.report.md"
    assert json.loads(json_path.read_text())["dataset_name"] == "example_suite"
    assert "===== BEGIN PXI EVAL REPORT: example_suite =====" in md_path.read_text()
