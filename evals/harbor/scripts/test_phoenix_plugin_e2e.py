#!/usr/bin/env python3
"""Run the Phoenix Harbor plugin end-to-end test matrix."""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence, cast

from phoenix.client import Client
from phoenix.client.__generated__ import v1

REPO_ROOT = Path(__file__).resolve().parents[3]
TASKS_DIR = REPO_ROOT / "evals" / "harbor" / "tasks"
DIRECT_TASK = TASKS_DIR / "regression-triage"
MULTI_STEP_TASK = REPO_ROOT / "evals" / "harbor" / "plugin_e2e" / "word-count"
HARBOR_VERSION = os.environ.get("HARBOR_VERSION", "0.21.0")
HARBOR_PYTHON = os.environ.get("HARBOR_PYTHON", "3.13")
HARBOR_ATIF_MODEL = os.environ.get("HARBOR_ATIF_MODEL", "openai/gpt-5-mini")
HARBOR_ATIF_CLAUDE_MODEL = os.environ.get("HARBOR_ATIF_CLAUDE_MODEL", "anthropic/claude-sonnet-4-5")
HARBOR_ATIF_CASES = os.environ.get("HARBOR_E2E_ATIF_CASES", "terminus,compaction,multi-step")
HARBOR_ATIF_DATASET = "terminal-bench/terminal-bench-2-1@6"
HARBOR_ATIF_DATASET_NAME = "terminal-bench/terminal-bench-2-1"
HARBOR_ATIF_TASKS = (
    "terminal-bench/regex-log",
    "terminal-bench/cancel-async-tasks",
    "terminal-bench/fix-git",
)
HARBOR_ATIF_COMPACTION_TASK = "terminal-bench/fix-git"
HARBOR_ATIF_COMPACTION_SOURCE_PATHS = {
    "agent/trajectory.json",
    "agent/trajectory.cont-1.json",
    "agent/trajectory.summarization-1-answers.json",
    "agent/trajectory.summarization-1-questions.json",
    "agent/trajectory.summarization-1-summary.json",
}
HARBOR_ATIF_COMPACTION_AGENTS = {
    "invoke_agent terminus-2",
    "invoke_agent terminus-2 (continuation 1)",
    "invoke_agent terminus-2-summarization-answers",
    "invoke_agent terminus-2-summarization-questions",
    "invoke_agent terminus-2-summarization-summary",
}


def _check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _span_metadata(span: Mapping[str, Any]) -> dict[str, Any]:
    """Read metadata from nested or OpenInference-flattened attributes."""
    raw_attributes: object = span.get("attributes") or {}
    if not isinstance(raw_attributes, Mapping):
        return {}
    attributes = cast(Mapping[str, Any], raw_attributes)

    metadata: dict[str, Any] = {
        key.removeprefix("metadata."): value
        for key, value in attributes.items()
        if key.startswith("metadata.")
    }
    nested = attributes.get("metadata")
    if isinstance(nested, str):
        try:
            nested = json.loads(nested)
        except json.JSONDecodeError:
            nested = None
    if isinstance(nested, Mapping):
        metadata.update(cast(Mapping[str, Any], nested))
    return metadata


def _run(
    command: Sequence[str],
    *,
    description: str,
    expected_error: str | None = None,
) -> str:
    result = subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    output = result.stdout
    if expected_error is None:
        if result.returncode:
            raise RuntimeError(
                f"{description} failed with exit code {result.returncode}:\n{output}"
            )
    else:
        _check(result.returncode != 0, f"{description} unexpectedly succeeded")
        _check(
            expected_error in output,
            f"{description} did not report {expected_error!r}:\n{output}",
        )
    print(f"PASS  {description}")
    return output


def _write_json(path: Path, value: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")


def _free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def _wait_for_phoenix(endpoint: str, process: subprocess.Popen[str], log_path: Path) -> None:
    deadline = time.monotonic() + 120
    health_url = f"{endpoint}/healthz"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f"Phoenix exited during startup with code {process.returncode}:\n"
                f"{log_path.read_text()}"
            )
        try:
            with urllib.request.urlopen(health_url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.25)
    raise TimeoutError(f"Phoenix did not become healthy at {health_url}:\n{log_path.read_text()}")


def _find_dataset(client: Client, name: str) -> v1.Dataset:
    matches = [dataset for dataset in client.datasets.list() if dataset["name"] == name]
    _check(len(matches) == 1, f"Expected one dataset named {name!r}, found {matches!r}")
    return matches[0]


def _job_experiments(client: Client, dataset_id: str, job_name: str) -> list[v1.Experiment]:
    return [
        experiment
        for experiment in client.experiments.list(dataset_id=dataset_id)
        if experiment["metadata"].get("harbor_job_name") == job_name
    ]


def _run_numbers(client: Client, experiment_id: str) -> list[int]:
    detail = client.experiments.get_experiment(experiment_id=experiment_id)
    return sorted(run["repetition_number"] for run in detail["task_runs"])


def _run_ids(client: Client, experiment_id: str) -> set[str]:
    detail = client.experiments.get_experiment(experiment_id=experiment_id)
    return {run["id"] for run in detail["task_runs"]}


def _runs(client: Client, experiment_id: str) -> list[v1.ExperimentRun]:
    return client.experiments._get_all_experiment_runs(  # noqa: SLF001  # pyright: ignore[reportPrivateUsage]
        experiment_id=experiment_id
    )


