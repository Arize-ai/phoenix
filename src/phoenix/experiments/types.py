from __future__ import annotations

import json
import textwrap
from collections import Counter
from copy import copy, deepcopy
from dataclasses import dataclass, field, fields
from datetime import datetime
from enum import Enum
from functools import cached_property
from importlib.metadata import version
from random import getrandbits
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    FrozenSet,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    TypeVar,
    Union,
    cast,
    overload,
)

import pandas as pd
from typing_extensions import TypeAlias
from wrapt import ObjectProxy

from phoenix.datetime_utils import local_now
from phoenix.experiments.utils import get_experiment_url


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

Score: TypeAlias = Optional[Union[bool, int, float]]
Label: TypeAlias = Optional[str]
Explanation: TypeAlias = Optional[str]

EvaluatorName: TypeAlias = str
EvaluatorKind: TypeAlias = str
EvaluatorOutput: TypeAlias = Union[
    "EvaluationResult", bool, int, float, str, Tuple[Score, Label, Explanation]
]

DRY_RUN: ExperimentId = "DRY_RUN"


def _dry_run_id() -> str:
    suffix = getrandbits(24).to_bytes(3, "big").hex()
    return f"{DRY_RUN}_{suffix}"


@dataclass(frozen=True)
class Example:
    id: ExampleId
    updated_at: datetime
    input: Mapping[str, JSONSerializable] = field(default_factory=dict)
    output: Mapping[str, JSONSerializable] = field(default_factory=dict)
    metadata: Mapping[str, JSONSerializable] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "input", _make_read_only(self.input))
        object.__setattr__(self, "output", _make_read_only(self.output))
        object.__setattr__(self, "metadata", _make_read_only(self.metadata))

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> Example:
        return cls(
            input=obj["input"],
            output=obj["output"],
            metadata=obj.get("metadata") or {},
            id=obj["id"],
            updated_at=obj["updated_at"],
        )

    def __repr__(self) -> str:
        spaces = " " * 4
        name = self.__class__.__name__
        identifiers = [f'{spaces}id="{self.id}",']
        contents = [
            spaces
            + f"{_blue(key)}="
            + json.dumps(
                _shorten(value),
                ensure_ascii=False,
                sort_keys=True,
                indent=len(spaces),
            )
            .replace("\n", f"\n{spaces}")
            .replace(' "..."\n', " ...\n")
            + ","
            for key in ("input", "output", "metadata")
            if (value := getattr(self, key, None))
        ]
        return "\n".join([f"{name}(", *identifiers, *contents, ")"])


