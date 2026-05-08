from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import urllib.error
import urllib.request
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, cast
from urllib.parse import urljoin

from phoenix.client import AsyncClient

from tests.pxi.evals.agent_task import (
    DEFAULT_ASSISTANT_MODEL,
    DEFAULT_ASSISTANT_PROVIDER,
    build_shared_docs_mcp_toolset,
    make_task,
)
from tests.pxi.evals.datasets import load_dataset, to_phoenix_examples
from tests.pxi.evals.evaluators import correct_tools_called, tool_call_args_match
from tests.pxi.evals.types import EvalDataset

DEFAULT_BASE_URL = "http://localhost:6006"


@dataclass(frozen=True)
class ExperimentConfig:
    """Resolved configuration for a single PXI eval experiment run."""

    dataset: str
    base_url: str
    bearer_token: str | None
    experiment_name: str | None
    experiment_name_suffix: str | None
    fail_on_regression: bool


def _configured_base_url() -> tuple[str, bool]:
    value = os.getenv("PXI_E2E_EXPERIMENT_BASE_URL")
    return (value or DEFAULT_BASE_URL).rstrip("/"), value is not None


def _check_phoenix_healthz(base_url: str) -> None:
    """Verify the configured Phoenix is reachable before uploading anything.

    Runs against whichever ``base_url`` is configured (default or via
    ``PXI_E2E_EXPERIMENT_BASE_URL``) so misconfigured ports and unreachable
    remote endpoints surface as a clear error rather than a deep client
    traceback.
    """
    try:
        with urllib.request.urlopen(urljoin(base_url + "/", "healthz"), timeout=2) as response:
            if response.status >= 400:
                raise RuntimeError(
                    f"Phoenix health check failed with HTTP {response.status}: {base_url}"
                )
    except (OSError, urllib.error.URLError) as exc:
        raise RuntimeError(
            f"Phoenix is unavailable at {base_url}. "
            "Start Phoenix or fix PXI_E2E_EXPERIMENT_BASE_URL."
        ) from exc


