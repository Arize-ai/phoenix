import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import (
    Any,
    Callable,
    Coroutine,
    Dict,
    List,
    Optional,
    Protocol,
    Tuple,
    Type,
    TypedDict,
    Union,
)

import httpx

from phoenix.config import (
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
)
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter

JSONSerializable = Union[Dict[str, Any], List[Any], str, int, float, bool, None]
ExperimentCallable = Callable[[JSONSerializable], JSONSerializable]
ExperimentCoroutineFn = Callable[[JSONSerializable], Coroutine[Any, Any, JSONSerializable]]


class ExampleProtocol(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def input(self) -> JSONSerializable: ...


class DatasetProtocol(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def version_id(self) -> str: ...

    def examples(self) -> List[ExampleProtocol]: ...


@dataclass
class Experiment:
    id: str
    dataset_id: str
    dataset_version_id: str


class ExperimentPayload(TypedDict):
    dataset_example_id: str
    output: JSONSerializable
    start_time: str
    end_time: str
    error: Optional[str]


def _phoenix_client() -> httpx.Client:
    host = get_env_host()
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    base_url = base_url if base_url.endswith("/") else base_url + "/"
    client = httpx.Client(base_url=base_url)
    return client


def run_experiment(
    dataset: DatasetProtocol,
    task: Union[ExperimentCallable, ExperimentCoroutineFn],
    rate_limit_errors: Optional[Union[Type[BaseException], Tuple[Type[BaseException], ...]]] = None,
) -> Experiment:
    client = _phoenix_client()

    experiment_response = client.post(
        f"/v1/datasets/{dataset.id}/experiments", json={"version-id": dataset.version_id}
    )
    experiment_id = experiment_response.json()["id"]

    rate_limiter = RateLimiter(rate_limit_error=rate_limit_errors)

    @rate_limiter.limit
    def sync_run_experiment(example: ExampleProtocol) -> ExperimentPayload:
        start_time = datetime.now()
        output = None
        error: Optional[Exception] = None
        try:
            if asyncio.iscoroutinefunction(task):
                raise RuntimeError("Task is async but running in sync context")
            else:
                output = task(example.input)
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        experiment_payload = ExperimentPayload(
            dataset_example_id=example.id,
            output=output,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            error=repr(error) if error else None,
        )

        return experiment_payload

    @rate_limiter.alimit
    async def async_run_experiment(example: ExampleProtocol) -> ExperimentPayload:
        start_time = datetime.now()
        output = None
        error = None
        try:
            if asyncio.iscoroutinefunction(task):
                output = await task(example.input)
            else:
                output = task(example.input)
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        experiment_payload = ExperimentPayload(
            dataset_example_id=example.id,
            output=output,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            error=error=repr(error) if error else None,
        )

        return experiment_payload

    executor = get_executor_on_sync_context(
        sync_run_experiment,
        async_run_experiment,
        max_retries=0,
        exit_on_error=False,
        fallback_return_value=None,
    )

    experiment_payloads, _execution_details = executor.run(dataset.examples())
    for payload in experiment_payloads:
        if payload is not None:
            client.post(f"/v1/experiments/{experiment_id}/runs", json=payload)
    return Experiment(
        id=experiment_id, dataset_id=dataset.id, dataset_version_id=dataset.version_id
    )
