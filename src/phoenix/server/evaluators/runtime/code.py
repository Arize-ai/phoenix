"""Sandbox-backed code evaluator runtime and output coercion."""

from __future__ import annotations

import asyncio
import json
import math
import traceback as _traceback
from datetime import datetime, timezone
from typing import Any, NamedTuple, Optional, Sequence, cast

import openinference.instrumentation as oi
from opentelemetry.context import Context
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer, format_trace_id

from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OutputConfigType,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.evaluators.input_mapping import apply_input_mapping
from phoenix.server.evaluators.runtime.base import (
    BaseEvaluator,
    EvaluationResult,
    result_annotation_names,
)
from phoenix.server.evaluators.schemas import (
    infer_python_evaluate_input_schema,
    infer_typescript_evaluate_input_schema,
)
from phoenix.server.monty_runtime import MontyServiceError
from phoenix.server.online_eval.failure_policy import FailureDisposition
from phoenix.server.sandbox.cancellation import run_cancel_once
from phoenix.server.sandbox.redaction import SandboxSecretMasker
from phoenix.server.sandbox.result_protocol import (
    PHOENIX_RESULT_BEGIN,
    PHOENIX_RESULT_END,
    extract_framed_result,
)
from phoenix.server.sandbox.session_manager import (
    SandboxSessionManager,
    SessionInvalidated,
    SessionLimitExceeded,
)
from phoenix.server.sandbox.types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxBackend,
    UnsupportedOperation,
)

# What a code evaluator's payload-limit error suggests when the caller sets no remediation.
DEFAULT_PAYLOAD_LIMIT_REMEDIATION = "Reduce the mapped inputs or raise the caller's payload limit."


class SandboxPayloadTooLargeError(Exception):
    """Rendered sandbox source exceeds the configured online-eval limit."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        terminal=True,
        code="SANDBOX_PAYLOAD_TOO_LARGE",
    )


class SandboxBackendTimeoutError(TimeoutError):
    """The sandbox backend reported its own execution timeout."""

    online_eval_disposition = FailureDisposition(
        count_attempt=False,
        code="SANDBOX_BACKEND_TIMEOUT",
    )


class SandboxRunnerTimeoutError(TimeoutError):
    """The evaluator runner's guard deadline expired."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        code="SANDBOX_RUNNER_TIMEOUT",
    )


