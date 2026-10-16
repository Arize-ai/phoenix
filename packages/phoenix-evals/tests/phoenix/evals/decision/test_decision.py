from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals import ClassificationEvaluator, DecisionModel
from phoenix.evals.decision.types import BaseDecisionAdapter


def _response(
    choice,
    probabilities,
    model="mock-evaluation-model",
    confidence=0.95,
    input_tokens=11,
    output_tokens=3,
):
    """Build a fake SystemOneResponse exposing `.choices[name]`, `.model`, and `.usage`."""
    answer = SimpleNamespace(choice=choice, probabilities=probabilities, confidence=confidence)
    usage = SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)
    return SimpleNamespace(model=model, choices={"label": answer}, usage=usage)


def _patch_clients(monkeypatch, sync_client=None, async_client=None):
    monkeypatch.setattr(
        "typesafe_sdk.TypeSafeClient", MagicMock(return_value=sync_client or MagicMock())
    )
    monkeypatch.setattr(
        "typesafe_sdk.AsyncTypeSafeClient", MagicMock(return_value=async_client or MagicMock())
    )


def test_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("incorrect", {"correct": 0.03, "incorrect": 0.97})
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="typesafe", model="jev-latest")
    result = decision.generate_classification("Is 2 + 2 = 5 correct?", ["correct", "incorrect"])

    assert result == {
        "label": "incorrect",
        "metadata": {
            "probabilities": {"correct": 0.03, "incorrect": 0.97},
            "model_id": "mock-evaluation-model",
            "confidence": 0.95,
        },
    }
    assert "explanation" not in result
    # usage is popped onto the DECISION span, not returned in the result
    assert "usage" not in result

    client.system_one.assert_called_once()
    _, kwargs = client.system_one.call_args
    assert kwargs["state"] == "Is 2 + 2 = 5 correct?"
    assert kwargs["model"] == "jev-latest"
    question = kwargs["questions"]["label"]
    assert question.criteria == {"correct": None, "incorrect": None}
    assert isinstance(question.instructions, str) and question.instructions


async def test_async_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    async_client = MagicMock()
    async_client.system_one = AsyncMock(return_value=_response("correct", {"correct": 0.9}))
    _patch_clients(monkeypatch, async_client=async_client)

    decision = DecisionModel(provider="typesafe", model="jev-latest")
    result = await decision.async_generate_classification(
        "Is the sky blue?", ["correct", "incorrect"]
    )

    assert result["label"] == "correct"
    assert result["metadata"]["probabilities"] == {"correct": 0.9}
    async_client.system_one.assert_awaited_once()


def test_evaluator_maps_the_chosen_label_to_a_score_without_an_explanation(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("invalid", {"valid": 0.1, "invalid": 0.9})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="is the following question valid: {question}",
        choices={"valid": 1, "invalid": 0},
    )
    [score] = evaluator.evaluate({"question": "asdf"})

    assert score.label == "invalid"
    assert score.score == 0
    assert score.explanation is None
    assert score.metadata["model"] == "jev-latest"
    assert score.metadata["model_id"] == "mock-evaluation-model"
    assert score.metadata["probabilities"] == {"valid": 0.1, "invalid": 0.9}


def test_tuple_style_choices_pass_descriptions_as_criteria(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("valid", {"valid": 0.8, "invalid": 0.2})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="is the following question valid: {question}",
        choices={
            "valid": (1, "the question is well formed"),
            "invalid": (0, "the question is malformed"),  # label: (score, description)
        },
    )
    [score] = evaluator.evaluate({"question": "asdf"})

    # The score map from the tuple still maps the chosen label to its score.
    assert score.label == "valid"
    assert score.score == 1

    # The descriptions from the tuple reach Jev as the choice criteria.
    _, kwargs = client.system_one.call_args
    question = kwargs["questions"]["label"]
    assert question.criteria == {
        "valid": "the question is well formed",
        "invalid": "the question is malformed",
    }