def _experiment_records(endpoint: str, experiment_id: str) -> list[dict[str, Any]]:
    with urllib.request.urlopen(
        f"{endpoint}/v1/experiments/{experiment_id}/json", timeout=10
    ) as response:
        return json.loads(response.read())


def _evaluation_state(
    endpoint: str, experiment_id: str
) -> dict[tuple[str, int], list[dict[str, Any]]]:
    return {
        (record["example_id"], record["repetition_number"]): sorted(
            record["annotations"], key=lambda annotation: annotation["name"]
        )
        for record in _experiment_records(endpoint, experiment_id)
    }


def _assert_regression_triage_evaluations(
    endpoint: str,
    experiment_id: str,
    *,
    reward: float,
    runs: int = 1,
    expect_all_steps: bool = True,
) -> None:
    records = _experiment_records(endpoint, experiment_id)
    _check(len(records) == runs, repr(records))
    step_reward_names = {
        "step_01_aggregate.reward",
        "step_02_diagnose.reward",
        "step_03_trace_drilldown.reward",
        "step_04_create_split.reward",
    }
    for record in records:
        annotations = {annotation["name"]: annotation for annotation in record["annotations"]}
        _check(annotations["reward"]["score"] == reward, repr(annotations))
        _check(annotations["infra_ok"]["score"] == 1.0, repr(annotations))
        _check(annotations["infra_ok"]["label"] == "ok", repr(annotations))
        _check("tool_calls" in annotations, repr(annotations))
        if expect_all_steps:
            _check(step_reward_names <= annotations.keys(), repr(annotations))


def _phoenix_state(client: Client) -> dict[str, Any]:
    state: dict[str, Any] = {}
    for dataset in client.datasets.list():
        versions = client.datasets.get_dataset_versions(dataset=dataset["id"])
        experiments = list(client.experiments.list(dataset_id=dataset["id"]))
        state[dataset["name"]] = {
            "example_count": dataset["example_count"],
            "versions": sorted(version["version_id"] for version in versions),
            "experiments": sorted(experiment["id"] for experiment in experiments),
            "runs": sorted(
                run_id
                for experiment in experiments
                for run_id in _run_ids(client, experiment["id"])
            ),
        }
    return state


def _assert_complete_experiment(
    experiment: Mapping[str, Any],
    *,
    examples: int,
    repetitions: int,
    successful_runs: int,
) -> None:
    _check(experiment["example_count"] == examples, repr(experiment))
    _check(experiment["repetitions"] == repetitions, repr(experiment))
    _check(experiment["successful_run_count"] == successful_runs, repr(experiment))
    _check(experiment["failed_run_count"] == 0, repr(experiment))
    _check(experiment["missing_run_count"] == 0, repr(experiment))


def _assert_no_trial_compute(jobs_dir: Path, job_name: str) -> None:
    job_dir = jobs_dir / job_name
    if not job_dir.exists():
        return
    _check(not (job_dir / "result.json").exists(), f"{job_name} wrote a result")
    trial_directories = [path for path in job_dir.iterdir() if path.is_dir()]
    _check(not trial_directories, f"{job_name} started trials: {trial_directories!r}")


def _harbor_command(
    wheel: Path,
    endpoint: str,
    jobs_dir: Path,
    arguments: Iterable[str],
    *,
    trace_mode: str | None = "atif",
) -> list[str]:
    """Build a ``harbor run`` command that loads the plugin from the built wheel.

    ``trace_mode=None`` passes ``null``, which Harbor's kwarg parser turns into ``None``.
    """
    return [
        "uvx",
        "--refresh",
        "--python",
        HARBOR_PYTHON,
        "--from",
        f"harbor[daytona]=={HARBOR_VERSION}",
        "--with",
        str(wheel),
        "harbor",
        "run",
        *arguments,
        "--jobs-dir",
        str(jobs_dir),
        "--plugin",
        "arize-phoenix",
        "--plugin-kwarg",
        f"endpoint={endpoint}",
        "--plugin-kwarg",
        f"trace_mode={'null' if trace_mode is None else trace_mode}",
        "--yes",
    ]


def _print_plugin_warnings(harbor_output: str) -> None:
    """Surface plugin warnings, which Harbor otherwise hides inside a passing run."""
    for line in harbor_output.splitlines():
        if "Harbor ATIF" in line or "phoenix.client.harbor" in line:
            print(f"      {line.strip()}")


def _expected_atif_source_paths(
    trial_dir: Path, trial_result: Mapping[str, Any]
) -> tuple[str, ...]:
    """Mirror the plugin's selection of canonical trial trajectories."""
    step_names = _step_names(trial_result)
    config = cast(Mapping[str, Any], trial_result.get("config") or {})
    if not step_names:
        paths = [trial_dir / "agent" / "trajectory.json"]
        if config.get("user_agent") is not None:
            paths.append(trial_dir / "user-agent" / "trajectory.json")
        return tuple(path.relative_to(trial_dir).as_posix() for path in paths if path.is_file())

    paths = [trial_dir / "steps" / name / "agent" / "trajectory.json" for name in step_names]
    agent_config = cast(Mapping[str, Any], config.get("agent") or {})
    if agent_config.get("resume_trajectory"):
        paths = [next((path for path in reversed(paths) if path.is_file()), paths[-1])]
    return tuple(path.relative_to(trial_dir).as_posix() for path in paths if path.is_file())


def _step_names(trial_result: Mapping[str, Any]) -> list[str]:
    steps = cast(list[Mapping[str, Any]], trial_result.get("step_results") or [])
    return [str(step["step_name"]) for step in steps]


