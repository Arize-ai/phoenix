# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml", "pydantic"]
# ///
"""Write the ``harbor exec`` configuration that compiles one task per PXI eval example.

``harbor exec`` is Harbor's map step: it cross-products instruction variants with one
environment and one verifier, so each example becomes an instruction and the task
template, the staged environment, and the Reward Kit ``tests/`` directory are shared.
The job settings come from ``evals/harbor/jobs/pxi.yaml`` so the two paths stay aligned.

    uv run python -m evals.harbor.pxi.exec_config --out evals/harbor/.cache/pxi-exec.yaml \
        --environment-dir evals/harbor/.cache/pxi-environment
    make harbor-exec

``harbor exec`` 0.21 has no ``--plugin`` option. To record a run in Phoenix, run the
compiled tasks under ``--tasks-dir`` (default ``evals/harbor/.cache/pxi-exec-tasks``)
with ``harbor run -p``.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import yaml

from evals.harbor.pxi.compile_tasks import select_examples
from evals.harbor.pxi.examples import render_instruction

HERE = Path(__file__).resolve().parent
TASK_TEMPLATE_DIR = HERE / "task_template"
TESTS_DIR = HERE / "tests"
JOB_PATH = HERE.parent / "jobs" / "pxi.yaml"
ARTIFACTS = ["/var/lib/phoenix-eval/server.log"]
TASK_NAME_PREFIX = "pxi"
# Config mode needs an output directory; only flags mode compiles into a temporary one.
TASKS_DIR = HERE.parent / ".cache" / "pxi-exec-tasks"


def load_job(path: Path = JOB_PATH) -> dict[str, Any]:
    job = yaml.safe_load(path.read_text())
    if not isinstance(job, dict):
        raise ValueError(f"{path} must hold a mapping")
    return job


def exec_config(
    examples: list[dict[str, Any]],
    *,
    environment_dir: Path,
    job: dict[str, Any],
    tasks_dir: Path = TASKS_DIR,
    job_name: str | None = None,
) -> dict[str, Any]:
    """The ExecConfig mapping: one instruction per example, shared template and verifier."""
    if not examples:
        raise ValueError("no examples selected")
    map_job = {key: value for key, value in job.items() if key != "datasets"}
    if job_name is not None:
        map_job["job_name"] = job_name
    compile: dict[str, Any] = {
        "task_name_prefix": TASK_NAME_PREFIX,
        "output_dir": str(tasks_dir.resolve()),
        "task_template": str(TASK_TEMPLATE_DIR),
        "artifacts": list(ARTIFACTS),
        "instructions": [{"text": render_instruction(example)} for example in examples],
        "environments": [{"path": str(environment_dir.resolve())}],
        "verifiers": [{"path": str(TESTS_DIR)}],
    }
    return {"schema_version": "1.0", "map": {"compile": compile, "job": map_job}}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("evals/harbor/.cache/pxi-exec.yaml"))
    parser.add_argument(
        "--environment-dir", type=Path, default=Path("evals/harbor/.cache/pxi-environment")
    )
    parser.add_argument("--job", type=Path, default=JOB_PATH, help="job file for map.job")
    parser.add_argument("--job-name", default=None)
    parser.add_argument(
        "--tasks-dir", type=Path, default=TASKS_DIR, help="write the compiled tasks here"
    )
    parser.add_argument("--datasets", nargs="*", default=None, help="dataset stems; default all")
    parser.add_argument("--splits", nargs="*", default=None, help="keep only these splits")
    parser.add_argument("--limit", type=int, default=None, help="keep the first N examples")
    args = parser.parse_args(argv)
    examples = [example for example, _ in select_examples(args.datasets, args.splits, args.limit)]
    config = exec_config(
        examples,
        environment_dir=args.environment_dir,
        job=load_job(args.job),
        tasks_dir=args.tasks_dir,
        job_name=args.job_name,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(yaml.safe_dump(config, sort_keys=False))
    print(f"Wrote {args.out} with {len(examples)} task(s)")


if __name__ == "__main__":
    main()
