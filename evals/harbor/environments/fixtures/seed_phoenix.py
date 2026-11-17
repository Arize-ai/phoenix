"""Create a Phoenix SQLite fixture from a task's `fixture/phoenix_seed.json`.

The seed file describes the Phoenix state an agent finds when a task starts: projects with
spans, span, trace, session, and document annotations, datasets, and experiments with
recorded results. Staging runs this script once per distinct seed file and caches the
database. Run it with `uv run` from the repository root so it uses this checkout.

Seed file keys, all optional:

- `projects`: `{name: [span, ...]}`. Spans use the Phoenix REST shape
  (`name`, `context`, `span_kind`, `parent_id`, `start_time`, `end_time`,
  `status_code`, `attributes`).
- `span_annotations`, `trace_annotations`, `session_annotations`,
  `document_annotations`: lists in the REST shape. They're written in list order, so
  later entries get later timestamps.
- `prompts`: `[{name, description, versions: [{messages, model_name, model_provider,
  template_format, description}]}]`. Versions are created in order; the last is latest.
- `datasets`: `[{name, description, examples: [{input, output, metadata}]}]`.
- `experiments`: `[{dataset, name, description, metadata, runs: [{case_id, repetition,
  output, error, evaluations: {name: {score, label, explanation}}}]}]`. Runs match
  dataset examples by `metadata.case_id`. `repetition` is optional and defaults to 1.
  The experiment gets as many repetitions as the highest one, and every example needs a
  run for each repetition.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
from collections import Counter
from collections.abc import Iterator
from pathlib import Path
from typing import Any


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _healthy(base: str) -> bool:
    try:
        with urllib.request.urlopen(base + "/healthz", timeout=3) as response:
            return bool(response.status == 200)
    except Exception:
        return False


@contextlib.contextmanager
def temporary_phoenix(database: Path) -> Iterator[str]:
    """Serves Phoenix on free ports against `database` and yields its base URL."""
    port, grpc_port = _free_port(), _free_port()
    base = f"http://127.0.0.1:{port}"
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("PHOENIX_")},
        "PHOENIX_WORKING_DIR": str(database.parent),
        "PHOENIX_SQL_DATABASE_URL": f"sqlite:///{database}",
        "PHOENIX_PORT": str(port),
        "PHOENIX_GRPC_PORT": str(grpc_port),
        "PHOENIX_TELEMETRY_ENABLED": "false",
        "PHOENIX_DISABLE_AGENT_ASSISTANT": "true",
    }
    log_path = database.parent / "phoenix.log"
    with open(log_path, "w") as log:
        server = subprocess.Popen(
            ["phoenix", "serve", "--no-ui"], env=env, stdout=log, stderr=subprocess.STDOUT
        )
        try:
            deadline = time.monotonic() + 120
            while not _healthy(base):
                if time.monotonic() > deadline or server.poll() is not None:
                    raise RuntimeError("Phoenix did not become healthy")
                time.sleep(1)
            yield base
        except BaseException:
            print(log_path.read_text()[-4000:], file=sys.stderr)
            raise
        finally:
            server.terminate()
            try:
                server.wait(timeout=60)
            except subprocess.TimeoutExpired:
                server.kill()


def _wait_for_spans(client: Any, project: str, count: int) -> None:
    deadline = time.monotonic() + 120
    while True:
        try:
            spans = client.spans.get_spans(project_identifier=project, limit=count + 1)
        except Exception:
            spans = []
        if len(spans) >= count:
            return
        if time.monotonic() > deadline:
            raise TimeoutError(f"{project}: {len(spans)} of {count} spans ingested")
        time.sleep(1)


def _chunks(items: list[Any], size: int = 200) -> Iterator[list[Any]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def apply_spec(base: str, spec: dict[str, Any]) -> dict[str, Any]:
    """Writes the spec's state to the Phoenix server at `base` and returns counts."""
    from phoenix.client import Client

    client = Client(base_url=base)
    summary: dict[str, Any] = {}
    for project, spans in spec.get("projects", {}).items():
        for chunk in _chunks(spans):
            client.spans.log_spans(project_identifier=project, spans=chunk)
        _wait_for_spans(client, project, len(spans))
        summary[f"project:{project}"] = len(spans)
    # One call per annotation keeps insertion order, which tasks use as review order.
    # Phoenix stores annotation timestamps to the second, so a second annotation with the
    # same name on the same target waits for the next second; otherwise the two would tie.
    written: dict[tuple[str, ...], int] = {}

    def log(kind: str, target: str, annotation: dict[str, Any], write: Any) -> None:
        key = (kind, annotation["name"], str(annotation[target]))
        if key in written:
            while int(time.time()) <= written[key]:
                time.sleep(0.05)
        write(annotation)
        written[key] = int(time.time())

    for annotation in spec.get("span_annotations", []):
        log(
            "span",
            "span_id",
            annotation,
            lambda a: client.spans.log_span_annotations(span_annotations=[a], sync=True),
        )
    for annotation in spec.get("trace_annotations", []):
        log(
            "trace",
            "trace_id",
            annotation,
            lambda a: client.traces.log_trace_annotations(trace_annotations=[a], sync=True),
        )
    for annotation in spec.get("session_annotations", []):
        log(
            "session",
            "session_id",
            annotation,
            lambda a: client.sessions.log_session_annotations(session_annotations=[a], sync=True),
        )
    for annotation in spec.get("document_annotations", []):
        log(
            "document",
            "span_id",
            annotation,
            lambda a: client.spans.log_document_annotations(document_annotations=[a], sync=True),
        )
    for kind in ("span", "trace", "session", "document"):
        if spec.get(f"{kind}_annotations"):
            summary[f"{kind}_annotations"] = len(spec[f"{kind}_annotations"])
    for prompt in spec.get("prompts", []):
        _create_prompt(client, prompt)
        summary[f"prompt:{prompt['name']}"] = len(prompt["versions"])
    for dataset in spec.get("datasets", []):
        examples = dataset["examples"]
        created = client.datasets.create_dataset(
            name=dataset["name"],
            dataset_description=dataset.get("description"),
            inputs=[e["input"] for e in examples],
            outputs=[e.get("output", {}) for e in examples],
            metadata=[e.get("metadata", {}) for e in examples],
        )
        summary[f"dataset:{dataset['name']}"] = len(created)
    for experiment in spec.get("experiments", []):
        _replay_experiment(client, experiment)
        summary[f"experiment:{experiment['name']}"] = len(experiment["runs"])
    return summary


