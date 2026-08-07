from __future__ import annotations

import argparse
import random
import time
import uuid
from typing import Any

import pandas as pd
from phoenix.client import Client
from phoenix.client.experiments import create_evaluator

try:
    from ._shared import add_common_arguments, clamp_score, examples, probability
except ImportError:  # Support direct execution from this directory.
    from _shared import add_common_arguments, clamp_score, examples, probability


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Seed a large experiment for pagination and mixed-result UI testing."
    )
    add_common_arguments(parser, default_examples=300)
    parser.add_argument("--experiment-name", default="pagination-fixture")
    parser.add_argument("--evaluator-error-rate", type=probability, default=0.15)
    parser.add_argument(
        "--max-latency",
        type=float,
        default=0.1,
        help="Maximum simulated task latency in seconds (default: 0.1).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.max_latency < 0:
        raise ValueError("--max-latency must be non-negative")
    rng = random.Random(args.seed)
    dataset_rows = examples(args.examples, rng)
    dataset_name = args.dataset_name or f"pagination-experiment-{uuid.uuid4()}"
    if args.dry_run:
        print(f"dataset={dataset_name}")
        print(f"examples={len(dataset_rows)}")
        print(f"experiment={args.experiment_name}")
        print("dry_run=true")
        return 0

    client = Client(base_url=args.endpoint)
    dataset = client.datasets.create_dataset(
        name=dataset_name,
        dataframe=pd.DataFrame(dataset_rows),
        input_keys=["question"],
        output_keys=["answer"],
        metadata_keys=["metadata"],
    )

    def answer_question(input: dict[str, Any], expected: dict[str, Any]) -> str:
        time.sleep(rng.uniform(0, args.max_latency))
        return str(expected["answer"])

    @create_evaluator(name="quality", kind="code")
    def quality(
        input: dict[str, Any],
        output: str,
        expected: dict[str, Any],
        metadata: dict[str, Any],
    ) -> float:
        difficulty = metadata.get("difficulty", "medium")
        bias = {"easy": 0.86, "medium": 0.72, "hard": 0.58}.get(difficulty, 0.7)
        return clamp_score(rng.gauss(bias, 0.1))

    @create_evaluator(name="groundedness", kind="code")
    def groundedness(input: dict[str, Any], output: str, expected: dict[str, Any]) -> float:
        if rng.random() < args.evaluator_error_rate:
            raise RuntimeError("Synthetic evaluator timeout")
        return clamp_score(rng.gauss(0.74, 0.12))

    experiment = client.experiments.run_experiment(
        dataset=dataset,
        task=answer_question,
        experiment_name=args.experiment_name,
        evaluators=[quality, groundedness],
    )
    print(f"dataset={dataset_name}")
    print(f"experiment={experiment}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
