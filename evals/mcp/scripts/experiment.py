"""Prepare the experiment, or launch the native Harbor CLI."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shlex
import shutil
import subprocess
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path

from evals.mcp.scripts.build import HERE, ROOT, build_images
from evals.mcp.scripts.stage import job_config, stage_tasks

PROVIDER_KEYS = {"codex": "OPENAI_API_KEY", "claude-code": "ANTHROPIC_API_KEY"}


def load_config(path: Path) -> dict:
    config = tomllib.loads(path.read_text())
    if not config.get("conditions"):
        raise ValueError("Configure at least one condition")
    for name, condition in config["conditions"].items():
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]*", name) or name == "oracle":
            raise ValueError(f"Invalid condition name: {name}")
        agent = condition["agent"]
        if agent not in PROVIDER_KEYS or agent not in config["agents"]:
            raise ValueError(f"Unsupported coding agent: {agent}")
        if condition["interface"] not in {"cli", "mcp", "none"}:
            raise ValueError("Condition interface must be cli, mcp or none")
        skills = []
        for value in condition.get("skills", []):
            skill = (path.resolve().parent / value).resolve()
            if not (skill / "SKILL.md").is_file():
                raise ValueError(f"Skill directory must contain SKILL.md: {skill}")
            skills.append(str(skill))
        if len({Path(skill).name for skill in skills}) != len(skills):
            raise ValueError(f"Duplicate skill directory names in {name}")
        condition["skills"] = skills
    return config


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
    benchmark = load_config(args.config)
    seed = args.seed.resolve()
    if not (seed / "manifest.json").is_file():
        command = [sys.executable, "-m", "evals.mcp.scripts.prepare_seed", "--output", str(seed)]
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
    output = args.output or HERE / ".private" / (
        "experiment-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    )
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    configs = output / "configs"
    configs.mkdir()
    for condition, selected in benchmark["conditions"].items():
        selected["skills"] = freeze_skills(selected["skills"], output / condition / "skills")
    images = build_images(
        config=benchmark,
        target_source=args.target_source,
        target_ref=args.target_ref,
        cli_package=args.cli_package,
    )
    images["label"] = args.label or output.name
    shutil.copyfile(args.config, output / "benchmark.toml")
    for condition, selected in benchmark["conditions"].items():
        interface = selected["interface"]
        provider = "anthropic" if selected["agent"] == "claude-code" else "openai"
        tasks = output / condition / "tasks"
        stage_tasks(
            manifest, tasks, images=images, seed=seed, interface=interface, provider=provider
        )
        config = job_config(
            condition, tasks=tasks, output=output, images=images, benchmark=benchmark
        )
        (configs / f"{condition}.json").write_text(
            config.model_dump_json(indent=2, exclude_unset=True)
        )
        if interface == "cli" and not (configs / "oracle.json").exists():
            oracle = job_config(
                condition,
                tasks=tasks,
                output=output,
                images=images,
                oracle=True,
                benchmark=benchmark,
            )
            (configs / "oracle.json").write_text(
                oracle.model_dump_json(indent=2, exclude_unset=True)
            )
    (output / "images.json").write_text(json.dumps(images, indent=2) + "\n")
    print(f"Prepared Harbor jobs: {output}")
    print(f'make mcp-run ARGS="--prepared {output} --oracle --task count-traces"')


def freeze_skills(sources: list[str], destination: Path) -> list[str]:
    """Copy the whole skill package so later edits cannot change a prepared run."""
    frozen = []
    for source in sources:
        target = destination / Path(source).name
        shutil.copytree(source, target, ignore=shutil.ignore_patterns(".git", "__pycache__"))
        frozen.append(str(target))
    return frozen


def require_completed_job(directory: Path) -> None:
    """Require completed trials with finite task-defined scores; zero is valid."""
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
    for trial in trials:
        rewards = (trial.get("verifier_result") or {}).get("rewards")
        if (
            trial.get("exception_info")
            or not isinstance(rewards, dict)
            or not rewards
            or any(
                type(value) not in (int, float) or not math.isfinite(value)
                for value in rewards.values()
            )
        ):
            raise RuntimeError(
                "A trial failed or has no task reward; inspect the saved Harbor result"
            )


def run(args: argparse.Namespace) -> None:
    prepared = args.prepared.resolve()
    images = json.loads((prepared / "images.json").read_text())
    available = {path.stem: path for path in (prepared / "configs").glob("*.json")}
    conditions = (
        ["oracle"]
        if args.oracle
        else args.condition or [name for name in sorted(available) if name != "oracle"]
    )
    if not conditions or any(name not in available for name in conditions):
        raise ValueError("Select a condition from the prepared configs directory")
    for condition in conditions:
        config = json.loads(available[condition].read_text())
        agent = config["agents"][0]["name"]
        provider = PROVIDER_KEYS.get(agent, "")
        if provider and not os.environ.get(provider):
            raise ValueError(f"Missing {provider}")
        command = [
            str(HERE / ".venv/bin/harbor"),
            "run",
            "--config",
            str(available[condition]),
            "--plugin",
            "arize-phoenix",
            "--plugin-kwarg",
            "trace_mode=atif",
            "--plugin-kwarg",
            "dataset=phoenix-mcp-benchmark" + ("-oracle" if agent == "oracle" else ""),
            "--plugin-kwarg",
            "experiment_name=" + images["label"] + " · " + condition,
            "--n-attempts",
            str(args.repetitions),
            "--yes",
        ]
        job_name = (
            prepared.name
            + "-"
            + condition
            + "-"
            + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        )
        command += ["--job-name", job_name]
        if args.task:
            # Harbor requires a dataset path alongside CLI task filters.
            command += ["--path", config["datasets"][0]["path"]]
        for task in args.task or []:
            command += ["--include-task-name", task]
        print(shlex.join(command), flush=True)
        subprocess.run(
            command, check=True, cwd=ROOT, env=run_environment(dict(os.environ), provider)
        )
        require_completed_job(Path(config["jobs_dir"]) / job_name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("prepare")
    setup.add_argument("--seed", type=Path, default=HERE / ".private/research-assistant")
    setup.add_argument("--input", type=Path)
    setup.add_argument("--target-source", type=Path, default=ROOT)
    setup.add_argument("--target-ref")
    setup.add_argument("--output", type=Path)
    setup.add_argument("--config", type=Path, default=HERE / "benchmark.toml")
    setup.add_argument("--cli-package", type=Path, help="Local npm pack .tgz for an unreleased CLI")
    setup.add_argument("--label", help="Human-readable prefix for Phoenix experiment names")
    launch = commands.add_parser("run")
    launch.add_argument("--prepared", type=Path, required=True)
    launch.add_argument("--condition", action="append")
    launch.add_argument("--task", action="append")
    launch.add_argument("--oracle", action="store_true")
    launch.add_argument("--repetitions", type=int, default=1)
    args = parser.parse_args()
    if getattr(args, "repetitions", 1) < 1:
        parser.error("repetitions must be positive")
    if args.command == "prepare":
        os.umask(0o077)
        prepare(args)
    else:
        run(args)


if __name__ == "__main__":
    main()
