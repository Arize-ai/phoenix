import functools
import json
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
from phoenix.datasets.evaluators import create_evaluator
from phoenix.datasets.evaluators.base import (
    Evaluator,
    ExperimentEvaluator,
)
from phoenix.datasets.tracing import capture_spans
from phoenix.datasets.types import (
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
    ExperimentResult,
    ExperimentRun,
    ExperimentRunId,
    ExperimentTask,
    RanExperiment,
    TaskSummary,
    TestCase,
    _asdict,
)
from phoenix.datasets.utils import get_dataset_experiments_url, get_experiment_url
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.evals.utils import get_tqdm_progress_bar_formatter
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


def run_experiment(
    dataset: Dataset,
    task: ExperimentTask,
    *,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    evaluators: Optional[Evaluators] = None,
    rate_limit_errors: Optional[Union[Type[BaseException], Tuple[Type[BaseException], ...]]] = None,
    dry_run: bool = False,
    print_summary: bool = True,
) -> RanExperiment:
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
        exp_json = experiment_response.json()
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
    root_span_name = f"Task: {_get_task_name(task)}"
    root_span_kind = CHAIN

    print("🧪 Experiment started.")
    if dry_run:
        max_sample_size = 3
        print(f"🧊 This is a dry run (first {max_sample_size} examples).")
        examples = dataset.examples[:max_sample_size]
        dataset = replace(dataset, examples=examples)
    else:
        dataset_experiments_url = get_dataset_experiments_url(dataset_id=dataset.id)
        experiment_compare_url = get_experiment_url(
            dataset_id=dataset.id,
            experiment_id=experiment.id,
        )
        print(f"📺 View dataset experiments: {dataset_experiments_url}")
        print(f"🔗 View this experiment: {experiment_compare_url}")

    errors: Tuple[Optional[Type[BaseException]], ...]
    if not hasattr(rate_limit_errors, "__iter__"):
        errors = (rate_limit_errors,)
    else:
        rate_limit_errors = cast(Tuple[Type[BaseException], ...], rate_limit_errors)
        errors = rate_limit_errors

    rate_limiters = [RateLimiter(rate_limit_error=rate_limit_error) for rate_limit_error in errors]

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
                _output = task(example)
                if isinstance(_output, Awaitable):
                    raise RuntimeError("Task is async but running in sync context")
                else:
                    output = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
            span.set_attribute(INPUT_VALUE, json.dumps(example.input, ensure_ascii=False))
            span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            if result := ExperimentResult(result=output) if output is not None else None:
                if isinstance(output, str):
                    span.set_attribute(OUTPUT_VALUE, output)
                else:
                    span.set_attribute(OUTPUT_VALUE, json.dumps(output, ensure_ascii=False))
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
                span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
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
            output=result,
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
                _output = task(example)
                if isinstance(_output, Awaitable):
                    output = await _output
                else:
                    output = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
            span.set_attribute(INPUT_VALUE, json.dumps(example.input, ensure_ascii=False))
            span.set_attribute(INPUT_MIME_TYPE, JSON.value)
            if result := ExperimentResult(result=output) if output is not None else None:
                if isinstance(output, str):
                    span.set_attribute(OUTPUT_VALUE, output)
                else:
                    span.set_attribute(OUTPUT_VALUE, json.dumps(output, ensure_ascii=False))
                    span.set_attribute(OUTPUT_MIME_TYPE, JSON.value)
                span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
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
            output=result,
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
        TestCase(example=ex, repetition_number=rep)
        for ex, rep in product(dataset.examples, range(1, repetitions + 1))
    ]
    task_runs, _execution_details = executor.run(test_cases)
    print("✅ Task runs completed.")
    params = ExperimentParameters(n_examples=len(dataset.examples), n_repetitions=repetitions)
    task_summary = TaskSummary.from_task_runs(params, task_runs)
    ran_experiment: RanExperiment = object.__new__(RanExperiment)
    ran_experiment.__init__(  # type: ignore[misc]
        params=params,
        dataset=dataset,
        runs=task_runs,
        task_summary=task_summary,
        **_asdict(experiment),
    )
    if evaluators_by_name:
        return evaluate_experiment(
            ran_experiment,
            evaluators=evaluators_by_name,
            dry_run=dry_run,
            print_summary=print_summary,
        )
    if print_summary:
        print(ran_experiment)
    return ran_experiment


def evaluate_experiment(
    experiment: Experiment,
    evaluators: Evaluators,
    *,
    dry_run: bool = False,
    print_summary: bool = True,
) -> RanExperiment:
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
            for exp_run in sync_client.get(f"/v1/experiments/{experiment.id}/runs").json()
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
    # not all dataset examples have associated experiment runs, so we need to pair them up
    if dry_run:
        max_sample_size = 3
        print(f"🧊 This is a dry run (first {max_sample_size} examples).")
        ran_experiment = _as_dry_run(ran_experiment, max_sample_size)
    example_run_pairs = []
    examples_by_id = {example.id: example for example in ran_experiment.dataset.examples}
    for exp_run in ran_experiment.runs:
        example = examples_by_id.get(exp_run.dataset_example_id)
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
                    output=None if experiment_run.output is None else experiment_run.output.result,
                    expected=example.output,
                    input=example.input,
                    metadata=example.metadata,
                )
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
            if result:
                span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=cast(ExperimentRunId, experiment_run.id),
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
                    output=None if experiment_run.output is None else experiment_run.output.result,
                    expected=example.output,
                    input=example.input,
                    metadata=example.metadata,
                )
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
            if result:
                span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        eval_run = ExperimentEvaluationRun(
            experiment_run_id=cast(ExperimentRunId, experiment_run.id),
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

    executor = get_executor_on_sync_context(
        sync_evaluate_run,
        async_evaluate_run,
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
        eval_runs,
    )
    ran_experiment = ran_experiment.add(eval_summary)
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


def _get_task_name(task: ExperimentTask) -> str:
    """
    Makes a best-effort attempt to get the name of the task.
    """

    if isinstance(task, functools.partial):
        return task.func.__qualname__
    if hasattr(task, "__qualname__"):
        return task.__qualname__
    return str(task)


def _as_dry_run(obj: RanExperiment, max_sample_size: int = 3) -> RanExperiment:
    ran_experiment = object.__new__(RanExperiment)
    if obj.id == DRY_RUN:
        ran_experiment.__init__(  # type: ignore[misc]
            **_asdict(obj),
        )
    else:
        dataset = obj.dataset
        examples = dataset.examples[:max_sample_size]
        ran_experiment.__init__(  # type: ignore[misc]
            **{
                **_asdict(obj),
                "dataset": replace(dataset, examples=examples),
                "id": DRY_RUN,
            }
        )
    return ran_experiment


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