def _parse_time(value: Any) -> datetime:
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _trace_spans(client: Client, project_name: str, trace_id: str) -> list[v1.Span]:
    spans = client.spans.get_spans(
        project_identifier=project_name,
        trace_ids=[trace_id],
        limit=10_000,
    )
    _check(bool(spans), f"ATIF trace {trace_id} has no spans")
    return spans


def _print_trace_tree(spans: Sequence[Mapping[str, Any]]) -> None:
    """Print the trace as an indented tree so the ATIF rendering can be inspected."""
    children: dict[str | None, list[Mapping[str, Any]]] = {}
    for span in spans:
        children.setdefault(span.get("parent_id"), []).append(span)
    for siblings in children.values():
        siblings.sort(key=lambda span: (_parse_time(span["start_time"]), span["name"]))

    def walk(parent_id: str | None, depth: int) -> None:
        for span in children.get(parent_id, []):
            duration = (
                _parse_time(span["end_time"]) - _parse_time(span["start_time"])
            ).total_seconds()
            print(f"      {'  ' * depth}{span['span_kind']:<5} {span['name']}  ({duration:.2f}s)")
            walk(span["context"]["span_id"], depth + 1)

    walk(None, 0)


def _assert_trace_shape(spans: Sequence[Mapping[str, Any]], trace_id: str) -> Mapping[str, Any]:
    """Check the invariants every Harbor ATIF trace must satisfy; return the trial root."""
    spans_by_id = {span["context"]["span_id"]: span for span in spans}
    roots = [span for span in spans if span.get("parent_id") is None]
    _check(len(roots) == 1 and roots[0]["name"] == "harbor.trial", repr(roots))
    _check(roots[0]["span_kind"] == "CHAIN", repr(roots[0]))
    _check(
        all(span.get("parent_id") in spans_by_id for span in spans if span.get("parent_id")),
        "ATIF trace contains an unresolved parent",
    )
    _check(
        all(span["attributes"].get("session.id") == f"harbor:{trace_id}" for span in spans),
        "ATIF trace does not share one trial session",
    )
    for span in spans:
        _check(_parse_time(span["start_time"]) <= _parse_time(span["end_time"]), repr(span))
        kind = span["span_kind"]
        name = str(span["name"])
        if kind == "LLM":
            _check(name.startswith("chat"), f"LLM span is not named for its operation: {name!r}")
        else:
            _check(
                not any(str(key).startswith("llm.") for key in span["attributes"]),
                f"{kind} span {name!r} carries llm.* attributes",
            )
        if kind == "TOOL":
            _check(name.startswith("execute_tool "), f"unexpected TOOL name {name!r}")
            _check(span["start_time"] == span["end_time"], "ATIF invented tool durations")
        if kind == "AGENT" and span.get("parent_id") == roots[0]["context"]["span_id"]:
            _check(name.startswith("invoke_agent "), f"unexpected AGENT root name {name!r}")
        if kind in {"LLM", "TOOL"}:
            _check(
                spans_by_id[str(span["parent_id"])]["span_kind"] == "CHAIN",
                "ATIF LLM/TOOL spans are not nested under their source step",
            )
        if kind == "CHAIN" and name.startswith("agent_action_"):
            _check(
                "input.value" in span["attributes"] and "output.value" in span["attributes"],
                f"agent step {name!r} lacks input or output: {sorted(span['attributes'])!r}",
            )
    _check(any(span["span_kind"] in {"LLM", "TOOL"} for span in spans), "no LLM/TOOL spans")
    return roots[0]


def _assert_resume_is_idempotent(
    command: Sequence[str],
    client: Client,
    endpoint: str,
    *,
    description: str,
    dataset_id: str,
    job_name: str,
    experiment_id: str,
    project_name: str,
    trace_ids: Sequence[str],
) -> None:
    run_ids_before = _run_ids(client, experiment_id)
    evaluations_before = _evaluation_state(endpoint, experiment_id)
    span_ids_before = {
        trace_id: {
            span["context"]["span_id"] for span in _trace_spans(client, project_name, trace_id)
        }
        for trace_id in trace_ids
    }

    _print_plugin_warnings(_run(command, description=description))

    _check(
        [item["id"] for item in _job_experiments(client, dataset_id, job_name)] == [experiment_id],
        "resume created or lost an experiment",
    )
    _check(_run_ids(client, experiment_id) == run_ids_before, "resume changed the run set")
    _check(
        _evaluation_state(endpoint, experiment_id) == evaluations_before,
        "resume changed evaluations",
    )
    span_ids_after = {
        trace_id: {
            span["context"]["span_id"] for span in _trace_spans(client, project_name, trace_id)
        }
        for trace_id in trace_ids
    }
    _check(span_ids_after == span_ids_before, "resume changed the trace span set")


def _single_traced_run(
    client: Client, *, dataset_name: str, job_name: str
) -> tuple[v1.Experiment, v1.ExperimentRun, str, str]:
    """Return the job's one experiment, its one run, the run's trace ID, and project."""
    dataset = _find_dataset(client, dataset_name)
    experiments = _job_experiments(client, dataset["id"], job_name)
    _check(len(experiments) == 1, repr(experiments))
    experiment = experiments[0]
    runs = _runs(client, experiment["id"])
    _check(len(runs) == 1, repr(runs))
    trace_id = runs[0].get("trace_id")
    _check(isinstance(trace_id, str) and len(trace_id) == 32, repr(runs[0]))
    project_name = experiment.get("project_name")
    _check(bool(project_name), repr(experiment))
    return experiment, runs[0], str(trace_id), str(project_name)


