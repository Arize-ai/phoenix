from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

from phoenix.client import Client

from tests.pxi.evals.agent_task import (
    DEFAULT_ASSISTANT_MODEL,
    DEFAULT_ASSISTANT_PROVIDER,
    build_task,
)
from tests.pxi.evals.datasets import load_dataset, to_phoenix_examples
from tests.pxi.evals.evaluators import set_spans_filter_args_match, strict_tools_called
from tests.pxi.evals.types import EvalDataset

DEFAULT_BASE_URL = "http://localhost:6006"


class InfrastructureError(RuntimeError):
    """Raised when Phoenix infrastructure required for the eval is unavailable."""


@dataclass(frozen=True)
class RunnerConfig:
    dataset: str
    base_url: str
    bearer_token: str | None
    experiment_name: str | None
    experiment_name_suffix: str | None
    fail_on_regression: bool


def _configured_base_url() -> tuple[str, bool]:
    value = os.getenv("PXI_E2E_EXPERIMENT_BASE_URL")
    return (value or DEFAULT_BASE_URL).rstrip("/"), value is not None


def _check_local_healthz(base_url: str, explicitly_configured: bool) -> None:
    if explicitly_configured or base_url.rstrip("/") != DEFAULT_BASE_URL:
        return
    try:
        with urllib.request.urlopen(urljoin(base_url + "/", "healthz"), timeout=2) as response:
            if response.status >= 400:
                raise InfrastructureError(
                    f"Local Phoenix health check failed with HTTP {response.status}: {base_url}"
                )
    except (OSError, urllib.error.URLError) as exc:
        raise InfrastructureError(
            "Local Phoenix is unavailable at http://localhost:6006. "
            "Start Phoenix or set PXI_E2E_EXPERIMENT_BASE_URL."
        ) from exc


