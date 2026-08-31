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
from typing import Any, Iterable, Mapping, Sequence

from phoenix.client import Client
from phoenix.client.__generated__ import v1

REPO_ROOT = Path(__file__).resolve().parents[3]
TASKS_DIR = REPO_ROOT / "evals" / "harbor" / "tasks"
DIRECT_TASK = TASKS_DIR / "regression-triage"
HARBOR_VERSION = os.environ.get("HARBOR_VERSION", "0.21.0")
HARBOR_PYTHON = os.environ.get("HARBOR_PYTHON", "3.13")
HARBOR_ATIF_MODEL = os.environ.get("HARBOR_ATIF_MODEL", "openai/gpt-5-mini")
HARBOR_ATIF_DATASET = "terminal-bench/terminal-bench-2-1@6"
HARBOR_ATIF_DATASET_NAME = "terminal-bench/terminal-bench-2-1"
HARBOR_ATIF_TASKS = (
    "terminal-bench/regex-log",
    "terminal-bench/cancel-async-tasks",
    "terminal-bench/fix-git",
)


def _check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _span_metadata(span: Mapping[str, Any]) -> dict[str, Any]:
    """Read metadata from nested or OpenInference-flattened attributes."""
    attributes = span.get("attributes") or {}
    if not isinstance(attributes, Mapping):
        return {}

    metadata: dict[str, Any] = {
        key.removeprefix("metadata."): value
        for key, value in attributes.items()
        if isinstance(key, str) and key.startswith("metadata.")
    }
    nested = attributes.get("metadata")
    if isinstance(nested, str):
        try:
            nested = json.loads(nested)
        except json.JSONDecodeError:
            nested = None
    if isinstance(nested, Mapping):
        metadata.update(nested)
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
    trace_mode: str = "atif",
) -> list[str]:
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
        f"trace_mode={trace_mode}",
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
    step_names = [str(step["step_name"]) for step in trial_result.get("step_results") or []]
    if not step_names:
        paths = [trial_dir / "agent" / "trajectory.json"]
        if (trial_result.get("config") or {}).get("user_agent") is not None:
            paths.append(trial_dir / "user-agent" / "trajectory.json")
        return tuple(path.relative_to(trial_dir).as_posix() for path in paths if path.is_file())

    paths = [trial_dir / "steps" / name / "agent" / "trajectory.json" for name in step_names]
    agent_config = (trial_result.get("config") or {}).get("agent") or {}
    if agent_config.get("resume_trajectory"):
        paths = [next((path for path in reversed(paths) if path.is_file()), paths[-1])]
    return tuple(path.relative_to(trial_dir).as_posix() for path in paths if path.is_file())


