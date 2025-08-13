# type: ignore
import asyncio
from contextlib import nullcontext as does_not_raise
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

from phoenix.evals.preview.evaluators import (
    ClassificationEvaluator,
    Evaluator,
    LLMEvaluator,
    Score,
    _validate_field_value,
    create_classifier,
    create_evaluator,
    list_evaluators,
    remap_eval_input,
    to_thread,
)
from phoenix.evals.preview.llm import LLM, AsyncLLM
from phoenix.evals.preview.templating import Template


# --- Shared Mock Classes ---
class MockLLM(LLM):
    """Mock LLM for testing that uses a valid provider."""

    def __init__(self, model: str = "test-model"):
        # Mock the LLM without calling parent constructor to avoid API key issues
        self.provider = "openai"
        self.model = model
        self._is_async = False

    def generate_classification(self, prompt: str, labels, include_explanation: bool, method):
        return {"label": "good", "explanation": "This is a good result"}


class MockAsyncLLM(AsyncLLM):
    """Mock AsyncLLM for testing that uses a valid provider."""

    def __init__(self, model: str = "test-model"):
        # Mock the AsyncLLM without calling parent constructor to avoid API key issues
        self.provider = "openai"
        self.model = model
        self._is_async = True

    async def generate_classification(self, prompt: str, labels, include_explanation: bool, method):
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
                {"name": "test", "score": 0.8, "label": "good", "source": "llm"},
                ["name", "score", "label", "source", "direction"],
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

    @patch("phoenix.evals.preview.evaluators.json.dumps")
    def test_score_pretty_print_calls_json_dumps(self, mock_dumps):
        """Test that pretty_print() calls json.dumps correctly."""
        score = Score(name="test", score=0.8)
        score.pretty_print(indent=4)

        mock_dumps.assert_called_once()
        args, kwargs = mock_dumps.call_args
        assert kwargs["indent"] == 4
        assert "name" in args[0]
        assert "score" in args[0]


class TestValidateFieldValue:
    """Test the _validate_field_value utility function."""

    @pytest.mark.parametrize(
        "value,field_name,key,expected_raises",
        [
            pytest.param(
                "valid string", "field_name", "key", does_not_raise(), id="Valid string value"
            ),
            pytest.param(123, "field_name", "key", does_not_raise(), id="Valid integer value"),
            pytest.param([1, 2, 3], "field_name", "key", does_not_raise(), id="Valid list value"),
            pytest.param(
                {"key": "value"}, "field_name", "key", does_not_raise(), id="Valid dict value"
            ),
            pytest.param(
                None, "field_name", "key", pytest.raises(ValueError), id="None value raises error"
            ),
            pytest.param(
                "", "field_name", "key", pytest.raises(ValueError), id="Empty string raises error"
            ),
            pytest.param(
                "   ",
                "field_name",
                "key",
                pytest.raises(ValueError),
                id="Whitespace-only string raises error",
            ),
            pytest.param(
                [], "field_name", "key", pytest.raises(ValueError), id="Empty list raises error"
            ),
            pytest.param(
                (), "field_name", "key", pytest.raises(ValueError), id="Empty tuple raises error"
            ),
            pytest.param(
                {}, "field_name", "key", pytest.raises(ValueError), id="Empty dict raises error"
            ),
        ],
    )
    def test_validate_field_value(self, value, field_name, key, expected_raises):
        """Test _validate_field_value with various inputs."""
        with expected_raises:
            _validate_field_value(value, field_name, key)

    @pytest.mark.parametrize(
        "value,expected_error_pattern",
        [
            pytest.param(None, "cannot be None", id="None value error message"),
            pytest.param("", "cannot be empty or whitespace-only", id="Empty string error message"),
            pytest.param(
                "   ", "cannot be empty or whitespace-only", id="Whitespace-only error message"
            ),
            pytest.param([], "cannot be empty", id="Empty list error message"),
            pytest.param((), "cannot be empty", id="Empty tuple error message"),
            pytest.param({}, "cannot be empty", id="Empty dict error message"),
        ],
    )
    def test_validate_field_value_error_messages(self, value, expected_error_pattern):
        """Test that _validate_field_value raises appropriate error messages."""
        with pytest.raises(ValueError, match=expected_error_pattern):
            _validate_field_value(value, "field_name", "key")


