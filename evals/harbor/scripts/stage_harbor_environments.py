# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml", "tomli; python_version < '3.11'"]
# ///
"""Prepare the tasks and CLI archive selected by a Harbor job."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from evals.harbor.scripts.check_job_staged import requires_cli_archive, select_job_tasks  # noqa: E402
from evals.harbor.scripts.fixture_inputs import (  # noqa: E402
    HERE,
    ROOT,
    STAGE_STATUS,
    compute_environment_key,
    compute_fixture_key,
    hash_phoenix_sources,
    list_fixture_inputs,
)


def build_context() -> Path:
    cache = HERE / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    context = Path(tempfile.mkdtemp(prefix="environment-", dir=cache))
    wheels = context / "wheels"
    subprocess.run(["uv", "build", "--wheel", "--out-dir", str(wheels)], cwd=ROOT, check=True)
    subprocess.run(
        ["uv", "build", "--wheel", "--out-dir", str(wheels), str(HERE / "verifiers")],
        cwd=ROOT,
        check=True,
    )
    shutil.copy2(HERE / "environments/Dockerfile", context)
    shutil.copytree(
        HERE / "environments/container_assets",
        context / "container_assets",
        ignore=shutil.ignore_patterns("__pycache__"),
    )
    return context


def prepare_fixture(task: Path, key: str, reseed: bool) -> Path:
    cache = HERE / ".cache/fixtures" / key
    cache.mkdir(parents=True, exist_ok=True)
    current = cache / "current"
    if not reseed and (current / "phoenix.db").is_file():
        return current / "phoenix.db"
    generation = Path(tempfile.mkdtemp(prefix="generation-", dir=cache))
    inputs = list_fixture_inputs(task)
    if inputs[0].name == "phoenix_seed.json":
        command = [
            "uv",
            "run",
            "python",
            str(inputs[1]),
            "--seed",
            str(inputs[0]),
            "--output",
            str(generation / "phoenix.db"),
        ]
    else:
        script = next(path for path in inputs if path.name == "fixture.sh")
        command = ["bash", str(script), str(generation)]
    subprocess.run(command, cwd=ROOT, check=True)
    if not (generation / "phoenix.db").is_file():
        raise ValueError(f"Fixture for {task} did not produce phoenix.db")
    pointer = generation / "current"
    pointer.symlink_to(generation, target_is_directory=True)
    pointer.replace(current)
    return generation / "phoenix.db"


def stage_task(task: Path, context: Path, database: Path, key: str) -> None:
    cache = HERE / ".cache/task-environments"
    cache.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix="environment-", dir=cache))
    shutil.copytree(context, staged, dirs_exist_ok=True, copy_function=os.link)
    if (task / "workdir").is_dir():
        shutil.copytree(
            task / "workdir", staged / "workdir", ignore=shutil.ignore_patterns("__pycache__")
        )
    else:
        (staged / "workdir").mkdir()
    if not any((staged / "workdir").iterdir()):
        (staged / "workdir/.keep").touch()
    (staged / "data").mkdir()
    shutil.copy2(database, staged / "data/phoenix.db")
    (staged / STAGE_STATUS).write_text(key)
    publish_directory(staged, task / "environment", cache)


def publish_directory(staged: Path, destination: Path, cache: Path) -> None:
    if destination.exists():
        previous = Path(tempfile.mkdtemp(prefix=f"previous-{destination.parent.name}-", dir=cache))
        destination.rename(previous / destination.name)
    destination.parent.mkdir(parents=True, exist_ok=True)
    staged.rename(destination)


def build_client_wheel() -> None:
    cache = HERE / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    wheels = Path(tempfile.mkdtemp(prefix="client-", dir=cache))
    subprocess.run(
        ["uv", "build", "--wheel", "packages/phoenix-client", "--out-dir", str(wheels)],
        cwd=ROOT,
        check=True,
    )
    publish_directory(wheels, ROOT / "dist/phoenix-client", cache)


def mark_tasks_incomplete(tasks: list[Path]) -> None:
    for task in tasks:
        environment = task / "environment"
        environment.mkdir(parents=True, exist_ok=True)
        (environment / STAGE_STATUS).write_text("incomplete")


def prepare_tasks(tasks: list[Path], reseed: bool) -> None:
    mark_tasks_incomplete(tasks)
    source_hash = hash_phoenix_sources()
    keys = {task: compute_fixture_key(task, source_hash) for task in tasks}
    context = build_context()
    databases: dict[str, Path] = {}
    for task in tasks:
        key = keys[task]
        if key not in databases:
            databases[key] = prepare_fixture(task, key, reseed)
        stage_task(task, context, databases[key], compute_environment_key(task, key))
    print(f"Staged {len(tasks)} task(s).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", type=Path)
    parser.add_argument("--agents-replaced", action="store_true")
    args = parser.parse_args()
    if os.environ.get("HARBOR_TASKS_DIR"):
        parser.error("Use HARBOR_JOB to select tasks for both harbor-stage and harbor-run")
    job = yaml.safe_load(args.job.read_text()) or {}
    tasks: list[Path] = []
    complete = False
    try:
        tasks = select_job_tasks(job)
        cli = os.environ.get("HARBOR_CLI", "auto")
        if cli not in {"auto", "0", "1"}:
            raise ValueError("HARBOR_CLI must be auto, 0, or 1")
        prepare_tasks(tasks, reseed=os.environ.get("RESEED") == "1")
        if not os.environ.get("HARBOR_CLIENT_VERSION"):
            build_client_wheel()
        if cli == "1" or (cli == "auto" and requires_cli_archive(job, args.agents_replaced)):
            subprocess.run([str(HERE / "scripts/build_phoenix_cli_archive.sh")], check=True)
        complete = True
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        return 1
    finally:
        if not complete:
            mark_tasks_incomplete(tasks)
    return 0


if __name__ == "__main__":
    sys.exit(main())
