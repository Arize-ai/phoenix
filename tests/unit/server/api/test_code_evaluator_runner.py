import json
from typing import Any, Optional
from unittest.mock import AsyncMock

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    OptimizationDirection,
)
from phoenix.server.api.evaluators import CodeEvaluatorRunner, EvaluatorOutputConfig
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.sandbox.types import ExecutionResult


def _make_runner(
    *,
    source_code: str = "def score(text): return {'label': 'good'}",
    input_schema: Optional[dict[str, Any]] = None,
    output_configs: Optional[list[EvaluatorOutputConfig]] = None,
    sandbox_backend: Optional[AsyncMock] = None,
) -> CodeEvaluatorRunner:
    if input_schema is None:
        input_schema = {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        }
    if output_configs is None:
        output_configs = []
    return CodeEvaluatorRunner(
        name="test_evaluator",
        description="A test evaluator",
        source_code=source_code,
        stored_input_schema=input_schema,
        stored_output_configs=output_configs,
        sandbox_backend=sandbox_backend,
    )


def _make_input_mapping(
    *,
    literal_mapping: Optional[dict[str, Any]] = None,
    path_mapping: Optional[dict[str, str]] = None,
) -> EvaluatorInputMappingInput:
    return EvaluatorInputMappingInput(
        literal_mapping=literal_mapping or {},
        path_mapping=path_mapping or {},
    )


def _make_sandbox_mock(
    *,
    stdout: str = "",
    stderr: str = "",
    exit_code: int = 0,
    timed_out: bool = False,
) -> AsyncMock:
    mock = AsyncMock()
    mock.execute.return_value = ExecutionResult(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        timed_out=timed_out,
    )
    return mock


CATEGORICAL_CONFIG = CategoricalAnnotationConfig(
    type="CATEGORICAL",
    name="quality",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    values=[
        CategoricalAnnotationValue(label="good", score=1.0),
        CategoricalAnnotationValue(label="bad", score=0.0),
    ],
)

CONTINUOUS_CONFIG = ContinuousAnnotationConfig(
    type="CONTINUOUS",
    name="score",
    optimization_direction=OptimizationDirection.MAXIMIZE,
    lower_bound=0.0,
    upper_bound=1.0,
)


class TestCodeEvaluatorRunnerHappyPath:
    async def test_categorical_coercion(self) -> None:
        sandbox = _make_sandbox_mock(stdout=json.dumps({"label": "good"}))
        runner = _make_runner(
            sandbox_backend=sandbox,
            output_configs=[CATEGORICAL_CONFIG],
        )
        results = await runner.evaluate(
            context={"text": "hello world"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[CATEGORICAL_CONFIG],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] is None
        assert result["label"] == "good"
        assert result["score"] == 1.0
        assert result["annotator_kind"] == "CODE"
        assert result["name"] == "test_eval"

    async def test_continuous_coercion(self) -> None:
        sandbox = _make_sandbox_mock(stdout=json.dumps({"score": 0.85}))
        runner = _make_runner(
            sandbox_backend=sandbox,
            output_configs=[CONTINUOUS_CONFIG],
        )
        results = await runner.evaluate(
            context={"text": "hello world"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[CONTINUOUS_CONFIG],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] is None
        assert result["score"] == 0.85
        assert result["label"] is None

    async def test_passthrough_empty_output_configs(self) -> None:
        raw = {"score": 0.5, "label": "ok", "explanation": "fine"}
        sandbox = _make_sandbox_mock(stdout=json.dumps(raw))
        runner = _make_runner(sandbox_backend=sandbox, output_configs=[])
        results = await runner.evaluate(
            context={"text": "hello"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] is None
        assert result["score"] == 0.5
        assert result["label"] == "ok"
        assert result["explanation"] == "fine"


class TestCodeEvaluatorRunnerCoercionFailure:
    async def test_label_not_in_config_values(self) -> None:
        sandbox = _make_sandbox_mock(stdout=json.dumps({"label": "maybe"}))
        runner = _make_runner(
            sandbox_backend=sandbox,
            output_configs=[CATEGORICAL_CONFIG],
        )
        results = await runner.evaluate(
            context={"text": "hello"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[CATEGORICAL_CONFIG],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] is not None
        assert "maybe" in result["error"]
        assert result["label"] is None
        assert result["score"] is None


class TestCodeEvaluatorRunnerExecutionErrors:
    async def test_timeout(self) -> None:
        sandbox = _make_sandbox_mock(timed_out=True)
        runner = _make_runner(sandbox_backend=sandbox)
        results = await runner.evaluate(
            context={"text": "hello"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] == "Execution timed out"
        assert result["label"] is None
        assert result["score"] is None

    async def test_nonzero_exit_code(self) -> None:
        sandbox = _make_sandbox_mock(exit_code=1, stderr="NameError: name 'x' is not defined")
        runner = _make_runner(sandbox_backend=sandbox)
        results = await runner.evaluate(
            context={"text": "hello"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] == "NameError: name 'x' is not defined"
        assert result["label"] is None
        assert result["score"] is None


class TestCodeEvaluatorRunnerGuards:
    async def test_sandbox_backend_none(self) -> None:
        runner = _make_runner(sandbox_backend=None)
        results = await runner.evaluate(
            context={"text": "hello"},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] == "No sandbox backend available"
        assert result["label"] is None
        assert result["score"] is None

    async def test_validate_template_variables_failure(self) -> None:
        sandbox = _make_sandbox_mock()
        input_schema = {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        }
        runner = _make_runner(
            sandbox_backend=sandbox,
            input_schema=input_schema,
        )
        # Context is missing the required "text" field
        results = await runner.evaluate(
            context={},
            input_mapping=_make_input_mapping(),
            name="test_eval",
            output_configs=[],
        )
        assert len(results) == 1
        result = results[0]
        assert result["error"] is not None
        assert "text" in result["error"]
        assert result["label"] is None
        assert result["score"] is None
        # Sandbox should not have been called
        sandbox.execute.assert_not_called()
