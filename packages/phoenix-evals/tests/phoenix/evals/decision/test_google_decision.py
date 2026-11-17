from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals import ClassificationEvaluator, DecisionModel
from phoenix.evals.exceptions import PhoenixDecisionRefusal


def _response(
    choice,
    probabilities,
    model="gemini-decision-1",
    confidence=0.95,
    input_tokens=11,
    output_tokens=0,
):
    """Build a fake Decision exposing `.answers` (a dict keyed by question name) and `.usage`.

    Gemini already reports probabilities as a label -> probability dict, so the fixture passes
    them through unchanged.
    """
    answer = SimpleNamespace(
        type="choice", choice=choice, probabilities=probabilities, confidence=confidence
    )
    usage = SimpleNamespace(
        total_input_tokens=input_tokens,
        total_output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )
    return SimpleNamespace(answers={"label": answer}, usage=usage)


def _multi_response(
    answers,
    confidence=0.9,
    input_tokens=20,
    output_tokens=0,
):
    """Build a fake Decision whose `.answers` dict holds one entry per question.

    answers is a list of (name, choice, probabilities dict) triples.
    """
    ans = {
        name: SimpleNamespace(
            type="choice", choice=choice, probabilities=probs, confidence=confidence
        )
        for name, choice, probs in answers
    }
    usage = SimpleNamespace(
        total_input_tokens=input_tokens,
        total_output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )
    return SimpleNamespace(answers=ans, usage=usage)


def _bad_request_error(message="invalid argument"):
    """The real exception a next-gen (v1beta) ``decisions.create`` raises on a 400.

    The Decisions API resource surfaces a 4xx as a ``google.genai._interactions`` APIStatusError
    subclass (``BadRequestError`` for 400), not the legacy ``google.genai.errors.ClientError``.
    These are operational errors (malformed input, bad MIME, missing ``api_version``), not
    refusals, so the adapter lets them propagate unchanged.
    """
    import httpx
    from google.genai._interactions import BadRequestError

    request = httpx.Request("POST", "http://decisions.test")
    return BadRequestError(
        message,
        response=httpx.Response(400, request=request),
        body={"error": {"code": "INVALID_ARGUMENT", "message": message}},
    )


def _patch_clients(monkeypatch, client=None):
    # A single genai.Client serves both the sync and async adapters, so one return value is
    # reused for every construction.
    monkeypatch.setattr("google.genai.Client", MagicMock(return_value=client or MagicMock()))


