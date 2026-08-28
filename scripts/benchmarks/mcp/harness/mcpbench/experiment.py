"""Upload a finished run as a Phoenix dataset and experiment.

Reads the same transcripts ``report`` does. Does not call Claude or MCP.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .analyze import rows_for_run, tasks_as_run
from .config import BenchConfig, ConfigError, Task

DATASET_PREFIX = "mcpbench"


def phoenix_base_url(endpoint: str) -> str:
    """Turn a collector URL or Phoenix host into the API base."""
    endpoint = endpoint.rstrip("/")
    if endpoint.endswith("/v1/traces"):
        endpoint = endpoint[: -len("/v1/traces")]
    return endpoint


def _ui_host(base_url: str) -> str:
    parts = urlsplit(base_url)
    return f"{parts.scheme}://{parts.netloc}"


def _reference_output(task: Task | None, *, gold_from: Task | None) -> dict[str, Any]:
    """Dataset expected output: the matcher, plus one passing wording when we have one.

    Phoenix shows this as the experiment table's reference-output column. The
    matcher is what actually graded the cell; ``accept[0]`` is a readable gold
    answer from the task file (``tasks_as_run`` does not carry those examples).
    """
    expect = (task.expect if task else None) or (gold_from.expect if gold_from else None) or {}
    gold = (gold_from.accept[0] if gold_from and gold_from.accept else None) or (
        task.accept[0] if task and task.accept else None
    )
    output: dict[str, Any] = {}
    if expect:
        output["expect"] = expect
    if gold:
        output["gold"] = gold
    return output


def _cell_output(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "answer": row.get("answer") or "",
        "passed": row.get("passed"),
        "graded": row.get("graded"),
        "invalid_reason": row.get("invalid_reason"),
        "total_cost_usd": row.get("total_cost_usd"),
        "peak_context_tokens": row.get("peak_context_tokens"),
        "n_tool_calls": row.get("n_tool_calls"),
        "tool_sequence": row.get("tool_sequence"),
        "trace_url": row.get("trace_url"),
    }


def _correct(output: Any) -> dict[str, Any]:
    passed = output.get("passed") if isinstance(output, dict) else None
    if passed is True:
        result: dict[str, Any] = {"score": 1.0, "label": "pass"}
    elif passed is False:
        result = {"score": 0.0, "label": "fail"}
    else:
        result = {"score": 0.0, "label": "ungraded"}
    if isinstance(output, dict) and output.get("invalid_reason"):
        result["explanation"] = str(output["invalid_reason"])
    return result


def _numeric_from_output(key: str, *, explanation_key: str | None = None):
    """Read a stored number off the replayed cell so Phoenix can show it as a column."""

    def evaluate(output: Any) -> dict[str, Any]:
        value = output.get(key) if isinstance(output, dict) else None
        result: dict[str, Any] = (
            {"score": float(value)} if value is not None else {"score": 0.0, "label": "missing"}
        )
        if explanation_key and isinstance(output, dict) and (text := output.get(explanation_key)):
            result["explanation"] = str(text)
        return result

    return evaluate


_EVALUATORS = {
    "correct": _correct,
    "cost": _numeric_from_output("total_cost_usd"),
    "peak_tokens": _numeric_from_output("peak_context_tokens"),
    "tool_calls": _numeric_from_output("n_tool_calls", explanation_key="tool_sequence"),
}


def upload_run(
    config: BenchConfig,
    tasks: list[Task],
    out_dir: Path,
    *,
    base_url: str,
) -> dict[str, str]:
    """Create one dataset and one experiment from ``out_dir``. Returns ids."""
    try:
        from phoenix.client import Client
        from phoenix.client.experiments import run_experiment
    except ImportError as exc:
        raise ConfigError(
            "phoenix.client is required. Run mcpbench from Phoenix's venv "
            "(the same one that installed this harness)."
        ) from exc

    tables = rows_for_run(config, tasks, out_dir)
    rows = tables["runs"]
    if not rows:
        raise ConfigError(f"No graded cells under {out_dir}.")

    meta: dict[str, Any] = {}
    if (manifest := out_dir / "manifest.json").is_file():
        meta = json.loads(manifest.read_text())
    by_task = tasks_as_run(meta, tasks)
    current_by_name = {task.name: task for task in tasks}

    stored: dict[tuple[str, str, int], dict[str, Any]] = {}
    examples: list[dict[str, Any]] = []
    for row in rows:
        task_name = str(row["task"])
        trial = int(row["trial"])
        label = str(row["label"])
        task = by_task.get(task_name)
        stem = str(row.get("transcript") or "").removesuffix(".jsonl")
        examples.append(
            {
                "id": stem,
                "input": {"prompt": task.prompt if task else "", "task": task_name},
                "output": _reference_output(task, gold_from=current_by_name.get(task_name)),
                "metadata": {
                    "task_class": row.get("task_class"),
                    "trial": trial,
                    "label": label,
                },
            }
        )
        stored[(label, task_name, trial)] = _cell_output(row)

    def replay(example: Any) -> dict[str, Any]:
        key = (
            str(example.metadata["label"]),
            str(example.input["task"]),
            int(example.metadata["trial"]),
        )
        return stored[key]

    client = Client(base_url=base_url)
    dataset_name = f"{DATASET_PREFIX}-{out_dir.name}"
    dataset = client.datasets.create_dataset(
        name=dataset_name,
        examples=examples,
        dataset_description="mcpbench cells replayed from stored transcripts.",
    )
    experiment = run_experiment(
        dataset=dataset,
        task=replay,
        evaluators=_EVALUATORS,
        experiment_name=out_dir.name,
        experiment_description="Stored mcpbench answers; Claude was not re-run.",
        experiment_metadata={"run_id": out_dir.name, "source": "mcpbench"},
        client=client,
        print_summary=True,
    )
    host = _ui_host(base_url)
    exp_id = experiment["experiment_id"]
    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset_name,
        "experiment_id": exp_id,
        "dataset_url": f"{host}/datasets/{dataset.id}",
        "experiment_url": (f"{host}/datasets/{dataset.id}/compare?experimentId={exp_id}"),
    }
