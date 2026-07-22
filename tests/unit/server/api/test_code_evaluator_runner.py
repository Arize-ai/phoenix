from __future__ import annotations

import json
from typing import Any, ClassVar, Optional, cast
from unittest.mock import AsyncMock

import pytest
from openinference.semconv.trace import SpanAttributes
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode, Tracer

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.evaluators import (
    _PHOENIX_RESULT_BEGIN,
    _PHOENIX_RESULT_END,
    CodeEvaluatorRunner,
)
from phoenix.server.api.helpers.sandbox_redaction import SandboxSecretMasker
from phoenix.server.sandbox.monty_backend import MontySandboxBackend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import BaseNoSessionBackend, ExecutionResult


class _StatelessTestBackend(BaseNoSessionBackend):
    """Stateless test backend with an AsyncMock-backed ``execute``.

    Stateless (``BaseNoSessionBackend``) backends short-circuit the manager's
    ``acquire`` to a sentinel handle; ``execute_in_session`` delegates to
    ``execute``. Tests configure ``backend.execute`` directly (as an
    AsyncMock) and assert via ``backend.execute.call_args`` /
    ``assert_not_called`` / ``return_value`` / ``side_effect``.
    """

    family: ClassVar[str] = "TEST"

    def __init__(self, secret_values: Optional[frozenset[str]] = None) -> None:
        self.secret_values = secret_values or frozenset()
        # AsyncMock satisfies the awaitable signature of ``execute``.
        self.execute = AsyncMock()  # type: ignore[method-assign]

    async def execute(
        self,
        code: str,
        session_key: str = "",
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        # Stub satisfying the SandboxBackend abstract contract; replaced
        # per-instance by an AsyncMock above. Never reached at runtime.
        raise NotImplementedError

    async def close(self) -> None:
        return None


def _fenced(payload: str) -> str:
    return f"{_PHOENIX_RESULT_BEGIN}\n{payload}\n{_PHOENIX_RESULT_END}\n"


OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
METADATA = SpanAttributes.METADATA
TOOL_NAME = SpanAttributes.TOOL_NAME
TOOL_PARAMETERS = SpanAttributes.TOOL_PARAMETERS


def _categorical_config(name: str = "score") -> CategoricalOutputConfig:
    return CategoricalOutputConfig(
        type="CATEGORICAL",
        name=name,
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description="",
        values=[
            CategoricalAnnotationValue(label="pass", score=1.0),
            CategoricalAnnotationValue(label="fail", score=0.0),
        ],
    )


def _continuous_config(name: str = "score") -> ContinuousOutputConfig:
    return ContinuousOutputConfig(
        type="CONTINUOUS",
        name=name,
        optimization_direction=OptimizationDirection.MAXIMIZE,
        description="",
    )


def _make_runner(
    source_code: str = 'def evaluate(**kw): return "pass"',
    language: str = "PYTHON",
    backend_stdout: str = '"pass"',
    backend_error: str | None = None,
    backend_raises: Exception | None = None,
    timeout: int | None = None,
    fence_stdout: bool = True,
    evaluator_version_id: str | None = None,
) -> tuple[CodeEvaluatorRunner, Any]:
    backend = _StatelessTestBackend()
    mock_execute = cast(AsyncMock, backend.execute)
    if backend_raises is not None:
        mock_execute.side_effect = backend_raises
    else:
        stdout = _fenced(backend_stdout) if fence_stdout else backend_stdout
        mock_execute.return_value = ExecutionResult(
            stdout=stdout,
            stderr="",
            error=backend_error,
        )
    runner = CodeEvaluatorRunner(
        name="test-runner",
        description=None,
        source_code=source_code,
        stored_output_configs=[_categorical_config()],
        sandbox_backend=backend,
        language=language,
        timeout=timeout,
        evaluator_version_id=evaluator_version_id,
        sandbox_session_manager=SandboxSessionManager(),
        session_key="evaluator:test-runner",
    )
    return runner, backend


_EMPTY_MAPPING = InputMapping(literal_mapping={}, path_mapping={})


class TestHarnessGeneration:
    def test_python_harness_contains_source_code(self) -> None:
        runner, _ = _make_runner(source_code="def evaluate(**kw): return 1")
        harness = runner._build_python_harness({"x": 1})
        assert "def evaluate(**kw): return 1" in harness

    def test_python_harness_embeds_inputs_as_native_literal(self) -> None:
        runner, _ = _make_runner()
        harness = runner._build_python_harness({"key": "value"})
        assert "_inputs = {'key': 'value'}" in harness
        assert "_json.loads(" not in harness
        assert "json.loads(" not in harness

    def test_python_harness_contains_input_values(self) -> None:
        runner, _ = _make_runner()
        harness = runner._build_python_harness({"city": "Paris"})
        assert "Paris" in harness

    def test_typescript_harness_contains_source_code(self) -> None:
        runner, _ = _make_runner(
            source_code="function evaluate(x) { return 1; }", language="TYPESCRIPT"
        )
        harness = runner._build_typescript_harness({"x": 1})
        assert "function evaluate(x)" in harness

    def test_typescript_harness_contains_json_stringify(self) -> None:
        runner, _ = _make_runner(language="TYPESCRIPT")
        harness = runner._build_typescript_harness({"k": "v"})
        assert "JSON.stringify" in harness

    def test_typescript_harness_awaits_evaluate_result(self) -> None:
        runner, _ = _make_runner(language="TYPESCRIPT")
        harness = runner._build_typescript_harness({"k": "v"})
        assert "const _run = async () => {" in harness
        assert "await evaluate(_inputs)" in harness
        assert "await _run();" in harness

    def test_typescript_harness_wraps_result_in_sentinels(self) -> None:
        from phoenix.server.api.evaluators import (
            _TYPESCRIPT_RESULT_BEGIN,
            _TYPESCRIPT_RESULT_END,
        )

        runner, _ = _make_runner(language="TYPESCRIPT")
        harness = runner._build_typescript_harness({"k": "v"})
        assert _TYPESCRIPT_RESULT_BEGIN in harness
        assert _TYPESCRIPT_RESULT_END in harness
        begin_idx = harness.index(_TYPESCRIPT_RESULT_BEGIN)
        end_idx = harness.index(_TYPESCRIPT_RESULT_END)
        between = harness[begin_idx:end_idx]
        assert "JSON.stringify(_result)" in between


class TestInputSchemaInference:
    def test_python_input_schema_infers_top_level_parameters(self) -> None:
        runner, _ = _make_runner(
            source_code=(
                "def evaluate(output, reference=None, input=None, *, metadata=None):\n"
                "    return 1\n"
            )
        )

        assert runner.input_schema == {
            "type": "object",
            "properties": {
                "output": {},
                "reference": {},
                "input": {},
                "metadata": {},
            },
            "required": ["output"],
        }

    def test_typescript_input_schema_infers_destructured_parameters(self) -> None:
        runner, _ = _make_runner(
            source_code=(
                "function evaluate({ output, reference, input, metadata }: EvaluatorParams) "
                "{ return 1; }"
            ),
            language="TYPESCRIPT",
        )

        assert runner.input_schema == {
            "type": "object",
            "properties": {
                "output": {},
                "reference": {},
                "input": {},
                "metadata": {},
            },
            "required": [],
        }

    def test_python_input_schema_returns_error_when_evaluate_is_missing(self) -> None:
        runner, _ = _make_runner(source_code="def not_evaluate(output):\n    return 1\n")

        schema, error = runner._infer_input_schema()
        assert schema == {}
        assert error is not None
        assert "no top-level `evaluate(...)` function was found" in error

    def test_typescript_input_schema_returns_error_for_non_destructured_signature(self) -> None:
        runner, _ = _make_runner(
            source_code="function evaluate(output: EvaluatorParams) { return 1; }",
            language="TYPESCRIPT",
        )

        schema, error = runner._infer_input_schema()
        assert schema == {}
        assert error is not None
        assert "Use a destructured object parameter" in error

    def test_python_input_schema_returns_error_for_unsupported_parameter_names(self) -> None:
        runner, _ = _make_runner(
            source_code="def evaluate(outputs, reference=None):\n    return 1\n"
        )

        schema, error = runner._infer_input_schema()
        assert schema == {}
        assert error is not None
        assert "unsupported parameter names: `outputs`" in error

    def test_typescript_input_schema_returns_error_for_unsupported_parameter_names(self) -> None:
        runner, _ = _make_runner(
            source_code=(
                "function evaluate({ outputs, reference, input, metadata }: EvaluatorParams) "
                "{ return 1; }"
            ),
            language="TYPESCRIPT",
        )

        schema, error = runner._infer_input_schema()
        assert schema == {}
        assert error is not None
        assert "unsupported parameter names: `outputs`" in error


class TestEvaluateSuccessPath:
    async def test_monty_returns_existing_evaluator_result_shape(self) -> None:
        runner = CodeEvaluatorRunner(
            name="monty-runner",
            description=None,
            source_code=(
                "def evaluate(output):\n    return {'label': 'pass', 'score': output['score']}"
            ),
            stored_output_configs=[_categorical_config()],
            sandbox_backend=MontySandboxBackend(),
            language="PYTHON",
            sandbox_session_manager=SandboxSessionManager(),
            session_key="evaluator:monty-runner",
            timeout=1,
        )

        results = await runner.evaluate(
            context={"output": {"score": 1.0}},
            input_mapping=_EMPTY_MAPPING,
            name="monty",
            output_configs=[_categorical_config()],
        )

        assert results[0]["label"] == "pass"
        assert results[0]["score"] == 1.0
        assert results[0]["error"] is None

    async def test_returns_label_from_stdout(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert len(results) == 1
        assert results[0]["label"] == "pass"
        assert results[0]["error"] is None

    async def test_returns_score_from_continuous_stdout(self) -> None:
        runner, _ = _make_runner(backend_stdout="0.85")
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )
        assert results[0]["score"] == pytest.approx(0.85)

    async def test_annotator_kind_is_code(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert results[0]["annotator_kind"] == "CODE"

    async def test_timeout_forwarded_to_backend_execute(self) -> None:
        runner, backend = _make_runner(backend_stdout='"pass"', timeout=45)
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        call_kwargs = backend.execute.call_args
        assert call_kwargs.kwargs.get("timeout") == 45

    async def test_none_timeout_forwarded_to_backend_execute(self) -> None:
        runner, backend = _make_runner(backend_stdout='"pass"', timeout=None)
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        call_kwargs = backend.execute.call_args
        assert call_kwargs.kwargs.get("timeout") is None

    async def test_python_evaluate_auto_passes_context_keys_matching_signature(self) -> None:
        runner, backend = _make_runner(source_code="def evaluate(output, reference=None): return 1")

        await runner.evaluate(
            context={"output": {"answer": "a"}, "reference": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )

        call_args = backend.execute.call_args
        code_arg = call_args.args[0] if call_args.args else call_args.kwargs.get("code", "")
        assert "'output': {'answer': 'a'}" in code_arg
        assert "'reference': {'answer': 'a'}" in code_arg

    async def test_typescript_evaluate_auto_passes_context_keys_matching_signature(self) -> None:
        runner, backend = _make_runner(
            source_code=("function evaluate({ output, reference }: EvaluatorParams) { return 1; }"),
            language="TYPESCRIPT",
            backend_stdout="1",
        )

        await runner.evaluate(
            context={"output": {"answer": "a"}, "reference": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )

        call_args = backend.execute.call_args
        code_arg = call_args.args[0] if call_args.args else call_args.kwargs.get("code", "")
        assert '"output": {"answer": "a"}' in code_arg
        assert '"reference": {"answer": "a"}' in code_arg


class TestEvaluateErrorPaths:
    async def test_inference_failure_returns_human_readable_python_error(self) -> None:
        runner, backend = _make_runner(source_code="def not_evaluate(output): return 1")

        results = await runner.evaluate(
            context={"output": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test_py",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] is not None
        assert "no top-level `evaluate(...)` function was found" in results[0]["error"]
        backend.execute.assert_not_called()

    async def test_inference_failure_returns_human_readable_typescript_error(self) -> None:
        runner, backend = _make_runner(
            source_code="function evaluate(output: EvaluatorParams) { return 1; }",
            language="TYPESCRIPT",
        )

        results = await runner.evaluate(
            context={"output": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test_ts",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] is not None
        assert "Use a destructured object parameter" in results[0]["error"]
        backend.execute.assert_not_called()

    async def test_inference_failure_returns_human_readable_error_for_renamed_typescript_param(
        self,
    ) -> None:
        runner, backend = _make_runner(
            source_code=(
                "function evaluate({ outputs, reference, input, metadata }: EvaluatorParams) { "
                "const candidate = typeof output?.answer === 'string' ? output.answer : ''; "
                "return 1; }"
            ),
            language="TYPESCRIPT",
        )

        results = await runner.evaluate(
            context={"output": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="pytest",
            output_configs=[_categorical_config()],
        )

        assert len(results) == 1
        assert results[0]["error"] is not None
        assert "unsupported parameter names: `outputs`" in results[0]["error"]
        backend.execute.assert_not_called()

    async def test_input_mapping_failure_returns_error_result(self) -> None:
        runner, _ = _make_runner()
        bad_mapping = InputMapping(
            literal_mapping={},
            path_mapping={"x": "$.nonexistent.path"},
        )
        results = await runner.evaluate(
            context={"other": "data"},
            input_mapping=bad_mapping,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert len(results) == 1
        assert results[0]["error"] is not None
        assert "Input mapping failed" in results[0]["error"]

    async def test_backend_raises_returns_error_result(self) -> None:
        runner, _ = _make_runner(backend_raises=RuntimeError("timeout"))
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert len(results) == 1
        assert results[0]["error"] is not None
        assert "Sandbox execution failed" in results[0]["error"]

    async def test_backend_error_field_returns_error_result(self) -> None:
        runner, _ = _make_runner(backend_error="SyntaxError: invalid syntax")
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert results[0]["error"] == "SyntaxError: invalid syntax"


class TestBackendConfiguration:
    async def test_no_backend_execute_returns_error_result(self) -> None:
        runner, _ = _make_runner(backend_raises=RuntimeError("no backend configured"))
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert len(results) == 1
        assert results[0]["error"] is not None
        assert "Sandbox execution failed" in results[0]["error"]
        assert "no backend configured" in results[0]["error"]

    async def test_language_stored_normalized_to_uppercase(self) -> None:
        runner, _ = _make_runner(language="python")
        assert runner._language == "PYTHON"

    async def test_typescript_language_uses_typescript_harness(self) -> None:
        runner, backend = _make_runner(
            source_code=(
                "function evaluate({ output }: EvaluatorParams) { return output ? 1 : 0; }"
            ),
            language="TYPESCRIPT",
            backend_stdout="1",
        )
        await runner.evaluate(
            context={"output": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )
        call_args = backend.execute.call_args
        code_arg = call_args.args[0] if call_args.args else call_args.kwargs.get("code", "")
        assert "JSON.stringify" in code_arg
        assert "console.log" in code_arg
        assert "await evaluate(_inputs)" in code_arg

    async def test_async_typescript_evaluator_source_is_wrapped_correctly(self) -> None:
        runner, backend = _make_runner(
            source_code=(
                "async function evaluate({ output }: EvaluatorParams) { return output ? 1 : 0; }"
            ),
            language="TYPESCRIPT",
            backend_stdout="1",
        )
        await runner.evaluate(
            context={"output": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )
        call_args = backend.execute.call_args
        code_arg = call_args.args[0] if call_args.args else call_args.kwargs.get("code", "")
        assert "async function evaluate" in code_arg
        assert "const _run = async () => {" in code_arg
        assert "await evaluate(_inputs)" in code_arg
        assert "await _run();" in code_arg

    async def test_typescript_polluted_stdout_extracts_sentinel_wrapped_result(
        self,
    ) -> None:
        from phoenix.server.api.evaluators import (
            _TYPESCRIPT_RESULT_BEGIN,
            _TYPESCRIPT_RESULT_END,
        )

        polluted = (
            f"{_TYPESCRIPT_RESULT_BEGIN}\n0.5\n{_TYPESCRIPT_RESULT_END}\n"
            "npm notice\n"
            "npm notice New minor version of npm available! 11.8.0 -> 11.14.1\n"
            "npm notice\n"
        )
        runner, _ = _make_runner(
            source_code=("function evaluate({ output }: EvaluatorParams) { return 0.5; }"),
            language="TYPESCRIPT",
            backend_stdout=polluted,
            fence_stdout=False,
        )
        results = await runner.evaluate(
            context={"output": {"answer": "a"}},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )
        assert len(results) == 1
        assert results[0]["error"] is None, results[0]["error"]
        assert results[0]["score"] == 0.5

    async def test_python_language_uses_python_harness(self) -> None:
        runner, backend = _make_runner(
            source_code='def evaluate(**kw): return "pass"',
            language="PYTHON",
            backend_stdout='"pass"',
        )
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        call_args = backend.execute.call_args
        code_arg = call_args.args[0] if call_args.args else call_args.kwargs.get("code", "")
        assert "_inputs = " in code_arg
        assert "print(_json.dumps(_result))" in code_arg
        assert _PHOENIX_RESULT_BEGIN in code_arg
        assert _PHOENIX_RESULT_END in code_arg


class TestMultiOutputEvaluate:
    async def test_one_result_per_config(self) -> None:
        payload = json.dumps("pass")
        runner, _ = _make_runner(backend_stdout=payload)
        configs = [_categorical_config("a"), _categorical_config("b")]
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="eval",
            output_configs=configs,
        )
        assert len(results) == 2

    async def test_annotation_name_includes_config_name_for_multi(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        configs = [_categorical_config("first"), _categorical_config("second")]
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="eval",
            output_configs=configs,
        )
        names = {r["name"] for r in results}
        assert "eval.first" in names
        assert "eval.second" in names

    async def test_single_output_name_has_no_config_suffix(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="myeval",
            output_configs=[_categorical_config("score")],
        )
        assert results[0]["name"] == "myeval"

    async def test_multi_output_naming_convention(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        configs = [_categorical_config("toxicity"), _categorical_config("safety")]
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="content-check",
            output_configs=configs,
        )
        names = {r["name"] for r in results}
        assert "content-check.toxicity" in names
        assert "content-check.safety" in names


class TestExplanationPlumbing:
    async def test_explanation_from_dict_label_is_plumbed_through(self) -> None:
        payload = json.dumps({"label": "pass", "explanation": "matched keywords"})
        runner, _ = _make_runner(backend_stdout=payload)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert results[0]["label"] == "pass"
        assert results[0]["explanation"] == "matched keywords"

    async def test_explanation_from_dict_score_is_plumbed_through(self) -> None:
        payload = json.dumps({"score": 0.75, "explanation": "moderate confidence"})
        runner, _ = _make_runner(backend_stdout=payload)
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_continuous_config()],
        )
        assert results[0]["score"] == pytest.approx(0.75)
        assert results[0]["explanation"] == "moderate confidence"

    async def test_bare_return_has_no_explanation(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        assert results[0]["explanation"] is None

    async def test_shared_explanation_fallback_in_multi_output_routing(self) -> None:
        payload = json.dumps(
            {
                "a": "pass",
                "b": "fail",
                "explanation": "shared rationale",
            }
        )
        runner, _ = _make_runner(backend_stdout=payload)
        configs = [_categorical_config("a"), _categorical_config("b")]
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="eval",
            output_configs=configs,
        )
        assert len(results) == 2
        for r in results:
            assert r["explanation"] == "shared rationale"

    async def test_per_config_explanation_wins_over_shared_fallback(self) -> None:
        payload = json.dumps(
            {
                "a": {"label": "pass", "explanation": "config-specific"},
                "b": "fail",
                "explanation": "shared fallback",
            }
        )
        runner, _ = _make_runner(backend_stdout=payload)
        configs = [_categorical_config("a"), _categorical_config("b")]
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="eval",
            output_configs=configs,
        )
        results_by_name = {r["name"]: r for r in results}
        assert results_by_name["eval.a"]["explanation"] == "config-specific"
        assert results_by_name["eval.b"]["explanation"] == "shared fallback"


def _make_tracer() -> tuple[Tracer, InMemorySpanExporter]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    return provider.get_tracer(__name__), exporter


class TestEvaluateTracing:
    async def test_happy_path_emits_four_spans_with_expected_attributes(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"', timeout=30)
        tracer, exporter = _make_tracer()

        results = await runner.evaluate(
            context={"output": "answer"},
            input_mapping=_EMPTY_MAPPING,
            name="my-eval",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans = exporter.get_finished_spans()
        names = {span.name for span in spans}
        assert names == {
            "Evaluator: my-eval",
            "Input Mapping",
            f"Sandbox: {runner._name}",
            "Parse Eval Result",
        }

        spans_by_name = {span.name: span for span in spans}
        evaluator_attrs = dict(spans_by_name["Evaluator: my-eval"].attributes or {})
        input_mapping_attrs = dict(spans_by_name["Input Mapping"].attributes or {})
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        parse_attrs = dict(spans_by_name["Parse Eval Result"].attributes or {})

        assert evaluator_attrs[OPENINFERENCE_SPAN_KIND] == "EVALUATOR"
        assert input_mapping_attrs[OPENINFERENCE_SPAN_KIND] == "CHAIN"
        assert sandbox_attrs[OPENINFERENCE_SPAN_KIND] == "TOOL"
        assert parse_attrs[OPENINFERENCE_SPAN_KIND] == "CHAIN"

        assert INPUT_VALUE in evaluator_attrs
        assert OUTPUT_VALUE in evaluator_attrs
        assert evaluator_attrs[OUTPUT_VALUE] == "pass"
        assert "code.value" not in evaluator_attrs
        assert "code.mime_type" not in evaluator_attrs

        raw_input_mapping = input_mapping_attrs[INPUT_VALUE]
        assert isinstance(raw_input_mapping, str)
        input_mapping_json = json.loads(raw_input_mapping)
        assert set(input_mapping_json.keys()) == {"input_mapping", "template_variables"}
        assert set(input_mapping_json["input_mapping"].keys()) == {
            "path_mapping",
            "literal_mapping",
        }

        assert sandbox_attrs[TOOL_NAME] == runner._name
        raw_tool_parameters = sandbox_attrs[TOOL_PARAMETERS]
        assert isinstance(raw_tool_parameters, str)
        assert json.loads(raw_tool_parameters) == runner.input_schema
        assert INPUT_VALUE in sandbox_attrs

        raw_sandbox_metadata = sandbox_attrs[METADATA]
        assert isinstance(raw_sandbox_metadata, str)
        sandbox_metadata = json.loads(raw_sandbox_metadata)
        assert sandbox_metadata["backend_type"] == "_StatelessTestBackend"
        assert sandbox_metadata["language"] == "PYTHON"
        assert sandbox_metadata["timeout"] == 30

        assert len(results) == 1
        assert results[0]["trace_id"] is not None

    async def test_timeout_omitted_when_not_configured(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"', timeout=None)
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        raw_sandbox_metadata = sandbox_attrs[METADATA]
        assert isinstance(raw_sandbox_metadata, str)
        assert "timeout" not in json.loads(raw_sandbox_metadata)

    async def test_no_tracer_yields_none_trace_id(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
        )
        assert results[0]["trace_id"] is None

    async def test_backend_error_field_sets_root_error_status_and_trace_id(self) -> None:
        runner, _ = _make_runner(backend_error="SyntaxError: bad")
        tracer, exporter = _make_tracer()

        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="err",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        evaluator_span = spans_by_name["Evaluator: err"]
        assert evaluator_span.status.status_code == StatusCode.ERROR

        assert not any(event.name == "exception" for event in evaluator_span.events)

        assert results[0]["trace_id"] is not None
        assert results[0]["error"] == "SyntaxError: bad"

    async def test_backend_raises_records_exception_on_root(self) -> None:
        runner, _ = _make_runner(backend_raises=RuntimeError("boom"))
        tracer, exporter = _make_tracer()

        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="err",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        evaluator_span = spans_by_name["Evaluator: err"]
        assert evaluator_span.status.status_code == StatusCode.ERROR
        assert any(event.name == "exception" for event in evaluator_span.events)
        assert results[0]["trace_id"] is not None


class TestSandboxSecretMasker:
    def test_masks_verbatim_secret_in_text(self) -> None:
        masker = SandboxSecretMasker({"supersecret123"})
        assert masker.mask("output: supersecret123") == "output: <redacted:0>"

    def test_short_secret_below_threshold_not_masked(self) -> None:
        masker = SandboxSecretMasker({"short"})
        assert masker.mask("output: short") == "output: short"

    def test_empty_secret_set_is_noop(self) -> None:
        masker = SandboxSecretMasker(set())
        assert masker.mask("output: supersecret123") == "output: supersecret123"

    def test_longest_first_prevents_prefix_corruption(self) -> None:
        masker = SandboxSecretMasker({"sk-abcdefgh", "sk-abcdefghijkl"})
        result = masker.mask("key=sk-abcdefghijkl end")
        assert result == "key=<redacted:0> end"
        assert "<redacted:1>" not in result

    def test_multiple_secrets_in_same_string(self) -> None:
        masker = SandboxSecretMasker({"secretone1", "secrettwo2"})
        result = masker.mask("a=secretone1 b=secrettwo2")
        assert "secretone1" not in result
        assert "secrettwo2" not in result
        assert "<redacted:" in result

    def test_exactly_min_length_secret_is_masked(self) -> None:
        masker = SandboxSecretMasker({"12345678"})
        assert masker.mask("value=12345678") == "value=<redacted:0>"

    def test_one_below_min_length_not_masked(self) -> None:
        masker = SandboxSecretMasker({"1234567"})
        assert masker.mask("value=1234567") == "value=1234567"


def _make_runner_with_secret(
    secret: str,
    backend_stdout: str = '"pass"',
    backend_error: str | None = None,
    backend_raises: Exception | None = None,
) -> tuple[CodeEvaluatorRunner, Any]:
    backend = _StatelessTestBackend(secret_values=frozenset({secret}))
    mock_execute = cast(AsyncMock, backend.execute)
    if backend_raises is not None:
        mock_execute.side_effect = backend_raises
    else:
        mock_execute.return_value = ExecutionResult(
            stdout=_fenced(backend_stdout),
            stderr="",
            error=backend_error,
        )
    runner = CodeEvaluatorRunner(
        name="test-runner",
        description=None,
        source_code='def evaluate(**kw): return "pass"',
        stored_output_configs=[_categorical_config()],
        sandbox_backend=backend,
        language="PYTHON",
        timeout=None,
        sandbox_session_manager=SandboxSessionManager(),
        session_key="evaluator:test-runner",
    )
    return runner, backend


class TestRedactionContracts:
    async def test_stdout_secret_redacted_in_sandbox_output_value(self) -> None:
        secret = "mysupersecretkey"
        runner, _ = _make_runner_with_secret(secret, backend_stdout=f'"{secret}"')
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        output_val = str(sandbox_attrs.get(OUTPUT_VALUE, ""))
        assert secret not in output_val
        assert "<redacted:" in output_val

    async def test_secret_in_context_redacted_in_input_value(self) -> None:
        secret = "mysupersecretkey"
        runner, _ = _make_runner_with_secret(secret)
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={"api_key": secret},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        evaluator_attrs = dict(spans_by_name["Evaluator: t"].attributes or {})
        input_val = str(evaluator_attrs.get(INPUT_VALUE, ""))
        assert secret not in input_val
        assert "<redacted:" in input_val

    async def test_exception_message_redacted(self) -> None:
        secret = "mysupersecretkey"
        runner, _ = _make_runner_with_secret(
            secret, backend_raises=RuntimeError(f"connection failed: {secret}")
        )
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        evaluator_span = spans_by_name["Evaluator: t"]
        exception_events = [e for e in evaluator_span.events if e.name == "exception"]
        assert exception_events
        event_attrs = dict(exception_events[0].attributes or {})
        assert secret not in str(event_attrs.get("exception.message", ""))
        assert "<redacted:" in str(event_attrs.get("exception.message", ""))

    async def test_status_description_redacted(self) -> None:
        secret = "mysupersecretkey"
        runner, _ = _make_runner_with_secret(secret, backend_error=f"SyntaxError: {secret}")
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        evaluator_span = spans_by_name["Evaluator: t"]
        assert evaluator_span.status.status_code == StatusCode.ERROR
        assert secret not in (evaluator_span.status.description or "")
        assert "<redacted:" in (evaluator_span.status.description or "")

    async def test_wasm_empty_secret_set_emits_verbatim(self) -> None:
        runner, _ = _make_runner(backend_stdout='"pass"')
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={"key": "value"},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        evaluator_attrs = dict(spans_by_name["Evaluator: t"].attributes or {})
        input_val = str(evaluator_attrs.get(INPUT_VALUE, ""))
        assert "value" in input_val
        assert "<redacted:" not in input_val

    async def test_sub_threshold_secret_not_redacted(self) -> None:
        runner, _ = _make_runner_with_secret("short", backend_stdout='"short"')
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        output_val = str(sandbox_attrs.get(OUTPUT_VALUE, ""))
        assert "<redacted:" not in output_val

    async def test_input_mapping_span_exception_masked_on_inner_span(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        secret = "mysupersecretkey"
        runner, _ = _make_runner_with_secret(secret)

        def _boom(**_: object) -> dict[str, object]:
            raise RuntimeError(f"path resolution failed for {secret}")

        monkeypatch.setattr("phoenix.server.api.evaluators.apply_input_mapping", _boom)
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        input_mapping_span = spans_by_name["Input Mapping"]

        exc_events = [e for e in input_mapping_span.events if e.name == "exception"]
        assert exc_events, "expected exception event on Input Mapping span"
        msg = str(dict(exc_events[0].attributes or {}).get("exception.message", ""))
        assert secret not in msg
        assert "<redacted:" in msg

        assert input_mapping_span.status.status_code == StatusCode.ERROR
        assert secret not in (input_mapping_span.status.description or "")
        assert "<redacted:" in (input_mapping_span.status.description or "")

        evaluator_span = spans_by_name["Evaluator: t"]
        evaluator_exc_events = [e for e in evaluator_span.events if e.name == "exception"]
        assert evaluator_exc_events
        evaluator_msg = str(
            dict(evaluator_exc_events[0].attributes or {}).get("exception.message", "")
        )
        assert secret not in evaluator_msg
        assert secret not in (evaluator_span.status.description or "")

    async def test_source_code_not_emitted_on_root_span(self) -> None:
        source = 'def evaluate(**kw): return "pass"'
        runner, _ = _make_runner(source_code=source, backend_stdout='"pass"')
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        for span in exporter.get_finished_spans():
            attrs = dict(span.attributes or {})
            assert "code.value" not in attrs, f"{span.name} leaked code.value"
            assert "code.mime_type" not in attrs, f"{span.name} leaked code.mime_type"
            for v in attrs.values():
                assert source not in str(v), f"{span.name} leaked source via another attr"


OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE


class TestSandboxSpanContract:
    async def test_happy_path_dict_result_lands_as_json_with_debug_in_metadata(self) -> None:
        result_dict = {"label": "good", "explanation": 'She said "hi"'}
        stdout = f"debug line\n{_PHOENIX_RESULT_BEGIN}\n{json.dumps(result_dict)}\n{_PHOENIX_RESULT_END}\n"
        runner, _ = _make_runner(backend_stdout=stdout, fence_stdout=False)
        tracer, exporter = _make_tracer()

        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        parse_attrs = dict(spans_by_name["Parse Eval Result"].attributes or {})

        assert sandbox_attrs.get(OUTPUT_MIME_TYPE) == "application/json"
        assert json.loads(str(sandbox_attrs[OUTPUT_VALUE])) == result_dict

        meta = json.loads(str(sandbox_attrs[METADATA]))
        assert meta.get("stdout") == "debug line"
        assert "parse_error" not in meta

        assert parse_attrs.get(INPUT_MIME_TYPE) == "application/json"
        assert json.loads(str(parse_attrs[INPUT_VALUE])) == result_dict

    async def test_missing_fence_marks_parse_error_and_omits_output(self) -> None:
        runner, _ = _make_runner(
            backend_stdout="totally invalid no-sentinels output\n",
            fence_stdout=False,
        )
        tracer, exporter = _make_tracer()

        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        parse_attrs = dict(spans_by_name["Parse Eval Result"].attributes or {})

        meta = json.loads(str(sandbox_attrs[METADATA]))
        assert meta.get("parse_error") == "no result markers found"
        assert "totally invalid" in meta.get("stdout", "")
        assert OUTPUT_VALUE not in sandbox_attrs
        assert spans_by_name[f"Sandbox: {runner._name}"].status.status_code == StatusCode.ERROR

        assert parse_attrs.get(INPUT_VALUE) == ""
        assert results[0]["error"] == "no result markers found"
        assert results[0]["label"] is None

    async def test_backend_error_skips_parse_span_and_metadata_records_error(self) -> None:
        runner, _ = _make_runner(backend_error="provider down")
        tracer, exporter = _make_tracer()

        results = await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )

        span_names = {span.name for span in exporter.get_finished_spans()}
        assert f"Sandbox: {runner._name}" in span_names
        assert "Parse Eval Result" not in span_names

        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        meta = json.loads(str(sandbox_attrs[METADATA]))
        assert meta.get("error") == "provider down"

        assert results[0]["error"] == "provider down"

    async def test_python_harness_has_no_doubly_escaped_strings(self) -> None:
        runner, _ = _make_runner()
        harness = runner._build_python_harness({"q": 'She said "hi"'})
        assert """'q': 'She said "hi"'""" in harness
        assert "_json.loads(" not in harness

    async def test_evaluator_version_id_lands_on_sandbox_metadata_when_provided(
        self,
    ) -> None:
        version_gid = "Q29kZUV2YWx1YXRvclZlcnNpb246NDI="
        runner, _ = _make_runner(evaluator_version_id=version_gid)
        tracer, exporter = _make_tracer()
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )
        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        meta = json.loads(str(sandbox_attrs[METADATA]))
        assert meta.get("code_evaluator_version_id") == version_gid

    async def test_evaluator_version_id_absent_when_runner_constructed_without_it(
        self,
    ) -> None:
        runner, _ = _make_runner()
        tracer, exporter = _make_tracer()
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="t",
            output_configs=[_categorical_config()],
            tracer=tracer,
        )
        spans_by_name = {span.name: span for span in exporter.get_finished_spans()}
        sandbox_attrs = dict(spans_by_name[f"Sandbox: {runner._name}"].attributes or {})
        meta = json.loads(str(sandbox_attrs[METADATA]))
        assert "code_evaluator_version_id" not in meta
