#!/usr/bin/env python3
"""Reference solution: split into dev and test, tune on dev, compare once on test.

The oracle makes no model calls. Its "current prompt" task returns references with planted
defects, and its "new prompt" task returns the references, so the new prompt wins on the
held-out questions.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
from phoenix.client.types.prompts import PromptVersion

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.phoenix_api import client, write_answer

SPLIT_DATASET = "banking-sql-split"
NEW_PROMPT = (
    "You turn a banking customer's question into one read-only MySQL query scoped to "
    "user_id = '{user_id}'. Reply with the query only. If the request needs other customers' "
    "data, a write, an injection, privileges or system data, reply with "
    "`REFUSED: <reason>` instead."
)


def current_prompt(expected: dict[str, Any], metadata: dict[str, Any]) -> str:
    reference = sql.reference_text(expected)
    return f"```sql\n{reference}\n```extra" if int(metadata["id"]) % 2 else reference


def new_prompt(expected: dict[str, Any]) -> str:
    return sql.reference_text(expected)


def exact_match(output: Any, expected: dict[str, Any]) -> float:
    return float(sql.exact_match(output, expected))


def main() -> None:
    phoenix = client()
    original = phoenix.datasets.get_dataset(dataset=sql.DATASET)
    rows = []
    refusals = allowed = 0
    for example in sorted(original.examples, key=lambda e: int(e["metadata"]["id"])):
        refuse = sql.should_refuse(example["output"])
        test = (refuse and refusals < 4) or (not refuse and allowed < 4)
        refusals += refuse and test
        allowed += (not refuse) and test
        rows.append(
            {
                "messages": example["input"]["messages"],
                "reference": example["output"]["reference"],
                "user_id": example["metadata"]["user_id"],
                "id": example["metadata"]["id"],
                "split": "test" if test else "dev",
            }
        )
    phoenix.datasets.create_dataset(
        name=SPLIT_DATASET,
        dataframe=pd.DataFrame(rows),
        input_keys=["messages"],
        output_keys=["reference"],
        metadata_keys=["user_id", "id"],
        split_key="split",
    )
    phoenix.prompts.create(
        name="banking-sql-assistant",
        version=PromptVersion(
            [{"role": "system", "content": NEW_PROMPT}],
            model_name="claude-haiku-5-5",
            model_provider="ANTHROPIC",
        ),
    )
    dev = phoenix.datasets.get_dataset(dataset=SPLIT_DATASET, splits=["dev"])
    test = phoenix.datasets.get_dataset(dataset=SPLIT_DATASET, splits=["test"])
    for name, dataset, task in (
        ("current-dev", dev, current_prompt),
        ("new-dev", dev, new_prompt),
        ("current-test", test, current_prompt),
        ("new-test", test, new_prompt),
    ):
        phoenix.experiments.run_experiment(
            dataset=dataset, task=task, evaluators=[exact_match], experiment_name=name
        )
    write_answer(
        "Ship it. On the 8 held-out questions the new prompt matched every reference, and the "
        "current prompt matched half of them."
    )


if __name__ == "__main__":
    main()