class TestRemapEvalInput:
    """Test the remap_eval_input utility function."""

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_result",
        [
            pytest.param(
                {"input": "test", "output": "result"},
                {"input", "output"},
                None,
                {"input": "test", "output": "result"},
                id="Basic remapping without input_mapping",
            ),
            pytest.param(
                {"user_input": "test", "model_output": "result"},
                {"input", "output"},
                {"input": "user_input", "output": "model_output"},
                {"input": "test", "output": "result"},
                id="Remapping with input_mapping",
            ),
            pytest.param(
                {"input": "test", "output": "result"},
                ["input", "output"],
                None,
                {"input": "test", "output": "result"},
                id="Remapping with list required_fields",
            ),
            pytest.param(
                {"input": "test"},
                None,
                None,
                {},
                id="Remapping with None required_fields returns empty dict",
            ),
        ],
    )
    def test_remap_eval_input_success(
        self, eval_input, required_fields, input_mapping, expected_result
    ):
        """Test successful remapping of eval_input."""
        result = remap_eval_input(eval_input, required_fields, input_mapping)
        assert result == expected_result

    @pytest.mark.parametrize(
        "eval_input,required_fields,input_mapping,expected_error_pattern",
        [
            pytest.param(
                {"input": "test"},
                {"input", "output"},
                None,
                "Missing required field",
                id="Missing required field raises error",
            ),
            pytest.param(
                {"input": ""},
                {"input"},
                None,
                "cannot be empty",
                id="Empty field value raises error",
            ),
            pytest.param(
                {"input": None},
                {"input"},
                None,
                "cannot be None",
                id="None field value raises error",
            ),
        ],
    )
    def test_remap_eval_input_errors(
        self, eval_input, required_fields, input_mapping, expected_error_pattern
    ):
        """Test remap_eval_input error handling."""
        with pytest.raises(ValueError, match=expected_error_pattern):
            remap_eval_input(eval_input, required_fields, input_mapping)


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
            return [Score(name=self.name, score=0.8, source=self.source)]

    @pytest.mark.parametrize(
        "name,source,required_fields,direction,expected_name,expected_source,expected_direction",
        [
            pytest.param(
                "test_evaluator",
                "llm",
                {"input", "output"},
                "minimize",
                "test_evaluator",
                "llm",
                "minimize",
                id="Evaluator with set required_fields and minimize direction",
            ),
            pytest.param(
                "test_evaluator",
                "heuristic",
                ["input", "output"],
                "maximize",
                "test_evaluator",
                "heuristic",
                "maximize",
                id="Evaluator with list required_fields and maximize direction",
            ),
            pytest.param(
                "test_evaluator",
                "human",
                None,
                "maximize",
                "test_evaluator",
                "human",
                "maximize",
                id="Evaluator with None required_fields",
            ),
        ],
    )
    def test_evaluator_initialization(
        self,
        name,
        source,
        required_fields,
        direction,
        expected_name,
        expected_source,
        expected_direction,
    ):
        """Test evaluator initialization with various parameters."""
        evaluator = self.MockEvaluator(
            name=name, source=source, required_fields=required_fields, direction=direction
        )

        assert evaluator.name == expected_name
        assert evaluator.source == expected_source
        assert evaluator.direction == expected_direction

    @pytest.mark.parametrize(
        "required_fields,expected_required_fields",
        [
            pytest.param(
                {"input", "output"}, {"input", "output"}, id="Set required_fields unchanged"
            ),
            pytest.param(
                ["input", "output"], {"input", "output"}, id="List required_fields converted to set"
            ),
            pytest.param(None, set(), id="None required_fields converted to empty set"),
        ],
    )
    def test_evaluator_required_fields_conversion(self, required_fields, expected_required_fields):
        """Test that required_fields are properly converted to a set."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields=required_fields
        )
        assert evaluator.required_fields == expected_required_fields

    def test_evaluator_evaluate_success(self):
        """Test successful evaluation."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields={"input"}
        )

        result = evaluator.evaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_evaluator_evaluate_with_mapping(self):
        """Test evaluation with input mapping."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields={"input"}
        )

        result = evaluator.evaluate({"user_input": "test"}, input_mapping={"input": "user_input"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    @pytest.mark.parametrize(
        "eval_input,required_fields,expected_raises",
        [
            pytest.param(
                {"input": "test"},
                {"input", "output"},
                pytest.raises(ValueError, match="Missing required field"),
                id="Missing required field raises ValueError",
            ),
            pytest.param(
                {"input": ""},
                {"input"},
                pytest.raises(ValueError, match="cannot be empty"),
                id="Empty required field raises ValueError",
            ),
        ],
    )
    def test_evaluator_evaluate_error_handling(self, eval_input, required_fields, expected_raises):
        """Test that evaluation errors raise ValueError for validation issues."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields=required_fields
        )

        with expected_raises:
            evaluator.evaluate(eval_input)

    def test_evaluator_callable(self):
        """Test that evaluator is callable."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields={"input"}
        )

        result = evaluator({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_evaluator_manual_batching(self):
        """Test applying evaluate across a list of inputs (external batching)."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields={"input"}
        )

        inputs = [{"input": "test1"}, {"input": "test2"}]
        results = [evaluator.evaluate(inp) for inp in inputs]

        assert len(results) == 2
        assert len(results[0]) == 1
        assert len(results[1]) == 1

    @pytest.mark.asyncio
    async def test_evaluator_aevaluate_success(self):
        """Test successful async evaluation."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields={"input"}
        )

        result = await evaluator.aevaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    @pytest.mark.asyncio
    async def test_evaluator_manual_async_batching(self):
        """Test applying aevaluate across a list of inputs with gather (external batching)."""
        evaluator = self.MockEvaluator(
            name="test_evaluator", source="llm", required_fields={"input"}
        )

        inputs = [{"input": "test1"}, {"input": "test2"}]
        results = await asyncio.gather(*[evaluator.aevaluate(inp) for inp in inputs])

        assert len(results) == 2
        assert len(results[0]) == 1
        assert len(results[1]) == 1


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
        assert evaluator.source == "llm"
        assert evaluator.llm == llm
        assert isinstance(evaluator.prompt_template, Template)
        assert evaluator.required_fields == expected_required_fields

    def test_llm_evaluator_initialization_with_template_object(self):
        """Test LLMEvaluator initialization with Template object."""
        llm = MockLLM()
        template = Template(template="Test template with {input}")

        evaluator = LLMEvaluator(name="test_evaluator", llm=llm, prompt_template=template)

        assert evaluator.prompt_template == template
        assert evaluator.required_fields == {"input"}

    def test_llm_evaluator_initialization_with_explicit_required_fields(self):
        """Test LLMEvaluator initialization with explicit required_fields."""
        llm = MockLLM()
        template = "Test template with {input}"

        evaluator = LLMEvaluator(
            name="test_evaluator",
            llm=llm,
            prompt_template=template,
            required_fields={"custom_field"},
        )

        assert evaluator.required_fields == {"custom_field"}

    def test_llm_evaluator_sync_evaluate_with_async_llm(self):
        """Test that sync evaluate raises error with AsyncLLM."""
        llm = MockAsyncLLM()
        template = "Test template"

        evaluator = LLMEvaluator(name="test_evaluator", llm=llm, prompt_template=template)

        with pytest.raises(
            ValueError, match="AsyncLLM is not supported for synchronous evaluation"
        ):
            evaluator.evaluate({"input": "test"})

    @pytest.mark.asyncio
    async def test_llm_evaluator_async_evaluate_with_sync_llm(self):
        """Test that async evaluate raises error with sync LLM."""
        llm = MockLLM()
        template = "Test template"

        evaluator = LLMEvaluator(name="test_evaluator", llm=llm, prompt_template=template)

        with pytest.raises(ValueError, match="LLM is not supported for asynchronous evaluation"):
            await evaluator.aevaluate({"input": "test"})


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
        llm = MockAsyncLLM()
        template = "Test template with {input}"
        choices = ["good", "bad"]

        evaluator = ClassificationEvaluator(
            name="test_evaluator", llm=llm, prompt_template=template, choices=choices
        )

        result = await evaluator._aevaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"


class TestRegistryAndDecorator:
    """Test registry and decorator functionality."""

    def test_list_evaluators_empty(self):
        """Test list_evaluators with empty registry."""
        # Clear registry for this test
        from phoenix.evals.preview.evaluators import _registry

        original_registry = _registry.copy()
        _registry.clear()

        try:
            result = list_evaluators()
            assert result == []
        finally:
            # Restore original registry
            _registry.clear()
            _registry.update(original_registry)

    def test_create_evaluator_decorator(self):
        """Test create_evaluator decorator."""

        @create_evaluator("test_evaluator", "heuristic", "maximize")
        def test_func(input_text: str) -> Score:
            return Score(score=0.8, explanation="test")

        # Test the decorated function
        result = test_func({"input_text": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_create_evaluator_with_mapping(self):
        """Test create_evaluator with input mapping."""

        @create_evaluator("test_evaluator", "heuristic")
        def test_func(input_text: str) -> Score:
            return Score(score=0.8)

        result = test_func({"user_input": "test"}, input_mapping={"input_text": "user_input"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_create_evaluator_registration(self):
        """Test that create_evaluator registers the function."""

        @create_evaluator("registered_evaluator", "heuristic")
        def test_func(input_text: str) -> Score:
            return Score(score=0.8)

        # Check if it's registered
        evaluators = list_evaluators()
        assert "registered_evaluator" in evaluators


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
