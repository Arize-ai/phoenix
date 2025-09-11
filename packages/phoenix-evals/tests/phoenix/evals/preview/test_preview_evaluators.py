# type: ignore
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

from phoenix.evals.preview.evaluators import (
    ClassificationEvaluator,
    Evaluator,
    LLMEvaluator,
    Score,
    create_classifier,
    create_evaluator,
    list_evaluators,
    to_thread,
)
from phoenix.evals.preview.llm import LLM
from phoenix.evals.preview.templating import Template


# --- Shared Mock Classes ---
class MockLLM(LLM):
    """Mock LLM for testing that uses a valid provider."""

    def __init__(self, model: str = "test-model"):
        # Mock the LLM without calling parent constructor to avoid API key issues
        self.provider = "openai"
        self.model = model

    def generate_classification(self, prompt: str, labels, include_explanation: bool, method):
        return {"label": "good", "explanation": "This is a good result"}

    async def agenerate_classification(
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
        "name,source,direction,expected_name,expected_source,expected_direction",
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
                "heuristic",
                "maximize",
                "test_evaluator",
                "heuristic",
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
        source,
        direction,
        expected_name,
        expected_source,
        expected_direction,
    ):
        """Test evaluator initialization with various parameters."""
        evaluator = self.MockEvaluator(name=name, source=source, direction=direction)

        assert evaluator.name == expected_name
        assert evaluator.source == expected_source
        assert evaluator.direction == expected_direction

    @pytest.mark.parametrize(
        "dummy",
        [pytest.param("x", id="inferred")],
    )
    def test_evaluator_required_fields_inferred(self, dummy):
        """Required fields inferred from schema or mapping."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...), output=(str, ...))
        evaluator = self.MockEvaluator(name="test_evaluator", source="llm", input_schema=InputModel)
        assert evaluator._get_required_fields(None) == {"input", "output"}

        # From mapping when schema absent
        evaluator2 = self.MockEvaluator(name="test_evaluator", source="llm")
        mapping = {"input": "user_input", "output": "model_output"}
        assert evaluator2._get_required_fields(mapping) == {"input", "output"}

    def test_evaluator_evaluate_success(self):
        """Test successful evaluation."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...))
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            source="llm",
            input_schema=InputModel,
        )

        result = evaluator.evaluate({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    def test_evaluator_evaluate_with_mapping(self):
        """Test evaluation with input mapping."""
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            source="llm",
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
            source="llm",
            input_schema=InputModel,
        )

        with expected_raises:
            evaluator.evaluate(eval_input)

    def test_evaluator_callable(self):
        """Test that evaluator is callable."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...))
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            source="llm",
            input_schema=InputModel,
        )

        result = evaluator({"input": "test"})

        assert len(result) == 1
        assert result[0].name == "test_evaluator"

    @pytest.mark.asyncio
    async def test_evaluator_aevaluate_success(self):
        """Test successful async evaluation."""
        from pydantic import create_model

        InputModel = create_model("InputModel", input=(str, ...))
        evaluator = self.MockEvaluator(
            name="test_evaluator",
            source="llm",
            input_schema=InputModel,
        )

        result = await evaluator.aevaluate({"input": "test"})

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
        assert evaluator.source == "llm"
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

    def test_create_evaluator_registration(self):
        """Test that create_evaluator registers the function."""

        @create_evaluator("registered_evaluator", "heuristic")
        def test_func(input_text: str) -> Score:
            return Score(score=0.8)

        # Check if it's registered
        evaluators = list_evaluators()
        assert "registered_evaluator" in evaluators


class TestCreateEvaluatorDecorator:
    """Test the enhanced create_evaluator decorator with various return types."""

    def test_create_evaluator_with_score_object(self):
        """Test create_evaluator with Score object return."""

        @create_evaluator("test_evaluator", "heuristic", "maximize")
        def test_func(input_text: str) -> Score:
            return Score(score=0.8, label="good", explanation="test explanation")

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "test_evaluator"
        assert score.score == 0.8
        assert score.label == "good"
        assert score.explanation == "test explanation"
        assert score.source == "heuristic"
        assert score.direction == "maximize"

    def test_create_evaluator_with_number_return(self):
        """Test create_evaluator with number return."""

        @create_evaluator("number_evaluator", "heuristic")
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

        @create_evaluator("boolean_evaluator", "heuristic")
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

        @create_evaluator("short_string_evaluator", "heuristic")
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

        @create_evaluator("long_string_evaluator", "heuristic")
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

        @create_evaluator("dict_evaluator", "heuristic")
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

        @create_evaluator("tuple_evaluator", "heuristic")
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

        @create_evaluator("mixed_tuple_evaluator", "heuristic")
        def test_func(input_text: str) -> tuple:
            return (0.7, {"score": 0.8, "label": "mixed"}, "This is a final explanation")

        with pytest.raises(ValueError):
            test_func.evaluate({"input_text": "test"})

    def test_create_evaluator_with_unsupported_type_raises_error(self):
        """Test create_evaluator raises error for unsupported return types."""

        @create_evaluator("unsupported_evaluator", "heuristic")
        def test_func(input_text: str) -> list:
            return [1, 2, 3]

        with pytest.raises(ValueError):
            test_func.evaluate({"input_text": "test"})

    def test_create_evaluator_with_unsupported_type_error_message(self):
        """Test create_evaluator provides informative error message for unsupported types."""

        @create_evaluator("error_test_evaluator", "heuristic")
        def test_func(input_text: str) -> set:
            return {1, 2, 3}

        with pytest.raises(ValueError) as exc_info:
            test_func.evaluate({"input_text": "test"})

        error_message = str(exc_info.value)
        assert "Unsupported return type 'set' for evaluator 'error_test_evaluator'" in error_message
        assert "{1, 2, 3}" in error_message  # Shows the actual value that caused the error

    def test_create_evaluator_with_input_mapping(self):
        """Test create_evaluator with input mapping."""

        @create_evaluator("mapping_evaluator", "heuristic")
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

        @create_evaluator("param_test_evaluator", "heuristic")
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

        @create_evaluator("metadata_evaluator", "heuristic")
        def test_func(input_text: str) -> Score:
            return Score(
                score=0.8, label="good", explanation="test", metadata={"custom_key": "custom_value"}
            )

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.metadata == {"custom_key": "custom_value"}

    def test_create_evaluator_with_custom_source_and_direction(self):
        """Test create_evaluator with custom source and direction."""

        @create_evaluator("custom_evaluator", "llm", "minimize")
        def test_func(input_text: str) -> float:
            return 0.3

        result = test_func.evaluate({"input_text": "test"})

        assert len(result) == 1
        score = result[0]
        assert score.name == "custom_evaluator"
        assert score.source == "llm"
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
        @create_evaluator("simple_eval")
        def simple_eval(output: str, expected: str) -> Score:
            return Score(score=1.0)

        schema = simple_eval.describe()
        assert schema["input_schema"]["type"] == "object"
        assert set(schema["input_schema"]["required"]) == {"output", "expected"}
        assert schema["input_schema"]["properties"]["output"]["type"] == "string"
        assert schema["input_schema"]["properties"]["expected"]["type"] == "string"

    def test_describe_optional_and_defaults(self):
        @create_evaluator("opt_eval")
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
            return [Score(name=self.name, score=1.0, source=self.source)]

    def test_required_fields_from_mapping_when_no_schema(self):
        e = self.MinimalEvaluator(name="min", source="heuristic")
        payload = {"in": {"msg": "hi"}}
        mapping = {"text": lambda row: row["in"]["msg"].upper()}

        # Without mapping and without schema -> error
        with pytest.raises(ValueError, match="Cannot determine input fields"):
            e.evaluate(payload)

        # With mapping keys -> accepted
        scores = e.evaluate(payload, input_mapping=mapping)
        assert len(scores) == 1 and scores[0].score == 1.0

    def test_bound_evaluator_evaluate_and_describe(self):
        @create_evaluator("emph")
        def emph(text: str) -> Score:
            return Score(score=float(len(text) > 0))

        mapping = {"text": lambda row: row["raw"]["value"].strip()}
        payload = {"raw": {"value": " hello "}}

        from phoenix.evals.preview.evaluators import bind_evaluator

        be = bind_evaluator(emph, mapping)
        # Evaluate through bound mapping
        scores = be.evaluate(payload)
        assert len(scores) == 1 and scores[0].score == 1.0
        # Introspection passthrough
        assert be.describe()["name"] == "emph"
        assert set(be.input_mapping_description()["input_mapping_keys"]) == {"text"}
