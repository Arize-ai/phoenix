from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TypeAlias

from phoenix_harbor._config import TraceMode

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | tuple["JsonValue", ...] | tuple[tuple[str, "JsonValue"], ...]
JsonObject: TypeAlias = tuple[tuple[str, JsonValue], ...]


@dataclass(frozen=True, slots=True)
class TaskRecord:
    task_id: str
    name: str
    instruction: str
    digest: str
    metadata: JsonObject = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class ExperimentSlice:
    identity: str
    agent_name: str
    model_name: str | None
    configuration_digest: str
    repetitions: int


@dataclass(frozen=True, slots=True)
class JobPlan:
    job_id: str
    job_name: str
    dataset_name: str
    tasks: tuple[TaskRecord, ...]
    experiments: tuple[ExperimentSlice, ...]


@dataclass(frozen=True, slots=True)
class TrialRecord:
    trial_id: str
    logical_trial_id: str
    task_id: str
    experiment_identity: str
    repetition: int
    started_at: datetime
    finished_at: datetime
    output: JsonObject = field(default_factory=tuple)
    error: str | None = None


@dataclass(frozen=True, slots=True)
class EvaluationRecord:
    name: str
    score: float
    explanation: str | None = None


@dataclass(frozen=True, slots=True)
class TracePlan:
    mode: TraceMode
    project_name: str | None = None
    trace_id: str | None = None
    root_span_id: str | None = None