@dataclass(frozen=True)
class Dataset:
    id: DatasetId
    version_id: DatasetVersionId
    examples: Mapping[ExampleId, Example] = field(repr=False, default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "examples", _ReadOnly(self.examples))

    def __len__(self) -> int:
        return len(self.examples)

    def __iter__(self) -> Iterator[Example]:
        return iter(self.examples.values())

    @cached_property
    def _keys(self) -> Tuple[str, ...]:
        return tuple(self.examples.keys())

    @overload
    def __getitem__(self, key: int) -> Example: ...
    @overload
    def __getitem__(self, key: slice) -> List[Example]: ...
    def __getitem__(self, key: Union[int, slice]) -> Union[Example, List[Example]]:
        if isinstance(key, int):
            return self.examples[self._keys[key]]
        return [self.examples[k] for k in self._keys[key]]

    def as_dataframe(self, drop_empty_columns: bool = True) -> pd.DataFrame:
        df = pd.DataFrame.from_records(
            [
                {
                    "example_id": example.id,
                    "input": deepcopy(example.input),
                    "output": deepcopy(example.output),
                    "metadata": deepcopy(example.metadata),
                }
                for example in self.examples.values()
            ]
        ).set_index("example_id")
        if drop_empty_columns:
            return df.reindex([k for k, v in df.items() if v.astype(bool).any()], axis=1)
        return df

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> Dataset:
        examples = tuple(map(Example.from_dict, obj.get("examples") or ()))
        return cls(
            id=obj["id"],
            version_id=obj["version_id"],
            examples={ex.id: ex for ex in examples},
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
    project_name: str = field(repr=False)

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

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> ExperimentRun:
        return cls(
            start_time=obj["start_time"],
            end_time=obj["end_time"],
            experiment_id=obj["experiment_id"],
            dataset_example_id=obj["dataset_example_id"],
            repetition_number=obj.get("repetition_number") or 1,
            output=_make_read_only(obj.get("output")),
            error=obj.get("error"),
            id=obj["id"],
            trace_id=obj.get("trace_id"),
        )

    def __post_init__(self) -> None:
        if bool(self.output) == bool(self.error):
            raise ValueError("Must specify exactly one of experiment_run_output or error")


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
        if self.score is None and not self.label:
            raise ValueError("Must specify score or label, or both")
        if self.score is None and not self.label:
            object.__setattr__(self, "score", 0)
        for k in ("label", "explanation"):
            if (v := getattr(self, k, None)) is not None:
                object.__setattr__(self, k, str(v) or None)


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
            id=obj["id"],
            trace_id=obj.get("trace_id"),
        )

    def __post_init__(self) -> None:
        if bool(self.result) == bool(self.error):
            raise ValueError("Must specify either result or error")


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
        *eval_runs: Optional[ExperimentEvaluationRun],
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
                    {"evaluator": name, "error": None, "score": None, "label": None}
                    for name in params.eval_names
                ]
            )
        has_error = bool(df.loc[:, "error"].astype(bool).sum())
        has_score = bool(df.loc[:, "score"].dropna().count())
        has_label = bool(df.loc[:, "label"].astype(bool).sum())
        agg = {
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
        }
        stats = (
            df.groupby("evaluator").agg(**agg)  # type: ignore[call-overload]
            if agg
            else pd.DataFrame()
        )
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
            "n_examples": params.count,
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
    runs: Mapping[ExperimentRunId, ExperimentRun] = field(repr=False)
    task_summary: TaskSummary = field(repr=False)
    eval_runs: Tuple[ExperimentEvaluationRun, ...] = field(repr=False, default=())
    eval_summaries: Tuple[EvaluationSummary, ...] = field(repr=False, default=())

    @property
    def url(self) -> str:
        return get_experiment_url(dataset_id=self.dataset.id, experiment_id=self.id)

    @property
    def info(self) -> str:
        return f"🔗 View this experiment: {self.url}"

    def __post_init__(self) -> None:
        runs = {
            id_: (
                _ExperimentRunWithExample(run, example)
                if (example := self.dataset.examples.get(run.dataset_example_id))
                else run
            )
            for id_, run in self.runs.items()
        }
        object.__setattr__(self, "runs", runs)

    def __len__(self) -> int:
        return len(self.runs)

    def __iter__(self) -> Iterator[ExperimentRun]:
        return iter(self.runs.values())

    @cached_property
    def _keys(self) -> Tuple[str, ...]:
        return tuple(self.runs.keys())

    @overload
    def __getitem__(self, key: int) -> ExperimentRun: ...
    @overload
    def __getitem__(self, key: slice) -> List[ExperimentRun]: ...
    def __getitem__(self, key: Union[int, slice]) -> Union[ExperimentRun, List[ExperimentRun]]:
        if isinstance(key, int):
            return self.runs[self._keys[key]]
        return [self.runs[k] for k in self._keys[key]]

    def get_evaluations(
        self,
        drop_empty_columns: bool = True,
    ) -> pd.DataFrame:
        df = pd.DataFrame.from_records(
            [
                {
                    "run_id": run.experiment_run_id,
                    "name": run.name,
                    "error": run.error,
                    "score": run.result.score if run.result else None,
                    "label": run.result.label if run.result else None,
                    "explanation": run.result.explanation if run.result else None,
                }
                for run in self.eval_runs
            ]
        ).set_index("run_id")
        if drop_empty_columns:
            df = df.reindex([k for k, v in df.items() if v.astype(bool).any()], axis=1)
        return df.join(self.as_dataframe())

    def as_dataframe(self, drop_empty_columns: bool = True) -> pd.DataFrame:
        df = pd.DataFrame.from_records(
            [
                {
                    "run_id": run.id,
                    "error": run.error,
                    "output": deepcopy(run.output),
                    "input": deepcopy((ex := self.dataset.examples[run.dataset_example_id]).input),
                    "expected": deepcopy(ex.output),
                    "metadata": deepcopy(ex.metadata),
                    "example_id": run.dataset_example_id,
                }
                for run in self.runs.values()
            ]
        ).set_index("run_id")
        if drop_empty_columns:
            return df.reindex([k for k, v in df.items() if v.astype(bool).any()], axis=1)
        return df

    def add(
        self,
        eval_summary: EvaluationSummary,
        *eval_runs: Optional[ExperimentEvaluationRun],
    ) -> "RanExperiment":
        return _replace(
            self,
            eval_runs=(*self.eval_runs, *filter(bool, eval_runs)),
            eval_summaries=(*self.eval_summaries, eval_summary),
        )

    def __str__(self) -> str:
        summaries = (*reversed(self.eval_summaries), self.task_summary)
        return (
            "\n"
            + ("" if self.id.startswith(DRY_RUN) else f"{self.info}\n\n")
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


T = TypeVar("T")


def _replace(obj: T, **kwargs: Any) -> T:
    new_obj = object.__new__(obj.__class__)
    new_obj.__init__(**{**_asdict(obj), **kwargs})  # type: ignore[misc]
    return new_obj


def _shorten(obj: Any, width: int = 50) -> Any:
    if isinstance(obj, str):
        return textwrap.shorten(obj, width=width, placeholder="...")
    if isinstance(obj, dict):
        return {k: _shorten(v) for k, v in obj.items()}
    if isinstance(obj, list):
        if len(obj) > 2:
            return [_shorten(v) for v in obj[:2]] + ["..."]
        return [_shorten(v) for v in obj]
    return obj


def _make_read_only(obj: Any) -> Any:
    if isinstance(obj, dict):
        return _ReadOnly({k: _make_read_only(v) for k, v in obj.items()})
    if isinstance(obj, str):
        return obj
    if isinstance(obj, list):
        return _ReadOnly(list(map(_make_read_only, obj)))
    return obj


class _ReadOnly(ObjectProxy):  # type: ignore[misc]
    def __setitem__(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    def __delitem__(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    def __iadd__(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    def pop(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    def append(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError

    def __copy__(self, *args: Any, **kwargs: Any) -> Any:
        return copy(self.__wrapped__)

    def __deepcopy__(self, *args: Any, **kwargs: Any) -> Any:
        return deepcopy(self.__wrapped__)

    def __repr__(self) -> str:
        return repr(self.__wrapped__)

    def __str__(self) -> str:
        return str(self.__wrapped__)


class _ExperimentRunWithExample(ObjectProxy):  # type: ignore[misc]
    def __init__(self, wrapped: ExperimentRun, example: Example) -> None:
        super().__init__(wrapped)
        self._self_example = example

    @property
    def expected(self) -> ExampleOutput:
        return deepcopy(self._self_example.output)

    @property
    def reference(self) -> ExampleOutput:
        return deepcopy(self._self_example.output)

    @property
    def input(self) -> ExampleInput:
        return deepcopy(self._self_example.input)

    @property
    def metadata(self) -> ExampleMetadata:
        return deepcopy(self._self_example.metadata)

    def __repr__(self) -> str:
        spaces = " " * 4
        name = self.__class__.__name__
        identifiers = [
            f'{spaces}id="{self.id}",',
            f'{spaces}example_id="{self.dataset_example_id}",',
        ]
        outputs = [
            *([f'{spaces}error="{self.error}",'] if self.error else []),
            *(
                [
                    f"{spaces}{_blue('output')}="
                    + json.dumps(
                        _shorten(self.output),
                        ensure_ascii=False,
                        sort_keys=True,
                        indent=len(spaces),
                    )
                    .replace("\n", f"\n{spaces}")
                    .replace(' "..."\n', " ...\n")
                ]
                if not self.error
                else []
            ),
        ]
        dicts = [
            spaces
            + f"{_blue(alias)}={{"
            + (f" # {comment}" if comment else "")
            + json.dumps(
                _shorten(value),
                ensure_ascii=False,
                sort_keys=True,
                indent=len(spaces),
            )[1:]
            .replace("\n", f"\n{spaces}")
            .replace(' "..."\n', " ...\n")
            + ","
            for alias, value, comment in (
                ("expected", self.expected, f"alias for the example.{_blue('output')} dict"),
                ("reference", self.reference, f"alias for the example.{_blue('output')} dict"),
                ("input", self.input, f"alias for the example.{_blue('input')} dict"),
                ("metadata", self.metadata, f"alias for the example.{_blue('metadata')} dict"),
            )
            if value
        ]
        return "\n".join([f"{name}(", *identifiers, *outputs, *dicts, ")"])


def _blue(text: str) -> str:
    return f"\033[1m\033[94m{text}\033[0m"
