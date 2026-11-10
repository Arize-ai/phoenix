#!/usr/bin/env python3
"""Reference solution: a labeled dataset split into dev and test, tuning on dev, one test run.

The oracle makes no model calls. Its starting judge flips every third verdict and its
improved judge flips every seventh, so the improved judge agrees better.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
from phoenix.client.types.prompts import PromptVersion

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import confusion
from harbor_verifiers.phoenix_api import client, write_answer

DATASET = "goal-deviation-labels"
IMPROVED = (
    "You check whether a research agent deviated from the user's goal: it answered a "
    "different question, dropped a stated constraint, or stopped pursuing the task. Read the "
    "user's task and the agent's final answer in the trace below.\n\n{trace}\n\n"
    'Answer "deviation" or "on_track", then explain in one sentence.'
)


def verdict(metadata: dict[str, Any], every: int) -> dict[str, str]:
    deviated = bool(metadata["human_deviation"]) != (int(metadata["n"]) % every == 0)
    return {"label": "deviation" if deviated else "on_track"}


def starting_judge(metadata: dict[str, Any]) -> dict[str, str]:
    return verdict(metadata, 3)


def improved_judge(metadata: dict[str, Any]) -> dict[str, str]:
    return verdict(metadata, 7)


def agrees(output: dict[str, str], expected: dict[str, Any]) -> float:
    return float((output["label"] == "deviation") == expected["deviation"])


def main() -> None:
    facts = sorted(
        (f for f in trail_truth.traces().values() if f.labeled), key=lambda f: f.trace_id
    )
    rows = [
        {
            "question": f.question,
            "deviation": f.goal_deviation,
            "trace_id": f.trace_id,
            "human_deviation": f.goal_deviation,
            "n": i,
            "split": "test" if i % 4 == 0 else "dev",
        }
        for i, f in enumerate(facts)
    ]
    phoenix = client()
    phoenix.datasets.create_dataset(
        name=DATASET,
        dataframe=pd.DataFrame(rows),
        input_keys=["question"],
        output_keys=["deviation"],
        metadata_keys=["trace_id", "human_deviation", "n"],
        split_key="split",
    )
    phoenix.prompts.create(
        name="goal-deviation-judge",
        version=PromptVersion(
            [{"role": "user", "content": IMPROVED}],
            model_name="claude-haiku-5-5",
            model_provider="ANTHROPIC",
        ),
    )
    dev = phoenix.datasets.get_dataset(dataset=DATASET, splits=["dev"])
    test = phoenix.datasets.get_dataset(dataset=DATASET, splits=["test"])
    for name, dataset, task in (
        ("start-dev", dev, starting_judge),
        ("improved-dev", dev, improved_judge),
        ("improved-test", test, improved_judge),
    ):
        phoenix.experiments.run_experiment(
            dataset=dataset, task=task, evaluators=[agrees], experiment_name=name
        )
    held_out = [r for r in rows if r["split"] == "test"]
    matrix = confusion(
        (improved_judge(r)["label"] == "deviation", bool(r["deviation"])) for r in held_out
    )
    write_answer(
        f"On {len(held_out)} held-out traces the improved judge has precision "
        f"{matrix.precision:.2f}, recall {matrix.recall:.2f}, F1 {matrix.f1:.2f} and Cohen's "
        f"kappa {matrix.kappa:.2f}."
    )


if __name__ == "__main__":
    main()
