import copy
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
from openinference.instrumentation import OITracer, TraceConfig
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
from phoenix.client.resources.experiments.evaluators import (
    create_evaluator,
)
from phoenix.client.resources.experiments.types import (
    DRY_RUN,
    EvaluationResult,
    Evaluator,
    EvaluatorName,
    ExampleProxy,
    Experiment,
    ExperimentEvaluationRun,
    ExperimentEvaluators,
    ExperimentRun,
    ExperimentTask,
    RanExperiment,
    RateLimitErrors,
    TestCase,
)
from phoenix.client.utils.executors import AsyncExecutor, SyncExecutor
from phoenix.client.utils.rate_limiters import RateLimiter

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_IN_SECONDS = 60


class SpanModifier:
    """A class that modifies spans with the specified resource attributes."""

    __slots__ = ("_resource",)

    def __init__(self, resource: Resource) -> None:
        self._resource = resource

    def modify_resource(self, span: ReadableSpan) -> None:
        """Takes a span and merges in the resource attributes specified in the constructor.

        Args:
            span (ReadableSpan): The span to modify.
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
    """A context manager that captures spans and modifies them with the specified resources.

    Args:
        resource (Resource): The resource to merge into the spans created within the context.

    Yields:
        SpanModifier: The span modifier that is active within the context.
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
    return OITracer(tracer_provider.get_tracer(__name__), config=TraceConfig()), resource


def get_tqdm_progress_bar_formatter(title: str) -> str:
    return (
        title + " |{bar}| {n_fmt}/{total_fmt} ({percentage:3.1f}%) "
        "| ⏳ {elapsed}<{remaining} | {rate_fmt}{postfix}"
    )


def get_func_name(func: Callable[..., Any]) -> str:
    """Get the name of a function.

    Args:
        func (Callable[..., Any]): The function to get the name of.

    Returns:
        str: The name of the function.
    """
    if isinstance(func, functools.partial):
        return get_func_name(func.func)
    is_not_lambda = hasattr(func, "__qualname__") and not func.__qualname__.endswith("<lambda>")
    if is_not_lambda:
        return func.__qualname__.split(".<locals>.")[-1]
    return getattr(func, "__name__", str(func))


def jsonify(obj: Any) -> Any:
    """Convert object to JSON-serializable format.

    Args:
        obj (Any): The object to convert to JSON-serializable format.

    Returns:
        Any: The JSON-serializable representation of the object.
    """
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

    elif isinstance(obj, Mapping):
        for name, value in obj.items():
            evaluator = create_evaluator(name=name)(value)
            evaluators_by_name[evaluator.name] = evaluator
    elif isinstance(obj, Sequence):
        for value in obj:
            evaluator = create_evaluator()(value)
            evaluators_by_name[evaluator.name] = evaluator
    else:
        evaluator = create_evaluator()(obj)
        evaluators_by_name[evaluator.name] = evaluator

    return evaluators_by_name


def _decode_unix_nano(time_unix_nano: int) -> datetime:
    """Convert Unix nanoseconds to datetime."""
    return datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)


def _validate_repetitions(reps: int) -> None:
    """Make sure repetitions is a positive number"""
    if reps <= 0:
        raise ValueError("Repetitions must be greater than 0")


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
        "input": copy.deepcopy(example["input"]),
        "expected": copy.deepcopy(example["output"]),
        "reference": copy.deepcopy(example["output"]),
        "metadata": copy.deepcopy(example["metadata"]),
        "example": ExampleProxy(example),
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


def _build_evaluation_tasks(
    task_runs: Sequence[ExperimentRun],
    evaluators_by_name: Mapping[EvaluatorName, Evaluator],
    examples_by_id: Mapping[str, v1.DatasetExample],
) -> list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]]:
    """
    Build evaluation tasks for all evaluators on all runs.

    Args:
        task_runs: List of experiment runs to evaluate
        evaluators_by_name: Mapping of evaluator names to evaluator functions
        examples_by_id: Mapping of example IDs to dataset examples

    Returns:
        List of tuples: (example, run, evaluator)
    """
    evaluation_tasks: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]] = []

    for run in task_runs:
        example = examples_by_id.get(run["dataset_example_id"])
        if example is None:
            continue

        for evaluator in evaluators_by_name.values():
            evaluation_tasks.append((example, run, evaluator))

    return evaluation_tasks


def _build_tasks_for_named_evaluators(
    incomplete_evals: Sequence[v1.IncompleteExperimentEvaluation],
    evaluators_by_name: Mapping[EvaluatorName, Evaluator],
) -> list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]]:
    """
    Build evaluation tasks for standard named evaluators.

    Matches evaluator dict keys with incomplete evaluation names.

    Args:
        incomplete_evals: List of incomplete evaluations from server
        evaluators_by_name: Mapping of evaluator names to evaluator functions

    Returns:
        List of tuples: (example, run, evaluator)
    """
    evaluation_tasks: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]] = []

    for incomplete in incomplete_evals:
        run = incomplete["experiment_run"]
        example = incomplete["dataset_example"]

        incomplete_names = set(incomplete["evaluation_names"])

        # Match evaluator keys with incomplete evaluation names
        for evaluator_name in incomplete_names & evaluators_by_name.keys():
            evaluator = evaluators_by_name[evaluator_name]
            evaluation_tasks.append((example, run, evaluator))

    return evaluation_tasks


def _build_tasks_for_multi_output_evaluator(
    incomplete_evals: Sequence[v1.IncompleteExperimentEvaluation],
    evaluator: Evaluator,
) -> list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]]:
    """
    Build evaluation tasks for a single multi-output evaluator.

    Runs the evaluator for any run with any incomplete evaluation.

    Args:
        incomplete_evals: List of incomplete evaluations from server
        evaluator: The single multi-output evaluator to run

    Returns:
        List of tuples: (example, run, evaluator)
    """
    evaluation_tasks: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]] = []

    for incomplete in incomplete_evals:
        run = incomplete["experiment_run"]
        example = incomplete["dataset_example"]
        evaluation_tasks.append((example, run, evaluator))

    return evaluation_tasks


