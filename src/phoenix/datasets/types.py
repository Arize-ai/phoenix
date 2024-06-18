from dataclasses import dataclass
from datetime import datetime
from typing import (
    Any,
    Awaitable,
    Dict,
    List,
    Mapping,
    Optional,
    Protocol,
    Sequence,
    Union,
)

from typing_extensions import TypeAlias

JSONSerializable: TypeAlias = Optional[Union[Dict[str, Any], List[Any], str, int, float, bool]]

ExampleId: TypeAlias = str
RepetitionId: TypeAlias = int


@dataclass(frozen=True)
class Example:
    """
    Contains input, output, metadata, and other information for a dataset
    example.
    """

    id: ExampleId
    input: Mapping[str, JSONSerializable]
    output: Mapping[str, JSONSerializable]
    metadata: Mapping[str, JSONSerializable]
    updated_at: datetime

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Example":
        return cls(
            id=obj["id"],
            input=obj["input"],
            output=obj["output"],
            metadata=obj.get("metadata") or {},
            updated_at=obj["updated_at"],
        )


@dataclass(frozen=True)
class Dataset:
    """
    Contains dataset metadata and examples.
    """

    id: str
    version_id: str
    examples: Sequence[Example]


@dataclass(frozen=True)
class TestCase:
    example: Example
    repetition_number: int


@dataclass(frozen=True)
class Experiment:
    id: str
    dataset_id: str
    dataset_version_id: str


@dataclass(frozen=True)
class ExperimentResult:
    result: JSONSerializable

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "ExperimentResult":
        return cls(result=obj["result"])


@dataclass(frozen=True)
class ExperimentRun:
    id: str
    dataset_example_id: str
    output: ExperimentResult

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "ExperimentRun":
        return cls(
            id=obj["id"],
            dataset_example_id=obj["dataset_example_id"],
            output=ExperimentResult.from_dict(obj["output"]),
        )


@dataclass(frozen=True)
class ExperimentPayload:
    dataset_example_id: str
    output: ExperimentResult
    repetition_number: int
    start_time: str
    end_time: str
    error: Optional[str]


@dataclass(frozen=True)
class EvaluatorPayload:
    experiment_run_id: str
    name: str
    annotator_kind: str
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    error: Optional[str]
    metadata: Optional[Mapping[str, JSONSerializable]]
    start_time: str
    end_time: str


@dataclass(frozen=True)
class EvaluationResult:
    name: str
    annotator_kind: str
    score: Optional[float]
    label: Optional[str]
    explanation: Optional[str]
    metadata: Mapping[str, JSONSerializable]


class ExperimentEvaluator(Protocol):
    def __call__(
        self,
        example: Example,
        experiment_run: ExperimentRun,
    ) -> Union[EvaluationResult, Awaitable[EvaluationResult]]: ...
