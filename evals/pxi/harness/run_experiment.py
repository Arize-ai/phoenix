from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from contextlib import AsyncExitStack
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence, cast

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from urllib.parse import urljoin

from phoenix.client import AsyncClient
from phoenix.client.resources.experiments.types import RanExperiment
from phoenix.client.utils.config import get_base_url, get_env_phoenix_api_key

from evals.pxi.evaluators import EVALUATORS_BY_NAME
from evals.pxi.harness.agent_task import (
    DEFAULT_ASSISTANT_MODEL,
    DEFAULT_ASSISTANT_PROVIDER,
    ENV_ASSISTANT_MODEL,
    ENV_ASSISTANT_PROVIDER,
    build_shared_docs_mcp_server,
    make_task,
)
from evals.pxi.harness.datasets import (
    EvalDataset,
    load_dataset,
)
from evals.pxi.harness.reporting import (
    _print_score_summary,
    build_report,
    report_to_markdown,
    write_reports,
)
from phoenix.server.agents.capabilities import ENV_CONTEXT_POLICY, parse_context_policy

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
    splits: tuple[str, ...]
    evaluator_override: tuple[str, ...] | None
    report_dir: Path | None = None
    print_report: bool = False
    context_policy: str | None = None
    concurrency: int = 3
    repetitions: int = 1


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


_HEALTHZ_RETRIES = 3
_HEALTHZ_RETRY_DELAY = 10  # seconds between attempts


def _check_phoenix_healthz(base_url: str) -> None:
    """Verify the configured Phoenix is reachable before uploading anything.

    Retries up to ``_HEALTHZ_RETRIES`` times with a fixed delay so transient
    blips (e.g. a 30-second Phoenix Cloud hiccup) don't permanently fail a
    dataset run. Each attempt uses a short per-request timeout; the total wait
    is at most ``_HEALTHZ_RETRIES * _HEALTHZ_RETRY_DELAY`` seconds.
    """
    last_exc: Exception | None = None
    for attempt in range(1, _HEALTHZ_RETRIES + 1):
        try:
            with urllib.request.urlopen(urljoin(base_url + "/", "healthz"), timeout=5) as response:
                if response.status >= 400:
                    raise RuntimeError(
                        f"Phoenix health check failed with HTTP {response.status}: {base_url}"
                    )
                return  # success
        except (OSError, urllib.error.URLError) as exc:
            last_exc = exc
            if attempt < _HEALTHZ_RETRIES:
                print(
                    f"Phoenix not reachable at {base_url} "
                    f"(attempt {attempt}/{_HEALTHZ_RETRIES}), "
                    f"retrying in {_HEALTHZ_RETRY_DELAY}s...",
                    file=sys.stderr,
                )
                time.sleep(_HEALTHZ_RETRY_DELAY)
    raise RuntimeError(
        f"Phoenix is unavailable at {base_url} after {_HEALTHZ_RETRIES} attempts. "
        "Start Phoenix or fix PHOENIX_COLLECTOR_ENDPOINT."
    ) from last_exc


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


def _empty_experiment(phoenix_dataset: Any) -> RanExperiment:
    return {
        "experiment_id": "",
        "dataset_id": str(getattr(phoenix_dataset, "id", "")),
        "dataset_version_id": str(getattr(phoenix_dataset, "version_id", "")),
        "task_runs": [],
        "evaluation_runs": [],
        "experiment_metadata": {},
        "project_name": None,
    }


def _phoenix_examples(dataset: EvalDataset) -> list[dict[str, Any]]:
    return [
        {
            "id": example["id"],
            "input": example["input"],
            "output": example["expected"],
            "metadata": example.get("metadata") or {},
            "splits": list(example["splits"]),
        }
        for example in dataset.examples
    ]


def _warn_if_split_smoke_check_fails(phoenix_dataset: Any, expected_splits: set[str]) -> None:
    observed = set(getattr(phoenix_dataset, "_filtered_split_names", []))
    if observed != expected_splits:
        print(
            "warning: dataset split smoke check mismatch: "
            f"expected {sorted(expected_splits)}, observed {sorted(observed)}",
            file=sys.stderr,
        )


async def _get_split_filtered_dataset(
    client: AsyncClient, phoenix_dataset: Any, splits: Sequence[str]
) -> Any:
    return await client.datasets.get_dataset(
        dataset=phoenix_dataset,
        splits=list(splits),
    )


