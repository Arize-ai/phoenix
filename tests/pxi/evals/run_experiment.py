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
from pathlib import Path
from typing import Any, cast
from urllib.parse import urljoin

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from phoenix.client import AsyncClient
from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment
from phoenix.client.utils.config import get_base_url, get_env_phoenix_api_key

from tests.pxi.evals.agent_task import (
    DEFAULT_ASSISTANT_MODEL,
    DEFAULT_ASSISTANT_PROVIDER,
    ENV_ASSISTANT_MODEL,
    ENV_ASSISTANT_PROVIDER,
    build_shared_docs_mcp_toolset,
    make_task,
)
from tests.pxi.evals.datasets import (  # type: ignore[attr-defined, unused-ignore]
    EvalDataset,
    load_dataset,
)
from tests.pxi.evals.evaluators import EVALUATORS_BY_NAME

DEFAULT_BASE_URL = "http://localhost:6006"
PASSING_SCORE = 1.0


@dataclass(frozen=True)
class ExperimentConfig:
    """Resolved configuration for a single PXI eval experiment run."""

    dataset: str
    base_url: str
    bearer_token: str | None
    experiment_name: str | None
    experiment_name_suffix: str | None
    fail_on_regression: bool
    evaluator_override: tuple[str, ...] | None


def _resolve_evaluators(dataset: EvalDataset, override: tuple[str, ...] | None) -> list[Any]:
    """Resolve evaluator names (from CLI override or dataset YAML) to
    concrete ``@create_evaluator`` objects, failing fast on unknown names.
    """
    requested = list(override) if override else list(dataset.evaluators)
    if not requested:
        raise ValueError(
            "no evaluators selected: pass --evaluator or set `evaluators:` in the dataset YAML"
        )
    unknown = [name for name in requested if name not in EVALUATORS_BY_NAME]
    if unknown:
        available = ", ".join(sorted(EVALUATORS_BY_NAME))
        raise ValueError(f"unknown evaluator name(s): {', '.join(unknown)}. Available: {available}")
    return [EVALUATORS_BY_NAME[name] for name in requested]


def _configured_base_url() -> tuple[str, bool]:
    value = str(get_base_url())
    return value.rstrip("/"), value.rstrip("/") != DEFAULT_BASE_URL


