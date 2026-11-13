"""Check the newest experiment on `support-qa` and its `contains_expected` scores.

The reward is 1 only when every check passes:

- An experiment exists on the dataset.
- It has a task run for every example.
- Every run that produced an output has a `contains_expected` score.
- Each score matches a case-insensitive substring check of that run's output.
- At least `MIN_CORRECT` runs score 1, so the outputs came from the bot.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from harbor_verifiers import phoenix_api, skills
from harbor_verifiers.verify import read_trajectory, write_reward

DATASET = "support-qa"
EVALUATOR = "contains_expected"
EXPECTED = json.loads(Path("/tests/expected.json").read_text())
# The bot answers 7 of the 10 questions correctly; one more run fails on a rate limit.
MIN_CORRECT = 6


def score_of(evaluation: Any) -> float | None:
    result = evaluation.result
    if isinstance(result, list):
        result = result[0] if result else None
    return None if not result or result.get("score") is None else float(result["score"])


def grade() -> tuple[dict[str, bool], dict[str, Any]]:
    client = phoenix_api.client()
    dataset = client.datasets.get_dataset(dataset=DATASET)
    expected = {example["id"]: example["output"]["expected"] for example in dataset.examples}
    experiments = sorted(
        client.experiments.list(dataset_id=dataset.id), key=lambda e: e["created_at"]
    )
    if not experiments:
        return {"experiment_exists": False}, {}
    experiment = client.experiments.get_experiment(experiment_id=experiments[-1]["id"])
    runs = {run["id"]: run for run in experiment["task_runs"]}
    scores = {
        e.experiment_run_id: score_of(e)
        for e in experiment["evaluation_runs"]
        if e.name == EVALUATOR
    }
    answered = [run for run in runs.values() if not run.get("error")]
    consistent = all(
        scores.get(run["id"])
        == float(expected[run["dataset_example_id"]].lower() in str(run["output"]).lower())
        for run in answered
    )
    checks = {
        "experiment_exists": True,
        "every_example_ran": {run["dataset_example_id"] for run in runs.values()} == set(expected),
        "every_answer_scored": bool(answered)
        and all(scores.get(r["id"]) is not None for r in answered),
        "scores_match_outputs": consistent,
        "bot_outputs": sum(scores.get(r["id"]) == 1.0 for r in answered) >= MIN_CORRECT,
    }
    return checks, {"experiment": experiments[-1]["name"], "scores": list(scores.values())}


def main() -> None:
    checks, facts = grade()
    loaded = skills.loaded_skills(read_trajectory(Path("/logs/agent/trajectory.json")))
    details = {"checks": checks, **facts}
    components: dict[str, Any] = {"loaded_skills": loaded}
    components.update(skills.skill_scores(loaded, EXPECTED))
    scores = write_reward(
        float(all(checks.values())),
        details,
        **components,
    )
    print(json.dumps({**details, "scores": scores}, default=str))


if __name__ == "__main__":
    main()