def _check_evaluations_ran(experiment: RanExperiment) -> None:
    """Fail loudly when examples ran but zero evaluations executed.

    The client pairs evaluators with examples via the example node GlobalID
    and silently skips runs whose lookup misses. If that pairing ever breaks
    again (it did once: rewriting example ids before evaluation), every
    example would count as vacuously passed -- a false green this guard turns
    into an infrastructure error instead.
    """
    if experiment.get("task_runs") and not experiment.get("evaluation_runs"):
        raise RuntimeError(
            "experiment ran "
            f"{len(experiment['task_runs'])} task(s) but zero evaluations executed; "
            "evaluator/example pairing is broken (refusing to report a vacuous pass)"
        )


def _rewrite_stable_example_ids(experiment: RanExperiment, experiment_dataset: Any) -> None:
    """Replace Phoenix's relay dataset example GlobalIDs with stable YAML ids.

    Resolves via the uploaded dataset's GlobalID->stable-id mapping first --
    which also covers task runs whose ``output`` is ``None`` (e.g. the
    phoenix-client's own timeout fired before the task could return its error
    payload) -- falling back to ``output.stable_example_id``.
    """
    stable_by_global_id: dict[str, str] = {}
    for example in getattr(experiment_dataset, "examples", None) or []:
        if not isinstance(example, dict):
            continue
        stable_id = example.get("id")
        global_id = example.get("node_id") or stable_id
        if isinstance(stable_id, str) and isinstance(global_id, str):
            stable_by_global_id[global_id] = stable_id
    for task_run in experiment["task_runs"]:
        mapped = stable_by_global_id.get(str(task_run.get("dataset_example_id", "")))
        output = task_run.get("output")
        from_output = output.get("stable_example_id") if isinstance(output, dict) else None
        stable = mapped or (from_output if isinstance(from_output, str) else None)
        if stable:
            task_run["dataset_example_id"] = stable


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
    docs_mcp_server = build_shared_docs_mcp_server()
    async with AsyncExitStack() as stack:
        if docs_mcp_server is not None:
            await stack.enter_async_context(docs_mcp_server)
        try:
            phoenix_dataset = await client.datasets.create_dataset(
                name=dataset.dataset_name,
                examples=_phoenix_examples(dataset),
                dataset_description=dataset.description,
            )
            uploaded_splits = {
                str(split) for example in dataset.examples for split in example["splits"]
            }
            _warn_if_split_smoke_check_fails(
                await client.datasets.get_dataset(
                    dataset=phoenix_dataset,
                    splits=sorted(uploaded_splits),
                ),
                uploaded_splits,
            )
            # Phoenix's ``get_dataset(splits=[...])`` returns 404 for any split
            # name that has no examples on this dataset, which crashes the run.
            # Pre-filter the requested splits to ones actually present on the
            # uploaded dataset so empty splits are skipped, not fatal.
            requested = tuple(split for split in config.splits if split in uploaded_splits)
            missing = [split for split in config.splits if split not in uploaded_splits]
            if missing:
                print(
                    f"Skipping splits with no examples on dataset "
                    f"{dataset.dataset_name}: {', '.join(missing)}",
                    file=sys.stderr,
                )
            if not requested:
                print(f"No examples matched requested splits: {', '.join(config.splits)}")
                experiment = _empty_experiment(phoenix_dataset)
                return 0
            experiment_dataset = await _get_split_filtered_dataset(
                client,
                phoenix_dataset,
                requested,
            )
            if not experiment_dataset.examples:
                print(f"No examples matched requested splits: {', '.join(requested)}")
                experiment = _empty_experiment(experiment_dataset)
                return 0
            name = _experiment_name(dataset, config)
            context_policy = config.context_policy or os.getenv(ENV_CONTEXT_POLICY) or "full"
            metadata = {
                "git_sha": _git_value("rev-parse", "HEAD"),
                # In CI, git is in a detached HEAD state so git rev-parse returns
                # "HEAD". Prefer GITHUB_HEAD_REF (the PR branch name) when set.
                "git_branch": os.getenv("GITHUB_HEAD_REF")
                or _git_value("rev-parse", "--abbrev-ref", "HEAD"),
                "assistant_provider": os.getenv(ENV_ASSISTANT_PROVIDER, DEFAULT_ASSISTANT_PROVIDER),
                "assistant_model": os.getenv(ENV_ASSISTANT_MODEL, DEFAULT_ASSISTANT_MODEL),
                "context_policy": context_policy,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            print(f"Running experiment: {name}")
            experiment = await client.experiments.run_experiment(
                dataset=experiment_dataset,
                task=make_task(docs_mcp_server=docs_mcp_server),
                experiment_name=name,
                experiment_description=dataset.description,
                experiment_metadata=metadata,
                print_summary=True,
                concurrency=config.concurrency,
                repetitions=config.repetitions,
                timeout=180,
                retries=0,
            )
            experiment = await client.experiments.evaluate_experiment(
                experiment=experiment,
                evaluators=cast(Any, evaluators),
                print_summary=True,
                concurrency=config.concurrency,
                timeout=180,
                retries=0,
            )
            _check_evaluations_ran(experiment)
            # Replace Phoenix's relay dataset example ID with the stable YAML
            # example ID for summary/report rendering. This MUST happen after
            # ``evaluate_experiment``: the client pairs evaluators with
            # examples via the example node GlobalID, so rewriting first makes
            # every lookup miss and silently skips all evaluations (the
            # false-green failure mode this ordering previously caused).
            _rewrite_stable_example_ids(experiment, experiment_dataset)
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
    has_regressions = _print_score_summary(dataset, experiment, base_url=config.base_url)
    if config.report_dir is not None or config.print_report:
        report = build_report(
            dataset,
            experiment,
            base_url=config.base_url,
            splits=requested,
            experiment_name=name,
            dataset_arg=config.dataset,
        )
        md_path = None
        if config.report_dir is not None:
            json_path, md_path = write_reports(report, config.report_dir)
            if report.failures:
                print(f"Report (JSON): {json_path}")
                print(f"Report (MD):   {md_path}")
        if config.print_report and report.failures:
            # Reuse the already-rendered file instead of rendering twice.
            print(md_path.read_text() if md_path is not None else report_to_markdown(report))
    return 1 if has_regressions and config.fail_on_regression else 0


def run(config: ExperimentConfig) -> int:
    """Synchronous entrypoint that drives the async experiment run."""
    previous_policy = os.environ.get(ENV_CONTEXT_POLICY)
    if config.context_policy is not None:
        os.environ[ENV_CONTEXT_POLICY] = config.context_policy
    try:
        return asyncio.run(_run_async(config))
    finally:
        if config.context_policy is not None:
            if previous_policy is None:
                os.environ.pop(ENV_CONTEXT_POLICY, None)
            else:
                os.environ[ENV_CONTEXT_POLICY] = previous_policy


def build_parser() -> argparse.ArgumentParser:
    """Construct the CLI argument parser for the eval runner."""
    parser = argparse.ArgumentParser(
        description="Run PXI server-side evals as Phoenix experiments."
    )
    parser.add_argument(
        "--dataset",
        required=True,
        help="YAML file stem under evals/pxi/datasets (e.g. set_spans_filter)",
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
        help="Exit non-zero if any regression-split evaluator fails (use in CI gating)",
    )
    parser.add_argument(
        "--splits",
        nargs="+",
        default=["regression"],
        help="Dataset split names to run (default: regression)",
    )
    parser.add_argument(
        "--report-dir",
        type=Path,
        help=(
            "Directory to write failure reports to (created if missing). "
            "Writes <dataset>.report.json (machine-readable, full fidelity) "
            "and <dataset>.report.md (agent-pasteable Markdown)."
        ),
    )
    parser.add_argument(
        "--print-report",
        action="store_true",
        help=(
            "Print the full Markdown failure report to stdout after the "
            "summary (no-op when all examples pass). For local/manual runs; "
            "CI embeds the written report file instead."
        ),
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
    parser.add_argument(
        "--policy",
        dest="context_policy",
        help=(
            "Context policy for this run. Use full/p0, p1, p1c, p6, or an explicit "
            "policy string such as clear_tool_uses:k=5,threshold=30000."
        ),
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=3,
        help="Number of concurrent task/evaluator runs (default: 3). Use 1 for cache smoke runs.",
    )
    parser.add_argument(
        "--repetitions",
        type=int,
        default=1,
        help="Number of repeated task runs per example (default: 1).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint for ``run_experiment.py`` and ``python -m`` invocations."""
    args = build_parser().parse_args(argv)
    if args.context_policy is not None:
        try:
            parse_context_policy(args.context_policy)
        except ValueError as exc:
            print(f"Invalid context policy: {exc}", file=sys.stderr)
            return 2
    if args.concurrency < 1:
        print("Invalid concurrency: must be >= 1", file=sys.stderr)
        return 2
    if args.repetitions < 1:
        print("Invalid repetitions: must be >= 1", file=sys.stderr)
        return 2
    base_url, _ = _configured_base_url()
    config = ExperimentConfig(
        dataset=args.dataset,
        base_url=base_url,
        bearer_token=get_env_phoenix_api_key(),
        experiment_name=args.experiment_name,
        experiment_name_suffix=args.experiment_name_suffix,
        fail_on_regression=args.fail_on_regression,
        splits=tuple(args.splits),
        evaluator_override=tuple(args.evaluators) if args.evaluators else None,
        report_dir=args.report_dir,
        print_report=args.print_report,
        context_policy=args.context_policy,
        concurrency=args.concurrency,
        repetitions=args.repetitions,
    )
    try:
        return run(config)
    except RuntimeError as exc:
        print(f"Infrastructure error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
