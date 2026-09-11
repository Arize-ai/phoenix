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
CONFIG = tomllib.loads((HERE / "benchmark.toml").read_text())
CONDITIONS = ("claude-mcp", "claude-cli", "codex-mcp", "codex-cli")
TASKS = tuple(sorted(p.name for p in (HERE / "tasks").iterdir() if (p / "task.toml").is_file()))


def stage_tasks(
    manifest: dict, output: Path, *, images: dict, seed: Path, interface: str, provider: str
) -> list[Path]:
    """Copy static prompts and add image, seed, and verifier wiring for Harbor."""
    if manifest["project"] != "research-assistant":
        raise ValueError("Tasks require the research-assistant seed project")
    fixture = {key: manifest[key] for key in ("corpus", "revision", "fixture_hash")}
    template = (HERE / "environment/docker-compose.yaml").read_text()
    substitutions = {
        "AGENT_IMAGE": images["agent-" + interface]["id"],
        "TARGET_IMAGE": images["target"]["id"],
        "GATEWAY_IMAGE": images["gateway"]["id"],
        "SEED_DIR": json.dumps(str(seed.resolve())),
        "INTERFACE": interface,
        "PROVIDER": provider,
        "PROVIDER_KEY": "OPENAI_API_KEY" if provider == "openai" else "ANTHROPIC_API_KEY",
    }
    for key, value in substitutions.items():
        template = template.replace("__" + key + "__", value)
    tasks = []
    for name in TASKS:
        source = HERE / "tasks" / name
        task = output / name
        shutil.copytree(source, task)
        config = tomllib.loads((task / "task.toml").read_text())
        config["metadata"]["fixture"] = fixture
        config.update(
            {
                "schema_version": "1.3",
                # Compose explicitly defines isolated networks. Harbor must not attach
                # its own provider allowlist or a second network to the agent.
                "environment": {
                    "docker_image": images["agent-" + interface]["id"],
                    "network_mode": "public",
                    "cpus": 2,
                    "memory_mb": 4096,
                },
                "agent": {"timeout_sec": 300},
                "verifier": {
                    "environment_mode": "separate",
                    "timeout_sec": 60,
                    "env": {"BENCHMARK_INTERFACE": interface, "BENCHMARK_TASK": name},
                    "environment": {
                        "docker_image": images["verifier"]["id"],
                        "network_mode": "public",
                    },
                },
                "artifacts": [
                    {"source": "/workspace/answer.txt", "destination": "answer.txt"},
                    {"source": "/logs/agent/trajectory.json", "destination": "trajectory.json"},
                    *[
                        {"source": "/evidence/" + f, "destination": f, "service": "phoenix"}
                        for f in ("reference.json", "ready.json", "operations.jsonl")
                    ],
                    {
                        "source": "/audit/gateway.jsonl",
                        "destination": "gateway.jsonl",
                        "service": "gateway",
                    },
                ],
            }
        )
        (task / "task.toml").write_text(toml.dumps(config))
        (task / "environment").mkdir()
        (task / "environment/docker-compose.yaml").write_text(template)
        (task / "tests/test.sh").write_text(
            "#!/bin/sh\nset -eu\npython -m evals.mcp.scoring.verify --task "
            + name
            + " --interface "
            + interface
            + "\n"
        )
        (task / "tests/docker-compose.yaml").write_text(
            "services:\n  main:\n    network_mode: none\n"
        )
        (task / "solution").mkdir()
        shutil.copy(HERE / "scripts/oracle.py", task / "solution/oracle.py")
        (task / "solution/config.json").write_text(
            json.dumps({"project": manifest["project"], "task": name})
        )
        (task / "solution/solve.sh").write_text("#!/bin/sh\nset -eu\npython /solution/oracle.py\n")
        tasks.append(task)
    return tasks


def job_config(
    condition: str, *, tasks: Path, output: Path, images: dict, oracle: bool = False
) -> JobConfig:
    """Configure Harbor's built-in coding agent; the CLI attaches the Phoenix plugin."""
    if condition not in CONDITIONS:
        raise ValueError("Unknown condition")
    agent = "claude-code" if condition.startswith("claude") else "codex"
    interface = condition.rsplit("-", 1)[1]
    settings = CONFIG["agents"][agent]
    instructions = (
        "Use the configured Phoenix MCP for Phoenix tasks."
        if interface == "mcp"
        else "Use the installed px CLI for Phoenix tasks."
    )
    instructions += " Give your final answer in the conversation and write the same answer to /workspace/answer.txt."
    kwargs = {
        "version": settings["version"],
        "reasoning_effort": CONFIG["reasoning_effort"],
        "benchmark_target_image": images["target"]["id"],
        "benchmark_interface": interface,
    }
    env = {"OPENAI_API_KEY": "gateway-placeholder", "ANTHROPIC_API_KEY": "gateway-placeholder"}
    if agent == "claude-code":
        kwargs |= {"disallowed_tools": "WebSearch,WebFetch", "append_system_prompt": instructions}
        env["ANTHROPIC_BASE_URL"] = "http://gateway:8080/provider"
    else:
        env["OPENAI_BASE_URL"] = "http://gateway:8080/provider/v1"
        kwargs |= {
            "web_search": "disabled",
            "config": {
                "forced_login_method": "api",
                "developer_instructions": instructions,
                "web_search": "disabled",
                "model_provider": "benchmark",
                "model_providers": {
                    "benchmark": {
                        "name": "Benchmark inference gateway",
                        "base_url": "http://gateway:8080/provider/v1",
                        "wire_api": "responses",
                        "env_key": "OPENAI_API_KEY",
                        "supports_websockets": False,
                    }
                },
            },
        }
    config = AgentConfig(
        name=agent,
        model_name=settings["model"],
        kwargs=kwargs,
        env=env,
        mcp_servers=[
            {"name": "phoenix", "transport": "streamable-http", "url": "http://gateway:8080/mcp"}
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
