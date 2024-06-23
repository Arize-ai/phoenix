from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    List,
    Mapping,
    Optional,
    Protocol,
    Sequence,
    Union,
    runtime_checkable,
)

from typing_extensions import TypeAlias

JSONSerializable: TypeAlias = Optional[Union[Dict[str, Any], List[Any], str, int, float, bool]]

ExperimentId: TypeAlias = str
DatasetId: TypeAlias = str
DatasetVersionId: TypeAlias = str
ExampleId: TypeAlias = str
RepetitionNumber: TypeAlias = int
ExperimentRunId: TypeAlias = str
TraceId: TypeAlias = str


@dataclass(frozen=True)
class Example:
    id: ExampleId
    updated_at: datetime
    input: Mapping[str, JSONSerializable]
    output: Mapping[str, JSONSerializable]
    metadata: Mapping[str, JSONSerializable] = field(default_factory=lambda: MappingProxyType({}))

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> Example:
        return cls(
            input=obj["input"],
            output=obj["output"],
            metadata=obj.get("metadata") or {},
            id=obj["id"],
            updated_at=obj["updated_at"],
        )


@dataclass(frozen=True)
class Dataset:
    id: DatasetId
    version_id: DatasetVersionId
    examples: Sequence[Example]


@dataclass(frozen=True)
class TestCase:
    example: Example
    repetition_number: RepetitionNumber


@dataclass(frozen=True)
class Experiment:
    id: ExperimentId
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId
    project_name: Optional[str] = None


@dataclass(frozen=True)
class ExperimentResult:
    result: JSONSerializable

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[ExperimentResult]:
        if not obj:
            return None
        return cls(result=obj["result"])


@dataclass(frozen=True)
class ExperimentRun:
    start_time: datetime
    end_time: datetime
    experiment_id: ExperimentId
    dataset_example_id: ExampleId
    repetition_number: RepetitionNumber
    output: Optional[ExperimentResult] = None
    error: Optional[str] = None
    id: Optional[ExperimentRunId] = None
    trace_id: Optional[TraceId] = None

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> ExperimentRun:
        return cls(
            start_time=obj["start_time"],
            end_time=obj["end_time"],
            experiment_id=obj["experiment_id"],
            dataset_example_id=obj["dataset_example_id"],
            repetition_number=obj.get("repetition_number") or 1,
            output=ExperimentResult.from_dict(obj["output"]),
            error=obj.get("error"),
            id=obj.get("id"),
            trace_id=obj.get("trace_id"),
        )

    def __post_init__(self) -> None:
        if bool(self.output) == bool(self.error):
            ValueError("Must specify either result or error")


@dataclass(frozen=True)
class EvaluationResult:
    score: Optional[float] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Mapping[str, JSONSerializable] = field(default_factory=lambda: MappingProxyType({}))

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[EvaluationResult]:
        if not obj:
            return None
        return cls(
            score=obj.get("score"),
            label=obj.get("label"),
            explanation=obj.get("explanation"),
            metadata=obj.get("metadata") or {},
        )

    def __post_init__(self) -> None:
        if self.score is None and not self.label and not self.explanation:
            ValueError("Must specify one of score, label, or explanation")


@dataclass(frozen=True)
class ExperimentEvaluationRun:
    experiment_run_id: ExperimentRunId
    start_time: datetime
    end_time: datetime
    name: str
    annotator_kind: str
    error: Optional[str] = None
    result: Optional[EvaluationResult] = None
    id: Optional[str] = None
    trace_id: Optional[TraceId] = None

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> ExperimentEvaluationRun:
        return cls(
            experiment_run_id=obj["experiment_run_id"],
            start_time=obj["start_time"],
            end_time=obj["end_time"],
            name=obj["name"],
            annotator_kind=obj["annotator_kind"],
            error=obj.get("error"),
            result=EvaluationResult.from_dict(obj.get("result")),
            id=obj.get("id"),
            trace_id=obj.get("trace_id"),
        )

    def __post_init__(self) -> None:
        if bool(self.result) == bool(self.error):
            ValueError("Must specify either result or error")


class _HasName(Protocol):
    name: str


class _HasKind(Protocol):
    @property
    def annotator_kind(self) -> str: ...


@runtime_checkable
class CanEvaluate(_HasName, _HasKind, Protocol):
    def evaluate(
        self,
        example: Example,
        experiment_run: ExperimentRun,
    ) -> EvaluationResult: ...


@runtime_checkable
class CanAsyncEvaluate(_HasName, _HasKind, Protocol):
    async def async_evaluate(
        self,
        example: Example,
        experiment_run: ExperimentRun,
    ) -> EvaluationResult: ...


ExperimentEvaluator: TypeAlias = Union[CanEvaluate, CanAsyncEvaluate]


class AnnotatorKind(Enum):
    CODE = "CODE"
    LLM = "LLM"


class ScoreType(Enum):
    FLOAT = "float"
    BOOLEAN = "boolean"


# Someday we'll do type checking in unit tests.
if TYPE_CHECKING:

    class _EvaluatorDummy:
        annotator_kind: str
        name: str

        def evaluate(self, _: Example, __: ExperimentRun) -> EvaluationResult:
            raise NotImplementedError

        async def async_evaluate(self, _: Example, __: ExperimentRun) -> EvaluationResult:
            raise NotImplementedError

    _: ExperimentEvaluator
    _ = _EvaluatorDummy()
