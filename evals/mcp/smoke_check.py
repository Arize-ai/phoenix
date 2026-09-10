"""Read Phoenix records back after a sample; never create replacement exports."""

import argparse
import json
from pathlib import Path

import httpx

from metadata import TaskMetadata
from smoke_run import check_fixture


def pages(client, path, **params):
    while True:
        body = client.get(path, params=params).raise_for_status().json()
        yield from body["data"]
        if not body.get("next_cursor"):
            return
        params["cursor"] = body["next_cursor"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sample", type=Path)
    parser.add_argument("--condition", action="append")
    args = parser.parse_args()
    sample = args.sample.resolve()
    plan = json.loads((sample / "planned.json").read_text())
    with httpx.Client(base_url="http://localhost:6006", timeout=60) as client:
        datasets = [d for d in pages(client, "/v1/datasets") if d["name"] == "phoenix-mcp-smoke"]
        if len(datasets) != 1:
            raise RuntimeError("Expected exactly one native Harbor dataset")
        dataset_id = datasets[0]["id"]
        all_experiments = list(pages(client, f"/v1/datasets/{dataset_id}/experiments"))
        checked = []
        for condition in args.condition or plan["conditions"]:
            selected = [
                e
                for e in all_experiments
                if e["metadata"].get("harbor_job_name") == sample.name + "-" + condition
            ]
            if len(selected) != 1:
                raise RuntimeError("Missing or duplicate condition experiment")
            experiment = selected[0]
            experiment_id = experiment["id"]
            runs = list(pages(client, f"/v1/experiments/{experiment_id}/runs"))
            task_names = plan.get("tasks", [plan.get("task", "trace-count")])
            if len(runs) != len(task_names) or any(
                run["error"] or run["repetition_number"] != 1 for run in runs
            ):
                raise RuntimeError(
                    "Expected one completed run per task with no infrastructure error"
                )
            traces = {
                t["trace_id"]: t
                for t in pages(
                    client,
                    f"/v1/projects/{experiment['project_name']}/traces",
                    include_spans="true",
                )
            }
            records = client.get(f"/v1/experiments/{experiment_id}/json").raise_for_status().json()
            examples = (
                client.get(
                    f"/v1/datasets/{dataset_id}/examples",
                    params={"version_id": experiment["dataset_version_id"]},
                )
                .raise_for_status()
                .json()["data"]["examples"]
            )
            if len(examples) != len(task_names) or {e["node_id"] for e in examples} != {
                r["dataset_example_id"] for r in runs
            }:
                raise RuntimeError("Experiment does not reference the expected dataset examples")
            local = json.loads((sample / condition / "result.json").read_text())
            for run in runs:
                trace_id = run["trace_id"]
                if trace_id not in traces or not traces[trace_id]["spans"]:
                    raise RuntimeError("Run has no stored ATIF trace spans")
                record = next(r for r in records if r["example_id"] == run["dataset_example_id"])
                scores = {a["name"]: a["score"] for a in record["annotations"]}
                required = {
                    "reward",
                    "infra_ok",
                    "answer_complete",
                    "answer_correct",
                    "evidence_valid",
                    "scope_preserved",
                    "access_policy_ok",
                }
                if not required <= scores.keys() or scores["infra_ok"] != 1:
                    raise RuntimeError(
                        "Expected complete native verifier and completeness evaluations"
                    )
                example = next(e for e in examples if e["node_id"] == run["dataset_example_id"])
                facets = TaskMetadata.model_validate(example["metadata"]["task_config"]["metadata"])
                if facets.task_id not in task_names:
                    raise RuntimeError("Unexpected task in the experiment")
                trial = next(
                    t for t in local["trial_results"] if t["task_name"] == "arize/" + facets.task_id
                )
                trusted = sample / condition / "trusted" / trial["trial_name"]
                if not trusted.exists():
                    trusted = trusted.parent  # Original single-task artifacts.
                local_scores = trial["verifier_result"]["rewards"]
                if scores != local_scores | {"infra_ok": 1}:
                    raise RuntimeError("Stored evaluations differ from terminal verifier rewards")
                truth = json.loads((trusted / "truth.json").read_text())
                payload = json.loads((sample.parent / "trail/payload.json").read_text())
                fixture_path = sample / "review-fixture.json"
                review = json.loads(fixture_path.read_text()) if fixture_path.exists() else None
                state = check_fixture(truth, payload, review)
                persisted = json.loads((trusted / "state.json").read_text())
                # The initial count runs predate the additive review fixture.
                if "review_sha256" not in persisted["before"]:
                    state.pop("review_sha256", None)
                if state != persisted["before"] or state != persisted["after"]:
                    raise RuntimeError("Fixture changed after verification")
                checked.append(
                    {
                        "condition": condition,
                        "task": facets.task_id,
                        "experiment_name": experiment["name"],
                        "experiment_id": experiment_id,
                        "dataset_version_id": experiment["dataset_version_id"],
                        "run_id": run["id"],
                        "trace_id": trace_id,
                        "span_count": len(traces[trace_id]["spans"]),
                        "scores": scores,
                        "facets": facets.model_dump(mode="json"),
                        "url": f"http://localhost:6006/datasets/{dataset_id}/experiments/{experiment_id}",
                    }
                )
        report = {"dataset_id": dataset_id, "checked": checked}
        (sample / "phoenix-check.json").write_text(json.dumps(report, indent=2))
        print(
            json.dumps(
                {
                    "dataset_id": dataset_id,
                    "conditions": [{k: v for k, v in c.items() if k != "facets"} for c in checked],
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
