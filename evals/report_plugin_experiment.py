"""Import a completed Claude eval report as Phoenix experiments, without rerunning models."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from evals.skill_regression import coverage, plugin_contract_errors


def report(client: Any, result: dict[str, Any], suite: str, model: str) -> list[str]:
    if result.get("schemaVersion") != 1 or result.get("partial") or not result.get("cases"):
        raise ValueError("Only complete schemaVersion=1 reports can be published")
    if errors := plugin_contract_errors(result, suite):
        raise ValueError("; ".join(errors))
    for case in result["cases"]:
        for arm in ("with", "without"):
            if not case.get("arms", {}).get(arm):
                raise ValueError(f"Missing {arm} arm for {case['name']}")
    skill = coverage()["plugin_suites"][suite]["skill"]
    common = {"harness": "claude-plugin", "skill": skill, "model": model, "suite": suite}
    dataset = client.datasets.create_dataset(
        name=f"phoenix-skills-plugin-{suite}",
        examples=[
            {
                "id": str(uuid5(NAMESPACE_URL, f"phoenix/skill-evals/{suite}/{case['name']}")),
                "input": {"case": case["name"], "prompt": case["promptMarkdown"]},
                "output": {"graders": case["graders"]},
                "metadata": {
                    "harness": "claude-plugin",
                    "skill": skill,
                    "suite": suite,
                    "case": case["name"],
                },
            }
            for case in result["cases"]
        ],
        dataset_description="Claude plugin skill eval cases. Stable IDs; grader definitions are versioned with the dataset.",
    )
    # Dataset UUIDs preserve identity across imports; run APIs require Relay node IDs.
    # Older servers returned the node ID in "id", before adding "node_id".
    example_ids = {
        example["input"]["case"]: example.get("node_id") or example["id"]
        for example in dataset.examples
    }
    experiments = []
    for arm in ("with", "without"):
        repetitions = max(len(case.get("arms", {}).get(arm, [])) for case in result["cases"])
        if not repetitions:
            raise ValueError(f"Missing {arm} arm")
        experiment = client.experiments.create(
            dataset_id=dataset.id,
            dataset_version_id=dataset.version_id,
            experiment_name=f"{suite}-{arm}-{result['startedAt']}",
            experiment_metadata={**common, "arm": arm, "claude_version": result["claudeVersion"]},
            repetitions=repetitions,
        )
        experiments.append(experiment["id"])
        for case in result["cases"]:
            definitions = {g["name"]: g for g in case["graders"]}
            for repetition, run in enumerate(case["arms"][arm], 1):
                start = datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00"))
                error = run.get("error") or (
                    json.dumps(run["aborted"]) if run.get("aborted") else None
                )
                if run.get("skippedPaidGraders"):
                    error = error or "Paid graders skipped"
                record = client.experiments.log_run(
                    experiment_id=experiment["id"],
                    dataset_example_id=example_ids[case["name"]],
                    repetition_number=repetition,
                    start_time=start,
                    end_time=start + timedelta(seconds=run["durationSeconds"]),
                    output={
                        "case": case["name"],
                        "arm": arm,
                        "score": run["score"],
                        "graders": run["graders"],
                    },
                    error=error,
                )
                for grader in run["graders"]:
                    client.experiments.log_evaluation(
                        experiment_run_id=record["id"],
                        name=grader["name"],
                        annotator_kind="LLM"
                        if definitions[grader["name"]]["type"] in {"llm", "baseline"}
                        else "CODE",
                        score=float(grader["passed"]),
                        label="pass" if grader["passed"] else "fail",
                        explanation=grader.get("explanation"),
                        metadata={
                            **common,
                            "case": case["name"],
                            "arm": arm,
                            "grader": grader["name"],
                            "scored": grader.get("scored", True),
                        },
                    )
    return experiments


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", type=Path)
    parser.add_argument("--suite", choices=list(coverage()["plugin_suites"]), required=True)
    parser.add_argument("--model", required=True)
    args = parser.parse_args()
    from phoenix.client import Client

    result = json.loads(args.result.read_text(encoding="utf-8"))
    print(report(Client(), result, args.suite, args.model))


if __name__ == "__main__":
    main()
