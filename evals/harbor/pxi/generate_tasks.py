# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml", "pydantic"]
# ///
"""Generate one multi-step Harbor task per PXI dataset.

Each example becomes a step whose ``workdir/example.json`` holds the example and whose
``instruction.md`` shows the user's request. ``harbor-stage`` runs this before staging;
the generated tasks are not committed because the YAML datasets are the source of truth.

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
from evals.harbor.pxi.examples import example_records, step_name, user_instruction

TASK_TOML_HEADER = """\
schema_version = "1.3"
multi_step_reward_strategy = "mean"
artifacts = ["/var/lib/phoenix-eval/server.log"]

[task]
name = "arize/pxi-{dataset}"
description = {description}
keywords = ["pxi", "agent_session_chat", "{dataset}"]

[metadata]
fixture = "pxi"
pxi_dataset = "{dataset}"

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

# The chat client only talks to Phoenix over HTTP; the agent class seeds sessions as root.
[agent]
user = "agent"
"""

STEP_TOML = """
[[steps]]
name = "{step}"
[steps.agent]
timeout_sec = {agent_timeout}
[steps.verifier]
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


def write_task(
    dataset: str,
    examples: list[dict[str, Any]],
    *,
    out_dir: Path,
    description: str,
    agent_timeout_sec: float,
) -> Path:
    task_dir = out_dir / dataset
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

    toml = [TASK_TOML_HEADER.format(dataset=dataset, description=_toml_string(description))]
    for example in examples:
        step = step_name(example["id"])
        step_dir = task_dir / "steps" / step
        (step_dir / "workdir").mkdir(parents=True)
        (step_dir / "instruction.md").write_text(user_instruction(example).rstrip() + "\n")
        (step_dir / "workdir" / "example.json").write_text(
            json.dumps(example, indent=2, ensure_ascii=False) + "\n"
        )
        toml.append(STEP_TOML.format(step=step, agent_timeout=agent_timeout_sec))
    (task_dir / "task.toml").write_text("".join(toml))
    return task_dir


def generate(
    *,
    out_dir: Path,
    datasets: list[str] | None,
    splits: list[str] | None,
    limit: int | None,
    agent_timeout_sec: float,
) -> list[Path]:
    """Write the selected datasets and remove task directories for any others."""
    names = datasets or sorted(path.stem for path in DATASETS_DIR.glob("*.yaml"))
    written: list[Path] = []
    for name in names:
        dataset = load_dataset(name)
        examples = example_records(dataset)
        if splits:
            examples = [e for e in examples if any(s in splits for s in e["splits"])]
        if limit is not None:
            examples = examples[:limit]
        if not examples:
            continue
        written.append(
            write_task(
                name,
                examples,
                out_dir=out_dir,
                description=dataset.description or f"PXI eval dataset {name}",
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
    steps = sum(len(list((task / "steps").iterdir())) for task in written)
    print(f"Generated {len(written)} task(s) with {steps} step(s) under {args.out}")


if __name__ == "__main__":
    main()
