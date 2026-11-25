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
        paths = [HERE / "datasets/regression/fixtures" / fixture / "fixture.sh"]
    elif fixture == "trail":
        directory = HERE / "datasets/trail-benchmark-dev/fixtures"
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
        files = (
            sorted(
                child
                for child in path.rglob("*")
                if child.is_file() and "__pycache__" not in child.parts
            )
            if path.is_dir()
            else [path]
        )
        for file in files:
            name = str(file.relative_to(path)) if path.is_dir() else path.name
            digest.update(name.encode() + b"\0")
            digest.update(str(file.stat().st_mode & 0o777).encode() + b"\0")
            digest.update(file.read_bytes() + b"\0")
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


def compute_environment_key(task: Path, fixture_key: str) -> str:
    paths = [
        HERE / "environments/Dockerfile",
        HERE / "environments/container_assets",
        HERE / "verifiers/pyproject.toml",
        HERE / "verifiers/harbor_verifiers",
        task / "task.toml",
    ]
    if (task / "workdir").exists():
        paths.append(task / "workdir")
    return hashlib.sha256((fixture_key + hash_files(paths)).encode()).hexdigest()
