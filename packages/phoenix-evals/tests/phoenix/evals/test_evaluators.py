# type: ignore
import warnings
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from phoenix.evals.evaluators import (
    ClassificationEvaluator,
    Evaluator,
    LLMEvaluator,
    Score,
    create_classifier,
    create_evaluator,
    evaluate_dataframe,
    to_thread,
)
from phoenix.evals.llm import LLM
from phoenix.evals.templating import Template


# --- Shared Mock Classes ---
class MockLLM(LLM):
    """Mock LLM for testing that uses a valid provider."""

    def __init__(self, model: str = "test-model"):
        # Mock the LLM without calling parent constructor to avoid API key issues
        self.provider = "openai"
        self.model = model

    def generate_classification(self, prompt: str, labels, include_explanation: bool, method):
        return {"label": "good", "explanation": "This is a good result"}

    async def async_generate_classification(
        self, prompt: str, labels, include_explanation: bool, method
    ):
        return {"label": "good", "explanation": "This is a good result"}


class TestScore:
    """Test the Score dataclass functionality."""

    @pytest.mark.parametrize(
        "score_data,expected_name",
        [
            pytest.param({"name": "test_score"}, "test_score", id="Score with name field"),
            pytest.param({"name": None}, None, id="Score with None name"),
            pytest.param({}, None, id="Score with no name field"),
        ],
    )
    def test_score_name_field(self, score_data, expected_name):
        """Test Score name field assignment."""
        score = Score(**score_data)
        assert score.name == expected_name

    @pytest.mark.parametrize(
        "score_data,expected_score",
        [
            pytest.param({"score": 0.8}, 0.8, id="Score with float value"),
            pytest.param({"score": 1}, 1, id="Score with integer value"),
            pytest.param({"score": None}, None, id="Score with None value"),
            pytest.param({}, None, id="Score with no score field"),
        ],
    )
    def test_score_score_field(self, score_data, expected_score):
        """Test Score score field assignment."""
        score = Score(**score_data)
        assert score.score == expected_score

    @pytest.mark.parametrize(
        "score_data,expected_direction",
        [
            pytest.param({"direction": "maximize"}, "maximize", id="Explicit maximize direction"),
            pytest.param({"direction": "minimize"}, "minimize", id="Explicit minimize direction"),
            pytest.param({}, "maximize", id="Default direction value"),
        ],
    )
    def test_score_direction_field(self, score_data, expected_direction):
        """Test Score direction field assignment."""
        score = Score(**score_data)
        assert score.direction == expected_direction

    @pytest.mark.parametrize(
        "score_data,expected_metadata",
        [
            pytest.param(
                {"metadata": {"key": "value"}}, {"key": "value"}, id="Score with metadata"
            ),
            pytest.param({}, {}, id="Score with default empty metadata"),
        ],
    )
    def test_score_metadata_field(self, score_data, expected_metadata):
        """Test Score metadata field assignment."""
        score = Score(**score_data)
        assert score.metadata == expected_metadata

    @pytest.mark.parametrize(
        "score_data,expected_keys,excluded_keys",
        [
            pytest.param(
                {"name": "test", "score": 0.8, "label": None, "explanation": "test"},
                ["name", "score", "explanation", "direction"],
                ["label"],
                id="Score with None values excluded from to_dict",
            ),
            pytest.param(
                {"name": "test", "score": 0.8, "label": "good", "kind": "llm"},
                ["name", "score", "label", "kind", "direction"],
                [],
                id="Score with all non-None values included in to_dict",
            ),
        ],
    )
    def test_score_to_dict_excludes_none_values(self, score_data, expected_keys, excluded_keys):
        """Test that to_dict() excludes None values and includes non-None values."""
        score = Score(**score_data)
        result = score.to_dict()

        for key in expected_keys:
            assert key in result

        for key in excluded_keys:
            assert key not in result

    @patch("phoenix.evals.evaluators.json.dumps")
    def test_score_pretty_print_calls_json_dumps(self, mock_dumps):
        """Test that pretty_print() calls json.dumps correctly."""
        score = Score(name="test", score=0.8)
        score.pretty_print(indent=4)

        mock_dumps.assert_called_once()
        args, kwargs = mock_dumps.call_args
        assert kwargs["indent"] == 4
        assert "name" in args[0]
        assert "score" in args[0]


