import functools
import inspect
import json
import traceback
from binascii import hexlify
from contextlib import ExitStack
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timezone
from itertools import product
from typing import (
    Any,
    Awaitable,
    Dict,
    Literal,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Type,
    Union,
    cast,
)
from urllib.parse import urljoin

import httpx
import opentelemetry.sdk.trace as trace_sdk
import pandas as pd
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
from typing_extensions import TypeAlias

from phoenix.config import get_base_url, get_env_client_headers
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.evals.utils import get_tqdm_progress_bar_formatter
from phoenix.experiments.evaluators import create_evaluator
from phoenix.experiments.evaluators.base import (
    Evaluator,
    ExperimentEvaluator,
)
from phoenix.experiments.tracing import capture_spans
from phoenix.experiments.types import (
    DRY_RUN,
    Dataset,
    EvaluationParameters,
    EvaluationResult,
    EvaluationSummary,
    EvaluatorName,
    Example,
    Experiment,
    ExperimentEvaluationRun,
    ExperimentParameters,
    ExperimentRun,
    ExperimentRunOutput,
    ExperimentTask,
    RanExperiment,
    TaskSummary,
    TestCase,
    _asdict,
    _replace,
)
from phoenix.experiments.utils import get_dataset_experiments_url, get_experiment_url, get_func_name
from phoenix.trace.attributes import flatten
from phoenix.utilities.json import jsonify


def _phoenix_clients() -> Tuple[httpx.Client, httpx.AsyncClient]:
    headers = get_env_client_headers()
    return httpx.Client(
        base_url=get_base_url(),
        headers=headers,
    ), httpx.AsyncClient(
        base_url=get_base_url(),
        headers=headers,
    )


Evaluators: TypeAlias = Union[
    ExperimentEvaluator,
    Sequence[ExperimentEvaluator],
    Mapping[EvaluatorName, ExperimentEvaluator],
]


RateLimitErrors: TypeAlias = Union[Type[BaseException], Sequence[Type[BaseException]]]


