import copy
import json
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
import toml
from harbor.job import Job
from harbor.models.job.config import DatasetConfig, JobConfig
from harbor.models.trial.config import AgentConfig
from phoenix.client.harbor._adapter import build_job_plan

from smoke_review_fixture import NAME, prepare_resources
from smoke_tasks import stage_review


@pytest.mark.parametrize("lost_response", ["dataset", "experiment", "run"])
def test_setup_recovers_committed_resources_after_lost_responses(tmp_path, lost_response):
    state = {"dataset": None, "experiments": [], "runs": [], "failed": False}

    def fail_once(stage):
        if stage == lost_response and not state["failed"]:
            state["failed"] = True
            raise httpx.ReadError("Response lost after commit")

    def create_dataset(**kwargs):
        state["dataset"] = SimpleNamespace(
            id="dataset",
            version_id="version",
            examples=[
                {
                    "node_id": f"example-{i}",
                    "input": value,
                    "output": kwargs["outputs"][i],
                    "metadata": kwargs["metadata"][i],
                }
                for i, value in enumerate(kwargs["inputs"])
            ],
        )
        fail_once("dataset")
        return state["dataset"]

    client = SimpleNamespace(
        datasets=SimpleNamespace(
            create_dataset=Mock(side_effect=create_dataset),
            get_dataset=Mock(side_effect=lambda **_: state["dataset"]),
        )
    )

    def handle(request):
        path = request.url.path
        if request.method == "GET":
            if path == "/v1/datasets":
                data = [{"id": "dataset", "name": NAME}] if state["dataset"] else []
            elif path.endswith("/experiments"):
                data = state["experiments"]
            else:
                data = state["runs"]
            return httpx.Response(200, json={"data": data, "next_cursor": None})
        body = json.loads(request.content)
        if path.endswith("/experiments"):
            data = body | {"id": "experiment", "dataset_version_id": body["version_id"]}
            state["experiments"].append(data)
            fail_once("experiment")
        else:
            data = body | {"id": f"run-{len(state['runs'])}"}
            state["runs"].append(data)
            fail_once("run")
        return httpx.Response(200, json={"data": data})

    output = tmp_path / "fixture.json"
    with httpx.Client(base_url="http://fixture.test", transport=httpx.MockTransport(handle)) as api:
        with pytest.raises(httpx.ReadError):
            prepare_resources(api, client, output, "trace")
        fixture, failures = prepare_resources(api, client, output, "trace")
        assert prepare_resources(api, client, output, "trace") == (fixture, failures)
        assert len(state["experiments"]) == 1
        assert len(state["runs"]) == 3
        assert len(failures) == 1
        assert client.datasets.create_dataset.call_count == 1
        state["runs"][0]["output"] = {"unexpected": True}
        with pytest.raises(ValueError, match="differs"):
            prepare_resources(api, client, output, "trace")
        assert len(state["runs"]) == 3


async def test_changed_review_truth_changes_native_task_identity(tmp_path):
    manifest = {
        "project": "mcp-trail-gaia",
        "source": "gaia",
        "trace_count": 1,
        "span_count": 2,
        "corpus": "original",
        "revision": "1",
        "fixture_hash": "a" * 64,
    }
    fixture = {
        "dataset_id": "dataset",
        "experiment_id": "experiment",
        "trace_id": "trace",
        "span_id": "span",
        "references": {"trace-review": {"span_count": 2}},
        "expected_state_sha256": "b" * 64,
        "expected_trace_sha256": "c" * 64,
    }
    image = "example.invalid/runtime@sha256:" + "d" * 64

    async def plan(name, value):
        tasks = stage_review(manifest, value, tmp_path / name, image=image)
        job = await Job.create(
            JobConfig(
                job_name=name,
                jobs_dir=tmp_path / "jobs",
                datasets=[DatasetConfig(path=tasks[0].parent)],
                agents=[AgentConfig(name="oracle")],
            )
        )
        return build_job_plan(job), toml.loads((tasks[0] / "task.toml").read_text())

    first, config = await plan("first", fixture)
    changed = copy.deepcopy(fixture)
    changed["references"]["trace-review"]["span_count"] = 3
    second, _ = await plan("second", changed)
    assert config["metadata"]["fixture_hash"] != manifest["fixture_hash"]
    assert [task.task_id for task in first.tasks] == [task.task_id for task in second.tasks]
    assert all(a.digest != b.digest for a, b in zip(first.tasks, second.tasks))
    changed = fixture | {"expected_state_sha256": "e" * 64}
    third, _ = await plan("third", changed)
    assert all(a.digest != b.digest for a, b in zip(first.tasks, third.tasks))


def test_check_fixture_rejects_between_run_drift(monkeypatch):
    import smoke_run

    truth = {"project": "test", "trace_count": 1, "trace_ids": ["t"], "span_ids": ["s"]}
    payload = {"span_annotations": [], "trace_annotations": []}
    state = {
        "project_id": 1,
        "trace_ids": ["t"],
        "span_ids": ["s"],
        "sha256": "trace-state",
        "counts": {
            "projects": 1,
            "traces": 1,
            "spans": 1,
            "span_annotations": 0,
            "trace_annotations": 0,
        },
    }
    monkeypatch.setattr(smoke_run, "snapshot", lambda *_: copy.deepcopy(state))
    monkeypatch.setattr(smoke_run, "validate_annotations", lambda *_: None)
    monkeypatch.setattr(smoke_run, "snapshot_review", lambda *_: "review-state")
    review = {"expected_state_sha256": "review-state", "expected_trace_sha256": "trace-state"}
    assert smoke_run.check_fixture(truth, payload, review)["review_sha256"] == "review-state"
    state["sha256"] = "changed"
    with pytest.raises(RuntimeError, match="frozen"):
        smoke_run.check_fixture(truth, payload, review)