def _create_prompt(client: Any, spec: dict[str, Any]) -> None:
    """Creates the prompt's versions in order, so the last one is the latest."""
    from phoenix.client.types.prompts import PromptVersion

    for version in spec["versions"]:
        client.prompts.create(
            name=spec["name"],
            prompt_description=spec.get("description"),
            version=PromptVersion(
                version["messages"],
                model_name=version["model_name"],
                model_provider=version.get("model_provider", "OPENAI"),
                template_format=version.get("template_format", "MUSTACHE"),
                description=version.get("description"),
            ),
        )


def _replay_experiment(client: Any, spec: dict[str, Any]) -> None:
    """Records an experiment whose outputs and evaluations come from the spec.

    The task doesn't receive its repetition number, but the client runs an example's
    repetitions one after another, so the task counts calls per example. Each evaluator
    finds its run by the trace ID of the task that produced it. `_check_replay` reads the
    experiment back and fails if any run or evaluation landed on the wrong repetition.
    """
    from opentelemetry import trace

    dataset = client.datasets.get_dataset(dataset=spec["dataset"])
    runs = {(str(run["case_id"]), run.get("repetition", 1)): run for run in spec["runs"]}
    calls: Counter[str] = Counter()
    run_of_trace: dict[str, dict[str, Any]] = {}

    def task(metadata: dict[str, Any]) -> Any:
        case_id = str(metadata["case_id"])
        calls[case_id] += 1
        run = runs[(case_id, calls[case_id])]
        trace_id = trace.get_current_span().get_span_context().trace_id
        run_of_trace[format(trace_id, "032x")] = run
        if run.get("error"):
            raise RuntimeError(run["error"])
        return run["output"]

    names = sorted({name for run in spec["runs"] for name in run.get("evaluations", {})})

    def evaluator_for(name: str) -> Any:
        def evaluate(trace_id: str) -> dict[str, Any] | None:
            result = run_of_trace[trace_id].get("evaluations", {}).get(name)
            if result is None:
                raise RuntimeError("no recorded evaluation")
            return dict(result)

        evaluate.__name__ = name
        return evaluate

    ran = client.experiments.run_experiment(
        dataset=dataset,
        task=task,
        evaluators={name: evaluator_for(name) for name in names},
        experiment_name=spec["name"],
        experiment_description=spec.get("description"),
        experiment_metadata=spec.get("metadata", {}),
        print_summary=False,
        repetitions=max(repetition for _, repetition in runs),
        retries=0,
    )
    _check_replay(client, ran["experiment_id"], dataset, runs)


def _check_replay(
    client: Any, experiment_id: str, dataset: Any, runs: dict[tuple[str, int], dict[str, Any]]
) -> None:
    """Raises `RuntimeError` if a spec run or evaluation isn't on its example and repetition."""
    recorded = client.experiments.get_experiment(experiment_id=experiment_id)
    case_of = {example["id"]: str(example["metadata"]["case_id"]) for example in dataset.examples}
    evaluations: dict[str, dict[str, Any]] = {}
    for evaluation in recorded["evaluation_runs"]:
        evaluations.setdefault(evaluation.experiment_run_id, {})[evaluation.name] = evaluation
    found = set()
    for run in recorded["task_runs"]:
        key = (case_of[run["dataset_example_id"]], run["repetition_number"])
        want = runs[key]
        found.add(key)
        if bool(run.get("error")) != bool(want.get("error")) or (
            not want.get("error") and json.dumps(run["output"]) != json.dumps(want["output"])
        ):
            raise RuntimeError(f"{key}: the recorded output doesn't match the spec")
        for name, result in want.get("evaluations", {}).items():
            got = evaluations.get(run["id"], {}).get(name)
            got_result = (got.result or {}) if got else {}
            for field in ("score", "label", "explanation"):
                if got_result.get(field) != result.get(field):
                    raise RuntimeError(f"{key}: the recorded {name} evaluation doesn't match")
    if found != set(runs):
        raise RuntimeError(f"Runs missing from the experiment: {sorted(set(runs) - found)}")


def seed(spec_path: Path, output: Path) -> dict[str, Any]:
    spec = json.loads(spec_path.read_text())
    with tempfile.TemporaryDirectory(prefix="phoenix-spec-seed-") as scratch:
        database = Path(scratch) / "phoenix.db"
        with temporary_phoenix(database) as base:
            summary = apply_spec(base, spec)
        with sqlite3.connect(database) as connection:
            connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        for sidecar in (database.with_suffix(".db-wal"), database.with_suffix(".db-shm")):
            sidecar.unlink(missing_ok=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(database), output)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    summary = seed(args.seed, args.output)
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
