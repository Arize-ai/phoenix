import functools
import inspect
import json
import logging
import random
import traceback
from binascii import hexlify
from collections.abc import Awaitable, Callable, Iterator, Mapping, Sequence
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from dataclasses import replace
from datetime import datetime, timezone
from itertools import product
from threading import Lock
from typing import Any, Literal, Optional, Union, cast
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
from opentelemetry.sdk.resources import Resource  # type: ignore[attr-defined, unused-ignore]
from opentelemetry.sdk.trace import ReadableSpan, Span
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import INVALID_SPAN_ID, Status, StatusCode, Tracer

from phoenix.client.__generated__ import v1
from phoenix.client.resources.datasets import Dataset
from phoenix.client.resources.experiments.evaluators import create_evaluator
from phoenix.client.utils.executors import AsyncExecutor, SyncExecutor
from phoenix.client.utils.rate_limiters import RateLimiter

from .types import (
    DRY_RUN,
    EvaluationResult,
    Evaluator,
    EvaluatorName,
    Evaluators,
    Experiment,
    ExperimentEvaluationRun,
    ExperimentEvaluators,
    ExperimentRun,
    ExperimentTask,
    RanExperiment,
    RateLimitErrors,
    TestCase,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 60


class SpanModifier:
    """
    A class that modifies spans with the specified resource attributes.
    """

    __slots__ = ("_resource",)

    def __init__(self, resource: Resource) -> None:
        self._resource = resource

    def modify_resource(self, span: ReadableSpan) -> None:
        """
        Takes a span and merges in the resource attributes specified in the constructor.

        Args:
          span: ReadableSpan: the span to modify
        """
        if (ctx := span._context) is None or ctx.span_id == INVALID_SPAN_ID:  # pyright: ignore[reportPrivateUsage]
            return
        span._resource = span._resource.merge(self._resource)  # pyright: ignore[reportPrivateUsage]


_ACTIVE_MODIFIER: ContextVar[Optional[SpanModifier]] = ContextVar("active_modifier")

_SPAN_INIT_MONKEY_PATCH_LOCK = Lock()
_span_init_monkey_patch_count = 0
_original_span_init: Optional[Callable[..., None]] = None


def _patched_span_init(self: ReadableSpan, *args: Any, **kwargs: Any) -> None:
    """Patched version of ReadableSpan.__init__ that applies resource modifications."""
    # Call the original __init__ method
    if _original_span_init is not None:
        _original_span_init(self, *args, **kwargs)

    # Apply span modifications if an active modifier exists
    if isinstance(span_modifier := _ACTIVE_MODIFIER.get(None), SpanModifier):
        span_modifier.modify_resource(self)


@contextmanager
def _monkey_patch_span_init() -> Iterator[None]:
    """Context manager that monkey patches ReadableSpan.__init__ with reference counting."""
    global _span_init_monkey_patch_count, _original_span_init

    with _SPAN_INIT_MONKEY_PATCH_LOCK:
        _span_init_monkey_patch_count += 1
        if _span_init_monkey_patch_count == 1:
            # First caller - apply the patch
            _original_span_init = ReadableSpan.__init__
            setattr(ReadableSpan, "__init__", _patched_span_init)

    try:
        yield
    finally:
        with _SPAN_INIT_MONKEY_PATCH_LOCK:
            _span_init_monkey_patch_count -= 1
            if _span_init_monkey_patch_count == 0:
                # Last caller - restore the original
                if _original_span_init is not None:
                    setattr(ReadableSpan, "__init__", _original_span_init)
                    _original_span_init = None


@contextmanager
def capture_spans(resource: Resource) -> Iterator[SpanModifier]:
    """
    A context manager that captures spans and modifies them with the specified resources.

    Args:
      resource: Resource: The resource to merge into the spans created within the context.

    Returns:
        modifier: Iterator[SpanModifier]: The span modifier that is active within the context.
    """
    modifier = SpanModifier(resource)
    with _monkey_patch_span_init():
        token = _ACTIVE_MODIFIER.set(modifier)
        yield modifier
        _ACTIVE_MODIFIER.reset(token)


class _NoOpProcessor(trace_sdk.SpanProcessor):
    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True


INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND

CHAIN = OpenInferenceSpanKindValues.CHAIN.value
EVALUATOR = OpenInferenceSpanKindValues.EVALUATOR.value
JSON = OpenInferenceMimeTypeValues.JSON


def _get_tracer(
    project_name: Optional[str] = None,
    base_url: Optional[str] = None,
    headers: Optional[dict[str, str]] = None,
) -> tuple[Tracer, Resource]:
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name} if project_name else {})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)

    if project_name and base_url:
        endpoint = urljoin(base_url, "v1/traces")
        span_processor: trace_sdk.SpanProcessor = SimpleSpanProcessor(
            OTLPSpanExporter(
                endpoint=endpoint,
                headers=headers or {},
            )
        )
    else:
        span_processor = _NoOpProcessor()

    tracer_provider.add_span_processor(span_processor)
    return tracer_provider.get_tracer(__name__), resource