class TestToThread:
    """Test the to_thread utility function."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "func_args,func_kwargs,expected_result",
        [
            pytest.param((2, 3), {}, 5, id="Basic addition with positional args"),
            pytest.param((10, 5), {}, 15, id="Basic addition with different values"),
            # Note: to_thread doesn't support keyword arguments due to run_in_executor limitation
        ],
    )
    async def test_to_thread_basic_functionality(self, func_args, func_kwargs, expected_result):
        """Test to_thread wrapper with basic functions."""

        def test_func(x: int, y: int) -> int:
            return x + y

        wrapped_func = to_thread(test_func)
        result = await wrapped_func(*func_args, **func_kwargs)
        assert result == expected_result

    @pytest.mark.asyncio
    async def test_to_thread_with_exception(self):
        """Test to_thread wrapper with function that raises exception."""

        def test_func() -> None:
            raise ValueError("test error")

        wrapped_func = to_thread(test_func)

        with pytest.raises(ValueError, match="test error"):
            await wrapped_func()


class TestEvaluator:
    """Test the base Evaluator class."""

    class MockEvaluator(Evaluator):
        """Mock evaluator for testing."""

        def _evaluate(self, eval_input: Dict[str, Any]) -> List[Score]:
            return [Score(name=self.name, score=0.8, kind=self.kind)]

    @pytest.mark.parametrize(
        "name,kind,direction,expected_name,expected_kind,expected_direction",
        [
            pytest.param(
                "test_evaluator",
                "llm",
                "minimize",
                "test_evaluator",
                "llm",
                "minimize",
                id="Evaluator initialization with minimize direction",
            ),
            pytest.param(
                "test_evaluator",
                "code",
                "maximize",
                "test_evaluator",
                "code",
                "maximize",
                id="Evaluator initialization with maximize direction",
            ),
            pytest.param(
                "test_evaluator",
                "human",
                "maximize",
                "test_evaluator",
                "human",
                "maximize",
                id="Evaluator initialization defaults",
            ),
        ],
    )
    def test_evaluator_initialization(
        self,
        name,
        kind,
        direction,
        expected_name,
        expected_kind,
        expected_direction,
    ):
        """Test evaluator initialization with various parameters."""
        evaluator = self.MockEvaluator(name=name, kind=kind, direction=direction)

        assert evaluator.name == expected_name
        assert evaluator.kind == expected_kind
        assert evaluator.direction == expected_direction

    @pytest.mark.parametrize(
        "dummy",
        [pytest.param("x", id="inferred")],
    )
    def test_evaluator_required_fields_inferred(self, dummy):
        """Required fields inferred from schema or mapping."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...), output=(str, ...))
        evaluator = self.MockEvaluator(name="test_evaluator", kind="llm", input_schema=InputModel)
        assert evaluator._get_required_fields(None) == {"input", "output"}

        # From mapping when schema absent
        evaluator2 = self.MockEvaluator(name="test_evaluator", kind="llm")
        mapping = {"input": "user_input", "output": "model_output"}
        assert evaluator2._get_required_fields(mapping) == {"input", "output"}

    def test_evaluator_evaluate_success(self):
        """Test successful evaluation."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...))
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            kind="llm",
            input_schema=InputModel,
        )

        result = evaluator.evaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_evaluator_evaluate_with_mapping(self):
        """Test evaluation with input mapping."""
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            kind="llm",
        )

        result = evaluator.evaluate(
            eval_input={"user_input": "test"}, input_mapping={"input": "user_input"}
        )

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    @pytest.mark.parametrize(
        "eval_input,required_fields,expected_raises",
        [
            pytest.param(
                {"input": "test"},
                {"input", "output"},
                pytest.raises(ValueError, match=r"Path not found"),
                id="Missing required field raises ValueError",
            ),
            pytest.param(
                {"input": None},
                {"input"},
                pytest.raises(ValueError, match="Input validation failed"),
                id="Empty required field raises ValueError",
            ),
        ],
    )
    def test_evaluator_evaluate_error_handling(self, eval_input, required_fields, expected_raises):
        """Test that evaluation errors raise ValueError for validation issues."""
        from pydantic import create_model

        fields = {name: (str, ...) for name in required_fields}
        InputModel = create_model("InputModel", **fields)
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            kind="llm",
            input_schema=InputModel,
        )

        with expected_raises:
            evaluator.evaluate(eval_input)

    @pytest.mark.asyncio
    async def test_evaluator_async_evaluate_success(self):
        """Test successful async evaluation."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...))
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            kind="llm",
            input_schema=InputModel,
        )

        result = await evaluator.async_evaluate(eval_input={"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"


class TestLLMEvaluator:
    """Test the LLMEvaluator class."""

    @pytest.mark.parametrize(
        "prompt_template,expected_required_fields",
        [
            pytest.param(
                "Test template with {input}", {"input"}, id="Template with single variable"
            ),
            pytest.param(
                "Test template with {input} and {output}",
                {"input", "output"},
                id="Template with multiple variables",
            ),
        ],
    )
    def test_llm_evaluator_initialization_with_string_template(
        self, prompt_template, expected_required_fields
    ):
        """Test LLMEvaluator initialization with string template."""
        llm = MockLLM()

        evaluator = LLMEvaluator(name="test_evaluator", llm=llm, prompt_template=prompt_template)

        assert evaluator.name == "test_evaluator"
        assert evaluator.kind == "llm"
        assert evaluator.llm == llm
        assert isinstance(evaluator.prompt_template, Template)
        assert evaluator._get_required_fields(None) == expected_required_fields

    def test_llm_evaluator_initialization_with_template_object(self):
        """Test LLMEvaluator initialization with Template object."""
        llm = MockLLM()
        template = Template(template="Test template with {input}")

        evaluator = LLMEvaluator(name="test_evaluator", llm=llm, prompt_template=template)

        assert evaluator.prompt_template == template
        assert evaluator._get_required_fields(None) == {"input"}

    def test_llm_evaluator_initialization_with_explicit_required_fields(self):
        """Test LLMEvaluator initialization with explicit required_fields."""
        llm = MockLLM()
        template = "Test template with {input}"
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...))
        evaluator = LLMEvaluator(
            name="test_evaluator",
            llm=llm,
            prompt_template=template,
            input_schema=InputModel,
        )
        assert evaluator._get_required_fields(None) == {"input"}


class TestClassificationEvaluator:
    """Test the ClassificationEvaluator class."""

    @pytest.mark.parametrize(
        "choices,expected_labels,expected_score_map",
        [
            pytest.param(
                ["good", "bad"],
                ["good", "bad"],
                None,
                id="List choices with no score mapping",
            ),
            pytest.param(
                {"good": 1.0, "bad": 0.0},
                ["good", "bad"],
                {"good": 1.0, "bad": 0.0},
                id="Dict choices with score mapping",
            ),
            pytest.param(
                {"good": (1.0, "Good result"), "bad": (0.0, "Bad result")},
                {"good": "Good result", "bad": "Bad result"},
                {"good": 1.0, "bad": 0.0},
                id="Dict choices with tuple values (score, description)",
            ),
        ],
    )
    def test_classification_evaluator_initialization_choices(
        self, choices, expected_labels, expected_score_map
    ):
        """Test ClassificationEvaluator initialization with different choice formats."""
        llm = MockLLM()
        template = "Test template with {input}"

        evaluator = ClassificationEvaluator(
            name="test_evaluator", llm=llm, prompt_template=template, choices=choices
        )

        assert evaluator.name == "test_evaluator"
        assert evaluator.labels == expected_labels
        assert evaluator.label_score_map == expected_score_map
        assert evaluator.include_explanation is True

    def test_classification_evaluator_evaluate_success(self):
        """Test successful classification evaluation."""
        llm = MockLLM()
        template = "Test template with {input}"
        choices = ["good", "bad"]

        evaluator = ClassificationEvaluator(
            name="test_evaluator", llm=llm, prompt_template=template, choices=choices
        )

        result = evaluator._evaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_classification_evaluator_evaluate_with_score_map(self):
        """Test classification evaluation with score mapping."""
        llm = MockLLM()
        template = "Test template with {input}"
        choices = {"good": 1.0, "bad": 0.0}

        evaluator = ClassificationEvaluator(
            name="test_evaluator", llm=llm, prompt_template=template, choices=choices
        )

        result = evaluator._evaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].score == 1.0

    def test_classification_evaluator_invalid_label(self):
        """Test classification evaluation with invalid label."""
        llm = MockLLM()
        llm.generate_classification = MagicMock(return_value={"label": "invalid"})

        template = "Test template with {input}"
        choices = ["good", "bad"]

        evaluator = ClassificationEvaluator(
            name="test_evaluator", llm=llm, prompt_template=template, choices=choices
        )

        with pytest.raises(ValueError, match="received invalid label"):
            evaluator._evaluate({"input": "test"})

    @pytest.mark.asyncio
    async def test_classification_evaluator_async_evaluate_success(self):
        """Test successful async classification evaluation."""
        llm = MockLLM()
        template = "Test template with {input}"
        choices = ["good", "bad"]

        evaluator = ClassificationEvaluator(
            name="test_evaluator", llm=llm, prompt_template=template, choices=choices
        )

        result = await evaluator._async_evaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"


