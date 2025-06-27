import random
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional, Union
import inspect

# Import the dataset example type
from phoenix.client.__generated__ import v1

# Type aliases
JSONSerializable = Optional[Union[dict[str, Any], list[Any], str, int, float, bool]]
ExperimentId = str
DatasetId = str
DatasetVersionId = str
ExampleId = str
RepetitionNumber = int
ExperimentRunId = str
TraceId = str
TaskOutput = JSONSerializable
ExampleOutput = Mapping[str, JSONSerializable]
ExampleMetadata = Mapping[str, JSONSerializable]
ExampleInput = Mapping[str, JSONSerializable]
Score = Optional[Union[bool, int, float]]
Label = Optional[str]
Explanation = Optional[str]
EvaluatorName = str
EvaluatorKind = str

DRY_RUN = "DRY_RUN"


class AnnotatorKind(Enum):
    CODE = "CODE"
    LLM = "LLM"


def _dry_run_id() -> str:
    suffix = random.getrandbits(24).to_bytes(3, "big").hex()
    return f"{DRY_RUN}_{suffix}"


@dataclass(frozen=True)
class TestCase:
    example: v1.DatasetExample
    repetition_number: RepetitionNumber


@dataclass(frozen=True)
class Experiment:
    id: ExperimentId
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId
    repetitions: int
    project_name: str = field(repr=False)


@dataclass(frozen=True)
class ExperimentRun:
    start_time: datetime
    end_time: datetime
    experiment_id: ExperimentId
    dataset_example_id: ExampleId
    repetition_number: RepetitionNumber
    output: JSONSerializable
    error: Optional[str] = None
    id: ExperimentRunId = field(default_factory=_dry_run_id)
    trace_id: Optional[TraceId] = None


@dataclass(frozen=True)
class EvaluationResult:
    score: Optional[float] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Mapping[str, JSONSerializable] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.score is None and not self.label:
            raise ValueError("Must specify score or label, or both")


@dataclass(frozen=True)
class ExperimentEvaluationRun:
    experiment_run_id: ExperimentRunId
    start_time: datetime
    end_time: datetime
    name: str
    annotator_kind: str
    error: Optional[str] = None
    result: Optional[EvaluationResult] = None
    id: str = field(default_factory=_dry_run_id)
    trace_id: Optional[TraceId] = None


# Task and Evaluator types
ExperimentTask = Union[
    Callable[[v1.DatasetExample], TaskOutput],
    Callable[[v1.DatasetExample], Awaitable[TaskOutput]],
    Callable[..., JSONSerializable],
    Callable[..., Awaitable[JSONSerializable]],
]

EvaluatorOutput = Union[EvaluationResult, bool, int, float, str, tuple[Score, Label, Explanation]]


class Evaluator(ABC):
    """Base class for evaluators."""

    def __init__(self, name: Optional[str] = None):
        self._name = name

    @property
    def name(self) -> str:
        if self._name:
            return self._name
        return self.__class__.__name__

    @property
    def kind(self) -> str:
        return AnnotatorKind.CODE.value

    @abstractmethod
    def evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        input: Optional[ExampleInput] = None,
        expected: Optional[ExampleOutput] = None,
        reference: Optional[ExampleOutput] = None,
        metadata: Optional[ExampleMetadata] = None,
        **kwargs: Any,
    ) -> EvaluationResult:
        """Evaluate the output."""
        pass

    async def async_evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        input: Optional[ExampleInput] = None,
        expected: Optional[ExampleOutput] = None,
        reference: Optional[ExampleOutput] = None,
        metadata: Optional[ExampleMetadata] = None,
        **kwargs: Any,
    ) -> EvaluationResult:
        """Async evaluate the output."""
        return self.evaluate(
            output=output,
            input=input,
            expected=expected,
            reference=reference,
            metadata=metadata,
            **kwargs,
        )


class FunctionEvaluator(Evaluator):
    """Evaluator that wraps a function."""

    def __init__(self, func: Callable[..., Any], name: Optional[str] = None):
        super().__init__(name)
        self._func = func
        self._signature = inspect.signature(func)

    def evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        input: Optional[ExampleInput] = None,
        expected: Optional[ExampleOutput] = None,
        reference: Optional[ExampleOutput] = None,
        metadata: Optional[ExampleMetadata] = None,
        **kwargs: Any,
    ) -> EvaluationResult:
        """Evaluate using the wrapped function."""
        # Bind function arguments
        parameter_mapping = {
            "output": output,
            "input": input,
            "expected": expected,
            "reference": reference,
            "metadata": metadata,
        }

        params = self._signature.parameters
        if len(params) == 1:
            # Single parameter - use output
            result = self._func(output)
        else:
            # Multiple parameters - bind by name
            bound_args = {}
            for param_name in params:
                if param_name in parameter_mapping:
                    bound_args[param_name] = parameter_mapping[param_name]
            result = self._func(**bound_args)

        return self._convert_to_evaluation_result(result)

    async def async_evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        input: Optional[ExampleInput] = None,
        expected: Optional[ExampleOutput] = None,
        reference: Optional[ExampleOutput] = None,
        metadata: Optional[ExampleMetadata] = None,
        **kwargs: Any,
    ) -> EvaluationResult:
        """Async evaluate using the wrapped function."""
        parameter_mapping = {
            "output": output,
            "input": input,
            "expected": expected,
            "reference": reference,
            "metadata": metadata,
        }

        params = self._signature.parameters
        if len(params) == 1:
            # Single parameter - use output
            result = self._func(output)
        else:
            # Multiple parameters - bind by name
            bound_args = {}
            for param_name in params:
                if param_name in parameter_mapping:
                    bound_args[param_name] = parameter_mapping[param_name]
            result = self._func(**bound_args)

        if isinstance(result, Awaitable):
            result = await result

        return self._convert_to_evaluation_result(result)

    def _convert_to_evaluation_result(self, result: Any) -> EvaluationResult:
        """Convert function result to EvaluationResult."""
        if isinstance(result, EvaluationResult):
            return result
        elif isinstance(result, bool):
            return EvaluationResult(score=float(result), label=str(result))
        elif isinstance(result, (int, float)):
            return EvaluationResult(score=float(result))
        elif isinstance(result, str):
            return EvaluationResult(label=result)
        elif isinstance(result, tuple) and len(result) >= 2:
            # Handle tuple results like (score, label) or (score, label, explanation)
            score_val = result[0]
            label_val = result[1]
            score = float(score_val) if score_val is not None else None
            label = str(label_val) if label_val is not None else None
            explanation = str(result[2]) if len(result) > 2 and result[2] is not None else None
            return EvaluationResult(score=score, label=label, explanation=explanation)
        else:
            return EvaluationResult(label=str(result))


# Type aliases for evaluators
ExperimentEvaluator = Union[Evaluator, Callable[..., Any]]
Evaluators = Union[
    ExperimentEvaluator,
    Sequence[ExperimentEvaluator],
    Mapping[EvaluatorName, ExperimentEvaluator],
]
RateLimitErrors = Union[type[BaseException], Sequence[type[BaseException]]]
