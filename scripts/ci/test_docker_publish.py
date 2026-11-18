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
        + """import json
import os
import sys
from pathlib import Path

arguments = sys.argv[1:]
base_image = (
    arguments[arguments.index("--build-arg") + 1].partition("=")[2]
    if "--build-arg" in arguments else None
)
with open(os.environ["DOCKER_CALLS"], "a") as output:
    output.write(json.dumps({
        "args": arguments,
        "images": os.environ.get("IMAGE_NAMES"),
        "base": base_image,
    }) + "\\n")
if arguments[:2] == ["buildx", "build"]:
    if os.environ.get("FAIL_BASE") == base_image:
        sys.exit(1)
    metadata = {"containerimage.digest": "sha256:" + "a" * 64}
    Path(arguments[arguments.index("--metadata-file") + 1]).write_text(json.dumps(metadata))
if arguments[:3] == ["buildx", "imagetools", "inspect"]:
    print(os.environ["MANIFEST_JSON"])
"""
    )
    executable.chmod(0o755)
    return {
        "PATH": f"{tmp_path}{os.pathsep}{os.environ['PATH']}",
        "RUNNER_TEMP": str(tmp_path),
        "GITHUB_OUTPUT": str(tmp_path / "outputs"),
        "DOCKER_CALLS": str(tmp_path / "calls.jsonl"),
    }


def read_docker_calls(env: dict[str, str]) -> list[dict[str, Any]]:
    path = Path(env["DOCKER_CALLS"])
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def test_shared_build_pushes_once_per_variant(docker_env: dict[str, str]) -> None:
    result = run_action_step(
        action=BUILD_ACTION,
        name="Build and push each variant by digest",
        env={
            **docker_env,
            "VARIANTS": "root nonroot debug",
            "PLATFORM": "linux/amd64",
            "IMAGE": "arizephoenix/phoenix",
            "ADDITIONAL_IMAGE": "ghcr.io/arize-ai/phoenix",
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
        assert call["images"] == "arizephoenix/phoenix,ghcr.io/arize-ai/phoenix"
        assert call["args"][:2] == ["buildx", "build"]
        exporter = call["args"][call["args"].index("--output") + 1]
        assert '"name=arizephoenix/phoenix,ghcr.io/arize-ai/phoenix"' in exporter
    for variant in ("root", "nonroot", "debug"):
        assert (Path(docker_env["RUNNER_TEMP"]) / "digests" / variant / ("a" * 64)).exists()


def test_failed_variant_does_not_withhold_other_digests(docker_env: dict[str, str]) -> None:
    result = run_action_step(
        action=BUILD_ACTION,
        name="Build and push each variant by digest",
        env={
            **docker_env,
            "VARIANTS": "root nonroot debug",
            "PLATFORM": "linux/amd64",
            "IMAGE": "ghcr.io/arize-ai/phoenix",
            "ADDITIONAL_IMAGE": "",
            "LABELS": "org.opencontainers.image.revision=abc123",
            "FAIL_BASE": "gcr.io/distroless/python3-debian13:nonroot",
        },
    )
    assert result.returncode == 0, result.stderr
    assert Path(docker_env["GITHUB_OUTPUT"]).read_text() == "failed=nonroot\n"
    digests = Path(docker_env["RUNNER_TEMP"]) / "digests"
    assert {directory.name for directory in digests.iterdir()} == {"root", "debug"}
    failure = run_action_step(
        action=BUILD_ACTION,
        name="Report failed variants",
        env={**docker_env, "FAILED": "nonroot", "PLATFORM": "linux/amd64"},
    )
    assert failure.returncode != 0


@pytest.mark.parametrize("num_platforms", [1, 2])
def test_manifest_uses_each_destination_registry(
    docker_env: dict[str, str], num_platforms: int
) -> None:
    digest_dir = Path(docker_env["RUNNER_TEMP"]) / "digests/root"
    digest_dir.mkdir(parents=True)
    digest_names = ["a" * 64, "b" * 64][:num_platforms]
    for digest in digest_names:
        (digest_dir / digest).touch()
    result = run_action_step(
        action=MERGE_ACTION,
        name="Create manifest list and push",
        env={
            **docker_env,
            "VARIANT": "root",
            "IMAGE": "arizephoenix/phoenix",
            "EXPECTED_DIGESTS": str(num_platforms),
            "TAGS": (
                "arizephoenix/phoenix:nightly\n"
                "ghcr.io/arize-ai/phoenix:nightly\n"
                "ghcr.io/arize-ai/phoenix:commit-1234567"
            ),
        },
    )
    assert result.returncode == 0, result.stderr
    calls = read_docker_calls(docker_env)
    assert len(calls) == 2
    for call in calls:
        arguments = call["args"]
        tags = [
            arguments[index + 1] for index, argument in enumerate(arguments) if argument == "--tag"
        ]
        repository = tags[0].rsplit(":", 1)[0]
        assert all(tag.rsplit(":", 1)[0] == repository for tag in tags)
        assert arguments[-num_platforms:] == [
            f"{repository}@sha256:{digest}" for digest in digest_names
        ]
    assert sum(call["args"].count("--tag") for call in calls) == 3


def test_manifest_refuses_incomplete_platforms(docker_env: dict[str, str]) -> None:
    digest_dir = Path(docker_env["RUNNER_TEMP"]) / "digests/root"
    digest_dir.mkdir(parents=True)
    (digest_dir / ("a" * 64)).touch()
    result = run_action_step(
        action=MERGE_ACTION,
        name="Create manifest list and push",
        env={
            **docker_env,
            "VARIANT": "root",
            "EXPECTED_DIGESTS": "2",
            "TAGS": "ghcr.io/arize-ai/phoenix:nightly",
        },
    )
    assert result.returncode != 0
    assert read_docker_calls(docker_env) == []


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