def _git_value(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _experiment_name(dataset: EvalDataset, config: ExperimentConfig) -> str:
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
        return cast(str, output["stable_example_id"])
    return _run_dataset_example_id(run)


def _evaluation_run_id(evaluation_run: Any) -> str:
    if isinstance(evaluation_run, dict):
        return str(evaluation_run.get("experiment_run_id") or "")
    return str(getattr(evaluation_run, "experiment_run_id", ""))


def _evaluation_name(evaluation_run: Any) -> str:
    if isinstance(evaluation_run, dict):
        return str(evaluation_run.get("name") or "unknown")
    return cast(str, getattr(evaluation_run, "name", None) or "unknown")


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
        task_runs = list(
            getattr(experiment, "task_runs", []) or getattr(experiment, "runs", []) or []
        )
        evaluation_runs = list(getattr(experiment, "evaluation_runs", []) or [])
    task_outputs_by_run_id = {_run_id(run): _run_output(run) for run in task_runs}
    stable_example_ids_by_run_id = {
        run_id: _run_stable_example_id(run) for run in task_runs if (run_id := _run_id(run))
    }
    counts: dict[str, dict[str, int]] = {}
    failures: list[tuple[str, str, str | None, Any]] = []
    for evaluation_run in evaluation_runs:
        name = _evaluation_name(evaluation_run)
        result = _evaluation_result(evaluation_run)
        error = _evaluation_error(evaluation_run)
        counts.setdefault(name, {"pass": 0, "fail": 0})
        if isinstance(result, dict):
            score = result.get("score")
            explanation = result.get("explanation")
        else:
            score = getattr(result, "score", None)
            explanation = getattr(result, "explanation", None)
        passed = error is None and (float(score) if isinstance(score, (int, float)) else 0.0) >= 1.0
        counts[name]["pass" if passed else "fail"] += 1
        if not passed:
            experiment_run_id = _evaluation_run_id(evaluation_run)
            failures.append(
                (
                    _failure_example_id(experiment_run_id, stable_example_ids_by_run_id),
                    name,
                    str(error) if error else explanation if isinstance(explanation, str) else None,
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


async def _run_async(config: ExperimentConfig) -> int:
    _check_phoenix_healthz(config.base_url)
    dataset = load_dataset(config.dataset)
    client = AsyncClient(base_url=config.base_url, api_key=config.bearer_token)
    # Build the docs MCP toolset once and enter its async context manager
    # for the duration of the run, mirroring the production server's
    # FastAPI lifespan wiring (``phoenix.server.app:697-698``). Sharing a
    # single live toolset is what keeps anyio's cancel scopes from
    # crossing task boundaries when concurrent tasks fan out.
    docs_mcp_toolset = build_shared_docs_mcp_toolset()
    async with AsyncExitStack() as stack:
        if docs_mcp_toolset is not None:
            await stack.enter_async_context(docs_mcp_toolset)
        try:
            phoenix_dataset = await client.datasets.create_dataset(
                name=dataset.dataset_name,
                examples=to_phoenix_examples(dataset),
                dataset_description=dataset.description,
            )
            name = _experiment_name(dataset, config)
            metadata = {
                "git_sha": _git_value("rev-parse", "HEAD"),
                "git_branch": _git_value("rev-parse", "--abbrev-ref", "HEAD"),
                "assistant_provider": os.getenv(
                    "PXI_E2E_ASSISTANT_PROVIDER", DEFAULT_ASSISTANT_PROVIDER
                ),
                "assistant_model": os.getenv("PXI_E2E_ASSISTANT_MODEL", DEFAULT_ASSISTANT_MODEL),
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            print(f"Running experiment: {name}")
            # ``run_experiment`` is invoked WITHOUT evaluators because its
            # internal evaluator loop looks up examples by
            # ``run["dataset_example_id"]`` (the relay-encoded ``node_id``)
            # against an ``examples_by_id`` map keyed by ``example["id"]``
            # (the YAML stable id we uploaded). The two never match, so
            # the in-band evaluator phase silently produces zero
            # evaluation runs. We rewrite ``dataset_example_id`` after
            # task runs return, then call ``evaluate_experiment``
            # explicitly so the lookup succeeds.
            experiment = await client.experiments.run_experiment(
                dataset=phoenix_dataset,
                task=make_task(docs_mcp_toolset=docs_mcp_toolset),
                experiment_name=name,
                experiment_description=dataset.description,
                experiment_metadata=metadata,
                print_summary=False,
                concurrency=3,
                timeout=180,
                retries=0,
            )
            for task_run in experiment["task_runs"]:
                output = task_run.get("output")
                if isinstance(output, dict) and isinstance(output.get("stable_example_id"), str):
                    task_run["dataset_example_id"] = output["stable_example_id"]
            experiment = await client.experiments.evaluate_experiment(
                experiment=experiment,
                evaluators=cast(Any, [correct_tools_called, tool_call_args_match]),
                print_summary=False,
                concurrency=3,
                timeout=180,
                retries=0,
            )
        finally:
            # ``AsyncClient`` does not yet expose a public ``aclose``; reach for
            # the underlying httpx client and tolerate it disappearing in a
            # future refactor so cleanup never shadows a real failure.
            underlying = getattr(client, "_client", None)
            aclose = getattr(underlying, "aclose", None)
            if callable(aclose):
                try:
                    await aclose()
                except Exception as cleanup_exc:  # pragma: no cover - best-effort cleanup
                    print(
                        f"warning: AsyncClient cleanup failed: {cleanup_exc}",
                        file=sys.stderr,
                    )
    has_failures = _print_report(dataset, experiment, config.base_url)
    return 1 if has_failures and config.fail_on_regression else 0


def run(config: ExperimentConfig) -> int:
    """Synchronous entrypoint that drives the async experiment run."""
    return asyncio.run(_run_async(config))


def build_parser() -> argparse.ArgumentParser:
    """Construct the CLI argument parser for the eval runner."""
    parser = argparse.ArgumentParser(
        description="Run PXI server-side evals as Phoenix experiments."
    )
    parser.add_argument(
        "--dataset",
        required=True,
        help="YAML file stem under tests/pxi/evals/datasets (e.g. set_spans_filter)",
    )
    parser.add_argument(
        "--experiment-name",
        help="Override the auto-generated experiment name (default: pxi-eval-<dataset>-<branch>)",
    )
    parser.add_argument(
        "--experiment-name-suffix",
        help="Suffix appended to the auto-generated experiment name (e.g. a run tag)",
    )
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="Exit non-zero if any evaluator fails (use in CI gating)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint for ``run_experiment.py`` and ``python -m`` invocations."""
    args = build_parser().parse_args(argv)
    base_url, _ = _configured_base_url()
    config = ExperimentConfig(
        dataset=args.dataset,
        base_url=base_url,
        bearer_token=os.getenv("PXI_E2E_EXPERIMENT_BEARER_TOKEN"),
        experiment_name=args.experiment_name,
        experiment_name_suffix=args.experiment_name_suffix,
        fail_on_regression=args.fail_on_regression,
    )
    try:
        return run(config)
    except RuntimeError as exc:
        print(f"Infrastructure error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