def _run_atif_compaction_case(
    wheel: Path,
    endpoint: str,
    jobs_dir: Path,
    client: Client,
    *,
    job_name: str,
) -> None:
    compaction_job_name = f"{job_name}-compaction"
    command = _harbor_command(
        wheel,
        endpoint,
        jobs_dir,
        [
            "-d",
            HARBOR_ATIF_DATASET,
            "-i",
            HARBOR_ATIF_COMPACTION_TASK,
            "-a",
            "terminus-2",
            "-m",
            HARBOR_ATIF_MODEL,
            "--ae",
            "OPENAI_API_KEY=${OPENAI_API_KEY}",
            "--ak",
            "max_turns=2",
            "--ak",
            "proactive_summarization_threshold=271500",
            "--ak",
            'trajectory_config={"linear_history":true}',
            "-e",
            "docker",
            "-n",
            "1",
            "-r",
            "0",
            "--job-name",
            compaction_job_name,
        ],
    )
    _print_plugin_warnings(
        _run(command, description="Terminus-2 records compaction and continuation ATIF traces")
    )

    job_dir = jobs_dir / compaction_job_name
    trial_dirs = sorted(path for path in job_dir.iterdir() if path.is_dir())
    _check(len(trial_dirs) == 1, repr(trial_dirs))
    written_source_paths = {
        path.relative_to(trial_dirs[0]).as_posix()
        for path in (trial_dirs[0] / "agent").glob("trajectory*.json")
    }
    _check(
        HARBOR_ATIF_COMPACTION_SOURCE_PATHS <= written_source_paths,
        f"forced compaction wrote {sorted(written_source_paths)!r}",
    )

    experiment, _, trace_id, project_name = _single_traced_run(
        client, dataset_name=HARBOR_ATIF_DATASET_NAME, job_name=compaction_job_name
    )
    spans = _trace_spans(client, project_name, trace_id)
    _print_trace_tree(spans)
    root = _assert_trace_shape(spans, trace_id)
    _check(
        HARBOR_ATIF_COMPACTION_SOURCE_PATHS
        <= set(_span_metadata(root).get("atif_source_paths") or ()),
        repr(_span_metadata(root)),
    )
    agent_spans = [span for span in spans if span["span_kind"] == "AGENT"]
    _check(
        HARBOR_ATIF_COMPACTION_AGENTS == {span["name"] for span in agent_spans},
        repr(agent_spans),
    )
    continuation = next(
        span for span in agent_spans if span["name"] == "invoke_agent terminus-2 (continuation 1)"
    )
    _check(
        _span_metadata(continuation).get("is_continuation") is True
        and _span_metadata(continuation).get("continuation_index") == 1,
        repr(continuation),
    )
    compaction_spans = [span for span in spans if span["name"] == "compaction_1"]
    _check(len(compaction_spans) == 1, repr(compaction_spans))
    _check(
        _span_metadata(compaction_spans[0]).get("atif.context_management") is True,
        repr(compaction_spans[0]),
    )

    _assert_resume_is_idempotent(
        command,
        client,
        endpoint,
        description="forced compaction resume is idempotent",
        dataset_id=_find_dataset(client, HARBOR_ATIF_DATASET_NAME)["id"],
        job_name=compaction_job_name,
        experiment_id=experiment["id"],
        project_name=project_name,
        trace_ids=[trace_id],
    )


def _run_atif_multi_step_case(
    wheel: Path,
    endpoint: str,
    jobs_dir: Path,
    client: Client,
    *,
    job_name: str,
) -> None:
    """Run a three-step task with Claude Code and check one trace spans every step."""
    _check(bool(os.environ.get("ANTHROPIC_API_KEY")), "ANTHROPIC_API_KEY is required")
    multi_step_job_name = f"{job_name}-multi-step"
    command = _harbor_command(
        wheel,
        endpoint,
        jobs_dir,
        [
            "-p",
            str(MULTI_STEP_TASK),
            "-a",
            "claude-code",
            "-m",
            HARBOR_ATIF_CLAUDE_MODEL,
            "--ae",
            "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}",
            "-e",
            "docker",
            "-n",
            "1",
            "-r",
            "0",
            "--job-name",
            multi_step_job_name,
        ],
    )
    _print_plugin_warnings(
        _run(command, description="Claude Code records one trace for a multi-step task")
    )

    job_dir = jobs_dir / multi_step_job_name
    trial_dirs = sorted(path for path in job_dir.iterdir() if path.is_dir())
    _check(len(trial_dirs) == 1, repr(trial_dirs))
    trial_result = json.loads((trial_dirs[0] / "result.json").read_text())
    step_names = _step_names(trial_result)
    _check(bool(step_names), f"no step results in {trial_result!r}")
    expected_source_paths = _expected_atif_source_paths(trial_dirs[0], trial_result)
    _check(
        len(expected_source_paths) == len(step_names),
        f"expected one trajectory per step, found {expected_source_paths!r}",
    )

    experiment, run, trace_id, project_name = _single_traced_run(
        client, dataset_name="harbor-task/arize/word-count", job_name=multi_step_job_name
    )
    records = _experiment_records(endpoint, experiment["id"])
    _check(len(records) == 1, repr(records))
    annotations = {annotation["name"]: annotation for annotation in records[0]["annotations"]}
    _check({"reward", "infra_ok"} <= annotations.keys(), repr(annotations))
    _check(
        {f"{name}.reward" for name in step_names} <= annotations.keys(),
        f"missing step rewards in {sorted(annotations)!r}",
    )
    print(
        "      rewards: "
        + ", ".join(f"{name}={annotations[name]['score']}" for name in sorted(annotations))
    )

    spans = _trace_spans(client, project_name, trace_id)
    _print_trace_tree(spans)
    root = _assert_trace_shape(spans, trace_id)
    root_metadata = _span_metadata(root)
    _check(
        set(expected_source_paths) <= set(root_metadata.get("atif_source_paths") or ()),
        f"expected ATIF roots {expected_source_paths!r}, got {root_metadata!r}",
    )
    run_output = cast(Mapping[str, Any], run.get("output") or {})
    _check(
        root_metadata.get("harbor_trial_id") == run_output.get("harbor_trial_id"),
        f"trace root and run disagree on the trial: {root_metadata!r} vs {run!r}",
    )
    step_roots = [
        span
        for span in spans
        if span["span_kind"] == "AGENT" and span.get("parent_id") == root["context"]["span_id"]
    ]
    _check(
        [_span_metadata(span).get("harbor.step_name") for span in step_roots] == step_names,
        f"expected one agent root per step in order {step_names!r}, got {step_roots!r}",
    )
    _check(
        all(str(span["name"]).endswith(f" · {name}") for span, name in zip(step_roots, step_names)),
        f"step roots are not qualified with their step name: {step_roots!r}",
    )
    for step_root in step_roots:
        descendants = [
            span for span in spans if span.get("parent_id") == step_root["context"]["span_id"]
        ]
        _check(
            any(span["span_kind"] == "CHAIN" for span in descendants),
            f"step root {step_root['name']!r} has no step spans",
        )

    _assert_resume_is_idempotent(
        command,
        client,
        endpoint,
        description="multi-step resume is idempotent",
        dataset_id=_find_dataset(client, "harbor-task/arize/word-count")["id"],
        job_name=multi_step_job_name,
        experiment_id=experiment["id"],
        project_name=project_name,
        trace_ids=[trace_id],
    )


