import functools
import inspect
import json
import logging
import random
import traceback
from binascii import hexlify
from collections.abc import Awaitable, Mapping, Sequence
from contextlib import ExitStack
from dataclasses import replace
from datetime import datetime, timezone
from itertools import product
from typing import Any, Callable, Literal, Optional, Union, cast
from urllib.parse import urljoin

import httpx
import opentelemetry.sdk.trace as trace_sdk
from httpx import HTTPStatusError
from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import Span
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Status, StatusCode, Tracer

from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import Dataset
from phoenix.client.utils.executors import AsyncExecutor, SyncExecutor
from phoenix.client.utils.rate_limiters import RateLimiter
from phoenix.config import get_base_url, get_env_client_headers
from phoenix.evals.utils import get_tqdm_progress_bar_formatter

from .types import (
    DRY_RUN,
    EvaluationResult,
    Evaluator,
    EvaluatorName,
    Evaluators,
    Experiment,
    ExperimentEvaluationRun,
    ExperimentRun,
    ExperimentTask,
    FunctionEvaluator,
    RateLimitErrors,
    TestCase,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 60


def create_evaluator(
    name: Optional[str] = None, kind: str = "CODE"
) -> Callable[[Callable[..., Any]], Evaluator]:
    """Create an evaluator from a function."""

    def wrapper(func: Callable[..., Any]) -> Evaluator:
        if isinstance(func, Evaluator):
            return func
        return FunctionEvaluator(func, name)

    return wrapper


def get_func_name(func: Callable[..., Any]) -> str:
    """Get the name of a function."""
    return getattr(func, "__name__", str(func))


def jsonify(obj: Any) -> Any:
    """Convert object to JSON-serializable format."""
    if obj is None:
        return None
    elif isinstance(obj, (str, int, float, bool)):
        return obj
    elif isinstance(obj, (list, tuple)):
        return [jsonify(item) for item in obj]
    elif isinstance(obj, dict):
        return {str(k): jsonify(v) for k, v in obj.items()}
    elif hasattr(obj, "__dict__"):
        return jsonify(obj.__dict__)
    else:
        return str(obj)


class _NoOpProcessor(trace_sdk.SpanProcessor):
    """No-op span processor for dry runs."""

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True


def _evaluators_by_name(obj: Optional[Evaluators]) -> Mapping[EvaluatorName, Evaluator]:
    """Convert evaluators input to mapping by name."""
    evaluators_by_name: dict[EvaluatorName, Evaluator] = {}
    if obj is None:
        return evaluators_by_name

    if isinstance(obj, Mapping):
        for name, value in obj.items():
            evaluator = (
                create_evaluator(name=name)(value) if not isinstance(value, Evaluator) else value
            )
            evaluators_by_name[evaluator.name] = evaluator
    elif isinstance(obj, Sequence):
        for value in obj:
            evaluator = create_evaluator()(value) if not isinstance(value, Evaluator) else value
            evaluators_by_name[evaluator.name] = evaluator
    else:
        evaluator = create_evaluator()(obj) if not isinstance(obj, Evaluator) else obj
        evaluators_by_name[evaluator.name] = evaluator

    return evaluators_by_name


def _get_tracer(project_name: Optional[str] = None) -> tuple[Tracer, Resource]:
    """Create a tracer for experiment runs."""
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name} if project_name else {})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    span_processor = (
        SimpleSpanProcessor(
            OTLPSpanExporter(
                endpoint=urljoin(f"{get_base_url()}", "v1/traces"),
                headers=get_env_client_headers(),
            )
        )
        if project_name
        else _NoOpProcessor()
    )
    tracer_provider.add_span_processor(span_processor)
    return tracer_provider.get_tracer(__name__), resource


def _str_trace_id(id_: int) -> str:
    """Convert trace ID to string."""
    return hexlify(id_.to_bytes(16, "big")).decode()


def _decode_unix_nano(time_unix_nano: int) -> datetime:
    """Convert Unix nanoseconds to datetime."""
    return datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)