def _git_value(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _experiment_name(dataset: EvalDataset, config: RunnerConfig) -> str:
    if config.experiment_name:
        return config.experiment_name
    branch = _git_value("rev-parse", "--abbrev-ref", "HEAD").replace("/", "-")
    parts = ["pxi-eval", dataset.dataset_name, branch]
    if config.experiment_name_suffix:
        parts.append(config.experiment_name_suffix)
    return "-".join(parts)


def _experiment_url(base_url: str, experiment: Any) -> str:
    experiment_id = getattr(experiment, "experiment_id", None) or getattr(experiment, "id", None)
    if experiment_id is None and isinstance(experiment, dict):
        experiment_id = experiment.get("id") or experiment.get("experiment_id")
    return f"{base_url.rstrip('/')}/experiments/{experiment_id}" if experiment_id else base_url


def _score_value(score: Any) -> float | None:
    if isinstance(score, dict):
        value = score.get("score")
    else:
        value = getattr(score, "score", None)
    return float(value) if isinstance(value, (int, float)) else None


def _score_explanation(score: Any) -> str | None:
    if isinstance(score, dict):
        value = score.get("explanation")
    else:
        value = getattr(score, "explanation", None)
    return value if isinstance(value, str) else None


def _run_output(run: Any) -> Any:
    if isinstance(run, dict):
        return run.get("output")
    return getattr(run, "output", None)


def _run_id(run: Any) -> str:
    if isinstance(run, dict):
        return str(run.get("id") or "")
    return str(getattr(run, "id", ""))


def _run_dataset_example_id(run: Any) -> str:
    if isinstance(run, dict):
        return str(run.get("dataset_example_id") or "unknown")
    return str(getattr(run, "dataset_example_id", None) or "unknown")


def _run_stable_example_id(run: Any) -> str:
    output = _run_output(run)
    if isinstance(output, dict) and isinstance(output.get("stable_example_id"), str):
        return output["stable_example_id"]
    return _run_dataset_example_id(run)


def _evaluation_run_id(evaluation_run: Any) -> str:
    if isinstance(evaluation_run, dict):
        return str(evaluation_run.get("experiment_run_id") or "")
    return str(getattr(evaluation_run, "experiment_run_id", ""))


def _evaluation_name(evaluation_run: Any) -> str:
    if isinstance(evaluation_run, dict):
        return str(evaluation_run.get("name") or "unknown")
    return str(getattr(evaluation_run, "name", None) or "unknown")


def _evaluation_result(evaluation_run: Any) -> Any:
    if isinstance(evaluation_run, dict):
        return evaluation_run.get("result")
    return getattr(evaluation_run, "result", None)


def _evaluation_error(evaluation_run: Any) -> Any:
    if isinstance(evaluation_run, dict):
        return evaluation_run.get("error")
    return getattr(evaluation_run, "error", None)


def _failure_example_id(
    experiment_run_id: str,
    stable_example_ids_by_run_id: dict[str, str],
) -> str:
    if experiment_run_id:
        return stable_example_ids_by_run_id.get(experiment_run_id, experiment_run_id)
    return "unknown"


def _print_report(dataset: EvalDataset, experiment: Any, base_url: str) -> bool:
    evaluation_runs = []
    if isinstance(experiment, dict):
        task_runs = list(experiment.get("task_runs") or [])
        evaluation_runs = list(experiment.get("evaluation_runs") or [])
    else:
        task_runs = list(getattr(experiment, "task_runs", []) or getattr(experiment, "runs", []) or [])
        evaluation_runs = list(getattr(experiment, "evaluation_runs", []) or [])
    task_outputs_by_run_id = {_run_id(run): _run_output(run) for run in task_runs}
    stable_example_ids_by_run_id = {
        run_id: _run_stable_example_id(run)
        for run in task_runs
        if (run_id := _run_id(run))
    }
    counts: dict[str, dict[str, int]] = {}
    failures: list[tuple[str, str, str | None, Any]] = []
    for evaluation_run in evaluation_runs:
        name = _evaluation_name(evaluation_run)
        result = _evaluation_result(evaluation_run)
        error = _evaluation_error(evaluation_run)
        counts.setdefault(name, {"pass": 0, "fail": 0})
        passed = error is None and (_score_value(result) or 0.0) >= 1.0
        counts[name]["pass" if passed else "fail"] += 1
        if not passed:
            experiment_run_id = _evaluation_run_id(evaluation_run)
            failures.append(
                (
                    _failure_example_id(experiment_run_id, stable_example_ids_by_run_id),
                    name,
                    str(error) if error else _score_explanation(result),
                    task_outputs_by_run_id.get(experiment_run_id),
                )
            )

    print(f"Dataset: {dataset.dataset_name} ({len(dataset.examples)} examples)")
    print(f"Experiment URL: {_experiment_url(base_url, experiment)}")
    if counts:
        print("Evaluator results:")
        for name, result in sorted(counts.items()):
            print(f"  {name}: {result['pass']} passed, {result['fail']} failed")
    if failures:
        print("Failures:")
        for example_id, name, explanation, output in failures:
            print(f"  {example_id} / {name}: {explanation or 'failed'}")
            if isinstance(output, dict):
                print(f"    observed tool calls: {output.get('tool_calls', [])}")
    return bool(failures)


def run(config: RunnerConfig) -> int:
    _check_local_healthz(config.base_url, os.getenv("PXI_E2E_EXPERIMENT_BASE_URL") is not None)
    dataset = load_dataset(config.dataset)
    client = Client(base_url=config.base_url, api_key=config.bearer_token)
    phoenix_dataset = client.datasets.create_dataset(
        name=dataset.dataset_name,
        examples=to_phoenix_examples(dataset),
        dataset_description=dataset.description,
    )
    name = _experiment_name(dataset, config)
    metadata = {
        "git_sha": _git_value("rev-parse", "HEAD"),
        "git_branch": _git_value("rev-parse", "--abbrev-ref", "HEAD"),
        "assistant_provider": os.getenv("PXI_E2E_ASSISTANT_PROVIDER", DEFAULT_ASSISTANT_PROVIDER),
        "assistant_model": os.getenv("PXI_E2E_ASSISTANT_MODEL", DEFAULT_ASSISTANT_MODEL),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    print(f"Running experiment: {name}")
    experiment = client.experiments.run_experiment(
        dataset=phoenix_dataset,
        task=build_task(),
        experiment_name=name,
        experiment_description=dataset.description,
        experiment_metadata=metadata,
        print_summary=False,
        timeout=180,
        retries=0,
    )
    for task_run in experiment["task_runs"]:
        output = task_run.get("output")
        if isinstance(output, dict) and isinstance(output.get("stable_example_id"), str):
            task_run["dataset_example_id"] = output["stable_example_id"]
    experiment = client.experiments.evaluate_experiment(
        experiment=experiment,
        evaluators=[strict_tools_called, set_spans_filter_args_match],
        print_summary=False,
        timeout=180,
        retries=0,
    )
    has_failures = _print_report(dataset, experiment, config.base_url)
    return 1 if has_failures and config.fail_on_regression else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run PXI server-side evals as Phoenix experiments.")
    parser.add_argument("--dataset", required=True, help="Dataset name from tests/pxi/evals/datasets")
    parser.add_argument("--experiment-name", help="Full experiment name override")
    parser.add_argument("--experiment-name-suffix", help="Suffix appended to the generated name")
    parser.add_argument("--fail-on-regression", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    base_url, _ = _configured_base_url()
    config = RunnerConfig(
        dataset=args.dataset,
        base_url=base_url,
        bearer_token=os.getenv("PXI_E2E_EXPERIMENT_BEARER_TOKEN"),
        experiment_name=args.experiment_name,
        experiment_name_suffix=args.experiment_name_suffix,
        fail_on_regression=args.fail_on_regression,
    )
    try:
        return run(config)
    except InfrastructureError as exc:
        print(f"Infrastructure error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
