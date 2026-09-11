"""Prepare the experiment, check its source, or launch the native Harbor CLI."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from evals.mcp.scripts.build import HERE, ROOT, build_images, source_hash
from evals.mcp.scripts.stage import CONDITIONS, job_config, stage_tasks


def run_environment(source: dict[str, str], provider_key: str) -> dict[str, str]:
    """Keep Docker and results settings without importing personal coding-agent logins."""
    allowed = {
        "PATH",
        "HOME",
        "LANG",
        "LC_ALL",
        "TZ",
        "TMPDIR",
        "DOCKER_HOST",
        "DOCKER_CONTEXT",
        "DOCKER_CONFIG",
        "PHOENIX_API_KEY",
        "PHOENIX_COLLECTOR_ENDPOINT",
        provider_key,
    }
    return {key: value for key, value in source.items() if key in allowed}


def prepare(args: argparse.Namespace) -> None:
    seed = args.seed.resolve()
    if not (seed / "manifest.json").is_file():
        command = [sys.executable, "-m", "evals.mcp.scripts.prepare", "--output", str(seed)]
        if args.input:
            command += ["--input", str(args.input)]
        subprocess.run(command, check=True)
    elif args.input:
        raise ValueError("Use a new seed directory when supplying --input")
    from evals.mcp.environment.seed import validate_seed

    manifest = json.loads((seed / "manifest.json").read_text())
    validate_seed(
        json.loads((seed / "payload.json").read_text()),
        manifest,
        json.loads((seed / "truth.json").read_text()),
    )
    images = build_images(target_source=args.target_source, target_ref=args.target_ref)
    output = args.output or HERE / ".private" / (
        "experiment-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    )
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    for condition in CONDITIONS:
        interface = condition.rsplit("-", 1)[1]
        provider = "anthropic" if condition.startswith("claude") else "openai"
        tasks = output / condition / "tasks"
        stage_tasks(
            manifest, tasks, images=images, seed=seed, interface=interface, provider=provider
        )
        config = job_config(condition, tasks=tasks, output=output, images=images)
        (output / f"{condition}.json").write_text(
            config.model_dump_json(indent=2, exclude_unset=True)
        )
        if condition == "codex-cli":
            oracle = job_config(condition, tasks=tasks, output=output, images=images, oracle=True)
            (output / "oracle.json").write_text(
                oracle.model_dump_json(indent=2, exclude_unset=True)
            )
    (output / "images.json").write_text(json.dumps(images, indent=2) + "\n")
    print(f"Prepared Harbor jobs: {output}")
    print(f'make mcp-run ARGS="--prepared {output} --oracle --task count-traces"')


def check() -> None:
    tests = ROOT / "tests/evals/mcp"
    for command in (
        [sys.executable, "-m", "ruff", "format", "--check", str(HERE), str(tests)],
        [sys.executable, "-m", "ruff", "check", str(HERE), str(tests)],
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-c",
            str(HERE / "pyproject.toml"),
            "--confcutdir=" + str(tests),
            str(tests),
        ],
        [sys.executable, "-m", "mypy", "--config-file", str(HERE / "pyproject.toml")],
        [
            str(ROOT / ".venv/bin/python"),
            "-m",
            "pytest",
            "-q",
            "-c",
            str(HERE / "pyproject.toml"),
            "--confcutdir=" + str(tests),
            "-o",
            "addopts=",
            str(tests / "integration"),
        ],
    ):
        subprocess.run(
            command,
            check=True,
            env=os.environ
            | {
                "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
                "PYTEST_ADDOPTS": "-p pytest_asyncio.plugin",
                "PYTHONPATH": str(ROOT),
            },
        )


def require_completed_job(directory: Path) -> None:
    """Stop on incomplete or failed trials; a correctness reward of zero is valid."""
    result = json.loads((directory / "result.json").read_text())
    stats = result["stats"]
    trials = [json.loads(path.read_text()) for path in directory.glob("*/result.json")]
    if (
        not trials
        or len(trials) != result["n_total_trials"]
        or stats["n_errored_trials"]
        or stats["n_completed_trials"] != result["n_total_trials"]
    ):
        raise RuntimeError("Harbor did not complete every trial; inspect the job in Phoenix")
    if any(
        trial.get("exception_info")
        or (trial.get("verifier_result") or {}).get("rewards", {}).get("reward") not in (0, 1)
        for trial in trials
    ):
        raise RuntimeError("A trial failed or has no task reward; inspect the saved Harbor result")


def run(args: argparse.Namespace) -> None:
    prepared = args.prepared.resolve()
    images = json.loads((prepared / "images.json").read_text())
    if images["source"]["benchmark_sha256"] != source_hash():
        raise ValueError(
            "Benchmark source changed. Run make mcp-prepare to build a new experiment."
        )
    conditions = ["oracle"] if args.oracle else args.condition or list(CONDITIONS)
    for condition in conditions:
        provider = "ANTHROPIC_API_KEY" if condition.startswith("claude") else "OPENAI_API_KEY"
        if not args.oracle and not os.environ.get(provider):
            raise ValueError(f"Missing {provider}")
        command = [
            str(HERE / ".venv/bin/harbor"),
            "run",
            "--config",
            str(prepared / f"{condition}.json"),
            "--plugin",
            "arize-phoenix",
            "--plugin-kwarg",
            "trace_mode=atif",
            "--plugin-kwarg",
            "dataset=phoenix-mcp-benchmark" + ("-oracle" if args.oracle else ""),
            "--n-attempts",
            str(args.repetitions),
            "--yes",
        ]
        tasks_path = prepared / ("codex-cli" if args.oracle else condition) / "tasks"
        job_name = (
            prepared.name
            + "-"
            + condition
            + "-"
            + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        )
        command += [
            "--path",
            str(tasks_path),
            "--job-name",
            job_name,
        ]
        if not args.task:
            command += ["--exclude-task-name", "noop-surface-cost"]
        for task in args.task or []:
            command += ["--include-task-name", task]
        print(shlex.join(command), flush=True)
        subprocess.run(
            command, check=True, cwd=ROOT, env=run_environment(dict(os.environ), provider)
        )
        require_completed_job(prepared / "jobs" / job_name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("prepare")
    setup.add_argument("--seed", type=Path, default=HERE / ".private/research-assistant")
    setup.add_argument("--input", type=Path)
    setup.add_argument("--target-source", type=Path, default=ROOT)
    setup.add_argument("--target-ref")
    setup.add_argument("--output", type=Path)
    commands.add_parser("check")
    launch = commands.add_parser("run")
    launch.add_argument("--prepared", type=Path, required=True)
    launch.add_argument("--condition", choices=CONDITIONS, action="append")
    launch.add_argument("--task", action="append")
    launch.add_argument("--oracle", action="store_true")
    launch.add_argument("--repetitions", type=int, default=1)
    args = parser.parse_args()
    if getattr(args, "repetitions", 1) < 1:
        parser.error("repetitions must be positive")
    if args.command == "prepare":
        os.umask(0o077)
        prepare(args)
    elif args.command == "check":
        check()
    else:
        run(args)


if __name__ == "__main__":
    main()
