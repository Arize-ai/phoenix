import functools
import json
from binascii import hexlify
from contextlib import ExitStack
from copy import deepcopy
from datetime import datetime, timezone
from itertools import product
from typing import (
    Any,
    Awaitable,
    Callable,
    Coroutine,
    Iterable,
    Mapping,
    Optional,
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
from opentelemetry.trace import Status, StatusCode
from typing_extensions import TypeAlias

from phoenix.config import (
    get_env_client_headers,
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
)
from phoenix.datasets.tracing import capture_spans
from phoenix.datasets.types import (
    CanAsyncEvaluate,
    CanEvaluate,
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
from phoenix.evals.utils import get_tqdm_progress_bar_formatter
from phoenix.session.session import active_session
from phoenix.trace.attributes import flatten
from phoenix.utilities.json import jsonify

ExperimentTask: TypeAlias = Union[
    Callable[[Example], JSONSerializable],
    Callable[[Example], Coroutine[None, None, JSONSerializable]],
]


def _get_base_url() -> str:
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    return base_url if base_url.endswith("/") else base_url + "/"


def _get_web_base_url() -> str:
    """Return the web UI base URL.

    Returns:
        str: the web UI base URL
    """
    if session := active_session():
        return session.url
    return _get_base_url()


def _get_experiment_url(*, dataset_id: str, experiment_id: str) -> str:
    return f"{_get_web_base_url()}datasets/{dataset_id}/compare?experimentId={experiment_id}"


def _get_dataset_experiments_url(*, dataset_id: str) -> str:
    return f"{_get_web_base_url()}datasets/{dataset_id}/experiments"


def _phoenix_client() -> httpx.Client:
    headers = get_env_client_headers()
    client = httpx.Client(base_url=_get_base_url(), headers=headers)
    return client


def run_experiment(
    dataset: Dataset,
    task: ExperimentTask,
    *,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    evaluators: Optional[Union[ExperimentEvaluator, Iterable[ExperimentEvaluator]]] = None,
    rate_limit_errors: Optional[Union[Type[BaseException], Tuple[Type[BaseException], ...]]] = None,
) -> Experiment:
    # Add this to the params once supported in the UI
    repetitions = 1
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
    exp_json = experiment_response.json()
    experiment_id = exp_json["id"]
    project_name = exp_json["project_name"]

    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name} if project_name else {})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        SimpleSpanProcessor(OTLPSpanExporter(urljoin(f"{_get_base_url()}", "v1/traces")))
    )
    tracer = tracer_provider.get_tracer(__name__)
    root_span_name = f"Task: {task.__qualname__}"
    root_span_kind = CHAIN.value

    dataset_experiments_url = _get_dataset_experiments_url(dataset_id=dataset.id)
    experiment_compare_url = _get_experiment_url(dataset_id=dataset.id, experiment_id=experiment_id)
    print("🧪 Experiment started.")
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
        experiment_run = ExperimentRun(
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            experiment_id=experiment_id,
            dataset_example_id=example.id,
            repetition_number=repetition_number,
            output=result,
            error=repr(error) if error else None,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        return experiment_run

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
        experiment_run = ExperimentRun(
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            experiment_id=experiment_id,
            dataset_example_id=example.id,
            repetition_number=repetition_number,
            output=result,
            error=repr(error) if error else None,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
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
        tqdm_bar_format=get_tqdm_progress_bar_formatter("running tasks"),
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

    experiment = Experiment(
        id=experiment_id,
        dataset_id=dataset.id,
        dataset_version_id=dataset.version_id,
        project_name=project_name,
    )

    print("✅ Task runs completed.")
    print("🧠 Evaluation started.")

    if evaluators is not None:
        _evaluate_experiment(experiment, evaluators, dataset.examples, client)

    return experiment


def evaluate_experiment(
    experiment: Experiment,
    evaluators: Union[ExperimentEvaluator, Iterable[ExperimentEvaluator]],
) -> None:
    client = _phoenix_client()
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
    _evaluate_experiment(experiment, evaluators, dataset_examples, client)


ExperimentEvaluatorName: TypeAlias = str


def _evaluate_experiment(
    experiment: Experiment,
    evaluators: Union[ExperimentEvaluator, Iterable[ExperimentEvaluator]],
    dataset_examples: Iterable[Example],
    client: httpx.Client,
) -> None:
    if isinstance(evaluators, (CanEvaluate, CanAsyncEvaluate)):
        evaluators = [evaluators]

    experiment_id = experiment.id

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
    evaluation_inputs = [
        (example, run, evaluator.name, evaluator)
        for (example, run), evaluator in product(example_run_pairs, evaluators)
    ]

    project_name = "evaluators"
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name} if project_name else {})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        SimpleSpanProcessor(OTLPSpanExporter(urljoin(f"{_get_base_url()}", "v1/traces")))
    )
    tracer = tracer_provider.get_tracer(__name__)
    root_span_kind = "EVALUATOR"

    def sync_evaluate_run(
        obj: Tuple[Example, ExperimentRun, ExperimentEvaluatorName, ExperimentEvaluator],
    ) -> ExperimentEvaluationRun:
        example, experiment_run, name, evaluator = obj
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        root_span_name = f"Evaluation: {name}"
        with ExitStack() as stack:
            span: Span = stack.enter_context(
                tracer.start_as_current_span(root_span_name, context=Context())
            )
            stack.enter_context(capture_spans(resource))
            try:
                # Do not use keyword arguments, which can fail at runtime
                # even when function obeys protocol, because keyword arguments
                # are implementation details.
                if not isinstance(evaluator, CanEvaluate):
                    raise RuntimeError("Task is async but running in sync context")
                _output = evaluator.evaluate(example, experiment_run)
                if isinstance(_output, Awaitable):
                    raise RuntimeError("Task is async but running in sync context")
                result = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
            span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        evaluator_payload = ExperimentEvaluationRun(
            experiment_run_id=cast(ExperimentRunId, experiment_run.id),
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            name=evaluator.name,
            annotator_kind=evaluator.annotator_kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        return evaluator_payload

    async def async_evaluate_run(
        obj: Tuple[Example, ExperimentRun, ExperimentEvaluatorName, ExperimentEvaluator],
    ) -> ExperimentEvaluationRun:
        example, experiment_run, name, evaluator = obj
        result: Optional[EvaluationResult] = None
        error: Optional[BaseException] = None
        status = Status(StatusCode.OK)
        root_span_name = f"Evaluation: {name}"
        with ExitStack() as stack:
            span: Span = stack.enter_context(
                tracer.start_as_current_span(root_span_name, context=Context())
            )
            stack.enter_context(capture_spans(resource))
            try:
                # Do not use keyword arguments, which can fail at runtime
                # even when function obeys protocol, because keyword arguments
                # are implementation details.
                if isinstance(evaluator, CanAsyncEvaluate):
                    result = await evaluator.async_evaluate(example, experiment_run)
                else:
                    _output = evaluator.evaluate(example, experiment_run)
                    if isinstance(_output, Awaitable):
                        result = await _output
                    else:
                        result = _output
            except BaseException as exc:
                span.record_exception(exc)
                status = Status(StatusCode.ERROR, f"{type(exc).__name__}: {exc}")
                error = exc
            span.set_attributes(dict(flatten(jsonify(result), recurse_on_sequence=True)))
            span.set_attribute(OPENINFERENCE_SPAN_KIND, root_span_kind)
            span.set_status(status)

        evaluator_payload = ExperimentEvaluationRun(
            experiment_run_id=cast(ExperimentRunId, experiment_run.id),
            start_time=_decode_unix_nano(cast(int, span.start_time)),
            end_time=_decode_unix_nano(cast(int, span.end_time)),
            name=evaluator.name,
            annotator_kind=evaluator.annotator_kind,
            error=repr(error) if error else None,
            result=result,
            trace_id=_str_trace_id(span.get_span_context().trace_id),  # type: ignore[no-untyped-call]
        )
        return evaluator_payload

    executor = get_executor_on_sync_context(
        sync_evaluate_run,
        async_evaluate_run,
        max_retries=0,
        exit_on_error=False,
        fallback_return_value=None,
        tqdm_bar_format=get_tqdm_progress_bar_formatter("running experiment evaluations"),
    )
    evaluation_payloads, _execution_details = executor.run(evaluation_inputs)
    for payload in evaluation_payloads:
        if payload is not None:
            resp = client.post("/v1/experiment_evaluations", json=jsonify(payload))
            resp.raise_for_status()


def _str_trace_id(id_: int) -> str:
    return hexlify(id_.to_bytes(16, "big")).decode()


def _decode_unix_nano(time_unix_nano: int) -> datetime:
    return datetime.fromtimestamp(time_unix_nano / 1e9, tz=timezone.utc)


INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND

CHAIN = OpenInferenceSpanKindValues.CHAIN
JSON = OpenInferenceMimeTypeValues.JSON
