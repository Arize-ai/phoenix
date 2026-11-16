from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals import ClassificationEvaluator, DecisionModel
from phoenix.evals.exceptions import PhoenixDecisionRefusal


def _response(
    choice,
    probabilities,
    model="mock-evaluation-model",
    confidence=0.95,
    input_tokens=11,
    output_tokens=3,
):
    """Build a fake Decision exposing `.answers`, `.model`, and `.usage`.

    OpenAI reports probabilities as a list of {value, probability}; the fixture takes the
    value -> probability dict the adapter produces and re-expands it to that list shape.
    """
    probs = [SimpleNamespace(value=v, probability=p) for v, p in probabilities.items()]
    answer = SimpleNamespace(
        type="choice", name="label", choice=choice, probabilities=probs, confidence=confidence
    )
    usage = SimpleNamespace(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )
    return SimpleNamespace(model=model, answers=[answer], usage=usage)


def _patch_clients(monkeypatch, sync_client=None, async_client=None):
    monkeypatch.setattr("openai.OpenAI", MagicMock(return_value=sync_client or MagicMock()))
    monkeypatch.setattr("openai.AsyncOpenAI", MagicMock(return_value=async_client or MagicMock()))


def test_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response(
        "incorrect", {"correct": 0.03, "incorrect": 0.97}
    )
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="openai", model="gpt-6-luna")
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
    assert "usage" not in result

    client.decisions.create.assert_called_once()
    _, kwargs = client.decisions.create.call_args
    assert kwargs["input"] == "Is 2 + 2 = 5 correct?"
    assert kwargs["model"] == "gpt-6-luna"
    [question] = kwargs["questions"]
    assert question["type"] == "choice"
    assert question["name"] == "label"
    assert question["instructions"]
    assert question["choices"] == [{"value": "correct"}, {"value": "incorrect"}]


async def test_async_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    async_client = MagicMock()
    async_client.decisions.create = AsyncMock(return_value=_response("correct", {"correct": 0.9}))
    _patch_clients(monkeypatch, async_client=async_client)

    decision = DecisionModel(provider="openai", model="gpt-6-luna")
    result = await decision.async_generate_classification(
        "Is the sky blue?", ["correct", "incorrect"]
    )

    assert result["label"] == "correct"
    assert result["metadata"]["probabilities"] == {"correct": 0.9}
    async_client.decisions.create.assert_awaited_once()


def test_evaluator_maps_the_chosen_label_to_a_score_without_an_explanation(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("invalid", {"valid": 0.1, "invalid": 0.9})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="openai", model="gpt-6-luna"),
        prompt_template="is the following question valid: {question}",
        choices={"valid": 1, "invalid": 0},
    )
    [score] = evaluator.evaluate({"question": "asdf"})

    assert score.label == "invalid"
    assert score.score == 0
    assert score.explanation is None
    assert score.metadata["model"] == "gpt-6-luna"
    assert score.metadata["model_id"] == "mock-evaluation-model"
    assert score.metadata["probabilities"] == {"valid": 0.1, "invalid": 0.9}


def test_tuple_style_choices_pass_descriptions_as_choice_descriptions(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("valid", {"valid": 0.8, "invalid": 0.2})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="openai", model="gpt-6-luna"),
        prompt_template="is the following question valid: {question}",
        choices={
            "valid": (1, "the question is well formed"),
            "invalid": (0, "the question is malformed"),  # label: (score, description)
        },
    )
    [score] = evaluator.evaluate({"question": "asdf"})

    assert score.label == "valid"
    assert score.score == 1

    _, kwargs = client.decisions.create.call_args
    [question] = kwargs["questions"]
    assert question["choices"] == [
        {"value": "valid", "description": "the question is well formed"},
        {"value": "invalid", "description": "the question is malformed"},
    ]


def test_invocation_kwargs_reach_create_but_evaluator_params_do_not(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("correct", {"correct": 0.9, "incorrect": 0.1})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="correctness",
        llm=DecisionModel(provider="openai", model="gpt-6-luna"),
        prompt_template="is this correct: {text}",
        choices=["correct", "incorrect"],
        timeout=30,
    )
    evaluator.evaluate({"text": "2 + 2 = 4"})

    _, kwargs = client.decisions.create.call_args
    assert kwargs["timeout"] == 30
    assert "include_explanation" not in kwargs
    assert "method" not in kwargs


def test_refusal_raises(monkeypatch):
    refusal = SimpleNamespace(type="refusal", name="label")
    client = MagicMock()
    client.decisions.create.return_value = SimpleNamespace(
        model="mock-evaluation-model", answers=[refusal], usage=None
    )
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="openai", model="gpt-6-luna")
    with pytest.raises(PhoenixDecisionRefusal, match="refused"):
        decision.generate_classification("something", ["correct", "incorrect"])


def test_max_retries_defaults_to_zero_but_can_be_overridden(monkeypatch):
    sync_ctor = MagicMock(return_value=MagicMock())
    async_ctor = MagicMock(return_value=MagicMock())
    monkeypatch.setattr("openai.OpenAI", sync_ctor)
    monkeypatch.setattr("openai.AsyncOpenAI", async_ctor)

    DecisionModel(provider="openai", model="gpt-6-luna")
    assert sync_ctor.call_args.kwargs["max_retries"] == 0

    sync_ctor.reset_mock()
    async_ctor.reset_mock()

    # A caller-provided value must win and must not crash with a duplicate-kwarg error.
    DecisionModel(provider="openai", model="gpt-6-luna", max_retries=3)
    assert sync_ctor.call_args.kwargs["max_retries"] == 3