def _validate_task_signature(sig: inspect.Signature) -> None:
    """Validate that task function has valid signature."""
    params = sig.parameters
    valid_named_params = {"input", "expected", "reference", "metadata", "example"}
    if len(params) == 0:
        raise ValueError("Task function must have at least one parameter.")
    if len(params) > 1:
        for not_found in set(params) - valid_named_params:
            param = params[not_found]
            if (
                param.kind is inspect.Parameter.VAR_KEYWORD
                or param.default is not inspect.Parameter.empty
            ):
                continue
            raise ValueError(
                f"Invalid parameter names in task function: {not_found}. "
                "Parameters names for multi-argument functions must be "
                f"any of: {', '.join(valid_named_params)}."
            )


def _bind_task_signature(
    sig: inspect.Signature, example: v1.DatasetExample
) -> inspect.BoundArguments:
    """Bind task function signature to example data."""
    parameter_mapping = {
        "input": example["input"],
        "expected": example["output"],
        "reference": example["output"],
        "metadata": example["metadata"],
        "example": example,
    }
    params = sig.parameters
    if len(params) == 1:
        parameter_name = next(iter(params))
        if parameter_name in parameter_mapping:
            return sig.bind(parameter_mapping[parameter_name])
        else:
            return sig.bind(parameter_mapping["input"])
    return sig.bind_partial(
        **{name: parameter_mapping[name] for name in set(parameter_mapping).intersection(params)}
    )


def _print_experiment_error(
    error: BaseException,
    /,
    *,
    example_id: str,
    repetition_number: int,
    kind: Literal["evaluator", "task"],
) -> None:
    """Print an experiment error."""
    display_error = RuntimeError(
        f"{kind} failed for example id {repr(example_id)}, repetition {repr(repetition_number)}"
    )
    display_error.__cause__ = error
    formatted_exception = "".join(
        traceback.format_exception(type(display_error), display_error, display_error.__traceback__)
    )
    print("\033[91m" + formatted_exception + "\033[0m")  # prints in red


