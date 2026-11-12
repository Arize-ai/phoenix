from collections import defaultdict
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals import ClassificationEvaluator, Criterion, DecisionModel


def _response(
    choice,
    probabilities,
    model="mock-evaluation-model",
    confidence=0.95,
    input_tokens=11,
    output_tokens=3,
):
    """Build a fake SystemOneResponse exposing `.choices[name]`, `.model`, and `.usage`.

    ``choices`` answers any question name with the same single answer, so this fixture works
    both for the direct single-question path (keyed ``"label"``) and the ClassificationEvaluator
    path (keyed by the criterion/evaluator name).
    """
    answer = SimpleNamespace(choice=choice, probabilities=probabilities, confidence=confidence)
    usage = SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)
    return SimpleNamespace(model=model, choices=defaultdict(lambda: answer), usage=usage)


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
    assert "usage" not in result

    client.system_one.assert_called_once()
    _, kwargs = client.system_one.call_args
    assert kwargs["state"] == "Is 2 + 2 = 5 correct?"
    assert kwargs["model"] == "jev-latest"
    question = kwargs["questions"]["label"]
    assert question.criteria == {"correct": None, "incorrect": None}
    assert question.instructions is None


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

    assert score.label == "valid"
    assert score.score == 1

    _, kwargs = client.system_one.call_args
    question = kwargs["questions"]["isValid"]
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
        timeout=30,
    )
    evaluator.evaluate({"text": "2 + 2 = 4"})

    _, kwargs = client.system_one.call_args
    assert kwargs["timeout"] == 30
    assert "include_explanation" not in kwargs
    assert "method" not in kwargs


def _multi_response(
    answers_by_name,
    model="mock-evaluation-model",
    confidence=0.9,
    input_tokens=20,
    output_tokens=6,
):
    """Build a fake SystemOneResponse with `.choices[name]` for several questions.

    answers_by_name maps each question name to a (choice, probabilities) pair.
    """
    choices = {
        name: SimpleNamespace(choice=choice, probabilities=probs, confidence=confidence)
        for name, (choice, probs) in answers_by_name.items()
    }
    usage = SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)
    return SimpleNamespace(model=model, choices=choices, usage=usage)


def test_generate_classifications_sends_one_request_with_n_questions(monkeypatch):
    client = MagicMock()
    client.system_one.return_value = _multi_response(
        {
            "helpfulness": ("good", {"good": 0.7, "bad": 0.3}),
            "accuracy": ("wrong", {"right": 0.2, "wrong": 0.8}),
        }
    )
    _patch_clients(monkeypatch, sync_client=client)

    decision = DecisionModel(provider="typesafe", model="jev-latest")
    results = decision.generate_classifications(
        "some text",
        [
            {"name": "helpfulness", "labels": ["good", "bad"], "instructions": "how helpful"},
            {"name": "accuracy", "labels": {"right": "ok", "wrong": "nope"}},
        ],
    )

    assert results == [
        {
            "name": "helpfulness",
            "label": "good",
            "metadata": {
                "probabilities": {"good": 0.7, "bad": 0.3},
                "model_id": "mock-evaluation-model",
                "confidence": 0.9,
            },
        },
        {
            "name": "accuracy",
            "label": "wrong",
            "metadata": {
                "probabilities": {"right": 0.2, "wrong": 0.8},
                "model_id": "mock-evaluation-model",
                "confidence": 0.9,
            },
        },
    ]

    # One request, N questions keyed by name, per-criterion instructions and criteria.
    client.system_one.assert_called_once()
    _, kwargs = client.system_one.call_args
    questions = kwargs["questions"]
    assert list(questions.keys()) == ["helpfulness", "accuracy"]
    assert questions["helpfulness"].criteria == {"good": None, "bad": None}
    assert questions["helpfulness"].instructions == "how helpful"
    assert questions["accuracy"].criteria == {"right": "ok", "wrong": "nope"}
    assert questions["accuracy"].instructions is None


async def test_async_generate_classifications(monkeypatch):
    async_client = MagicMock()
    async_client.system_one = AsyncMock(
        return_value=_multi_response(
            {"a": ("x", {"x": 0.6, "y": 0.4}), "b": ("y", {"x": 0.1, "y": 0.9})}
        )
    )
    _patch_clients(monkeypatch, async_client=async_client)

    decision = DecisionModel(provider="typesafe", model="jev-latest")
    results = await decision.async_generate_classifications(
        "text",
        [{"name": "a", "labels": ["x", "y"]}, {"name": "b", "labels": ["x", "y"]}],
    )

    assert [r["name"] for r in results] == ["a", "b"]
    assert [r["label"] for r in results] == ["x", "y"]
    async_client.system_one.assert_awaited_once()


