# type: ignore
"""
Tests for the 9 built-in ClassificationEvaluator subclasses.

Covers:
- Default behavior (no change from before)
- kwargs forwarding (e.g. temperature)
- HallucinationEvaluator deprecation warning preserved
"""

import warnings

import pytest

from phoenix.evals.llm.prompts import PromptTemplate
from phoenix.evals.metrics.conciseness import ConcisenessEvaluator
from phoenix.evals.metrics.correctness import CorrectnessEvaluator
from phoenix.evals.metrics.document_relevance import DocumentRelevanceEvaluator
from phoenix.evals.metrics.faithfulness import FaithfulnessEvaluator
from phoenix.evals.metrics.hallucination import HallucinationEvaluator
from phoenix.evals.metrics.refusal import RefusalEvaluator
from phoenix.evals.metrics.tool_invocation import ToolInvocationEvaluator
from phoenix.evals.metrics.tool_response_handling import ToolResponseHandlingEvaluator
from phoenix.evals.metrics.tool_selection import ToolSelectionEvaluator

# ---------------------------------------------------------------------------
# Shared mock
# ---------------------------------------------------------------------------


class MockLLM:
    """Minimal LLM stub — avoids hitting any API."""

    def __init__(self, model: str = "test-model"):
        self.provider = "openai"
        self.model = model

    def generate_classification(self, prompt, labels, include_explanation, method):
        first_label = labels[0] if isinstance(labels, list) else list(labels.keys())[0]
        return {"label": first_label, "explanation": "mock explanation"}

    async def async_generate_classification(self, prompt, labels, include_explanation, method):
        first_label = labels[0] if isinstance(labels, list) else list(labels.keys())[0]
        return {"label": first_label, "explanation": "mock explanation"}


# ---------------------------------------------------------------------------
# Parametrize over all 9 evaluators (class, required eval_input keys)
# ---------------------------------------------------------------------------

ALL_EVALUATORS = [
    pytest.param(
        CorrectnessEvaluator,
        {"input": "What is 2+2?", "output": "4"},
        id="CorrectnessEvaluator",
    ),
    pytest.param(
        FaithfulnessEvaluator,
        {"input": "Q", "output": "A", "context": "C"},
        id="FaithfulnessEvaluator",
    ),
    pytest.param(
        ConcisenessEvaluator,
        {"input": "Q", "output": "A"},
        id="ConcisenessEvaluator",
    ),
    pytest.param(
        DocumentRelevanceEvaluator,
        {"input": "Q", "document_text": "D"},
        id="DocumentRelevanceEvaluator",
    ),
    pytest.param(
        RefusalEvaluator,
        {"input": "Q", "output": "A"},
        id="RefusalEvaluator",
    ),
    pytest.param(
        ToolSelectionEvaluator,
        {"input": "Q", "available_tools": "T", "tool_selection": "S"},
        id="ToolSelectionEvaluator",
    ),
    pytest.param(
        ToolInvocationEvaluator,
        {"input": "Q", "available_tools": "T", "tool_selection": "S"},
        id="ToolInvocationEvaluator",
    ),
    pytest.param(
        ToolResponseHandlingEvaluator,
        {"input": "Q", "tool_call": "C", "tool_result": "R", "output": "A"},
        id="ToolResponseHandlingEvaluator",
    ),
    pytest.param(
        HallucinationEvaluator,
        {"input": "Q", "output": "A", "context": "C"},
        id="HallucinationEvaluator",
        marks=pytest.mark.filterwarnings(
            "ignore:HallucinationEvaluator is deprecated and will be removed in a future version.*:DeprecationWarning"
        ),
    ),
]


# ---------------------------------------------------------------------------
# Tests: default behavior
# ---------------------------------------------------------------------------


class TestDefaultBehavior:
    """Evaluators constructed with only llm= should behave exactly as before."""

    @pytest.mark.parametrize("EvaluatorClass,eval_input", ALL_EVALUATORS)
    def test_default_init_uses_builtin_prompt(self, EvaluatorClass, eval_input):
        """Default construction stores the class-level PROMPT as the template."""
        llm = MockLLM()
        ev = EvaluatorClass(llm=llm)
        assert isinstance(ev.prompt_template, PromptTemplate)
        # The stored template should equal the class-level PROMPT
        assert ev.prompt_template.template == EvaluatorClass.PROMPT.template

    @pytest.mark.parametrize("EvaluatorClass,eval_input", ALL_EVALUATORS)
    def test_default_init_sets_name(self, EvaluatorClass, eval_input):
        llm = MockLLM()
        ev = EvaluatorClass(llm=llm)
        assert ev.name == EvaluatorClass.NAME

    @pytest.mark.parametrize("EvaluatorClass,eval_input", ALL_EVALUATORS)
    def test_default_init_sets_direction(self, EvaluatorClass, eval_input):
        llm = MockLLM()
        ev = EvaluatorClass(llm=llm)
        assert ev.direction == EvaluatorClass.DIRECTION


# ---------------------------------------------------------------------------
# Tests: kwargs forwarding
# ---------------------------------------------------------------------------


class TestKwargsForwarding:
    """Extra kwargs (e.g. temperature) must be forwarded to ClassificationEvaluator."""

    @pytest.mark.parametrize("EvaluatorClass,eval_input", ALL_EVALUATORS)
    def test_kwargs_forwarded_to_super(self, EvaluatorClass, eval_input):
        """Constructing with extra kwargs should not raise TypeError."""
        llm = MockLLM()
        # Just verifying no TypeError is raised — previously this would fail
        ev = EvaluatorClass(llm=llm, temperature=0.0, max_tokens=256)
        assert ev is not None

    @pytest.mark.parametrize("EvaluatorClass,eval_input", ALL_EVALUATORS)
    def test_kwargs_stored_on_evaluator(self, EvaluatorClass, eval_input):
        """Kwargs passed to evaluator should be stored as invocation_parameters."""
        llm = MockLLM()
        ev = EvaluatorClass(llm=llm, temperature=0.5)
        assert ev.invocation_parameters.get("temperature") == 0.5


# ---------------------------------------------------------------------------
# Tests: HallucinationEvaluator deprecation warning preserved
# ---------------------------------------------------------------------------


class TestHallucinationDeprecation:
    def test_deprecation_warning_on_default_init(self):
        llm = MockLLM()
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            HallucinationEvaluator(llm=llm)
        assert any(issubclass(warning.category, DeprecationWarning) for warning in w)

    def test_deprecation_warning_with_kwargs(self):
        llm = MockLLM()
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            HallucinationEvaluator(llm=llm, temperature=0.0)
        assert any(issubclass(warning.category, DeprecationWarning) for warning in w)
