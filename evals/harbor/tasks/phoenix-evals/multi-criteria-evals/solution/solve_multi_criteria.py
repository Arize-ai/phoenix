#!/usr/bin/env python3
"""Reference solution: one evaluator per spec line, run as an experiment.

The oracle makes no model calls. Its task returns each example's reference with planted
defects, so every deterministic criterion has both passing and failing runs, and its two
semantic evaluators are deterministic stand-ins recorded with the LLM annotator kind.
"""

from __future__ import annotations

from typing import Any

from phoenix.client.experiments import create_evaluator

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.phoenix_api import client


def app(input: dict[str, Any], expected: dict[str, Any], metadata: dict[str, Any]) -> str:
    reference = sql.reference_text(expected)
    number = int(metadata.get("id", 0))
    if sql.should_refuse(expected):
        return "SELECT * FROM accounts;" if number % 5 == 0 else reference
    if number % 4 == 0:
        return reference.replace(metadata["user_id"], "usr_other99")
    if number % 3 == 0:
        return f"```sql\n{reference}\n```"
    return reference


def bare_read_only_query(output: Any) -> float:
    return float(sql.is_bare_read_only_query(output))


def user_scope(output: Any, metadata: dict[str, Any]) -> float:
    return float(sql.is_scoped_to_user(output, metadata))


def refuse_when_required(output: Any, expected: dict[str, Any]) -> float:
    return float(sql.refusal_matches(output, expected))


@create_evaluator(kind="LLM", name="answers_question")
def answers_question(output: Any, expected: dict[str, Any]) -> dict[str, Any]:
    same = sql.output_text(output).strip().strip("`").removeprefix("sql").strip()
    correct = same == sql.reference_text(expected)
    return {
        "label": "correct" if correct else "incorrect",
        "score": float(correct),
        "explanation": "Stand-in judgment: compares the query with the reference.",
    }


@create_evaluator(kind="LLM", name="polite_refusal")
def polite_refusal(output: Any) -> dict[str, Any]:
    return {
        "label": "polite",
        "score": 1.0,
        "explanation": "Stand-in judgment: the reference refusals are polite.",
    }


def main() -> None:
    phoenix = client()
    dataset = phoenix.datasets.get_dataset(dataset=sql.DATASET)
    phoenix.experiments.run_experiment(
        dataset=dataset,
        task=app,
        evaluators=[
            bare_read_only_query,
            user_scope,
            refuse_when_required,
            answers_question,
            polite_refusal,
        ],
        experiment_name="baseline",
    )


if __name__ == "__main__":
    main()
