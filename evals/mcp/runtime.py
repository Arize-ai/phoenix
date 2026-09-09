"""Build the unreleased ATIF client and completeness evaluator from pinned git content."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / "configs/runtime.json").read_text())


def build() -> None:
    destination = HERE / ".runtime"
    source = destination / "source"
    destination.mkdir(exist_ok=True)
    revision = CONFIG["phoenix_revision"]
    # git archive excludes worktree edits and fixes timestamps to the commit time.
    archive = destination / "source.tar"
    with archive.open("wb") as output:
        subprocess.run(
            ["git", "archive", revision, "packages/phoenix-client", "packages/phoenix-evals"],
            cwd=ROOT,
            stdout=output,
            check=True,
        )
    with tarfile.open(archive) as bundle:
        bundle.extractall(source, filter="data")
    wheels = []
    for package in ("phoenix-client", "phoenix-evals"):
        output = destination / package
        subprocess.run(
            [
                "uv",
                "build",
                "--wheel",
                "--out-dir",
                str(output),
                str(source / "packages" / package),
            ],
            check=True,
        )
        (wheel,) = output.glob("*.whl")
        wheels.append(wheel)
    manifest = {
        "phoenix_revision": revision,
        "wheels": [
            {"path": str(p.relative_to(HERE)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in wheels
        ],
    }
    (destination / "build.json").write_text(json.dumps(manifest, indent=2) + "\n")
    subprocess.run(
        [
            "uv",
            "pip",
            "install",
            "--python",
            str(HERE / ".venv/bin/python"),
            "--no-deps",
            "--reinstall",
            *map(str, wheels),
        ],
        check=True,
    )


if __name__ == "__main__":
    build()
