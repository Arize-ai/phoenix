"""End-to-end dataset upsert + experiment iteration workflow.

This example demonstrates:
1. Initial dataset upsert (2 examples)
2. Run experiment against v1
3. Evolve dataset: delete one example, keep one unchanged, add a new one
4. Re-run experiment against the updated dataset version

Usage:
    uv run --python 3.10 python \
        packages/phoenix-client/examples/datasets/upsert_dataset_experiments_example.py
"""

from __future__ import annotations

from typing import Any

from phoenix.client import Client
from phoenix.client.experiments import run_experiment

DATASET_NAME = "support-benchmark"

EXAMPLES_V1: list[dict[str, Any]] = [
    {
        "input": {"question": "What is AI?"},
        "output": {"answer": "..."},
        "metadata": {},
    },
    {
        "input": {"question": "What is ML?"},
        "output": {"answer": "..."},
        "metadata": {},
    },
]

# V2: keep "What is AI?" unchanged, delete "What is ML?", add "What is RL?"
EXAMPLES_V2: list[dict[str, Any]] = [
    {
        "input": {"question": "What is AI?"},
        "output": {"answer": "..."},
        "metadata": {},
    },
    {
        "input": {"question": "What is RL?"},
        "output": {"answer": "..."},
        "metadata": {},
    },
]


def task(input: dict[str, Any]) -> dict[str, str]:
    return {"answer": f"stub: {input['question']}"}


def main() -> None:
    client = Client()

    dataset_v1 = client.datasets.upsert_dataset(
        dataset=DATASET_NAME,
        examples=EXAMPLES_V1,
    )
    print(f"[upsert:v1] dataset_id={dataset_v1.id} version_id={dataset_v1.version_id}")

    exp_v1 = run_experiment(
        client=client,
        dataset=dataset_v1,
        task=task,
        experiment_name="support-v1",
        dry_run=True,
        print_summary=False,
    )
    print(
        f"[experiment:v1] experiment_id={exp_v1['experiment_id']} "
        f"dataset_version_id={dataset_v1.version_id} run_count={len(exp_v1['task_runs'])}"
    )

    dataset_v2 = client.datasets.upsert_dataset(
        dataset=DATASET_NAME,
        examples=EXAMPLES_V2,
    )
    print(f"[upsert:v2] dataset_id={dataset_v2.id} version_id={dataset_v2.version_id}")

    exp_v2 = run_experiment(
        client=client,
        dataset=dataset_v2,
        task=task,
        experiment_name="support-v2",
        dry_run=True,
        print_summary=False,
    )
    print(
        f"[experiment:v2] experiment_id={exp_v2['experiment_id']} "
        f"dataset_version_id={dataset_v2.version_id} run_count={len(exp_v2['task_runs'])}"
    )


if __name__ == "__main__":
    main()
