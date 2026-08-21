"""Harbor job records used by the Phoenix plugin."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "DatasetIdentity",
    "ExperimentSlice",
    "JobPlan",
    "StepRecord",
    "TaskRecord",
    "TrialSlot",
    "canonical_digest",
    "short_digest",
]

_DIGEST_PREFIX = "sha256:"
_SHORT_DIGEST_LENGTH = 12


def canonical_digest(payload: Any) -> str:
    """Return a ``sha256:`` digest matching Harbor's prefix."""
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return _DIGEST_PREFIX + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def short_digest(digest: str) -> str:
    return digest.removeprefix(_DIGEST_PREFIX)[:_SHORT_DIGEST_LENGTH]


@dataclass(frozen=True)
class StepRecord:
    """One step of a multi-step Harbor task."""

    name: str
    instruction: str


@dataclass(frozen=True)
class DatasetIdentity:
    name: str
    kind: str
    inferred_name: str | None


@dataclass(frozen=True)
class TaskRecord:
    task_id: str
    """Harbor task ID, used as the Phoenix example's external ID."""
    name: str
    source: str | None
    task_type: str
    version: str | None
    digest: str
    instruction: str
    steps: tuple[StepRecord, ...] = ()
    config: Mapping[str, Any] = field(default_factory=dict)

    def to_example(self) -> dict[str, Any]:
        """Convert the task to a Phoenix dataset example."""
        example_input: dict[str, Any] = {
            "task_id": self.task_id,
            "task_name": self.name,
            "instruction": self.instruction,
        }
        if self.steps:
            example_input["steps"] = [
                {"name": step.name, "instruction": step.instruction} for step in self.steps
            ]
        return {
            "id": self.task_id,
            "input": example_input,
            # Harbor verifies environment state, not a reference response.
            "output": {},
            "metadata": {
                "task_digest": self.digest,
                "task_source": self.source,
                "task_type": self.task_type,
                "task_version": self.version,
                "task_config": dict(self.config),
            },
        }


@dataclass(frozen=True)
class ExperimentSlice:
    identity_digest: str
    agent_name: str
    model_name: str | None
    import_path: str | None
    skills: tuple[str, ...] = ()
    mcp_servers: tuple[str, ...] = ()

    @property
    def short_identity(self) -> str:
        return short_digest(self.identity_digest)

    def describe(self) -> dict[str, Any]:
        return {
            "agent_name": self.agent_name,
            "model_name": self.model_name,
            "import_path": self.import_path,
            "skills": list(self.skills),
            "mcp_servers": list(self.mcp_servers),
        }


@dataclass(frozen=True)
class TrialSlot:
    trial_name: str
    identity_digest: str
    task_id: str
    repetition: int
    """One-based because Phoenix rejects repetition zero."""


@dataclass(frozen=True)
class JobPlan:
    job_id: str
    job_name: str
    harbor_version: str | None
    dataset: DatasetIdentity
    tasks: tuple[TaskRecord, ...]
    slices: tuple[ExperimentSlice, ...]
    trials: tuple[TrialSlot, ...]
    repetitions: int

    def slice_for(self, identity_digest: str) -> ExperimentSlice:
        for experiment_slice in self.slices:
            if experiment_slice.identity_digest == identity_digest:
                return experiment_slice
        raise KeyError(identity_digest)

    def trial_for(self, trial_name: str) -> TrialSlot:
        for trial in self.trials:
            if trial.trial_name == trial_name:
                return trial
        raise KeyError(trial_name)
