# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Check that every task in a Harbor job has a staged build context.

Without this check, ``harbor run`` can fail during the environment build or build an
image without its fixture. Usage::

    uv run --script evals/harbor/scripts/check_job_staged.py JOB.yaml [--agents-replaced]

Use ``--agents-replaced`` when the run passes ``-a``. That option replaces the agents in
the job file, so the run does not require the px archive used by its CLI agents, and the
preinstalled Claude Code and Codex versions are not compared with the job's pins.
"""

from __future__ import annotations

import argparse
import re
import sys
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

import yaml

STAGED = ("Dockerfile", "wheels", "verifier", "container_assets", "data/phoenix.db")
CLI_ARCHIVE = Path("dist/phoenix-cli/phoenix-cli.tar.gz")
DOCKERFILE = Path("evals/harbor/environments/Dockerfile")
PREINSTALLED_VERSION_ARG = {"ClaudeCode": "CLAUDE_CODE_VERSION", "Codex": "CODEX_VERSION"}


def preinstalled_versions() -> dict[str, str]:
    """The agent versions the Dockerfile installs, keyed by ARG name."""
    return dict(re.findall(r"^ARG (\w+_VERSION)=(\S+)$", DOCKERFILE.read_text(), re.MULTILINE))


def agent_class(agent: dict[str, Any]) -> str:
    return str(agent.get("import_path", "")).rsplit(":", 1)[-1]


def version_mismatches(agents: list[dict[str, Any]]) -> list[str]:
    preinstalled = preinstalled_versions()
    failures = []
    for agent in agents:
        for prefix, arg in PREINSTALLED_VERSION_ARG.items():
            if not agent_class(agent).startswith(prefix):
                continue
            pinned = str((agent.get("kwargs") or {}).get("version", ""))
            if pinned != preinstalled.get(arg):
                failures.append(
                    f"{agent.get('name')} pins version {pinned!r} but the Dockerfile "
                    f"has {arg}={preinstalled.get(arg)!r}"
                )
    return failures


def job_tasks(job: dict[str, Any]) -> list[Path]:
    tasks = [Path(task["path"]) for task in job.get("tasks") or [] if task.get("path")]
    for dataset in job.get("datasets") or []:
        if not dataset.get("path"):
            continue
        patterns = dataset.get("task_names")
        for task in sorted(Path(dataset["path"]).iterdir()):
            if not (task / "task.toml").is_file():
                continue
            if not patterns or any(fnmatch(task.name, pattern) for pattern in patterns):
                tasks.append(task)
    return tasks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", type=Path)
    parser.add_argument("--agents-replaced", action="store_true")
    args = parser.parse_args()
    job = yaml.safe_load(args.job.read_text()) or {}

    unstaged = []
    for task in job_tasks(job):
        missing = [part for part in STAGED if not (task / "environment" / part).exists()]
        if missing:
            unstaged.append(f"{task}/environment/ is missing {', '.join(missing)}")
    agents = [] if args.agents_replaced else job.get("agents") or []
    needs_cli = any(agent_class(agent).endswith("CliAgent") for agent in agents)
    if needs_cli and not CLI_ARCHIVE.is_file():
        unstaged.append(f"{CLI_ARCHIVE} is missing")
    if unstaged:
        print("\n".join(unstaged), file=sys.stderr)
        print(
            "Run 'make harbor-stage' first; the trail-benchmark tasks need HF_TOKEN set for it.",
            file=sys.stderr,
        )
    mismatches = version_mismatches(agents)
    if mismatches:
        print("\n".join(mismatches), file=sys.stderr)
    return 1 if unstaged or mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
