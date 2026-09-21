# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml", "pydantic"]
# ///
"""Generate one Harbor task per PXI eval example.

Each task's ``instruction.md`` holds the user's request followed by the example as JSON,
which is how the example reaches the agent at run time. Every task shares the same build
context so Harbor builds one image. ``harbor-stage`` runs this before staging; the
generated tasks are not committed because the YAML datasets are the source of truth.

    uv run python -m evals.harbor.pxi.generate_tasks --out evals/harbor/tasks/pxi
    uv run python -m evals.harbor.pxi.generate_tasks --datasets set_spans_filter --splits regression
"""

from __future__ import annotations

import argparse
import json
import shutil
import stat
from pathlib import Path
from typing import Any

from evals.harbor.pxi.dataset import DATASETS_DIR, load_dataset
from evals.harbor.pxi.examples import example_records, render_instruction, step_name

TASK_TOML = """\
schema_version = "1.3"
artifacts = ["/var/lib/phoenix-eval/server.log"]

[task]
name = "arize/pxi-{dataset}-{example}"
description = {description}
keywords = ["pxi", "agent_session_chat", "{dataset}"]

[metadata]
fixture = "pxi"
pxi_dataset = "{dataset}"
pxi_example = {example_id}
pxi_splits = {splits}

[environment]
os = "linux"
cpus = 2
memory_mb = 4096
# Add hosts in the job or agent configuration to keep this task's dataset version stable
# across providers and operators.
network_mode = "allowlist"
build_timeout_sec = 1200.0

[environment.env]
ANTHROPIC_API_KEY = "${{ANTHROPIC_API_KEY:-}}"
OPENAI_API_KEY = "${{OPENAI_API_KEY:-}}"

# Start Phoenix as root so it owns the database before the unprivileged agent runs.
[environment.healthcheck]
command = "sh /opt/phoenix-eval/start_phoenix_server.sh"
timeout_sec = 180.0
retries = 2

# The chat client only talks to Phoenix over HTTP; the agent class seeds the session as root.
[agent]
user = "agent"
timeout_sec = {agent_timeout}

[verifier]
timeout_sec = 120.0
"""

TEST_SH = """\
#!/bin/sh
set -eu
PYTHONPATH=/opt/verifier exec python -m evals.harbor.pxi.verify \\
  --example /app/example.json --seed /app/seed.json
"""

GITIGNORE = """\
# Staging writes the image, wheel, and fixture to environment/. Ignore these generated
# files so they do not change the task digest that versions the Phoenix dataset.
environment/
"""


def _toml_string(value: str) -> str:
    return json.dumps(" ".join(value.split()))


def task_dir_name(example: dict[str, Any]) -> str:
    return f"{example['dataset']}__{step_name(example['id'])}"


def write_task(
    example: dict[str, Any],
    *,
    out_dir: Path,
    description: str,
    agent_timeout_sec: float,
) -> Path:
    task_dir = out_dir / task_dir_name(example)
    if task_dir.exists():
        environment = task_dir / "environment"
        for child in task_dir.iterdir():
            if child != environment:
                shutil.rmtree(child) if child.is_dir() else child.unlink()
    (task_dir / "tests").mkdir(parents=True, exist_ok=True)
    (task_dir / ".gitignore").write_text(GITIGNORE)
    test_sh = task_dir / "tests" / "test.sh"
    test_sh.write_text(TEST_SH)
    test_sh.chmod(test_sh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    (task_dir / "instruction.md").write_text(render_instruction(example))
    (task_dir / "task.toml").write_text(
        TASK_TOML.format(
            dataset=example["dataset"],
            example=step_name(example["id"]),
            example_id=json.dumps(example["id"]),
            splits=json.dumps(example["splits"]),
            description=_toml_string(description),
            agent_timeout=agent_timeout_sec,
        )
    )
    return task_dir


def generate(
    *,
    out_dir: Path,
    datasets: list[str] | None,
    splits: list[str] | None,
    limit: int | None,
    agent_timeout_sec: float,
) -> list[Path]:
    """Write one task per selected example and remove task directories for any others."""
    names = datasets or sorted(path.stem for path in DATASETS_DIR.glob("*.yaml"))
    written: list[Path] = []
    for name in names:
        dataset = load_dataset(name)
        examples = example_records(dataset)
        if splits:
            examples = [e for e in examples if any(s in splits for s in e["splits"])]
        if limit is not None:
            examples = examples[:limit]
        description = dataset.description or f"PXI eval dataset {name}"
        for example in examples:
            written.append(
                write_task(
                    example,
                    out_dir=out_dir,
                    description=f"{example['id']}: {description}",
                    agent_timeout_sec=agent_timeout_sec,
                )
            )
    if out_dir.exists():
        for child in out_dir.iterdir():
            if child.is_dir() and child not in written:
                shutil.rmtree(child)
    return written


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("evals/harbor/tasks/pxi"))
    parser.add_argument("--datasets", nargs="*", default=None, help="dataset stems; default all")
    parser.add_argument("--splits", nargs="*", default=None, help="keep only these splits")
    parser.add_argument("--limit", type=int, default=None, help="keep the first N examples")
    parser.add_argument("--agent-timeout-sec", type=float, default=600.0)
    args = parser.parse_args(argv)
    written = generate(
        out_dir=args.out,
        datasets=args.datasets,
        splits=args.splits,
        limit=args.limit,
        agent_timeout_sec=args.agent_timeout_sec,
    )
    print(f"Generated {len(written)} task(s) under {args.out}")


if __name__ == "__main__":
    main()
