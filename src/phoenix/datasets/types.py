from __future__ import annotations

import inspect
from abc import ABC
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from functools import cached_property, partial
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)

import pandas as pd
from typing_extensions import TypeAlias

from phoenix.datasets.errors import (
    EvaluatorHasInvalidParameterName,
    EvaluatorHasPositionalOnlyParameter,
    EvaluatorImplementationError,
    EvaluatorIsMissingVariadicKeywordParameters,
)
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
    runs: Tuple[ExperimentRun, ...] = field(default=())

    _df: Optional[pd.DataFrame] = field(init=False, default=None)

    @property
    def dataframe(self) -> pd.DataFrame:
        if not self._df:
            df = (
                pd.DataFrame.from_records(
                    [
                        {
                            "example_id": experiment_run.dataset_example_id,
                            "run_id": experiment_run.id,
                            "repetition_number": experiment_run.repetition_number,
                            "output": experiment_run.output.result
                            if experiment_run.output
                            else None,
                            "error": experiment_run.error,
                        }
                        for experiment_run in self.runs
                    ]
                )
                .sort_values(["example_id", "repetition_number"])
                .set_index("example_id")
            )
            object.__setattr__(self, "_df", df)
        assert self._df is not None
        return self._df.copy(deep=False)


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


ExampleOutput: TypeAlias = Mapping[str, JSONSerializable]
ExampleMetadata: TypeAlias = Mapping[str, JSONSerializable]
ExampleInput: TypeAlias = Mapping[str, JSONSerializable]

EvaluatorName: TypeAlias = str
EvaluatorKind: TypeAlias = str
EvaluatorOutput: TypeAlias = Union[EvaluationResult, bool, int, float, str]


class Evaluator(ABC):
    _kind: EvaluatorKind
    _name: EvaluatorName

    @cached_property
    def name(self) -> EvaluatorName:
        if hasattr(self, "_name"):
            return self._name
        return self.__class__.__name__

    @cached_property
    def kind(self) -> EvaluatorKind:
        if hasattr(self, "_kind"):
            return self._kind
        return AnnotatorKind.CODE.value

    def __new__(cls, *args: Any, **kwargs: Any) -> Evaluator:
        if cls is Evaluator:
            raise TypeError(f"{cls.__name__} is an abstract class and should not be instantiated.")
        return object.__new__(cls)

    def evaluate(
        self,
        *,
        output: TaskOutput,
        expected: ExampleOutput,
        metadata: ExampleMetadata,
        input: ExampleInput,
        **kwargs: Any,
    ) -> EvaluationResult:
        # For subclassing, one can implement either this sync version or the
        # async version. Implementing both is recommended but not required.
        raise NotImplementedError

    async def async_evaluate(
        self,
        *,
        output: TaskOutput,
        expected: ExampleOutput,
        metadata: ExampleMetadata,
        input: ExampleInput,
        **kwargs: Any,
    ) -> EvaluationResult:
        # For subclassing, one can implement either this async version or the
        # sync version. Implementing both is recommended but not required.
        return self.evaluate(
            output=output,
            expected=expected,
            metadata=metadata,
            input=input,
            **kwargs,
        )

    def __init_subclass__(cls, is_abstract: bool = False, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if is_abstract:
            return
        evaluate_fn_signature = inspect.signature(Evaluator.evaluate)
        for super_cls in inspect.getmro(cls):
            if super_cls in (LLMEvaluator, Evaluator):
                break
            has_evaluate = callable(
                evaluate := super_cls.__dict__.get(Evaluator.evaluate.__name__)
            ) and validate_evaluate_fn_params(
                partial(evaluate, None),  # skip first param, i.e. `self`
                evaluate.__qualname__ if hasattr(evaluate, "__qualname__") else None,
                require_kwargs=True,
            )
            has_async_evaluate = inspect.iscoroutinefunction(
                async_evaluate := super_cls.__dict__.get(Evaluator.async_evaluate.__name__)
            ) and validate_evaluate_fn_params(
                partial(async_evaluate, None),  # skip first param, i.e. `self`
                async_evaluate.__qualname__ if hasattr(async_evaluate, "__qualname__") else None,
                require_kwargs=True,
            )
            if has_evaluate or has_async_evaluate:
                return
        raise EvaluatorImplementationError(
            f"Evaluator must implement either "
            f"`def evaluate{evaluate_fn_signature}` or "
            f"`async def async_evaluate{evaluate_fn_signature}`"
        )


def validate_evaluate_fn_params(
    evaluate_fn: Callable[..., Any],
    fn_name: Optional[str] = None,
    require_kwargs: bool = False,
) -> bool:
    if not fn_name:
        fn_name = (
            evaluate_fn.__qualname__ if hasattr(evaluate_fn, "__qualname__") else str(evaluate_fn)
        )
    fn_sig = inspect.signature(evaluate_fn)
    params = fn_sig.parameters
    expected = inspect.signature(
        partial(Evaluator.evaluate, None),  # skip first param, i.e. `self`
    ).parameters
    has_variadic_keyword = False
    valid_param_names = ", ".join(expected.keys())
    for name, param in params.items():
        if param.kind is inspect.Parameter.POSITIONAL_ONLY:
            raise EvaluatorHasPositionalOnlyParameter(
                f"`{fn_name}` should not have a positional-only parameter: {name=}"
            )
        if name not in params and param.default is inspect.Parameter.empty:
            raise EvaluatorHasInvalidParameterName(
                f"`{fn_name}` has an invalid parameter name: {name=}. "
                f"Valid names for parameters are: {valid_param_names}"
            )
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            has_variadic_keyword = True
    if require_kwargs and not has_variadic_keyword:
        raise EvaluatorIsMissingVariadicKeywordParameters(
            f"`{fn_name}` should allow variadic keyword arguments `**kwargs`"
        )
    return True


class LLMEvaluator(Evaluator, is_abstract=True):
    _kind: EvaluatorKind = "LLM"

    def __new__(cls, *args: Any, **kwargs: Any) -> LLMEvaluator:
        if cls is LLMEvaluator:
            raise TypeError(f"{cls.__name__} is an abstract class and should not be instantiated.")
        return object.__new__(cls)


ExperimentTask: TypeAlias = Union[
    Callable[[Example], TaskOutput],
    Callable[[Example], Awaitable[TaskOutput]],
]
ExperimentEvaluator: TypeAlias = Union[
    Evaluator,
    Callable[..., EvaluatorOutput],
    Callable[..., Awaitable[EvaluatorOutput]],
]
