# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Fail unless every task a Harbor job file runs has its staged build context.

Without this, `harbor run` fails deep into the environment build, or builds an
image without its fixture. Usage::

    uv run --script evals/harbor/scripts/check_job_staged.py JOB.yaml [--agents-replaced]

``--agents-replaced`` says the run passes ``-a``, which drops the file's agents,
so the px CLI archive that the CLI agents upload is not required.
"""

from __future__ import annotations

import argparse
import sys
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

import yaml

STAGED = ("Dockerfile", "wheels", "container_assets", "data/phoenix.db")
CLI_ARCHIVE = Path("dist/phoenix-cli/phoenix-cli.tar.gz")


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

    failures = []
    for task in job_tasks(job):
        missing = [part for part in STAGED if not (task / "environment" / part).exists()]
        if missing:
            failures.append(f"{task}/environment/ is missing {', '.join(missing)}")
    agents = job.get("agents") or []
    needs_cli = not args.agents_replaced and any(
        str(agent.get("import_path", "")).endswith("CliAgent") for agent in agents
    )
    if needs_cli and not CLI_ARCHIVE.is_file():
        failures.append(f"{CLI_ARCHIVE} is missing")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        print(
            "Run 'make harbor-stage' first; the phoenix-tools tasks also need 'make harbor-seed'.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
