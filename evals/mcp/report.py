"""Compound authored-facet filters and honest planned-trial coverage summaries."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from metadata import TaskMetadata


def example_facets(example: dict[str, Any]) -> TaskMetadata:
    # Native Phoenix Harbor plugin path. Public metadata contains no run observations.
    return TaskMetadata.model_validate(example["metadata"]["task_config"]["metadata"])


def matches(metadata: TaskMetadata, filters: dict[str, Any]) -> bool:
    fields = metadata.model_dump()
    unknown = set(filters) - set(fields)
    if unknown:
        raise ValueError(f"Unknown authored facets: {sorted(unknown)}")
    for key, expected in filters.items():
        actual = fields[key]
        if isinstance(actual, list):
            required = expected if isinstance(expected, list) else [expected]
            if not all(value in actual for value in required):
                return False
        elif actual != expected:
            return False
    return True


def summarize(
    examples: list[dict[str, Any]], planned: list[dict[str, Any]], *, filters: dict[str, Any]
) -> dict[str, Any]:
    authored = [example_facets(example) for example in examples]
    all_ids = [task.task_id for task in authored]
    if len(set(all_ids)) != len(all_ids):
        raise ValueError("Duplicate task metadata; export one frozen dataset version")
    if {trial["task_id"] for trial in planned} - set(all_ids):
        raise ValueError("Planned trials have missing task metadata")
    tasks = {task.task_id for task in authored if matches(task, filters)}
    selected = [trial for trial in planned if trial["task_id"] in tasks]
    trial_ids = [trial["trial_id"] for trial in selected]
    if len(set(trial_ids)) != len(trial_ids):
        raise ValueError("Duplicate planned trial ID; retries belong in attempts")
    scores = [trial["reward"] for trial in selected if trial.get("reward") in (0, 1)]
    success = sum(score == 1 for score in scores)
    # Every physical attempt, including paid failures/retries, contributes known cost.
    attempts = [attempt for trial in selected for attempt in trial.get("attempts", [])]
    known_cost = [
        attempt["agent_cost_usd"]
        for attempt in attempts
        if attempt.get("agent_cost_usd") is not None
    ]
    if any(
        type(cost) not in (int, float) or not math.isfinite(cost) or cost < 0 for cost in known_cost
    ):
        raise ValueError("Agent cost must be finite, nonnegative, or missing")
    return {
        "metadata_schema_version": "1",
        "filters": filters,
        "task_count": len(tasks),
        "planned_trials": len(selected),
        "scored_trials": len(scores),
        "missing_reward": len(selected) - len(scores),
        "successful_trials": success,
        "conditional_success_rate": success / len(scores) if scores else None,
        "unconditional_success_rate": success / len(selected) if selected else None,
        "known_agent_cost_usd": sum(known_cost) if known_cost else None,
        "attempts_with_cost": len(known_cost),
        "attempt_count": len(attempts),
        "trials_without_attempt_records": sum(not trial.get("attempts") for trial in selected),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--examples", type=Path, required=True)
    parser.add_argument("--planned", type=Path, required=True)
    parser.add_argument("--filters-file", type=Path, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            summarize(
                json.loads(args.examples.read_text()),
                json.loads(args.planned.read_text()),
                filters=json.loads(args.filters_file.read_text()),
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