def _build_incomplete_evaluation_tasks(
    incomplete_evals: Sequence[v1.IncompleteExperimentEvaluation],
    evaluators_by_name: Mapping[EvaluatorName, Evaluator],
) -> list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]]:
    """
    Build evaluation tasks from incomplete evaluations response.

    Args:
        incomplete_evals: List of incomplete evaluations from server
        evaluators_by_name: Mapping of evaluator names to evaluator functions

    Returns:
        List of tuples: (example, run, evaluator)
    """
    # Standard case: match evaluator keys with evaluation names
    return _build_tasks_for_named_evaluators(incomplete_evals, evaluators_by_name)


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

    - an EvaluationResult dict with optional fields for score, label, explanation and metadata
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
    - `example`: The dataset `Example` object with all associated fields

    Example:
        Basic usage::

            from phoenix.client import Client
            client = Client()
            dataset = client.datasets.get_dataset(dataset="my-dataset")

            def my_task(input):
                return f"Hello {input['name']}"

            experiment = client.experiments.run_experiment(
                dataset=dataset,
                task=my_task,
                experiment_name="greeting-experiment"
            )

        With evaluators::

            def accuracy_evaluator(output, expected):
                return 1.0 if output == expected['text'] else 0.0

            experiment = client.experiments.run_experiment(
                dataset=dataset,
                task=my_task,
                evaluators=[accuracy_evaluator],
                experiment_name="evaluated-experiment"
            )

        Using dynamic binding for tasks::

            def my_task(input, metadata, expected):
                # Task can access multiple fields from the dataset example
                context = metadata.get("context", "")
                return f"Context: {context}, Input: {input}, Expected: {expected}"

        Using dynamic binding for evaluators::

            def my_evaluator(output, input, expected, metadata):
                # Evaluator can access task output and example fields
                score = calculate_similarity(output, expected)
                return {"score": score, "label": "pass" if score > 0.8 else "fail"}
    """

    def __init__(self, client: httpx.Client) -> None:
        self._client = client
        self._base_url = str(client.base_url)
        self._headers = dict(client.headers)

    def get_dataset_experiments_url(self, dataset_id: str) -> str:
        return urljoin(str(self._client.base_url), f"datasets/{dataset_id}/experiments")

    def get_experiment_url(self, dataset_id: str, experiment_id: str) -> str:
        return urljoin(
            str(self._client.base_url),
            f"datasets/{dataset_id}/compare?experimentId={experiment_id}",
        )

    def create(
        self,
        *,
        dataset_id: str,
        dataset_version_id: Optional[str] = None,
        experiment_name: Optional[str] = None,
        experiment_description: Optional[str] = None,
        experiment_metadata: Optional[Mapping[str, Any]] = None,
        splits: Optional[Sequence[str]] = None,
        repetitions: int = 1,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Experiment:
        """Create a new experiment without running it.

        This method creates an experiment record in the Phoenix database but does not
        execute any tasks. Use `resume_experiment` to run tasks on the created experiment.

        Args:
            dataset_id (str): The ID of the dataset on which the experiment will be run.
            dataset_version_id (Optional[str]): The ID of the dataset version to use. If not
                provided, the latest version will be used. Defaults to None.
            experiment_name (Optional[str]): The name of the experiment. Defaults to None.
            experiment_description (Optional[str]): A description of the experiment. Defaults to
                None.
            experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
                experiment. Defaults to None.
            splits (Optional[Sequence[str]]): List of dataset split identifiers (IDs or names)
                to filter by. Defaults to None.
            repetitions (int): The number of times the task will be run on each example.
                Defaults to 1.
            timeout (Optional[int]): The timeout for the request in seconds. Defaults to 60.

        Returns:
            Experiment: The newly created experiment.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            from phoenix.client import Client
            client = Client()

            experiment = client.experiments.create(
                dataset_id="dataset_123",
                experiment_name="my-experiment",
                experiment_description="Testing my task",
                repetitions=3,
            )
            print(f"Created experiment with ID: {experiment['id']}")

            # Later, run the experiment
            client.experiments.resume_experiment(
                experiment_id=experiment["id"],
                task=my_task,
            )
        """
        _validate_repetitions(repetitions)

        payload: dict[str, Any] = {
            "repetitions": repetitions,
        }

        if experiment_name and experiment_name.strip():
            payload["name"] = experiment_name.strip()

        if experiment_description and experiment_description.strip():
            payload["description"] = experiment_description.strip()

        if experiment_metadata:
            payload["metadata"] = experiment_metadata

        if dataset_version_id and dataset_version_id.strip():
            payload["version_id"] = dataset_version_id.strip()

        if splits:
            payload["splits"] = list(splits)

        experiment_response = self._client.post(
            f"v1/datasets/{dataset_id}/experiments",
            json=payload,
            timeout=timeout,
        )
        experiment_response.raise_for_status()
        exp_json = experiment_response.json()["data"]
        return cast(Experiment, exp_json)

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
        repetitions: int = 1,
        retries: int = 3,
    ) -> RanExperiment:
        """
        Runs an experiment using a given dataset of examples.

        An experiment is a user-defined task that runs on each example in a dataset. The results
        from each experiment can be evaluated using any number of evaluators to measure the
        behavior of the task. The experiment and evaluation results are stored in the Phoenix
        database for comparison and analysis.

        A `task` is a synchronous function that returns a JSON serializable output. If the `task`
        is a function of one argument then that argument will be bound to the `input` field of the
        dataset example. Alternatively, the `task` can be a function of any combination of specific
        argument names that will be bound to special values:

        - `input`: The input field of the dataset example
        - `expected`: The expected or reference output of the dataset example
        - `reference`: An alias for `expected`
        - `metadata`: Metadata associated with the dataset example
        - `example`: The dataset `Example` object with all associated fields

        An `evaluator` is either a synchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - an EvaluationResult dict with optional fields for score, label, explanation and metadata
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
        - `example`: The dataset `Example` object with all associated fields


        Args:
            dataset (Dataset): The dataset on which to run the experiment.
            task (ExperimentTask): The task to run on each example in the dataset.
            evaluators (Optional[ExperimentEvaluators]): A single evaluator or sequence of
                evaluators used to evaluate the results of the experiment. Evaluators can be
                provided as a dict mapping names to functions, or as a list of functions (names
                will be auto-generated). Defaults to None.
            experiment_name (Optional[str]): The name of the experiment. Defaults to None.
            experiment_description (Optional[str]): A description of the experiment. Defaults to
                None.
            experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
                experiment. Defaults to None.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions to
                adaptively throttle on. Defaults to None.
            dry_run (Union[bool, int]): Run the experiment in dry-run mode. When set,
                experiment results will not be recorded in Phoenix. If True, the experiment will run
                on a random
                dataset example. If an integer, the experiment will run on a random sample of the
                dataset examples of the given size. Defaults to False.
            print_summary (bool): Whether to print a summary of the experiment and evaluation
                results. Defaults to True.
            timeout (Optional[int]): The timeout for the task execution in seconds. Use this to run
                longer tasks to avoid re-queuing the same task multiple times. Defaults to 60.
            repetitions (int): The number of times the task will be run on each example.
                Defaults to 1.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            RanExperiment: A dictionary containing the experiment results.

        Raises:
            ValueError: If dataset format is invalid or has no examples.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        task_signature = inspect.signature(task)
        _validate_task_signature(task_signature)

        if not dataset.examples:
            raise ValueError(f"Dataset has no examples: {dataset.id=}, {dataset.version_id=}")

        _validate_repetitions(repetitions)

        if not dry_run:
            experiment = self.create(
                dataset_id=dataset.id,
                dataset_version_id=dataset.version_id,
                experiment_name=experiment_name,
                experiment_description=experiment_description,
                experiment_metadata=experiment_metadata,
                splits=dataset._filtered_split_names,  # pyright: ignore[reportPrivateUsage]
                repetitions=repetitions,
                timeout=timeout,
            )
        else:
            experiment = Experiment(
                id=DRY_RUN,
                dataset_id=dataset.id,
                dataset_version_id=dataset.version_id,
                repetitions=repetitions,
                metadata={},
                project_name=None,
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
                example_count=0,
                successful_run_count=0,
                failed_run_count=0,
                missing_run_count=0,
            )

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
            max_retries=retries,
            exit_on_error=False,
            fallback_return_value=None,
        )

        task_runs, _execution_details = executor.run(test_cases)
        print("✅ Task runs completed.")

        # Get the final state of runs from the database if not dry run
        if not dry_run:
            task_runs = self._get_all_experiment_runs(experiment_id=experiment["id"])

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
            "dataset_version_id": dataset.version_id,
            "task_runs": task_runs_list,
            "evaluation_runs": [],
            "experiment_metadata": experiment.get("metadata", {}),
            "project_name": experiment.get("project_name"),
        }

        if evaluators is not None:
            eval_result = self.evaluate_experiment(
                experiment=ran_experiment,
                evaluators=evaluators,
                dry_run=bool(dry_run),
                print_summary=False,  # We'll handle summary printing in run_experiment
                timeout=timeout,
                rate_limit_errors=rate_limit_errors,
                retries=retries,
            )
            evaluation_runs_list = eval_result["evaluation_runs"]

        ran_experiment["evaluation_runs"] += evaluation_runs_list

        if print_summary:
            task_runs_count = len(ran_experiment["task_runs"])
            evaluators_count = 0
            if evaluators is not None:
                try:
                    evaluators_count = len(_evaluators_by_name(evaluators))
                except Exception:
                    evaluators_count = 0
            evaluations_count = 0
            for _er in ran_experiment["evaluation_runs"]:
                _res = _er.result
                if _res is None:
                    continue
                if isinstance(_res, Sequence) and not isinstance(_res, (str, bytes, dict)):
                    evaluations_count += len(_res)  # pyright: ignore[reportUnknownArgumentType]
                else:
                    evaluations_count += 1

            print(
                "Experiment completed: "
                f"{task_runs_count} task runs, "
                f"{evaluators_count} evaluator runs, "
                f"{evaluations_count} evaluations"
            )

        return ran_experiment

    def _get_all_experiment_runs(
        self,
        *,
        experiment_id: str,
        page_size: int = 50,
    ) -> list[ExperimentRun]:
        """
        Fetch all experiment runs using pagination to handle large datasets.

        Args:
            experiment_id (str): The ID of the experiment.
            page_size (int): Number of runs to fetch per page. Defaults to 50.

        Returns:
            list[ExperimentRun]: List of all experiment runs.
        """
        all_runs: list[ExperimentRun] = []
        cursor: Optional[str] = None

        while True:
            params: dict[str, Any] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor

            try:
                response = self._client.get(
                    f"v1/experiments/{experiment_id}/runs",
                    params=params,
                )
                response.raise_for_status()
                body = cast(v1.ListExperimentRunsResponseBody, response.json())
                all_runs.extend(body["data"])

                # Check if there are more pages
                cursor = body.get("next_cursor")
                if not cursor:
                    break

            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Experiment doesn't exist - treat as empty result
                    break
                else:
                    raise

        return all_runs

    def get_experiment(self, *, experiment_id: str) -> RanExperiment:
        """
        Get a completed experiment by ID.

        This method retrieves a completed experiment with all its task runs and evaluation runs,
        returning a RanExperiment object that can be used with evaluate_experiment to run
        additional evaluations.

        Args:
            experiment_id (str): The ID of the experiment to retrieve.

        Returns:
            RanExperiment: A RanExperiment object containing the experiment data, task runs,
                and evaluation runs.

        Raises:
            ValueError: If the experiment is not found.
            httpx.HTTPStatusError: If the API returns an error response.

        Examples::

            client = Client()
            experiment = client.experiments.get_experiment(experiment_id="123")
            client.experiments.evaluate_experiment(
                experiment=experiment,
                evaluators=[
                    correctness,
                ],
                print_summary=True,
            )
        """
        # Get experiment metadata using existing endpoint
        try:
            experiment_response = self._client.get(f"v1/experiments/{experiment_id}")
            experiment_response.raise_for_status()
            experiment_data = experiment_response.json()["data"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

        try:
            runs_response = self._client.get(f"v1/experiments/{experiment_id}/runs")
            runs_response.raise_for_status()
            runs_data = runs_response.json()["data"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                # Experiment exists but has no runs
                runs_data = []
            else:
                raise

        try:
            json_response = self._client.get(f"v1/experiments/{experiment_id}/json")
            json_response.raise_for_status()
            json_data = json_response.json()
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                # Experiment exists but has no runs
                json_data = []
            else:
                raise

        json_lookup = {}
        for record in json_data:  # pyright: ignore [reportUnknownVariableType]
            key = (record["example_id"], record["repetition_number"])  # pyright: ignore [reportUnknownMemberType, reportUnknownVariableType]
            json_lookup[key] = record

        task_runs: list[ExperimentRun] = []
        evaluation_runs: list[ExperimentEvaluationRun] = []

        for run_data in runs_data:  # pyright: ignore [reportUnknownVariableType]
            task_run: ExperimentRun = cast(ExperimentRun, run_data)  # pyright: ignore [reportUnknownArgumentType]
            task_runs.append(task_run)

            lookup_key = (run_data["dataset_example_id"], run_data["repetition_number"])  # pyright: ignore [reportUnknownMemberType, reportUnknownVariableType]
            json_record = json_lookup.get(lookup_key)  # pyright: ignore [reportUnknownVariableType, reportUnknownMemberType]
            if not json_record:
                continue

            # Create evaluation runs from annotations if present
            for annotation in json_record.get("annotations", []):  # pyright: ignore [reportUnknownMemberType, reportUnknownVariableType]
                eval_result = None
                if (
                    annotation.get("label") is not None  # pyright: ignore [reportUnknownMemberType]
                    or annotation.get("score") is not None  # pyright: ignore [reportUnknownMemberType]
                    or annotation.get("explanation") is not None  # pyright: ignore [reportUnknownMemberType]
                ):
                    eval_result = cast(
                        EvaluationResult,
                        {  # pyright: ignore [reportUnknownVariableType]
                            "label": annotation.get("label"),  # pyright: ignore [reportUnknownMemberType]
                            "score": annotation.get("score"),  # pyright: ignore [reportUnknownMemberType]
                            "explanation": annotation.get("explanation"),  # pyright: ignore [reportUnknownMemberType]
                        },
                    )

                # Only create evaluation runs for annotations that have evaluation data
                if eval_result is not None:
                    eval_run = ExperimentEvaluationRun(
                        id=f"ExperimentEvaluation:{len(evaluation_runs) + 1}",  # Generate temp ID
                        experiment_run_id=run_data["id"],  # pyright: ignore [reportUnknownArgumentType]
                        start_time=datetime.fromisoformat(annotation["start_time"]),  # pyright: ignore [reportUnknownArgumentType]
                        end_time=datetime.fromisoformat(annotation["end_time"]),  # pyright: ignore [reportUnknownArgumentType]
                        name=annotation["name"],  # pyright: ignore [reportUnknownArgumentType]
                        annotator_kind=annotation["annotator_kind"],  # pyright: ignore [reportUnknownArgumentType]
                        error=annotation.get("error"),  # pyright: ignore [reportUnknownMemberType, reportUnknownArgumentType]
                        result=eval_result,  # pyright: ignore [reportArgumentType]
                        trace_id=annotation.get("trace_id"),  # pyright: ignore [reportUnknownMemberType, reportUnknownArgumentType]
                        metadata=annotation.get("metadata", {}),  # pyright: ignore [reportUnknownMemberType, reportUnknownArgumentType]
                    )
                    evaluation_runs.append(eval_run)

        ran_experiment: RanExperiment = {
            "experiment_id": experiment_id,
            "dataset_id": experiment_data["dataset_id"],
            "dataset_version_id": experiment_data["dataset_version_id"],
            "task_runs": task_runs,
            "evaluation_runs": evaluation_runs,
            "experiment_metadata": experiment_data.get("metadata", {}),
            "project_name": experiment_data.get("project_name"),
        }

        return ran_experiment

    def resume_experiment(
        self,
        *,
        experiment_id: str,
        task: ExperimentTask,
        evaluators: Optional[ExperimentEvaluators] = None,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        retries: int = 3,
    ) -> None:
        """
        Resume an incomplete experiment by running only the missing or failed runs.

        This method identifies which (example, repetition) pairs have not been completed
        (either missing or failed) and re-runs the task only for those pairs. Optionally,
        evaluators can be run on the completed runs after task execution.

        The method processes incomplete runs in batches using pagination to minimize memory usage.

        .. note::
            Multi-output evaluators (evaluators that return a list/sequence of results) are not
            supported for resume operations. Each evaluator should produce a single evaluation
            result with a name matching the evaluator's key in the dictionary.

        Args:
            experiment_id (str): The ID of the experiment to resume.
            task (ExperimentTask): The task to run on incomplete examples.
            evaluators (Optional[ExperimentEvaluators]): Optional evaluators to run on completed
                task runs. Evaluators can be provided as a dict mapping names to functions, or as
                a list of functions (names will be auto-generated). Defaults to None.
            print_summary (bool): Whether to print a summary of the results. Defaults to True.
            timeout (Optional[int]): The timeout for task execution in seconds. Defaults to 60.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
                to adaptively throttle on. Defaults to None.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            None

        Raises:
            ValueError: If the experiment is not found.
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            client = Client()

            # Resume an interrupted experiment
            client.experiments.resume_experiment(
                experiment_id="exp_123",
                task=my_task,
            )

            # Resume with evaluators
            client.experiments.resume_experiment(
                experiment_id="exp_123",
                task=my_task,
                evaluators={"quality": my_evaluator},
            )
        """
        task_signature = inspect.signature(task)
        _validate_task_signature(task_signature)

        # Get the experiment metadata
        experiment = self.get(experiment_id=experiment_id)

        # Setup for task execution
        tracer, resource = _get_tracer(
            experiment["project_name"], str(self._client.base_url), dict(self._client.headers)
        )
        root_span_name = f"Task: {get_func_name(task)}"
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
                False,  # dry_run
                timeout,
                task_result_cache,
            )

        rate_limited_sync_run_task = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), rate_limiters, sync_run_task
        )

        # Check experiment status using counts from the experiment response
        print("🔍 Checking for incomplete runs...")
        total_expected = experiment["example_count"] * experiment["repetitions"]
        incomplete_count = total_expected - experiment["successful_run_count"]

        if incomplete_count == 0:
            print("✅ No incomplete runs found. Experiment is already complete.")
            return None

        print(f"🧪 Resuming experiment with {incomplete_count} incomplete runs...")

        dataset_experiments_url = self.get_dataset_experiments_url(
            dataset_id=experiment["dataset_id"]
        )
        experiment_compare_url = self.get_experiment_url(
            dataset_id=experiment["dataset_id"],
            experiment_id=experiment["id"],
        )
        print(f"📺 View dataset experiments: {dataset_experiments_url}")
        print(f"🔗 View this experiment: {experiment_compare_url}")

        # Process incomplete runs in streaming batches
        cursor: Optional[str] = None
        page_size = 50
        total_processed = 0
        total_completed = 0

        while True:
            # Fetch next batch of incomplete runs
            params: dict[str, Any] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor

            try:
                response = self._client.get(
                    f"v1/experiments/{experiment_id}/incomplete-runs",
                    params=params,
                    timeout=timeout,
                )
                response.raise_for_status()
                body = cast(v1.GetIncompleteExperimentRunsResponseBody, response.json())
                batch_incomplete = body["data"]

                if not batch_incomplete:
                    break

                # Build test cases from this batch
                batch_test_cases: list[TestCase] = []
                for incomplete in batch_incomplete:
                    example_data = incomplete["dataset_example"]
                    for rep in incomplete["repetition_numbers"]:
                        batch_test_cases.append(
                            TestCase(example=example_data, repetition_number=rep)
                        )

                print(f"Processing batch of {len(batch_test_cases)} incomplete runs...")

                # Execute tasks for this batch
                executor = SyncExecutor(
                    generation_fn=rate_limited_sync_run_task,
                    tqdm_bar_format=get_tqdm_progress_bar_formatter("resuming tasks"),
                    max_retries=retries,
                    exit_on_error=False,
                    fallback_return_value=None,
                )

                batch_results, _ = executor.run(batch_test_cases)
                batch_completed_runs = [r for r in batch_results if r is not None]

                total_processed += len(batch_test_cases)
                total_completed += len(batch_completed_runs)

                cursor = body.get("next_cursor")
                if not cursor:
                    break

            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Check if response is HTML (endpoint doesn't exist on old server)
                    content_type = e.response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        # Fetch server version to provide helpful context
                        version_info = ""
                        try:
                            version_resp = self._client.get(
                                "arize_phoenix_version", timeout=timeout
                            )
                            version_info = f" Your current server version is {version_resp.text}."
                        except Exception:
                            pass  # Ignore errors fetching version

                        raise ValueError(
                            "The resume_experiment feature is not available on this "
                            f"Phoenix server. Please upgrade your Phoenix server to "
                            f"use this feature.{version_info}"
                        ) from e
                    # Otherwise it's a real 404 (experiment doesn't exist)
                    raise ValueError(f"Experiment not found: {experiment_id}") from e
                raise

        print("✅ Task runs completed.")

        if total_completed < total_processed:
            print(
                f"⚠️  Warning: Only {total_completed} out of {total_processed} incomplete runs "
                "were completed successfully."
            )

        # Run evaluators if provided
        if evaluators:
            print()  # Add spacing before evaluation output
            self.resume_evaluation(
                experiment_id=experiment_id,
                evaluators=evaluators,
                print_summary=False,  # We'll print our own summary
                timeout=timeout,
                rate_limit_errors=rate_limit_errors,
                retries=retries,
            )

        # Print summary if requested
        if print_summary:
            print("\n" + "=" * 70)
            print("📊 Experiment Resume Summary")
            print("=" * 70)
            print(f"Experiment ID: {experiment['id']}")
            print(f"Incomplete runs processed: {total_processed}")
            print(f"Successfully completed: {total_completed}")
            print("=" * 70 + "\n")

    def resume_evaluation(
        self,
        *,
        experiment_id: str,
        evaluators: ExperimentEvaluators,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        retries: int = 3,
    ) -> None:
        """
        Resume incomplete evaluations for an experiment.

        This method identifies which evaluations have not been completed (either missing or failed)
        and runs the evaluators only for those runs. This is useful for:
        - Recovering from transient evaluator failures
        - Adding new evaluators to completed experiments
        - Completing partially evaluated experiments

        The method processes incomplete evaluations in batches using pagination
        to minimize memory usage.

        Evaluation names are matched to evaluator dict keys. For example,
        if you pass ``{"accuracy": accuracy_fn}``, it will check for and resume any runs
        missing the "accuracy" evaluation.

        .. note::
            Multi-output evaluators (evaluators that return a list/sequence of results) are not
            supported for resume operations. Each evaluator should produce a single evaluation
            result with a name matching the evaluator's key in the dictionary.

        Args:
            experiment_id (str): The ID of the experiment to resume evaluations for.
            evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
                to run. Evaluators can be provided as a dict mapping names to functions,
                or as a list of functions (names will be auto-generated).
            print_summary (bool): Whether to print a summary of evaluation results.
                Defaults to True.
            timeout (Optional[int]): The timeout for evaluation execution in seconds.
                Defaults to 60.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of
                exceptions to adaptively throttle on. Defaults to None.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Raises:
            ValueError: If the experiment is not found or no evaluators are provided.
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            from phoenix.client import Client
            client = Client()

            def accuracy(output, expected):
                return 1.0 if output == expected else 0.0

            # Standard usage: evaluation name matches evaluator key
            client.experiments.resume_evaluation(
                experiment_id="exp_123",
                evaluators={"accuracy": accuracy},
            )
        """
        evaluators_by_name = _evaluators_by_name(evaluators)
        if not evaluators_by_name:
            raise ValueError("Must specify at least one evaluator")

        # Get the experiment metadata
        experiment = self.get(experiment_id=experiment_id)

        # Setup for evaluator execution
        eval_tracer, eval_resource = _get_tracer(
            experiment["project_name"], str(self._client.base_url), dict(self._client.headers)
        )

        print("🔍 Checking for incomplete evaluations...")

        # Build evaluation names list for query - derive from evaluator keys
        evaluation_names_list = list(evaluators_by_name.keys())

        # Process incomplete evaluations in streaming batches
        cursor: Optional[str] = None
        page_size = 50
        total_processed = 0
        total_completed = 0

        while True:
            # Fetch next batch of incomplete evaluations
            params: dict[str, Any] = {"limit": page_size, "evaluation_name": evaluation_names_list}
            if cursor:
                params["cursor"] = cursor

            try:
                response = self._client.get(
                    f"v1/experiments/{experiment_id}/incomplete-evaluations",
                    params=params,
                    timeout=timeout,
                )
                response.raise_for_status()
                body = cast(v1.GetIncompleteEvaluationsResponseBody, response.json())
                batch_incomplete = body["data"]

                if not batch_incomplete:
                    if total_processed == 0:
                        print("✅ No incomplete evaluations found. All evaluations are complete.")
                        return
                    break

                if total_processed == 0:
                    print("🧠 Resuming evaluations...")

                # Build evaluation tasks from incomplete evaluations
                evaluation_tasks = _build_incomplete_evaluation_tasks(
                    batch_incomplete,
                    evaluators_by_name,
                )

                total_processed += len({inc["experiment_run"]["id"] for inc in batch_incomplete})

                if not evaluation_tasks:
                    # No evaluators in this batch match the provided evaluators
                    cursor = body.get("next_cursor")
                    if not cursor:
                        break
                    continue

                print(f"Processing batch of {len(evaluation_tasks)} evaluation tasks...")

                # Execute evaluations using refactored method
                batch_eval_runs = self._run_evaluations(
                    evaluation_tasks,
                    eval_tracer,
                    eval_resource,
                    False,  # dry_run
                    timeout,
                    rate_limit_errors,
                    retries=retries,
                )

                total_completed += len([r for r in batch_eval_runs if r.error is None])

                # Check for next page
                cursor = body.get("next_cursor")
                if not cursor:
                    break

            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Check if response is HTML (endpoint doesn't exist on old server)
                    content_type = e.response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        # Fetch server version to provide helpful context
                        version_info = ""
                        try:
                            version_resp = self._client.get(
                                "arize_phoenix_version", timeout=timeout
                            )
                            version_info = f" Your current server version is {version_resp.text}."
                        except Exception:
                            pass  # Ignore errors fetching version

                        raise ValueError(
                            "The resume_evaluation feature is not available on this "
                            f"Phoenix server. Please upgrade your Phoenix server to "
                            f"use this feature.{version_info}"
                        ) from e
                    # Otherwise it's a real 404 (experiment doesn't exist)
                    raise ValueError(f"Experiment not found: {experiment_id}") from e
                raise

        print("✅ Evaluations completed.")

        if total_completed < total_processed * len(evaluators_by_name):
            print(
                f"⚠️  Warning: Only {total_completed} out of "
                f"{total_processed * len(evaluators_by_name)} incomplete evaluations "
                "were completed successfully."
            )

        # Print summary if requested
        if print_summary:
            print("\n" + "=" * 70)
            print("📊 Evaluation Resume Summary")
            print("=" * 70)
            print(f"Runs processed: {total_processed}")
            print(f"Evaluations completed: {total_completed}")
            print("=" * 70 + "\n")

    def evaluate_experiment(
        self,
        *,
        experiment: RanExperiment,
        evaluators: ExperimentEvaluators,
        dry_run: bool = False,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        retries: int = 3,
    ) -> RanExperiment:
        """
        Run evaluators on a completed experiment.

        An `evaluator` is a synchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - an EvaluationResult dict with optional fields for score, label, explanation and metadata
        - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
        - a `float`, which will be interpreted as a score
        - a `str`, which will be interpreted as a label
        - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

        Args:
            experiment (RanExperiment): The experiment to evaluate, returned from `run_experiment`.
            evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
                used to evaluate the results of the experiment. Evaluators can be provided as a
                dict mapping names to functions, or as a list of functions (names will be
                auto-generated).
            dry_run (bool): Run the evaluation in dry-run mode. When set, evaluation results will
                not be recorded in Phoenix. Defaults to False.
            print_summary (bool): Whether to print a summary of the evaluation results.
                Defaults to True.
            timeout (Optional[int]): The timeout for the evaluation execution in seconds.
                Defaults to 60.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
                to adaptively throttle on.
                Defaults to None.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            RanExperiment: A dictionary containing the evaluation results with the same format
                as run_experiment.

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
        dataset_version_id = experiment["dataset_version_id"]
        experiment_metadata = experiment["experiment_metadata"]

        if experiment_id == DRY_RUN:
            dry_run = True

        if dry_run:
            project_name = None
        else:
            try:
                experiment_response = self._client.get(
                    f"v1/experiments/{experiment_id}", timeout=timeout
                )
                experiment_response.raise_for_status()
                experiment_data = experiment_response.json()["data"]
                project_name = experiment_data.get("project_name")
            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Check if response is HTML (endpoint doesn't exist on old server)
                    content_type = e.response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        raise ValueError(
                            "The resume_evaluation feature is not available on this "
                            "Phoenix server. Please upgrade your Phoenix server to "
                            "use this feature."
                        ) from e
                    # Otherwise it's a real 404 (experiment doesn't exist)
                    raise ValueError(f"Experiment not found: {experiment_id}") from e
                raise

        version_params = {"version_id": dataset_version_id}

        try:
            dataset_info_response = self._client.get(
                f"v1/datasets/{dataset_id}",
                params=version_params,
                timeout=timeout,
            )
            dataset_info_response.raise_for_status()
            dataset_info = dataset_info_response.json()["data"]

            dataset_examples_response = self._client.get(
                f"v1/datasets/{dataset_id}/examples",
                params=version_params,
                timeout=timeout,
            )
            dataset_examples_response.raise_for_status()
            dataset_data = dataset_examples_response.json()["data"]
        except HTTPStatusError:
            raise ValueError(f"Failed to fetch dataset for experiment: {experiment_id}")

        from phoenix.client.resources.datasets import Dataset

        dataset = Dataset(
            dataset_info=dataset_info,
            examples_data=dataset_data,
        )

        eval_tracer, eval_resource = _get_tracer(
            None if dry_run else "evaluators",
            str(self._client.base_url),
            dict(self._client.headers),
        )

        print("🧠 Evaluation started.")
        if dry_run:
            print("🌵️ This is a dry-run evaluation.")

        # Build evaluation tasks
        examples_by_id = {ex["id"]: ex for ex in dataset.examples}
        evaluation_tasks = _build_evaluation_tasks(
            task_runs,
            evaluators_by_name,
            examples_by_id,
        )

        # Run evaluations
        eval_runs = self._run_evaluations(
            evaluation_tasks,
            eval_tracer,
            eval_resource,
            dry_run,
            timeout,
            rate_limit_errors,
            retries=retries,
        )

        all_evaluation_runs = eval_runs
        all_evaluation_runs = experiment["evaluation_runs"] + eval_runs

        ran_experiment: RanExperiment = {
            "experiment_id": experiment_id,
            "dataset_id": dataset_id,
            "dataset_version_id": dataset_version_id,
            "task_runs": task_runs,
            "evaluation_runs": all_evaluation_runs,
            "experiment_metadata": experiment_metadata,
            "project_name": project_name,
        }

        if print_summary:
            evaluators_count = len(evaluators_by_name)
            evaluations_count = 0
            for _er in ran_experiment["evaluation_runs"]:
                _res = _er.result
                if _res is None:
                    continue
                if isinstance(_res, Sequence) and not isinstance(_res, (str, bytes, dict)):
                    evaluations_count += len(_res)  # pyright: ignore[reportUnknownArgumentType]
                else:
                    evaluations_count += 1
            print(
                "Evaluation completed: "
                f"{evaluators_count} evaluator runs, "
                f"{evaluations_count} evaluations"
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
        """
        This function wraps the user task to make it robust to task cancellations.

        This function will be called more than once in the following cases:
            1. The task is cancelled due to an *executor-level* timeout.
              - In the event where the user task has completed, but the timeout cancels the
                POST to the Phoenix server, we will re-run this function with the memoized result,
                regardless of whether the task failed or was successful
            2. The task fails, raises an exception, and is requeued by the executor if there are
                retries remaining
              - This only happens if a timeout did not occur and the error has been persisted to the
                Phoenix server. The Phoenix server allows resubmission of failed tasks. So in this
                case we erase the error from the cache to force a re-run
        """

        example, repetition_number = test_case.example, test_case.repetition_number
        cache_key = (example["id"], repetition_number)

        # Check if we have a cached result
        if cache_key in task_result_cache:
            cached_value = cast(ExperimentRun, task_result_cache[cache_key])
            # we only get to this point if the previous post to the sever was cancelled, so we
            # re-try the post
            if not dry_run:
                try:
                    resp = self._client.post(
                        f"v1/experiments/{experiment['id']}/runs",
                        json=cached_value,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
                except HTTPStatusError as e:
                    if e.response.status_code == 409:
                        pass
                    else:
                        task_result_cache.pop(cache_key, None)
                        raise
            return cached_value

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

        # here we cache the result because the post to the server may be cancelled
        task_result_cache[cache_key] = exp_run

        if not dry_run:
            try:
                resp = self._client.post(
                    f"v1/experiments/{experiment['id']}/runs",
                    json=exp_run,
                    timeout=timeout,
                )
                resp.raise_for_status()
                exp_run = {**exp_run, "id": resp.json()["data"]["id"]}
            except HTTPStatusError as e:
                if e.response.status_code == 409:
                    # Run already exists on server, but our local data is valid
                    pass
                else:
                    task_result_cache.pop(cache_key, None)
                    raise

        # Re-raise exception if task failed
        if error is not None:
            # we can delete the task result from the cache because the result has been
            # successfully submitted to the server, however we will leave the error check in place
            # just in case our assumption is wrong
            task_result_cache.pop(cache_key, None)
            raise error

        return exp_run

    def _run_evaluations(
        self,
        evaluation_tasks: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]],
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
        rate_limit_errors: Optional[RateLimitErrors],
        retries: int = 3,
    ) -> list[ExperimentEvaluationRun]:
        """
        Execute evaluation tasks.

        Args:
            evaluation_tasks: List of (example, run, evaluator) tuples
            tracer: OpenTelemetry tracer
            resource: OpenTelemetry resource
            dry_run: Whether to skip server submission
            timeout: Timeout for evaluations
            rate_limit_errors: Errors to rate limit on

        Returns:
            List of evaluation run results
        """

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        def sync_evaluate_run(
            obj: tuple[v1.DatasetExample, ExperimentRun, Evaluator],
        ) -> list[ExperimentEvaluationRun]:
            example, run, evaluator = obj
            return self._run_single_evaluation_sync(
                example,
                run,
                evaluator,
                tracer,
                resource,
                dry_run,
                timeout,
            )

        rate_limited_sync_evaluate_run = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), rate_limiters, sync_evaluate_run
        )

        # Use sync executor for sync operation
        executor = SyncExecutor(
            generation_fn=rate_limited_sync_evaluate_run,
            max_retries=retries,
            exit_on_error=False,
            fallback_return_value=None,
            tqdm_bar_format=get_tqdm_progress_bar_formatter("running experiment evaluations"),
        )

        eval_runs, _execution_details = executor.run(evaluation_tasks)
        flattened: list[ExperimentEvaluationRun] = []
        for res in eval_runs:
            if res is None:
                continue
            flattened.extend(cast(list[ExperimentEvaluationRun], res))
        return flattened

    def _run_single_evaluation_sync(
        self,
        example: v1.DatasetExample,
        experiment_run: ExperimentRun,
        evaluator: Evaluator,
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
    ) -> list[ExperimentEvaluationRun]:
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
                    example=example,
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

            try:
                eval_input_obj: dict[str, Any] = {
                    "input": jsonify(example.get("input")),
                    "output": jsonify(experiment_run.get("output")),
                    "expected": jsonify(example.get("output")),
                    "example": jsonify(example),
                }
                span.set_attribute(INPUT_VALUE, json.dumps(eval_input_obj, ensure_ascii=False))
                span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            except Exception:
                pass

            try:
                if result is not None:
                    span.set_attribute(
                        OUTPUT_VALUE,
                        json.dumps(jsonify(result), ensure_ascii=False),
                    )
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
            except Exception:
                pass

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

        results_to_submit: list[Optional[EvaluationResult]]
        if result is None:
            results_to_submit = [None]
        elif isinstance(result, Sequence) and not isinstance(result, (str, bytes, dict)):
            results_to_submit = list(result)  # pyright: ignore[reportUnknownArgumentType]
        else:
            results_to_submit = [result]

        eval_runs: list[ExperimentEvaluationRun] = []

        for idx, res in enumerate(results_to_submit):
            if isinstance(res, dict):
                name_from_res = res.get("name")
                eval_name = (
                    name_from_res
                    if isinstance(name_from_res, str)
                    else (
                        evaluator.name
                        if len(results_to_submit) == 1
                        else f"{evaluator.name}-{idx + 1}"
                    )
                )
            else:
                eval_name = (
                    evaluator.name if len(results_to_submit) == 1 else f"{evaluator.name}-{idx + 1}"
                )

            eval_run = ExperimentEvaluationRun(
                experiment_run_id=experiment_run["id"],
                start_time=start_time,
                end_time=end_time,
                name=eval_name,
                annotator_kind=evaluator.kind,
                error=repr(error) if error else None,
                result=res,  # pyright: ignore[reportUnknownArgumentType]
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
                    eval_run = replace(eval_run, id=resp.json()["data"]["id"])  # pyright: ignore[reportUnknownArgumentType]
                except HTTPStatusError as e:
                    logger.warning(
                        f"Failed to submit evaluation result for evaluator '{evaluator.name}': "
                        f"HTTP {e.response.status_code} - {e.response.text}"
                    )
                    # Continue even if evaluation storage fails

            eval_runs.append(eval_run)

        return eval_runs

    def get(
        self,
        *,
        experiment_id: str,
    ) -> Experiment:
        """Get an experiment by ID.

        Args:
            experiment_id (str): The ID of the experiment to retrieve.

        Returns:
            Experiment: The experiment with the specified ID.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the experiment is not found.

        Example::

            from phoenix.client import Client
            client = Client()

            experiment = client.experiments.get(experiment_id="exp_123")
            print(f"Example count: {experiment['example_count']}")
            print(f"Successful runs: {experiment['successful_run_count']}")
        """
        try:
            response = self._client.get(f"v1/experiments/{experiment_id}")
            response.raise_for_status()
            exp_data = response.json()["data"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

        return cast(Experiment, exp_data)

    def delete(
        self,
        *,
        experiment_id: str,
        delete_project: bool = False,
    ) -> None:
        """Delete an experiment by ID.

        Args:
            experiment_id (str): The ID of the experiment to delete.
            delete_project (bool): If True, also delete the project associated with the experiment.
                Defaults to False.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the experiment is not found.

        Example::

            from phoenix.client import Client
            client = Client()

            client.experiments.delete(experiment_id="exp_123")
        """
        try:
            response = self._client.delete(
                f"v1/experiments/{experiment_id}",
                params={"delete_project": delete_project},
            )
            response.raise_for_status()
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

    def _paginate(
        self,
        *,
        dataset_id: str,
        cursor: Optional[str] = None,
        limit: int = 50,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.ListExperimentsResponseBody:
        """
        Internal method to paginate through experiments with cursor-based pagination.

        This is a private method used internally by the list() method to handle pagination.
        Users should use the list() method instead of calling this directly.

        Args:
            dataset_id (str): The ID of the dataset to list experiments for.
            cursor: Cursor for pagination. Use the `next_cursor` from a previous
                response to get the next page. None for the first page.
            limit: Maximum number of experiments to return per page (default: 50).
            timeout: Request timeout in seconds (default: 60).

        Returns:
            Dictionary with pagination response containing:
                - data: List of experiment dictionaries with fields: id, dataset_id,
                  dataset_version_id, repetitions, metadata, project_name, created_at,
                  updated_at, example_count, successful_run_count, failed_run_count,
                  missing_run_count
                - next_cursor: String cursor for next page, or None if no more pages

        Raises:
            httpx.HTTPError: If the API request fails (e.g., invalid cursor, network error).
        """
        url = f"v1/datasets/{dataset_id}/experiments"
        params: dict[str, Any] = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        response = self._client.get(url, params=params, timeout=timeout)
        response.raise_for_status()
        return cast(v1.ListExperimentsResponseBody, response.json())

    def list(
        self,
        *,
        dataset_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[Experiment]:
        """List all experiments for a dataset with automatic pagination handling.

        This method automatically handles pagination behind the scenes and returns
        a simple list of experiments.

        Args:
            dataset_id (str): The ID of the dataset to list experiments for.
            timeout: Request timeout in seconds for each paginated request (default: 60).

        Returns:
            list[Experiment]: A list of all experiments for the dataset.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import Client
            client = Client()

            experiments = client.experiments.list(dataset_id="dataset_123")
            for experiment in experiments:
                print(f"Experiment: {experiment['id']}, Runs: {experiment['successful_run_count']}")
        """
        all_experiments: list[Experiment] = []
        cursor: Optional[str] = None
        while True:
            data = self._paginate(dataset_id=dataset_id, cursor=cursor, timeout=timeout)
            all_experiments.extend(data["data"])

            cursor = data.get("next_cursor")
            if not cursor:
                break
        return all_experiments


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
    - `example`: The dataset `Example` object with all associated fields

    Example:
        Basic usage::

            from phoenix.client import AsyncClient
            client = AsyncClient()
            dataset = await client.datasets.get_dataset(dataset="my-dataset")

            async def my_task(input):
                return f"Hello {input['name']}"

            experiment = await client.experiments.run_experiment(
                dataset=dataset,
                task=my_task,
                experiment_name="greeting-experiment"
            )

        With evaluators::

            async def accuracy_evaluator(output, expected):
                return 1.0 if output == expected['text'] else 0.0

            experiment = await client.experiments.run_experiment(
                dataset=dataset,
                task=my_task,
                evaluators=[accuracy_evaluator],
                experiment_name="evaluated-experiment"
            )

        Using dynamic binding for tasks::

            async def my_task(input, metadata, expected):
                # Task can access multiple fields from the dataset example
                context = metadata.get("context", "")
                return f"Context: {context}, Input: {input}, Expected: {expected}"

        Using dynamic binding for evaluators::

            async def my_evaluator(output, input, expected, metadata):
                # Evaluator can access task output and example fields
                score = await calculate_similarity(output, expected)
                return {"score": score, "label": "pass" if score > 0.8 else "fail"}
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._base_url = str(client.base_url)
        self._headers = dict(client.headers)

    def get_dataset_experiments_url(self, dataset_id: str) -> str:
        return urljoin(str(self._client.base_url), f"datasets/{dataset_id}/experiments")

    def get_experiment_url(self, dataset_id: str, experiment_id: str) -> str:
        return urljoin(
            str(self._client.base_url),
            f"datasets/{dataset_id}/compare?experimentId={experiment_id}",
        )

    async def create(
        self,
        *,
        dataset_id: str,
        dataset_version_id: Optional[str] = None,
        experiment_name: Optional[str] = None,
        experiment_description: Optional[str] = None,
        experiment_metadata: Optional[Mapping[str, Any]] = None,
        splits: Optional[Sequence[str]] = None,
        repetitions: int = 1,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Experiment:
        """Create a new experiment without running it (async version).

        This method creates an experiment record in the Phoenix database but does not
        execute any tasks. Use `resume_experiment` to run tasks on the created experiment.

        Args:
            dataset_id (str): The ID of the dataset on which the experiment will be run.
            dataset_version_id (Optional[str]): The ID of the dataset version to use. If not
                provided, the latest version will be used. Defaults to None.
            experiment_name (Optional[str]): The name of the experiment. Defaults to None.
            experiment_description (Optional[str]): A description of the experiment. Defaults to
                None.
            experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
                experiment. Defaults to None.
            splits (Optional[Sequence[str]]): List of dataset split identifiers (IDs or names)
                to filter by. Defaults to None.
            repetitions (int): The number of times the task will be run on each example.
                Defaults to 1.
            timeout (Optional[int]): The timeout for the request in seconds. Defaults to 60.

        Returns:
            Experiment: The newly created experiment.

        Raises:
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            experiment = await async_client.experiments.create(
                dataset_id="dataset_123",
                experiment_name="my-experiment",
                experiment_description="Testing my task",
                repetitions=3,
            )
            print(f"Created experiment with ID: {experiment['id']}")

            # Later, run the experiment
            await async_client.experiments.resume_experiment(
                experiment_id=experiment["id"],
                task=my_task,
            )
        """
        _validate_repetitions(repetitions)

        payload: dict[str, Any] = {
            "repetitions": repetitions,
        }

        if experiment_name and experiment_name.strip():
            payload["name"] = experiment_name.strip()

        if experiment_description and experiment_description.strip():
            payload["description"] = experiment_description.strip()

        if experiment_metadata:
            payload["metadata"] = experiment_metadata

        if dataset_version_id and dataset_version_id.strip():
            payload["version_id"] = dataset_version_id.strip()

        if splits:
            payload["splits"] = list(splits)

        experiment_response = await self._client.post(
            f"v1/datasets/{dataset_id}/experiments",
            json=payload,
            timeout=timeout,
        )
        experiment_response.raise_for_status()
        exp_json = experiment_response.json()["data"]
        return cast(Experiment, exp_json)

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
        repetitions: int = 1,
        retries: int = 3,
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

        - an EvaluationResult dict with optional fields for score, label, explanation and metadata
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
        - `example`: The dataset `Example` object with all associated fields

        Args:
            dataset (Dataset): The dataset on which to run the experiment.
            task (ExperimentTask): The task to run on each example in the dataset.
            evaluators (Optional[ExperimentEvaluators]): A single evaluator or sequence of
                evaluators used to evaluate the results of the experiment. Evaluators can be
                provided as a dict mapping names to functions, or as a list of functions (names
                will be auto-generated). Defaults to None.
            experiment_name (Optional[str]): The name of the experiment. Defaults to None.
            experiment_description (Optional[str]): A description of the experiment. Defaults to
                None.
            experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
                experiment. Defaults to None.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions to
                adaptively throttle on. Defaults to None.
            dry_run (Union[bool, int]): Run the experiment in dry-run mode. When set,
                experiment results will not be recorded in Phoenix. If True, the experiment will run
                on a random
                dataset example. If an integer, the experiment will run on a random sample of the
                dataset examples of the given size. Defaults to False.
            print_summary (bool): Whether to print a summary of the experiment and evaluation
                results. Defaults to True.
            concurrency (int): Specifies the concurrency for task execution. Defaults to 3.
            timeout (Optional[int]): The timeout for the task execution in seconds. Use this to run
                longer tasks to avoid re-queuing the same task multiple times. Defaults to 60.
            repetitions (int): The number of times the task will be run on each example.
                Defaults to 1.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            RanExperiment: A dictionary containing the experiment results.

        Raises:
            ValueError: If dataset format is invalid or has no examples.
            httpx.HTTPStatusError: If the API returns an error response.
        """
        task_signature = inspect.signature(task)
        _validate_task_signature(task_signature)

        if not dataset.examples:
            raise ValueError(f"Dataset has no examples: {dataset.id=}, {dataset.version_id=}")

        _validate_repetitions(repetitions)

        if not dry_run:
            experiment = await self.create(
                dataset_id=dataset.id,
                dataset_version_id=dataset.version_id,
                experiment_name=experiment_name,
                experiment_description=experiment_description,
                experiment_metadata=experiment_metadata,
                splits=dataset._filtered_split_names,  # pyright: ignore[reportPrivateUsage]
                repetitions=repetitions,
                timeout=timeout,
            )
        else:
            experiment = Experiment(
                id=DRY_RUN,
                dataset_id=dataset.id,
                dataset_version_id=dataset.version_id,
                repetitions=repetitions,
                metadata={},
                project_name=None,
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
                example_count=0,
                successful_run_count=0,
                failed_run_count=0,
                missing_run_count=0,
            )

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
            max_retries=retries,
            exit_on_error=False,
            fallback_return_value=None,
            timeout=timeout,
        )

        task_runs, _execution_details = await executor.execute(test_cases)
        print("✅ Task runs completed.")

        # Get the final state of runs from the database if not dry run
        if not dry_run:
            task_runs = await self._get_all_experiment_runs(experiment_id=experiment["id"])

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
            "dataset_version_id": dataset.version_id,
            "task_runs": task_runs_list,
            "evaluation_runs": [],
            "experiment_metadata": experiment.get("metadata", {}),
            "project_name": experiment.get("project_name"),
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
                retries=retries,
            )
            evaluation_runs_list = eval_result["evaluation_runs"]

            ran_experiment["evaluation_runs"] = evaluation_runs_list

        if print_summary:
            task_runs_count = len(ran_experiment["task_runs"])
            evaluators_count = 0
            if evaluators is not None:
                try:
                    evaluators_count = len(_evaluators_by_name(evaluators))
                except Exception:
                    evaluators_count = 0
            evaluations_count = 0
            for _er in ran_experiment["evaluation_runs"]:
                _res = _er.result
                if _res is None:
                    continue
                if isinstance(_res, Sequence) and not isinstance(_res, (str, bytes, dict)):
                    evaluations_count += len(_res)  # pyright: ignore[reportUnknownArgumentType]
                else:
                    evaluations_count += 1
            print(
                "Experiment completed: "
                f"{task_runs_count} task runs, "
                f"{evaluators_count} evaluator runs, "
                f"{evaluations_count} evaluations"
            )

        return ran_experiment

    async def _get_all_experiment_runs(
        self,
        *,
        experiment_id: str,
        page_size: int = 50,
    ) -> list[ExperimentRun]:
        """
        Fetch all experiment runs using pagination to handle large datasets.

        Args:
            experiment_id (str): The ID of the experiment.
            page_size (int): Number of runs to fetch per page. Defaults to 50.

        Returns:
            list[ExperimentRun]: List of all experiment runs.
        """
        all_runs: list[ExperimentRun] = []
        cursor: Optional[str] = None

        while True:
            params: dict[str, Any] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor

            try:
                response = await self._client.get(
                    f"v1/experiments/{experiment_id}/runs",
                    params=params,
                )
                response.raise_for_status()
                body = cast(v1.ListExperimentRunsResponseBody, response.json())
                all_runs.extend(body["data"])

                # Check if there are more pages
                cursor = body.get("next_cursor")
                if not cursor:
                    break

            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Experiment doesn't exist - treat as empty result for robustness
                    break
                else:
                    raise

        return all_runs

    async def get_experiment(self, *, experiment_id: str) -> RanExperiment:
        """
        Get a completed experiment by ID (async version).

        This method retrieves a completed experiment with all its task runs and evaluation runs,
        returning a RanExperiment object that can be used with evaluate_experiment to run
        additional evaluations.

        Args:
            experiment_id (str): The ID of the experiment to retrieve.

        Returns:
            RanExperiment: A RanExperiment object containing the experiment data, task runs,
                and evaluation runs.

        Raises:
            ValueError: If the experiment is not found.
            httpx.HTTPStatusError: If the API returns an error response.

        Examples::

            client = AsyncClient()
            experiment = await client.experiments.get_experiment(experiment_id="123")
            await client.experiments.evaluate_experiment(
                experiment=experiment,
                evaluators=[
                    correctness,
                ],
                print_summary=True,
            )
        """
        # Get experiment metadata using existing endpoint
        try:
            experiment_response = await self._client.get(f"v1/experiments/{experiment_id}")
            experiment_response.raise_for_status()
            experiment_data = experiment_response.json()["data"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

        try:
            runs_response = await self._client.get(f"v1/experiments/{experiment_id}/runs")
            runs_response.raise_for_status()
            runs_data = runs_response.json()["data"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                # Experiment exists but has no runs
                runs_data = []
            else:
                raise

        try:
            json_response = await self._client.get(f"v1/experiments/{experiment_id}/json")
            json_response.raise_for_status()
            json_data = json_response.json()
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                # Experiment exists but has no runs
                json_data = []
            else:
                raise

        json_lookup = {}
        for record in json_data:  # pyright: ignore [reportUnknownVariableType]
            key = (record["example_id"], record["repetition_number"])  # pyright: ignore [reportUnknownMemberType, reportUnknownVariableType]
            json_lookup[key] = record

        task_runs: list[ExperimentRun] = []
        evaluation_runs: list[ExperimentEvaluationRun] = []

        for run_data in runs_data:  # pyright: ignore [reportUnknownVariableType]
            task_run: ExperimentRun = cast(ExperimentRun, run_data)  # pyright: ignore [reportUnknownArgumentType]
            task_runs.append(task_run)

            lookup_key = (run_data["dataset_example_id"], run_data["repetition_number"])  # pyright: ignore [reportUnknownMemberType, reportUnknownVariableType]
            json_record = json_lookup.get(lookup_key)  # pyright: ignore [reportUnknownVariableType, reportUnknownMemberType]
            if not json_record:
                continue

            # Create evaluation runs from annotations if present
            for annotation in json_record.get("annotations", []):  # pyright: ignore [reportUnknownMemberType, reportUnknownVariableType]
                eval_result = None
                if (
                    annotation.get("label") is not None  # pyright: ignore [reportUnknownMemberType]
                    or annotation.get("score") is not None  # pyright: ignore [reportUnknownMemberType]
                    or annotation.get("explanation") is not None  # pyright: ignore [reportUnknownMemberType]
                ):
                    eval_result = cast(
                        EvaluationResult,
                        {  # pyright: ignore [reportUnknownVariableType]
                            "label": annotation.get("label"),  # pyright: ignore [reportUnknownMemberType]
                            "score": annotation.get("score"),  # pyright: ignore [reportUnknownMemberType]
                            "explanation": annotation.get("explanation"),  # pyright: ignore [reportUnknownMemberType]
                        },
                    )

                if eval_result is not None:
                    eval_run = ExperimentEvaluationRun(
                        id=f"ExperimentEvaluation:{len(evaluation_runs) + 1}",  # Generate temp ID
                        experiment_run_id=run_data["id"],  # pyright: ignore [reportUnknownArgumentType]
                        start_time=datetime.fromisoformat(annotation["start_time"]),  # pyright: ignore [reportUnknownArgumentType]
                        end_time=datetime.fromisoformat(annotation["end_time"]),  # pyright: ignore [reportUnknownArgumentType]
                        name=annotation["name"],  # pyright: ignore [reportUnknownArgumentType]
                        annotator_kind=annotation["annotator_kind"],  # pyright: ignore [reportUnknownArgumentType]
                        error=annotation.get("error"),  # pyright: ignore [reportUnknownMemberType, reportUnknownArgumentType]
                        result=eval_result,  # pyright: ignore [reportArgumentType]
                        trace_id=annotation.get("trace_id"),  # pyright: ignore [reportUnknownMemberType, reportUnknownArgumentType]
                        metadata=annotation.get("metadata", {}),  # pyright: ignore [reportUnknownMemberType, reportUnknownArgumentType]
                    )
                    evaluation_runs.append(eval_run)

        ran_experiment: RanExperiment = {
            "experiment_id": experiment_id,
            "dataset_id": experiment_data["dataset_id"],
            "dataset_version_id": experiment_data["dataset_version_id"],
            "task_runs": task_runs,
            "evaluation_runs": evaluation_runs,
            "experiment_metadata": experiment_data.get("metadata", {}),
            "project_name": experiment_data.get("project_name"),
        }

        return ran_experiment

    async def resume_experiment(
        self,
        *,
        experiment_id: str,
        task: ExperimentTask,
        evaluators: Optional[ExperimentEvaluators] = None,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        concurrency: int = 3,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        retries: int = 3,
    ) -> None:
        """
        Resume an incomplete experiment by running only the missing or failed runs.

        This method identifies which (example, repetition) pairs have not been completed
        (either missing or failed) and re-runs the task only for those pairs. Optionally,
        evaluators can be run on the completed runs after task execution.

        The method processes incomplete runs in batches using pagination to minimize memory usage.

        .. note::
            Multi-output evaluators (evaluators that return a list/sequence of results) are not
            supported for resume operations. Each evaluator should produce a single evaluation
            result with a name matching the evaluator's key in the dictionary.

        Args:
            experiment_id (str): The ID of the experiment to resume.
            task (ExperimentTask): The task to run on incomplete examples.
            evaluators (Optional[ExperimentEvaluators]): Optional evaluators to run on completed
                task runs. Evaluators can be provided as a dict mapping names to functions, or as
                a list of functions (names will be auto-generated). Defaults to None.
            print_summary (bool): Whether to print a summary of the results. Defaults to True.
            timeout (Optional[int]): The timeout for task execution in seconds. Defaults to 60.
            concurrency (int): The number of concurrent tasks to run. Defaults to 3.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
                to adaptively throttle on. Defaults to None.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            None

        Raises:
            ValueError: If the experiment is not found.
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            client = AsyncClient()

            # Resume an interrupted experiment
            await client.experiments.resume_experiment(
                experiment_id="exp_123",
                task=my_async_task,
            )

            # Resume with evaluators
            await client.experiments.resume_experiment(
                experiment_id="exp_123",
                task=my_async_task,
                evaluators={"quality": my_evaluator},
            )
        """
        task_signature = inspect.signature(task)
        _validate_task_signature(task_signature)

        # Get the experiment metadata
        experiment = await self.get(experiment_id=experiment_id)

        # Setup for task execution
        tracer, resource = _get_tracer(
            experiment["project_name"], str(self._client.base_url), dict(self._client.headers)
        )
        root_span_name = f"Task: {get_func_name(task)}"
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
                False,  # dry_run
                timeout,
                task_result_cache,
            )

        rate_limited_async_run_task = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), rate_limiters, async_run_task
        )

        # Check experiment status using counts from the experiment response
        print("🔍 Checking for incomplete runs...")
        total_expected = experiment["example_count"] * experiment["repetitions"]
        incomplete_count = total_expected - experiment["successful_run_count"]

        if incomplete_count == 0:
            print("✅ No incomplete runs found. Experiment is already complete.")
            return None

        print(f"🧪 Resuming experiment with {incomplete_count} incomplete runs...")

        dataset_experiments_url = self.get_dataset_experiments_url(
            dataset_id=experiment["dataset_id"]
        )
        experiment_compare_url = self.get_experiment_url(
            dataset_id=experiment["dataset_id"],
            experiment_id=experiment["id"],
        )
        print(f"📺 View dataset experiments: {dataset_experiments_url}")
        print(f"🔗 View this experiment: {experiment_compare_url}")

        # Process incomplete runs in streaming batches
        cursor: Optional[str] = None
        page_size = 100
        total_processed = 0
        total_completed = 0

        while True:
            # Fetch next batch of incomplete runs
            params: dict[str, Any] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor

            try:
                response = await self._client.get(
                    f"v1/experiments/{experiment_id}/incomplete-runs",
                    params=params,
                    timeout=timeout,
                )
                response.raise_for_status()
                body = cast(v1.GetIncompleteExperimentRunsResponseBody, response.json())
                batch_incomplete = body["data"]

                if not batch_incomplete:
                    break

                # Build test cases from this batch
                batch_test_cases: list[TestCase] = []
                for incomplete in batch_incomplete:
                    example_data = incomplete["dataset_example"]
                    for rep in incomplete["repetition_numbers"]:
                        batch_test_cases.append(
                            TestCase(example=example_data, repetition_number=rep)
                        )

                print(f"Processing batch of {len(batch_test_cases)} incomplete runs...")

                # Execute tasks for this batch
                executor = AsyncExecutor(
                    generation_fn=rate_limited_async_run_task,
                    concurrency=concurrency,
                    tqdm_bar_format=get_tqdm_progress_bar_formatter("resuming tasks"),
                    max_retries=retries,
                    exit_on_error=False,
                    fallback_return_value=None,
                    timeout=timeout,
                )

                batch_results, _ = await executor.execute(batch_test_cases)
                batch_completed_runs = [r for r in batch_results if r is not None]

                total_processed += len(batch_test_cases)
                total_completed += len(batch_completed_runs)

                cursor = body.get("next_cursor")
                if not cursor:
                    break

            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Check if response is HTML (endpoint doesn't exist on old server)
                    content_type = e.response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        # Fetch server version to provide helpful context
                        version_info = ""
                        try:
                            version_resp = await self._client.get(
                                "arize_phoenix_version", timeout=timeout
                            )
                            version_info = f" Your current server version is {version_resp.text}."
                        except Exception:
                            pass  # Ignore errors fetching version

                        raise ValueError(
                            "The resume_experiment feature is not available on this "
                            f"Phoenix server. Please upgrade your Phoenix server to "
                            f"use this feature.{version_info}"
                        ) from e
                    # Otherwise it's a real 404 (experiment doesn't exist)
                    raise ValueError(f"Experiment not found: {experiment_id}") from e
                raise

        print("✅ Task runs completed.")

        if total_completed < total_processed:
            print(
                f"⚠️  Warning: Only {total_completed} out of {total_processed} incomplete runs "
                "were completed successfully."
            )

        # Run evaluators if provided
        if evaluators:
            print()  # Add spacing before evaluation output
            await self.resume_evaluation(
                experiment_id=experiment_id,
                evaluators=evaluators,
                print_summary=False,  # We'll print our own summary
                timeout=timeout,
                concurrency=concurrency,
                rate_limit_errors=rate_limit_errors,
                retries=retries,
            )

        # Print summary if requested
        if print_summary:
            print("\n" + "=" * 70)
            print("📊 Experiment Resume Summary")
            print("=" * 70)
            print(f"Experiment ID: {experiment['id']}")
            print(f"Incomplete runs processed: {total_processed}")
            print(f"Successfully completed: {total_completed}")
            print("=" * 70 + "\n")

    async def resume_evaluation(
        self,
        *,
        experiment_id: str,
        evaluators: ExperimentEvaluators,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        concurrency: int = 3,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        retries: int = 3,
    ) -> None:
        """
        Resume incomplete evaluations for an experiment (async version).

        This method identifies which evaluations have not been completed (either missing or failed)
        and runs the evaluators only for those runs. This is useful for:
        - Recovering from transient evaluator failures
        - Adding new evaluators to completed experiments
        - Completing partially evaluated experiments

        The method processes incomplete evaluations in batches using pagination
        to minimize memory usage.

        Evaluation names are matched to evaluator dict keys. For example,
        if you pass ``{"accuracy": accuracy_fn}``, it will check for and resume any runs
        missing the "accuracy" evaluation.

        .. note::
            Multi-output evaluators (evaluators that return a list/sequence of results) are not
            supported for resume operations. Each evaluator should produce a single evaluation
            result with a name matching the evaluator's key in the dictionary.

        Args:
            experiment_id (str): The ID of the experiment to resume evaluations for.
            evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
                to run. Evaluators can be provided as a dict mapping names to functions,
                or as a list of functions (names will be auto-generated).
            print_summary (bool): Whether to print a summary of evaluation results.
                Defaults to True.
            timeout (Optional[int]): The timeout for evaluation execution in seconds.
                Defaults to 60.
            concurrency (int): The number of concurrent evaluations to run. Defaults to 3.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of
                exceptions to adaptively throttle on. Defaults to None.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Raises:
            ValueError: If the experiment is not found or no evaluators are provided.
            httpx.HTTPStatusError: If the API returns an error response.

        Example::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            async def accuracy(output, expected):
                return 1.0 if output == expected else 0.0

            # Standard usage: evaluation name matches evaluator key
            await client.experiments.resume_evaluation(
                experiment_id="exp_123",
                evaluators={"accuracy": accuracy},
            )
        """
        evaluators_by_name = _evaluators_by_name(evaluators)
        if not evaluators_by_name:
            raise ValueError("Must specify at least one evaluator")

        # Get the experiment metadata
        experiment = await self.get(experiment_id=experiment_id)

        # Setup for evaluator execution
        eval_tracer, eval_resource = _get_tracer(
            experiment["project_name"], str(self._client.base_url), dict(self._client.headers)
        )

        print("🔍 Checking for incomplete evaluations...")

        # Build evaluation names list for query - derive from evaluator keys
        evaluation_names_list = list(evaluators_by_name.keys())

        # Process incomplete evaluations in streaming batches
        cursor: Optional[str] = None
        page_size = 100
        total_processed = 0
        total_completed = 0

        while True:
            # Fetch next batch of incomplete evaluations
            params: dict[str, Any] = {"limit": page_size, "evaluation_name": evaluation_names_list}
            if cursor:
                params["cursor"] = cursor

            try:
                response = await self._client.get(
                    f"v1/experiments/{experiment_id}/incomplete-evaluations",
                    params=params,
                    timeout=timeout,
                )
                response.raise_for_status()
                body = cast(v1.GetIncompleteEvaluationsResponseBody, response.json())
                batch_incomplete = body["data"]

                if not batch_incomplete:
                    if total_processed == 0:
                        print("✅ No incomplete evaluations found. All evaluations are complete.")
                        return
                    break

                if total_processed == 0:
                    print("🧠 Resuming evaluations...")

                # Build evaluation tasks from incomplete evaluations
                evaluation_tasks = _build_incomplete_evaluation_tasks(
                    batch_incomplete,
                    evaluators_by_name,
                )

                total_processed += len({inc["experiment_run"]["id"] for inc in batch_incomplete})

                if not evaluation_tasks:
                    # No evaluators in this batch match the provided evaluators
                    cursor = body.get("next_cursor")
                    if not cursor:
                        break
                    continue

                print(f"Processing batch of {len(evaluation_tasks)} evaluation tasks...")

                # Execute evaluations using refactored method
                batch_eval_runs = await self._run_evaluations(
                    evaluation_tasks,
                    eval_tracer,
                    eval_resource,
                    False,  # dry_run
                    timeout,
                    rate_limit_errors,
                    concurrency,
                    retries=retries,
                )

                total_completed += len([r for r in batch_eval_runs if r.error is None])

                # Check for next page
                cursor = body.get("next_cursor")
                if not cursor:
                    break

            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Check if response is HTML (endpoint doesn't exist on old server)
                    content_type = e.response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        # Fetch server version to provide helpful context
                        version_info = ""
                        try:
                            version_resp = await self._client.get(
                                "arize_phoenix_version", timeout=timeout
                            )
                            version_info = f" Your current server version is {version_resp.text}."
                        except Exception:
                            pass  # Ignore errors fetching version

                        raise ValueError(
                            "The resume_evaluation feature is not available on this "
                            f"Phoenix server. Please upgrade your Phoenix server to "
                            f"use this feature.{version_info}"
                        ) from e
                    # Otherwise it's a real 404 (experiment doesn't exist)
                    raise ValueError(f"Experiment not found: {experiment_id}") from e
                raise

        print("✅ Evaluations completed.")

        if total_completed < total_processed * len(evaluators_by_name):
            print(
                f"⚠️  Warning: Only {total_completed} out of "
                f"{total_processed * len(evaluators_by_name)} incomplete evaluations "
                "were completed successfully."
            )

        # Print summary if requested
        if print_summary:
            print("\n" + "=" * 70)
            print("📊 Evaluation Resume Summary")
            print("=" * 70)
            print(f"Runs processed: {total_processed}")
            print(f"Evaluations completed: {total_completed}")
            print("=" * 70 + "\n")

    async def evaluate_experiment(
        self,
        *,
        experiment: RanExperiment,
        evaluators: ExperimentEvaluators,
        dry_run: bool = False,
        print_summary: bool = True,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
        concurrency: int = 3,
        rate_limit_errors: Optional[RateLimitErrors] = None,
        retries: int = 3,
    ) -> RanExperiment:
        """
        Run evaluators on a completed experiment.

        An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
        result object, which can take any of the following forms:

        - an EvaluationResult dict with optional fields for score, label, explanation and metadata
        - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
        - a `float`, which will be interpreted as a score
        - a `str`, which will be interpreted as a label
        - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

        Args:
            experiment (RanExperiment): The experiment to evaluate, returned from `run_experiment`.
            evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
                used to evaluate the results of the experiment. Evaluators can be provided as a
                dict mapping names to functions, or as a list of functions (names will be
                auto-generated).
            dry_run (bool): Run the evaluation in dry-run mode. When set, evaluation results will
                not be recorded in Phoenix. Defaults to False.
            print_summary (bool): Whether to print a summary of the evaluation results.
                Defaults to True.
            timeout (Optional[int]): The timeout for the evaluation execution in seconds.
                Defaults to 60.
            concurrency (int): Specifies the concurrency for evaluation execution. Defaults to 3.
            rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
                to adaptively throttle on.
                Defaults to None.
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            RanExperiment: A dictionary containing the evaluation results with the same format
                as run_experiment.

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
        dataset_version_id = experiment["dataset_version_id"]
        experiment_metadata = experiment["experiment_metadata"]

        if experiment_id == DRY_RUN:
            dry_run = True

        if dry_run:
            project_name = None
        else:
            try:
                experiment_response = await self._client.get(
                    f"v1/experiments/{experiment_id}", timeout=timeout
                )
                experiment_response.raise_for_status()
                experiment_data = experiment_response.json()["data"]
                project_name = experiment_data.get("project_name")
            except HTTPStatusError as e:
                if e.response.status_code == 404:
                    # Check if response is HTML (endpoint doesn't exist on old server)
                    content_type = e.response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        raise ValueError(
                            "The resume_evaluation feature is not available on this "
                            "Phoenix server. Please upgrade your Phoenix server to "
                            "use this feature."
                        ) from e
                    # Otherwise it's a real 404 (experiment doesn't exist)
                    raise ValueError(f"Experiment not found: {experiment_id}") from e
                raise

        version_params = {"version_id": dataset_version_id}

        try:
            dataset_info_response = await self._client.get(
                f"v1/datasets/{dataset_id}",
                params=version_params,
                timeout=timeout,
            )
            dataset_info_response.raise_for_status()
            dataset_info = dataset_info_response.json()["data"]

            dataset_examples_response = await self._client.get(
                f"v1/datasets/{dataset_id}/examples",
                params=version_params,
                timeout=timeout,
            )
            dataset_examples_response.raise_for_status()
            dataset_data = dataset_examples_response.json()["data"]
        except HTTPStatusError:
            raise ValueError(f"Failed to fetch dataset for experiment: {experiment_id}")

        from phoenix.client.resources.datasets import Dataset

        dataset = Dataset(
            dataset_info=dataset_info,
            examples_data=dataset_data,
        )

        eval_tracer, eval_resource = _get_tracer(
            None if dry_run else "evaluators",
            str(self._client.base_url),
            dict(self._client.headers),
        )

        print("🧠 Evaluation started.")
        if dry_run:
            print("🌵️ This is a dry-run evaluation.")

        # Build evaluation tasks
        examples_by_id = {ex["id"]: ex for ex in dataset.examples}
        evaluation_tasks = _build_evaluation_tasks(
            task_runs,
            evaluators_by_name,
            examples_by_id,
        )

        # Run evaluations
        eval_runs = await self._run_evaluations(
            evaluation_tasks,
            eval_tracer,
            eval_resource,
            dry_run,
            timeout,
            rate_limit_errors,
            concurrency,
            retries=retries,
        )

        all_evaluation_runs = eval_runs
        all_evaluation_runs = experiment["evaluation_runs"] + eval_runs

        ran_experiment: RanExperiment = {
            "experiment_id": experiment_id,
            "dataset_id": dataset_id,
            "dataset_version_id": dataset_version_id,
            "task_runs": task_runs,
            "evaluation_runs": all_evaluation_runs,
            "experiment_metadata": experiment_metadata,
            "project_name": project_name,
        }

        if print_summary:
            evaluators_count = len(evaluators_by_name)
            evaluations_count = 0
            for _er in ran_experiment["evaluation_runs"]:
                _res = _er.result
                if _res is None:
                    continue
                if isinstance(_res, Sequence) and not isinstance(_res, (str, bytes, dict)):
                    evaluations_count += len(_res)  # pyright: ignore[reportUnknownArgumentType]
                else:
                    evaluations_count += 1
            print(
                "Evaluation completed: "
                f"{evaluators_count} evaluators, "
                f"{evaluations_count} evaluations"
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
        """
        This function wraps the user task to make it robust to task cancellations.

        This function will be called more than once in the following cases:
            1. The task is cancelled due to an *executor-level* timeout.
              - In the event where the user task has completed, but the timeout cancels the
                POST to the Phoenix server, we will re-run this function with the memoized result,
                regardless of whether the task failed or was successful
            2. The task fails, raises an exception, and is requeued by the executor if there are
                retries remaining
              - This only happens if a timeout did not occur and the error has been persisted to the
                Phoenix server. The Phoenix server allows resubmission of failed tasks. So in this
                case we erase the error from the cache to force a re-run
        """

        example, repetition_number = test_case.example, test_case.repetition_number
        cache_key = (example["id"], repetition_number)

        # Check if we have a cached result
        if cache_key in task_result_cache:
            cached_value = cast(ExperimentRun, task_result_cache[cache_key])
            # we only get to this point if the previous post to the sever was cancelled, so we
            # re-try the post
            if not dry_run:
                try:
                    resp = await self._client.post(
                        f"v1/experiments/{experiment['id']}/runs",
                        json=cached_value,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
                except HTTPStatusError as e:
                    if e.response.status_code == 409:
                        pass
                    else:
                        task_result_cache.pop(cache_key, None)
                        raise
            return cached_value

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

        # here we cache the result because the post to the server may be cancelled
        task_result_cache[cache_key] = exp_run

        if not dry_run:
            try:
                resp = await self._client.post(
                    f"v1/experiments/{experiment['id']}/runs",
                    json=exp_run,
                    timeout=timeout,
                )
                resp.raise_for_status()
                exp_run = {**exp_run, "id": resp.json()["data"]["id"]}
            except HTTPStatusError as e:
                if e.response.status_code == 409:
                    # Run already exists on server, but our local data is valid
                    pass
                else:
                    task_result_cache.pop(cache_key, None)
                    raise

        # Re-raise exception if task failed
        if error is not None:
            # we can delete the task result from the cache because the result has been
            # successfully submitted to the server, however we will leave the error check in place
            # just in case our assumption is wrong
            task_result_cache.pop(cache_key, None)
            raise error

        return exp_run

    async def _run_evaluations(
        self,
        evaluation_tasks: list[tuple[v1.DatasetExample, ExperimentRun, Evaluator]],
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
        rate_limit_errors: Optional[RateLimitErrors],
        concurrency: int,
        retries: int = 3,
    ) -> list[ExperimentEvaluationRun]:
        """
        Execute evaluation tasks asynchronously.

        Args:
            evaluation_tasks: List of (example, run, evaluator) tuples
            tracer: OpenTelemetry tracer
            resource: OpenTelemetry resource
            dry_run: Whether to skip server submission
            timeout: Timeout for evaluations
            rate_limit_errors: Errors to rate limit on
            concurrency: Number of concurrent evaluations
            retries (int): The number of times to retry a task if it fails. Defaults to 3.

        Returns:
            List of evaluation run results
        """

        # Setup rate limiting
        errors: tuple[type[BaseException], ...]
        if not isinstance(rate_limit_errors, Sequence):
            errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
        else:
            errors = tuple(filter(None, rate_limit_errors))
        rate_limiters = [RateLimiter(rate_limit_error=error) for error in errors]

        async def async_evaluate_run(
            obj: tuple[v1.DatasetExample, ExperimentRun, Evaluator],
        ) -> list[ExperimentEvaluationRun]:
            example, run, evaluator = obj
            return await self._run_single_evaluation_async(
                example,
                run,
                evaluator,
                tracer,
                resource,
                dry_run,
                timeout,
            )

        rate_limited_async_evaluate_run = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), rate_limiters, async_evaluate_run
        )

        executor = AsyncExecutor(
            generation_fn=rate_limited_async_evaluate_run,
            concurrency=concurrency,
            tqdm_bar_format=get_tqdm_progress_bar_formatter("running experiment evaluations"),
            max_retries=retries,
            exit_on_error=False,
            fallback_return_value=None,
            timeout=timeout,
        )

        eval_runs, _execution_details = await executor.execute(evaluation_tasks)
        flattened: list[ExperimentEvaluationRun] = []
        for res in eval_runs:
            if res is None:
                continue
            flattened.extend(cast(list[ExperimentEvaluationRun], res))
        return flattened

    async def _run_single_evaluation_async(
        self,
        example: v1.DatasetExample,
        experiment_run: ExperimentRun,
        evaluator: Evaluator,
        tracer: Tracer,
        resource: Resource,
        dry_run: bool,
        timeout: Optional[int],
    ) -> list[ExperimentEvaluationRun]:
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
                result = await evaluator.async_evaluate(
                    output=experiment_run["output"],
                    expected=example["output"],
                    reference=example["output"],
                    input=example["input"],
                    metadata=example["metadata"],
                    example=example,
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

            try:
                eval_input_obj: dict[str, Any] = {
                    "input": jsonify(example.get("input")),
                    "output": jsonify(experiment_run.get("output")),
                    "expected": jsonify(example.get("output")),
                    "example": jsonify(example),
                }
                span.set_attribute(INPUT_VALUE, json.dumps(eval_input_obj, ensure_ascii=False))
                span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            except Exception:
                pass

            try:
                if result is not None:
                    span.set_attribute(
                        OUTPUT_VALUE,
                        json.dumps(jsonify(result), ensure_ascii=False),
                    )
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
            except Exception:
                pass

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

        results_to_submit: list[Optional[EvaluationResult]]
        if result is None:
            results_to_submit = [None]
        elif isinstance(result, Sequence) and not isinstance(result, (str, bytes, dict)):
            results_to_submit = list(result)  # pyright: ignore[reportUnknownArgumentType]
        else:
            results_to_submit = [result]

        eval_runs: list[ExperimentEvaluationRun] = []

        for idx, res in enumerate(results_to_submit):
            if isinstance(res, dict):
                name_from_res = res.get("name")
                eval_name = (
                    name_from_res
                    if isinstance(name_from_res, str)
                    else (
                        evaluator.name
                        if len(results_to_submit) == 1
                        else f"{evaluator.name}-{idx + 1}"
                    )
                )
            else:
                eval_name = (
                    evaluator.name if len(results_to_submit) == 1 else f"{evaluator.name}-{idx + 1}"
                )

            eval_run = ExperimentEvaluationRun(
                experiment_run_id=experiment_run["id"],
                start_time=start_time,
                end_time=end_time,
                name=eval_name,
                annotator_kind=evaluator.kind,
                error=repr(error) if error else None,
                result=res,  # pyright: ignore[reportUnknownArgumentType]
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
                    eval_run = replace(eval_run, id=resp.json()["data"]["id"])  # pyright: ignore[reportUnknownArgumentType]
                except HTTPStatusError as e:
                    logger.warning(
                        f"Failed to submit evaluation result for evaluator '{evaluator.name}': "
                        f"HTTP {e.response.status_code} - {e.response.text}"
                    )
                    # Continue even if evaluation storage fails

            eval_runs.append(eval_run)

        return eval_runs

    async def get(
        self,
        *,
        experiment_id: str,
    ) -> Experiment:
        """Get an experiment by ID.

        Args:
            experiment_id (str): The ID of the experiment to retrieve.

        Returns:
            Experiment: The experiment with the specified ID.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the experiment is not found.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            experiment = await async_client.experiments.get(experiment_id="exp_123")
            print(f"Example count: {experiment['example_count']}")
            print(f"Successful runs: {experiment['successful_run_count']}")
        """
        try:
            response = await self._client.get(f"v1/experiments/{experiment_id}")
            response.raise_for_status()
            exp_data = response.json()["data"]
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

        return cast(Experiment, exp_data)

    async def delete(
        self,
        *,
        experiment_id: str,
        delete_project: bool = False,
    ) -> None:
        """Delete an experiment by ID.

        Args:
            experiment_id (str): The ID of the experiment to delete.
            delete_project (bool): If True, also delete the project associated with the experiment.
                Defaults to False.

        Raises:
            httpx.HTTPError: If the request fails.
            ValueError: If the experiment is not found.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            await async_client.experiments.delete(experiment_id="exp_123")
        """
        try:
            response = await self._client.delete(
                f"v1/experiments/{experiment_id}",
                params={"delete_project": delete_project},
            )
            response.raise_for_status()
        except HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Experiment not found: {experiment_id}")
            raise

    async def _paginate(
        self,
        *,
        dataset_id: str,
        cursor: Optional[str] = None,
        limit: int = 50,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> v1.ListExperimentsResponseBody:
        """
        Internal method to paginate through experiments with cursor-based pagination.

        This is a private method used internally by the list() method to handle pagination.
        Users should use the list() method instead of calling this directly.

        Args:
            dataset_id (str): The ID of the dataset to list experiments for.
            cursor: Cursor for pagination. Use the `next_cursor` from a previous
                response to get the next page. None for the first page.
            limit: Maximum number of experiments to return per page (default: 50).
            timeout: Request timeout in seconds (default: 60).

        Returns:
            Dictionary with pagination response containing:
                - data: List of experiment dictionaries with fields: id, dataset_id,
                  dataset_version_id, repetitions, metadata, project_name, created_at,
                  updated_at, example_count, successful_run_count, failed_run_count,
                  missing_run_count
                - next_cursor: String cursor for next page, or None if no more pages

        Raises:
            httpx.HTTPError: If the API request fails (e.g., invalid cursor, network error).
        """
        url = f"v1/datasets/{dataset_id}/experiments"
        params: dict[str, Any] = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        response = await self._client.get(url, params=params, timeout=timeout)
        response.raise_for_status()
        return cast(v1.ListExperimentsResponseBody, response.json())

    async def list(
        self,
        *,
        dataset_id: str,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> list[Experiment]:
        """List all experiments for a dataset with automatic pagination handling.

        This method automatically handles pagination behind the scenes and returns
        a simple list of experiments.

        Args:
            dataset_id (str): The ID of the dataset to list experiments for.
            timeout: Request timeout in seconds for each paginated request (default: 60).

        Returns:
            list[Experiment]: A list of all experiments for the dataset.

        Raises:
            httpx.HTTPError: If the request fails.

        Example::

            from phoenix.client import AsyncClient
            async_client = AsyncClient()

            experiments = await async_client.experiments.list(dataset_id="dataset_123")
            for experiment in experiments:
                print(f"Experiment: {experiment['id']}, Runs: {experiment['successful_run_count']}")
        """
        all_experiments: list[Experiment] = []
        cursor: Optional[str] = None
        while True:
            data = await self._paginate(dataset_id=dataset_id, cursor=cursor, timeout=timeout)
            all_experiments.extend(data["data"])

            cursor = data.get("next_cursor")
            if not cursor:
                break
        return all_experiments
