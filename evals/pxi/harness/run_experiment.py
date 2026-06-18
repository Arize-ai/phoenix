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
from phoenix.client.resources.datasets import Dataset as PhoenixDataset
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
from evals.pxi.harness.gating import (
    RETRY_FAILED_CAP,
    attempt_outcomes,
    decide_gate,
    task_run_error,
)
from evals.pxi.harness.reporting import (
    _print_score_summary,
    build_report,
    report_to_markdown,
    write_reports,
)

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
    retry_failed: bool = False
    retry_failed_cap: int = RETRY_FAILED_CAP


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
    task_runs = list(experiment.get("task_runs") or [])
    if (
        task_runs
        and not experiment.get("evaluation_runs")
        and any(task_run_error(task_run) is None for task_run in task_runs)
    ):
        raise RuntimeError(
            "experiment ran "
            f"{len(task_runs)} task(s) but zero evaluations executed; "
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
    async with AsyncExitStack() as stack:
        docs_mcp_server = await _enter_docs_mcp_server_with_retry(stack)
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
            metadata = {
                "git_sha": _git_value("rev-parse", "HEAD"),
                # In CI, git is in a detached HEAD state so git rev-parse returns
                # "HEAD". Prefer GITHUB_HEAD_REF (the PR branch name) when set.
                "git_branch": os.getenv("GITHUB_HEAD_REF")
                or _git_value("rev-parse", "--abbrev-ref", "HEAD"),
                "assistant_provider": os.getenv(ENV_ASSISTANT_PROVIDER, DEFAULT_ASSISTANT_PROVIDER),
                "assistant_model": os.getenv(ENV_ASSISTANT_MODEL, DEFAULT_ASSISTANT_MODEL),
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            description = dataset.description or ""
            experiment = await _run_and_evaluate_experiment(
                client,
                experiment_dataset=experiment_dataset,
                docs_mcp_server=docs_mcp_server,
                evaluators=evaluators,
                name=name,
                description=description,
                metadata=metadata,
            )
            first_attempts = attempt_outcomes(dataset, experiment, attempt=1)
            gate_decision = decide_gate(
                first_attempts,
                retry_enabled=config.retry_failed,
                retry_cap=config.retry_failed_cap,
            )
            retry_experiment: RanExperiment | None = None
            if gate_decision.retry_ids:
                retry_name = f"{name}-retry"
                retry_dataset = _filter_dataset_examples(
                    experiment_dataset,
                    gate_decision.retry_ids,
                )
                print(
                    f"Retrying failed PXI eval examples once: {', '.join(gate_decision.retry_ids)}"
                )
                retry_experiment = await _run_and_evaluate_experiment(
                    client,
                    experiment_dataset=retry_dataset,
                    docs_mcp_server=docs_mcp_server,
                    evaluators=evaluators,
                    name=retry_name,
                    description=f"{description}\n\nRetry of failed examples from {name}".strip(),
                    metadata={**metadata, "retry_of_experiment": name},
                )
                retry_attempts = attempt_outcomes(dataset, retry_experiment, attempt=2)
                gate_decision = decide_gate(
                    first_attempts,
                    retry_attempts=retry_attempts,
                    retry_enabled=config.retry_failed,
                    retry_cap=config.retry_failed_cap,
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
    has_regressions = _print_score_summary(dataset, experiment, base_url=config.base_url)
    if gate_decision.flaky_ids:
        print(f"::notice::PXI eval flaky-passed examples: {', '.join(gate_decision.flaky_ids)}")
    if gate_decision.retry_skipped_reason:
        print(f"warning: {gate_decision.retry_skipped_reason}", file=sys.stderr)
    if gate_decision.infra_ids:
        print(f"PXI eval infra examples: {', '.join(gate_decision.infra_ids)}", file=sys.stderr)
    if config.report_dir is not None or config.print_report:
        report = build_report(
            dataset,
            experiment,
            base_url=config.base_url,
            splits=requested,
            experiment_name=name,
            dataset_arg=config.dataset,
            retry_experiment=retry_experiment,
            gate_decision=gate_decision,
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
    if gate_decision.status == "infra":
        return 2
    if config.fail_on_regression and gate_decision.has_confirmed_regressions:
        return 1
    if config.fail_on_regression and not config.retry_failed and has_regressions:
        return 1
    return 0


async def _enter_docs_mcp_server_with_retry(stack: AsyncExitStack) -> Any:
    for attempt in range(1, 3):
        docs_mcp_server = build_shared_docs_mcp_server()
        if docs_mcp_server is None:
            return None
        try:
            return await stack.enter_async_context(docs_mcp_server)
        except Exception as exc:
            if attempt == 2:
                raise RuntimeError("docs MCP server failed to start after 2 attempts") from exc
            print(
                f"Docs MCP server failed to start (attempt {attempt}/2), retrying in 3s: {exc}",
                file=sys.stderr,
            )
            await asyncio.sleep(3)
    return None


async def _run_and_evaluate_experiment(
    client: AsyncClient,
    *,
    experiment_dataset: Any,
    docs_mcp_server: Any,
    evaluators: list[Any],
    name: str,
    description: str,
    metadata: dict[str, Any],
) -> RanExperiment:
    print(f"Running experiment: {name}")
    experiment = await client.experiments.run_experiment(
        dataset=experiment_dataset,
        task=make_task(docs_mcp_server=docs_mcp_server),
        experiment_name=name,
        experiment_description=description,
        experiment_metadata=metadata,
        print_summary=True,
        concurrency=3,
        timeout=180,
        retries=0,
    )
    experiment = await client.experiments.evaluate_experiment(
        experiment=experiment,
        evaluators=cast(Any, evaluators),
        print_summary=True,
        concurrency=3,
        timeout=180,
        retries=0,
    )
    _check_evaluations_ran(experiment)
    # Replace Phoenix's relay dataset example ID with the stable YAML
    # example ID for summary/report rendering. This MUST happen after
    # ``evaluate_experiment``: the client pairs evaluators with examples via
    # the example node GlobalID, so rewriting first makes every lookup miss.
    _rewrite_stable_example_ids(experiment, experiment_dataset)
    return experiment


def _filter_dataset_examples(experiment_dataset: Any, example_ids: Sequence[str]) -> Any:
    selected_ids = {str(example_id) for example_id in example_ids}
    if not selected_ids:
        raise ValueError("cannot retry an empty example set")
    if not hasattr(experiment_dataset, "to_dict"):
        raise TypeError("experiment dataset does not support to_dict()")
    data = experiment_dataset.to_dict()
    examples = [
        example for example in data.get("examples", []) if str(example.get("id")) in selected_ids
    ]
    if not examples:
        raise ValueError(f"retry examples not found in dataset: {', '.join(sorted(selected_ids))}")
    data["examples"] = examples
    return PhoenixDataset.from_dict(data)


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
    retry_group = parser.add_mutually_exclusive_group()
    retry_group.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry failed regression examples once before deciding the gate.",
    )
    retry_group.add_argument(
        "--no-retry-failed",
        action="store_true",
        help="Disable failed-example retry for fast local iteration.",
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
        splits=tuple(args.splits),
        evaluator_override=tuple(args.evaluators) if args.evaluators else None,
        report_dir=args.report_dir,
        print_report=args.print_report,
        retry_failed=args.retry_failed and not args.no_retry_failed,
    )
    try:
        return run(config)
    except RuntimeError as exc:
        print(f"Infrastructure error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
