"""Fail-closed Docker capability probe and declared-artifact handoff primitives.

These primitives are not a completed Harbor lifecycle integration. The runner must
supply container IDs and protected audit evidence, never agent-authored claims.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
from pathlib import Path
from typing import Any, Callable


class InvalidEvidence(RuntimeError):
    pass


def read_regular(directory: Path, name: str, *, limit: int = 1_048_576) -> bytes:
    if name not in {"answer.json", "trajectory.json"}:
        raise InvalidEvidence("Undeclared artifact")
    root = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=root)
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
                raise InvalidEvidence("Artifact must be a bounded regular file")
            with os.fdopen(os.dup(descriptor), "rb") as source:
                data = source.read(limit + 1)
            if len(data) > limit:
                raise InvalidEvidence("Artifact exceeded size limit")
            return data
        finally:
            os.close(descriptor)
    finally:
        os.close(root)


def require_stopped(container_ids: list[str], inspect: Callable[[str], dict[str, Any]]) -> None:
    if not container_ids:
        raise InvalidEvidence("Missing agent container inventory")
    for container_id in container_ids:
        state = inspect(container_id)
        # Missing containers are ambiguous: inspect before teardown, not after removal.
        if state.get("Running") is not False or state.get("Pid") != 0:
            raise InvalidEvidence("Agent shutdown was not independently confirmed")


def snapshot_answer(source: Path, destination: Path, *, confirm_stopped: Callable[[], None]) -> str:
    """Copy only the declared answer. Never transfer agent-written rewards or verifier code."""
    confirm_stopped()
    data = read_regular(source, "answer.json")
    json.loads(data)  # Validate syntax without importing or executing agent code.
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    with (destination / "answer.json").open("xb") as output:
        output.write(data)
    return hashlib.sha256(data).hexdigest()


def docker_capability() -> dict[str, Any]:
    from harbor.environments.docker.docker import DockerEnvironment

    result = subprocess.run(
        [
            "docker",
            "container",
            "run",
            "--rm",
            DockerEnvironment._EGRESS_CONTROL_KERNEL_PROBE_IMAGE,
            "sh",
            "-c",
            DockerEnvironment._EGRESS_CONTROL_KERNEL_PROBE_SCRIPT,
        ],
        capture_output=True,
        timeout=45,
    )
    # Do not mistake an image pull/daemon failure for a missing kernel capability.
    return {
        "probe": "harbor-0.22.0-nft-fib-inet",
        "exit_code": result.returncode,
        "capability_probe_passed": result.returncode == 0,
        "runtime_isolation_verified": False,
        "next_step": (
            "Run same-context egress and filesystem probes"
            if result.returncode == 0
            else "Fix Docker capability before any evaluated trial"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--docker-probe", action="store_true", required=True)
    parser.parse_args()
    result = docker_capability()
    print(json.dumps(result, indent=2))
    return not result["capability_probe_passed"]


if __name__ == "__main__":
    raise SystemExit(main())
