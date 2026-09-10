"""Add a small dataset/experiment fixture beside the existing TRAIL project."""

import json
import sqlite3
import uuid
from pathlib import Path

import httpx
from phoenix.client import Client

from smoke_state import snapshot, snapshot_review

PRIVATE = Path(__file__).resolve().parent / ".private"
NAME = "mcp-trail-review"


def save(output: Path, fixture: dict) -> None:
    # Atomic checkpoints preserve the last complete IDs if the process is interrupted.
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(fixture, indent=2))
    temporary.replace(output)


def pages(api, path):
    cursor = None
    while True:
        page = api.get(path, params={"cursor": cursor} if cursor else {}).raise_for_status().json()
        yield from page["data"]
        if not (cursor := page.get("next_cursor")):
            break


def prepare_resources(api, client, output: Path, trace_id: str):
    """Resume additive setup, including a lost response after a successful POST."""
    fixture = json.loads(output.read_text()) if output.exists() else {"setup_id": uuid.uuid4().hex}
    save(output, fixture)
    metadata = {"fixture": "mcp-trail-review-v1"}
    if fixture.get("setup_id"):
        metadata["setup_id"] = fixture["setup_id"]
    matches = [d for d in pages(api, "/v1/datasets") if d["name"] == NAME]
    if len(matches) > 1:
        raise ValueError("Ambiguous review dataset")
    if not matches:
        if fixture.get("dataset_id"):
            raise ValueError("Recorded fixture dataset is missing")
        dataset = client.datasets.create_dataset(
            name=NAME,
            inputs=[
                {"trace_id": trace_id, "review": name}
                for name in ("structure", "annotations", "diagnosis")
            ],
            outputs=[{}, {}, {}],
            metadata=[metadata] * 3,
            dataset_description="Synthetic outcomes for three inspections of one TRAIL trace.",
        )
    else:
        if fixture.get("dataset_id", matches[0]["id"]) != matches[0]["id"]:
            raise ValueError("Recorded dataset identity differs")
        dataset = client.datasets.get_dataset(dataset={"id": matches[0]["id"]})
    examples = dataset.examples
    roles = {example["input"].get("review"): example for example in examples}
    if (
        len(examples) != 3
        or set(roles) != {"structure", "annotations", "diagnosis"}
        or any(
            example["input"] != {"trace_id": trace_id, "review": role}
            or example["output"] != {}
            or example["metadata"] != metadata
            for role, example in roles.items()
        )
    ):
        raise ValueError("Existing dataset does not match this setup's fixture")
    if fixture.get("dataset_version_id", dataset.version_id) != dataset.version_id:
        raise ValueError("Fixture dataset version changed")
    fixture |= {"dataset_id": dataset.id, "dataset_version_id": dataset.version_id}
    save(output, fixture)
    experiments = list(pages(api, f"/v1/datasets/{dataset.id}/experiments"))
    if len(experiments) > 1:
        raise ValueError("Unexpected experiments in fixture dataset")
    if experiments:
        experiment = experiments[0]
        if (
            experiment["metadata"] != metadata
            or experiment["dataset_version_id"] != dataset.version_id
            or fixture.get("experiment_id", experiment["id"]) != experiment["id"]
        ):
            raise ValueError("Existing experiment does not match the fixture")
    else:
        if fixture.get("experiment_id"):
            raise ValueError("Recorded experiment is missing")
        experiment = (
            api.post(
                f"/v1/datasets/{dataset.id}/experiments",
                json={
                    "name": "TRAIL review · diagnostic fixture",
                    "description": "Synthetic fixture: two completed reviews and one timeout.",
                    "version_id": dataset.version_id,
                    "metadata": metadata,
                },
            )
            .raise_for_status()
            .json()["data"]
        )
    fixture["experiment_id"] = experiment["id"]
    save(output, fixture)
    runs = list(pages(api, f"/v1/experiments/{experiment['id']}/runs"))
    if len({run["dataset_example_id"] for run in runs}) != len(runs) or any(
        run["dataset_example_id"] not in {example["node_id"] for example in examples}
        for run in runs
    ):
        raise ValueError("Unexpected fixture runs")
    failures = []
    for role, example in roles.items():
        error = "Review timed out before producing a diagnosis" if role == "diagnosis" else None
        expected = {
            "dataset_example_id": example["node_id"],
            "output": {"reviewed": True} if error is None else None,
            "error": error,
            "repetition_number": 1,
        }
        run = next((r for r in runs if r["dataset_example_id"] == example["node_id"]), None)
        if run is None:
            run = (
                api.post(
                    f"/v1/experiments/{experiment['id']}/runs",
                    json=expected
                    | {
                        "start_time": "2026-09-09T00:00:00Z",
                        "end_time": "2026-09-09T00:00:01Z",
                    },
                )
                .raise_for_status()
                .json()["data"]
            )
        elif any(run[key] != value for key, value in expected.items()):
            raise ValueError("Existing run differs from the expected fixture")
        if error:
            failures.append({"run_id": run["id"], "example_id": example["node_id"], "error": error})
    return fixture, failures


