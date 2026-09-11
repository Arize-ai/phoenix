"""Render ordinary Harbor jobs without starting them or resolving any credentials."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from harbor.models.job.config import DatasetConfig, JobConfig
from harbor.models.trial.config import AgentConfig

from runtime import HERE

MATRIX = json.loads((HERE / "configs/matrix.json").read_text())


def experiment_name(agent: str, model: str, interface: str) -> str:
    """Display the configuration; Harbor metadata retains unique job identity."""
    agent_label = {"claude-code": "Claude Code", "codex": "Codex"}[agent]
    model_label = {"claude-opus-5": "Opus 5", "gpt-5.6": "GPT-5.6"}.get(model, model)
    return f"{agent_label} · {model_label} · {interface.upper()}"


def render_job(
    condition: str,
    *,
    tasks: Path,
    target_endpoint: str,
    results_endpoint: str,
    job_name: str,
    requested_model: str | None = None,
) -> tuple[JobConfig, dict[str, str]]:
    if condition not in MATRIX["conditions"]:
        raise ValueError("Unknown condition")
    target = urlsplit(target_endpoint)
    results = urlsplit(results_endpoint)
    if (
        target.scheme not in {"http", "https"}
        or not target.hostname
        or target.username
        or target.password
        or target.query
        or target.fragment
        or target.path not in {"", "/"}
    ):
        raise ValueError("Target must be a credential-free Phoenix origin URL")
    if (
        results.scheme not in {"http", "https"}
        or not results.hostname
        or results.username
        or results.password
        or results.query
        or results.fragment
    ):
        raise ValueError("Results endpoint must be a credential-free URL")
    if target.hostname != "mcp-gateway" or results.hostname == "mcp-gateway":
        raise ValueError(
            "Target must be the private mcp-gateway; results must be outside the trial"
        )
    agent = "claude-code" if condition.startswith("claude-") else "codex"
    interface = condition.rsplit("-", 1)[1]
    requested = requested_model or MATRIX["requested_models"][agent]
    # Only the documented request-to-ID mapping is applied. New values stay literal.
    model = MATRIX["documented_model_ids"].get(requested, requested)
    access = "the configured Phoenix MCP" if interface == "mcp" else "px CLI"
    instruction = (
        f"Your assigned Phoenix interface is {access}. "
        "Give your final answer in the conversation and write the same answer to "
        "/workspace/answer.txt. Installed local help and shell processing are available."
    )
    kwargs = {
        "version": MATRIX["agent_versions"][agent],
        "reasoning_effort": MATRIX["reasoning_effort"],
    }
    if agent == "claude-code":
        kwargs |= {"disallowed_tools": "WebSearch,WebFetch", "append_system_prompt": instruction}
    else:
        kwargs |= {
            "web_search": "disabled",
            "config": {
                "forced_login_method": "api",
                "developer_instructions": instruction,
                "web_search": "disabled",
            },
        }
    mcp_servers = (
        [
            {
                "name": "phoenix",
                "transport": "streamable-http",
                "url": target_endpoint.rstrip("/") + "/mcp",
            }
        ]
        if interface == "mcp"
        else []
    )
    agent_config = AgentConfig(
        name=agent,
        model_name=model,
        kwargs=kwargs,
        mcp_servers=mcp_servers,
        extra_allowed_hosts=[target.hostname],
    )
    # Target CLI configuration is separate from the results plugin endpoint. The
    # future runner must inject this only into the CLI agent, without results auth.
    if interface == "cli":
        agent_config.env = {"PHOENIX_COLLECTOR_ENDPOINT": target_endpoint}
    job = JobConfig(
        job_name=job_name,
        datasets=[DatasetConfig(path=tasks)],
        agents=[agent_config],
        n_concurrent_trials=1,
        n_attempts=1,
        retry={"max_retries": 0},
        environment={"type": "docker", "delete": False},
    )
    plugin = {
        "dataset": "phoenix-interface-benchmark",
        "trace_mode": "atif",
        "endpoint": results_endpoint,
        "experiment_name": experiment_name(agent, model, interface),
    }
    return job, plugin


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target", required=True)
    parser.add_argument("--results", default="http://localhost:6006")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    for condition in MATRIX["conditions"]:
        job, plugin = render_job(
            condition,
            tasks=args.tasks,
            target_endpoint=args.target,
            results_endpoint=args.results,
            job_name=condition,
        )
        (args.output / f"{condition}.json").write_text(job.model_dump_json(indent=2))
        (args.output / f"{condition}.plugin.json").write_text(json.dumps(plugin, indent=2))
    (args.output / "matrix.json").write_text(json.dumps(MATRIX, indent=2))


if __name__ == "__main__":
    main()