def run_experiment(
    dataset: Dataset,
    task: ExperimentTask,
    evaluators: Optional[Evaluators] = None,
    *,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    dry_run: Union[bool, int] = False,
    print_summary: bool = True,
) -> RanExperiment:
    """
    Runs an experiment using a given set of dataset of examples.

    An experiment is a user-defined task that runs on each example in a dataset. The results from
    each experiment can be evaluated using any number of evaluators to measure the behavior of the
    task. The experiment and evaluation results are stored in the Phoenix database for comparison
    and analysis.

    A `task` is either a synchronous or asynchronous function that returns a JSON serializable
    output. If the `task` is a function of one argument then that argument will be bound to the
    `input` field of the dataset example. Alternatively, the `task` can be a function of any
    combination of specific argument names that will be bound to special values:
        `input`: The input field of the dataset example
        `expected`: The expected or reference output of the dataset example
        `reference`: An alias for `expected`
        `metadata`: Metadata associated with the dataset example
        `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous or asynchronous function that returns either a boolean
    or numeric "score". If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of the task. Alternatively, the `evaluator` can be a function of any
    combination of specific argument names that will be bound to special values:
        `input`: The input field of the dataset example
        `output`: The output of the task
        `expected`: The expected or reference output of the dataset example
        `reference`: An alias for `expected`
        `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

    Args:
        dataset (Dataset): The dataset on which to run the experiment.
        task (ExperimentTask): The task to run on each example in the dataset.
        evaluators (Optional[Evaluators]): A single evaluator or sequence of evaluators used to
            evaluate the results of the experiment. Defaults to None.
        experiment_name (Optional[str]): The name of the experiment. Defaults to None.
        experiment_description (Optional[str]): A description of the experiment. Defaults to None.
        experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
            experiment. Defaults to None.
        rate_limit_errors (Optional[BaseException | Sequence[BaseException]]): An exception or
            sequence of exceptions to adaptively throttle on. Defaults to None.
        dry_run (bool | int): R the experiment in dry-run mode. When set, experiment results will
            not be recorded in Phoenix. If True, the experiment will run on a random dataset
            example. If an integer, the experiment will run on a random sample of the dataset
            examples of the given size. Defaults to False.
        print_summary (bool): Whether to print a summary of the experiment and evaluation results.
            Defaults to True.

    Returns:
        RanExperiment: The results of the experiment and evaluation. Additional evaluations can be
            added to the experiment using the `evaluate_experiment` function.
    """
    task_signature = inspect.signature(task)
    _validate_task_signature(task_signature)

    if not dataset.examples:
        raise ValueError(f"Dataset has no examples: {dataset.id=}, {dataset.version_id=}")
    # Add this to the params once supported in the UI
    repetitions = 1
    assert repetitions > 0, "Must run the experiment at least once."
    evaluators_by_name = _evaluators_by_name(evaluators)

    sync_client, async_client = _phoenix_clients()

    payload = {
        "version_id": dataset.version_id,
        "name": experiment_name,
        "description": experiment_description,
        "metadata": experiment_metadata,
        "repetitions": repetitions,
    }
    if not dry_run:
        experiment_response = sync_client.post(
            f"/v1/datasets/{dataset.id}/experiments",
            json=payload,
        )
        experiment_response.raise_for_status()
        exp_json = experiment_response.json()["data"]
        project_name = exp_json["project_name"]
        experiment = Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset.version_id,
            repetitions=repetitions,
            id=exp_json["id"],
            project_name=project_name,
        )
    else:
        experiment = Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset.version_id,
            repetitions=repetitions,
            id=DRY_RUN,
            project_name="",
        )

    tracer, resource = _get_tracer(experiment.project_name)
    root_span_name = f"Task: {get_func_name(task)}"
    root_span_kind = CHAIN

    print("🧪 Experiment started.")
    if dry_run:
        examples = {
            (ex := dataset[i]).id: ex
            for i in pd.Series(range(len(dataset)))
            .sample(min(len(dataset), int(dry_run)), random_state=42)
            .sort_values()
        }
        id_selection = "\n".join(examples)
        print(f"🌵️ This is a dry-run for these example IDs:\n{id_selection}")
        dataset = replace(dataset, examples=examples)
    else:
        dataset_experiments_url = get_dataset_experiments_url(dataset_id=dataset.id)
        experiment_compare_url = get_experiment_url(
            dataset_id=dataset.id,
            experiment_id=experiment.id,
        )
        print(f"📺 View dataset experiments: {dataset_experiments_url}")
        print(f"🔗 View this experiment: {experiment_compare_url}")

    def sync_run_experiment(test_case: TestCase) -> ExperimentRun:
        example, repetition_number = test_case.example, test_case.repetition_number
        output = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        with ExitStack() as stack:
            span: Span = stack.enter_context(
                tracer.start_as_current_span(root_span_name, context=Context())
            )
            stack.enter_context(capture_spans(resource))
            try:
                # Do not use keyword arguments, which can fail at runtime
                # even when function obeys protocol, because keyword arguments
                # are implementation details.
                bound_task_args = _bind_task_signature(task_signature, example)
                _output = task(*bound_task_args.args, **bound_task_args.kwargs)
                if isinstance(_output, Awaitable):
                    sync_error_message = (
                        "Task is async and cannot be run within an existing event loop. "
                        "Consider the following options:\n\n"
                        "1. Pass in a synchronous task callable.\n"
                        "2. Use `nest_asyncio.apply()` to allow nesting event loops."
                    )
                    raise RuntimeError(sync_error_message)
                else:
                    output = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example.id,
                    repetition_number=repetition_number,
                    kind="task",
                )
            output = jsonify(output)
            span.set_attribute(INPUT_VALUE, json.dumps(example.input, ensure_ascii=False))
            span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            if output is not None:
                if isinstance(output, str):
                    span.set_attribute(OUTPUT_VALUE, output)
                else:
                    span.set_attribute(OUTPUT_VALUE, json.dumps(output, ensure_ascii=False))
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        exp_run = ExperimentRun(
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            experiment_id=experiment.id,
            dataset_example_id=example.id,
            repetition_number=repetition_number,
            experiment_run_output=ExperimentRunOutput(task_output=output),
            error=repr(error) if error else None,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        if not dry_run:
            resp = sync_client.post(f"/v1/experiments/{experiment.id}/runs", json=jsonify(exp_run))
            resp.raise_for_status()
            exp_run = replace(exp_run, id=resp.json()["data"]["id"])
        return exp_run

    async def async_run_experiment(test_case: TestCase) -> ExperimentRun:
        example, repetition_number = test_case.example, test_case.repetition_number
        output = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        with ExitStack() as stack:
            span: Span = stack.enter_context(
                tracer.start_as_current_span(root_span_name, context=Context())
            )
            stack.enter_context(capture_spans(resource))
            try:
                # Do not use keyword arguments, which can fail at runtime
                # even when function obeys protocol, because keyword arguments
                # are implementation details.
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
                    example_id=example.id,
                    repetition_number=repetition_number,
                    kind="task",
                )
            output = jsonify(output)
            span.set_attribute(INPUT_VALUE, json.dumps(example.input, ensure_ascii=False))
            span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            if output is not None:
                if isinstance(output, str):
                    span.set_attribute(OUTPUT_VALUE, output)
                else:
                    span.set_attribute(OUTPUT_VALUE, json.dumps(output, ensure_ascii=False))
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        assert isinstance(
            output, (dict, list, str, int, float, bool, type(None))
        ), "Output must be JSON serializable"
        exp_run = ExperimentRun(
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            experiment_id=experiment.id,
            dataset_example_id=example.id,
            repetition_number=repetition_number,
            experiment_run_output=ExperimentRunOutput(task_output=output),
            error=repr(error) if error else None,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        if not dry_run:
            resp = await async_client.post(
                f"/v1/experiments/{experiment.id}/runs", json=jsonify(exp_run)
            )
            resp.raise_for_status()
            exp_run = replace(exp_run, id=resp.json()["data"]["id"])
        return exp_run

    _errors: Tuple[Type[BaseException], ...]
    if not hasattr(rate_limit_errors, "__iter__"):
        _errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
    else:
        rate_limit_errors = cast(Sequence[Type[BaseException]], rate_limit_errors)
        _errors = tuple(filter(None, rate_limit_errors))
    rate_limiters = [RateLimiter(rate_limit_error=rate_limit_error) for rate_limit_error in _errors]

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
        tqdm_bar_format=get_tqdm_progress_bar_formatter("running tasks"),
    )

    test_cases = [
        TestCase(example=deepcopy(ex), repetition_number=rep)
        for ex, rep in product(dataset.examples.values(), range(1, repetitions + 1))
    ]
    task_runs, _execution_details = executor.run(test_cases)
    print("✅ Task runs completed.")
    params = ExperimentParameters(n_examples=len(dataset.examples), n_repetitions=repetitions)
    task_summary = TaskSummary.from_task_runs(params, task_runs)
    ran_experiment: RanExperiment = object.__new__(RanExperiment)
    ran_experiment.__init__(  # type: ignore[misc]
        params=params,
        dataset=dataset,
        runs={r.id: r for r in task_runs},
        task_summary=task_summary,
        **_asdict(experiment),
    )
    if evaluators_by_name:
        return evaluate_experiment(
            ran_experiment,
            evaluators=evaluators_by_name,
            dry_run=dry_run,
            print_summary=print_summary,
            rate_limit_errors=rate_limit_errors,
        )
    if print_summary:
        print(ran_experiment)
    return ran_experiment