def get_tqdm_progress_bar_formatter(title: str) -> str:
    return (
        title + " |{bar}| {n_fmt}/{total_fmt} ({percentage:3.1f}%) "
        "| ⏳ {elapsed}<{remaining} | {rate_fmt}{postfix}"
    )


def get_func_name(func: Callable[..., Any]) -> str:
    """Get the name of a function."""
    return getattr(func, "__name__", str(func))


def jsonify(obj: Any) -> Any:
    """Convert object to JSON-serializable format."""
    if obj is None:
        return None
    elif isinstance(obj, (str, int, float, bool)):
        return obj
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, (list, tuple)):
        return [jsonify(item) for item in obj]  # pyright: ignore[reportUnknownVariableType]
    elif isinstance(obj, dict):
        return {str(k): jsonify(v) for k, v in obj.items()}  # pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]
    elif hasattr(obj, "__dict__"):
        return jsonify(obj.__dict__)
    else:
        return str(obj)


def _str_trace_id(trace_id: Union[int, str]) -> str:
    if isinstance(trace_id, int):
        return hexlify(trace_id.to_bytes(16, "big")).decode()
    return str(trace_id)


def _evaluators_by_name(obj: Optional[ExperimentEvaluators]) -> Mapping[EvaluatorName, Evaluator]:
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

    An experiment is a user-defined task that runs on each example in a dataset. The results from
    each experiment can be evaluated using any number of evaluators to measure the behavior of the
    task. The experiment and evaluation results are stored in the Phoenix database for comparison
    and analysis.

    A `task` is either a synchronous or asynchronous function that returns a JSON serializable
    output. If the `task` is a function of one argument then that argument will be bound to the
    `input` field of the dataset example. Alternatively, the `task` can be a function of any
    combination of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - phoenix.experiments.types.EvaluationResult with optional fields for score, label,
      explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)
    - a dictionary with any of: "label", "score" and "explanation" keys

    If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of the task. Alternatively, the `evaluator` can be a function of any
    combination of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

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

        Using dynamic binding for tasks:
            >>> def my_task(input, metadata, expected):
            ...     # Task can access multiple fields from the dataset example
            ...     context = metadata.get("context", "")
            ...     return f"Context: {context}, Input: {input}, Expected: {expected}"

        Using dynamic binding for evaluators:
            >>> def my_evaluator(output, input, expected, metadata):
            ...     # Evaluator can access task output and example fields
            ...     score = calculate_similarity(output, expected)
            ...     return {"score": score, "label": "pass" if score > 0.8 else "fail"}
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client
        self._base_url = str(client.base_url)
        self._headers = dict(client.headers)

    def get_dataset_experiments_url(self, dataset_id: str) -> str:
        return f"{self._client.base_url}/datasets/{dataset_id}/experiments"

    def get_experiment_url(self, dataset_id: str, experiment_id: str) -> str:
        return f"{self._client.base_url}/datasets/{dataset_id}/compare?experimentId={experiment_id}"

    def run_experiment(
        self,
        *,
        dataset: Dataset,
        task: ExperimentTask,
        evaluators: Optional[ExperimentEvaluators] = None,
        experiment_name: Optional[str] = None,
        experiment_description: Optional[str] = None,
        experiment_metadata: Optional[Mapping[str, Any]] = None,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        dry_run: Union[bool, int] = False,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> RanExperiment:
        """
        Runs an experiment using a given dataset of examples.

        An experiment is a user-defined task that runs on each example in a dataset. The results
        from each experiment can be evaluated using any number of evaluators to measure the
        behavior of the task. The experiment and evaluation results are stored in the Phoenix
        database for comparison and analysis.

        A `task` is either a synchronous function that returns a JSON serializable
        output. If the `task` is a function of one argument then that argument will be bound to the
        `input` field of the dataset example. Alternatively, the `task` can be a function of any
        combination of specific argument names that will be bound to special values:

        - `input`: The input field of the dataset example
        - `expected`: The expected or reference output of the dataset example
        - `reference`: An alias for `expected`
        - `metadata`: Metadata associated with the dataset example
        - `example`: The dataset `Example` object with all associated fields

        An `evaluator` is either a synchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - phoenix.experiments.types.EvaluationResult with optional fields for score, label,
          explanation and metadata
        - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
        - a `float`, which will be interpreted as a score
        - a `str`, which will be interpreted as a label
        - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)
        - a dictionary with any of: "label", "score" and "explanation" keys

        If the `evaluator` is a function of one argument then that argument will be
        bound to the `output` of the task. Alternatively, the `evaluator` can be a function of any
        combination of specific argument names that will be bound to special values:

        - `input`: The input field of the dataset example
        - `output`: The output of the task
        - `expected`: The expected or reference output of the dataset example
        - `reference`: An alias for `expected`
        - `metadata`: Metadata associated with the dataset example

        Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

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
            timeout: The timeout for the task execution in seconds. Use this to run
                longer tasks to avoid re-queuing the same task multiple times. Defaults to 60.

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

        payload = {
            "version_id": dataset.version_id,
            "name": experiment_name,
            "description": experiment_description,
            "metadata": experiment_metadata,
            "repetitions": repetitions,
        }

        if not dry_run:
            experiment_response = self._client.post(
                f"v1/datasets/{dataset.id}/experiments",
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
            experiment = {
                "id": DRY_RUN,
                "dataset_id": dataset.id,
                "dataset_version_id": dataset.version_id,
                "repetitions": repetitions,
                "metadata": {},
                "project_name": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

        tracer, resource = _get_tracer(
            experiment["project_name"], str(self._client.base_url), dict(self._client.headers)
        )
        root_span_name = f"Task: {get_func_name(task)}"

        print("🧪 Experiment started.")

        example_ids: list[str] = []
        if dry_run:
            examples_list = list(dataset.examples)
            if isinstance(dry_run, bool):
                sample_size = 1
            else:
                sample_size = min(len(examples_list), dry_run if dry_run > 1 else 1)
            random.seed(42)  # Set seed for reproducible sampling
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
            all_runs = self._client.get(f"v1/experiments/{experiment['id']}/runs").json()["data"]
            task_runs_from_db: list[ExperimentRun] = []
            for run in all_runs:
                run["start_time"] = datetime.fromisoformat(run["start_time"])
                run["end_time"] = datetime.fromisoformat(run["end_time"])
                task_runs_from_db.append(run)  # Already in TypedDict format
            task_runs = task_runs_from_db

            # Check if we got all expected runs
            expected_runs = len(examples_to_process) * repetitions
            actual_runs = len(task_runs)
            if actual_runs < expected_runs:
                print(
                    f"⚠️  Warning: Only {actual_runs} out of {expected_runs} expected runs were "
                    "completed successfully."
                )

        # Create RanExperiment object
        task_runs_list = [r for r in task_runs if r is not None]
        evaluation_runs_list: list[ExperimentEvaluationRun] = []

        ran_experiment: RanExperiment = {
            "experiment_id": experiment["id"],
            "dataset_id": dataset.id,
            "task_runs": task_runs_list,
            "evaluation_runs": [],
            "experiment_metadata": experiment.get("metadata", {}),
        }

        if evaluators is not None:
            eval_result = self.evaluate_experiment(
                experiment=ran_experiment,
                evaluators=evaluators,
                dry_run=bool(dry_run),
                print_summary=False,  # We'll handle summary printing in run_experiment
                timeout=timeout,
                rate_limit_errors=rate_limit_errors,
            )
            evaluation_runs_list = eval_result["evaluation_runs"]

        ran_experiment["evaluation_runs"] += evaluation_runs_list

        if print_summary:
            print(
                f"Experiment completed with {len(ran_experiment['task_runs'])} task runs and "
                f"{len(ran_experiment['evaluation_runs'])} evaluation runs"
            )

        return ran_experiment

    def evaluate_experiment(
        self,
        *,
        experiment: RanExperiment,
        evaluators: ExperimentEvaluators,
        dry_run: bool = False,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        rate_limit_errors: Optional[RateLimitErrors] = None,
    ) -> RanExperiment:
        """
        Run evaluators on a completed experiment.

        An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - phoenix.experiments.types.EvaluationResult with optional fields for score, label,
          explanation and metadata
        - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
        - a `float`, which will be interpreted as a score
        - a `str`, which will be interpreted as a label
        - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)
        - a dictionary with any of: "label", "score" and "explanation" keys

        Args:
            experiment: The experiment to evaluate, returned from `run_experiment`.
            evaluators: A single evaluator or sequence of evaluators used to
                evaluate the results of the experiment.
            dry_run: Run the evaluation in dry-run mode. When set, evaluation results will
                not be recorded in Phoenix. Defaults to False.
            print_summary: Whether to print a summary of the evaluation results.
                Defaults to True.
            timeout: The timeout for the evaluation execution in seconds. Defaults to 60.

        Returns:
            A dictionary containing the evaluation results with the same format as run_experiment.

        Raises:
            ValueError: If no evaluators are provided or experiment has no runs.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        evaluators_by_name = _evaluators_by_name(evaluators)
        if not evaluators_by_name:
            raise ValueError("Must specify at least one evaluator")

        experiment_id = experiment["experiment_id"]
        task_runs = experiment["task_runs"]
        dataset_id = experiment["dataset_id"]
        experiment_metadata = experiment["experiment_metadata"]
        try:
            experiment_response = self._client.get(
                f"v1/experiments/{experiment_id}", timeout=timeout
            )
            experiment_response.raise_for_status()
            experiment_data = experiment_response.json()["data"]
            dataset_version_id = experiment_data["dataset_version_id"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

        # Fetch dataset for evaluation context
        try:
            dataset_response = self._client.get(
                f"v1/datasets/{dataset_id}/examples",
                params={"version_id": str(dataset_version_id)},
                timeout=timeout,
            )
            dataset_response.raise_for_status()
            dataset_data = dataset_response.json()["data"]
        except HTTPStatusError:
            raise ValueError(f"Failed to fetch dataset for experiment: {experiment_id}")

        from phoenix.client.resources.datasets import Dataset

        dataset = Dataset(
            dataset_info={
                "id": dataset_id,
                "name": experiment_data.get("dataset_name", ""),
                "description": experiment_data.get("dataset_description"),
                "metadata": experiment_data.get("dataset_metadata", {}),
                "created_at": experiment_data.get("dataset_created_at"),
                "updated_at": experiment_data.get("dataset_updated_at"),
            },
            examples_data=dataset_data,
        )

        # Create evaluation tracer
        project_name = experiment_data.get("project_name", "")
        eval_tracer, eval_resource = _get_tracer(
            None if dry_run else "evaluators",
            str(self._client.base_url),
            dict(self._client.headers),
        )

        print("🧠 Evaluation started.")

        eval_runs = self._run_evaluations(
            task_runs,
            evaluators_by_name,
            eval_tracer,
            eval_resource,
            dry_run,
            timeout,
            rate_limit_errors,
            project_name,
            dataset,
        )

        # Combine existing evaluation runs with new ones
        all_evaluation_runs = eval_runs
        all_evaluation_runs = experiment["evaluation_runs"] + eval_runs

        ran_experiment: RanExperiment = {
            "experiment_id": experiment_id,
            "dataset_id": dataset_id,
            "task_runs": task_runs,
            "evaluation_runs": all_evaluation_runs,
            "experiment_metadata": experiment_metadata,
        }

        if print_summary:
            print(
                f"Evaluation completed with {len(ran_experiment['evaluation_runs'])} "
                "evaluation runs"
            )

        return ran_experiment

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
            cached_exp_run: ExperimentRun = {
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
                        f"v1/experiments/{experiment['id']}/runs",
                        json=cached_exp_run,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
                    cached_exp_run = {**cached_exp_run, "id": resp.json()["data"]["id"]}
                except HTTPStatusError as e:
                    if e.response.status_code == 409:
                        return None
                    raise
            return cached_exp_run

        output = None
        error: Optional[BaseException] = None
        start_time = datetime.now(timezone.utc)
        end_time = start_time
        trace_id = None

        status = Status(StatusCode.OK)

        with ExitStack() as stack:
            stack.enter_context(capture_spans(resource))
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
            span.set_attribute(INPUT_VALUE, json.dumps(example["input"], ensure_ascii=False))
            span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            if output is not None:
                if isinstance(output, str):
                    span.set_attribute(OUTPUT_VALUE, output)
                else:
                    span.set_attribute(OUTPUT_VALUE, json.dumps(output, ensure_ascii=False))
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
            span.set_attribute(OPENINFERENCE_SPAN_KIND, CHAIN)
            span.set_status(status)

            # Handle potential None values in span timing
            if span.start_time is not None:
                start_time = _decode_unix_nano(span.start_time)
            if span.end_time is not None:
                end_time = _decode_unix_nano(span.end_time)
            span_context = span.get_span_context()  # type: ignore[no-untyped-call]
            if span_context is not None and span_context.trace_id != 0:
                trace_id = _str_trace_id(span_context.trace_id)

        exp_run: ExperimentRun = {
            "dataset_example_id": example["id"],
            "output": output,
            "repetition_number": repetition_number,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "id": f"temp-{random.randint(1000, 9999)}",
            "experiment_id": experiment["id"],
        }

        # Add optional fields if they exist
        if trace_id:
            exp_run["trace_id"] = trace_id
        if error:
            exp_run["error"] = repr(error)

        if not dry_run:
            try:
                resp = self._client.post(
                    f"v1/experiments/{experiment['id']}/runs",
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
        project_name: str,
        dataset: Dataset,
    ) -> list[ExperimentEvaluationRun]:
        # Create evaluation input with example data
        evaluation_input: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]] = []
        for run in task_runs:
            # Find the corresponding example for this run
            example = None
            for ex in dataset.examples:
                if ex["id"] == run["dataset_example_id"]:
                    example = ex
                    break

            if example is not None:
                for evaluator in evaluators_by_name.values():
                    evaluation_input.append((example, run, evaluator))

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        def sync_evaluate_run(
            obj: tuple[v1.DatasetExample, ExperimentRun, Evaluator],
        ) -> Optional[ExperimentEvaluationRun]:
            example, run, evaluator = obj
            return self._run_single_evaluation_sync(
                example, run, evaluator, tracer, resource, dry_run, timeout, project_name
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
        example: v1.DatasetExample,
        experiment_run: ExperimentRun,
        evaluator: Evaluator,
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
        project_name: str,
    ) -> Optional[ExperimentEvaluationRun]:
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        root_span_name = f"Evaluation: {evaluator.name}"
        start_time = datetime.now(timezone.utc)
        end_time = start_time
        trace_id = None
        status = Status(StatusCode.OK)

        with ExitStack() as stack:
            stack.enter_context(capture_spans(resource))
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            try:
                result = evaluator.evaluate(
                    output=experiment_run["output"],
                    expected=example["output"],
                    reference=example["output"],
                    input=example["input"],
                    metadata=example["metadata"],
                )
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example["id"],
                    repetition_number=experiment_run.get("repetition_number", 1),
                    kind="evaluator",
                )

            if result:
                # Filter out None values for OpenTelemetry attributes
                attributes: dict[str, Any] = {}
                if (score := result.get("score")) is not None:
                    attributes["evaluation.score"] = score
                if (label := result.get("label")) is not None:
                    attributes["evaluation.label"] = label
                if attributes:
                    span.set_attributes(attributes)
            span.set_attribute(OPENINFERENCE_SPAN_KIND, EVALUATOR)
            span.set_status(status)

            # Handle potential None values in span timing
            if span.start_time is not None:
                start_time = _decode_unix_nano(span.start_time)
            if span.end_time is not None:
                end_time = _decode_unix_nano(span.end_time)
            span_context = span.get_span_context()  # type: ignore[no-untyped-call]
            if span_context is not None and span_context.trace_id != 0:
                trace_id = _str_trace_id(span_context.trace_id)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=experiment_run["id"],
            start_time=start_time,
            end_time=end_time,
            name=evaluator.name,
            annotator_kind=evaluator.kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=trace_id,
        )

        if not dry_run:
            try:
                resp = self._client.post(
                    "v1/experiment_evaluations",
                    json=jsonify(eval_run.__dict__),
                    timeout=timeout,
                )
                resp.raise_for_status()
                eval_run = replace(eval_run, id=resp.json()["data"]["id"])
            except HTTPStatusError as e:
                logger.warning(
                    f"Failed to submit evaluation result for evaluator '{evaluator.name}': "
                    f"HTTP {e.response.status_code} - {e.response.text}"
                )
                # Continue even if evaluation storage fails

        return eval_run


