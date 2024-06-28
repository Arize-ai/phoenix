from __future__ import annotations

from collections import Counter
from copy import deepcopy
from dataclasses import dataclass, field, fields
from datetime import datetime
from enum import Enum
from importlib.metadata import version
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    FrozenSet,
    Iterable,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from typing_extensions import TypeAlias

from phoenix.datasets.utils import get_experiment_url
from phoenix.datetime_utils import local_now


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

ExampleOutput: TypeAlias = Mapping[str, JSONSerializable]
ExampleMetadata: TypeAlias = Mapping[str, JSONSerializable]
ExampleInput: TypeAlias = Mapping[str, JSONSerializable]

EvaluatorName: TypeAlias = str
EvaluatorKind: TypeAlias = str
EvaluatorOutput: TypeAlias = Union["EvaluationResult", bool, int, float, str]

DRY_RUN: ExperimentId = "DRY_RUN"


@dataclass(frozen=True)
class Example:
    id: ExampleId
    updated_at: datetime
    input: Mapping[str, JSONSerializable]
    output: Mapping[str, JSONSerializable]
    metadata: Mapping[str, JSONSerializable] = field(default_factory=dict)

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

    def as_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame.from_records(
            [
                {
                    "example_id": example.id,
                    "input": deepcopy(example.input),
                    "output": deepcopy(example.output),
                    "metadata": deepcopy(example.metadata),
                }
                for example in self.examples
            ]
        ).set_index("example_id")

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> Dataset:
        examples = tuple(map(Example.from_dict, obj.get("examples") or ()))
        return cls(
            id=obj["id"],
            version_id=obj["version_id"],
            examples=examples,
        )


@dataclass(frozen=True)
class TestCase:
    example: Example
    repetition_number: RepetitionNumber


@dataclass(frozen=True)
class Experiment:
    id: ExperimentId
    dataset_id: DatasetId
    dataset_version_id: DatasetVersionId
    repetitions: int
    project_name: str

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> Experiment:
        return cls(
            id=obj["id"],
            dataset_id=obj["dataset_id"],
            dataset_version_id=obj["dataset_version_id"],
            repetitions=obj.get("repetitions") or 1,
            project_name=obj.get("project_name") or "",
        )


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
    metadata: Mapping[str, JSONSerializable] = field(default_factory=dict)

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


ExperimentTask: TypeAlias = Union[
    Callable[[Example], TaskOutput],
    Callable[[Example], Awaitable[TaskOutput]],
]


@dataclass(frozen=True)
class ExperimentParameters:
    n_examples: int
    n_repetitions: int = 1

    @property
    def count(self) -> int:
        return self.n_examples * self.n_repetitions


@dataclass(frozen=True)
class EvaluationParameters:
    eval_names: FrozenSet[str]
    exp_params: ExperimentParameters


@dataclass(frozen=True)
class _HasStats:
    _title: str = field(repr=False, default="")
    _timestamp: datetime = field(repr=False, default_factory=local_now)
    stats: pd.DataFrame = field(repr=False, default_factory=pd.DataFrame)

    @property
    def title(self) -> str:
        return f"{self._title} ({self._timestamp:%x %I:%M %p %z})"

    def __str__(self) -> str:
        try:
            assert int(version("pandas").split(".")[0]) >= 1
            # `tabulate` is used by pandas >= 1.0 in DataFrame.to_markdown()
            import tabulate  # noqa: F401
        except (AssertionError, ImportError):
            text = self.stats.__str__()
        else:
            text = self.stats.to_markdown(index=False)
        return f"{self.title}\n{'-'*len(self.title)}\n" + text