def test_generate_classifications_sends_one_request_with_n_questions(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _multi_response(
        [
            ("helpfulness", "good", {"good": 0.7, "bad": 0.3}),
            ("accuracy", "wrong", {"right": 0.2, "wrong": 0.8}),
        ]
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    results = decision.generate_classifications(
        "some text",
        [
            {"name": "helpfulness", "labels": ["good", "bad"], "instructions": "how helpful"},
            {"name": "accuracy", "labels": {"right": "ok", "wrong": "nope"}},
        ],
    )

    assert [r["name"] for r in results] == ["helpfulness", "accuracy"]
    assert results[0]["label"] == "good"
    assert results[0]["metadata"]["probabilities"] == {"good": 0.7, "bad": 0.3}
    assert results[1]["label"] == "wrong"

    client.decisions.create.assert_called_once()
    _, kwargs = client.decisions.create.call_args
    questions = kwargs["questions"]
    assert list(questions) == ["helpfulness", "accuracy"]
    assert questions["helpfulness"]["type"] == "choice"
    assert questions["helpfulness"]["instructions"] == "how helpful"
    # A label with no description maps to "".
    assert questions["helpfulness"]["criteria"] == {"good": "", "bad": ""}
    # No per-criterion instructions -> the default choice instructions are used.
    assert questions["accuracy"]["instructions"] == "Select the single best label for the input."
    assert questions["accuracy"]["criteria"] == {"right": "ok", "wrong": "nope"}


def test_generate_classifications_matches_answers_by_name(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _multi_response(
        [
            ("accuracy", "wrong", {"right": 0.2, "wrong": 0.8}),
            ("helpfulness", "good", {"good": 0.7, "bad": 0.3}),
        ]
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    results = decision.generate_classifications(
        "t",
        [
            {"name": "helpfulness", "labels": ["good", "bad"]},
            {"name": "accuracy", "labels": ["right", "wrong"]},
        ],
    )

    assert [r["name"] for r in results] == ["helpfulness", "accuracy"]
    assert results[0]["label"] == "good"
    assert results[1]["label"] == "wrong"


async def test_async_generate_classifications(monkeypatch):
    client = MagicMock()
    client.aio.decisions.create = AsyncMock(
        return_value=_multi_response([("a", "x", {"x": 0.6, "y": 0.4})])
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    results = await decision.async_generate_classifications(
        "text", [{"name": "a", "labels": ["x", "y"]}]
    )

    assert results == [
        {
            "name": "a",
            "label": "x",
            "metadata": {
                "probabilities": {"x": 0.6, "y": 0.4},
                "model_id": "gemini-decision-1",
                "confidence": 0.9,
            },
        }
    ]
    client.aio.decisions.create.assert_awaited_once()


def test_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response(
        "incorrect", {"correct": 0.03, "incorrect": 0.97}
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    result = decision.generate_classification("Is 2 + 2 = 5 correct?", ["correct", "incorrect"])

    assert result == {
        "label": "incorrect",
        "metadata": {
            "probabilities": {"correct": 0.03, "incorrect": 0.97},
            "model_id": "gemini-decision-1",
            "confidence": 0.95,
        },
    }
    assert "explanation" not in result

    client.decisions.create.assert_called_once()
    _, kwargs = client.decisions.create.call_args
    assert kwargs["input"] == "Is 2 + 2 = 5 correct?"
    assert kwargs["model"] == "gemini-decision-1"
    question = kwargs["questions"]["label"]
    assert question["type"] == "choice"
    assert question["instructions"]
    assert question["criteria"] == {"correct": "", "incorrect": ""}


async def test_async_routes_a_text_prompt_through_a_single_choice_question(monkeypatch):
    client = MagicMock()
    client.aio.decisions.create = AsyncMock(return_value=_response("correct", {"correct": 0.9}))
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    result = await decision.async_generate_classification(
        "Is the sky blue?", ["correct", "incorrect"]
    )

    assert result["label"] == "correct"
    assert result["metadata"]["probabilities"] == {"correct": 0.9}
    client.aio.decisions.create.assert_awaited_once()


def test_evaluator_maps_the_chosen_label_to_a_score_without_an_explanation(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("invalid", {"valid": 0.1, "invalid": 0.9})
    _patch_clients(monkeypatch, client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="google", model="gemini-decision-1"),
        prompt_template="is the following question valid: {question}",
        choices={"valid": 1, "invalid": 0},
    )
    [score] = evaluator.evaluate({"question": "asdf"})

    assert score.label == "invalid"
    assert score.score == 0
    assert score.explanation is None
    assert score.metadata["model"] == "gemini-decision-1"
    assert score.metadata["model_id"] == "gemini-decision-1"
    assert score.metadata["probabilities"] == {"valid": 0.1, "invalid": 0.9}


def test_tuple_style_choices_pass_descriptions_as_criteria(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("valid", {"valid": 0.8, "invalid": 0.2})
    _patch_clients(monkeypatch, client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="google", model="gemini-decision-1"),
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
    question = kwargs["questions"]["label"]
    assert question["criteria"] == {
        "valid": "the question is well formed",
        "invalid": "the question is malformed",
    }


def test_invocation_kwargs_reach_create_but_evaluator_params_do_not(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("correct", {"correct": 0.9, "incorrect": 0.1})
    _patch_clients(monkeypatch, client)

    evaluator = ClassificationEvaluator(
        name="correctness",
        llm=DecisionModel(provider="google", model="gemini-decision-1"),
        prompt_template="is this correct: {text}",
        choices=["correct", "incorrect"],
        timeout=30,
    )
    evaluator.evaluate({"text": "2 + 2 = 4"})

    _, kwargs = client.decisions.create.call_args
    assert kwargs["timeout"] == 30
    assert "include_explanation" not in kwargs
    assert "method" not in kwargs


def test_prompt_feedback_block_raises_refusal(monkeypatch):
    # A block can arrive as a 200 with empty `answers` and a populated `prompt_feedback`
    # rather than a 400; it must still surface as a refusal, not a missing-answer KeyError.
    client = MagicMock()
    client.decisions.create.return_value = SimpleNamespace(
        answers=None,
        usage=None,
        prompt_feedback=SimpleNamespace(block_reason="safety", block_reason_message="blocked"),
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    with pytest.raises(PhoenixDecisionRefusal, match="refused"):
        decision.generate_classification("something", ["correct", "incorrect"])


def test_http_400_propagates_and_is_not_a_refusal(monkeypatch):
    # A BadRequestError (malformed input, bad MIME, missing api_version) is an operational error,
    # not a refusal, so it must propagate unchanged rather than become a PhoenixDecisionRefusal.
    from google.genai._interactions import BadRequestError

    client = MagicMock()
    client.decisions.create.side_effect = _bad_request_error()
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    with pytest.raises(BadRequestError):
        decision.generate_classification("something", ["correct", "incorrect"])


def test_server_error_propagates(monkeypatch):
    # A 5xx is a backend fault, not a refusal, so it must propagate unchanged.
    import httpx
    from google.genai._interactions import InternalServerError

    request = httpx.Request("POST", "http://decisions.test")
    client = MagicMock()
    client.decisions.create.side_effect = InternalServerError(
        "boom", response=httpx.Response(503, request=request), body={"error": {"code": "internal"}}
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    with pytest.raises(InternalServerError):
        decision.generate_classification("something", ["correct", "incorrect"])


def test_rate_limit_errors_registered_for_retry(monkeypatch):
    # A 429 must be retriable, so the provider must register the real RateLimitError class and
    # DecisionModel must build a limiter around it.
    from google.genai._interactions import RateLimitError

    _patch_clients(monkeypatch)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    assert decision._rate_limit_errors == [RateLimitError]
    assert [limiter._rate_limit_error for limiter in decision._rate_limiters] == [(RateLimitError,)]


def test_forces_v1beta_api_version(monkeypatch):
    ctor = MagicMock(return_value=MagicMock())
    monkeypatch.setattr("google.genai.Client", ctor)

    DecisionModel(provider="google", model="gemini-decision-1")
    assert ctor.call_args.kwargs["http_options"]["api_version"] == "v1beta"


def test_disables_sdk_retries_so_they_do_not_stack_on_the_rate_limiter(monkeypatch):
    ctor = MagicMock(return_value=MagicMock())
    monkeypatch.setattr("google.genai.Client", ctor)

    DecisionModel(provider="google", model="gemini-decision-1")
    assert ctor.call_args.kwargs["http_options"]["retry_options"] == {"attempts": 1}


def test_caller_can_override_retry_options(monkeypatch):
    # ``setdefault`` leaves a caller-supplied retry_options untouched.
    ctor = MagicMock(return_value=MagicMock())
    monkeypatch.setattr("google.genai.Client", ctor)

    DecisionModel(
        provider="google",
        model="gemini-decision-1",
        http_options={"retry_options": {"attempts": 3}},
    )
    assert ctor.call_args.kwargs["http_options"]["retry_options"] == {"attempts": 3}


def test_old_sdk_without_decisions_raises_a_helpful_error(monkeypatch):
    # An importable-but-old google-genai has no `decisions` resource; the factory rejects it and
    # the facade wraps the failure in a ValueError whose message still points at the Decisions API.
    _patch_clients(monkeypatch, SimpleNamespace())
    with pytest.raises(ValueError, match="Decisions API"):
        DecisionModel(provider="google", model="gemini-decision-1")


def test_confidence_is_omitted_when_the_provider_does_not_report_one(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response(
        "correct", {"correct": 0.9, "incorrect": 0.1}, confidence=None
    )
    _patch_clients(monkeypatch, client)

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    result = decision.generate_classification("is this ok?", ["correct", "incorrect"])

    assert "confidence" not in result["metadata"]


def test_decision_span_records_attributes_and_usage(monkeypatch):
    from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    client = MagicMock()
    client.decisions.create.return_value = _response(
        "valid", {"valid": 0.8, "invalid": 0.2}, input_tokens=42, output_tokens=0
    )
    _patch_clients(monkeypatch, client)

    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")

    decision = DecisionModel(provider="google", model="gemini-decision-1")
    decision.generate_classification("is this valid?", ["valid", "invalid"], tracer=tracer)

    [span] = exporter.get_finished_spans()
    attrs = dict(span.attributes or {})
    assert (
        attrs[SpanAttributes.OPENINFERENCE_SPAN_KIND] == OpenInferenceSpanKindValues.DECISION.value
    )
    assert attrs[SpanAttributes.DECISION_SYSTEM] == "google"
    assert attrs[SpanAttributes.DECISION_PROVIDER] == "google"
    assert attrs[SpanAttributes.DECISION_REQUEST_MODEL_NAME] == "gemini-decision-1"
    assert attrs[SpanAttributes.DECISION_RESPONSE_MODEL_NAME] == "gemini-decision-1"
    assert attrs[SpanAttributes.DECISION_TOKEN_COUNT_INPUT] == 42
    assert attrs[SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT] == 0
    assert SpanAttributes.INPUT_VALUE in attrs
    assert SpanAttributes.OUTPUT_VALUE in attrs


def test_prompt_messages_are_flattened_to_a_bare_string(monkeypatch):
    client = MagicMock()
    client.decisions.create.return_value = _response("valid", {"valid": 0.9, "invalid": 0.1})
    _patch_clients(monkeypatch, client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="google", model="gemini-decision-1"),
        prompt_template=[
            {"role": "system", "content": "You judge whether a question is valid."},
            {"role": "user", "content": "is this valid: {question}"},
        ],
        choices=["valid", "invalid"],
    )
    evaluator.evaluate({"question": "asdf"})

    # The Decisions API has no roles, so the message list is flattened to one plain string.
    _, kwargs = client.decisions.create.call_args
    assert kwargs["input"] == ("You judge whether a question is valid.\n\nis this valid: asdf")


async def test_async_evaluate_through_classification_evaluator(monkeypatch):
    client = MagicMock()
    client.aio.decisions.create = AsyncMock(
        return_value=_response("valid", {"valid": 0.7, "invalid": 0.3})
    )
    _patch_clients(monkeypatch, client)

    evaluator = ClassificationEvaluator(
        name="isValid",
        llm=DecisionModel(provider="google", model="gemini-decision-1"),
        prompt_template="is this valid: {text}",
        choices=["valid", "invalid"],
    )
    [score] = await evaluator.async_evaluate({"text": "asdf"})

    assert score.label == "valid"
    assert score.metadata["confidence"] == 0.95
    client.aio.decisions.create.assert_awaited_once()
