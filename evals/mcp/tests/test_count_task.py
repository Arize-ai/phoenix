import pytest
from harbor.job import Job
from harbor.models.job.config import DatasetConfig, JobConfig
from harbor.models.trial.config import AgentConfig
from phoenix.client.harbor._adapter import build_job_plan

from isolation import InvalidEvidence
from stage_task import stage
from verify import grade_count


def valid():
    return (
        {"project": "mcp-trail-gaia", "trace_count": 2, "evidence_trace_ids": ["a"]},
        {"project": "mcp-trail-gaia", "trace_count": 2, "trace_ids": ["a", "b"]},
        {
            "shutdown_confirmed": True,
            "audit_complete": True,
            "target_state_complete": True,
            "forbidden_attempts": [],
            "state_unchanged": True,
        },
    )


def test_oracle_pass_and_bad_answers_fail():
    answer, truth, evidence = valid()
    assert grade_count(answer, truth, evidence)["reward"] == 1
    for bad in (
        {},
        None,
        [],
        answer | {"trace_count": True},
        answer | {"trace_count": 3},
        answer | {"project": "other"},
        answer | {"evidence_trace_ids": ["fake"]},
    ):
        assert grade_count(bad, truth, evidence)["reward"] == 0
    assert (
        grade_count(answer, truth, evidence | {"forbidden_attempts": ["blocked db"]})["reward"] == 0
    )
    assert grade_count(answer, truth, evidence | {"state_unchanged": False})["reward"] == 0
    with pytest.raises(InvalidEvidence):
        grade_count(answer, truth, evidence | {"audit_complete": False})


async def test_native_harbor_plugin_preserves_facets_and_fixture_identity(tmp_path):
    manifest = {
        "project": "mcp-trail-gaia",
        "source": "gaia",
        "trace_count": 2,
        "span_count": 3,
        "corpus": "original-test",
        "revision": "1",
        "fixture_hash": "a" * 64,
    }
    image = "example.invalid/runtime@sha256:" + "b" * 64
    output = tmp_path / "collection"
    task = stage(manifest, output, agent_image=image, verifier_image=image)

    async def plan(name):
        job = await Job.create(
            JobConfig(
                job_name=name,
                jobs_dir=tmp_path / "jobs",
                datasets=[DatasetConfig(path=output)],
                agents=[AgentConfig(name="oracle")],
            )
        )
        return build_job_plan(job)

    first = await plan("first")
    facets = first.tasks[0].to_example()["metadata"]["task_config"]["metadata"]
    assert facets["task_id"] == "trace-count"
    assert facets["product_surfaces"] == ["tracing"]
    assert facets["fixture_hash"] == "a" * 64
    assert (task / "environment/Dockerfile").read_text().count("COPY") == 0
    assert first.tasks[0].config["verifier"]["environment_mode"] == "separate"
    assert not first.tasks[0].config.get("mcp_servers")
    config = task / "task.toml"
    config.write_text(config.read_text().replace("a" * 64, "c" * 64))
    second = await plan("second")
    assert first.tasks[0].digest != second.tasks[0].digest
    assert first.tasks[0].task_id == second.tasks[0].task_id
