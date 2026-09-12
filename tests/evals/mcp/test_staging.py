import pytest
import tomllib
import yaml

from evals.mcp.scripts.stage import stage_tasks


def images():
    return {
        name: {"id": "sha256:" + str(index) * 64, "tag": f"mcp-test:{name}"}
        for index, name in enumerate(("agent-mcp", "agent-cli", "target", "verifier"))
    } | {
        "source": {
            "revision": "c" * 40,
            "working_tree": True,
            "wheel_sha256": "d" * 64,
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
        assert config["environment"]["network_mode"] == "allowlist"
        assert config["environment"]["allowed_hosts"] == ["api.openai.com"]
        assert config["verifier"]["environment"]["network_mode"] == "no-network"
        assert not (task / "tests/docker-compose.yaml").exists()
        assert "docker_image" not in config["verifier"]["environment"]
        assert (task / "tests/Dockerfile").read_text().endswith("COPY . /tests/\n")
        assert (task / "tests/test.sh").is_file()
        assert (task / "solution/solve.sh").is_file()
        artifacts = {entry["source"]: entry for entry in config["artifacts"]}
        assert artifacts["/evidence/reference.json"]["service"] == "phoenix"
        compose = yaml.safe_load((task / "environment/docker-compose.yaml").read_text())
        assert set(compose["services"]) == {"main", "phoenix"}
        # Explicit networking would bypass Harbor's native egress controller.
        assert "networks" not in compose
        for service in compose["services"].values():
            assert "networks" not in service and "network_mode" not in service
            assert "NET_ADMIN" in service["cap_drop"]
        assert (
            compose["services"]["main"]["environment"]["PHOENIX_COLLECTOR_ENDPOINT"]
            == "http://127.0.0.1:6006"
        )
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
        from phoenix.client.harbor._adapter import build_job_plan

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


@pytest.mark.parametrize("packaging", ["default", "dockerfile", "image"])
@pytest.mark.parametrize("has_solution", [False, True])
async def test_custom_verifier_artifacts_and_oracle_survive_staging(
    tmp_path, monkeypatch, packaging, has_solution
):
    import shutil

    import toml
    from harbor.models.task.task import Task

    from evals.mcp.scripts import stage

    source = tmp_path / "source"
    task = source / "tasks/custom-state"
    (task / "tests").mkdir(parents=True)
    (task / "instruction.md").write_text("Create the requested split.")
    verifier = "#!/bin/sh\npython /tests/check_state.py\n"
    (task / "tests/test.sh").write_text(verifier)
    (task / "tests/verify.py").write_text("# Must not override the explicit test.sh")
    (task / "tests/check_state.py").write_text("# task-owned state grader")
    if has_solution:
        (task / "solution").mkdir()
        (task / "solution/solve.sh").write_text("# task-owned oracle")
    if packaging == "dockerfile":
        (task / "tests/Dockerfile").write_text("FROM custom-grader\nCOPY . /tests/\n")
    (task / "task.toml").write_text(
        toml.dumps(
            {
                "agent": {"timeout_sec": 900},
                "verifier": {
                    "environment": {"docker_image": "custom-grader"}
                    if packaging == "image"
                    else {},
                    "timeout_sec": 120,
                    "env": {"EXPECTED_SPLIT": "regressions"},
                    "collect": [{"service": "phoenix", "command": "snapshot"}],
                },
                "artifacts": [
                    {"source": "/evidence/state.json", "service": "phoenix"},
                    {"source": "/workspace/answer.txt", "destination": "custom-answer.txt"},
                ],
            }
        )
    )
    shutil.copytree(stage.HERE / "environment", source / "environment")
    shutil.copytree(stage.HERE / "scripts", source / "scripts")
    monkeypatch.setattr(stage, "HERE", source)
    [staged] = stage.stage_tasks(
        {
            "project": "research-assistant",
            "corpus": "test",
            "revision": "a" * 40,
            "fixture_hash": "b" * 64,
        },
        tmp_path / "staged",
        images=images(),
        seed=tmp_path / "seed",
        interface="cli",
        provider="openai",
    )
    config = Task(staged).config
    assert (staged / "tests/test.sh").read_text() == verifier
    if has_solution:
        assert (staged / "solution/solve.sh").read_text() == "# task-owned oracle"
    else:
        assert not (staged / "solution").exists()
    assert config.agent.timeout_sec == 900
    assert config.verifier.timeout_sec == 120
    assert config.verifier.env["EXPECTED_SPLIT"] == "regressions"
    assert config.verifier.collect[0].command == "snapshot"
    if packaging == "image":
        assert config.verifier.environment.docker_image == "custom-grader"
        assert not (staged / "tests/Dockerfile").exists()
    else:
        assert config.verifier.environment.docker_image is None
        if packaging == "dockerfile":
            assert (staged / "tests/Dockerfile").read_bytes() == (
                task / "tests/Dockerfile"
            ).read_bytes()
    artifacts = {a.source: a for a in config.artifacts}
    assert len(artifacts) == 2  # Task declarations replace the answer-task defaults.
    assert artifacts["/evidence/state.json"].service == "phoenix"
    assert artifacts["/workspace/answer.txt"].destination == "custom-answer.txt"


def test_task_overrides_cannot_expand_phase_or_step_network_access():
    import pytest

    from evals.mcp.scripts.stage import require_fixed_network

    for override in (
        {"network_mode": "public"},
        {"environment": {"allowed_hosts": ["example.com"]}},
        [{"agent": {"extra_allowed_hosts": ["example.com"]}}],
    ):
        with pytest.raises(ValueError, match="Network policy is fixed"):
            require_fixed_network(override)