def main():
    output = PRIVATE / "review-fixture.json"
    with sqlite3.connect(f"file:{Path.home()}/.phoenix/phoenix.db?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        spans = [
            dict(row)
            for row in db.execute(
                "SELECT s.* FROM spans s JOIN traces t ON t.id=s.trace_rowid "
                "JOIN projects p ON p.id=t.project_rowid "
                "WHERE p.name='mcp-trail-gaia' AND t.trace_id=? ORDER BY s.id",
                ("29b394777166073ec59839298bd6abe7",),
            )
        ]
        annotations = [
            dict(row)
            for row in db.execute(
                "SELECT a.*, s.span_id FROM span_annotations a JOIN spans s ON s.id=a.span_rowid "
                "JOIN traces t ON t.id=s.trace_rowid JOIN projects p ON p.id=t.project_rowid "
                "WHERE p.name='mcp-trail-gaia' AND t.trace_id=? ORDER BY a.id",
                ("29b394777166073ec59839298bd6abe7",),
            )
        ]
    if len(spans) != 11 or len(annotations) != 4:
        raise ValueError("Expected the pinned short annotated TRAIL trace")
    trace_id = "29b394777166073ec59839298bd6abe7"
    chosen = sorted(annotations, key=lambda a: (len(a["explanation"]), a["id"]))[0]
    selected = [a for a in annotations if a["span_id"] == chosen["span_id"]]
    with httpx.Client(base_url="http://localhost:6006", timeout=60) as api:
        fixture, failures = prepare_resources(
            api, Client(base_url="http://localhost:6006"), output, trace_id
        )
        fixture |= {
            "trace_id": trace_id,
            "span_id": chosen["span_id"],
            "references": {
                "trace-review": {
                    "trace_id": trace_id,
                    "span_count": len(spans),
                    "root_span_ids": sorted(s["span_id"] for s in spans if not s["parent_id"]),
                    "annotated_span_ids": sorted({a["span_id"] for a in annotations}),
                },
                "annotation-review": {
                    "span_id": chosen["span_id"],
                    "annotations": [
                        {k: a[k] for k in ("name", "label", "score", "explanation")}
                        for a in selected
                    ],
                },
                "experiment-review": {
                    "dataset_id": fixture["dataset_id"],
                    "dataset_version_id": fixture["dataset_version_id"],
                    "example_count": 3,
                    "experiment_id": fixture["experiment_id"],
                    "successful_run_count": 2,
                    "failed_run_count": 1,
                    "failed_runs": failures,
                },
            },
        }
        database = Path.home() / ".phoenix/phoenix.db"
        expected = snapshot_review(database, fixture)
        tracing = snapshot(database, "mcp-trail-gaia")["sha256"]
        if (
            fixture.get("expected_state_sha256", expected) != expected
            or fixture.get("expected_trace_sha256", tracing) != tracing
        ):
            raise ValueError("Prepared fixture changed; refusing to replace its frozen state")
        fixture |= {"expected_state_sha256": expected, "expected_trace_sha256": tracing}
        save(output, fixture)
        print(json.dumps({k: v for k, v in fixture.items() if k != "references"}, indent=2))


if __name__ == "__main__":
    main()