@dataclass(frozen=True)
class EvaluationSummary(_HasStats):
    """
    Summary statistics of experiment evaluations.

    Users should not instantiate this directly.
    """

    _title: str = "Experiment Summary"

    @classmethod
    def from_eval_runs(
        cls,
        params: EvaluationParameters,
        eval_runs: Iterable[Optional[ExperimentEvaluationRun]],
    ) -> EvaluationSummary:
        df = pd.DataFrame.from_records(
            [
                {
                    "evaluator": run.name,
                    "error": run.error,
                    "score": run.result.score if run.result else None,
                    "label": run.result.label if run.result else None,
                }
                for run in eval_runs
                if run is not None
            ]
        )
        if df.empty:
            df = pd.DataFrame.from_records(
                [
                    {"evaluator": name, "error": True, "score": None, "label": None}
                    for name in params.eval_names
                ]
            )
        has_error = bool(df.loc[:, "error"].astype(bool).sum())
        has_score = bool(df.loc[:, "score"].dropna().count())
        has_label = bool(df.loc[:, "label"].astype(bool).sum())
        stats = df.groupby("evaluator").agg(
            **(
                dict(n_errors=("error", "count"), top_error=("error", _top_string))
                if has_error
                else {}
            ),
            **(dict(n_scores=("score", "count"), avg_score=("score", "mean")) if has_score else {}),
            **(
                dict(
                    n_labels=("label", "count"),
                    top_2_labels=(
                        "label",
                        lambda s: (dict(Counter(s.dropna()).most_common(2)) or None),
                    ),
                )
                if has_label
                else {}
            ),
        )  # type: ignore[call-overload]
        sorted_eval_names = sorted(params.eval_names)
        eval_names = pd.DataFrame(
            {
                "evaluator": sorted_eval_names,
                "n": [params.exp_params.count] * len(sorted_eval_names),
            }
        ).set_index("evaluator")
        stats = pd.concat([eval_names, stats], axis=1).reset_index()
        summary: EvaluationSummary = object.__new__(cls)
        summary.__init__(stats=stats)  # type: ignore[misc]
        return summary

    @classmethod
    def __new__(cls, *args: Any, **kwargs: Any) -> Any:
        # Direct instantiation by users is discouraged.
        raise NotImplementedError

    @classmethod
    def __init_subclass__(cls, **kwargs: Any) -> None:
        # Direct sub-classing by users is discouraged.
        raise NotImplementedError


@dataclass(frozen=True)
class TaskSummary(_HasStats):
    """
    Summary statistics of experiment task executions.

    **Users should not instantiate this object directly.**
    """

    _title: str = "Tasks Summary"

    @classmethod
    def from_task_runs(
        cls,
        params: ExperimentParameters,
        task_runs: Iterable[Optional[ExperimentRun]],
    ) -> "TaskSummary":
        df = pd.DataFrame.from_records(
            [
                {
                    "example_id": run.dataset_example_id,
                    "error": run.error,
                }
                for run in task_runs
                if run is not None
            ]
        )
        n_runs = len(df)
        n_errors = 0 if df.empty else df.loc[:, "error"].astype(bool).sum()
        record = {
            "n": params.count,
            "n_runs": n_runs,
            "n_errors": n_errors,
            **(dict(top_error=_top_string(df.loc[:, "error"])) if n_errors else {}),
        }
        stats = pd.DataFrame.from_records([record])
        summary: TaskSummary = object.__new__(cls)
        summary.__init__(stats=stats)  # type: ignore[misc]
        return summary

    @classmethod
    def __new__(cls, *args: Any, **kwargs: Any) -> Any:
        # Direct instantiation by users is discouraged.
        raise NotImplementedError

    @classmethod
    def __init_subclass__(cls, **kwargs: Any) -> None:
        # Direct sub-classing by users is discouraged.
        raise NotImplementedError


def _top_string(s: "pd.Series[Any]", length: int = 100) -> Optional[str]:
    if (cnt := s.dropna().str.slice(0, length).value_counts()).empty:
        return None
    return cast(str, cnt.sort_values(ascending=False).index[0])


@dataclass(frozen=True)
class RanExperiment(Experiment):
    """
    An experiment that has been run.

    **Users should not instantiate this object directly.**
    """

    params: ExperimentParameters = field(repr=False)
    dataset: Dataset = field(repr=False)
    runs: Sequence[ExperimentRun] = field(repr=False)
    task_summary: TaskSummary = field(repr=False)
    eval_summaries: Tuple[EvaluationSummary, ...] = field(repr=False, default=())

    @property
    def url(self) -> str:
        return get_experiment_url(dataset_id=self.dataset.id, experiment_id=self.id)

    @property
    def info(self) -> str:
        return f"🔗 View this experiment: {self.url}"

    def add(self, eval_summary: EvaluationSummary) -> "RanExperiment":
        eval_summaries = (eval_summary, *self.eval_summaries)
        ran_experiment: RanExperiment = object.__new__(RanExperiment)
        ran_experiment.__init__(  # type: ignore[misc]
            **{**_asdict(self), "eval_summaries": eval_summaries}
        )
        return ran_experiment

    def __str__(self) -> str:
        summaries = (*self.eval_summaries, self.task_summary)
        return (
            "\n"
            + ("" if self.id == DRY_RUN else f"{self.info}\n\n")
            + "\n\n".join(map(str, summaries))
        )

    @classmethod
    def __new__(cls, *args: Any, **kwargs: Any) -> Any:
        # Direct instantiation by users is discouraged.
        raise NotImplementedError

    @classmethod
    def __init_subclass__(cls, **kwargs: Any) -> None:
        # Direct sub-classing by users is discouraged.
        raise NotImplementedError


def _asdict(dc: Any) -> Dict[str, Any]:
    # non-recursive version of `dataclasses.asdict()`
    return {field.name: getattr(dc, field.name) for field in fields(dc)}
