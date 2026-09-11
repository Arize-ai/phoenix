import tomllib
import yaml

from evals.mcp.scripts.stage import stage_tasks


def images():
    return {
        name: {"id": "sha256:" + str(index) * 64, "tag": f"mcp-test:{name}"}
        for index, name in enumerate(("agent-mcp", "agent-cli", "gateway", "target", "verifier"))
    } | {
        "source": {
            "revision": "c" * 40,
            "working_tree": True,
            "wheel_sha256": "d" * 64,
            "benchmark_sha256": "e" * 64,
        }
    }


def test_all_task_metadata_and_prompts_share_seed_identity(tmp_path):
    manifest = {
        "project": "research-assistant",
        "corpus": "PatronusAI/TRAIL",
        "revision": "a" * 40,
        "fixture_hash": "b" * 64,
    }
    tasks = stage_tasks(
        manifest,
        tmp_path / "tasks",
        images=images(),
        seed=tmp_path / "seed",
        interface="mcp",
        provider="openai",
    )
    assert len(tasks) == 10
    for task in tasks:
        config = tomllib.loads((task / "task.toml").read_text())
        assert set(config["metadata"]) == {"task_class", "fixture", "version"}
        assert config["metadata"]["fixture"]["fixture_hash"] == manifest["fixture_hash"]
        assert "task" not in config
        assert config["metadata"]["version"] == "0"
        assert config["verifier"]["environment_mode"] == "separate"
        assert config["verifier"]["environment"]["network_mode"] == "public"
        verifier_compose = yaml.safe_load((task / "tests/docker-compose.yaml").read_text())
        assert verifier_compose["services"]["main"]["network_mode"] == "none"
        artifacts = {entry["source"]: entry for entry in config["artifacts"]}
        assert artifacts["/evidence/reference.json"]["service"] == "phoenix"
        assert artifacts["/audit/gateway.jsonl"]["service"] == "gateway"
        compose = yaml.safe_load((task / "environment/docker-compose.yaml").read_text())
        assert compose["services"]["main"]["networks"] == ["agent"]
        assert compose["networks"]["agent"]["internal"] is True
        assert compose["services"]["phoenix"]["networks"] == ["target"]
        assert "volumes" not in compose["services"]["main"]
        assert not any("ports" in service for service in compose["services"].values())
        text = (task / "instruction.md").read_text()
        assert "trail-gaia" not in text and "evidence_trace_ids" not in text
        assert "{project}" not in text
        assert "research-assistant" in text or task.name == "noop-surface-cost"
    assert "count-traces" in [task.name for task in tasks]


async def test_native_plugin_preserves_small_metadata_and_versions_seed_changes(tmp_path):
    from harbor.job import Job
    from harbor.models.job.config import DatasetConfig, JobConfig
    from harbor.models.trial.config import AgentConfig

    from phoenix.client.harbor._adapter import build_job_plan

    manifest = {
        "project": "research-assistant",
        "corpus": "test",
        "revision": "a" * 40,
        "fixture_hash": "b" * 64,
    }
    tasks = stage_tasks(
        manifest,
        tmp_path / "collection",
        images=images(),
        seed=tmp_path / "seed",
        interface="mcp",
        provider="openai",
    )
    task = next(t for t in tasks if t.name == "count-traces")

    async def plan(name):
        job = await Job.create(
            JobConfig(
                job_name=name,
                jobs_dir=tmp_path / "jobs",
                datasets=[DatasetConfig(path=task.parent, task_names=["count-traces"])],
                agents=[AgentConfig(name="oracle")],
            )
        )
        return build_job_plan(job)

    first = await plan("first")
    meta = first.tasks[0].to_example()["metadata"]["task_config"]["metadata"]
    assert set(meta) == {"task_class", "fixture", "version"}
    assert meta["fixture"]["fixture_hash"] == "b" * 64
    assert first.tasks[0].config["verifier"]["environment_mode"] == "separate"
    config = task / "task.toml"
    config.write_text(config.read_text().replace("b" * 64, "d" * 64))
    second = await plan("second")
    assert first.tasks[0].task_id == second.tasks[0].task_id
    assert first.tasks[0].digest != second.tasks[0].digest
