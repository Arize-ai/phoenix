"""Offline execution gates. Never reads credentials from files or credential stores."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from typing import Mapping

from runtime import CONFIG, HERE

PROVIDER_KEYS = {"claude-code": "ANTHROPIC_API_KEY", "codex": "OPENAI_API_KEY"}


def credential_status(environment: Mapping[str, str]) -> dict[str, bool]:
    return {key: bool(environment.get(key)) for key in PROVIDER_KEYS.values()}


def installed_from_pin(record: dict, wheel_uri: str) -> bool:
    # uv records a local wheel URL without archive hashes; verify the file separately.
    return record.get("url") == wheel_uri


def check_runtime() -> list[str]:
    failures = []
    if importlib.metadata.version("harbor") != CONFIG["harbor_version"]:
        failures.append("Harbor version differs from runtime.json")
    build = HERE / ".runtime/build.json"
    if not build.exists():
        return failures + ["Pinned wheels missing: run make mcp-setup"]
    manifest = json.loads(build.read_text())
    if manifest["phoenix_revision"] != CONFIG["phoenix_revision"]:
        failures.append("Wheel source revision differs from runtime.json")
    pins = json.loads((HERE / "configs/wheels.json").read_text())
    for artifact in manifest["wheels"]:
        path = HERE / artifact["path"]
        matches = path.is_file() and (
            hashlib.sha256(path.read_bytes()).hexdigest() == artifact["sha256"]
        )
        if not matches or pins.get(path.name) != artifact["sha256"]:
            failures.append("Wheel missing or checksum mismatch")
        package = path.name.split("-", 1)[0].replace("_", "-")
        installed = importlib.metadata.distribution(package).read_text("direct_url.json")
        if not installed or not installed_from_pin(json.loads(installed), path.resolve().as_uri()):
            failures.append(f"{package} is not installed from the pinned wheel")
    return failures


def live_blockers(environment: Mapping[str, str]) -> list[str]:
    failures = [
        f"Missing {key}" for key, present in credential_status(environment).items() if not present
    ]
    failures.extend(
        [
            "Dedicated target provisioning and cleanup require user authorization",
            "Initial live spending cap requires user authorization",
            "Exact requested provider model IDs have not been authenticated",
            "Actual backend isolation, shutdown and evidence transfer have not passed",
        ]
    )
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    failures = check_runtime()
    if args.live:
        failures += live_blockers(os.environ)
    print(
        json.dumps(
            {
                "runtime_ok": not failures,
                "blockers": failures,
                "credentials_present": credential_status(os.environ),
            },
            indent=2,
        )
    )
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