def evaluate_experiment(
    experiment: Experiment,
    evaluators: Evaluators,
    *,
    dry_run: Union[bool, int] = False,
    print_summary: bool = True,
    rate_limit_errors: Optional[RateLimitErrors] = None,
) -> RanExperiment:
    if not dry_run and _is_dry_run(experiment):
        dry_run = True
    evaluators_by_name = _evaluators_by_name(evaluators)
    if not evaluators_by_name:
        raise ValueError("Must specify at least one Evaluator")
    sync_client, async_client = _phoenix_clients()
    dataset_id = experiment.dataset_id
    dataset_version_id = experiment.dataset_version_id
    if isinstance(experiment, RanExperiment):
        ran_experiment: RanExperiment = experiment
    else:
        dataset = Dataset.from_dict(
            sync_client.get(
                f"/v1/datasets/{dataset_id}/examples",
                params={"version_id": str(dataset_version_id)},
            ).json()["data"]
        )
        if not dataset.examples:
            raise ValueError(f"Dataset has no examples: {dataset_id=}, {dataset_version_id=}")
        experiment_runs = tuple(
            ExperimentRun.from_dict(exp_run)
            for exp_run in sync_client.get(f"/v1/experiments/{experiment.id}/runs").json()["data"]
        )
        if not experiment_runs:
            raise ValueError("Experiment has not been run")
        params = ExperimentParameters(n_examples=len(dataset.examples))
        task_summary = TaskSummary.from_task_runs(params, experiment_runs)
        ran_experiment = object.__new__(RanExperiment)
        ran_experiment.__init__(  # type: ignore[misc]
            dataset=dataset,
            params=params,
            runs=experiment_runs,
            task_summary=task_summary,
            **_asdict(experiment),
        )
    print("🧠 Evaluation started.")
    examples = ran_experiment.dataset.examples
    if dry_run:
        if not _is_dry_run(ran_experiment):
            dataset = ran_experiment.dataset
            examples = {
                (ex := dataset[i]).id: ex
                for i in pd.Series(range(len(dataset)))
                .sample(min(len(dataset), int(dry_run)), random_state=42)
                .sort_values()
            }
            dataset = replace(ran_experiment.dataset, examples=examples)
            ran_experiment = _replace(ran_experiment, id=DRY_RUN, dataset=dataset)
        id_selection = "\n".join(examples)
        print(f"🌵️ This is a dry-run for these example IDs:\n{id_selection}")
    # not all dataset examples have associated experiment runs, so we need to pair them up
    example_run_pairs = []
    examples = ran_experiment.dataset.examples
    for exp_run in ran_experiment.runs.values():
        example = examples.get(exp_run.dataset_example_id)
        if example:
            example_run_pairs.append((deepcopy(example), exp_run))
    evaluation_input = [
        (example, run, evaluator)
        for (example, run), evaluator in product(example_run_pairs, evaluators_by_name.values())
    ]

    tracer, resource = _get_tracer(None if dry_run else "evaluators")
    root_span_kind = EVALUATOR

    def sync_evaluate_run(
        obj: Tuple[Example, ExperimentRun, Evaluator],
    ) -> ExperimentEvaluationRun:
        example, experiment_run, evaluator = obj
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        root_span_name = f"Evaluation: {evaluator.name}"
        with ExitStack() as stack:
            span: Span = stack.enter_context(
                tracer.start_as_current_span(root_span_name, context=Context())
            )
            stack.enter_context(capture_spans(resource))
            try:
                result = evaluator.evaluate(
                    output=experiment_run.output,
                    expected=example.output,
                    reference=example.output,
                    input=example.input,
                    metadata=example.metadata,
                )
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example.id,
                    repetition_number=experiment_run.repetition_number,
                    kind="evaluator",
                )
            if result:
                span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=experiment_run.id,
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            name=evaluator.name,
            annotator_kind=evaluator.kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        if not dry_run:
            resp = sync_client.post("/v1/experiment_evaluations", json=jsonify(eval_run))
            resp.raise_for_status()
            eval_run = replace(eval_run, id=resp.json()["data"]["id"])
        return eval_run

    async def async_evaluate_run(
        obj: Tuple[Example, ExperimentRun, Evaluator],
    ) -> ExperimentEvaluationRun:
        example, experiment_run, evaluator = obj
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        root_span_name = f"Evaluation: {evaluator.name}"
        with ExitStack() as stack:
            span: Span = stack.enter_context(
                tracer.start_as_current_span(root_span_name, context=Context())
            )
            stack.enter_context(capture_spans(resource))
            try:
                result = await evaluator.async_evaluate(
                    output=experiment_run.output,
                    expected=example.output,
                    reference=example.output,
                    input=example.input,
                    metadata=example.metadata,
                )
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
                _print_experiment_error(
                    exc,
                    example_id=example.id,
                    repetition_number=experiment_run.repetition_number,
                    kind="evaluator",
                )
            if result:
                span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=experiment_run.id,
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            name=evaluator.name,
            annotator_kind=evaluator.kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        if not dry_run:
            resp = await async_client.post("/v1/experiment_evaluations", json=jsonify(eval_run))
            resp.raise_for_status()
            eval_run = replace(eval_run, id=resp.json()["data"]["id"])
        return eval_run

    _errors: Tuple[Type[BaseException], ...]
    if not hasattr(rate_limit_errors, "__iter__"):
        _errors = (rate_limit_errors,) if rate_limit_errors is not None else ()
    else:
        rate_limit_errors = cast(Sequence[Type[BaseException]], rate_limit_errors)
        _errors = tuple(filter(None, rate_limit_errors))
    rate_limiters = [RateLimiter(rate_limit_error=rate_limit_error) for rate_limit_error in _errors]

    rate_limited_sync_evaluate_run = functools.reduce(
        lambda fn, limiter: limiter.limit(fn), rate_limiters, sync_evaluate_run
    )
    rate_limited_async_evaluate_run = functools.reduce(
        lambda fn, limiter: limiter.alimit(fn), rate_limiters, async_evaluate_run
    )

    executor = get_executor_on_sync_context(
        rate_limited_sync_evaluate_run,
        rate_limited_async_evaluate_run,
        max_retries=0,
        exit_on_error=False,
        fallback_return_value=None,
        tqdm_bar_format=get_tqdm_progress_bar_formatter("running experiment evaluations"),
    )
    eval_runs, _execution_details = executor.run(evaluation_input)
    eval_summary = EvaluationSummary.from_eval_runs(
        EvaluationParameters(
            eval_names=frozenset(evaluators_by_name),
            exp_params=ran_experiment.params,
        ),
        *eval_runs,
    )
    ran_experiment = ran_experiment.add(eval_summary, *eval_runs)
    if print_summary:
        print(ran_experiment)
    return ran_experiment