def test_old_sdk_without_decisions_raises_a_helpful_error(monkeypatch):
    # An importable-but-old openai has no `decisions` resource; the factory rejects it and the
    # facade wraps the failure in a ValueError whose message still points at the Decisions API.
    _patch_clients(monkeypatch, sync_client=SimpleNamespace(), async_client=SimpleNamespace())
    with pytest.raises(ValueError, match="Decisions API"):
        DecisionModel(provider="openai", model="gpt-6-luna")


def test_confidence_is_omitted_when_the_provider_does_not_report_one(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response(
        "correct", {"correct": 0.9, "incorrect": 0.1}, confidence=None
    )
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="openai", model="gpt-6-luna")
    result = decision.generate_classification("is this ok?", ["correct", "incorrect"])

    assert "confidence" not in result["metadata"]


def test_decision_span_records_attributes_and_usage(monkeypatch):
    from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    client = MagicMock()
    client.decisions.create.return_value = _response(
        "valid", {"valid": 0.8, "invalid": 0.2}, input_tokens=42, output_tokens=5
    )
    _patch_clients(monkeypatch, sync_client=client)

    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")

    decision = DecisionModel(provider="openai", model="gpt-6-luna")
    result = decision.generate_classification("is this valid?", ["valid", "invalid"], tracer=tracer)

    assert "usage" not in result

    [span] = exporter.get_finished_spans()
    attrs = dict(span.attributes or {})
    assert (
        attrs[SpanAttributes.OPENINFERENCE_SPAN_KIND] == OpenInferenceSpanKindValues.DECISION.value
    )
    assert attrs[SpanAttributes.DECISION_SYSTEM] == "openai"
    assert attrs[SpanAttributes.DECISION_PROVIDER] == "openai"
    assert attrs[SpanAttributes.DECISION_REQUEST_MODEL_NAME] == "gpt-6-luna"
    assert attrs[SpanAttributes.DECISION_RESPONSE_MODEL_NAME] == "mock-evaluation-model"
    assert attrs[SpanAttributes.DECISION_TOKEN_COUNT_INPUT] == 42
    assert attrs[SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT] == 5
    assert SpanAttributes.INPUT_VALUE in attrs
    assert SpanAttributes.OUTPUT_VALUE in attrs


def test_builtin_evaluator_sends_a_single_user_message(monkeypatch):
    from phoenix.evals.metrics.hallucination import HallucinationEvaluator

    client = MagicMock()
    client.decisions.create.return_value = _response(
        "grounded", {"grounded": 0.8, "hallucinated": 0.2}
    )
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = HallucinationEvaluator(llm=DecisionModel(provider="openai", model="gpt-6-luna"))
    eval_input = {"input": "User: What is our refund window?", "output": "Electronics: 90 days."}
    [score] = evaluator.evaluate(eval_input)

    assert score.label == "grounded"

    rendered = evaluator._prompt_template.render(variables=eval_input)
    assert len(rendered) == 1
    expected_text = rendered[0]["content"]

    # The built-in prompt is a single user message, so it reaches the API as a one-message
    # list with the role preserved (not flattened to a bare string).
    _, kwargs = client.decisions.create.call_args
    assert kwargs["input"] == [
        {"role": "user", "content": [{"type": "input_text", "text": expected_text}]}
    ]


def test_system_and_user_roles_are_preserved(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("valid", {"valid": 0.9, "invalid": 0.1})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="openai", model="gpt-6-luna"),
        prompt_template=[
            {"role": "system", "content": "You judge whether a question is valid."},
            {"role": "user", "content": "is this valid: {question}"},
        ],
        choices=["valid", "invalid"],
    )
    evaluator.evaluate({"question": "asdf"})

    _, kwargs = client.decisions.create.call_args
    assert kwargs["input"] == [
        {
            "role": "system",
            "content": [{"type": "input_text", "text": "You judge whether a question is valid."}],
        },
        {"role": "user", "content": [{"type": "input_text", "text": "is this valid: asdf"}]},
    ]


def test_assistant_text_is_mapped_to_output_text(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("correct", {"correct": 0.9, "incorrect": 0.1})
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="openai", model="gpt-6-luna")
    prompt = [
        {"role": "user", "content": "Rate this."},
        {"role": "assistant", "content": "ok"},
    ]
    decision.generate_classification(prompt, ["correct", "incorrect"])

    _, kwargs = client.decisions.create.call_args
    assert kwargs["input"] == [
        {"role": "user", "content": [{"type": "input_text", "text": "Rate this."}]},
        {"role": "assistant", "content": [{"type": "output_text", "text": "ok"}]},
    ]


async def test_async_evaluate_through_classification_evaluator(monkeypatch):
    async_client = MagicMock()
    async_client.decisions.create = AsyncMock(
        return_value=_response("valid", {"valid": 0.7, "invalid": 0.3})
    )
    _patch_clients(monkeypatch, async_client=async_client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="openai", model="gpt-6-luna"),
        prompt_template="is this valid: {text}",
        choices=["valid", "invalid"],
    )
    [score] = await evaluator.async_evaluate({"text": "asdf"})

    assert score.label == "valid"
    assert score.metadata["confidence"] == 0.95
    async_client.decisions.create.assert_awaited_once()
