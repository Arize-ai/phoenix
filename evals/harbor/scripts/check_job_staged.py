# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Check that every task in a Harbor job has a staged build context.

Without this check, ``harbor run`` can fail during the environment build or build an
image without its fixture. Usage::

    uv run --script evals/harbor/scripts/check_job_staged.py JOB.yaml [--agents-replaced]

Use ``--agents-replaced`` when the run passes ``-a``. That option replaces the agents in
the job file, so the run does not require the px archive used by its CLI agents. Use
``--client-wheel-dir`` when the run loads the Phoenix plugin from the client wheel that
staging builds, so a missing wheel fails here and not inside ``uvx``.
"""

from __future__ import annotations

import argparse
import sys
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

import yaml

# Globs relative to each task's environment/ directory.
STAGED = (
    "Dockerfile",
    "wheels/arize_phoenix-*.whl",
    "wheels/harbor_verifiers-*.whl",
    "container_assets",
    "data/phoenix.db",
)
CLI_ARCHIVE = Path("dist/phoenix-cli/phoenix-cli.tar.gz")
CLIENT_WHEEL = "arize_phoenix_client-*.whl"


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
    parser.add_argument("--client-wheel-dir", type=Path)
    args = parser.parse_args()
    job = yaml.safe_load(args.job.read_text()) or {}

    failures = []
    for task in job_tasks(job):
        environment = task / "environment"
        missing = [part for part in STAGED if not any(environment.glob(part))]
        if missing:
            failures.append(f"{task}/environment/ is missing {', '.join(missing)}")
    agents = job.get("agents") or []
    needs_cli = not args.agents_replaced and any(
        str(agent.get("import_path", "")).endswith("CliAgent") for agent in agents
    )
    if needs_cli and not CLI_ARCHIVE.is_file():
        failures.append(f"{CLI_ARCHIVE} is missing")
    if args.client_wheel_dir and not any(args.client_wheel_dir.glob(CLIENT_WHEEL)):
        failures.append(f"{args.client_wheel_dir}/{CLIENT_WHEEL} is missing")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        print(
            "Run 'make harbor-stage' first; the trail-benchmark tasks need HF_TOKEN set for it.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