def test_invocation_kwargs_reach_system_one_but_evaluator_params_do_not(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("correct", {"correct": 0.9, "incorrect": 0.1})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="correctness",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="is this correct: {text}",
        choices=["correct", "incorrect"],
        timeout=30,  # an extra invocation parameter the user passes through the evaluator
    )
    evaluator.evaluate({"text": "2 + 2 = 4"})

    _, kwargs = client.system_one.call_args
    # Real SDK options are forwarded...
    assert kwargs["timeout"] == 30
    # ...but the evaluator-only params the SDK doesn't accept are dropped at the facade.
    assert "include_explanation" not in kwargs
    assert "method" not in kwargs


def test_missing_sdk_raises_a_helpful_error(monkeypatch):
    import builtins

    real_import = builtins.__import__

    def _fail(name, *args, **kwargs):
        if name == "typesafe_sdk":
            raise ImportError("No module named 'typesafe_sdk'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _fail)
    # The client factory raises ImportError when typesafe-sdk is missing; the facade wraps
    # client-construction failures in a ValueError whose message still names the package.
    with pytest.raises(ValueError, match="typesafe-sdk"):
        DecisionModel(provider="typesafe", model="jev-latest")


def test_to_state_passes_a_string_prompt_through_unchanged():
    assert BaseDecisionAdapter._to_state("just some text") == "just some text"


def test_to_state_joins_a_message_list_and_drops_roles():
    prompt = [
        {"role": "system", "content": "You are a judge."},
        {"role": "user", "content": "Is 2 + 2 = 4?"},
    ]
    assert BaseDecisionAdapter._to_state(prompt) == "You are a judge.\n\nIs 2 + 2 = 4?"


def test_to_state_keeps_only_text_content_parts():
    prompt = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "first"},
                {"type": "image_url", "image_url": {"url": "http://example.com/x.png"}},
                {"type": "text", "text": "second"},
            ],
        },
    ]
    assert BaseDecisionAdapter._to_state(prompt) == "first\nsecond"


def test_to_state_skips_empty_pieces():
    prompt = [
        {"role": "system", "content": ""},
        {"role": "user", "content": "only this"},
    ]
    assert BaseDecisionAdapter._to_state(prompt) == "only this"


def test_confidence_is_omitted_when_the_provider_does_not_report_one(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response(
        "correct", {"correct": 0.9, "incorrect": 0.1}, confidence=None
    )
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="typesafe", model="jev-latest")
    result = decision.generate_classification("is this ok?", ["correct", "incorrect"])

    assert "confidence" not in result["metadata"]


def test_decision_span_records_attributes_and_usage(monkeypatch):
    from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    client = MagicMock()
    client.system_one.return_value = _response(
        "valid", {"valid": 0.8, "invalid": 0.2}, input_tokens=42, output_tokens=5
    )
    _patch_clients(monkeypatch, sync_client=client)

    # Inject our own tracer so the span lands in this exporter (no reliance on the global).
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")

    decision = DecisionModel(provider="typesafe", model="jev-latest")
    result = decision.generate_classification("is this valid?", ["valid", "invalid"], tracer=tracer)

    # usage is popped onto the span, not returned in the result.
    assert "usage" not in result

    [span] = exporter.get_finished_spans()
    attrs = dict(span.attributes or {})
    assert (
        attrs[SpanAttributes.OPENINFERENCE_SPAN_KIND] == OpenInferenceSpanKindValues.DECISION.value
    )
    assert attrs[SpanAttributes.DECISION_SYSTEM] == "typesafe"
    assert attrs[SpanAttributes.DECISION_PROVIDER] == "typesafe"
    assert attrs[SpanAttributes.DECISION_REQUEST_MODEL_NAME] == "jev-latest"
    assert attrs[SpanAttributes.DECISION_RESPONSE_MODEL_NAME] == "mock-evaluation-model"
    assert attrs[SpanAttributes.DECISION_TOKEN_COUNT_INPUT] == 42
    assert attrs[SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT] == 5
    assert SpanAttributes.INPUT_VALUE in attrs
    assert SpanAttributes.OUTPUT_VALUE in attrs


def test_usage_is_not_copied_onto_the_score(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _response("valid", {"valid": 0.8, "invalid": 0.2})
    _patch_clients(monkeypatch, sync_client=client)

    # Through the evaluator: confidence reaches the score, usage does not.
    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="is this valid: {text}",
        choices=["valid", "invalid"],
    )
    [score] = evaluator.evaluate({"text": "asdf"})
    assert score.metadata["confidence"] == 0.95
    assert "usage" not in score.metadata
