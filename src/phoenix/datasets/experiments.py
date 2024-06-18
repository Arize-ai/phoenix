import functools
import json
from copy import deepcopy
from datetime import datetime
from itertools import product
from typing import (
    Any,
    Awaitable,
    Callable,
    Mapping,
    Optional,
    Tuple,
    Type,
    Union,
    cast,
)

import httpx

from phoenix.config import (
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
)
from phoenix.datasets.jsonify import jsonify
from phoenix.datasets.types import (
    Dataset,
    EvaluationResult,
    EvaluatorPayload,
    Example,
    Experiment,
    ExperimentEvaluator,
    ExperimentPayload,
    ExperimentResult,
    ExperimentRun,
    JSONSerializable,
    TestCase,
)
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter

ExperimentTask = Callable[
    [Example],
    Optional[Union[JSONSerializable, Awaitable[JSONSerializable]]],
]


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


class JSONParsable:
    def __call__(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        output = _unwrap_json(exp_run.output.result)
        assert isinstance(output, str), "Experiment run output must be a string"
        try:
            json.loads(output)
            json_parsable = True
        except BaseException:
            json_parsable = False
        return EvaluationResult(
            name=self.__class__.__name__,
            annotator_kind="CODE",
            score=float(json_parsable),
            label=None,
            explanation=None,
            metadata={},
        )


class ContainsKeyword:
    def __init__(self, keyword: str) -> None:
        super().__init__()
        self.keyword = keyword

    def __call__(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        result = _unwrap_json(exp_run.output.result)
        assert isinstance(result, str), "Experiment run output must be a string"
        found = self.keyword in result
        return EvaluationResult(
            name=self.__class__.__name__,
            annotator_kind="CODE",
            score=float(found),
            label=None,
            explanation=(
                f"the string {repr(self.keyword)} was "
                f"{'found' if found else 'not found'} in the output"
            ),
            metadata={},
        )


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

    def sync_run_experiment(test_case: TestCase) -> ExperimentPayload:
        example, repetition_number = test_case.example, test_case.repetition_number
        start_time = datetime.now()
        output = None
        error: Optional[Exception] = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol.
            _output = task(example)
            if isinstance(_output, Awaitable):
                raise RuntimeError("Task is async but running in sync context")
            else:
                output = _output
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        experiment_payload = ExperimentPayload(
            dataset_example_id=example.id,
            output=ExperimentResult(result=output),
            repetition_number=repetition_number,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            error=repr(error) if error else None,
        )

        return experiment_payload

    async def async_run_experiment(test_case: TestCase) -> ExperimentPayload:
        example, repetition_number = test_case.example, test_case.repetition_number
        start_time = datetime.now()
        output = None
        error = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol.
            _output = task(example)
            if isinstance(_output, Awaitable):
                output = await _output
            else:
                output = _output
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        experiment_payload = ExperimentPayload(
            dataset_example_id=example.id,
            output=ExperimentResult(result=output),
            repetition_number=repetition_number,
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            error=repr(error) if error else None,
        )

        return experiment_payload

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
    for run in experiment_runs:
        example = examples_by_id.get(run.dataset_example_id)
        if example:
            example_run_pairs.append((deepcopy(example), run))

    def sync_evaluate_run(obj: Tuple[Example, ExperimentRun]) -> EvaluatorPayload:
        example, experiment_run = obj
        start_time = datetime.now()
        output: Optional[EvaluationResult] = None
        error: Optional[Exception] = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol.
            _output = evaluator(example, experiment_run)
            if isinstance(_output, Awaitable):
                raise RuntimeError("Task is async but running in sync context")
            output = _output
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        evaluator_payload = EvaluatorPayload(
            experiment_run_id=experiment_run.id,
            name=output.name if output else str(evaluator),
            annotator_kind=getattr(evaluator, "annotator_kind", "CODE"),
            label=output.label if output else None,
            score=output.score if output else None,
            explanation=output.explanation if output else None,
            error=repr(error) if error else None,
            metadata=output.metadata if output else {},
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
        )
        return evaluator_payload

    async def async_evaluate_run(obj: Tuple[Example, ExperimentRun]) -> EvaluatorPayload:
        example, experiment_run = obj
        start_time = datetime.now()
        output: Optional[EvaluationResult] = None
        error = None
        try:
            # Do not use keyword arguments, which can fail at runtime
            # even when function obeys protocol.
            _output = evaluator(example, experiment_run)
            if isinstance(_output, Awaitable):
                output = await _output
            else:
                output = _output
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        evaluator_payload = EvaluatorPayload(
            experiment_run_id=experiment_run.id,
            name=output.name if output else str(evaluator),
            annotator_kind=getattr(evaluator, "annotator_kind", "CODE"),
            label=output.label if output else None,
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
            resp = client.post(
                f"/v1/experiments/{experiment_id}/runs/{payload.experiment_run_id}/evaluations",
                json=jsonify(payload),
            )
            resp.raise_for_status()
