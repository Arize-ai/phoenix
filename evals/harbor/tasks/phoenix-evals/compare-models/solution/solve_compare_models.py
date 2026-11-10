#!/usr/bin/env python3
"""Reference solution: both models on the whole dataset, two repetitions each.

The oracle makes no model calls. Its stand-in for Haiku misses some references and its
stand-in for Sonnet returns them all, so Sonnet wins by a clear margin.
"""

from __future__ import annotations

from typing import Any

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.phoenix_api import client, write_answer


def haiku(expected: dict[str, Any], metadata: dict[str, Any]) -> str:
    reference = sql.reference_text(expected)
    return "SELECT 1;" if int(metadata["id"]) % 3 == 0 else reference


def sonnet(expected: dict[str, Any]) -> str:
    return sql.reference_text(expected)


def exact_match(output: Any, expected: dict[str, Any]) -> float:
    return float(sql.exact_match(output, expected))


def main() -> None:
    phoenix = client()
    dataset = phoenix.datasets.get_dataset(dataset=sql.DATASET)
    for name, task in (("claude-haiku-5-5", haiku), ("claude-sonnet-5-5", sonnet)):
        phoenix.experiments.run_experiment(
            dataset=dataset,
            task=task,
            evaluators=[exact_match],
            experiment_name=name,
            experiment_metadata={"model": name},
            repetitions=2,
        )
    write_answer(
        "Move to claude-sonnet-5-5: it matched every reference, while claude-haiku-5-5 missed "
        "about a third of the questions in both repetitions."
    )


if __name__ == "__main__":
    main()
