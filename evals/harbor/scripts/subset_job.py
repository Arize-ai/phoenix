# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Create a Harbor job file that contains only the selected agents and tasks.

Harbor's ``-a`` option replaces the configured agents with a minimal entry. It removes
the MCP servers, environment, and skills that define a condition. This script preserves
the complete agent entries and limits the datasets with ``task_names``. ``--env`` adds
server settings to ``environment.env``, which Harbor applies when the container starts.
Usage::

    uv run --script evals/harbor/scripts/subset_job.py evals/harbor/jobs/trail-benchmark-dev.yaml \
        --agents claude-code-mcp codex-cli --tasks count-traces --out evals/harbor/.cache/subset.yaml
    make harbor-run HARBOR_JOB=evals/harbor/.cache/subset.yaml HARBOR_ARGS='-e docker'
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml


def select_agents(config: dict[str, Any], names: list[str]) -> dict[str, Any]:
    agents = {agent["name"]: agent for agent in config.get("agents", [])}
    unknown = [name for name in names if name not in agents]
    if unknown:
        raise SystemExit(f"unknown agents {unknown}; the file defines {sorted(agents)}")
    return {**config, "agents": [agents[name] for name in names]} if names else config


def select_tasks(config: dict[str, Any], names: list[str]) -> dict[str, Any]:
    if not names:
        return config
    datasets = [{**dataset, "task_names": list(names)} for dataset in config.get("datasets", [])]
    return {**config, "datasets": datasets}


def set_environment_env(config: dict[str, Any], assignments: list[str]) -> dict[str, Any]:
    if not assignments:
        return config
    malformed = [item for item in assignments if "=" not in item]
    if malformed:
        raise SystemExit(f"expected KEY=VALUE, got {malformed}")
    env = dict(config.get("environment", {}).get("env", {}))
    env.update(dict(item.split("=", 1) for item in assignments))
    return {**config, "environment": {**config.get("environment", {}), "env": env}}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--agents", nargs="*", default=[], help="agent names to keep; all when empty"
    )
    parser.add_argument("--tasks", nargs="*", default=[], help="task names to keep; all when empty")
    parser.add_argument(
        "--env",
        nargs="*",
        default=[],
        metavar="KEY=VALUE",
        help="environment variables for the container, such as a Phoenix server setting",
    )
    args = parser.parse_args()
    config = yaml.safe_load(args.job.read_text())
    selected = set_environment_env(
        select_tasks(select_agents(config, args.agents), args.tasks), args.env
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(yaml.safe_dump(selected, sort_keys=False))
    agents = ", ".join(agent["name"] for agent in selected["agents"])
    tasks = ", ".join(args.tasks) or "every task"
    print(f"{args.out}: {agents} on {tasks}", file=sys.stderr)


if __name__ == "__main__":
    main()