def _run_atif_terminus_case(
    wheel: Path,
    endpoint: str,
    jobs_dir: Path,
    client: Client,
    *,
    job_name: str,
) -> None:
    _check(bool(os.environ.get("OPENAI_API_KEY")), "OPENAI_API_KEY is required")
    command = _harbor_command(
        wheel,
        endpoint,
        jobs_dir,
        [
            "-d",
            HARBOR_ATIF_DATASET,
            *(item for task_name in HARBOR_ATIF_TASKS for item in ("-i", task_name)),
            "-a",
            "terminus-2",
            "-m",
            HARBOR_ATIF_MODEL,
            "--ae",
            "OPENAI_API_KEY=${OPENAI_API_KEY}",
            "--ak",
            "max_turns=12",
            "-e",
            "docker",
            "-n",
            "1",
            "-r",
            "0",
            "--job-name",
            job_name,
        ],
    )
    _print_plugin_warnings(
        _run(command, description="Terminus-2 records a run with its ATIF trace")
    )

    trial_dirs = sorted(path for path in (jobs_dir / job_name).iterdir() if path.is_dir())
    _check(len(trial_dirs) == len(HARBOR_ATIF_TASKS), repr(trial_dirs))
    trials_by_name: dict[str, tuple[Path, tuple[str, ...]]] = {}
    for trial_dir in trial_dirs:
        trial_result = json.loads((trial_dir / "result.json").read_text())
        expected_source_paths = _expected_atif_source_paths(trial_dir, trial_result)
        _check(bool(expected_source_paths), f"{trial_dir.name} wrote no importable trajectory.json")
        for relative_path in expected_source_paths:
            payload = json.loads((trial_dir / relative_path).read_text())
            _check(str(payload.get("schema_version", "")).startswith("ATIF-v1."), relative_path)
        trials_by_name[trial_dir.name] = (trial_dir, expected_source_paths)

    dataset = _find_dataset(client, HARBOR_ATIF_DATASET_NAME)
    experiments = _job_experiments(client, dataset["id"], job_name)
    _check(len(experiments) == 1, repr(experiments))
    experiment = experiments[0]
    runs = _runs(client, experiment["id"])
    _check(len(runs) == len(HARBOR_ATIF_TASKS), repr(runs))
    trace_ids = [str(run.get("trace_id")) for run in runs]
    _check(
        len(set(trace_ids)) == len(HARBOR_ATIF_TASKS)
        and all(len(trace_id) == 32 for trace_id in trace_ids),
        repr(runs),
    )
    project_name = str(experiment.get("project_name") or "")
    _check(bool(project_name), repr(experiment))
    job_result_id = str(json.loads((jobs_dir / job_name / "result.json").read_text()).get("id"))
    for run in runs:
        trace_id = str(run.get("trace_id"))
        spans = _trace_spans(client, project_name, trace_id)
        root = _assert_trace_shape(spans, trace_id)
        root_metadata = _span_metadata(root)
        trial_name = str(root_metadata.get("harbor_trial_name"))
        _check(trial_name in trials_by_name, repr(root_metadata))
        linked_output = cast(Mapping[str, Any], run.get("output") or {})
        _check(
            root_metadata.get("harbor_trial_id") == linked_output.get("harbor_trial_id"),
            f"run {run.get('id')!r} links trace {trace_id} whose root records "
            f"trial {root_metadata.get('harbor_trial_id')!r}, not {linked_output!r}",
        )
        _check(
            root_metadata.get("harbor_job_id") == job_result_id,
            f"trace root records job {root_metadata.get('harbor_job_id')!r}, "
            f"expected {job_result_id!r}",
        )
        trial_dir, expected_source_paths = trials_by_name[trial_name]
        recorded_source_paths = tuple(root_metadata.get("atif_source_paths") or ())
        _check(
            set(expected_source_paths) <= set(recorded_source_paths),
            f"expected ATIF roots {expected_source_paths!r}, got {root_metadata!r}",
        )
        _check(
            all((trial_dir / path).is_file() for path in recorded_source_paths),
            f"trace lists an ATIF source that is not a trial file: {recorded_source_paths!r}",
        )
        llm_spans = [span for span in spans if span["span_kind"] == "LLM"]
        _check(
            all(
                _span_metadata(span).get("atif.timing") == "harbor.api_request_times_msec"
                for span in llm_spans
            ),
            "Terminus-2 request measurements were not applied to every LLM step",
        )
        _assert_equal_time_children_keep_declared_order(spans)
    project_spans = client.spans.get_spans(project_identifier=project_name, limit=10_000)
    project_trace_ids = {span["context"]["trace_id"] for span in project_spans}
    _check(
        project_trace_ids == set(trace_ids),
        f"experiment project holds traces {sorted(project_trace_ids)!r} "
        f"but runs link {sorted(trace_ids)!r}",
    )

    _assert_resume_is_idempotent(
        command,
        client,
        endpoint,
        description="second ATIF resume is idempotent",
        dataset_id=dataset["id"],
        job_name=job_name,
        experiment_id=experiment["id"],
        project_name=project_name,
        trace_ids=trace_ids,
    )