def _evaluators_by_name(obj: Optional[Evaluators]) -> Mapping[EvaluatorName, Evaluator]:
    evaluators_by_name: Dict[EvaluatorName, Evaluator] = {}
    if obj is None:
        return evaluators_by_name
    if isinstance(mapping := obj, Mapping):
        for name, value in mapping.items():
            evaluator = (
                create_evaluator(name=name)(value) if not isinstance(value, Evaluator) else value
            )
            name = evaluator.name
            if name in evaluators_by_name:
                raise ValueError(f"Two evaluators have the same name: {name}")
            evaluators_by_name[name] = evaluator
    elif isinstance(seq := obj, Sequence):
        for value in seq:
            evaluator = create_evaluator()(value) if not isinstance(value, Evaluator) else value
            name = evaluator.name
            if name in evaluators_by_name:
                raise ValueError(f"Two evaluators have the same name: {name}")
            evaluators_by_name[name] = evaluator
    else:
        assert not isinstance(obj, Mapping) and not isinstance(obj, Sequence)
        evaluator = create_evaluator()(obj) if not isinstance(obj, Evaluator) else obj
        name = evaluator.name
        if name in evaluators_by_name:
            raise ValueError(f"Two evaluators have the same name: {name}")
        evaluators_by_name[name] = evaluator
    return evaluators_by_name