def _check_phoenix_healthz(base_url: str) -> None:
    """Verify the configured Phoenix is reachable before uploading anything."""
    try:
        with urllib.request.urlopen(urljoin(base_url + "/", "healthz"), timeout=2) as response:
            if response.status >= 400:
                raise RuntimeError(
                    f"Phoenix health check failed with HTTP {response.status}: {base_url}"
                )
    except (OSError, urllib.error.URLError) as exc:
        raise RuntimeError(
            f"Phoenix is unavailable at {base_url}. "
            "Start Phoenix or fix PHOENIX_COLLECTOR_ENDPOINT."
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


def _experiment_url(base_url: str, experiment: RanExperiment) -> str:
    experiment_id = experiment.get("experiment_id")
    return f"{base_url.rstrip('/')}/experiments/{experiment_id}" if experiment_id else base_url


def _score(evaluation_run: ExperimentEvaluationRun) -> float | None:
    result = evaluation_run.result
    if not isinstance(result, dict):
        return None
    value = result.get("score")
    return float(value) if isinstance(value, (int, float)) else None


def _print_score_summary(dataset: EvalDataset, experiment: RanExperiment, base_url: str) -> bool:
    evaluation_runs = list(experiment.get("evaluation_runs") or [])
    by_evaluator: dict[str, dict[str, Any]] = {}
    has_regressions = False

    for evaluation_run in evaluation_runs:
        name = str(evaluation_run.name or "unknown")
        summary = by_evaluator.setdefault(
            name,
            {"total": 0, "passing": 0, "failing": 0, "missing_score": 0, "errors": 0},
        )
        summary["total"] += 1
        score = _score(evaluation_run)
        if evaluation_run.error is not None:
            summary["errors"] += 1
            summary["failing"] += 1
            has_regressions = True
        elif score is None:
            summary["missing_score"] += 1
            summary["failing"] += 1
            has_regressions = True
        elif score >= PASSING_SCORE:
            summary["passing"] += 1
        else:
            summary["failing"] += 1
            has_regressions = True

    print(f"Dataset: {dataset.dataset_name} ({len(dataset.examples)} examples)")
    print(f"Experiment URL: {_experiment_url(base_url, experiment)}")
    if by_evaluator:
        print(f"Evaluator score summary (passing score >= {PASSING_SCORE:g}):")
        for name, summary in sorted(by_evaluator.items()):
            detail = f"{summary['passing']}/{summary['total']} passed, {summary['failing']} failed"
            if summary["errors"]:
                detail += f", {summary['errors']} errors"
            if summary["missing_score"]:
                detail += f", {summary['missing_score']} missing scores"
            print(f"  {name}: {detail}")
    return has_regressions


def _phoenix_examples(dataset: EvalDataset) -> list[dict[str, Any]]:
    return [
        {
            "id": example["id"],
            "input": example["input"],
            "output": example["expected"],
            "metadata": example.get("metadata") or {},
        }
        for example in dataset.examples
    ]


async def _run_async(config: ExperimentConfig) -> int:
    _check_phoenix_healthz(config.base_url)
    dataset = load_dataset(config.dataset)
    evaluators = _resolve_evaluators(dataset, config.evaluator_override)
    print(
        f"Evaluators: {', '.join(name for name in (config.evaluator_override or dataset.evaluators))}"
    )
    client = AsyncClient(base_url=config.base_url, api_key=config.bearer_token)
    # Build the docs MCP toolset once and enter its async context manager for
    # the duration of the run, mirroring the production server's FastAPI
    # lifespan wiring.
    docs_mcp_toolset = build_shared_docs_mcp_toolset()
    async with AsyncExitStack() as stack:
        if docs_mcp_toolset is not None:
            await stack.enter_async_context(docs_mcp_toolset)
        try:
            phoenix_dataset = await client.datasets.create_dataset(
                name=dataset.dataset_name,
                examples=_phoenix_examples(dataset),
                dataset_description=dataset.description,
            )
            name = _experiment_name(dataset, config)
            metadata = {
                "git_sha": _git_value("rev-parse", "HEAD"),
                "git_branch": _git_value("rev-parse", "--abbrev-ref", "HEAD"),
                "assistant_provider": os.getenv(ENV_ASSISTANT_PROVIDER, DEFAULT_ASSISTANT_PROVIDER),
                "assistant_model": os.getenv(ENV_ASSISTANT_MODEL, DEFAULT_ASSISTANT_MODEL),
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            print(f"Running experiment: {name}")
            # Run task first, then evaluate explicitly after replacing Phoenix's
            # relay dataset example ID with the stable YAML example ID expected
            # by the client-side evaluator lookup.
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
                evaluators=cast(Any, evaluators),
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
    has_regressions = _print_score_summary(dataset, experiment, config.base_url)
    return 1 if has_regressions and config.fail_on_regression else 0


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
    # The dataset YAML's ``evaluators:`` field is the source of truth for
    # what gets scored in normal use. This flag is a transient per-run
    # override -- useful for iterating on a single evaluator (halves eval
    # cost while debugging), trying a new evaluator across existing
    # datasets without committing a YAML change, or skipping a slow or
    # noisy evaluator during a quick check. If you want a different
    # combination permanently, edit the dataset YAML instead.
    parser.add_argument(
        "--evaluator",
        action="append",
        dest="evaluators",
        metavar="NAME",
        help=(
            "Override the evaluators declared in the dataset YAML for this "
            "run only. Repeatable. Use for ad-hoc iteration; edit the YAML "
            f"for permanent changes. Valid names: {', '.join(sorted(EVALUATORS_BY_NAME))}."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint for ``run_experiment.py`` and ``python -m`` invocations."""
    args = build_parser().parse_args(argv)
    base_url, _ = _configured_base_url()
    config = ExperimentConfig(
        dataset=args.dataset,
        base_url=base_url,
        bearer_token=get_env_phoenix_api_key(),
        experiment_name=args.experiment_name,
        experiment_name_suffix=args.experiment_name_suffix,
        fail_on_regression=args.fail_on_regression,
        evaluator_override=tuple(args.evaluators) if args.evaluators else None,
    )
    try:
        return run(config)
    except RuntimeError as exc:
        print(f"Infrastructure error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