def _assert_equal_time_children_keep_declared_order(spans: Sequence[Mapping[str, Any]]) -> None:
    """Check that Phoenix returns an LLM before its tools and tools in ATIF array order."""
    leaf_spans = [span for span in spans if span["span_kind"] in {"LLM", "TOOL"}]
    step_ids = {
        span["context"]["span_id"]
        for span in spans
        if span["span_kind"] == "CHAIN" and _span_metadata(span).get("atif.step_id") is not None
    }
    for step_id in step_ids:
        children = sorted(
            (span for span in leaf_spans if span.get("parent_id") == step_id),
            key=lambda span: _parse_time(span["start_time"]),
        )
        llm_children = [span for span in children if span["span_kind"] == "LLM"]
        tool_children = [span for span in children if span["span_kind"] == "TOOL"]
        if llm_children:
            _check(children[0] is llm_children[0], "LLM does not precede its requested tools")
        _check(
            [_span_metadata(span).get("atif.tool_call_index") for span in tool_children]
            == list(range(len(tool_children))),
            "Equal-time tools do not preserve ATIF array order",
        )


def _run_atif_matrix(root: Path, wheel: Path, endpoint: str) -> None:
    jobs_dir = root / "jobs"
    jobs_dir.mkdir(exist_ok=True)
    client = Client(base_url=endpoint)
    job_name = os.environ.get("HARBOR_E2E_JOB_NAME", "plugin-e2e-atif")
    cases = {
        "terminus": _run_atif_terminus_case,
        "compaction": _run_atif_compaction_case,
        "multi-step": _run_atif_multi_step_case,
    }
    selected = [case.strip() for case in HARBOR_ATIF_CASES.split(",") if case.strip()]
    unknown = sorted(set(selected) - cases.keys())
    _check(not unknown, f"unknown HARBOR_E2E_ATIF_CASES {unknown!r}; choose from {sorted(cases)!r}")
    for case in selected:
        cases[case](wheel, endpoint, jobs_dir, client, job_name=job_name)


