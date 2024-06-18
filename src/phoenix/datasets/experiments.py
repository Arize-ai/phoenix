import asyncio
import functools
import json
from dataclasses import dataclass, field
from datetime import datetime
from itertools import product
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    List,
    Mapping,
    Optional,
    Protocol,
    Tuple,
    Type,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

import httpx

from phoenix.config import get_env_collector_endpoint, get_env_host, get_env_port
from phoenix.datasets.decorators import capture_experiment_result
from phoenix.datasets.types import (
    Dataset,
    Example,
    Experiment,
    ExperimentResult,
    TestCase,
)
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter

JSONSerializable = Union[Dict[str, Any], List[Any], str, int, float, bool, None]


class ExampleProtocol(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def input(self) -> JSONSerializable: ...

    @property
    def output(self) -> JSONSerializable: ...


class RunProtocol(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def output(self) -> JSONSerializable: ...


class DatasetProtocol(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def version_id(self) -> str: ...

    @property
    def examples(self) -> List[ExampleProtocol]: ...


T = TypeVar("T")


class EvaluatorPayload(TypedDict):
    experiment_run_id: str
    name: str
    annotator_kind: str
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    error: Optional[str]
    metadata: JSONSerializable
    start_time: str
    end_time: str


class EvaluationProtocol(Protocol):
    @property
    def score(self) -> Optional[float]: ...

    @property
    def explanation(self) -> Optional[str]: ...

    @property
    def metadata(self) -> JSONSerializable: ...


@dataclass
class Evaluation:
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: JSONSerializable = field(default_factory=dict)


class ExperimentEvaluator(Protocol):
    def __call__(
        self, input: JSONSerializable, reference: JSONSerializable, output: JSONSerializable
    ) -> EvaluationProtocol: ...

    @property
    def annotator_kind(self) -> str: ...


def _phoenix_client() -> httpx.Client:
    host = get_env_host()
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    base_url = base_url if base_url.endswith("/") else base_url + "/"
    client = httpx.Client(base_url=base_url)
    return client


def _unwrap_json(obj: JSONSerializable) -> JSONSerializable:
    if isinstance(obj, dict):
        if len(obj) == 1:
            key = next(iter(obj.keys()))
            output = obj[key]
            assert isinstance(
                output, (dict, list, str, int, float, bool, type(None))
            ), "Output must be JSON serializable"
            return output
    return obj


class JSONParsable(ExperimentEvaluator):
    annotator_kind = "CODE"

    def __call__(
        self, input: JSONSerializable, reference: JSONSerializable, output: JSONSerializable
    ) -> Evaluation:
        output = _unwrap_json(output)
        assert isinstance(output, str), "Experiment run output must be a string"
        try:
            json.loads(output)
            json_parsable = True
        except json.JSONDecodeError:
            json_parsable = False

        return Evaluation(
            score=float(json_parsable),
            explanation=None,
            metadata={},
        )


class ContainsKeyword(ExperimentEvaluator):
    annotator_kind = "CODE"

    def __init__(self, keyword: str):
        self.keyword = keyword

    def __call__(
        self, input: JSONSerializable, reference: JSONSerializable, output: JSONSerializable
    ) -> Evaluation:
        output = _unwrap_json(output)
        assert isinstance(output, str), "Experiment run output must be a string"
        found = self.keyword in output
        evaluation = Evaluation(
            score=float(found),
            explanation=(
                f"the string {repr(self.keyword)} was "
                f"{'found' if found else 'not found'} in the output"
            ),
            metadata={},
        )
        return evaluation


def run_experiment(
    dataset: Dataset,
    fn: Union[Callable[[Example], T], Callable[[Example], Awaitable[T]]],
    *,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    repetitions: int = 1,
    rate_limit_errors: Optional[Union[Type[BaseException], Tuple[Type[BaseException], ...]]] = None,
    dry_run: bool = False,
) -> Experiment:
    assert repetitions > 0, "Must run the experiment at least once."

    experiment = Experiment(
        dry_run=dry_run,
        dataset_id=dataset.id,
        dataset_version_id=dataset.version_id,
        split=dataset.split,
        name=experiment_name,
        description=experiment_description,
        metadata=experiment_metadata,
        repetitions=repetitions,
        test_cases=tuple(
            TestCase(example=ex, repetition_number=rep)
            for ex, rep in product(dataset.examples, range(1, repetitions + 1))
        ),
    )

    def task(tc: TestCase) -> T:
        def on_finish(result: ExperimentResult) -> None:
            experiment[tc.id] = result

        return capture_experiment_result(fn, on_finish=on_finish)(tc.example)

    errors: Tuple[Optional[Type[BaseException]], ...]
    if not hasattr(rate_limit_errors, "__iter__"):
        errors = (rate_limit_errors,)
    else:
        rate_limit_errors = cast(Tuple[Type[BaseException], ...], rate_limit_errors)
        errors = rate_limit_errors

    rate_limiters = [RateLimiter(rate_limit_error=rate_limit_error) for rate_limit_error in errors]

    def sync_run_experiment(test_case: TestCase) -> T:
        if asyncio.iscoroutinefunction(task):
            raise RuntimeError("Task is async but running in sync context")
        else:
            return task(test_case)

    async def async_run_experiment(test_case: TestCase) -> T:
        if asyncio.iscoroutinefunction(task):
            return await task(test_case)
        else:
            return task(test_case)

    rate_limited_sync_run_experiment = functools.reduce(
        lambda fn, limiter: limiter.limit(fn), rate_limiters, sync_run_experiment
    )
    rate_limited_async_run_experiment = functools.reduce(
        lambda fn, limiter: limiter.alimit(fn), rate_limiters, async_run_experiment
    )

    executor = get_executor_on_sync_context(
        rate_limited_sync_run_experiment,
        rate_limited_async_run_experiment,
        max_retries=0,
        exit_on_error=False,
        fallback_return_value=None,
    )

    executor.run(experiment.test_cases)
    return experiment


def evaluate_experiment(
    experiment: Experiment,
    evaluator: ExperimentEvaluator,
    name: Optional[str] = None,
    label: Optional[str] = None,
) -> None:
    # define wrapper classes to coerce JSON payloads to conform to the input protocols until
    # we flesh out our clientside models

    @dataclass
    class ExampleWrapper:
        id: str
        input: JSONSerializable
        output: JSONSerializable

    @dataclass
    class RunWrapper:
        id: str
        output: JSONSerializable

    client = _phoenix_client()

    experiment_id = experiment.id
    dataset_id = experiment.dataset_id
    dataset_version_id = experiment.dataset_version_id

    dataset_examples = (
        client.get(
            f"/v1/datasets/{dataset_id}/examples",
            params={"version-id": str(dataset_version_id)},
        )
        .json()
        .get("data", {})
        .get("examples", [])
    )

    experiment_runs = client.get(f"/v1/experiments/{experiment_id}/runs").json()

    # not all dataset examples have associated experiment runs, so we need to pair them up
    example_run_pairs = []
    examples_by_id = {example["id"]: example for example in dataset_examples}
    for run in experiment_runs:
        example = examples_by_id.get(run["dataset_example_id"])
        if example:
            wrapped_example = ExampleWrapper(
                id=example["id"], input=example["input"], output=example["output"]
            )
            wrapped_run = RunWrapper(id=run["id"], output=run["output"])
            example_run_pairs.append((wrapped_example, wrapped_run))

    def sync_evaluate_run(example_run: Tuple[ExampleProtocol, RunProtocol]) -> EvaluatorPayload:
        example, run = example_run
        start_time = datetime.now()
        output = None
        error: Optional[Exception] = None
        try:
            if asyncio.iscoroutinefunction(evaluator):
                raise RuntimeError("Task is async but running in sync context")
            else:
                output = evaluator(input=example.input, reference=example.output, output=run.output)
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        evaluator_payload = EvaluatorPayload(
            experiment_run_id=run.id,
            name=name if name is not None else str(evaluator),
            annotator_kind=getattr(evaluator, "annotator_kind", "CODE"),
            label=label if label is not None else None,
            score=output.score if output else None,
            explanation=output.explanation if output else None,
            error=repr(error) if error else None,
            metadata=output.metadata if output else {},
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
        )
        return evaluator_payload

    async def async_evaluate_run(
        example_run: Tuple[ExampleProtocol, RunProtocol],
    ) -> EvaluatorPayload:
        example, run = example_run
        start_time = datetime.now()
        output = None
        error = None
        try:
            if asyncio.iscoroutinefunction(evaluator):
                output = await evaluator(
                    input=example.input, reference=example.output, output=run.output
                )
            else:
                output = evaluator(input=example.input, reference=example.output, output=run.output)
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        evaluator_payload = EvaluatorPayload(
            experiment_run_id=run.id,
            name=name if name is not None else str(evaluator),
            annotator_kind=getattr(evaluator, "annotator_kind", "CODE"),
            label=label if label is not None else None,
            score=output.score if output else None,
            explanation=output.explanation if output else None,
            error=repr(error) if error else None,
            metadata=output.metadata if output else {},
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
        )
        return evaluator_payload

    executor = get_executor_on_sync_context(
        sync_evaluate_run,
        async_evaluate_run,
        max_retries=0,
        exit_on_error=False,
        fallback_return_value=None,
    )
    evaluation_payloads, _execution_details = executor.run(example_run_pairs)
    for payload in evaluation_payloads:
        if payload is not None:
            client.post(
                f"/v1/experiments/{experiment_id}/runs/{payload['experiment_run_id']}/evaluations",
                json=payload,
            )