def _run_atif_matrix(root: Path, wheel: Path, endpoint: str) -> None:
    _check(bool(os.environ.get("OPENAI_API_KEY")), "OPENAI_API_KEY is required")
    jobs_dir = root / "jobs"
    jobs_dir.mkdir(exist_ok=True)
    client = Client(base_url=endpoint)
    job_name = os.environ.get("HARBOR_E2E_JOB_NAME", "plugin-e2e-atif")
    arguments = [
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
    ]
    traced_command = _harbor_command(
        wheel,
        endpoint,
        jobs_dir,
        arguments,
        trace_mode="atif",
    )

    _print_plugin_warnings(
        _run(traced_command, description="Terminus-2 records a run with its ATIF trace")
    )
    trial_dirs = sorted(path for path in (jobs_dir / job_name).iterdir() if path.is_dir())
    _check(len(trial_dirs) == len(HARBOR_ATIF_TASKS), repr(trial_dirs))
    trials_by_name: dict[str, tuple[Path, Mapping[str, Any], tuple[str, ...]]] = {}
    for trial_dir in trial_dirs:
        trial_result = json.loads((trial_dir / "result.json").read_text())
        expected_source_paths = _expected_atif_source_paths(trial_dir, trial_result)
        _check(bool(expected_source_paths), f"{trial_dir.name} wrote no importable trajectory.json")
        for relative_path in expected_source_paths:
            payload = json.loads((trial_dir / relative_path).read_text())
            _check(
                str(payload.get("schema_version", "")).startswith("ATIF-v1."),
                relative_path,
            )
        trials_by_name[trial_dir.name] = (trial_dir, trial_result, expected_source_paths)

    dataset = _find_dataset(client, HARBOR_ATIF_DATASET_NAME)
    experiments = _job_experiments(client, dataset["id"], job_name)
    _check(len(experiments) == 1, repr(experiments))
    experiment = experiments[0]
    initial_runs = _runs(client, experiment["id"])
    _check(len(initial_runs) == len(HARBOR_ATIF_TASKS), repr(initial_runs))
    trace_ids = {run.get("trace_id") for run in initial_runs}
    _check(
        len(trace_ids) == len(HARBOR_ATIF_TASKS)
        and all(isinstance(trace_id, str) and len(trace_id) == 32 for trace_id in trace_ids),
        repr(initial_runs),
    )
    evaluations_before = _evaluation_state(endpoint, experiment["id"])
    project_name = experiment.get("project_name")
    _check(bool(project_name), repr(experiment))
    runs_by_trace_id = {str(run.get("trace_id")): run for run in initial_runs}
    job_result_id = str(json.loads((jobs_dir / job_name / "result.json").read_text()).get("id"))
    span_ids_before: dict[str, set[str]] = {}
    for raw_trace_id in trace_ids:
        trace_id = str(raw_trace_id)
        spans = client.spans.get_spans(
            project_identifier=str(project_name),
            trace_ids=[trace_id],
            limit=10_000,
        )
        _check(bool(spans), f"ATIF trace {trace_id} has no spans")
        roots = [span for span in spans if span.get("parent_id") is None]
        _check(len(roots) == 1 and roots[0]["name"] == "harbor.trial", repr(roots))
        _check(roots[0]["span_kind"] == "CHAIN", repr(roots[0]))
        root_metadata = _span_metadata(roots[0])
        trial_name = str(root_metadata.get("harbor_trial_name"))
        _check(trial_name in trials_by_name, repr(root_metadata))
        # The linked run and the trace root describe the same Harbor trial
        # and job: a mismatch means a run was linked to someone else's trace.
        linked_run = runs_by_trace_id[trace_id]
        linked_output = linked_run.get("output") or {}
        _check(
            isinstance(linked_output, Mapping)
            and root_metadata.get("harbor_trial_id") == linked_output.get("harbor_trial_id"),
            f"run {linked_run.get('id')!r} links trace {trace_id} whose root records "
            f"trial {root_metadata.get('harbor_trial_id')!r}, "
            f"not {linked_output!r}",
        )
        _check(
            root_metadata.get("harbor_job_id") == job_result_id,
            f"trace root records job {root_metadata.get('harbor_job_id')!r}, "
            f"expected {job_result_id!r}",
        )
        trial_dir, _, expected_source_paths = trials_by_name[trial_name]
        recorded_source_paths = tuple(root_metadata.get("atif_source_paths") or ())
        _check(
            set(expected_source_paths) <= set(recorded_source_paths),
            f"expected ATIF roots {expected_source_paths!r}, got {root_metadata!r}",
        )
        _check(
            all((trial_dir / path).is_file() for path in recorded_source_paths),
            f"trace lists an ATIF source that is not a trial file: {recorded_source_paths!r}",
        )
        spans_by_id = {span["context"]["span_id"]: span for span in spans}
        span_ids_before[trace_id] = set(spans_by_id)
        _check(
            all(span.get("parent_id") in spans_by_id for span in spans if span.get("parent_id")),
            "ATIF trace contains an unresolved parent",
        )
        trial_root_id = roots[0]["context"]["span_id"]
        trajectory_roots = [
            span
            for span in spans
            if span["span_kind"] == "AGENT" and span.get("parent_id") == trial_root_id
        ]
        _check(
            len(trajectory_roots) >= len(expected_source_paths),
            f"expected an AGENT root per canonical source, got {trajectory_roots!r}",
        )
        _check(
            all(span["attributes"].get("session.id") == f"harbor:{trace_id}" for span in spans),
            "ATIF trace does not share one trial session",
        )
        converted_spans = [span for span in spans if span["context"]["span_id"] != trial_root_id]
        _check(
            all(
                isinstance(
                    _span_metadata(span).get("_phoenix.span_order"),
                    int,
                )
                for span in converted_spans
            ),
            "ATIF upload lost deterministic equal-time display order",
        )
        leaf_spans = [span for span in spans if span["span_kind"] in {"LLM", "TOOL"}]
        _check(bool(leaf_spans), f"ATIF trace {trace_id} has no LLM/TOOL spans")
        _check(
            all(spans_by_id[str(span["parent_id"])]["span_kind"] == "CHAIN" for span in leaf_spans),
            "ATIF LLM/TOOL spans are not nested under their source step",
        )
        for span in spans:
            start = datetime.fromisoformat(str(span["start_time"]).replace("Z", "+00:00"))
            end = datetime.fromisoformat(str(span["end_time"]).replace("Z", "+00:00"))
            _check(start <= end, f"negative span duration: {span!r}")
        tool_spans = [span for span in spans if span["span_kind"] == "TOOL"]
        _check(
            all(span["start_time"] == span["end_time"] for span in tool_spans),
            "ATIF invented tool durations",
        )
        llm_spans = [span for span in spans if span["span_kind"] == "LLM"]
        measured_llm_spans = [
            span
            for span in llm_spans
            if _span_metadata(span).get("atif.timing") == "harbor.api_request_times_msec"
        ]
        _check(
            len(measured_llm_spans) == len(llm_spans),
            "Terminus-2 request measurements were not applied to every LLM step",
        )
        source_steps = [
            span
            for span in spans
            if span["span_kind"] == "CHAIN" and _span_metadata(span).get("atif.step_id") is not None
        ]
        for source_step in source_steps:
            children = [
                span
                for span in leaf_spans
                if span.get("parent_id") == source_step["context"]["span_id"]
            ]
            children.sort(
                key=lambda span: (
                    datetime.fromisoformat(str(span["start_time"]).replace("Z", "+00:00")),
                    _span_metadata(span)["_phoenix.span_order"],
                )
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
            # Start times alone must reproduce causal order, so viewers
            # without the metadata tie-break still render correctly.
            by_time_only = sorted(
                children,
                key=lambda span: datetime.fromisoformat(
                    str(span["start_time"]).replace("Z", "+00:00")
                ),
            )
            _check(
                [span["context"]["span_id"] for span in by_time_only]
                == [span["context"]["span_id"] for span in children],
                "start-time sorting does not reproduce causal event order",
            )
    # The experiment project holds exactly the traces its runs link: an
    # unlinked or foreign trace in the project means linking failed somewhere.
    project_spans = client.spans.get_spans(project_identifier=str(project_name), limit=10_000)
    project_trace_ids = {span["context"]["trace_id"] for span in project_spans}
    _check(
        project_trace_ids == {str(trace_id) for trace_id in trace_ids},
        f"experiment project holds traces {sorted(project_trace_ids)!r} "
        f"but runs link {sorted(str(t) for t in trace_ids)!r}",
    )
    _check(_evaluation_state(endpoint, experiment["id"]) == evaluations_before, "Evals changed")

    _print_plugin_warnings(_run(traced_command, description="second ATIF resume is idempotent"))
    replayed_experiments = _job_experiments(client, dataset["id"], job_name)
    replayed_runs = _runs(client, experiment["id"])
    replayed_spans = client.spans.get_spans(
        project_identifier=str(project_name),
        trace_ids=[str(trace_id) for trace_id in trace_ids],
        limit=10_000,
    )
    _check(
        [item["id"] for item in replayed_experiments] == [experiment["id"]],
        repr(replayed_experiments),
    )
    _check(
        _run_ids(client, experiment["id"]) == {run["id"] for run in initial_runs},
        repr(replayed_runs),
    )
    replayed_span_ids: dict[str, set[str]] = {}
    for span in replayed_spans:
        replayed_span_ids.setdefault(span["context"]["trace_id"], set()).add(
            span["context"]["span_id"]
        )
    _check(
        replayed_span_ids == span_ids_before,
        "Second resume changed the trace span set",
    )
    _check(_evaluation_state(endpoint, experiment["id"]) == evaluations_before, "Evals changed")


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
