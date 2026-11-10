"""Fake Phoenix state for unit tests of the `phoenix-evals` task verifiers."""

from __future__ import annotations

import base64
import importlib.util
import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import ModuleType
from typing import Any

from harbor_verifiers.evals_state import Evaluation, Experiment, Run

TASKS_DIR = Path(__file__).resolve().parents[4] / "evals" / "harbor" / "tasks" / "phoenix-evals"
START = datetime(2026, 11, 9, 12, 0, 0)


def load_check(task: str, module: str) -> ModuleType:
    """Imports a task's verifier module from its tests directory."""
    path = TASKS_DIR / task / "tests" / f"{module}.py"
    spec = importlib.util.spec_from_file_location(module, path)
    assert spec and spec.loader
    loaded = importlib.util.module_from_spec(spec)
    sys.modules[module] = loaded
    spec.loader.exec_module(loaded)
    return loaded


def evaluation(
    name: str,
    *,
    kind: str = "CODE",
    score: float | None = None,
    label: str | None = None,
    explanation: str | None = None,
    error: str | None = None,
) -> Evaluation:
    return Evaluation(
        name=name,
        annotator_kind=kind,
        label=label,
        score=score,
        explanation=explanation,
        error=error,
    )


def experiment(runs: list[Run], minutes: int = 0, name: str = "exp") -> Experiment:
    return Experiment(
        id=base64.b64encode(f"Experiment:{minutes + 1}".encode()).decode(),
        name=name,
        created_at=START + timedelta(minutes=minutes),
        metadata={},
        runs=runs,
    )


class Recorder:
    """Captures what a verifier passes to `write_reward`."""

    def __init__(self) -> None:
        self.reward: float | None = None
        self.details: dict[str, Any] = {}
        self.scores: dict[str, Any] = {}

    def __call__(self, reward: float, details: dict[str, Any] | None = None, **scores: Any) -> None:
        self.reward = reward
        self.details = details or {}
        self.scores = scores
