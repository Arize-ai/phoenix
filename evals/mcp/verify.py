"""Offline verifier. The trusted hook selects the task and final answer explicitly."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent


def grade(task: str, answer: Any, reference: dict[str, Any]) -> dict[str, float]:
    if task not in {p.name for p in (HERE / "tasks").iterdir() if p.is_dir()}:
        raise ValueError("Unknown task")
    spec = importlib.util.spec_from_file_location(
        "task_verifier", HERE / "tasks" / task / "verify.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Missing task verifier")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    scores = module.grade(answer, reference)
    if scores.get("reward") not in (0, 1):
        raise ValueError("Task must emit a binary reward")
    return {str(k): float(v) for k, v in scores.items()}


def verify(trusted: Path) -> dict[str, float]:
    submission = json.loads((trusted / "submission.json").read_text())
    reference = json.loads((trusted / "reference.json").read_text())
    scores = grade(submission["task"], submission["answer"], reference)
    measurements = json.loads((trusted / "measurements.json").read_text())
    if "reward" in measurements:
        raise ValueError("Measurements cannot replace task reward")
    scores.update({k: float(v) for k, v in measurements.items() if v is not None})
    return scores


if __name__ == "__main__":
    Path("/logs/verifier/reward.json").write_text(json.dumps(verify(Path("/trusted"))))
