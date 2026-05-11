"""Tests for CodeEvaluatorRunner.

Covers:
- Python and TypeScript harness generation (_build_python_harness, _build_typescript_harness)
- evaluate() success path: stdout → label/score via _coerce_output
- evaluate() error paths: input mapping failure, sandbox execution error, sandbox error field
- Multi-output config: one result per config, annotation name includes config name
- runner name is forwarded to backend.execute() as session_key
"""

from __future__ import annotations

import json
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
from phoenix.server.api.evaluators import CodeEvaluatorRunner
from phoenix.server.sandbox.types import ExecutionResult

OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE


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
) -> tuple[CodeEvaluatorRunner, AsyncMock]:
    backend = AsyncMock()
    if backend_raises is not None:
        backend.execute = AsyncMock(side_effect=backend_raises)
    else:
        backend.execute = AsyncMock(
            return_value=ExecutionResult(
                stdout=backend_stdout,
                stderr="",
                error=backend_error,
            )
        )
    runner = CodeEvaluatorRunner(
        name="test-runner",
        description=None,
        source_code=source_code,
        stored_output_configs=[_categorical_config()],
        sandbox_backend=backend,
        language=language,
        timeout=timeout,
    )
    return runner, backend


_EMPTY_MAPPING = InputMapping(literal_mapping={}, path_mapping={})


class TestHarnessGeneration:
    def test_python_harness_contains_source_code(self) -> None:
        runner, _ = _make_runner(source_code="def evaluate(**kw): return 1")
        harness = runner._build_python_harness({"x": 1})
        assert "def evaluate(**kw): return 1" in harness

    def test_python_harness_contains_json_loads_call(self) -> None:
        runner, _ = _make_runner()
        harness = runner._build_python_harness({"key": "value"})
        assert "json.loads" in harness or "_json.loads" in harness

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

    async def test_runner_name_used_as_session_key(self) -> None:
        runner, backend = _make_runner(backend_stdout='"pass"')
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
        )
        call_kwargs = backend.execute.call_args
        assert call_kwargs.kwargs.get("session_key") == runner._name

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
        assert '"output": {"answer": "a"}' in code_arg
        assert '"reference": {"answer": "a"}' in code_arg

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
        """When no functional backend is available (execute raises), evaluate() returns an error."""
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
        """Runner normalizes language to uppercase on construction."""
        runner, _ = _make_runner(language="python")
        assert runner._language == "PYTHON"

    async def test_typescript_language_uses_typescript_harness(self) -> None:
        """Runner selects TypeScript harness when language is TYPESCRIPT."""
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
        # TypeScript harness uses console.log and JSON.stringify
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

    async def test_python_language_uses_python_harness(self) -> None:
        """Runner selects Python harness when language is PYTHON."""
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
        # Python harness uses json.loads and print
        assert "json.loads" in code_arg or "_json.loads" in code_arg
        assert "print(" in code_arg


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
        """Verify {evaluator_name}.{config.name} convention for multi-output evaluators."""
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
        """Top-level explanation in routing dict is used as shared fallback."""
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
        """Per-config sub-value explanation takes precedence over top-level fallback."""
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
            "Sandbox Execution",
            "Parse Eval Result",
        }

        spans_by_name = {span.name: span for span in spans}
        evaluator_attrs = dict(spans_by_name["Evaluator: my-eval"].attributes or {})
        input_mapping_attrs = dict(spans_by_name["Input Mapping"].attributes or {})
        sandbox_attrs = dict(spans_by_name["Sandbox Execution"].attributes or {})
        parse_attrs = dict(spans_by_name["Parse Eval Result"].attributes or {})

        # Span kinds.
        assert evaluator_attrs[OPENINFERENCE_SPAN_KIND] == "EVALUATOR"
        assert input_mapping_attrs[OPENINFERENCE_SPAN_KIND] == "CHAIN"
        assert sandbox_attrs[OPENINFERENCE_SPAN_KIND] == "CHAIN"
        assert parse_attrs[OPENINFERENCE_SPAN_KIND] == "CHAIN"

        # Root span carries INPUT_VALUE and OUTPUT_VALUE.
        assert INPUT_VALUE in evaluator_attrs
        assert OUTPUT_VALUE in evaluator_attrs

        # Input Mapping JSON shape.
        raw_input_mapping = input_mapping_attrs[INPUT_VALUE]
        assert isinstance(raw_input_mapping, str)
        input_mapping_json = json.loads(raw_input_mapping)
        assert set(input_mapping_json.keys()) == {"input_mapping", "template_variables"}
        assert set(input_mapping_json["input_mapping"].keys()) == {
            "path_mapping",
            "literal_mapping",
        }

        # Sandbox Execution scalar attributes.
        assert sandbox_attrs["sandbox.backend_type"] == "AsyncMock"
        assert sandbox_attrs["sandbox.language"] == "PYTHON"
        assert sandbox_attrs["sandbox.session_key"] == runner._name
        assert sandbox_attrs["sandbox.timeout"] == 30

        # trace_id is set on every result when a real tracer was passed.
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
        sandbox_attrs = dict(spans_by_name["Sandbox Execution"].attributes or {})
        assert "sandbox.timeout" not in sandbox_attrs

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

        # No synthetic exception event for the returned-error path.
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
