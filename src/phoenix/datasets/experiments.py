import functools
from copy import deepcopy
from datetime import datetime, timezone
from itertools import product
from typing import (
    Any,
    Awaitable,
    Callable,
    Coroutine,
    Mapping,
    Optional,
    Tuple,
    Type,
    Union,
    cast,
)

import httpx
from typing_extensions import TypeAlias

from phoenix.config import (
    get_env_client_headers,
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
)
from phoenix.datasets.types import (
    Dataset,
    EvaluationResult,
    Example,
    Experiment,
    ExperimentEvaluationRun,
    ExperimentEvaluator,
    ExperimentResult,
    ExperimentRun,
    ExperimentRunId,
    JSONSerializable,
    TestCase,
)
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.utilities.json_utils import jsonify

ExperimentTask: TypeAlias = Union[
    Callable[[Example], JSONSerializable],
    Callable[[Example], Coroutine[None, None, JSONSerializable]],
]


def _phoenix_client() -> httpx.Client:
    host = get_env_host()
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    base_url = base_url if base_url.endswith("/") else base_url + "/"
    headers = get_env_client_headers()
    client = httpx.Client(base_url=base_url, headers=headers)
    return client


def run_experiment(
    dataset: Dataset,
    task: ExperimentTask,
    *,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    repetitions: int = 1,
    rate_limit_errors: Optional[Union[Type[BaseException], Tuple[Type[BaseException], ...]]] = None,
) -> Experiment:
    assert repetitions > 0, "Must run the experiment at least once."

    client = _phoenix_client()

    experiment_response = client.post(
        f"/v1/datasets/{dataset.id}/experiments",
        json={
            "version-id": dataset.version_id,
            "name": experiment_name,
            "description": experiment_description,
            "metadata": experiment_metadata,
            "repetitions": repetitions,
        },
    )
    experiment_response.raise_for_status()
    experiment_id = experiment_response.json()["id"]

    errors: Tuple[Optional[Type[BaseException]], ...]
    if not hasattr(rate_limit_errors, "__iter__"):
        errors = (rate_limit_errors,)
    else:
        rate_limit_errors = cast(Tuple[Type[BaseException], ...], rate_limit_errors)
        errors = rate_limit_errors

    rate_limiters = [RateLimiter(rate_limit_error=rate_limit_error) for rate_limit_error in errors]

    def sync_run_experiment(test_case: TestCase) -> ExperimentRun:
        example, repetition_number = test_case.example, test_case.repetition_number
        start_time = datetime.now(timezone.utc)
        output = None
        error: Optional[Exception] = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol, because keyword arguments
            # are implementation details.
            _output = task(example)
            if isinstance(_output, Awaitable):
                raise RuntimeError("Task is async but running in sync context")
            else:
                output = _output
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now(timezone.utc)

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        experiment_run = ExperimentRun(
            start_time=start_time,
            end_time=end_time,
            experiment_id=experiment_id,
            dataset_example_id=example.id,
            repetition_number=repetition_number,
            output=ExperimentResult(result=output) if output else None,
            error=repr(error) if error else None,
        )
        return experiment_run

    async def async_run_experiment(test_case: TestCase) -> ExperimentRun:
        example, repetition_number = test_case.example, test_case.repetition_number
        start_time = datetime.now(timezone.utc)
        output = None
        error: Optional[BaseException] = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol, because keyword arguments
            # are implementation details.
            _output = task(example)
            if isinstance(_output, Awaitable):
                output = await _output
            else:
                output = _output
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now(timezone.utc)

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        experiment_run = ExperimentRun(
            start_time=start_time,
            end_time=end_time,
            experiment_id=experiment_id,
            dataset_example_id=example.id,
            repetition_number=repetition_number,
            output=ExperimentResult(result=output) if output else None,
            error=repr(error) if error else None,
        )
        return experiment_run

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

    test_cases = [
        TestCase(example=ex, repetition_number=rep)
        for ex, rep in product(dataset.examples, range(1, repetitions + 1))
    ]
    experiment_payloads, _execution_details = executor.run(test_cases)
    for payload in experiment_payloads:
        if payload is not None:
            resp = client.post(f"/v1/experiments/{experiment_id}/runs", json=jsonify(payload))
            resp.raise_for_status()
    return Experiment(
        id=experiment_id,
        dataset_id=dataset.id,
        dataset_version_id=dataset.version_id,
    )


def evaluate_experiment(
    experiment: Experiment,
    evaluator: ExperimentEvaluator,
) -> None:
    client = _phoenix_client()

    experiment_id = experiment.id
    dataset_id = experiment.dataset_id
    dataset_version_id = experiment.dataset_version_id

    dataset_examples = [
        Example.from_dict(ex)
        for ex in (
            client.get(
                f"/v1/datasets/{dataset_id}/examples",
                params={"version-id": str(dataset_version_id)},
            )
            .json()
            .get("data", {})
            .get("examples", [])
        )
    ]

    experiment_runs = [
        ExperimentRun.from_dict(exp_run)
        for exp_run in client.get(f"/v1/experiments/{experiment_id}/runs").json()
    ]

    # not all dataset examples have associated experiment runs, so we need to pair them up
    example_run_pairs = []
    examples_by_id = {example.id: example for example in dataset_examples}
    for exp_run in experiment_runs:
        example = examples_by_id.get(exp_run.dataset_example_id)
        if example:
            example_run_pairs.append((deepcopy(example), exp_run))

    def sync_evaluate_run(obj: Tuple[Example, ExperimentRun]) -> ExperimentEvaluationRun:
        example, experiment_run = obj
        start_time = datetime.now(timezone.utc)
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol, because keyword arguments
            # are implementation details.
            result = evaluator.evaluate(example, experiment_run)
        except BaseException as exc:
            error = exc
        finally:
            end_time = datetime.now(timezone.utc)

        evaluator_payload = ExperimentEvaluationRun(
            experiment_run_id=cast(ExperimentRunId, experiment_run.id),
            start_time=start_time,
            end_time=end_time,
            name=evaluator.name,
            annotator_kind=evaluator.annotator_kind,
            error=repr(error) if error else None,
            result=result,
        )
        return evaluator_payload

    async def async_evaluate_run(obj: Tuple[Example, ExperimentRun]) -> ExperimentEvaluationRun:
        example, experiment_run = obj
        start_time = datetime.now(timezone.utc)
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol, because keyword arguments
            # are implementation details.
            result = await evaluator.async_evaluate(example, experiment_run)
        except BaseException as exc:
            error = exc
        finally:
            end_time = datetime.now(timezone.utc)

        evaluator_payload = ExperimentEvaluationRun(
            experiment_run_id=cast(ExperimentRunId, experiment_run.id),
            start_time=start_time,
            end_time=end_time,
            name=evaluator.name,
            annotator_kind=evaluator.annotator_kind,
            error=repr(error) if error else None,
            result=result,
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
            resp = client.post("/v1/experiment_evaluations", json=jsonify(payload))
            resp.raise_for_status()
