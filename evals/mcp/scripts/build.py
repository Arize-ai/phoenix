"""Build the candidate Phoenix server and the benchmark container images."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[1]


def source_hash() -> str:
    """Fingerprint public benchmark inputs so prepared runs cannot silently go stale."""
    digest = hashlib.sha256()
    for path in sorted(HERE.rglob("*")):
        relative = path.relative_to(HERE)
        if any(part.startswith(".") or part == "__pycache__" for part in relative.parts):
            continue
        if (
            path.is_file()
            and path.suffix in {".py", ".toml", ".json", ".yaml", ".sh"}
            or path.name == "Dockerfile"
        ):
            digest.update(str(relative).encode())
            digest.update(path.read_bytes())
        elif path.name == "instruction.md":
            digest.update(str(relative).encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()


def build_images(*, target_source: Path = ROOT, target_ref: str | None = None) -> dict:
    """Build a working checkout or a git revision, including unreleased MCP changes."""
    config = tomllib.loads((HERE / "benchmark.toml").read_text())
    build_root = HERE / ".runtime"
    build_root.mkdir(exist_ok=True)
    context = Path(tempfile.mkdtemp(prefix="build-", dir=build_root))
    target_source = target_source.resolve()
    revision = subprocess.check_output(
        ["git", "-C", str(target_source), "rev-parse", target_ref or "HEAD"], text=True
    ).strip()
    candidate = target_source
    if target_ref:
        archive = context / "candidate.tar"
        with archive.open("wb") as stream:
            subprocess.run(
                ["git", "-C", str(target_source), "archive", revision], stdout=stream, check=True
            )
        candidate = context / "candidate"
        candidate.mkdir()
        with tarfile.open(archive) as bundle:
            bundle.extractall(candidate, filter="data")
    wheels = context / "wheels"
    subprocess.run(["uv", "build", "--wheel", "--out-dir", str(wheels), str(candidate)], check=True)
    (wheel,) = wheels.glob("arize_phoenix-*.whl")
    wheel_hash = hashlib.sha256(wheel.read_bytes()).hexdigest()
    shutil.copy(HERE / "environment/Dockerfile", context / "Dockerfile")
    (context / ".dockerignore").write_text("candidate/\ncandidate.tar\n")
    for directory in ("environment", "scoring", "tasks"):
        shutil.copytree(
            HERE / directory, context / directory, ignore=shutil.ignore_patterns("__pycache__")
        )
    fingerprint = source_hash()
    build_id = hashlib.sha256((fingerprint + wheel_hash).encode()).hexdigest()[:20]
    images = {}
    for name in ("agent-mcp", "agent-cli", "gateway", "target", "verifier"):
        tag = f"phoenix-mcp-bench-{name}:{build_id}"
        subprocess.run(
            [
                "docker",
                "build",
                "--target",
                name,
                "-t",
                tag,
                "--build-arg",
                "CLAUDE_VERSION=" + config["agents"]["claude-code"]["version"],
                "--build-arg",
                "CODEX_VERSION=" + config["agents"]["codex"]["version"],
                "--build-arg",
                "PX_VERSION=" + config["px_version"],
                str(context),
            ],
            check=True,
        )
        identity = json.loads(subprocess.check_output(["docker", "image", "inspect", tag]))[0]["Id"]
        images[name] = {"tag": tag, "id": identity}
    images["source"] = {
        "revision": revision,
        "working_tree": target_ref is None,
        "wheel_sha256": wheel_hash,
        "benchmark_sha256": fingerprint,
    }
    (context / "images.json").write_text(json.dumps(images, indent=2) + "\n")
    return images


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-source", type=Path, default=ROOT)
    parser.add_argument("--target-ref")
    args = parser.parse_args()
    print(
        json.dumps(
            build_images(target_source=args.target_source, target_ref=args.target_ref), indent=2
        )
    )