def test_evaluator_multiple_criteria_one_request_one_score_each(monkeypatch):
    """A multi-criterion ClassificationEvaluator issues one request and returns one Score per
    criterion, each with its own label, score, and direction."""
    client = MagicMock()
    client.system_one.return_value = _multi_response(
        {
            "helpfulness": ("good", {"good": 0.7, "bad": 0.3}),
            "accuracy": ("wrong", {"right": 0.2, "wrong": 0.8}),
        }
    )
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = ClassificationEvaluator(
        name="review",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="review: {text}",
        choices=[
            Criterion(
                name="helpfulness", description="How helpful?", choices={"good": 1, "bad": 0}
            ),
            Criterion(
                name="accuracy",
                description="How accurate?",
                choices={"right": 1, "wrong": 0},
                direction="minimize",
            ),
        ],
    )
    scores = evaluator.evaluate({"text": "..."})

    assert [s.name for s in scores] == ["helpfulness", "accuracy"]
    assert scores[0].label == "good" and scores[0].score == 1
    assert scores[1].label == "wrong" and scores[1].score == 0
    assert scores[0].direction == "maximize"
    assert scores[1].direction == "minimize"

    # One request carrying both questions, keyed by criterion name.
    client.system_one.assert_called_once()
    _, kwargs = client.system_one.call_args
    assert list(kwargs["questions"].keys()) == ["helpfulness", "accuracy"]


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


def test_typesafe_to_input_flattens_like_to_state():
    # TypeSafe has no message roles, so it must keep the base class's flattening behavior:
    # _to_input returns the same plain string as _to_state (roles dropped).
    from phoenix.evals.decision.adapters.typesafe.adapter import TypeSafeDecisionAdapter

    adapter = TypeSafeDecisionAdapter(client=None, model="jev-latest")
    prompt = [
        {"role": "system", "content": "You are a judge."},
        {"role": "user", "content": "Is 2 + 2 = 4?"},
    ]
    assert adapter._to_input(prompt) == "You are a judge.\n\nIs 2 + 2 = 4?"
    assert adapter._to_input(prompt) == adapter._to_state(prompt)


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

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="is this valid: {text}",
        choices=["valid", "invalid"],
    )
    [score] = evaluator.evaluate({"text": "asdf"})
    assert score.metadata["confidence"] == 0.95
    assert "usage" not in score.metadata


def test_builtin_evaluator_sends_a_flattened_string_state(monkeypatch):
    from phoenix.evals.metrics.hallucination import HallucinationEvaluator

    client = MagicMock()
    client.system_one.return_value = _response("grounded", {"grounded": 0.8, "hallucinated": 0.2})
    _patch_clients(monkeypatch, sync_client=client)

    evaluator = HallucinationEvaluator(llm=DecisionModel(provider="typesafe", model="jev-latest"))
    eval_input = {"input": "User: What is our refund window?", "output": "Electronics: 90 days."}
    [score] = evaluator.evaluate(eval_input)

    assert score.label == "grounded"

    # The built-in prompt renders to a message list; _to_state must flatten it to a plain
    # string. The hallucination template is a single message, so the whole flattened state
    # must equal that message's rendered content.
    rendered = evaluator._prompt_template.render(variables=eval_input)
    assert len(rendered) == 1
    expected_state = rendered[0]["content"]

    _, kwargs = client.system_one.call_args
    state = kwargs["state"]
    assert isinstance(state, str)
    assert state == expected_state


async def test_async_evaluate_through_classification_evaluator(monkeypatch):
    async_client = MagicMock()
    async_client.system_one = AsyncMock(
        return_value=_response("valid", {"valid": 0.7, "invalid": 0.3})
    )
    _patch_clients(monkeypatch, async_client=async_client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="typesafe", model="jev-latest"),
        prompt_template="is this valid: {text}",
        choices=["valid", "invalid"],
    )
    [score] = await evaluator.async_evaluate({"text": "asdf"})

    assert score.label == "valid"
    assert score.metadata["confidence"] == 0.95
    async_client.system_one.assert_awaited_once()
