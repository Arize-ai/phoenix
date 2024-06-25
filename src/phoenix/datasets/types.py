from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Mapping,
    Optional,
    Sequence,
    Union,
)

import pandas as pd
from typing_extensions import TypeAlias

from phoenix.utilities.json import ReadOnlyDict


class AnnotatorKind(Enum):
    CODE = "CODE"
    LLM = "LLM"


JSONSerializable: TypeAlias = Optional[Union[Dict[str, Any], List[Any], str, int, float, bool]]

ExperimentId: TypeAlias = str
DatasetId: TypeAlias = str
DatasetVersionId: TypeAlias = str
ExampleId: TypeAlias = str
RepetitionNumber: TypeAlias = int
ExperimentRunId: TypeAlias = str
TraceId: TypeAlias = str

TaskOutput: TypeAlias = JSONSerializable


@dataclass(frozen=True)
class Example:
    id: ExampleId
    updated_at: datetime
    input: Mapping[str, JSONSerializable]
    output: Mapping[str, JSONSerializable]
    metadata: Mapping[str, JSONSerializable] = field(default_factory=ReadOnlyDict)

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> Example:
        return cls(
            input=ReadOnlyDict(obj["input"]),
            output=ReadOnlyDict(obj["output"]),
            metadata=ReadOnlyDict(obj.get("metadata")),
            id=obj["id"],
            updated_at=obj["updated_at"],
        )


@dataclass(frozen=True)
class Dataset:
    id: DatasetId
    version_id: DatasetVersionId
    examples: Sequence[Example]

    _df: Optional[pd.DataFrame] = field(init=False, default=None)

    @property
    def dataframe(self) -> pd.DataFrame:
        if not self._df:
            df = pd.DataFrame.from_records(
                [
                    {
                        "example_id": example.id,
                        "input": example.input,
                        "output": example.output,
                        "metadata": example.metadata,
                    }
                    for example in self.examples
                ]
            ).set_index("example_id")
            object.__setattr__(self, "_df", df)
        assert self._df is not None
        return self._df.copy(deep=False)


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
    result: TaskOutput

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
    metadata: Mapping[str, JSONSerializable] = field(default_factory=ReadOnlyDict)

    @classmethod
    def from_dict(cls, obj: Optional[Mapping[str, Any]]) -> Optional[EvaluationResult]:
        if not obj:
            return None
        return cls(
            score=obj.get("score"),
            label=obj.get("label"),
            explanation=obj.get("explanation"),
            metadata=ReadOnlyDict(obj.get("metadata") or {}),
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


ExperimentTask: TypeAlias = Union[
    Callable[[Example], TaskOutput],
    Callable[[Example], Awaitable[TaskOutput]],
]