class SandboxBackendExecutionError(Exception):
    """A sandbox backend returned an unsuccessful execution outcome."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        code="SANDBOX_BACKEND_ERROR",
    )


_DICT_KEYS = frozenset({"label", "score", "explanation"})


class Triple(NamedTuple):
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]


def _extract_triple(value: Any) -> Triple:
    if isinstance(value, dict):
        unknown = set(value.keys()) - _DICT_KEYS
        if unknown:
            raise ValueError(
                f"Unrecognized keys in output dict: {sorted(unknown)!r}. "
                f"Accepted dict keys are: {sorted(_DICT_KEYS)!r}"
            )
        raw_label = value.get("label")
        raw_score = value.get("score")
        raw_explanation = value.get("explanation")
        return Triple(
            label=raw_label,
            score=raw_score,
            explanation=raw_explanation,
        )

    if isinstance(value, bool):
        return Triple(label=str(value), score=None, explanation=None)
    if isinstance(value, (int, float)):
        return Triple(label=None, score=float(value), explanation=None)
    if isinstance(value, str):
        return Triple(label=value, score=None, explanation=None)
    if value is None:
        return Triple(label=None, score=None, explanation=None)

    # Lists/complex objects rejected by _validate_triple_bare.
    return Triple(label=None, score=None, explanation=None)


def _validate_field_types(triple: Triple) -> None:
    if triple.label is not None and not isinstance(triple.label, str):
        raise ValueError(
            f"'label' must be a string or None, got {type(triple.label).__name__!r}: "
            f"{triple.label!r}"
        )
    if triple.explanation is not None and not isinstance(triple.explanation, str):
        raise ValueError(
            f"'explanation' must be a string or None, got "
            f"{type(triple.explanation).__name__!r}: {triple.explanation!r}"
        )


def _validate_triple_bare(value: Any, triple: Triple) -> Triple:
    if isinstance(value, (list, tuple)) or (
        isinstance(value, dict) and set(value.keys()) - _DICT_KEYS
    ):
        raise ValueError(
            f"Unsupported output type {type(value).__name__!r}: {value!r}. "
            f"Without an output config, accepted shapes are: bare scalar "
            f"(str, int, float, bool, None) or a dict with keys from "
            f"{sorted(_DICT_KEYS)!r}."
        )
    return triple


def _validate_triple_categorical(
    triple: Triple,
    config: CategoricalOutputConfig,
    language: str = "PYTHON",
) -> Triple:
    shapes = "\n".join(f"  {s}" for s in config.shape_examples(language=language, mode="full"))

    label = triple.label
    if label is None:
        raise ValueError(
            f"Categorical output requires a label. Got label=None. "
            f"Return a string from {[v.label for v in config.values]!r} "
            f"or a dict with a 'label' key.\nValid shapes:\n{shapes}"
        )
    if not isinstance(label, str):
        raise ValueError(
            f"Expected a string label for categorical output, got "
            f"{type(label).__name__!r}: {label!r}\nValid shapes:\n{shapes}"
        )

    label_to_score: dict[str, Optional[float]] = {v.label: v.score for v in config.values}
    if label not in label_to_score:
        valid = ", ".join(repr(v.label) for v in config.values)
        raise ValueError(
            f"Label {label!r} not in categorical output config values [{valid}].\n"
            f"Valid shapes:\n{shapes}"
        )

    looked_up_score = label_to_score[label]

    # User-supplied score must match the canonical lookup for the label.
    if triple.score is not None:
        if isinstance(triple.score, bool):
            raise ValueError(
                f"'score' must not be bool; got {triple.score!r}. "
                f"Categorical score is determined by the config lookup for label {label!r}."
            )
        user_score = float(triple.score)
        if looked_up_score is not None and user_score != looked_up_score:
            raise ValueError(
                f"Score {user_score!r} does not match the configured score "
                f"{looked_up_score!r} for label {label!r}. "
                f"Remove the 'score' key or use the canonical value {looked_up_score!r}."
            )

    score = looked_up_score if looked_up_score is not None else triple.score
    return Triple(label=label, score=score, explanation=triple.explanation)


def _validate_triple_continuous(
    triple: Triple,
    config: ContinuousOutputConfig,
    language: str = "PYTHON",
) -> Triple:
    shapes = "\n".join(f"  {s}" for s in config.shape_examples(language=language, mode="full"))

    score = triple.score
    if score is None:
        raise ValueError(
            f"Continuous output requires a numeric score. Got score=None. "
            f"Return a number or a dict with a 'score' key.\nValid shapes:\n{shapes}"
        )
    if isinstance(score, bool):
        raise ValueError(f"Expected a numeric value for continuous output, got bool: {score!r}")
    if not isinstance(score, (int, float)):
        raise ValueError(
            f"Expected a numeric value for continuous output, got "
            f"{type(score).__name__!r}: {score!r}\nValid shapes:\n{shapes}"
        )
    score_f = float(score)
    if math.isnan(score_f) or math.isinf(score_f):
        raise ValueError(f"Score must be a finite number; got {score!r}")
    if config.lower_bound is not None and score_f < config.lower_bound:
        raise ValueError(f"Score {score_f} is below lower_bound {config.lower_bound}")
    if config.upper_bound is not None and score_f > config.upper_bound:
        raise ValueError(f"Score {score_f} is above upper_bound {config.upper_bound}")
    return Triple(label=triple.label, score=score_f, explanation=triple.explanation)


def coerce_output(
    value: Any,
    output_config: Optional[OutputConfigType],
    *,
    language: str = "PYTHON",
) -> tuple[Optional[str], Optional[float], Optional[str]]:
    """Coerce a raw sandbox return value to (label, score, explanation).

    ``language`` is only used to render code examples in error messages.
    Raises ``ValueError`` when ``value`` is incompatible with ``output_config``.
    """
    if isinstance(value, (list, tuple)) and output_config is None:
        raise ValueError(
            f"Unsupported output type {type(value).__name__!r}: {value!r}. "
            f"Without an output config, accepted shapes are: bare scalar "
            f"(str, int, float, bool, None) or a dict with keys from "
            f"{sorted(_DICT_KEYS)!r}."
        )

    # Catch bool before _extract_triple coerces it to label="True".
    if isinstance(output_config, ContinuousOutputConfig) and isinstance(value, bool):
        raise ValueError(f"Expected a numeric value for continuous output, got bool: {value!r}")

    triple = _extract_triple(value)
    _validate_field_types(triple)

    if output_config is None:
        validated = _validate_triple_bare(value, triple)
    elif isinstance(output_config, CategoricalOutputConfig):
        validated = _validate_triple_categorical(triple, output_config, language)
    elif isinstance(output_config, ContinuousOutputConfig):
        validated = _validate_triple_continuous(triple, output_config, language)
    else:
        validated = _validate_triple_bare(value, triple)

    return (validated.label, validated.score, validated.explanation)


def _mask_attrs(
    attrs: dict[str, Any],
    masker: SandboxSecretMasker,
) -> dict[str, Any]:
    return {k: masker.mask(v) if isinstance(v, str) else v for k, v in attrs.items()}


def _set_masked_status(
    span: Any,
    status_code: StatusCode,
    description: str,
    masker: SandboxSecretMasker,
) -> None:
    span.set_status(Status(status_code, masker.mask(description)))


def _record_masked_exception(
    span: Any,
    exc: BaseException,
    masker: SandboxSecretMasker,
) -> None:
    span.add_event(
        "exception",
        {
            "exception.type": type(exc).__name__,
            "exception.message": masker.mask(str(exc)),
            "exception.stacktrace": masker.mask(_traceback.format_exc()),
        },
    )


class CodeEvaluatorRunner(BaseEvaluator):
    """Evaluator that executes user-provided source code in a sandbox."""

    def __init__(
        self,
        name: str,
        description: Optional[str],
        source_code: str,
        stored_output_configs: Sequence[OutputConfigType],
        sandbox_backend: SandboxBackend,
        language: str,
        sandbox_session_manager: Optional[SandboxSessionManager],
        timeout: Optional[int] = None,
        runner_timeout: Optional[float] = None,
        evaluator_version_id: Optional[str] = None,
        session_key: Optional[str] = None,
        max_payload_bytes: Optional[int] = None,
        payload_limit_remediation: str = DEFAULT_PAYLOAD_LIMIT_REMEDIATION,
    ) -> None:
        self._name = name
        self._description = description
        self._source_code = source_code
        self._stored_output_configs = list(stored_output_configs)
        self._sandbox_backend: SandboxBackend = sandbox_backend
        self._language = language.upper()
        self._timeout = timeout
        self._runner_timeout = runner_timeout if runner_timeout is not None else timeout
        self._evaluator_version_id = evaluator_version_id
        self._max_payload_bytes = max_payload_bytes
        self._payload_limit_remediation = payload_limit_remediation
        # ``session_key`` is required on the managed path; the ephemeral
        # path does not consult it.
        if sandbox_session_manager is not None and session_key is None:
            raise ValueError(
                "CodeEvaluatorRunner: session_key is required when "
                "sandbox_session_manager is supplied."
            )
        self._session_key = session_key
        self._sandbox_session_manager = sandbox_session_manager

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> Optional[str]:
        return self._description

    @property
    def output_configs(self) -> Sequence[OutputConfigType]:
        return self._stored_output_configs

    @property
    def input_schema(self) -> dict[str, Any]:
        schema, _ = self._infer_input_schema()
        return schema

    def _infer_input_schema(self) -> tuple[dict[str, Any], Optional[str]]:
        if self._language == "PYTHON":
            return infer_python_evaluate_input_schema(self._source_code)
        if self._language == "TYPESCRIPT":
            return infer_typescript_evaluate_input_schema(self._source_code)
        return ({}, None)

    def _build_python_harness(self, mapped_inputs: dict[str, Any]) -> str:
        return (
            f"{self._source_code}\n\n"
            f"import json as _json\n"
            f"_inputs = {mapped_inputs!r}\n"
            f"_result = evaluate(**_inputs)\n"
            f"print('{PHOENIX_RESULT_BEGIN}')\n"
            f"print(_json.dumps(_result))\n"
            f"print('{PHOENIX_RESULT_END}')\n"
        )

    def _build_monty_harness(self) -> str:
        return f"{self._source_code}\n\nevaluate(**_inputs)\n"

    def _build_typescript_harness(self, mapped_inputs: dict[str, Any]) -> str:
        inputs_json = json.dumps(mapped_inputs)
        return (
            f"{self._source_code}\n\n"
            f"const _inputs = {inputs_json};\n"
            f"const _run = async () => {{\n"
            f"  const _result = await evaluate(_inputs);\n"
            f"  console.log('{PHOENIX_RESULT_BEGIN}');\n"
            f"  console.log(JSON.stringify(_result));\n"
            f"  console.log('{PHOENIX_RESULT_END}');\n"
            f"}};\n"
            f"await _run();\n"
        )

    def _make_error_result(
        self,
        name: str,
        error: str,
        start_time: datetime,
        trace_id: Optional[str] = None,
        error_exc: Optional[Exception] = None,
    ) -> EvaluationResult:
        result = EvaluationResult(
            name=name,
            annotator_kind="CODE",
            label=None,
            score=None,
            explanation=None,
            metadata={},
            error=error,
            trace_id=trace_id,
            start_time=start_time,
            end_time=datetime.now(timezone.utc),
        )
        if error_exc is not None:
            result["error_exc"] = error_exc
        return result

    async def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_configs: Sequence[OutputConfigType],
        tracer: Optional[Tracer] = None,
    ) -> list[EvaluationResult]:
        start_time = datetime.now(timezone.utc)
        tracer_ = tracer or NoOpTracer()
        masker = SandboxSecretMasker(self._sandbox_backend.secret_values)

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes=_mask_attrs(
                {
                    **oi.get_span_kind_attributes("evaluator"),
                    **oi.get_input_attributes(context),
                },
                masker,
            ),
            context=Context(),
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )

            input_schema, inference_error = self._infer_input_schema()
            if inference_error is not None:
                evaluator_span.set_status(Status(StatusCode.ERROR, inference_error))
                return [
                    self._make_error_result(name, inference_error, start_time, trace_id=trace_id)
                    for _ in (output_configs or [None])  # type: ignore[list-item]
                ]

            # OTel auto-record is disabled so explicit masked exception
            # records below are the only thing persisted on these spans.
            with tracer_.start_as_current_span(
                "Input Mapping",
                attributes=_mask_attrs(
                    {
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                    masker,
                ),
                record_exception=False,
                set_status_on_exception=False,
            ) as input_mapping_span:
                try:
                    mapped_inputs = apply_input_mapping(
                        input_schema=input_schema,
                        input_mapping=input_mapping,
                        context=context,
                    )
                    input_mapping_span.set_attributes(
                        _mask_attrs(oi.get_output_attributes(mapped_inputs), masker)
                    )
                    input_mapping_span.set_status(Status(StatusCode.OK))
                except Exception as exc:
                    err = f"Input mapping failed: {exc}"
                    _record_masked_exception(input_mapping_span, exc, masker)
                    _set_masked_status(input_mapping_span, StatusCode.ERROR, err, masker)
                    _record_masked_exception(evaluator_span, exc, masker)
                    _set_masked_status(evaluator_span, StatusCode.ERROR, err, masker)
                    return [
                        self._make_error_result(
                            name, err, start_time, trace_id=trace_id, error_exc=exc
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]

            if self._language == "PYTHON":
                if self._sandbox_backend.provider == "MONTY":
                    code = self._build_monty_harness()
                    baseline_code = code
                else:
                    code = self._build_python_harness(mapped_inputs)
                    baseline_code = self._build_python_harness({})
            else:
                code = self._build_typescript_harness(mapped_inputs)
                baseline_code = self._build_typescript_harness({})

            if self._max_payload_bytes is not None:
                payload_bytes = len(code.encode("utf-8"))
                if payload_bytes > self._max_payload_bytes:
                    source_and_harness_bytes = len(baseline_code.encode("utf-8"))
                    mapped_input_bytes = max(payload_bytes - source_and_harness_bytes, 0)
                    dominant_component = (
                        "evaluator source and harness"
                        if source_and_harness_bytes >= mapped_input_bytes
                        else "mapped inputs"
                    )
                    err = (
                        f"Rendered sandbox payload is {payload_bytes} bytes, which exceeds the "
                        f"allowed {self._max_payload_bytes} bytes. The dominant component is "
                        f"{dominant_component} ({source_and_harness_bytes} source/harness bytes; "
                        f"{mapped_input_bytes} mapped-input bytes). "
                        f"{self._payload_limit_remediation}"
                    )
                    error_exc = SandboxPayloadTooLargeError(err)
                    evaluator_span.set_status(Status(StatusCode.ERROR, err))
                    return [
                        self._make_error_result(
                            name,
                            err,
                            start_time,
                            trace_id=trace_id,
                            error_exc=error_exc,
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]

            session_key = self._session_key or ""

            sandbox_metadata: dict[str, Any] = {
                "backend_type": type(self._sandbox_backend).__name__,
                "language": self._language,
            }
            if self._timeout is not None:
                sandbox_metadata["timeout"] = int(self._timeout)
            if self._evaluator_version_id is not None:
                sandbox_metadata["code_evaluator_version_id"] = self._evaluator_version_id

            with tracer_.start_as_current_span(
                f"Sandbox: {self._name}",
                attributes=_mask_attrs(
                    {
                        **oi.get_span_kind_attributes("tool"),
                        **oi.get_tool_attributes(
                            name=self._name,
                            description=self._description,
                            parameters=input_schema,
                        ),
                        **oi.get_input_attributes(mapped_inputs),
                    },
                    masker,
                ),
                record_exception=False,
                set_status_on_exception=False,
            ) as sandbox_span:
                try:
                    if self._sandbox_session_manager is None or isinstance(
                        self._sandbox_backend, BaseNoSessionBackend
                    ):
                        # Ephemeral path: backend.execute owns the sandbox
                        # lifecycle (created and torn down inside the call).
                        async def _ephemeral_execute() -> ExecutionResult:
                            try:
                                return await self._sandbox_backend.execute_with_inputs(
                                    code,
                                    session_key=session_key,
                                    inputs={"_inputs": mapped_inputs},
                                    timeout=self._timeout,
                                )
                            except asyncio.TimeoutError as exc:
                                raise SandboxBackendTimeoutError(
                                    "SANDBOX_BACKEND_TIMEOUT: sandbox backend deadline exceeded"
                                ) from exc

                        execution = await asyncio.wait_for(
                            run_cancel_once(_ephemeral_execute()),
                            timeout=self._runner_timeout,
                        )
                    else:
                        # Managed path: ``wait_for`` brackets acquire+execute
                        # so the slow ``find_or_create_session`` leg also
                        # respects the evaluator timeout. ``SessionInvalidated``
                        # is transient (entry mid-drain) — wait once and retry.
                        async def _managed_execute() -> ExecutionResult:
                            assert self._sandbox_session_manager is not None
                            manager = self._sandbox_session_manager

                            async def _execute(session: Any) -> ExecutionResult:
                                try:
                                    return cast(
                                        ExecutionResult,
                                        await session.execute(code, timeout=self._timeout),
                                    )
                                except asyncio.TimeoutError as exc:
                                    raise SandboxBackendTimeoutError(
                                        "SANDBOX_BACKEND_TIMEOUT: sandbox backend deadline exceeded"
                                    ) from exc

                            try:
                                async with manager.acquire(
                                    self._sandbox_backend, session_key
                                ) as session:
                                    return await _execute(session)
                            except SessionInvalidated:
                                await manager.wait_for_drain(session_key, self._sandbox_backend)
                                async with manager.acquire(
                                    self._sandbox_backend, session_key
                                ) as session:
                                    return await _execute(session)

                        execution = await asyncio.wait_for(
                            run_cancel_once(_managed_execute()), timeout=self._runner_timeout
                        )
                except SessionLimitExceeded as exc:
                    err = SessionLimitExceeded.MESSAGE
                    _record_masked_exception(sandbox_span, exc, masker)
                    _set_masked_status(sandbox_span, StatusCode.ERROR, err, masker)
                    _record_masked_exception(evaluator_span, exc, masker)
                    _set_masked_status(evaluator_span, StatusCode.ERROR, err, masker)
                    return [
                        self._make_error_result(
                            name, err, start_time, trace_id=trace_id, error_exc=exc
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]
                except SessionInvalidated as exc:
                    err = SessionInvalidated.MESSAGE
                    _record_masked_exception(sandbox_span, exc, masker)
                    _set_masked_status(sandbox_span, StatusCode.ERROR, err, masker)
                    _record_masked_exception(evaluator_span, exc, masker)
                    _set_masked_status(evaluator_span, StatusCode.ERROR, err, masker)
                    return [
                        self._make_error_result(
                            name, err, start_time, trace_id=trace_id, error_exc=exc
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]
                except SandboxBackendTimeoutError as exc:
                    err = str(exc)
                    _record_masked_exception(sandbox_span, exc, masker)
                    _set_masked_status(sandbox_span, StatusCode.ERROR, err, masker)
                    _record_masked_exception(evaluator_span, exc, masker)
                    _set_masked_status(evaluator_span, StatusCode.ERROR, err, masker)
                    return [
                        self._make_error_result(
                            name, err, start_time, trace_id=trace_id, error_exc=exc
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]
                except asyncio.TimeoutError as exc:
                    # Managed path: route teardown through the manager so
                    # the tracked entry is dropped (acquire's finally only
                    # decrements in_flight) and the task is awaited at
                    # shutdown. Ephemeral path: backend.execute's async-with
                    # already kills the sandbox on cancellation.
                    if self._sandbox_session_manager is not None:
                        self._sandbox_session_manager.schedule_eviction(
                            session_key, self._sandbox_backend
                        )
                    timeout_exc = SandboxRunnerTimeoutError(
                        "SANDBOX_RUNNER_TIMEOUT: sandbox runner deadline exceeded"
                    )
                    execution = ExecutionResult(stdout="", stderr="", error=str(timeout_exc))
                    sandbox_span.set_attributes(
                        _mask_attrs(
                            oi.get_metadata_attributes(
                                metadata={**sandbox_metadata, "error": str(timeout_exc)}
                            ),
                            masker,
                        )
                    )
                    _record_masked_exception(sandbox_span, exc, masker)
                    sandbox_span.set_status(Status(StatusCode.ERROR, str(timeout_exc)))
                    _record_masked_exception(evaluator_span, exc, masker)
                    evaluator_span.set_status(Status(StatusCode.ERROR, str(timeout_exc)))
                    return [
                        self._make_error_result(
                            name,
                            execution.error or str(timeout_exc),
                            start_time,
                            trace_id=trace_id,
                            error_exc=timeout_exc,
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]
                except UnsupportedOperation as exc:
                    err = f"Sandbox backend does not support this operation: {exc}"
                    sandbox_span.set_attributes(
                        _mask_attrs(
                            oi.get_metadata_attributes(metadata={**sandbox_metadata, "error": err}),
                            masker,
                        )
                    )
                    _record_masked_exception(sandbox_span, exc, masker)
                    _set_masked_status(sandbox_span, StatusCode.ERROR, err, masker)
                    _record_masked_exception(evaluator_span, exc, masker)
                    _set_masked_status(evaluator_span, StatusCode.ERROR, err, masker)
                    return [
                        self._make_error_result(
                            name, err, start_time, trace_id=trace_id, error_exc=exc
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]
                except MontyServiceError:
                    raise
                except Exception as exc:
                    err = f"Sandbox execution failed: {exc}"
                    sandbox_span.set_attributes(
                        _mask_attrs(
                            oi.get_metadata_attributes(metadata={**sandbox_metadata, "error": err}),
                            masker,
                        )
                    )
                    _record_masked_exception(sandbox_span, exc, masker)
                    _set_masked_status(sandbox_span, StatusCode.ERROR, err, masker)
                    _record_masked_exception(evaluator_span, exc, masker)
                    _set_masked_status(evaluator_span, StatusCode.ERROR, err, masker)
                    return [
                        self._make_error_result(
                            name, err, start_time, trace_id=trace_id, error_exc=exc
                        )
                        for _ in (output_configs or [None])  # type: ignore[list-item]
                    ]

                fenced_text, non_fenced_stdout = extract_framed_result(execution.stdout)

                raw_value: Any = None
                parse_error: Optional[str] = None
                if not execution.error:
                    if fenced_text is None:
                        parse_error = "no result markers found"
                    else:
                        try:
                            raw_value = json.loads(fenced_text)
                        except json.JSONDecodeError as exc:
                            parse_error = f"result JSON parse failed: {exc.msg}"

                # Single OI metadata write — repeated writes overwrite, not merge.
                merged_metadata = dict(sandbox_metadata)
                if non_fenced_stdout:
                    merged_metadata["stdout"] = non_fenced_stdout
                if execution.stderr:
                    merged_metadata["stderr"] = execution.stderr
                if parse_error is not None:
                    merged_metadata["parse_error"] = parse_error
                if execution.error and not parse_error:
                    merged_metadata["error"] = execution.error
                sandbox_span.set_attributes(
                    _mask_attrs(
                        oi.get_metadata_attributes(metadata=merged_metadata),
                        masker,
                    )
                )

                if execution.error:
                    _set_masked_status(sandbox_span, StatusCode.ERROR, execution.error, masker)
                elif parse_error is not None:
                    if fenced_text is not None:
                        sandbox_span.set_attributes(
                            _mask_attrs(
                                oi.get_output_attributes(fenced_text, mime_type="text/plain"),
                                masker,
                            )
                        )
                    _set_masked_status(sandbox_span, StatusCode.ERROR, parse_error, masker)
                else:
                    sandbox_span.set_attributes(
                        _mask_attrs(oi.get_output_attributes(raw_value), masker)
                    )
                    sandbox_span.set_status(Status(StatusCode.OK))

            if execution.error:
                _set_masked_status(evaluator_span, StatusCode.ERROR, execution.error, masker)
                execution_error_exc = SandboxBackendExecutionError(
                    f"SANDBOX_BACKEND_ERROR: {execution.error}"
                )
                return [
                    self._make_error_result(
                        name,
                        execution.error,
                        start_time,
                        trace_id=trace_id,
                        error_exc=execution_error_exc,
                    )
                    for _ in (output_configs or [None])  # type: ignore[list-item]
                ]

            multi_output = len(output_configs) > 1

            # Route per-config when raw_value is a dict covering every config.name.
            routed = (
                parse_error is None
                and multi_output
                and isinstance(raw_value, dict)
                and all(c.name in raw_value for c in output_configs)
            )
            shared_explanation: Optional[str] = None
            if routed and isinstance(raw_value, dict):
                top_level_explanation = raw_value.get("explanation")
                if isinstance(top_level_explanation, str):
                    shared_explanation = top_level_explanation

            results: list[EvaluationResult] = []
            any_coerce_error = False
            last_coerce_error: Optional[str] = None
            parse_input: Any
            if parse_error is None:
                parse_input = raw_value
            else:
                parse_input = fenced_text if fenced_text is not None else ""
            with tracer_.start_as_current_span(
                "Parse Eval Result",
                attributes=_mask_attrs(
                    {
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(parse_input),
                    },
                    masker,
                ),
                record_exception=False,
                set_status_on_exception=False,
            ) as parse_span:
                for annotation_name, config in zip(
                    result_annotation_names(name, output_configs), output_configs
                ):
                    if parse_error is not None:
                        any_coerce_error = True
                        last_coerce_error = parse_error
                        results.append(
                            self._make_error_result(
                                annotation_name, parse_error, start_time, trace_id=trace_id
                            )
                        )
                        continue
                    coerce_value = (
                        raw_value[config.name]
                        if routed and isinstance(raw_value, dict)
                        else raw_value
                    )
                    try:
                        label, score, explanation = coerce_output(
                            coerce_value, config, language=self._language
                        )
                    except ValueError as exc:
                        any_coerce_error = True
                        last_coerce_error = str(exc)
                        results.append(
                            self._make_error_result(
                                annotation_name, str(exc), start_time, trace_id=trace_id
                            )
                        )
                        continue
                    if explanation is None:
                        explanation = shared_explanation
                    results.append(
                        EvaluationResult(
                            name=annotation_name,
                            annotator_kind="CODE",
                            label=label,
                            score=score,
                            explanation=explanation,
                            metadata={},
                            error=None,
                            trace_id=trace_id,
                            start_time=start_time,
                            end_time=datetime.now(timezone.utc),
                        )
                    )

                parse_span.set_attributes(
                    _mask_attrs(
                        oi.get_output_attributes(
                            {
                                "results": [
                                    {
                                        "name": r["name"],
                                        "label": r["label"],
                                        "score": r["score"],
                                        "explanation": r["explanation"],
                                        "error": r["error"],
                                    }
                                    for r in results
                                ]
                            }
                        ),
                        masker,
                    )
                )
                if any_coerce_error:
                    _set_masked_status(
                        parse_span, StatusCode.ERROR, last_coerce_error or "coerce failed", masker
                    )
                else:
                    parse_span.set_status(Status(StatusCode.OK))

            evaluator_span.set_attributes(
                _mask_attrs(
                    dict(oi.get_output_attributes(raw_value)),
                    masker,
                )
            )
            if any_coerce_error:
                _set_masked_status(
                    evaluator_span, StatusCode.ERROR, last_coerce_error or "coerce failed", masker
                )
            else:
                evaluator_span.set_status(Status(StatusCode.OK))

        return results
