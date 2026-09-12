"""Grade one Harbor task from artifacts collected after the agent stops."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any

from evals.mcp.scoring.measurements import interface_measurements, sql_measurements
from evals.mcp.scoring.trajectory import final_answer, read_trajectory, trajectory_measurements

SQL_TASKS = {
    "total-cost",
    "most-failing-tool",
    "top-error-category",
    "error-rate-by-length",
    "max-llm-calls",
    "repeated-tool-calls",
    "spend-concentration",
}


def grade_task_answer(verifier: Path, answer: Any, reference: dict[str, Any]) -> dict[str, float]:
    """Call a bundled answer grader's verify_answer function and validate its score."""
    spec = importlib.util.spec_from_file_location("task_verifier", verifier)
    if spec is None or spec.loader is None:
        raise RuntimeError("Missing task verifier")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    scores = module.verify_answer(answer, reference)
    if scores.get("reward") not in (0, 1):
        raise ValueError("Task must emit a binary reward")
    return {str(k): float(v) for k, v in scores.items()}


def read_events(path: Path) -> list[dict[str, Any]] | None:
    """Read optional operation logs; missing or invalid records mean unknown use."""
    try:
        events = [json.loads(line) for line in path.read_text().splitlines() if line]
    except (OSError, ValueError):
        return None
    return events if all(isinstance(event, dict) for event in events) else None


def verify_artifacts(root: Path, task: str, interface: str, *, verifier: Path) -> dict[str, float]:
    """Write reward.json from Harbor's collected answer and sidecar artifacts.

    Seed readiness and reference data are required. Missing trajectory or audit
    logs omit the affected measurements without changing task correctness.
    Harbor restores artifacts at their original container paths below root.
    """
    reward_file = root / "logs/verifier/reward.json"
    # Harbor's agent log mounts may contain an agent-written reward. Remove it
    # first so a failed verifier cannot leave a forged successful result behind.
    reward_file.unlink(missing_ok=True)
    ready = json.loads((root / "evidence/ready.json").read_text())
    if ready.get("ready") is not True:
        raise ValueError("Phoenix seed did not finish setup")
    references = json.loads((root / "evidence/reference.json").read_text())
    if not isinstance(references.get(task), dict):
        raise ValueError("Missing trusted task reference")
    trajectory = read_trajectory(root / "logs/agent/trajectory.json")
    answer = final_answer(trajectory)
    if answer is None:
        try:
            answer = (root / "workspace/answer.txt").read_text()
        except OSError:
            answer = ""
    scores = grade_task_answer(verifier, answer, references[task])
    operations = read_events(root / "evidence/operations.jsonl")
    measurements: dict[str, int | None] = interface_measurements(interface, trajectory, operations)
    agent = trajectory.get("agent") if trajectory else None
    is_oracle = isinstance(agent, dict) and agent.get("name") == "phoenix-cli-oracle"
    if not is_oracle:
        measurements.update(trajectory_measurements(trajectory))
    if task in SQL_TASKS:
        measurements.update(sql_measurements(operations))
    scores.update({k: float(v) for k, v in measurements.items() if v is not None})
    reward_file.parent.mkdir(parents=True, exist_ok=True)
    reward_file.write_text(json.dumps(scores))
    return scores


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", required=True)
    parser.add_argument("--interface", choices=["mcp", "cli", "none"], required=True)
    args = parser.parse_args()
    verify_artifacts(Path("/"), args.task, args.interface, verifier=Path("/tests/verify.py"))


if __name__ == "__main__":
    main()