def _run_matrix(root: Path, wheel: Path, endpoint: str) -> None:
    jobs_dir = root / "jobs"
    jobs_dir.mkdir()
    client = Client(base_url=endpoint)

    direct_job = "plugin-e2e-direct-repetitions"
    _run(
        _harbor_command(
            wheel,
            endpoint,
            jobs_dir,
            [
                "-p",
                str(DIRECT_TASK),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-k",
                "2",
                "-n",
                "2",
                "-r",
                "0",
                "--job-name",
                direct_job,
            ],
        ),
        description="single direct task records deterministic repetitions",
    )
    direct_dataset = _find_dataset(client, "harbor-task/arize/phoenix-regression-triage")
    _check(direct_dataset["example_count"] == 1, repr(direct_dataset))
    direct_experiments = _job_experiments(client, direct_dataset["id"], direct_job)
    _check(len(direct_experiments) == 1, repr(direct_experiments))
    _assert_complete_experiment(direct_experiments[0], examples=1, repetitions=2, successful_runs=2)
    _check(
        _run_numbers(client, direct_experiments[0]["id"]) == [1, 2],
        repr(direct_experiments[0]),
    )
    _assert_regression_triage_evaluations(endpoint, direct_experiments[0]["id"], reward=1.0, runs=2)

    dataset_job = "plugin-e2e-local-dataset"
    _run(
        _harbor_command(
            wheel,
            endpoint,
            jobs_dir,
            [
                "-p",
                str(TASKS_DIR),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-n",
                "1",
                "-r",
                "0",
                "--job-name",
                dataset_job,
            ],
        ),
        description="normal local dataset records a complete experiment",
    )
    local_dataset = _find_dataset(client, "tasks")
    _check(local_dataset["id"] != direct_dataset["id"], repr(local_dataset))
    local_experiments = _job_experiments(client, local_dataset["id"], dataset_job)
    _check(len(local_experiments) == 1, repr(local_experiments))
    _assert_complete_experiment(local_experiments[0], examples=1, repetitions=1, successful_runs=1)
    _check(_run_numbers(client, local_experiments[0]["id"]) == [1], dataset_job)

    task_alpha = root / "task-alpha"
    task_beta = root / "task-beta"
    shutil.copytree(DIRECT_TASK, task_alpha)
    shutil.copytree(DIRECT_TASK, task_beta)
    unnamed_job = "plugin-e2e-unnamed-composite"
    two_tasks_config = root / "two-tasks.json"
    _write_json(
        two_tasks_config,
        {
            "job_name": unnamed_job,
            "tasks": [{"path": str(task_alpha)}, {"path": str(task_beta)}],
        },
    )
    state_before = _phoenix_state(client)
    _run(
        _harbor_command(
            wheel,
            endpoint,
            jobs_dir,
            [
                "-c",
                str(two_tasks_config),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-n",
                "2",
                "-r",
                "0",
            ],
        ),
        description="unnamed composite is rejected before trial compute",
        expected_error="multiple ad-hoc tasks has no collection identity",
    )
    _check(_phoenix_state(client) == state_before, "Rejected composite changed Phoenix")
    _assert_no_trial_compute(jobs_dir, unnamed_job)

    composite_name = "harbor-plugin-e2e-composite"
    composite_two_job = "plugin-e2e-composite-two"
    _run(
        _harbor_command(
            wheel,
            endpoint,
            jobs_dir,
            [
                "-c",
                str(two_tasks_config),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-n",
                "2",
                "-r",
                "0",
                "--job-name",
                composite_two_job,
                "--plugin-kwarg",
                f"dataset={composite_name}",
            ],
        ),
        description="named composite records its complete two-task snapshot",
    )
    composite_dataset = _find_dataset(client, composite_name)
    composite_current = client.datasets.get_dataset(dataset=composite_dataset["id"])
    _check(len(composite_current.examples) == 2, repr(composite_current))
    composite_two_experiments = _job_experiments(client, composite_dataset["id"], composite_two_job)
    _check(len(composite_two_experiments) == 1, repr(composite_two_experiments))
    composite_two_experiment = composite_two_experiments[0]
    original_version_id = composite_two_experiment["dataset_version_id"]
    _assert_complete_experiment(
        composite_two_experiment, examples=2, repetitions=1, successful_runs=2
    )

    composite_one_job = "plugin-e2e-composite-one"
    _run(
        _harbor_command(
            wheel,
            endpoint,
            jobs_dir,
            [
                "-p",
                str(task_alpha),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-n",
                "1",
                "-r",
                "0",
                "--job-name",
                composite_one_job,
                "--plugin-kwarg",
                f"dataset={composite_name}",
            ],
        ),
        description="later composite job creates an exact one-task version",
    )
    composite_dataset = _find_dataset(client, composite_name)
    composite_current = client.datasets.get_dataset(dataset=composite_dataset["id"])
    versions = client.datasets.get_dataset_versions(dataset=composite_dataset["id"])
    _check(composite_dataset["example_count"] == 1, repr(composite_dataset))
    _check(len(composite_current.examples) == 1, repr(composite_current))
    _check(len(versions) == 2, repr(versions))
    composite_two_experiment = _job_experiments(client, composite_dataset["id"], composite_two_job)[
        0
    ]
    composite_one_experiment = _job_experiments(client, composite_dataset["id"], composite_one_job)[
        0
    ]
    _check(
        composite_two_experiment["dataset_version_id"] == original_version_id,
        repr(composite_two_experiment),
    )
    _check(composite_two_experiment["example_count"] == 2, repr(composite_two_experiment))
    _check(
        composite_one_experiment["dataset_version_id"] == composite_current.version_id,
        repr(composite_one_experiment),
    )
    _assert_complete_experiment(
        composite_one_experiment, examples=1, repetitions=1, successful_runs=1
    )

    agents_job = "plugin-e2e-two-agents"
    agents_config = root / "two-agents.json"
    _write_json(
        agents_config,
        {
            "job_name": agents_job,
            "n_concurrent_trials": 2,
            "agents": [{"name": "oracle"}, {"name": "nop"}],
            "tasks": [{"path": str(DIRECT_TASK)}],
        },
    )
    agents_command = _harbor_command(
        wheel,
        endpoint,
        jobs_dir,
        ["-c", str(agents_config), "-e", "docker", "-r", "0"],
    )
    _run(
        agents_command,
        description="two agents record separate experiments on one version",
    )
    direct_dataset = _find_dataset(client, "harbor-task/arize/phoenix-regression-triage")
    agent_experiments = _job_experiments(client, direct_dataset["id"], agents_job)
    _check(len(agent_experiments) == 2, repr(agent_experiments))
    _check(
        {experiment["metadata"]["harbor_agent"]["agent_name"] for experiment in agent_experiments}
        == {"oracle", "nop"},
        repr(agent_experiments),
    )
    _check(
        len({experiment["dataset_version_id"] for experiment in agent_experiments}) == 1,
        repr(agent_experiments),
    )
    for experiment in agent_experiments:
        _assert_complete_experiment(experiment, examples=1, repetitions=1, successful_runs=1)
        agent_name = experiment["metadata"]["harbor_agent"]["agent_name"]
        _assert_regression_triage_evaluations(
            endpoint,
            experiment["id"],
            reward=1.0 if agent_name == "oracle" else 0.0,
            expect_all_steps=agent_name == "oracle",
        )
    experiment_ids_before = {experiment["id"] for experiment in agent_experiments}
    run_ids_before = {
        run_id for experiment in agent_experiments for run_id in _run_ids(client, experiment["id"])
    }
    evaluations_before = {
        experiment["id"]: _evaluation_state(endpoint, experiment["id"])
        for experiment in agent_experiments
    }

    _run(
        agents_command,
        description="completed job resume is idempotent",
    )
    resumed_experiments = _job_experiments(client, direct_dataset["id"], agents_job)
    _check(
        {experiment["id"] for experiment in resumed_experiments} == experiment_ids_before,
        repr(resumed_experiments),
    )
    resumed_run_ids = {
        run_id
        for experiment in resumed_experiments
        for run_id in _run_ids(client, experiment["id"])
    }
    _check(resumed_run_ids == run_ids_before, repr(resumed_run_ids))
    evaluations_after = {
        experiment["id"]: _evaluation_state(endpoint, experiment["id"])
        for experiment in resumed_experiments
    }
    _check(evaluations_after == evaluations_before, repr(evaluations_after))

    mixed_job = "plugin-e2e-mixed-sources"
    mixed_config = root / "mixed-sources.json"
    _write_json(
        mixed_config,
        {
            "job_name": mixed_job,
            "datasets": [{"path": str(TASKS_DIR)}],
            "tasks": [{"path": str(task_alpha)}],
        },
    )
    state_before = _phoenix_state(client)
    _run(
        _harbor_command(
            wheel,
            endpoint,
            jobs_dir,
            [
                "-c",
                str(mixed_config),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-n",
                "2",
                "-r",
                "0",
            ],
        ),
        description="mixed dataset and direct-task sources are rejected",
        expected_error="cannot combine ad-hoc tasks and datasets",
    )
    _check(_phoenix_state(client) == state_before, "Mixed-source job changed Phoenix")
    _assert_no_trial_compute(jobs_dir, mixed_job)

    unavailable_job = "plugin-e2e-unavailable-phoenix"
    unavailable_endpoint = f"http://127.0.0.1:{_free_port()}"
    state_before = _phoenix_state(client)
    _run(
        _harbor_command(
            wheel,
            unavailable_endpoint,
            jobs_dir,
            [
                "-p",
                str(DIRECT_TASK),
                "-a",
                "oracle",
                "-e",
                "docker",
                "-n",
                "1",
                "-r",
                "0",
                "--job-name",
                unavailable_job,
            ],
        ),
        description="unavailable Phoenix fails before trial compute",
        expected_error="All connection attempts failed",
    )
    _check(_phoenix_state(client) == state_before, "Unavailable endpoint changed Phoenix")
    _assert_no_trial_compute(jobs_dir, unavailable_job)


