"""Build the candidate Phoenix server and the benchmark container images."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[1]


def build_images(
    *,
    config: dict,
    target_source: Path = ROOT,
    target_ref: str | None = None,
    cli_package: Path | None = None,
) -> dict:
    """Build a working checkout or a git revision, including unreleased MCP changes."""
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
    (context / "cli-package").mkdir()
    cli_hash = None
    cli_version = config["px_version"]
    if cli_package is not None:
        # npm pack output is installed during the build, never during a trial.
        with tarfile.open(cli_package) as package:
            member = package.extractfile("package/package.json")
            metadata = json.load(member) if member is not None else {}
            if metadata.get("name") != "@arizeai/phoenix-cli":
                raise ValueError("--cli-package must be a packed @arizeai/phoenix-cli package")
            cli_version = metadata["version"]
        cli_hash = hashlib.sha256(cli_package.read_bytes()).hexdigest()
        shutil.copyfile(cli_package, context / "cli-package/phoenix-cli.tgz")
    (context / ".dockerignore").write_text("candidate/\ncandidate.tar\n")
    for directory in ("environment", "scoring"):
        shutil.copytree(
            HERE / directory, context / directory, ignore=shutil.ignore_patterns("__pycache__")
        )
    images = {}
    for name in ("agent-mcp", "agent-cli", "target", "verifier"):
        tag = f"phoenix-mcp-bench-{name}:{context.name}"
        subprocess.run(
            [
                "docker",
                "build",
                "--target",
                name,
                "-t",
                tag,
                "--build-arg",
                "CLAUDE_VERSION=" + config["agents"].get("claude-code", {}).get("version", ""),
                "--build-arg",
                "CODEX_VERSION=" + config["agents"].get("codex", {}).get("version", ""),
                "--build-arg",
                "PX_VERSION=" + config["px_version"],
                "--build-arg",
                "PX_PACKAGE="
                + ("/opt/benchmark/cli-package/phoenix-cli.tgz" if cli_package else ""),
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
        "cli_package_sha256": cli_hash,
        "cli_version": cli_version,
    }
    return images
