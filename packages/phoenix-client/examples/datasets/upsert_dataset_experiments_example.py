"""End-to-end dataset upsert + experiment iteration workflow.

This example demonstrates:
1. Initial dataset upsert
2. Run experiment
3. Evolve dataset with upsert
4. Re-run experiment against the updated dataset version

Usage:
    # Smoke run (no Phoenix server required)
    uv run --python 3.10 python \
        packages/phoenix-client/examples/datasets/upsert_dataset_experiments_example.py \
        --smoke-run

    # Live run (requires Phoenix server at PHOENIX_BASE_URL)
    uv run --python 3.10 python \
        packages/phoenix-client/examples/datasets/upsert_dataset_experiments_example.py
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Any

from phoenix.client import Client
from phoenix.client.experiments import run_experiment

DEFAULT_DATASET_NAME = "support-benchmark"

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

EXAMPLES_V2: list[dict[str, Any]] = [
    {
        "input": {"question": "What is AI?"},
        "output": {"answer": "Artificial Intelligence"},
        "metadata": {},
    },
    {
        "input": {"question": "What is RL?"},
        "output": {"answer": "..."},
        "metadata": {},
    },
]


@dataclass(frozen=True)
class _SmokeDataset:
    id: str
    version_id: str


@dataclass(frozen=True)
class _SmokeExperiment:
    experiment_id: str
    run_count: int


def task(input: dict[str, Any]) -> dict[str, str]:
    return {"answer": f"stub: {input['question']}"}


def _print_upsert_event(*, label: str, dataset_id: str, version_id: str) -> None:
    print(f"[{label}] dataset_id={dataset_id} version_id={version_id}")


def _print_experiment_event(
    *,
    label: str,
    experiment_name: str,
    experiment_id: str,
    dataset_version_id: str,
    run_count: int,
) -> None:
    print(
        f"[{label}] experiment_name={experiment_name} experiment_id={experiment_id} "
        f"dataset_version_id={dataset_version_id} run_count={run_count}"
    )


def _run_smoke() -> None:
    dataset_v1 = _SmokeDataset(id="dataset-smoke-1", version_id="version-smoke-1")
    exp_v1 = _SmokeExperiment(experiment_id="experiment-smoke-1", run_count=2)

    dataset_v2 = _SmokeDataset(id=dataset_v1.id, version_id="version-smoke-2")
    exp_v2 = _SmokeExperiment(experiment_id="experiment-smoke-2", run_count=2)

    _print_upsert_event(
        label="upsert:v1",
        dataset_id=dataset_v1.id,
        version_id=dataset_v1.version_id,
    )
    _print_experiment_event(
        label="experiment:v1",
        experiment_name="support-v1",
        experiment_id=exp_v1.experiment_id,
        dataset_version_id=dataset_v1.version_id,
        run_count=exp_v1.run_count,
    )

    _print_upsert_event(
        label="upsert:v2",
        dataset_id=dataset_v2.id,
        version_id=dataset_v2.version_id,
    )
    _print_experiment_event(
        label="experiment:v2",
        experiment_name="support-v2",
        experiment_id=exp_v2.experiment_id,
        dataset_version_id=dataset_v2.version_id,
        run_count=exp_v2.run_count,
    )

    print(
        "Note: with hash-only mirror semantics, a content edit is represented "
        "as DELETE(old hash) + CREATE(new hash)."
    )


def _run_live(*, dataset_name: str) -> None:
    client = Client()

    dataset_v1 = client.datasets.upsert_dataset(
        dataset=dataset_name,
        examples=EXAMPLES_V1,
    )
    _print_upsert_event(
        label="upsert:v1",
        dataset_id=dataset_v1.id,
        version_id=dataset_v1.version_id,
    )

    exp_v1 = run_experiment(
        client=client,
        dataset=dataset_v1,
        task=task,
        experiment_name="support-v1",
        dry_run=True,
        print_summary=False,
    )
    _print_experiment_event(
        label="experiment:v1",
        experiment_name="support-v1",
        experiment_id=exp_v1["experiment_id"],
        dataset_version_id=dataset_v1.version_id,
        run_count=len(exp_v1["task_runs"]),
    )

    dataset_v2 = client.datasets.upsert_dataset(
        dataset=dataset_name,
        examples=EXAMPLES_V2,
    )
    _print_upsert_event(
        label="upsert:v2",
        dataset_id=dataset_v2.id,
        version_id=dataset_v2.version_id,
    )

    exp_v2 = run_experiment(
        client=client,
        dataset=dataset_v2,
        task=task,
        experiment_name="support-v2",
        dry_run=True,
        print_summary=False,
    )
    _print_experiment_event(
        label="experiment:v2",
        experiment_name="support-v2",
        experiment_id=exp_v2["experiment_id"],
        dataset_version_id=dataset_v2.version_id,
        run_count=len(exp_v2["task_runs"]),
    )

    print(
        "Note: with hash-only mirror semantics, a content edit is represented "
        "as DELETE(old hash) + CREATE(new hash)."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset-name",
        default=DEFAULT_DATASET_NAME,
        help=f"Dataset name to upsert (default: {DEFAULT_DATASET_NAME}).",
    )
    parser.add_argument(
        "--smoke-run",
        action="store_true",
        help="Run a local smoke flow without network calls.",
    )
    args = parser.parse_args()

    if args.smoke_run:
        _run_smoke()
    else:
        _run_live(dataset_name=args.dataset_name)


if __name__ == "__main__":
    main()