class TestCreateEvaluatorAsync:
    """Test async support in create_evaluator decorator."""

    @pytest.mark.asyncio
    async def test_create_evaluator_with_async_function(self):
        @create_evaluator(name="async_test", kind="code")
        async def async_eval(output: str) -> float:
            return len(output) * 2

        result = await async_eval.async_evaluate({"output": "hello"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "async_test"
        assert score.score == 10
        assert score.kind == "code"

    @pytest.mark.asyncio
    async def test_async_evaluator_call_returns_awaitable(self):
        @create_evaluator(name="async_call_test", kind="code")
        async def async_eval(output: str) -> float:
            return len(output)

        result = await async_eval("test")
        assert result == 4

    @pytest.mark.asyncio
    async def test_async_evaluator_preserves_original_function_behavior(self):
        @create_evaluator(name="async_preserve_test", kind="code")
        async def async_eval(text: str, multiplier: int = 2) -> float:
            return len(text) * multiplier

        result = await async_eval("hello", 3)
        assert result == 15

        result_default = await async_eval("test")
        assert result_default == 8

    def test_async_evaluator_sync_evaluate_raises_error(self):
        @create_evaluator(name="async_error_test", kind="code")
        async def async_eval(output: str) -> float:
            return len(output)

        with pytest.raises(NotImplementedError, match="Async evaluator must use async_evaluate"):
            async_eval.evaluate({"output": "test"})

    @pytest.mark.asyncio
    async def test_async_evaluator_with_score_object(self):
        @create_evaluator(name="async_score_test", kind="llm", direction="minimize")
        async def async_eval(input_text: str) -> Score:
            return Score(score=0.5, label="test", explanation="async result")

        result = await async_eval.async_evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "async_score_test"
        assert score.score == 0.5
        assert score.label == "test"
        assert score.explanation == "async result"
        assert score.kind == "llm"
        assert score.direction == "minimize"

    @pytest.mark.asyncio
    async def test_async_evaluator_with_tuple_return(self):
        @create_evaluator(name="async_tuple_test", kind="code")
        async def async_eval(output: str) -> tuple:
            return (0.8, "good", "This is an async evaluation result")

        result = await async_eval.async_evaluate({"output": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.score == 0.8
        assert score.label == "good"
        assert score.explanation == "This is an async evaluation result"


class TestCreateEvaluatorDecorator:
    """Test the enhanced create_evaluator decorator with various return types."""

    def test_sync_evaluator_call_preserves_original_function(self):
        @create_evaluator(name="sync_call_test", kind="code")
        def sync_eval(text: str, multiplier: int = 2) -> float:
            return len(text) * multiplier

        result = sync_eval("hello", 3)
        assert result == 15

        result_default = sync_eval("test")
        assert result_default == 8

    def test_create_evaluator_with_score_object(self):
        """Test create_evaluator with Score object return."""

        @create_evaluator(name="test_evaluator", kind="code", direction="maximize")
        def test_func(input_text: str) -> Score:
            return Score(score=0.8, label="good", explanation="test explanation")

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "test_evaluator"
        assert score.score == 0.8
        assert score.label == "good"
        assert score.explanation == "test explanation"
        assert score.kind == "code"
        assert score.direction == "maximize"

    def test_create_evaluator_with_number_return(self):
        """Test create_evaluator with number return."""

        @create_evaluator(name="number_evaluator", kind="code")
        def test_func(input_text: str) -> float:
            return 0.75

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "number_evaluator"
        assert score.score == 0.75
        assert score.label is None
        assert score.explanation is None

    def test_create_evaluator_with_boolean_return(self):
        """Test create_evaluator with boolean return."""

        @create_evaluator(name="boolean_evaluator", kind="code")
        def test_func(input_text: str) -> bool:
            return True

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "boolean_evaluator"
        assert score.score == 1.0  # True converted to 1.0
        assert score.label == "True"
        assert score.explanation is None

    def test_create_evaluator_with_short_string_return(self):
        """Test create_evaluator with short string return (≤3 words)."""

        @create_evaluator(name="short_string_evaluator", kind="code")
        def test_func(input_text: str) -> str:
            return "good"

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "short_string_evaluator"
        assert score.score is None
        assert score.label == "good"
        assert score.explanation is None

    def test_create_evaluator_with_long_string_return(self):
        """Test create_evaluator with long string return (≥4 words)."""

        @create_evaluator(name="long_string_evaluator", kind="code")
        def test_func(input_text: str) -> str:
            return "This is a much longer explanation that should go into the explanation field"

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "long_string_evaluator"
        assert score.score is None
        assert score.label is None
        assert (
            score.explanation
            == "This is a much longer explanation that should go into the explanation field"
        )

    def test_create_evaluator_with_dictionary_return(self):
        """Test create_evaluator with dictionary return."""

        @create_evaluator(name="dict_evaluator", kind="code")
        def test_func(input_text: str) -> dict:
            return {
                "score": 0.9,
                "label": "excellent",
                "explanation": "This is a detailed explanation",
            }

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "dict_evaluator"
        assert score.score == 0.9
        assert score.label == "excellent"
        assert score.explanation == "This is a detailed explanation"

    def test_create_evaluator_with_tuple_return(self):
        """Test create_evaluator with tuple return."""

        @create_evaluator(name="tuple_evaluator", kind="code")
        def test_func(input_text: str) -> tuple:
            return (0.85, "very good", "This is a comprehensive evaluation")

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "tuple_evaluator"
        assert score.score == 0.85
        assert score.label == "very good"
        assert score.explanation == "This is a comprehensive evaluation"

    def test_create_evaluator_with_mixed_tuple_return(self):
        """Test create_evaluator with mixed tuple including nested dict."""

        @create_evaluator(name="mixed_tuple_evaluator", kind="code")
        def test_func(input_text: str) -> tuple:
            return (0.7, {"score": 0.8, "label": "mixed"}, "This is a final explanation")

        with pytest.raises(ValueError):
            test_func.evaluate({"input_text": "test"})

    def test_create_evaluator_with_unsupported_type_raises_error(self):
        """Test create_evaluator raises error for unsupported return types."""

        @create_evaluator(name="unsupported_evaluator", kind="code")
        def test_func(input_text: str) -> list:
            return [1, 2, 3]

        with pytest.raises(ValueError):
            test_func.evaluate({"input_text": "test"})

    def test_create_evaluator_with_unsupported_type_error_message(self):
        """Test create_evaluator provides informative error message for unsupported types."""

        @create_evaluator(name="error_test_evaluator", kind="code")
        def test_func(input_text: str) -> set:
            return {1, 2, 3}

        with pytest.raises(ValueError) as exc_info:
            test_func.evaluate({"input_text": "test"})

        error_message = str(exc_info.value)
        assert "Unsupported return type 'set' for evaluator 'error_test_evaluator'" in error_message
        assert "{1, 2, 3}" in error_message  # Shows the actual value that caused the error

    def test_create_evaluator_with_input_mapping(self):
        """Test create_evaluator with input mapping."""

        @create_evaluator(name="mapping_evaluator", kind="code")
        def test_func(input_text: str) -> float:
            return 0.8

        result = test_func.evaluate(
            {"user_input": "test"}, input_mapping={"input_text": "user_input"}
        )

        assert len(result) == 1
        score = result[0]
        assert score.name == "mapping_evaluator"
        assert score.score == 0.8

    @pytest.mark.parametrize(
        "return_value,expected_score,expected_label,expected_explanation",
        [
            pytest.param(0.5, 0.5, None, None, id="Float number"),
            pytest.param(42, 42, None, None, id="Integer number"),
            pytest.param(False, 0.0, "False", None, id="Boolean False"),
            pytest.param(True, 1.0, "True", None, id="Boolean True"),
            pytest.param("good", None, "good", None, id="Short string"),
            pytest.param("very good", None, "very good", None, id="Two word string"),
            pytest.param("This is a test", None, None, "This is a test", id="Three word string"),
            pytest.param(
                "This is a longer test", None, None, "This is a longer test", id="Four word string"
            ),
        ],
    )
    def test_create_evaluator_various_return_types(
        self, return_value, expected_score, expected_label, expected_explanation
    ):
        """Test create_evaluator with various return types using parametrization."""

        @create_evaluator(name="param_test_evaluator", kind="code")
        def test_func(input_text: str):
            return return_value

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "param_test_evaluator"
        assert score.score == expected_score
        assert score.label == expected_label
        assert score.explanation == expected_explanation

    def test_create_evaluator_preserves_metadata(self):
        """Test that create_evaluator preserves metadata when Score object is returned."""

        @create_evaluator(name="metadata_evaluator", kind="code")
        def test_func(input_text: str) -> Score:
            return Score(
                score=0.8, label="good", explanation="test", metadata={"custom_key": "custom_value"}
            )

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.metadata == {"custom_key": "custom_value"}

    def test_create_evaluator_with_custom_kind_and_direction(self):
        """Test create_evaluator with custom kind and direction."""

        @create_evaluator(name="custom_evaluator", kind="llm", direction="minimize")
        def test_func(input_text: str) -> float:
            return 0.3

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "custom_evaluator"
        assert score.kind == "llm"
        assert score.direction == "minimize"
        assert score.score == 0.3


class TestFactoryFunctions:
    """Test factory functions."""

    @pytest.mark.parametrize(
        "choices,expected_labels",
        [
            pytest.param(["good", "bad"], ["good", "bad"], id="List choices"),
            pytest.param({"good": 1.0, "bad": 0.0}, ["good", "bad"], id="Dict choices"),
        ],
    )
    def test_create_classifier_basic(self, choices, expected_labels):
        """Test create_classifier factory function."""
        llm = MockLLM()
        template = "Test template with {input}"

        evaluator = create_classifier(
            name="test_classifier", prompt_template=template, llm=llm, choices=choices
        )

        assert isinstance(evaluator, ClassificationEvaluator)
        assert evaluator.name == "test_classifier"
        assert evaluator.labels == expected_labels
        assert evaluator.llm == llm


class TestIntrospectionAndSchema:
    """Tests for describe() based on input_schema inference."""

    def test_describe_for_simple_decorator(self):
        @create_evaluator(name="simple_eval")
        def simple_eval(output: str, expected: str) -> Score:
            return Score(score=1.0)

        schema = simple_eval.describe()
        assert schema["input_schema"]["type"] == "object"
        assert set(schema["input_schema"]["required"]) == {"output", "expected"}
        assert schema["input_schema"]["properties"]["output"]["type"] == "string"
        assert schema["input_schema"]["properties"]["expected"]["type"] == "string"

    def test_describe_optional_and_defaults(self):
        @create_evaluator(name="opt_eval")
        def opt_eval(a: str, b: str or None = None, k: int = 1) -> Score:
            return Score(score=1.0)

        schema = opt_eval.describe()
        assert set(schema["input_schema"]["properties"].keys()) == {"a", "b", "k"}
        # Only 'a' should be required
        assert set(schema["input_schema"]["required"]) == {"a"}
        assert schema["input_schema"]["properties"]["k"]["type"] in {"integer", "number"}


class TestEvaluatorRequiredFieldsAndBinding:
    """Covers required field inference and binding behavior."""

    class MinimalEvaluator(Evaluator):
        def _evaluate(self, eval_input: Dict[str, Any]) -> List[Score]:
            return [Score(name=self.name, score=1.0, kind=self.kind)]

    def test_required_fields_from_mapping_when_no_schema(self):
        e = self.MinimalEvaluator(name="min", kind="code")
        payload = {"in": {"msg": "hi"}}
        mapping = {"text": lambda row: row["in"]["msg"].upper()}

        # Without mapping and without schema -> error
        with pytest.raises(ValueError, match="Cannot determine input fields"):
            e.evaluate(payload)

        # With mapping keys -> accepted
        scores = e.evaluate(payload, input_mapping=mapping)
        assert len(scores) == 1 and scores[0].score == 1.0

    def test_bound_evaluator_evaluate_and_describe(self):
        @create_evaluator(name="emph")
        def emph(text: str) -> Score:
            return Score(score=float(len(text) > 0))

        mapping = {"text": lambda row: row["raw"]["value"].strip()}
        payload = {"raw": {"value": " hello "}}

        from phoenix.evals.evaluators import bind_evaluator

        be = bind_evaluator(evaluator=emph, input_mapping=mapping)
        # Evaluate through bound mapping
        scores = be.evaluate(payload)
        assert len(scores) == 1 and scores[0].score == 1.0
        # Introspection passthrough
        assert be.describe()["name"] == "emph"


class TestEvaluateDataframe:
    """Test the evaluate_dataframe function with various DataFrame index types."""

    class MockEvaluator(Evaluator):
        """Mock evaluator for testing evaluate_dataframe."""

        def __init__(self, name: str = "mock_evaluator", score_value: float = 0.8):
            from pydantic import create_model

            # Create a simple input schema that accepts any fields
            InputModel = create_model("InputModel", text=(str, ...), reference=(str, ...))
            super().__init__(name=name, kind="code", input_schema=InputModel)
            self.score_value = score_value

        def _evaluate(self, eval_input: Dict[str, Any]) -> List[Score]:
            return [Score(name=self.name, score=self.score_value, explanation="Mock evaluation")]

    @pytest.fixture
    def mock_evaluator(self):
        """Fixture providing a mock evaluator."""
        return self.MockEvaluator()

    @pytest.fixture
    def sample_dataframe(self):
        """Fixture providing a sample DataFrame with continuous numeric index."""
        return pd.DataFrame(
            {
                "text": ["This is a test.", "Another test.", "Third test."],
                "reference": ["This is a test.", "Another test.", "Third test."],
            },
            index=[0, 1, 2],
        )

    def test_evaluate_dataframe_continuous_numeric_index(self, sample_dataframe, mock_evaluator):
        """Test evaluate_dataframe with continuous numeric index (baseline test)."""
        result_df = evaluate_dataframe(dataframe=sample_dataframe, evaluators=[mock_evaluator])

        # Verify original index is preserved
        assert list(result_df.index) == [0, 1, 2]

        # Verify original columns are preserved
        assert "text" in result_df.columns
        assert "reference" in result_df.columns

        # Verify new columns are added
        assert "mock_evaluator_execution_details" in result_df.columns
        assert "mock_evaluator_score" in result_df.columns

        # Verify all rows have scores
        assert result_df["mock_evaluator_score"].notna().all()

    def test_evaluate_dataframe_non_continuous_numeric_index(self, mock_evaluator):
        """Test evaluate_dataframe with non-continuous numeric index."""
        df = pd.DataFrame(
            {
                "text": ["This is a test.", "Another test.", "Third test."],
                "reference": ["This is a test.", "Another test.", "Third test."],
            },
            index=[10, 20, 30],
        )  # Non-continuous indices

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved
        assert list(result_df.index) == [10, 20, 30]

        # Verify scores are assigned to correct rows
        assert result_df["mock_evaluator_score"].notna().all()
        assert len(result_df) == 3

    def test_evaluate_dataframe_string_index(self, mock_evaluator):
        """Test evaluate_dataframe with string index."""
        df = pd.DataFrame(
            {
                "text": ["This is a test.", "Another test.", "Third test."],
                "reference": ["This is a test.", "Another test.", "Third test."],
            },
            index=["row_a", "row_b", "row_c"],
        )  # String indices

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved
        assert list(result_df.index) == ["row_a", "row_b", "row_c"]

        # Verify scores are assigned to correct rows
        assert result_df["mock_evaluator_score"].notna().all()
        assert len(result_df) == 3

    def test_evaluate_dataframe_mixed_index_types(self, mock_evaluator):
        """Test evaluate_dataframe with mixed index types."""
        df = pd.DataFrame(
            {
                "text": ["This is a test.", "Another test.", "Third test."],
                "reference": ["This is a test.", "Another test.", "Third test."],
            },
            index=[1, "b", 3.0],
        )  # Mixed types

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved
        assert list(result_df.index) == [1, "b", 3.0]

        # Verify scores are assigned to correct rows
        assert result_df["mock_evaluator_score"].notna().all()
        assert len(result_df) == 3

    def test_evaluate_dataframe_single_row(self, mock_evaluator):
        """Test evaluate_dataframe with single row DataFrame."""
        df = pd.DataFrame(
            {"text": ["Single test."], "reference": ["Single test."]}, index=[42]
        )  # Single row with non-zero index

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved
        assert list(result_df.index) == [42]

        # Verify scores are assigned
        assert result_df["mock_evaluator_score"].notna().all()
        assert len(result_df) == 1

    def test_evaluate_dataframe_empty_dataframe(self, mock_evaluator):
        """Test evaluate_dataframe with empty DataFrame."""
        df = pd.DataFrame({"text": [], "reference": []}, index=pd.Index([], dtype="int64"))

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved (empty)
        assert len(result_df.index) == 0
        assert len(result_df) == 0

        # Verify execution details column is added (scores column won't be added for empty DataFrame)
        assert "mock_evaluator_execution_details" in result_df.columns
        # Score column is not added for empty DataFrames since no evaluations occur

    def test_evaluate_dataframe_multiple_evaluators(self, sample_dataframe):
        """Test evaluate_dataframe with multiple evaluators."""
        evaluator1 = self.MockEvaluator("evaluator1", 0.8)
        evaluator2 = self.MockEvaluator("evaluator2", 0.9)

        result_df = evaluate_dataframe(
            dataframe=sample_dataframe, evaluators=[evaluator1, evaluator2]
        )

        # Verify original index is preserved
        assert list(result_df.index) == [0, 1, 2]

        # Verify both evaluators' columns are added
        assert "evaluator1_execution_details" in result_df.columns
        assert "evaluator1_score" in result_df.columns
        assert "evaluator2_execution_details" in result_df.columns
        assert "evaluator2_score" in result_df.columns

        # Verify scores are assigned correctly
        assert result_df["evaluator1_score"].notna().all()
        assert result_df["evaluator2_score"].notna().all()

    def test_evaluate_dataframe_execution_details_preserved(self, sample_dataframe, mock_evaluator):
        """Test that execution details are properly recorded."""
        result_df = evaluate_dataframe(dataframe=sample_dataframe, evaluators=[mock_evaluator])

        # Verify execution details column exists
        assert "mock_evaluator_execution_details" in result_df.columns

        # Verify execution details are recorded for all rows
        assert result_df["mock_evaluator_execution_details"].notna().all()

        # Verify execution details contain expected fields

        details = result_df["mock_evaluator_execution_details"].iloc[0]
        assert "status" in details
        assert "exceptions" in details
        assert "execution_seconds" in details

    def test_evaluate_dataframe_preserves_original_data(self, sample_dataframe, mock_evaluator):
        """Test that original DataFrame data is preserved."""
        original_text = sample_dataframe["text"].tolist()
        original_reference = sample_dataframe["reference"].tolist()

        result_df = evaluate_dataframe(dataframe=sample_dataframe, evaluators=[mock_evaluator])

        # Verify original data is unchanged
        assert result_df["text"].tolist() == original_text
        assert result_df["reference"].tolist() == original_reference

    def test_evaluate_dataframe_with_custom_parameters(self, sample_dataframe, mock_evaluator):
        """Test evaluate_dataframe with custom tqdm_bar_format and other parameters."""
        result_df = evaluate_dataframe(
            dataframe=sample_dataframe,
            evaluators=[mock_evaluator],
            tqdm_bar_format="Testing: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt}",
            exit_on_error=False,
            max_retries=5,
        )

        # Verify the function still works with custom parameters
        assert list(result_df.index) == [0, 1, 2]
        assert "mock_evaluator_score" in result_df.columns
        assert result_df["mock_evaluator_score"].notna().all()

    def test_evaluate_dataframe_large_dataframe(self, mock_evaluator):
        """Test evaluate_dataframe with a larger DataFrame."""
        # Create a larger DataFrame with non-continuous indices
        data = {
            "text": [f"Test text {i}" for i in range(100)],
            "reference": [f"Reference {i}" for i in range(100)],
        }
        df = pd.DataFrame(data, index=list(range(100, 200)))  # Indices 100-199

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved
        assert list(result_df.index) == list(range(100, 200))

        # Verify all rows have scores
        assert result_df["mock_evaluator_score"].notna().all()
        assert len(result_df) == 100

    def test_evaluate_dataframe_index_with_duplicates(self, mock_evaluator):
        """Test evaluate_dataframe with duplicate indices (edge case)."""
        df = pd.DataFrame(
            {
                "text": ["First test.", "Second test.", "Third test."],
                "reference": ["First test.", "Second test.", "Third test."],
            },
            index=[1, 1, 2],
        )  # Duplicate indices

        result_df = evaluate_dataframe(dataframe=df, evaluators=[mock_evaluator])

        # Verify original index is preserved (including duplicates)
        assert list(result_df.index) == [1, 1, 2]

        # Verify scores are assigned to all rows
        assert result_df["mock_evaluator_score"].notna().all()
        assert len(result_df) == 3

    def test_evaluate_dataframe_ordering_preservation_with_duplicates(self):
        """Test that evaluate_dataframe preserves exact ordering and assigns scores correctly with duplicate indices."""

        # Create a custom evaluator that returns different scores based on input
        class PositionAwareEvaluator(Evaluator):
            def __init__(self, name="position_aware"):
                from pydantic import create_model

                InputModel = create_model("InputModel", text=(str, ...), reference=(str, ...))
                super().__init__(name=name, kind="code", input_schema=InputModel)

            def _evaluate(self, eval_input):
                # Return a score that includes the text content to verify ordering
                text = eval_input["text"]
                score_value = 0.5 + (0.1 * len(text))  # Different score based on text length
                return [Score(name=self.name, score=score_value, explanation=f"Evaluated: {text}")]

        evaluator = PositionAwareEvaluator()

        # Create DataFrame with duplicate indices and distinct content
        df = pd.DataFrame(
            {
                "text": ["Short", "Medium length", "Very long text here"],
                "reference": ["Ref1", "Ref2", "Ref3"],
            },
            index=[5, 5, 10],  # Duplicate indices with different content
        )

        result_df = evaluate_dataframe(dataframe=df, evaluators=[evaluator])

        # Verify original index is preserved exactly
        assert list(result_df.index) == [
            5,
            5,
            10,
        ], f"Index not preserved: {result_df.index.tolist()}"

        # Verify original data is preserved exactly
        assert result_df["text"].tolist() == ["Short", "Medium length", "Very long text here"]
        assert result_df["reference"].tolist() == ["Ref1", "Ref2", "Ref3"]

        # Verify scores are assigned to correct positions
        scores = result_df["position_aware_score"].tolist()
        assert len(scores) == 3, f"Expected 3 scores, got {len(scores)}"
        assert all(score is not None for score in scores), "Some scores are None"

        # Verify each score corresponds to the correct row
        assert "Evaluated: Short" in scores[0]["explanation"], "First score doesn't match first row"
        assert "Evaluated: Medium length" in scores[1]["explanation"], (
            "Second score doesn't match second row"
        )
        assert "Evaluated: Very long text here" in scores[2]["explanation"], (
            "Third score doesn't match third row"
        )

        # Verify score values are different (based on text length)
        score_values = [score["score"] for score in scores]
        assert score_values[0] != score_values[1] != score_values[2], (
            "Score values should be different"
        )
        assert score_values[0] < score_values[1] < score_values[2], (
            "Scores should increase with text length"
        )

        # Verify execution details are also assigned correctly
        exec_details = result_df["position_aware_execution_details"].tolist()
        assert len(exec_details) == 3, f"Expected 3 execution details, got {len(exec_details)}"
        assert all(detail is not None for detail in exec_details), "Some execution details are None"

    def test_evaluate_dataframe_exact_dataframe_structure(self):
        """Test that the returned DataFrame has the exact expected structure."""

        class TestEvaluator(Evaluator):
            def __init__(self, name="test_eval"):
                from pydantic import create_model

                InputModel = create_model("InputModel", text=(str, ...), reference=(str, ...))
                super().__init__(name=name, kind="code", input_schema=InputModel)

            def _evaluate(self, eval_input):
                return [Score(name=self.name, score=0.8, explanation="Test")]

        evaluator = TestEvaluator()

        # Test with various index types to ensure structure is preserved
        test_cases = [
            # (description, index, expected_index)
            ("continuous_numeric", [0, 1, 2], [0, 1, 2]),
            ("non_continuous_numeric", [10, 20, 30], [10, 20, 30]),
            ("string_index", ["a", "b", "c"], ["a", "b", "c"]),
            ("duplicate_numeric", [1, 1, 2], [1, 1, 2]),
            ("duplicate_string", ["x", "x", "y"], ["x", "x", "y"]),
            ("mixed_types", [1, "b", 3.0], [1, "b", 3.0]),
        ]

        for desc, index, expected_index in test_cases:
            df = pd.DataFrame(
                {
                    "text": ["A", "B", "C"],
                    "reference": ["Ref1", "Ref2", "Ref3"],
                },
                index=index,
            )

            result_df = evaluate_dataframe(dataframe=df, evaluators=[evaluator])

            # Verify exact structure
            assert list(result_df.index) == expected_index, (
                f"Index mismatch for {desc}: {result_df.index.tolist()} != {expected_index}"
            )
            assert result_df["text"].tolist() == ["A", "B", "C"], f"Text data corrupted for {desc}"
            assert result_df["reference"].tolist() == [
                "Ref1",
                "Ref2",
                "Ref3",
            ], f"Reference data corrupted for {desc}"
            assert "test_eval_execution_details" in result_df.columns, (
                f"Execution details column missing for {desc}"
            )
            assert "test_eval_score" in result_df.columns, f"Score column missing for {desc}"
            assert len(result_df) == 3, f"Row count wrong for {desc}: {len(result_df)}"
            assert result_df["test_eval_score"].notna().all(), f"Some scores are None for {desc}"

    @pytest.mark.asyncio
    async def test_async_evaluate_dataframe_duplicate_indices(self):
        """Test async_evaluate_dataframe with duplicate indices to ensure it works correctly."""
        from phoenix.evals.evaluators import async_evaluate_dataframe

        class AsyncTestEvaluator(Evaluator):
            def __init__(self, name="async_test_eval"):
                from pydantic import create_model

                InputModel = create_model("InputModel", text=(str, ...), reference=(str, ...))
                super().__init__(name=name, kind="code", input_schema=InputModel)

            def _evaluate(self, eval_input):
                # Return a score that includes the text content to verify ordering
                text = eval_input["text"]
                score_value = 0.5 + (0.1 * len(text))  # Different score based on text length
                return [
                    Score(name=self.name, score=score_value, explanation=f"Async evaluated: {text}")
                ]

        evaluator = AsyncTestEvaluator()

        # Create DataFrame with duplicate indices and distinct content
        df = pd.DataFrame(
            {
                "text": ["Short", "Medium length", "Very long text here"],
                "reference": ["Ref1", "Ref2", "Ref3"],
            },
            index=[5, 5, 10],  # Duplicate indices with different content
        )

        result_df = await async_evaluate_dataframe(dataframe=df, evaluators=[evaluator])

        # Verify original index is preserved exactly
        assert list(result_df.index) == [
            5,
            5,
            10,
        ], f"Index not preserved: {result_df.index.tolist()}"

        # Verify original data is preserved exactly
        assert result_df["text"].tolist() == ["Short", "Medium length", "Very long text here"]
        assert result_df["reference"].tolist() == ["Ref1", "Ref2", "Ref3"]

        # Verify scores are assigned to correct positions
        scores = result_df["async_test_eval_score"].tolist()
        assert len(scores) == 3, f"Expected 3 scores, got {len(scores)}"
        assert all(score is not None for score in scores), "Some scores are None"

        # Verify each score corresponds to the correct row
        assert "Async evaluated: Short" in scores[0]["explanation"], (
            "First score doesn't match first row"
        )
        assert "Async evaluated: Medium length" in scores[1]["explanation"], (
            "Second score doesn't match second row"
        )
        assert "Async evaluated: Very long text here" in scores[2]["explanation"], (
            "Third score doesn't match third row"
        )

        # Verify score values are different (based on text length)
        score_values = [score["score"] for score in scores]
        assert score_values[0] != score_values[1] != score_values[2], (
            "Score values should be different"
        )
        assert score_values[0] < score_values[1] < score_values[2], (
            "Scores should increase with text length"
        )

        # Verify execution details are also assigned correctly
        exec_details = result_df["async_test_eval_execution_details"].tolist()
        assert len(exec_details) == 3, f"Expected 3 execution details, got {len(exec_details)}"
        assert all(detail is not None for detail in exec_details), "Some execution details are None"

    def test_evaluate_dataframe_with_failures(self):
        """Test evaluate_dataframe handles evaluation failures gracefully without crashing."""

        class FailingEvaluator(Evaluator):
            def __init__(self, name="failing_eval", fail_on_text=None):
                from pydantic import create_model

                InputModel = create_model("InputModel", text=(str, ...), reference=(str, ...))
                super().__init__(name=name, kind="code", input_schema=InputModel)
                self.fail_on_text = fail_on_text

            def _evaluate(self, eval_input):
                text = eval_input["text"]
                if self.fail_on_text and self.fail_on_text in text:
                    raise ValueError(f"Intentional failure for text: {text}")
                return [Score(name=self.name, score=0.8, explanation=f"Success: {text}")]

        evaluator = FailingEvaluator(fail_on_text="FAIL")
        df = pd.DataFrame(
            {"text": ["Success text", "FAIL this one"], "reference": ["Ref1", "Ref2"]},
            index=[1, 2],
        )

        # Should not crash even with failures
        result_df = evaluate_dataframe(
            dataframe=df, evaluators=[evaluator], exit_on_error=False, max_retries=0
        )

        # Verify structure is preserved
        assert list(result_df.index) == [1, 2]
        assert "failing_eval_score" in result_df.columns
        assert "failing_eval_execution_details" in result_df.columns

        # Check scores: success should have score, failure should be None
        scores = result_df["failing_eval_score"].tolist()
        assert scores[0] is not None  # Success
        assert scores[1] is None  # Failure

        # Check execution details: failure should have FAILED status
        exec_details = result_df["failing_eval_execution_details"].tolist()

        assert exec_details[0]["status"] == "COMPLETED"
        assert exec_details[1]["status"] == "FAILED"
        assert len(exec_details[1]["exceptions"]) > 0

    @pytest.mark.asyncio
    async def test_async_evaluate_dataframe_with_failures(self):
        """Test async_evaluate_dataframe handles evaluation failures gracefully without crashing."""
        from phoenix.evals.evaluators import async_evaluate_dataframe

        class AsyncFailingEvaluator(Evaluator):
            def __init__(self, name="async_failing_eval", fail_on_text=None):
                from pydantic import create_model

                InputModel = create_model("InputModel", text=(str, ...), reference=(str, ...))
                super().__init__(name=name, kind="code", input_schema=InputModel)
                self.fail_on_text = fail_on_text

            def _evaluate(self, eval_input):
                text = eval_input["text"]
                if self.fail_on_text and self.fail_on_text in text:
                    raise ValueError(f"Async intentional failure for text: {text}")
                return [Score(name=self.name, score=0.9, explanation=f"Async success: {text}")]

            async def async_evaluate(self, eval_input):
                text = eval_input["text"]
                if self.fail_on_text and self.fail_on_text in text:
                    raise ValueError(f"Async intentional failure for text: {text}")
                return [Score(name=self.name, score=0.9, explanation=f"Async success: {text}")]

        evaluator = AsyncFailingEvaluator(fail_on_text="ASYNC_FAIL")
        df = pd.DataFrame(
            {"text": ["Async success", "ASYNC_FAIL this"], "reference": ["Ref1", "Ref2"]},
            index=[10, 20],
        )

        # Should not crash even with failures
        result_df = await async_evaluate_dataframe(
            dataframe=df, evaluators=[evaluator], exit_on_error=False, max_retries=0
        )

        # Verify structure is preserved
        assert list(result_df.index) == [10, 20]
        assert "async_failing_eval_score" in result_df.columns
        assert "async_failing_eval_execution_details" in result_df.columns

        # Check scores: success should have score, failure should be None
        scores = result_df["async_failing_eval_score"].tolist()
        assert scores[0] is not None  # Success
        assert scores[1] is None  # Failure

        # Check execution details: failure should have FAILED status
        exec_details = result_df["async_failing_eval_execution_details"].tolist()

        assert exec_details[0]["status"] == "COMPLETED"
        assert exec_details[1]["status"] == "FAILED"
        assert len(exec_details[1]["exceptions"]) > 0


# TODO: Remove this once the deprecated 'source' argument and 'heuristic' KindType are removed.
class TestDeprecatedSourceAndHeuristic:
    """Tests for deprecated 'source' argument and 'heuristic' KindType support."""

    @pytest.mark.parametrize(
        "kwargs,expected_kind,warning_regex",
        [
            pytest.param(
                {"source": "llm"},
                "llm",
                r"'source'\s+is\s+deprecated",
                id="score-source-deprecated",
            ),
            pytest.param(
                {"source": "heuristic"},
                "code",
                r"deprecated",
                id="score-both-deprecated",
            ),
            pytest.param(
                {"kind": "heuristic"},
                "code",
                r"heuristic.*deprecated",
                id="score-heuristic-deprecated",
            ),
            pytest.param({"kind": "code"}, "code", None, id="score-both-new"),
        ],
    )
    def test_score_supports_deprecated_and_new_kinds(self, kwargs, expected_kind, warning_regex):
        """Score should accept deprecated 'source' and convert 'heuristic' to 'code'."""

        if warning_regex:
            with pytest.warns(DeprecationWarning, match=warning_regex):
                s = Score(**kwargs)
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", DeprecationWarning)
                s = Score(**kwargs)

        assert s.kind == expected_kind

    @pytest.mark.parametrize(
        "kwargs,expected_kind,warning_regex",
        [
            pytest.param(
                {"source": "human"},
                "human",
                r"'source'\s+is\s+deprecated",
                id="evaluator-source-deprecated",
            ),
            pytest.param(
                {"source": "heuristic"},
                "code",
                r"deprecated",
                id="evaluator-both-deprecated",
            ),
            pytest.param(
                {"kind": "heuristic"},
                "code",
                r"heuristic.*deprecated",
                id="evaluator-heuristic-deprecated",
            ),
            pytest.param(
                {"source": "heuristic"},
                "code",
                r"deprecated",
                id="evaluator-both-deprecated",
            ),
            pytest.param({"kind": "llm"}, "llm", None, id="evaluator-both-new"),
        ],
    )
    def test_evaluator_supports_deprecated_and_new_kinds(
        self, kwargs, expected_kind, warning_regex
    ):
        """Evaluator should accept deprecated 'source' and convert 'heuristic' to 'code'."""

        class _MinimalEvaluator(Evaluator):
            def _evaluate(self, eval_input):
                return [Score(name=self.name, score=1.0, kind=self.kind)]

        evaluator_kwargs = dict(name="min")
        evaluator_kwargs.update(kwargs)

        if warning_regex:
            with pytest.warns(DeprecationWarning, match=warning_regex):
                ev = _MinimalEvaluator(**evaluator_kwargs)
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", DeprecationWarning)
                ev = _MinimalEvaluator(**evaluator_kwargs)

        assert ev.kind == expected_kind

    @pytest.mark.parametrize(
        "kwargs,expected_kind,warning_regex",
        [
            pytest.param(
                {"source": "code"},
                "code",
                r"'source'\s+is\s+deprecated",
                id="create-evaluator-source-deprecated",
            ),
            pytest.param(
                {"source": "heuristic"},
                "code",
                r"deprecated",
                id="create-evaluator-both-deprecated",
            ),
            pytest.param(
                {"kind": "heuristic"},
                "code",
                r"heuristic.*deprecated",
                id="create-evaluator-heuristic-deprecated",
            ),
            pytest.param({"kind": "human"}, "human", None, id="create-evaluator-kind-new"),
        ],
    )
    def test_create_evaluator_supports_deprecated_and_new_kinds(
        self, kwargs, expected_kind, warning_regex
    ):
        """create_evaluator should support 'source' and convert 'heuristic' to 'code'."""

        def _fn(text: str) -> float:
            return 1.0

        if warning_regex:
            with pytest.warns(DeprecationWarning, match=warning_regex):
                deco = create_evaluator(name="depr", **kwargs)
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", DeprecationWarning)
                deco = create_evaluator(name="depr", **kwargs)

        ev = deco(_fn)
        assert ev.kind == expected_kind

    def test_conflicting_kind_and_source_raise_error_for_score(self):
        """Providing both 'kind' and deprecated 'source' with different values should error."""
        with pytest.raises(
            ValueError, match=r"Provide only one of 'kind' or 'source' \(they differ\). Use 'kind'."
        ):
            Score(kind="llm", source="code")

    def test_conflicting_kind_and_source_raise_error_for_evaluator(self):
        """Evaluator constructor should also error on conflicting 'kind' and 'source'."""

        class _MinimalEvaluator(Evaluator):
            def _evaluate(self, eval_input):
                return [Score(name=self.name, score=1.0, kind=self.kind)]

        with pytest.raises(
            ValueError, match=r"Provide only one of 'kind' or 'source' \(they differ\). Use 'kind'."
        ):
            _MinimalEvaluator(name="min", kind="llm", source="code")

    @pytest.mark.parametrize(
        "kind,source",
        [
            pytest.param("code", "code", id="score-equal-values"),
            pytest.param("llm", "llm", id="score-equal-llm"),
        ],
    )
    def test_equal_kind_and_source_allowed_for_score(self, kind, source):
        """Equal 'kind' and 'source' should pass with deprecation warning and keep kind value."""
        with pytest.warns(DeprecationWarning, match=r"deprecated"):
            s = Score(kind=kind, source=source)
        assert s.kind == kind

    @pytest.mark.parametrize(
        "kind,source",
        [
            pytest.param("code", "code", id="evaluator-equal-code"),
            pytest.param("human", "human", id="evaluator-equal-human"),
        ],
    )
    def test_equal_kind_and_source_allowed_for_evaluator(self, kind, source):
        """Equal 'kind' and 'source' should pass for Evaluator with deprecation warning."""

        class _MinimalEvaluator(Evaluator):
            def _evaluate(self, eval_input):
                return [Score(name=self.name, score=1.0, kind=self.kind)]

        with pytest.warns(DeprecationWarning, match=r"deprecated"):
            ev = _MinimalEvaluator(name="min", kind=kind, source=source)
        assert ev.kind == kind

    def test_conflicting_kind_and_source_raise_error_for_create_evaluator(self):
        """Decorator factory should error when both provided and different."""
        with pytest.raises(
            ValueError, match=r"Provide only one of 'kind' or 'source' \(they differ\). Use 'kind'."
        ):
            create_evaluator(name="conflict", kind="llm", source="code")

    def test_equal_kind_and_source_allowed_for_create_evaluator(self):
        """Decorator factory should allow equal values and emit deprecation warning."""

        def _fn(text: str) -> float:
            return 1.0

        with pytest.warns(DeprecationWarning, match=r"deprecated"):
            deco = create_evaluator(name="equal", kind="code", source="code")
        ev = deco(_fn)
        assert ev.kind == "code"