def _get_tracer(project_name: Optional[str] = None) -> Tuple[Tracer, Resource]:
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name} if project_name else {})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    span_processor = (
        SimpleSpanProcessor(OTLPSpanExporter(urljoin(f"{get_base_url()}", "v1/traces")))
        if project_name
        else _NoOpProcessor()
    )
    tracer_provider.add_span_processor(span_processor)
    return tracer_provider.get_tracer(__name__), resource


def _str_trace_id(id_: int) -> str:
    return hexlify(id_.to_bytes(16, "big")).decode()


def _decode_unix_nano(time_unix_nano: int) -> datetime:
    return datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)


def _is_dry_run(obj: Any) -> bool:
    return hasattr(obj, "id") and isinstance(obj.id, str) and obj.id.startswith(DRY_RUN)


def _validate_task_signature(sig: inspect.Signature) -> None:
    # Check that the function signature has a valid signature for use as a task
    # If it does not, raise an error to exit early before running an experiment
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
                (
                    f"Invalid parameter names in task function: {', '.join(not_found)}. "
                    "Parameters names for multi-argument functions must be "
                    f"any of: {', '.join(valid_named_params)}."
                )
            )


def _bind_task_signature(sig: inspect.Signature, example: Example) -> inspect.BoundArguments:
    parameter_mapping = {
        "input": example.input,
        "expected": example.output,
        "reference": example.output,  # Alias for "expected"
        "metadata": example.metadata,
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
    """
    Prints an experiment error.
    """
    display_error = RuntimeError(
        f"{kind} failed for example id {repr(example_id)}, " f"repetition {repr(repetition_number)}"
    )
    display_error.__cause__ = error
    formatted_exception = "".join(traceback.format_exception(display_error))  # type: ignore[arg-type, call-arg, unused-ignore]
    print("\033[91m" + formatted_exception + "\033[0m")  # prints in red


class _NoOpProcessor(trace_sdk.SpanProcessor):
    def force_flush(self, *_: Any) -> bool:
        return True


INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND

CHAIN = OpenInferenceSpanKindValues.CHAIN.value
EVALUATOR = OpenInferenceSpanKindValues.EVALUATOR.value
JSON = OpenInferenceMimeTypeValues.JSON
