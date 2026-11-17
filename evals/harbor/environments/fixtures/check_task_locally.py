"""Run an `eval-workflows` task's verifier against a local Phoenix, without Docker.

Seeds the task's `fixture/phoenix_seed.json` into a scratch database, serves it on a free port,
optionally runs the reference solution (`--solution`), then runs `tests/test.py` and
prints the reward. Without `--solution` this is a nop control: the verifier should
return reward 0. Paths that the task files hard-code (`/app`, `/solution`, `/tests`)
are mapped to scratch copies. The real check is still a Harbor oracle run in Docker.

    uv run python evals/harbor/environments/fixtures/check_task_locally.py response-evals --solution
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HARBOR = ROOT / "evals" / "harbor"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from seed_phoenix import seed, temporary_phoenix  # type: ignore[import-not-found]  # noqa: E402


def cached_fixture(seed_file: Path) -> Path:
    digest = hashlib.sha256(seed_file.read_bytes()).hexdigest()[:16]
    database = HARBOR / ".cache" / "fixtures" / f"phoenix-seed-{digest}" / "phoenix.db"
    if not database.exists():
        print(f"Seeding {seed_file} ...", file=sys.stderr)
        seed(seed_file, database)
    return database


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task", help="task directory name under tasks/eval-workflows")
    parser.add_argument("--solution", action="store_true", help="run solution/solve.sh first")
    parser.add_argument(
        "--evals",
        type=Path,
        help="copy this directory to /app/evals first, for example an agent's eval code",
    )
    parser.add_argument("--run", help="shell command to run in /app before grading")
    parser.add_argument("--suite", default="eval-workflows")
    args = parser.parse_args()
    task = HARBOR / "tasks" / args.suite / args.task
    database = cached_fixture(task / "fixture" / "phoenix_seed.json")
    with tempfile.TemporaryDirectory(prefix=f"local-{args.task}-") as scratch_name:
        scratch = Path(scratch_name)
        shutil.copy(database, scratch / "phoenix.db")
        app = scratch / "app"
        shutil.copytree(task / "workdir", app) if (task / "workdir").exists() else app.mkdir()
        tests = scratch / "tests"
        shutil.copytree(task / "tests", tests)
        solution = scratch / "solution"
        shutil.copytree(task / "solution", solution)
        with temporary_phoenix(scratch / "phoenix.db") as base:
            env = {
                **os.environ,
                "PHOENIX_BASE_URL": base,
                "PHOENIX_COLLECTOR_ENDPOINT": base,
                "PHOENIX_EVAL_URL": base,
                "PHOENIX_EVAL_REWARD_PATH": str(scratch / "logs" / "reward.json"),
                "PHOENIX_EVAL_TRAJECTORY_PATH": str(scratch / "logs" / "trajectory.json"),
                "TASK_APP_DIR": str(app),
                "TASK_TESTS_DIR": str(tests),
                "PYTHONPATH": str(HARBOR / "verifiers"),
            }
            if args.solution:
                script = (solution / "solve.sh").read_text()
                for container, local in (("/app", app), ("/solution", solution)):
                    script = script.replace(container, str(local))
                subprocess.run(["sh", "-c", script], cwd=app, env=env, check=True)
            if args.evals:
                shutil.copytree(args.evals, app / "evals", dirs_exist_ok=True)
            if args.run:
                subprocess.run(["sh", "-c", args.run], cwd=app, env=env, check=False)
            test = (tests / "test.py").read_text().replace("/tests", str(tests))
            subprocess.run([sys.executable, "-c", test], cwd=app, env=env, check=True)
            details = scratch / "logs" / "details.json"
            if details.exists():
                print(details.read_text())


if __name__ == "__main__":
    main()
