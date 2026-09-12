import argparse
import json
from pathlib import Path

import pytest

from evals.mcp.scripts import build, experiment
from evals.mcp.scripts.experiment import HERE, load_config
from evals.mcp.scripts.stage import job_config


def test_custom_condition_and_complete_skill_snapshot(tmp_path):
    source = tmp_path / "source/phoenix-cli"
    (source / "references").mkdir(parents=True)
    (source / "SKILL.md").write_text("Use references/commands.md")
    (source / "references/commands.md").write_text("version A")
    config_file = tmp_path / "benchmark.toml"
    config_file.write_text("""
reasoning_effort = "high"
px_version = "1.18.1"
[agents.codex]
version = "0.154.0"
model = "gpt-5.6"
[conditions.skill_candidate]
agent = "codex"
interface = "cli"
skills = ["source/phoenix-cli"]
""")
    config = load_config(config_file)
    selected = config["conditions"]["skill_candidate"]
    selected["skills"] = experiment.freeze_skills(selected["skills"], tmp_path / "frozen")
    (source / "references/commands.md").write_text("version B")
    frozen = Path(selected["skills"][0])
    assert (frozen / "references/commands.md").read_text() == "version A"
    job = job_config(
        "skill_candidate",
        tasks=tmp_path / "tasks",
        output=tmp_path,
        images={"target": {"id": "sha256:" + "a" * 64}},
        benchmark=config,
    )
    assert job.agents[0].name == "codex"
    assert not job.agents[0].mcp_servers
    assert job.agents[0].skills == [str(frozen)]


def test_prepared_run_survives_version_selection_and_uses_saved_label(tmp_path, monkeypatch):
    import subprocess

    prepared = tmp_path / "prepared"
    (prepared / "configs").mkdir(parents=True)
    (prepared / "images.json").write_text(json.dumps({"label": "CLI candidate A"}))
    config = load_config(HERE / "benchmark.toml")
    config["conditions"] = {"version_a": {"agent": "codex", "interface": "cli", "skills": []}}
    saved = job_config(
        "version_a",
        tasks=prepared / "version_a/tasks",
        output=prepared,
        images={"target": {"id": "sha256:" + "a" * 64}},
        benchmark=config,
    )
    path = prepared / "configs/version_a.json"
    path.write_text(saved.model_dump_json(exclude_unset=True))
    # Once prepared, execution must not read the current source configuration.
    monkeypatch.setattr(experiment, "load_config", lambda path: pytest.fail("read live settings"))
    calls = []
    execute = subprocess.run
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(experiment.subprocess, "run", lambda cmd, **kwargs: calls.append(cmd))
    monkeypatch.setattr(experiment, "require_completed_job", lambda path: None)
    args = argparse.Namespace(
        prepared=prepared, condition=None, oracle=False, repetitions=2, task=None
    )
    for selection in (None, ["count-traces"], ["noop-surface-cost"]):
        args.task = selection
        experiment.run(args)
        command = calls[-1]
        assert "experiment_name=CLI candidate A · version_a" in command
        assert str(path) in command
        # Exercise the pinned Harbor CLI's merge rules without running containers.
        result = execute(command + ["--print-config"], check=True, capture_output=True, text=True)
        effective = json.loads(result.stdout)
        assert effective["agents"][0]["kwargs"]["version"] == saved.agents[0].kwargs["version"]
        dataset = effective["datasets"][0]
        assert dataset["path"] == str(prepared / "version_a/tasks")
        assert dataset.get("task_names") == selection
        assert dataset.get("exclude_task_names") == (None if selection else ["noop-surface-cost"])


def test_completed_jobs_accept_task_defined_scores_and_reject_invalid_scores(tmp_path):
    (tmp_path / "trial").mkdir()
    (tmp_path / "result.json").write_text(
        json.dumps(
            {
                "n_total_trials": 1,
                "stats": {"n_errored_trials": 0, "n_completed_trials": 1},
            }
        )
    )
    result = tmp_path / "trial/result.json"
    result.write_text(json.dumps({"verifier_result": {"rewards": {"membership": 0.75}}}))
    experiment.require_completed_job(tmp_path)
    for rewards in ({}, {"membership": float("nan")}, {"membership": "unknown"}):
        result.write_text(json.dumps({"verifier_result": {"rewards": rewards}}))
        with pytest.raises(RuntimeError, match="no task reward"):
            experiment.require_completed_job(tmp_path)


def test_default_config_resolves_explicit_conditions():
    config = load_config(HERE / "benchmark.toml")
    assert len(config["conditions"]) == 4
    assert config["conditions"]["claude-cli"]["agent"] == "claude-code"


def test_skill_only_condition_does_not_configure_an_interface(tmp_path):
    from evals.mcp.scoring.measurements import interface_measurements

    config = load_config(HERE / "benchmark.toml")
    config["conditions"] = {"skills_only": {"agent": "codex", "interface": "none", "skills": []}}
    job = job_config(
        "skills_only",
        tasks=tmp_path / "tasks",
        output=tmp_path,
        images={"target": {"id": "sha256:" + "a" * 64}},
        benchmark=config,
    )
    assert not job.agents[0].mcp_servers
    assert "installed px" not in job.agents[0].kwargs["config"]["developer_instructions"]
    assert interface_measurements("none", None, None) == {}


def test_local_cli_package_is_frozen_and_identified_by_content(tmp_path, monkeypatch):
    import hashlib
    import io
    import tarfile

    root = tmp_path / "harness"
    root.mkdir()
    for name in ("environment", "scoring", "tasks"):
        (root / name).mkdir()
    (root / "environment/Dockerfile").write_text("# build fixture")
    package_path = tmp_path / "candidate.tgz"
    package_metadata = json.dumps({"name": "@arizeai/phoenix-cli", "version": "0.0.0-dev"}).encode()
    with tarfile.open(package_path, "w:gz") as package:
        entry = tarfile.TarInfo("package/package.json")
        entry.size = len(package_metadata)
        package.addfile(entry, io.BytesIO(package_metadata))
    monkeypatch.setattr(build, "HERE", root)
    commands = []

    def execute(command, **kwargs):
        commands.append(command)
        if command[:2] == ["uv", "build"]:
            wheels = Path(command[command.index("--out-dir") + 1])
            wheels.mkdir()
            (wheels / "arize_phoenix-test.whl").write_bytes(b"candidate wheel")

    def output(command, **kwargs):
        return (
            "a" * 40 if command[0] == "git" else json.dumps([{"Id": "sha256:" + "b" * 64}]).encode()
        )

    monkeypatch.setattr(build.subprocess, "run", execute)
    monkeypatch.setattr(build.subprocess, "check_output", output)
    config = load_config(HERE / "benchmark.toml")
    config["agents"].pop("claude-code")
    images = build.build_images(config=config, target_source=tmp_path, cli_package=package_path)
    assert images["source"]["cli_version"] == "0.0.0-dev"
    assert (
        images["source"]["cli_package_sha256"]
        == hashlib.sha256(package_path.read_bytes()).hexdigest()
    )
    docker_commands = [command for command in commands if command[:2] == ["docker", "build"]]
    assert len(docker_commands) == 4
    assert all("CLAUDE_VERSION=" in command for command in docker_commands)
    assert all(
        "PX_PACKAGE=/opt/benchmark/cli-package/phoenix-cli.tgz" in command
        for command in docker_commands
    )
    copied = Path(docker_commands[0][-1]) / "cli-package/phoenix-cli.tgz"
    assert copied.read_bytes() == package_path.read_bytes()
