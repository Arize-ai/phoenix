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
            selected = [e for e in all_experiments if e["name"] == sample.name + "-" + condition]
            if len(selected) != 1:
                raise RuntimeError("Missing or duplicate condition experiment")
            experiment = selected[0]
            experiment_id = experiment["id"]
            runs = list(pages(client, f"/v1/experiments/{experiment_id}/runs"))
            if len(runs) != 1 or runs[0]["error"] or runs[0]["repetition_number"] != 1:
                raise RuntimeError("Expected one completed run with no infrastructure error")
            trace_id = runs[0]["trace_id"]
            traces = [
                t
                for t in pages(
                    client,
                    f"/v1/projects/{experiment['project_name']}/traces",
                    include_spans="true",
                )
                if t["trace_id"] == trace_id
            ]
            if len(traces) != 1 or not traces[0]["spans"]:
                raise RuntimeError("Run has no stored ATIF trace spans")
            records = client.get(f"/v1/experiments/{experiment_id}/json").raise_for_status().json()
            scores = {a["name"]: a["score"] for a in records[0]["annotations"]}
            required = {
                "reward",
                "infra_ok",
                "answer_complete",
                "answer_correct",
                "evidence_valid",
                "scope_preserved",
                "access_policy_ok",
                "task_completeness",
            }
            if required != scores.keys() or scores["infra_ok"] != 1:
                raise RuntimeError("Expected complete native verifier and completeness evaluations")
            examples = (
                client.get(
                    f"/v1/datasets/{dataset_id}/examples",
                    params={"version_id": experiment["dataset_version_id"]},
                )
                .raise_for_status()
                .json()["data"]["examples"]
            )
            if len(examples) != 1 or examples[0]["node_id"] != runs[0]["dataset_example_id"]:
                raise RuntimeError("Experiment does not reference the expected dataset example")
            facets = TaskMetadata.model_validate(examples[0]["metadata"]["task_config"]["metadata"])
            trusted = sample / condition / "trusted"
            truth = json.loads((trusted / "truth.json").read_text())
            payload = json.loads((sample.parent / "trail/payload.json").read_text())
            state = check_fixture(truth, payload)
            persisted = json.loads((trusted / "state.json").read_text())
            if state != persisted["before"] or state != persisted["after"]:
                raise RuntimeError("Fixture changed after verification")
            checked.append(
                {
                    "condition": condition,
                    "experiment_id": experiment_id,
                    "dataset_version_id": experiment["dataset_version_id"],
                    "run_id": runs[0]["id"],
                    "trace_id": trace_id,
                    "span_count": len(traces[0]["spans"]),
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
