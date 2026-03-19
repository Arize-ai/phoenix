"""Tests for CodeEvaluatorRunner.

Covers:
- Python and TypeScript harness generation (_build_python_harness, _build_typescript_harness)
- evaluate() success path: stdout → label/score via _coerce_output
- evaluate() error paths: input mapping failure, sandbox execution error, sandbox error field
- Multi-output config: one result per config, annotation name includes config name
- session_key is forwarded to backend.execute()
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.evaluators import CodeEvaluatorRunner
from phoenix.server.sandbox.types import ExecutionResult


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
        stored_input_schema={},
        stored_output_configs=[_categorical_config()],
        sandbox_backend=backend,
        language=language,
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

    async def test_session_key_forwarded_to_backend(self) -> None:
        runner, backend = _make_runner(backend_stdout='"pass"')
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
            session_key="my-session",
        )
        call_kwargs = backend.execute.call_args
        assert call_kwargs.kwargs.get("session_key") == "my-session"

    async def test_empty_session_key_uses_runner_name(self) -> None:
        runner, backend = _make_runner(backend_stdout='"pass"')
        await runner.evaluate(
            context={},
            input_mapping=_EMPTY_MAPPING,
            name="test",
            output_configs=[_categorical_config()],
            session_key="",
        )
        call_kwargs = backend.execute.call_args
        # When session_key is falsy, falls back to self._name
        assert call_kwargs.kwargs.get("session_key") == runner._name


class TestEvaluateErrorPaths:
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
