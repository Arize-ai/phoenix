import logging
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from queue import SimpleQueue
from threading import RLock
from types import MappingProxyType
from typing import (
    Any,
    Callable,
    Dict,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    TypedDict,
    TypeVar,
    cast,
)

import httpx
from typing_extensions import TypeAlias

from phoenix.config import get_env_collector_endpoint, get_env_host, get_env_port
from phoenix.datasets.jsonify import jsonify

logger = logging.getLogger(__name__)

T = TypeVar("T")

ExampleId: TypeAlias = str
RepetitionId: TypeAlias = int


@dataclass(frozen=True)
class Example:
    """
    Contains input, output, metadata, and other information for a dataset
    example.
    """

    id: ExampleId
    input: MappingProxyType[str, Any]
    output: MappingProxyType[str, Any]
    metadata: MappingProxyType[str, Any]
    updated_at: datetime


@dataclass(frozen=True)
class Dataset:
    """
    Contains dataset metadata and examples.
    """

    id: str
    version_id: str
    examples: Tuple[Example, ...]
    split: Optional[str] = None


@dataclass(frozen=True)
class ExecutionResult:
    id: str
    result: Optional[Mapping[str, Any]] = field(default=None)
    intermediate_results: Optional[Tuple["ExecutionResult"]] = field(default=None)
    inputs: Optional[Mapping[str, Any]] = field(default=None)
    error: Optional[str] = field(default=None)

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "ExecutionResult":
        result = obj.get("result")
        intermediate_results = obj.get("intermediate_results")
        inputs = obj.get("inputs")
        return cls(
            id=obj.get("id") or str(id(obj)),
            result=cast(Mapping[str, Any], MappingProxyType(result))
            if isinstance(result, dict)
            else None,
            intermediate_results=tuple(intermediate_results)
            if isinstance(intermediate_results, Sequence)
            else None,
            inputs=cast(Mapping[str, Any], MappingProxyType(inputs))
            if isinstance(inputs, dict)
            else None,
            error=obj.get("error"),
        )


TestCaseId: TypeAlias = Tuple[ExampleId, RepetitionId]


@dataclass(frozen=True)
class TestCase:
    example: Example
    repetition_number: int
    id: TestCaseId = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "example", deepcopy(self.example))
        object.__setattr__(self, "id", (self.example.id, self.repetition_number))


@dataclass(frozen=True)
class ExperimentResult:
    execution_result: ExecutionResult
    start_time: datetime
    end_time: datetime


class ExecutionConfig(TypedDict, total=False):
    identifier: str
    transform_inputs: Callable[..., Any]
    transform_output: Callable[..., Any]


def _phoenix_client() -> httpx.Client:
    host = get_env_host()
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    base_url = base_url if base_url.endswith("/") else base_url + "/"
    client = httpx.Client(base_url=base_url)
    return client


@dataclass(frozen=True)
class Experiment:
    dataset_id: str
    dataset_version_id: str
    split: Optional[str] = None
    repetitions: int = field(default=1)
    name: Optional[str] = field(default=None)
    description: Optional[str] = field(default=None)
    metadata: Optional[Mapping[str, Any]] = field(default=None)
    test_cases: Tuple[TestCase, ...] = field(default_factory=tuple)
    dry_run: bool = False
    id: Optional[str] = None

    _client: Optional[httpx.Client] = field(init=False, default=None)
    _results: Dict[TestCaseId, ExperimentResult] = field(init=False, default_factory=dict)
    _lock: RLock = field(init=False, default_factory=RLock)
    _send_queue: Optional[SimpleQueue[Optional[ExperimentResult]]] = field(init=False, default=None)

    @property
    def results(self) -> Mapping[TestCaseId, ExperimentResult]:
        return MappingProxyType(self._results)

    def __setitem__(self, key: TestCaseId, value: ExperimentResult) -> None:
        with self._lock:
            if (result := self._results.get(key)) and result.execution_result.error is None:
                logger.warning(f"result already completed: {key=}")
                return
            self._results[key] = value

    def __post_init__(self) -> None:
        if self.dry_run or self._client is None:
            return
        response = self._client.post(
            f"/v1/datasets/{self.dataset_id}/experiments",
            json={
                "version-id": self.dataset_version_id,
                **({"name": self.name} if self.name is not None else {}),
                **({"description": self.description} if self.description is not None else {}),
                **({"metadata": jsonify(self.metadata)} if self.metadata is not None else {}),
                "repetitions": self.repetitions,
            },
        )
        response.raise_for_status()
        object.__setattr__(self, "id", response.json()["id"])


class ExperimentPayload(TypedDict):
    dataset_example_id: str
    output: Mapping[str, Any]
    repetition_number: int
    start_time: str
    end_time: str
    error: Optional[str]


# ExperimentPayload(
#     dataset_example_id=example.id,
#     output=output,
#     repetition_number=repetition_number,
#     start_time=start_time.isoformat(),
#     end_time=end_time.isoformat(),
#     error=repr(error) if error else None,
# )
