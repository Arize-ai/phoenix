# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# Harbor cannot be installed on the client's Python 3.10 and 3.11 CI jobs.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
"""Harbor job records used by the Phoenix plugin."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from harbor.models.job.config import JobConfig
from harbor.models.job.lock import TaskLock
from harbor.models.trial.config import AgentConfig, TrialConfig

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


@dataclass(frozen=True)
class TaskRecord:
    lock: TaskLock
    name: str
    instruction: str
    steps: tuple[StepRecord, ...] = ()
    multi_step_reward_strategy: Literal["mean", "final"] | None = None
    config: Mapping[str, Any] = field(default_factory=dict)

    @property
    def task_id(self) -> str:
        """Harbor task ID, used as the Phoenix example's external ID."""
        return self.lock.name

    @property
    def source(self) -> str | None:
        return self.lock.source

    @property
    def digest(self) -> str:
        return self.lock.digest

    @property
    def version(self) -> str | None:
        return self.lock.version

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
                "task_digest": self.lock.digest,
                "task_source": self.lock.source,
                "task_type": self.lock.type,
                "task_version": self.version,
                "task_config": dict(self.config),
            },
        }


@dataclass(frozen=True)
class ExperimentSlice:
    identity_digest: str
    agent: AgentConfig

    @property
    def agent_name(self) -> str:
        return self.agent.name or "agent"

    @property
    def model_name(self) -> str | None:
        return self.agent.model_name

    @property
    def short_identity(self) -> str:
        return short_digest(self.identity_digest)

    def describe(self) -> dict[str, Any]:
        return {
            "agent_name": self.agent_name,
            "model_name": self.model_name,
            "import_path": self.agent.import_path,
            "skills": list(self.agent.skills),
            "mcp_servers": [server.name for server in self.agent.mcp_servers],
        }


@dataclass(frozen=True)
class TrialSlot:
    config: TrialConfig
    identity_digest: str
    repetition: int
    """One-based because Phoenix rejects repetition zero."""

    @property
    def trial_name(self) -> str:
        return self.config.trial_name

    @property
    def task_id(self) -> str:
        return self.config.task.get_task_id().get_name()


@dataclass(frozen=True)
class JobPlan:
    job_id: str
    harbor_version: str
    config: JobConfig
    dataset: DatasetIdentity
    tasks: tuple[TaskRecord, ...]
    slices: tuple[ExperimentSlice, ...]
    trials: tuple[TrialSlot, ...]

    @property
    def job_name(self) -> str:
        return self.config.job_name

    @property
    def repetitions(self) -> int:
        return max(1, self.config.n_attempts)

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

    def task_for(self, task_id: str) -> TaskRecord:
        for task in self.tasks:
            if task.task_id == task_id:
                return task
        raise KeyError(task_id)
