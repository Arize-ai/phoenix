"""Immutable records describing a Harbor job, independent of Harbor's API.

The compatibility adapter (:mod:`phoenix.client.harbor._adapter`) is the only
place that reads Harbor's private job-plan fields; everything downstream works
against the records defined here. Keeping the boundary narrow means a Harbor
refactor breaks one module and one set of contract tests rather than the whole
plugin.
"""

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
    """Return a stable ``sha256:`` digest of a JSON-safe payload.

    Uses the same prefixed form as Harbor's task digests so the two read alike
    in stored metadata. ``default=str`` keeps the function total for values
    Harbor may hand us (``Path``, ``UUID``) without silently dropping them.
    """
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return _DIGEST_PREFIX + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def short_digest(digest: str) -> str:
    """Return a short, human-readable form of a prefixed digest."""
    return digest.removeprefix(_DIGEST_PREFIX)[:_SHORT_DIGEST_LENGTH]


@dataclass(frozen=True)
class StepRecord:
    """One step of a multi-step Harbor task."""

    name: str
    instruction: str


@dataclass(frozen=True)
class DatasetIdentity:
    """The single Harbor dataset a job runs against."""

    name: str
    """Phoenix dataset name: Harbor's resolved dataset name, or the override."""
    kind: str
    """How Harbor resolved the dataset: ``local``, ``registry``, ``package``,
    ``repo``, or ``unknown``."""
    inferred_name: str | None
    """The name inferred from Harbor, before any override was applied."""


@dataclass(frozen=True)
class TaskRecord:
    """A resolved Harbor task, and the Phoenix dataset example it becomes."""

    task_id: str
    """Harbor's task name, used as the stable external Phoenix example ID."""
    name: str
    source: str | None
    task_type: str
    version: str | None
    digest: str
    instruction: str
    steps: tuple[StepRecord, ...] = ()
    config: Mapping[str, Any] = field(default_factory=dict)

    def to_example(self) -> dict[str, Any]:
        """Return the Phoenix dataset example for this task.

        ``output`` stays empty: a Harbor solution is an executable way to reach
        an end state, not a reference response, so there is nothing to compare
        an agent's output against.
        """
        example_input: dict[str, Any] = {
            "task_id": self.task_id,
            "task_name": self.name,
            "instruction": self.instruction,
        }
        if self.steps:
            # A multi-step task carries no top-level instruction; without the
            # per-step instructions the example would not describe the work.
            example_input["steps"] = [
                {"name": step.name, "instruction": step.instruction} for step in self.steps
            ]
        return {
            "id": self.task_id,
            "input": example_input,
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
    """One agent/model configuration within a job: one Phoenix experiment."""

    identity_digest: str
    """Digest over every behavior-affecting field of the agent configuration."""
    agent_name: str
    model_name: str | None
    import_path: str | None
    skills: tuple[str, ...] = ()
    mcp_servers: tuple[str, ...] = ()

    @property
    def short_identity(self) -> str:
        return short_digest(self.identity_digest)

    def describe(self) -> dict[str, Any]:
        """Return the readable, non-secret identity stored on the experiment."""
        return {
            "agent_name": self.agent_name,
            "model_name": self.model_name,
            "import_path": self.import_path,
            "skills": list(self.skills),
            "mcp_servers": list(self.mcp_servers),
        }


@dataclass(frozen=True)
class TrialSlot:
    """A planned Harbor trial and the experiment run coordinates it will fill."""

    trial_name: str
    identity_digest: str
    task_id: str
    repetition: int
    """1-based; Phoenix rejects repetition 0."""


@dataclass(frozen=True)
class JobPlan:
    """Everything the plugin needs from Harbor, resolved at job start."""

    job_id: str
    job_name: str
    harbor_version: str | None
    dataset: DatasetIdentity
    tasks: tuple[TaskRecord, ...]
    slices: tuple[ExperimentSlice, ...]
    trials: tuple[TrialSlot, ...]
    repetitions: int
    """Harbor's configured attempt count, recorded on each experiment so
    Phoenix can report missing runs."""

    def examples(self) -> list[dict[str, Any]]:
        return [task.to_example() for task in self.tasks]

    def slice_for(self, identity_digest: str) -> ExperimentSlice:
        for experiment_slice in self.slices:
            if experiment_slice.identity_digest == identity_digest:
                return experiment_slice
        raise KeyError(identity_digest)