class AsyncExperiments:
    """
    Provides async methods for running experiments and evaluations.

    An experiment is a user-defined task that runs on each example in a dataset. The results from
    each experiment can be evaluated using any number of evaluators to measure the behavior of the
    task. The experiment and evaluation results are stored in the Phoenix database for comparison
    and analysis.

    A `task` is either a synchronous or asynchronous function that returns a JSON serializable
    output. If the `task` is a function of one argument then that argument will be bound to the
    `input` field of the dataset example. Alternatively, the `task` can be a function of any
    combination of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - phoenix.experiments.types.EvaluationResult with optional fields for score, label,
      explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

    If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of the task. Alternatively, the `evaluator` can be a function of any
    combination of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

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

        With evaluators:
            >>> async def accuracy_evaluator(output, expected):
            ...     return 1.0 if output == expected['text'] else 0.0
            >>>
            >>> experiment = await client.experiments.run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     evaluators=[accuracy_evaluator],
            ...     experiment_name="evaluated-experiment"
            ... )

        Using dynamic binding for tasks:
            >>> async def my_task(input, metadata, expected):
            ...     # Task can access multiple fields from the dataset example
            ...     context = metadata.get("context", "")
            ...     return f"Context: {context}, Input: {input}, Expected: {expected}"

        Using dynamic binding for evaluators:
            >>> async def my_evaluator(output, input, expected, metadata):
            ...     # Evaluator can access task output and example fields
            ...     score = await calculate_similarity(output, expected)
            ...     return {"score": score, "label": "pass" if score > 0.8 else "fail"}
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._base_url = str(client.base_url)
        self._headers = dict(client.headers)

    def get_dataset_experiments_url(self, dataset_id: str) -> str:
        return f"{self._client.base_url}/datasets/{dataset_id}/experiments"

    def get_experiment_url(self, dataset_id: str, experiment_id: str) -> str:
        return f"{self._client.base_url}/datasets/{dataset_id}/compare?experimentId={experiment_id}"

    async def run_experiment(
        self,
        *,
        dataset: Dataset,
        task: ExperimentTask,
        evaluators: Optional[ExperimentEvaluators] = None,
        experiment_name: Optional[str] = None,
        experiment_description: Optional[str] = None,
        experiment_metadata: Optional[Mapping[str, Any]] = None,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        dry_run: Union[bool, int] = False,
        print_summary: bool = True,
        concurrency: int = 3,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> RanExperiment:
        """
        Runs an experiment using a given dataset of examples (async version).

        An experiment is a user-defined task that runs on each example in a dataset. The results
        from each experiment can be evaluated using any number of evaluators to measure the
        behavior of the task. The experiment and evaluation results are stored in the Phoenix
        database for comparison and analysis.

        A `task` is either a synchronous or asynchronous function that returns a JSON serializable
        output. If the `task` is a function of one argument then that argument will be bound to the
        `input` field of the dataset example. Alternatively, the `task` can be a function of any
        combination of specific argument names that will be bound to special values:

        - `input`: The input field of the dataset example
        - `expected`: The expected or reference output of the dataset example
        - `reference`: An alias for `expected`
        - `metadata`: Metadata associated with the dataset example
        - `example`: The dataset `Example` object with all associated fields

        An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - phoenix.experiments.types.EvaluationResult with optional fields for score, label,
          explanation and metadata
        - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
        - a `float`, which will be interpreted as a score
        - a `str`, which will be interpreted as a label
        - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)
        - a dictionary with any of: "label", "score" and "explanation" keys

        If the `evaluator` is a function of one argument then that argument will be
        bound to the `output` of the task. Alternatively, the `evaluator` can be a function of any
        combination of specific argument names that will be bound to special values:

        - `input`: The input field of the dataset example
        - `output`: The output of the task
        - `expected`: The expected or reference output of the dataset example
        - `reference`: An alias for `expected`
        - `metadata`: Metadata associated with the dataset example

        Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

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
            timeout: The timeout for the task execution in seconds. Use this to run
                longer tasks to avoid re-queuing the same task multiple times. Defaults to 60.

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

        payload = {
            "version_id": dataset.version_id,
            "name": experiment_name,
            "description": experiment_description,
            "metadata": experiment_metadata,
            "repetitions": repetitions,
        }

        if not dry_run:
            experiment_response = await self._client.post(
                f"v1/datasets/{dataset.id}/experiments",
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
            experiment = {
                "id": DRY_RUN,
                "dataset_id": dataset.id,
                "dataset_version_id": dataset.version_id,
                "repetitions": repetitions,
                "metadata": {},
                "project_name": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

        tracer, resource = _get_tracer(
            experiment["project_name"], str(self._client.base_url), dict(self._client.headers)
        )
        root_span_name = f"Task: {get_func_name(task)}"

        print("🧪 Experiment started.")

        example_ids: list[str] = []
        if dry_run:
            examples_list = list(dataset.examples)
            if isinstance(dry_run, bool):
                sample_size = 1
            else:
                sample_size = min(len(examples_list), dry_run if dry_run > 1 else 1)
            random.seed(42)  # Set seed for reproducible sampling
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
            all_runs_response = await self._client.get(f"v1/experiments/{experiment['id']}/runs")
            all_runs = all_runs_response.json()["data"]
            async_task_runs: list[ExperimentRun] = []
            for run in all_runs:
                run["start_time"] = datetime.fromisoformat(run["start_time"])
                run["end_time"] = datetime.fromisoformat(run["end_time"])
                async_task_runs.append(run)  # Already in TypedDict format
            task_runs = async_task_runs

            # Check if we got all expected runs
            expected_runs = len(examples_to_process) * repetitions
            actual_runs = len(task_runs)
            if actual_runs < expected_runs:
                print(
                    f"⚠️  Warning: Only {actual_runs} out of {expected_runs} expected runs were "
                    "completed successfully."
                )

        # Create RanExperiment object
        task_runs_list = [r for r in task_runs if r is not None]
        evaluation_runs_list: list[ExperimentEvaluationRun] = []

        ran_experiment: RanExperiment = {
            "experiment_id": experiment["id"],
            "dataset_id": dataset.id,
            "task_runs": task_runs_list,
            "evaluation_runs": [],
            "experiment_metadata": experiment.get("metadata", {}),
        }

        if evaluators is not None:
            eval_result = await self.evaluate_experiment(
                experiment=ran_experiment,
                evaluators=evaluators,
                dry_run=bool(dry_run),
                print_summary=False,  # We'll handle summary printing in run_experiment
                timeout=timeout,
                concurrency=concurrency,
                rate_limit_errors=rate_limit_errors,
            )
            evaluation_runs_list = eval_result["evaluation_runs"]

            ran_experiment["evaluation_runs"] = evaluation_runs_list

        if print_summary:
            print(
                f"Experiment completed with {len(ran_experiment['task_runs'])} task runs and "
                f"{len(ran_experiment['evaluation_runs'])} evaluation runs"
            )

        return ran_experiment

    async def evaluate_experiment(
        self,
        *,
        experiment: RanExperiment,
        evaluators: Evaluators,
        dry_run: bool = False,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        concurrency: int = 3,
        rate_limit_errors: Optional[RateLimitErrors] = None,
    ) -> RanExperiment:
        """
        Run evaluators on a completed experiment (async version).

        An `evaluator` is either a synchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - phoenix.experiments.types.EvaluationResult with optional fields for score, label,
          explanation and metadata
        - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
        - a `float`, which will be interpreted as a score
        - a `str`, which will be interpreted as a label
        - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)
        - a dictionary with any of: "label", "score" and "explanation" keys

        Args:
            experiment: The experiment ID or RanExperiment object to evaluate.
            evaluators: A single evaluator or sequence of evaluators used to
                evaluate the results of the experiment.
            dry_run: Run the evaluation in dry-run mode. When set, evaluation results will
                not be recorded in Phoenix. Defaults to False.
            print_summary: Whether to print a summary of the evaluation results.
                Defaults to True.
            timeout: The timeout for the evaluation execution in seconds. Defaults to 60.

        Returns:
            A dictionary containing the evaluation results with the same format as run_experiment.

        Raises:
            ValueError: If no evaluators are provided or experiment has no runs.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        evaluators_by_name = _evaluators_by_name(evaluators)
        if not evaluators_by_name:
            raise ValueError("Must specify at least one evaluator")

        experiment_id = experiment["experiment_id"]
        task_runs = experiment["task_runs"]
        dataset_id = experiment["dataset_id"]
        experiment_metadata = experiment["experiment_metadata"]
        try:
            experiment_response = await self._client.get(
                f"v1/experiments/{experiment_id}", timeout=timeout
            )
            experiment_response.raise_for_status()
            experiment_data = experiment_response.json()["data"]
            dataset_version_id = experiment_data["dataset_version_id"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

        # Fetch dataset for evaluation context
        try:
            dataset_response = await self._client.get(
                f"v1/datasets/{dataset_id}/examples",
                params={"version_id": str(dataset_version_id)},
                timeout=timeout,
            )
            dataset_response.raise_for_status()
            dataset_data = dataset_response.json()["data"]
        except HTTPStatusError:
            raise ValueError(f"Failed to fetch dataset for experiment: {experiment_id}")

        from phoenix.client.resources.datasets import Dataset

        dataset = Dataset(
            dataset_info={
                "id": dataset_id,
                "name": experiment_data.get("dataset_name", ""),
                "description": experiment_data.get("dataset_description"),
                "metadata": experiment_data.get("dataset_metadata", {}),
                "created_at": experiment_data.get("dataset_created_at"),
                "updated_at": experiment_data.get("dataset_updated_at"),
            },
            examples_data=dataset_data,
        )

        # Create evaluation tracer
        project_name = experiment_data.get("project_name", "")
        eval_tracer, eval_resource = _get_tracer(
            None if dry_run else "evaluators",
            str(self._client.base_url),
            dict(self._client.headers),
        )

        print("🧠 Evaluation started.")

        eval_runs = await self._run_evaluations_async(
            task_runs,
            evaluators_by_name,
            eval_tracer,
            eval_resource,
            dry_run,
            timeout,
            rate_limit_errors,
            concurrency,
            project_name,
            dataset,
        )

        # Combine existing evaluation runs with new ones
        all_evaluation_runs = eval_runs
        all_evaluation_runs = experiment["evaluation_runs"] + eval_runs

        ran_experiment: RanExperiment = {
            "experiment_id": experiment_id,
            "dataset_id": dataset_id,
            "task_runs": task_runs,
            "evaluation_runs": all_evaluation_runs,
            "experiment_metadata": experiment_metadata,
        }

        if print_summary:
            print(
                f"Evaluation completed with {len(ran_experiment['evaluation_runs'])} "
                "evaluation runs"
            )

        return ran_experiment

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
            cached_exp_run: ExperimentRun = {
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
                        f"v1/experiments/{experiment['id']}/runs",
                        json=cached_exp_run,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
                    cached_exp_run = {**cached_exp_run, "id": resp.json()["data"]["id"]}
                except HTTPStatusError as e:
                    if e.response.status_code == 409:
                        return None
                    raise
            return cached_exp_run

        output = None
        error: Optional[BaseException] = None
        start_time = datetime.now(timezone.utc)
        end_time = start_time
        trace_id = None
        status = Status(StatusCode.OK)

        with ExitStack() as stack:
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            stack.enter_context(capture_spans(resource))
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
            span.set_attribute(INPUT_VALUE, json.dumps(example["input"], ensure_ascii=False))
            span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            if output is not None:
                if isinstance(output, str):
                    span.set_attribute(OUTPUT_VALUE, output)
                else:
                    span.set_attribute(OUTPUT_VALUE, json.dumps(output, ensure_ascii=False))
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
            span.set_attribute(OPENINFERENCE_SPAN_KIND, CHAIN)
            span.set_status(status)

            # Handle potential None values in span timing
            if span.start_time is not None:
                start_time = _decode_unix_nano(span.start_time)
            if span.end_time is not None:
                end_time = _decode_unix_nano(span.end_time)
            span_context = span.get_span_context()  # type: ignore[no-untyped-call]
            if span_context is not None and span_context.trace_id != 0:
                trace_id = _str_trace_id(span_context.trace_id)

        exp_run: ExperimentRun = {
            "dataset_example_id": example["id"],
            "output": output,
            "repetition_number": repetition_number,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "id": f"temp-{random.randint(1000, 9999)}",
            "experiment_id": experiment["id"],
        }

        # Add optional fields if they exist
        if trace_id:
            exp_run["trace_id"] = trace_id
        if error:
            exp_run["error"] = repr(error)

        if not dry_run:
            try:
                resp = await self._client.post(
                    f"v1/experiments/{experiment['id']}/runs",
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
        project_name: str,
        dataset: Dataset,
    ) -> list[ExperimentEvaluationRun]:
        # Create evaluation input with example data
        evaluation_input: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]] = []
        for run in task_runs:
            # Find the corresponding example for this run
            example = None
            for ex in dataset.examples:
                if ex["id"] == run["dataset_example_id"]:
                    example = ex
                    break

            if example is not None:
                for evaluator in evaluators_by_name.values():
                    evaluation_input.append((example, run, evaluator))

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        async def async_evaluate_run(
            obj: tuple[v1.DatasetExample, ExperimentRun, Evaluator],
        ) -> Optional[ExperimentEvaluationRun]:
            example, run, evaluator = obj
            return await self._run_single_evaluation_async(
                example, run, evaluator, tracer, resource, dry_run, timeout, project_name
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
        example: v1.DatasetExample,
        experiment_run: ExperimentRun,
        evaluator: Evaluator,
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
        project_name: str,
    ) -> Optional[ExperimentEvaluationRun]:
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        root_span_name = f"Evaluation: {evaluator.name}"
        start_time = datetime.now(timezone.utc)
        end_time = start_time
        trace_id = None
        status = Status(StatusCode.OK)

        with ExitStack() as stack:
            span = cast(
                Span,
                stack.enter_context(
                    tracer.start_as_current_span(root_span_name, context=Context())
                ),
            )
            stack.enter_context(capture_spans(resource))
            try:
                result = await evaluator.async_evaluate(
                    output=experiment_run["output"],
                    expected=example["output"],
                    reference=example["output"],
                    input=example["input"],
                    metadata=example["metadata"],
                )
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example["id"],
                    repetition_number=experiment_run.get("repetition_number", 1),
                    kind="evaluator",
                )

            if result:
                # Filter out None values for OpenTelemetry attributes
                attributes: dict[str, Any] = {}
                if (score := result.get("score")) is not None:
                    attributes["evaluation.score"] = score
                if (label := result.get("label")) is not None:
                    attributes["evaluation.label"] = label
                if attributes:
                    span.set_attributes(attributes)
            span.set_attribute(OPENINFERENCE_SPAN_KIND, EVALUATOR)
            span.set_status(status)

            # Handle potential None values in span timing
            if span.start_time is not None:
                start_time = _decode_unix_nano(span.start_time)
            if span.end_time is not None:
                end_time = _decode_unix_nano(span.end_time)
            span_context = span.get_span_context()  # type: ignore[no-untyped-call]
            if span_context is not None and span_context.trace_id != 0:
                trace_id = _str_trace_id(span_context.trace_id)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=experiment_run["id"],
            start_time=start_time,
            end_time=end_time,
            name=evaluator.name,
            annotator_kind=evaluator.kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=trace_id,
        )

        if not dry_run:
            try:
                resp = await self._client.post(
                    "v1/experiment_evaluations",
                    json=jsonify(eval_run.__dict__),
                    timeout=timeout,
                )
                resp.raise_for_status()
                eval_run = replace(eval_run, id=resp.json()["data"]["id"])
            except HTTPStatusError as e:
                logger.warning(
                    f"Failed to submit evaluation result for evaluator '{evaluator.name}': "
                    f"HTTP {e.response.status_code} - {e.response.text}"
                )
                # Continue even if evaluation storage fails

        return eval_run