class Experiments:
    """
    Provides methods for running experiments and evaluations.

    Example:
        Basic usage:
            >>> from phoenix.client import Client
            >>> client = Client()
            >>> dataset = client.datasets.get_dataset(dataset="my-dataset")
            >>>
            >>> def my_task(input):
            ...     return f"Hello {input['name']}"
            >>>
            >>> experiment = client.experiments.run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )

        With evaluators:
            >>> def accuracy_evaluator(output, expected):
            ...     return 1.0 if output == expected['text'] else 0.0
            >>>
            >>> experiment = client.experiments.run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     evaluators=[accuracy_evaluator],
            ...     experiment_name="evaluated-experiment"
            ... )
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def get_dataset_experiments_url(self, dataset_id: str) -> str:
        return f"{self._client.base_url}/v1/datasets/{dataset_id}/experiments"

    def get_experiment_url(self, dataset_id: str, experiment_id: str) -> str:
        return f"{self._client.base_url}/v1/datasets/{dataset_id}/experiments/{experiment_id}"

    def run_experiment(
        self,
        *,
        dataset: Dataset,
        task: ExperimentTask,
        evaluators: Optional[Evaluators] = None,
        experiment_name: Optional[str] = None,
        experiment_description: Optional[str] = None,
        experiment_metadata: Optional[Mapping[str, Any]] = None,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        dry_run: Union[bool, int] = False,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> dict[str, Any]:
        """
        Runs an experiment using a given dataset of examples.

        Args:
            dataset: The dataset on which to run the experiment.
            task: The task to run on each example in the dataset.
            evaluators: A single evaluator or sequence of evaluators used to
                evaluate the results of the experiment. Defaults to None.
            experiment_name: The name of the experiment. Defaults to None.
            experiment_description: A description of the experiment. Defaults to None.
            experiment_metadata: Metadata to associate with the experiment. Defaults to None.
            rate_limit_errors: An exception or sequence of exceptions to adaptively throttle on.
                Defaults to None.
            dry_run: Run the experiment in dry-run mode. When set, experiment results will
                not be recorded in Phoenix. If True, the experiment will run on a random dataset
                example. If an integer, the experiment will run on a random sample of the dataset
                examples of the given size. Defaults to False.
            print_summary: Whether to print a summary of the experiment and evaluation results.
                Defaults to True.

        Returns:
            A dictionary containing the experiment results.

        Raises:
            ValueError: If dataset format is invalid or has no examples.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        task_signature = inspect.signature(task)
        _validate_task_signature(task_signature)

        if not dataset.examples:
            raise ValueError(f"Dataset has no examples: {dataset.id=}, {dataset.version_id=}")

        repetitions = 1
        evaluators_by_name = _evaluators_by_name(evaluators)

        payload = {
            "version_id": dataset.version_id,
            "name": experiment_name,
            "description": experiment_description,
            "metadata": experiment_metadata,
            "repetitions": repetitions,
        }

        if not dry_run:
            experiment_response = self._client.post(
                f"/v1/datasets/{dataset.id}/experiments",
                json=payload,
                timeout=timeout,
            )
            experiment_response.raise_for_status()
            exp_json = experiment_response.json()["data"]
            project_name = exp_json["project_name"]
            experiment: Experiment = {
                "id": exp_json["id"],
                "dataset_id": dataset.id,
                "dataset_version_id": dataset.version_id,
                "repetitions": repetitions,
                "metadata": exp_json.get("metadata", {}),
                "project_name": project_name,
                "created_at": exp_json["created_at"],
                "updated_at": exp_json["updated_at"],
            }
        else:
            experiment: Experiment = {
                "id": DRY_RUN,
                "dataset_id": dataset.id,
                "dataset_version_id": dataset.version_id,
                "repetitions": repetitions,
                "metadata": {},
                "project_name": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

        tracer, resource = _get_tracer(experiment["project_name"])
        root_span_name = f"Task: {get_func_name(task)}"

        print("🧪 Experiment started.")

        if dry_run:
            examples_list = list(dataset.examples)
            sample_size = min(
                len(examples_list), int(dry_run) if isinstance(dry_run, int) and dry_run > 1 else 1
            )
            sampled_examples = random.sample(examples_list, sample_size)
            example_ids = [ex["id"] for ex in sampled_examples]
            print(f"🌵️ This is a dry-run for these example IDs:\n{chr(10).join(example_ids)}")
        else:
            dataset_experiments_url = self.get_dataset_experiments_url(dataset_id=dataset.id)
            experiment_compare_url = self.get_experiment_url(
                dataset_id=dataset.id,
                experiment_id=experiment["id"],
            )
            print(f"📺 View dataset experiments: {dataset_experiments_url}")
            print(f"🔗 View this experiment: {experiment_compare_url}")

        if dry_run:
            examples_to_process = [ex for ex in dataset.examples if ex["id"] in example_ids]
        else:
            examples_to_process = list(dataset.examples)

        test_cases = [
            TestCase(example=ex, repetition_number=rep)
            for ex, rep in product(examples_to_process, range(1, repetitions + 1))
        ]

        task_result_cache: dict[tuple[str, int], Any] = {}

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        def sync_run_task(test_case: TestCase) -> Optional[ExperimentRun]:
            return self._run_single_task_sync(
                test_case,
                task,
                task_signature,
                experiment,
                tracer,
                resource,
                root_span_name,
                dry_run,
                timeout,
                task_result_cache,
            )

        rate_limited_sync_run_task = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), rate_limiters, sync_run_task
        )

        executor = SyncExecutor(
            generation_fn=rate_limited_sync_run_task,
            tqdm_bar_format=get_tqdm_progress_bar_formatter("running tasks"),
            max_retries=0,
            exit_on_error=False,
            fallback_return_value=None,
        )

        task_runs, _execution_details = executor.run(test_cases)
        print("✅ Task runs completed.")

        # Get the final state of runs from the database if not dry run
        if not dry_run:
            all_runs = self._client.get(f"/v1/experiments/{experiment['id']}/runs").json()["data"]
            task_runs = []
            for run in all_runs:
                run["start_time"] = datetime.fromisoformat(run["start_time"])
                run["end_time"] = datetime.fromisoformat(run["end_time"])
                task_runs.append(run)  # Already in TypedDict format

            # Check if we got all expected runs
            expected_runs = len(examples_to_process) * repetitions
            actual_runs = len(task_runs)
            if actual_runs < expected_runs:
                print(
                    f"⚠️  Warning: Only {actual_runs} out of {expected_runs} expected runs were "
                    "completed successfully."
                )

        # Create result dictionary
        result = {
            "experiment_id": experiment["id"],
            "dataset_id": dataset.id,
            "task_runs": [r for r in task_runs if r is not None],
            "evaluation_runs": [],
        }

        # Run evaluations if provided
        if evaluators_by_name:
            eval_runs = self._run_evaluations(
                [r for r in task_runs if r is not None],
                evaluators_by_name,
                tracer,
                resource,
                bool(dry_run),
                timeout,
                rate_limit_errors,
            )
            result["evaluation_runs"] = eval_runs

        if print_summary:
            print(
                f"Experiment completed with {len(result['task_runs'])} task runs and "
                f"{len(result['evaluation_runs'])} evaluation runs"
            )

        return result

    def _run_single_task_sync(
        self,
        test_case: TestCase,
        task: ExperimentTask,
        task_signature: inspect.Signature,
        experiment: Experiment,
        tracer: Tracer,
        resource: Resource,
        root_span_name: str,
        dry_run: Union[bool, int],
        timeout: Optional[int],
        task_result_cache: dict[tuple[str, int], Any],
    ) -> Optional[ExperimentRun]:
        example, repetition_number = test_case.example, test_case.repetition_number
        cache_key = (example["id"], repetition_number)

        # Check if we have a cached result
        if cache_key in task_result_cache:
            output = task_result_cache[cache_key]
            exp_run: ExperimentRun = {
                "dataset_example_id": example["id"],
                "output": output,
                "repetition_number": repetition_number,
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": datetime.now(timezone.utc).isoformat(),
                "id": f"temp-{random.randint(1000, 9999)}",
                "experiment_id": experiment["id"],
            }
            if not dry_run:
                try:
                    resp = self._client.post(
                        f"/v1/experiments/{experiment['id']}/runs",
                        json=exp_run,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
                    exp_run = {**exp_run, "id": resp.json()["data"]["id"]}
                except HTTPStatusError as e:
                    if e.response.status_code == 409:
                        return None
                    raise
            return exp_run

        output = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)

        with ExitStack() as stack:
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            try:
                bound_task_args = _bind_task_signature(task_signature, example)
                _output = task(*bound_task_args.args, **bound_task_args.kwargs)

                if isinstance(_output, Awaitable):
                    raise RuntimeError(
                        "Task is async and cannot be run within sync implementation. "
                        "Use the AsyncClient instead."
                    )
                else:
                    output = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example["id"],
                    repetition_number=repetition_number,
                    kind="task",
                )

            output = jsonify(output)
            span.set_attribute(
                SpanAttributes.INPUT_VALUE, json.dumps(example["input"], ensure_ascii=False)
            )
            span.set_attribute(
                SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
            )
            if output is not None:
                if isinstance(output, str):
                    span.set_attribute(SpanAttributes.OUTPUT_VALUE, output)
                else:
                    span.set_attribute(
                        SpanAttributes.OUTPUT_VALUE, json.dumps(output, ensure_ascii=False)
                    )
                    span.set_attribute(
                        SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
                    )
            span.set_attribute(
                SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.CHAIN.value
            )
            span.set_status(status)

        exp_run: ExperimentRun = {
            "dataset_example_id": example["id"],
            "output": output,
            "repetition_number": repetition_number,
            "start_time": _decode_unix_nano(cast(int, span.start_time)).isoformat(),
            "end_time": _decode_unix_nano(cast(int, span.end_time)).isoformat(),
            "id": f"temp-{random.randint(1000, 9999)}",
            "experiment_id": experiment["id"],
        }

        # Add optional fields if they exist
        if _str_trace_id(span.get_span_context().trace_id):
            exp_run["trace_id"] = _str_trace_id(span.get_span_context().trace_id)
        if error:
            exp_run["error"] = repr(error)

        if not dry_run:
            try:
                resp = self._client.post(
                    f"/v1/experiments/{experiment['id']}/runs",
                    json=exp_run,
                    timeout=timeout,
                )
                resp.raise_for_status()
                exp_run = {**exp_run, "id": resp.json()["data"]["id"]}
                if error is None:
                    task_result_cache[cache_key] = output
            except HTTPStatusError as e:
                if e.response.status_code == 409:
                    return None
                raise

        return exp_run

    def _run_evaluations(
        self,
        task_runs: list[ExperimentRun],
        evaluators_by_name: Mapping[EvaluatorName, Evaluator],
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
        rate_limit_errors: Optional[RateLimitErrors],
    ) -> list[ExperimentEvaluationRun]:
        print("🧠 Evaluation started.")

        evaluation_input = [
            (run, evaluator) for run, evaluator in product(task_runs, evaluators_by_name.values())
        ]

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        def sync_evaluate_run(
            obj: tuple[ExperimentRun, Evaluator],
        ) -> Optional[ExperimentEvaluationRun]:
            run, evaluator = obj
            return self._run_single_evaluation_sync(
                run, evaluator, tracer, resource, dry_run, timeout
            )

        rate_limited_sync_evaluate_run = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), rate_limiters, sync_evaluate_run
        )

        # Use sync executor for sync operation
        executor = SyncExecutor(
            generation_fn=rate_limited_sync_evaluate_run,
            max_retries=0,
            exit_on_error=False,
            fallback_return_value=None,
            tqdm_bar_format=get_tqdm_progress_bar_formatter("running experiment evaluations"),
        )

        eval_runs, _execution_details = executor.run(evaluation_input)
        return [r for r in eval_runs if r is not None]

    def _run_single_evaluation_sync(
        self,
        experiment_run: ExperimentRun,
        evaluator: Evaluator,
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
    ) -> Optional[ExperimentEvaluationRun]:
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        root_span_name = f"Evaluation: {evaluator.name}"

        with ExitStack() as stack:
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            try:
                # For simplicity, just pass output to evaluator
                result = evaluator.evaluate(output=experiment_run["output"])
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc

            if result:
                span.set_attributes(
                    {"evaluation.score": result.get("score"), "evaluation.label": result.get("label")}
                )
            span.set_attribute(
                SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.EVALUATOR.value
            )
            span.set_status(status)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=experiment_run["id"],
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            name=evaluator.name,
            annotator_kind=evaluator.kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=_str_trace_id(span.get_span_context().trace_id),
        )

        if not dry_run:
            try:
                resp = self._client.post(
                    "/v1/experiment_evaluations",
                    json=jsonify(eval_run.__dict__),
                    timeout=timeout,
                )
                resp.raise_for_status()
                eval_run = replace(eval_run, id=resp.json()["data"]["id"])
            except HTTPStatusError:
                pass  # Continue even if evaluation storage fails

        return eval_run