def main() -> int:
    root = Path(tempfile.mkdtemp(prefix="phoenix-harbor-plugin-e2e-"))
    keep = os.environ.get("HARBOR_E2E_KEEP") == "1"
    phoenix_process: subprocess.Popen[str] | None = None
    log_file = None
    succeeded = False
    try:
        print(f"Harbor plugin E2E workspace: {root}")
        _run(
            ["uv", "build", "--wheel", "packages/phoenix-client"],
            description="build current Phoenix client wheel",
        )
        wheels = sorted(
            (REPO_ROOT / "dist").glob("arize_phoenix_client-*.whl"),
            key=lambda path: path.stat().st_mtime,
        )
        _check(bool(wheels), "Phoenix client wheel was not created")
        wheel = wheels[-1].resolve()

        external_endpoint = os.environ.get("HARBOR_E2E_ENDPOINT")
        if external_endpoint:
            endpoint = external_endpoint.rstrip("/")
            with urllib.request.urlopen(f"{endpoint}/healthz", timeout=5) as response:
                _check(response.status == 200, f"Phoenix at {endpoint} is not healthy")
            print(f"PASS  external Phoenix is healthy at {endpoint}")
        else:
            port = _free_port()
            grpc_port = _free_port()
            endpoint = f"http://127.0.0.1:{port}"
            phoenix_dir = root / "phoenix"
            phoenix_dir.mkdir()
            log_path = root / "phoenix.log"
            log_file = log_path.open("w")
            env = os.environ.copy()
            env["PHOENIX_WORKING_DIR"] = str(phoenix_dir)
            env["PHOENIX_PORT"] = str(port)
            env["PHOENIX_GRPC_PORT"] = str(grpc_port)
            phoenix_process = subprocess.Popen(
                ["uv", "run", "phoenix", "serve"],
                cwd=REPO_ROOT,
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True,
            )
            _wait_for_phoenix(endpoint, phoenix_process, log_path)
            print(f"PASS  isolated Phoenix is healthy at {endpoint}")

        if os.environ.get("HARBOR_E2E_ATIF") == "1":
            _run_atif_matrix(root, wheel, endpoint)
        else:
            _run_matrix(root, wheel, endpoint)
        succeeded = True
        print("PASS  Phoenix Harbor plugin E2E matrix")
        return 0
    except Exception as error:
        traceback.print_exc()
        print(f"\nFAIL  {error}", file=sys.stderr)
        print(f"Artifacts retained at {root}", file=sys.stderr)
        return 1
    finally:
        if phoenix_process is not None and phoenix_process.poll() is None:
            phoenix_process.terminate()
            try:
                phoenix_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                phoenix_process.kill()
                phoenix_process.wait()
        if log_file is not None:
            log_file.close()
        if succeeded and not keep:
            shutil.rmtree(root)
        elif succeeded:
            print(f"Artifacts retained at {root}")


if __name__ == "__main__":
    raise SystemExit(main())
