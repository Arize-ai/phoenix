"""Render all tasks with one project name and one small seed provenance shape."""

from __future__ import annotations

import json
import shutil
import tomllib
from pathlib import Path
from typing import Any

import toml

HERE = Path(__file__).resolve().parent
TASKS = tuple(sorted(p.name for p in (HERE / "tasks").iterdir() if (p / "task.toml").exists()))


def stage(manifest: dict[str, Any], output: Path, *, image: str) -> list[Path]:
    fixture = {key: manifest[key] for key in ("corpus", "revision", "fixture_hash")}
    if len(fixture["revision"]) != 40 or len(fixture["fixture_hash"]) != 64:
        raise ValueError("Seed provenance requires immutable revision and SHA256")
    tasks = []
    for name in TASKS:
        source = HERE / "tasks" / name
        task = output / name
        task.mkdir(parents=True, exist_ok=False)
        config = tomllib.loads((source / "task.toml").read_text())
        config["metadata"]["fixture"] = fixture
        config.update(
            {
                "schema_version": "1.3",
                "environment": {
                    "docker_image": image,
                    "network_mode": "no-network",
                    "cpus": 2,
                    "memory_mb": 4096,
                },
                "agent": {"timeout_sec": 300, "network_mode": "allowlist", "allowed_hosts": []},
                "verifier": {
                    "environment_mode": "separate",
                    "timeout_sec": 60,
                    "environment": {"network_mode": "no-network"},
                },
                "artifacts": [{"source": "/workspace/answer.txt", "destination": "answer.txt"}],
            }
        )
        (task / "task.toml").write_text(toml.dumps(config))
        (task / "instruction.md").write_text(
            (source / "instruction.md").read_text().format(project=manifest["project"])
        )
        (task / "environment").mkdir()
        (task / "environment/Dockerfile").write_text(f"FROM {image}\nWORKDIR /workspace\n")
        (task / "tests").mkdir()
        (task / "tests/test.sh").write_text("#!/bin/sh\nset -eu\npython /tests/verify.py\n")
        (task / "solution").mkdir()
        shutil.copy(HERE / "oracle.py", task / "solution/oracle.py")
        (task / "solution/config.json").write_text(
            json.dumps({"project": manifest["project"], "task": name})
        )
        (task / "solution/solve.sh").write_text("#!/bin/sh\nset -eu\npython /solution/oracle.py\n")
        tasks.append(task)
    return tasks