class AsyncExperiments:
    """
    Provides async methods for running experiments and evaluations.

    Example:
        Basic usage:
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> dataset = await client.datasets.get_dataset(dataset="my-dataset")
            >>>
            >>> async def my_task(input):
            ...     return f"Hello {input['name']}"
            >>>
            >>> experiment = await client.experiments.run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    def get_dataset_experiments_url(self, dataset_id: str) -> str:
        return f"{self._client.base_url}/v1/datasets/{dataset_id}/experiments"

    def get_experiment_url(self, dataset_id: str, experiment_id: str) -> str:
        return f"{self._client.base_url}/v1/datasets/{dataset_id}/experiments/{experiment_id}"

    async def run_experiment(
        self,
        *,
        dataset: Dataset,
        task: ExperimentTask,
        evaluators: Optional[Evaluators] = None,
        experiment_name: Optional[str] = None,
        experiment_description: Optional[str] = None,
        experiment_metadata: Optional[Mapping[str, Any]] = None,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        dry_run: Union[bool, int] = False,
        print_summary: bool = True,
        concurrency: int = 3,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> dict[str, Any]:
        """
        Runs an experiment using a given dataset of examples (async version).

        Args:
            dataset: The dataset on which to run the experiment.
            task: The task to run on each example in the dataset.
            evaluators: A single evaluator or sequence of evaluators used to
                evaluate the results of the experiment. Defaults to None.
            experiment_name: The name of the experiment. Defaults to None.
            experiment_description: A description of the experiment. Defaults to None.
            experiment_metadata: Metadata to associate with the experiment. Defaults to None.
            rate_limit_errors: An exception or sequence of exceptions to adaptively throttle on.
                Defaults to None.
            dry_run: Run the experiment in dry-run mode. Defaults to False.
            print_summary: Whether to print a summary of the experiment and evaluation results.
                Defaults to True.
            concurrency: Specifies the concurrency for task execution. Defaults to 3.
            timeout: The timeout for the task execution in seconds. Defaults to 60.

        Returns:
            A dictionary containing the experiment results.

        Raises:
            ValueError: If dataset format is invalid or has no examples.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        task_signature = inspect.signature(task)
        _validate_task_signature(task_signature)

        if not dataset.examples:
            raise ValueError(f"Dataset has no examples: {dataset.id=}, {dataset.version_id=}")

        repetitions = 1
        evaluators_by_name = _evaluators_by_name(evaluators)

        payload = {
            "version_id": dataset.version_id,
            "name": experiment_name,
            "description": experiment_description,
            "metadata": experiment_metadata,
            "repetitions": repetitions,
        }

        if not dry_run:
            experiment_response = await self._client.post(
                f"/v1/datasets/{dataset.id}/experiments",
                json=payload,
                timeout=timeout,
            )
            experiment_response.raise_for_status()
            exp_json = experiment_response.json()["data"]
            project_name = exp_json["project_name"]
            experiment: Experiment = {
                "id": exp_json["id"],
                "dataset_id": dataset.id,
                "dataset_version_id": dataset.version_id,
                "repetitions": repetitions,
                "metadata": exp_json.get("metadata", {}),
                "project_name": project_name,
                "created_at": exp_json["created_at"],
                "updated_at": exp_json["updated_at"],
            }
        else:
            experiment: Experiment = {
                "id": DRY_RUN,
                "dataset_id": dataset.id,
                "dataset_version_id": dataset.version_id,
                "repetitions": repetitions,
                "metadata": {},
                "project_name": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

        tracer, resource = _get_tracer(experiment["project_name"])
        root_span_name = f"Task: {get_func_name(task)}"

        print("🧪 Experiment started.")

        if dry_run:
            examples_list = list(dataset.examples)
            sample_size = min(
                len(examples_list), int(dry_run) if isinstance(dry_run, int) and dry_run > 1 else 1
            )
            sampled_examples = random.sample(examples_list, sample_size)
            example_ids = [ex["id"] for ex in sampled_examples]
            print(f"🌵️ This is a dry-run for these example IDs:\n{chr(10).join(example_ids)}")
        else:
            dataset_experiments_url = self.get_dataset_experiments_url(dataset_id=dataset.id)
            experiment_compare_url = self.get_experiment_url(
                dataset_id=dataset.id,
                experiment_id=experiment["id"],
            )
            print(f"📺 View dataset experiments: {dataset_experiments_url}")
            print(f"🔗 View this experiment: {experiment_compare_url}")

        if dry_run:
            examples_to_process = [ex for ex in dataset.examples if ex["id"] in example_ids]
        else:
            examples_to_process = list(dataset.examples)

        test_cases = [
            TestCase(example=ex, repetition_number=rep)
            for ex, rep in product(examples_to_process, range(1, repetitions + 1))
        ]

        task_result_cache: dict[tuple[str, int], Any] = {}

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        async def async_run_task(test_case: TestCase) -> Optional[ExperimentRun]:
            return await self._run_single_task_async(
                test_case,
                task,
                task_signature,
                experiment,
                tracer,
                resource,
                root_span_name,
                dry_run,
                timeout,
                task_result_cache,
            )

        rate_limited_async_run_task = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), rate_limiters, async_run_task
        )

        executor = AsyncExecutor(
            generation_fn=rate_limited_async_run_task,
            concurrency=concurrency,
            tqdm_bar_format=get_tqdm_progress_bar_formatter("running tasks"),
            max_retries=0,
            exit_on_error=False,
            fallback_return_value=None,
            timeout=timeout,
        )

        task_runs, _execution_details = await executor.execute(test_cases)
        print("✅ Task runs completed.")

        # Get the final state of runs from the database if not dry run
        if not dry_run:
            all_runs_response = await self._client.get(f"/v1/experiments/{experiment['id']}/runs")
            all_runs = all_runs_response.json()["data"]
            task_runs = []
            for run in all_runs:
                run["start_time"] = datetime.fromisoformat(run["start_time"])
                run["end_time"] = datetime.fromisoformat(run["end_time"])
                task_runs.append(run)  # Already in TypedDict format

            # Check if we got all expected runs
            expected_runs = len(examples_to_process) * repetitions
            actual_runs = len(task_runs)
            if actual_runs < expected_runs:
                print(
                    f"⚠️  Warning: Only {actual_runs} out of {expected_runs} expected runs were "
                    "completed successfully."
                )

        # Create result dictionary
        result = {
            "experiment_id": experiment["id"],
            "dataset_id": dataset.id,
            "task_runs": [r for r in task_runs if r is not None],
            "evaluation_runs": [],
        }

        # Run evaluations if provided
        if evaluators_by_name:
            eval_runs = await self._run_evaluations_async(
                [r for r in task_runs if r is not None],
                evaluators_by_name,
                tracer,
                resource,
                bool(dry_run),
                timeout,
                rate_limit_errors,
                concurrency,
            )
            result["evaluation_runs"] = eval_runs

        if print_summary:
            print(
                f"Experiment completed with {len(result['task_runs'])} task runs and "
                f"{len(result['evaluation_runs'])} evaluation runs"
            )

        return result

    async def _run_single_task_async(
        self,
        test_case: TestCase,
        task: ExperimentTask,
        task_signature: inspect.Signature,
        experiment: Experiment,
        tracer: Tracer,
        resource: Resource,
        root_span_name: str,
        dry_run: Union[bool, int],
        timeout: Optional[int],
        task_result_cache: dict[tuple[str, int], Any],
    ) -> Optional[ExperimentRun]:
        example, repetition_number = test_case.example, test_case.repetition_number
        cache_key = (example["id"], repetition_number)

        # Check if we have a cached result
        if cache_key in task_result_cache:
            output = task_result_cache[cache_key]
            exp_run: ExperimentRun = {
                "dataset_example_id": example["id"],
                "output": output,
                "repetition_number": repetition_number,
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": datetime.now(timezone.utc).isoformat(),
                "id": f"temp-{random.randint(1000, 9999)}",
                "experiment_id": experiment["id"],
            }
            if not dry_run:
                try:
                    resp = await self._client.post(
                        f"/v1/experiments/{experiment['id']}/runs",
                        json=exp_run,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
                    exp_run = {**exp_run, "id": resp.json()["data"]["id"]}
                except HTTPStatusError as e:
                    if e.response.status_code == 409:
                        return None
                    raise
            return exp_run

        output = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)

        with ExitStack() as stack:
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            try:
                bound_task_args = _bind_task_signature(task_signature, example)
                _output = task(*bound_task_args.args, **bound_task_args.kwargs)

                if isinstance(_output, Awaitable):
                    output = await _output
                else:
                    output = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example["id"],
                    repetition_number=repetition_number,
                    kind="task",
                )

            output = jsonify(output)
            span.set_attribute(
                SpanAttributes.INPUT_VALUE, json.dumps(example["input"], ensure_ascii=False)
            )
            span.set_attribute(
                SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
            )
            if output is not None:
                if isinstance(output, str):
                    span.set_attribute(SpanAttributes.OUTPUT_VALUE, output)
                else:
                    span.set_attribute(
                        SpanAttributes.OUTPUT_VALUE, json.dumps(output, ensure_ascii=False)
                    )
                    span.set_attribute(
                        SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
                    )
            span.set_attribute(
                SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.CHAIN.value
            )
            span.set_status(status)

        exp_run: ExperimentRun = {
            "dataset_example_id": example["id"],
            "output": output,
            "repetition_number": repetition_number,
            "start_time": _decode_unix_nano(cast(int, span.start_time)).isoformat(),
            "end_time": _decode_unix_nano(cast(int, span.end_time)).isoformat(),
            "id": f"temp-{random.randint(1000, 9999)}",
            "experiment_id": experiment["id"],
        }

        # Add optional fields if they exist
        if _str_trace_id(span.get_span_context().trace_id):
            exp_run["trace_id"] = _str_trace_id(span.get_span_context().trace_id)
        if error:
            exp_run["error"] = repr(error)

        if not dry_run:
            try:
                resp = await self._client.post(
                    f"/v1/experiments/{experiment['id']}/runs",
                    json=exp_run,
                    timeout=timeout,
                )
                resp.raise_for_status()
                exp_run = {**exp_run, "id": resp.json()["data"]["id"]}
                if error is None:
                    task_result_cache[cache_key] = output
            except HTTPStatusError as e:
                if e.response.status_code == 409:
                    return None
                raise

        return exp_run

    async def _run_evaluations_async(
        self,
        task_runs: list[ExperimentRun],
        evaluators_by_name: Mapping[EvaluatorName, Evaluator],
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
        rate_limit_errors: Optional[RateLimitErrors],
        concurrency: int,
    ) -> list[ExperimentEvaluationRun]:
        print("🧠 Evaluation started.")

        evaluation_input = [
            (run, evaluator) for run, evaluator in product(task_runs, evaluators_by_name.values())
        ]

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        async def async_evaluate_run(
            obj: tuple[ExperimentRun, Evaluator],
        ) -> Optional[ExperimentEvaluationRun]:
            run, evaluator = obj
            return await self._run_single_evaluation_async(
                run, evaluator, tracer, resource, dry_run, timeout
            )

        rate_limited_async_evaluate_run = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), rate_limiters, async_evaluate_run
        )

        executor = AsyncExecutor(
            generation_fn=rate_limited_async_evaluate_run,
            concurrency=concurrency,
            tqdm_bar_format=get_tqdm_progress_bar_formatter("running experiment evaluations"),
            max_retries=0,
            exit_on_error=False,
            fallback_return_value=None,
            timeout=timeout,
        )

        eval_runs, _execution_details = await executor.execute(evaluation_input)
        return [r for r in eval_runs if r is not None]

    async def _run_single_evaluation_async(
        self,
        experiment_run: ExperimentRun,
        evaluator: Evaluator,
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
    ) -> Optional[ExperimentEvaluationRun]:
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        root_span_name = f"Evaluation: {evaluator.name}"

        with ExitStack() as stack:
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            try:
                # For simplicity, just pass output to evaluator
                result = await evaluator.async_evaluate(output=experiment_run["output"])
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc

            if result:
                span.set_attributes(
                    {"evaluation.score": result.get("score"), "evaluation.label": result.get("label")}
                )
            span.set_attribute(
                SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.EVALUATOR.value
            )
            span.set_status(status)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=experiment_run["id"],
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            name=evaluator.name,
            annotator_kind=evaluator.kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=_str_trace_id(span.get_span_context().trace_id),
        )

        if not dry_run:
            try:
                resp = await self._client.post(
                    "/v1/experiment_evaluations",
                    json=jsonify(eval_run.__dict__),
                    timeout=timeout,
                )
                resp.raise_for_status()
                eval_run = replace(eval_run, id=resp.json()["data"]["id"])
            except HTTPStatusError:
                pass  # Continue even if evaluation storage fails

        return eval_run
