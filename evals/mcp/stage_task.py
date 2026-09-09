"""Stage one Harbor task from a canonical instruction and a private fixture manifest.

Image digests are supplied only after the separate image/isolation acceptance work.
This command does not run Harbor, provision a target, or attach trusted evidence.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Any

import toml

from metadata import TaskMetadata

HERE = Path(__file__).resolve().parent


def count_metadata(manifest: dict[str, Any]) -> TaskMetadata:
    if manifest["project"] != "mcp-trail-gaia" or manifest["source"] != "gaia":
        raise ValueError("Count task instruction requires the GAIA fixture project")
    return TaskMetadata(
        task_id="trace-count",
        task_version="1",
        task_family_id="trace-count",
        task_type="aggregation",
        primary_surface="tracing",
        product_surfaces=["tracing"],
        operation_types=["list", "aggregate"],
        mutability="read_only",
        split="development",
        suites=["smoke", "core"],
        difficulty="easy",
        difficulty_rationale="One project count",
        challenge_tags=[],
        data_scale={
            "category": "tiny",
            "traces": manifest["trace_count"],
            "spans": manifest["span_count"],
        },
        fixture_corpus=manifest["corpus"],
        fixture_revision=manifest["revision"],
        fixture_hash=manifest["fixture_hash"],
        required_capabilities=["trace_count", "trace_list"],
        eligible_interfaces=["mcp", "cli"],
        verification_types=["deterministic", "state", "policy"],
        evaluator_ids=["trace-count@1", "read-only-state@1", "access-policy@1"],
        rubric_version="1",
        sql_opportunity="aggregation",
    )


def stage(manifest: dict[str, Any], output: Path, *, agent_image: str, verifier_image: str) -> Path:
    for image in (agent_image, verifier_image):
        if not re.fullmatch(r"[a-z0-9./:_-]+@sha256:[a-f0-9]{64}", image):
            raise ValueError("A pinned image digest is required")
    metadata = count_metadata(manifest)
    task = output / "trace-count"
    task.mkdir(parents=True, exist_ok=False)
    shutil.copy(HERE / "tasks/trace-count/instruction.md", task)
    shutil.copytree(HERE / "tasks/trace-count/solution", task / "solution")
    environment = task / "environment"
    environment.mkdir()
    (environment / "Dockerfile").write_text(f"FROM {agent_image}\nWORKDIR /workspace\n")
    tests = task / "tests"
    tests.mkdir()
    # Only the separate verifier context contains grading code. No fixture payload.
    for name in ("verify.py", "isolation.py"):
        shutil.copy(HERE / name, tests / name)
    (tests / "test.sh").write_text("#!/bin/sh\nset -eu\npython /tests/verify.py\n")
    (tests / "Dockerfile").write_text(
        f"FROM {verifier_image}\nCOPY verify.py isolation.py test.sh /tests/\n"
    )
    config = {
        "schema_version": "1.3",
        "task": {"name": "arize/trace-count", "version": "1"},
        "metadata": metadata.model_dump(mode="json"),
        "environment": {"network_mode": "no-network", "cpus": 2, "memory_mb": 4096},
        "agent": {"timeout_sec": 300},
        "verifier": {
            "environment_mode": "separate",
            "timeout_sec": 60,
            "environment": {"network_mode": "no-network"},
        },
        "artifacts": [{"source": "/workspace/answer.json", "destination": "answer.json"}],
    }
    (task / "task.toml").write_text(toml.dumps(config))
    return task


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--agent-image", required=True)
    parser.add_argument("--verifier-image", required=True)
    args = parser.parse_args()
    stage(
        json.loads(args.manifest.read_text()),
        args.output,
        agent_image=args.agent_image,
        verifier_image=args.verifier_image,
    )


if __name__ == "__main__":
    main()
