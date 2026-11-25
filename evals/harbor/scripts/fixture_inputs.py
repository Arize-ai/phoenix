"""Resolve fixture inputs shared by staging and preflight."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

ROOT = Path(__file__).resolve().parents[3]
HERE = ROOT / "evals/harbor"
STAGE_STATUS = ".stage-status"


def list_fixture_inputs(task: Path) -> list[Path]:
    config = tomllib.loads((task / "task.toml").read_text())
    fixture = config.get("metadata", {}).get("fixture")
    if fixture == "phoenix-seed":
        paths = [task / "fixture/phoenix_seed.json", HERE / "environments/fixtures/seed_phoenix.py"]
    elif fixture in {"error-analysis", "prompt-hill-climb"}:
        paths = [HERE / "tasks/regression/fixtures" / fixture / "fixture.sh"]
    elif fixture == "trail":
        directory = HERE / "tasks/trail-benchmark-dev/fixtures"
        paths = [
            directory / "fixture.sh",
            directory / "download_trail.py",
            directory / "seed.py",
            ROOT / "scripts/load_patronus_trail.py",
        ]
    else:
        raise ValueError(f"{task}/task.toml has unknown fixture {fixture!r}")
    for path in paths:
        if not path.is_file():
            raise ValueError(f"{path} is missing; prepare the dataset's fixture inputs first")
    return paths


def hash_files(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def hash_phoenix_sources() -> str:
    return hash_files(
        sorted((ROOT / "src/phoenix").rglob("*.py"))
        + sorted((ROOT / "packages/phoenix-client/src").rglob("*.py"))
        + [
            ROOT / "pyproject.toml",
            ROOT / "packages/phoenix-client/pyproject.toml",
            ROOT / "uv.lock",
        ]
    )


def compute_fixture_key(task: Path, source_hash: str) -> str:
    return hash_files(list_fixture_inputs(task)) + "-" + source_hash
