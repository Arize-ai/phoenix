# type: ignore
"""
Tests for the built-in ClassificationEvaluator subclasses.

Covers:
- Default behavior (no change from before)
- kwargs forwarding (e.g. temperature)
"""

import pytest

from phoenix.evals.llm.prompts import PromptTemplate
from phoenix.evals.metrics.completeness import CompletenessEvaluator
from phoenix.evals.metrics.conciseness import ConcisenessEvaluator
from phoenix.evals.metrics.correctness import CorrectnessEvaluator
from phoenix.evals.metrics.document_relevance import DocumentRelevanceEvaluator
from phoenix.evals.metrics.faithfulness import FaithfulnessEvaluator
from phoenix.evals.metrics.hallucination import HallucinationEvaluator
from phoenix.evals.metrics.pii_detection import PiiDetectionEvaluator
from phoenix.evals.metrics.refusal import RefusalEvaluator
from phoenix.evals.metrics.retrieval_relevance import RetrievalRelevanceEvaluator
from phoenix.evals.metrics.sentiment import SentimentEvaluator
from phoenix.evals.metrics.tool_invocation import ToolInvocationEvaluator
from phoenix.evals.metrics.tool_response_handling import ToolResponseHandlingEvaluator
from phoenix.evals.metrics.tool_selection import ToolSelectionEvaluator
from phoenix.evals.metrics.user_friction import UserFrictionEvaluator

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
# Parametrize over every evaluator (class, required eval_input keys)
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
        CompletenessEvaluator,
        {
            "conversation": (
                "User: Reset my password and update billing.\nAssistant: Password reset."
            ),
        },
        id="CompletenessEvaluator",
    ),
    pytest.param(
        RetrievalRelevanceEvaluator,
        {"input": "Q", "context": "C"},
        id="RetrievalRelevanceEvaluator",
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
        marks=pytest.mark.filterwarnings("ignore::DeprecationWarning"),
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
        UserFrictionEvaluator,
        {"conversation": "User: Help me.\nAssistant: What do you need?", "user_message": "Logs."},
        id="UserFrictionEvaluator",
    ),
    pytest.param(
        PiiDetectionEvaluator,
        {"conversation": "User: Reset my account. My email is jane.doe@acme.com"},
        id="PiiDetectionEvaluator",
    ),
    pytest.param(
        HallucinationEvaluator,
        {"input": "User: Q\nAssistant: A", "output": "A"},
        id="HallucinationEvaluator",
    ),
    pytest.param(
        SentimentEvaluator,
        {
            "conversation": "User: My order still hasn't arrived.\nAssistant: Let me check.",
            "user_message": "This is the third time I've had to ask.",
        },
        id="SentimentEvaluator",
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
# Tests: sentiment-specific behavior
# ---------------------------------------------------------------------------


class RecordingMockLLM:
    """MockLLM that returns a fixed label and records the prompt and labels it received."""

    def __init__(self, label: str, model: str = "test-model"):
        self.provider = "openai"
        self.model = model
        self._label = label
        self.last_prompt = None
        self.last_labels = None

    def generate_classification(self, prompt, labels, include_explanation, method):
        self.last_prompt = prompt
        self.last_labels = labels
        return {"label": self._label, "explanation": "mock explanation"}

    async def async_generate_classification(self, prompt, labels, include_explanation, method):
        self.last_prompt = prompt
        self.last_labels = labels
        return {"label": self._label, "explanation": "mock explanation"}


def test_sentiment_evaluator_classifies_negative() -> None:
    """The three-way choice, the -1.0 score, and the user_message placeholder are exercised."""
    llm = RecordingMockLLM(label="negative")
    ev = SentimentEvaluator(llm=llm)
    eval_input = {
        "conversation": "User: My order still hasn't arrived.\nAssistant: Let me check.",
        "user_message": "This is the third time I've had to ask.",
    }

    scores = ev.evaluate(eval_input)

    assert len(scores) == 1
    score = scores[0]
    assert score.score == -1.0
    assert score.label == "negative"
    assert score.direction == "neutral"

    # The judge is offered exactly the three sentiment labels, in order.
    assert llm.last_labels == ["positive", "neutral", "negative"]

    # The target user message is rendered into the prompt via the user_message placeholder.
    prompt_text = "\n".join(message["content"] for message in llm.last_prompt)
    assert "This is the third time I've had to ask." in prompt_text


def test_document_relevance_evaluator_warns_with_migration_guidance() -> None:
    with pytest.warns(DeprecationWarning) as warning_info:
        DocumentRelevanceEvaluator(llm=MockLLM())

    message = str(warning_info[0].message)
    assert "RetrievalRelevanceEvaluator" in message
    assert "document_text" in message
    assert "context" in message
    assert "unrelated" in message
    assert "irrelevant" in message
    assert "next major release" in message
