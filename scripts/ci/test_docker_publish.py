import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_ACTION = REPO_ROOT / ".github/actions/docker-build-image"
MERGE_ACTION = REPO_ROOT / ".github/actions/docker-merge-manifest"


def read_action_step(*, action: Path, name: str) -> dict[str, Any]:
    definition = yaml.safe_load((action / "action.yml").read_text())
    return next(step for step in definition["runs"]["steps"] if step["name"] == name)


def run_action_step(
    *, action: Path, name: str, env: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    step = read_action_step(action=action, name=name)
    return subprocess.run(
        ["bash", "-c", step["run"]],
        cwd=REPO_ROOT,
        env={**os.environ, **env},
        text=True,
        capture_output=True,
        check=False,
    )


@pytest.fixture
def docker_env(tmp_path: Path) -> dict[str, str]:
    executable = tmp_path / "docker"
    executable.write_text(
        f"#!{sys.executable}\n"
        + """import csv
import json
import os
import sys
from pathlib import Path

arguments = sys.argv[1:]
base_image = (
    arguments[arguments.index("--build-arg") + 1].partition("=")[2]
    if "--build-arg" in arguments else os.environ.get("BASE_IMAGE")
)
with open(os.environ["DOCKER_CALLS"], "a") as output:
    output.write(json.dumps({"args": arguments, "base": base_image}) + "\\n")
if arguments[:2] in (["buildx", "build"], ["buildx", "bake"]):
    if os.environ.get("FAIL_BASE") == base_image:
        sys.exit(1)
    if arguments[1] == "build":
        exporter = next(csv.reader([arguments[arguments.index("--output") + 1]]))
        archive_path = next(
            field.removeprefix("dest=") for field in exporter if field.startswith("dest=")
        )
        metadata = {"containerimage.digest": "sha256:" + "a" * 64}
    else:
        archive_path = os.environ["ARCHIVE_PATH"]
        metadata = {arguments[-1]: {"containerimage.digest": "sha256:" + "a" * 64}}
    Path(archive_path).write_bytes(b"oci archive fixture")
    Path(arguments[arguments.index("--metadata-file") + 1]).write_text(json.dumps(metadata))
if arguments[:3] == ["buildx", "imagetools", "inspect"]:
    print(os.environ["MANIFEST_JSON"])
"""
    )
    executable.chmod(0o755)
    copy_executable = tmp_path / "skopeo"
    copy_executable.write_text(
        f"#!{sys.executable}\n"
        + """import json
import os
import sys
from pathlib import Path

arguments = sys.argv[1:]
with open(os.environ["COPY_CALLS"], "a") as output:
    output.write(json.dumps(arguments) + "\\n")
if os.environ.get("FAIL_REGISTRY", "blocked.invalid") in arguments[-1]:
    sys.exit(1)
if not Path(arguments[-2].removeprefix("oci-archive:")).exists():
    sys.exit(2)
"""
    )
    copy_executable.chmod(0o755)
    return {
        "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
        "RUNNER_TEMP": str(tmp_path),
        "GITHUB_OUTPUT": str(tmp_path / "outputs"),
        "DOCKER_CALLS": str(tmp_path / "calls.jsonl"),
        "COPY_CALLS": str(tmp_path / "copies.jsonl"),
    }


def read_docker_calls(env: dict[str, str]) -> list[dict[str, Any]]:
    path = Path(env["DOCKER_CALLS"])
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def test_build_exports_once_per_variant_without_registry_uploads(
    docker_env: dict[str, str],
) -> None:
    result = run_action_step(
        action=BUILD_ACTION,
        name="Build each variant as an OCI archive",
        env={
            **docker_env,
            "VARIANTS": "root nonroot debug",
            "PLATFORM": "linux/amd64",
            "LABELS": "org.opencontainers.image.revision=abc123",
        },
    )
    assert result.returncode == 0, result.stderr
    calls = read_docker_calls(docker_env)
    assert len(calls) == 3
    assert {call["base"] for call in calls} == {
        "gcr.io/distroless/python3-debian13",
        "gcr.io/distroless/python3-debian13:nonroot",
        "gcr.io/distroless/python3-debian13:debug",
    }
    for call in calls:
        assert call["args"][:2] == ["buildx", "build"]
        exporter = call["args"][call["args"].index("--output") + 1]
        assert exporter.startswith("type=oci,dest=")
        assert "push=" not in exporter
    for variant in ("root", "nonroot", "debug"):
        directory = Path(docker_env["RUNNER_TEMP"]) / "images" / variant / "linux-amd64"
        assert (directory / "digest").read_text().strip() == "sha256:" + "a" * 64
        assert (directory / "image.tar").exists()
    assert not Path(docker_env["COPY_CALLS"]).exists()


def test_failed_variant_does_not_withhold_other_digests(docker_env: dict[str, str]) -> None:
    result = run_action_step(
        action=BUILD_ACTION,
        name="Build each variant as an OCI archive",
        env={
            **docker_env,
            "VARIANTS": "root nonroot debug",
            "PLATFORM": "linux/amd64",
            "LABELS": "org.opencontainers.image.revision=abc123",
            "FAIL_BASE": "gcr.io/distroless/python3-debian13:nonroot",
        },
    )
    assert result.returncode == 0, result.stderr
    assert Path(docker_env["GITHUB_OUTPUT"]).read_text() == "failed=nonroot\n"
    digests = Path(docker_env["RUNNER_TEMP"]) / "images"
    assert {digest.parent.parent.name for digest in digests.glob("*/*/digest")} == {"root", "debug"}
    assert not (digests / "nonroot/linux-amd64/image.tar").exists()
    failure = run_action_step(
        action=BUILD_ACTION,
        name="Report failed variants",
        env={**docker_env, "FAILED": "nonroot", "PLATFORM": "linux/amd64"},
    )
    assert failure.returncode != 0


def write_platform_images(*, env: dict[str, str], num_platforms: int) -> list[str]:
    digests = ["sha256:" + "a" * 64, "sha256:" + "b" * 64][:num_platforms]
    for platform, digest in zip(["linux-amd64", "linux-arm64"], digests):
        directory = Path(env["RUNNER_TEMP"]) / "images" / platform
        directory.mkdir(parents=True)
        (directory / "digest").write_text(digest)
        (directory / "image.tar").write_bytes(b"oci archive fixture")
    return digests


@pytest.mark.parametrize("failed_registry", ["ghcr.io/arize-ai/phoenix", "arizephoenix/phoenix"])
def test_registry_failure_does_not_block_other_upload(
    docker_env: dict[str, str], failed_registry: str
) -> None:
    digests = write_platform_images(env=docker_env, num_platforms=2)
    other_registry = (
        "arizephoenix/phoenix"
        if failed_registry.startswith("ghcr.io/")
        else "ghcr.io/arize-ai/phoenix"
    )
    for repository, success in [(failed_registry, False), (other_registry, True)]:
        result = run_action_step(
            action=MERGE_ACTION,
            name="Create manifest list and push",
            env={
                **docker_env,
                "EXPECTED_DIGESTS": "2",
                "TAGS": f"{repository}:nightly\n{repository}:commit-1234567",
                "FAIL_REGISTRY": failed_registry,
            },
        )
        assert (result.returncode == 0) is success, result.stderr
    copies = [json.loads(line) for line in Path(docker_env["COPY_CALLS"]).read_text().splitlines()]
    assert [arguments[-1] for arguments in copies] == [
        f"docker://{failed_registry}@{digests[0]}",
        *(f"docker://{other_registry}@{digest}" for digest in digests),
    ]
    assert all("--all" in arguments and "--preserve-digests" in arguments for arguments in copies)
    calls = read_docker_calls(docker_env)
    assert len(calls) == 1
    assert calls[0]["args"][-2:] == [f"{other_registry}@{digest}" for digest in digests]


def test_manifest_refuses_incomplete_platforms(docker_env: dict[str, str]) -> None:
    write_platform_images(env=docker_env, num_platforms=1)
    result = run_action_step(
        action=MERGE_ACTION,
        name="Create manifest list and push",
        env={**docker_env, "EXPECTED_DIGESTS": "2", "TAGS": "ghcr.io/arize-ai/phoenix:nightly"},
    )
    assert result.returncode != 0
    assert "expected 2 platform images, found 1" in result.stderr
    assert read_docker_calls(docker_env) == []
    assert not Path(docker_env["COPY_CALLS"]).exists()


def test_publisher_refuses_multiple_registries_in_one_job(docker_env: dict[str, str]) -> None:
    write_platform_images(env=docker_env, num_platforms=2)
    result = run_action_step(
        action=MERGE_ACTION,
        name="Create manifest list and push",
        env={
            **docker_env,
            "EXPECTED_DIGESTS": "2",
            "TAGS": "arizephoenix/phoenix:nightly\nghcr.io/arize-ai/phoenix:nightly",
        },
    )
    assert result.returncode != 0
    assert "each publishing job must target one image repository" in result.stderr
    assert not Path(docker_env["COPY_CALLS"]).exists()


@pytest.mark.parametrize("workflow", ["docker-build-nightly.yml", "docker-build-release.yml"])
def test_workflow_schedules_registries_independently(workflow: str) -> None:
    jobs = yaml.safe_load((REPO_ROOT / ".github/workflows" / workflow).read_text())["jobs"]
    for name in ("merge", "merge-ghcr"):
        needs = jobs[name]["needs"]
        dependencies = [needs] if isinstance(needs, str) else needs
        assert "build" in dependencies
        assert "merge" not in dependencies and "merge-ghcr" not in dependencies
        assert jobs[name]["strategy"]["fail-fast"] is False
    assert jobs["merge"]["env"]["REGISTRY"] == "arizephoenix"
    assert jobs["merge-ghcr"]["env"]["REGISTRY"] == "ghcr.io/arize-ai"
    if "update-self-deployment" in jobs:
        assert "merge" in jobs["update-self-deployment"]["needs"]
        assert "merge-ghcr" not in jobs["update-self-deployment"]["needs"]


@pytest.mark.parametrize(
    "architectures,expected_count,success",
    [
        (["amd64", "arm64", "unknown"], 2, True),
        (["amd64", "unknown"], 1, True),
        (["amd64", "unknown"], 2, False),
        (["amd64", "amd64"], 2, False),
    ],
)
def test_verifies_platforms_ignoring_attestations(
    docker_env: dict[str, str], architectures: list[str], expected_count: int, success: bool
) -> None:
    manifests = [
        {
            "platform": {
                "os": "unknown" if architecture == "unknown" else "linux",
                "architecture": architecture,
            }
        }
        for architecture in architectures
    ]
    result = run_action_step(
        action=MERGE_ACTION,
        name="Verify published platforms",
        env={
            **docker_env,
            "TAGS": "arizephoenix/phoenix:nightly\nghcr.io/arize-ai/phoenix:nightly",
            "EXPECTED_DIGESTS": str(expected_count),
            "MANIFEST_JSON": json.dumps({"manifests": manifests}),
        },
    )
    assert (result.returncode == 0) is success, result.stderr
    if success:
        assert len(read_docker_calls(docker_env)) == 2
