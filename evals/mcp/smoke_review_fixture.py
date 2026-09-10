"""Add a small dataset/experiment fixture beside the existing TRAIL project."""

import json
import sqlite3
from pathlib import Path

import httpx
from phoenix.client import Client

PRIVATE = Path(__file__).resolve().parent / ".private"
NAME = "mcp-trail-review"


def main():
    output = PRIVATE / "review-fixture.json"
    if output.exists():
        raise ValueError("Review fixture already prepared; reuse its recorded IDs")
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
        cursor = None
        while True:
            page = (
                api.get("/v1/datasets", params={"cursor": cursor} if cursor else {})
                .raise_for_status()
                .json()
            )
            if any(d["name"] == NAME for d in page["data"]):
                raise ValueError("Dataset already exists; refusing to alter or recreate it")
            if not (cursor := page.get("next_cursor")):
                break
        client = Client(base_url="http://localhost:6006")
        dataset = client.datasets.create_dataset(
            name=NAME,
            inputs=[
                {"trace_id": trace_id, "review": name}
                for name in ("structure", "annotations", "diagnosis")
            ],
            outputs=[{}, {}, {}],
            metadata=[{"fixture": "mcp-trail-review-v1"}] * 3,
            dataset_description="Synthetic outcomes for three inspections of one TRAIL trace.",
        )
        # Persist IDs immediately so an interrupted setup cannot silently create duplicates.
        fixture = {"dataset_id": dataset.id, "dataset_version_id": dataset.version_id}
        output.write_text(json.dumps(fixture, indent=2))
        experiment = (
            api.post(
                f"/v1/datasets/{dataset.id}/experiments",
                json={
                    "name": "TRAIL review · diagnostic fixture",
                    "description": "Synthetic fixture: two completed reviews and one timeout.",
                    "version_id": dataset.version_id,
                    "metadata": {"fixture": "mcp-trail-review-v1"},
                },
            )
            .raise_for_status()
            .json()["data"]
        )
        fixture["experiment_id"] = experiment["id"]
        output.write_text(json.dumps(fixture, indent=2))
        failures = []
        for index, example in enumerate(dataset.examples):
            error = "Review timed out before producing a diagnosis" if index == 2 else None
            run = (
                api.post(
                    f"/v1/experiments/{experiment['id']}/runs",
                    json={
                        "dataset_example_id": example["node_id"],
                        "output": {"reviewed": True} if error is None else None,
                        "error": error,
                        "repetition_number": 1,
                        "start_time": "2026-09-09T00:00:00Z",
                        "end_time": "2026-09-09T00:00:01Z",
                    },
                )
                .raise_for_status()
                .json()["data"]
            )
            if error:
                failures.append(
                    {"run_id": run["id"], "example_id": example["node_id"], "error": error}
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
                    "dataset_id": dataset.id,
                    "dataset_version_id": dataset.version_id,
                    "example_count": 3,
                    "experiment_id": experiment["id"],
                    "successful_run_count": 2,
                    "failed_run_count": 1,
                    "failed_runs": failures,
                },
            },
        }
        output.write_text(json.dumps(fixture, indent=2))
        print(json.dumps({k: v for k, v in fixture.items() if k != "references"}, indent=2))


if __name__ == "__main__":
    main()
