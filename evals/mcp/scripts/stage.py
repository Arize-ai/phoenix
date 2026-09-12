"""Write runnable Harbor task directories and one job config per condition."""

from __future__ import annotations

import json
import shutil
import tomllib
from pathlib import Path

import toml
from harbor.models.job.config import DatasetConfig, JobConfig
from harbor.models.trial.config import AgentConfig

HERE = Path(__file__).resolve().parents[1]


def require_fixed_network(value: object) -> None:
    """Tasks can customize grading, but the launcher owns network policy."""
    if isinstance(value, dict):
        if value.keys() & {
            "network_mode",
            "allowed_hosts",
            "extra_allowed_hosts",
            "allow_internet",
        }:
            raise ValueError("Network policy is fixed by the benchmark launcher")
        for child in value.values():
            require_fixed_network(child)
    elif isinstance(value, list):
        for child in value:
            require_fixed_network(child)


def stage_tasks(
    manifest: dict, output: Path, *, images: dict, seed: Path, interface: str, provider: str
) -> list[Path]:
    """Copy static prompts and add image, seed, and verifier wiring for Harbor."""
    if manifest["project"] != "research-assistant":
        raise ValueError("Tasks require the research-assistant seed project")
    fixture = {key: manifest[key] for key in ("corpus", "revision", "fixture_hash")}
    agent_image = images["agent-cli" if interface == "cli" else "agent-mcp"]["id"]
    template = (HERE / "environment/docker-compose.yaml").read_text()
    substitutions = {
        "AGENT_IMAGE": agent_image,
        "TARGET_IMAGE": images["target"]["id"],
        "SEED_DIR": json.dumps(str(seed.resolve())),
        "INTERFACE": interface,
    }
    for key, value in substitutions.items():
        template = template.replace("__" + key + "__", value)
    tasks = []
    for name in sorted(p.name for p in (HERE / "tasks").iterdir() if (p / "task.toml").is_file()):
        source = HERE / "tasks" / name
        task = output / name
        shutil.copytree(source, task, ignore=shutil.ignore_patterns("__pycache__", ".git"))
        config = tomllib.loads((task / "task.toml").read_text())
        for section in ("environment", "agent", "verifier", "steps"):
            require_fixed_network(config.get(section))
        config.setdefault("metadata", {})["fixture"] = fixture
        config.setdefault("schema_version", "1.3")
        environment = config.setdefault("environment", {})
        environment.update(
            docker_image=agent_image,
            network_mode="allowlist",
            allowed_hosts=["api.openai.com" if provider == "openai" else "api.anthropic.com"],
        )
        environment.setdefault("cpus", 2)
        environment.setdefault("memory_mb", 4096)
        config.setdefault("agent", {}).setdefault("timeout_sec", 300)
        verifier = config.setdefault("verifier", {})
        if verifier.setdefault("environment_mode", "separate") != "separate":
            raise ValueError("Benchmark tasks require a separate verifier environment")
        verifier.setdefault("timeout_sec", 60)
        verifier.setdefault("env", {}).update(BENCHMARK_INTERFACE=interface, BENCHMARK_TASK=name)
        verifier_env = verifier.setdefault("environment", {})
        verifier_env["network_mode"] = "no-network"
        # Harbor builds a task's tests/Dockerfile and invokes /tests/test.sh directly.
        # Custom Dockerfiles and prebuilt verifier images already own this contract.
        if not verifier_env.get("docker_image") and not (task / "tests/Dockerfile").exists():
            if not (task / "tests/test.sh").is_file():
                raise ValueError(f"Task {name} must supply tests/test.sh")
            (task / "tests/Dockerfile").write_text(
                f"FROM {images['verifier']['tag']}\nCOPY . /tests/\n"
            )
        config.setdefault(
            "artifacts",
            [
                {"source": "/workspace/answer.txt", "destination": "answer.txt"},
                {"source": "/logs/agent/trajectory.json", "destination": "trajectory.json"},
                *[
                    {"source": "/evidence/" + f, "destination": f, "service": "phoenix"}
                    for f in ("reference.json", "ready.json", "operations.jsonl")
                ],
            ],
        )
        (task / "task.toml").write_text(toml.dumps(config))
        (task / "environment").mkdir(exist_ok=True)
        (task / "environment/docker-compose.yaml").write_text(template)
        if (task / "solution").is_dir() and not (task / "solution/oracle.py").exists():
            shutil.copy(HERE / "scripts/oracle.py", task / "solution/oracle.py")
        tasks.append(task)
    return tasks


def job_config(
    condition: str,
    *,
    tasks: Path,
    output: Path,
    images: dict,
    oracle: bool = False,
    benchmark: dict,
) -> JobConfig:
    """Configure Harbor's built-in coding agent; the CLI attaches the Phoenix plugin."""
    if condition not in benchmark["conditions"]:
        raise ValueError("Unknown condition")
    selected = benchmark["conditions"][condition]
    agent = selected["agent"]
    interface = selected["interface"]
    settings = benchmark["agents"][agent]
    instructions = {
        "mcp": "Use the configured Phoenix MCP for Phoenix tasks.",
        "cli": "Use the installed px CLI for Phoenix tasks.",
        "none": "Phoenix is available at http://127.0.0.1:6006.",
    }[interface]
    instructions += " Give your final answer in the conversation and write the same answer to /workspace/answer.txt."
    kwargs = {
        "version": settings["version"],
        "reasoning_effort": benchmark["reasoning_effort"],
        "benchmark_target_image": images["target"]["id"],
        "benchmark_interface": interface,
    }
    if agent == "claude-code":
        kwargs |= {"disallowed_tools": "WebSearch,WebFetch", "append_system_prompt": instructions}
    else:
        kwargs |= {
            "web_search": "disabled",
            "config": {
                "forced_login_method": "api",
                "developer_instructions": instructions,
                "web_search": "disabled",
            },
        }
    config = AgentConfig(
        name=agent,
        model_name=settings["model"],
        kwargs=kwargs,
        skills=selected.get("skills", []),
        mcp_servers=[
            {"name": "phoenix", "transport": "streamable-http", "url": "http://127.0.0.1:6006/mcp"}
        ]
        if interface == "mcp"
        else [],
    )
    if oracle:
        if interface != "cli":
            raise ValueError("The reference oracle requires the CLI condition")
        config = AgentConfig(name="oracle")
    return JobConfig(
        job_name=output.name + "-" + condition + ("-oracle" if oracle else ""),
        jobs_dir=output / "jobs",
        datasets=[DatasetConfig(path=tasks, exclude_task_names=["noop-surface-cost"])],
        agents=[config],
        n_concurrent_trials=1,
        n_attempts=1,
        retry={"max_retries": 0},
        environment={"type": "docker", "delete": True},
    )
