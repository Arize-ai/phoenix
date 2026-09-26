import json

import httpx2
import pytest
from openinference.instrumentation.typesafe import TypeSafeAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from typesafe_sdk import (
    AsyncTypeSafeClient,
    RetryPolicy,
    TypeSafeAPIError,
    TypeSafeAPIResponseValidationError,
    TypeSafeClient,
)

from phoenix.evals import TypeSafeEvaluationModel
from phoenix.evals.metrics import HallucinationEvaluator


@pytest.fixture
def payload():
    return {
        "model": "jev-resolved",
        "usage": {"input_tokens": 10, "output_tokens": 2},
        "answers": {
            "label": {
                "type": "choice",
                "choice": "grounded",
                "confidence": 0.7,
                "probabilities": {"grounded": 0.85, "hallucinated": 0.15},
            }
        },
    }


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_sdk_request_response_and_tracing(payload, asynchronous, monkeypatch):
    requests = []

    def handler(request):
        requests.append(json.loads(request.content))
        return httpx2.Response(200, json=payload)

    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    monkeypatch.setattr("opentelemetry.trace.get_tracer_provider", lambda: provider)
    instrumentor = TypeSafeAIInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    try:
        inputs = {"input": "User: What is 2+2?", "output": "4"}
        if asynchronous:
            async with AsyncTypeSafeClient(
                api_key="test-key", transport=httpx2.MockTransport(handler)
            ) as client:
                judge = TypeSafeEvaluationModel(async_client=client, model="jev-latest")
                evaluator = HallucinationEvaluator(llm=judge)
                score = (await evaluator.async_evaluate(inputs))[0]
        else:
            with TypeSafeClient(
                api_key="test-key", transport=httpx2.MockTransport(handler)
            ) as client:
                judge = TypeSafeEvaluationModel(client=client, model="jev-latest")
                evaluator = HallucinationEvaluator(llm=judge)
                score = evaluator.evaluate(inputs)[0]
        assert len(requests) == 1
        assert requests[0]["state"] == {"messages": evaluator.prompt_template.render(inputs)}
        assert requests[0]["model"] == "jev-latest"
        assert requests[0]["questions"]["label"]["criteria"] == {
            "grounded": None,
            "hallucinated": None,
        }
        assert score.metadata["model"] == "jev-resolved"
        assert score.metadata["probabilities"] == payload["answers"]["label"]["probabilities"]
        assert score.metadata["confidence"] == 0.7
        assert score.metadata["usage"] == payload["usage"]
        assert score.explanation is None
        spans = exporter.get_finished_spans()
        assert len(spans) == 2  # One evaluator and one instrumented SDK call, no duplicates.
        evaluator_span = next(
            span for span in spans if span.attributes["openinference.span.kind"] == "EVALUATOR"
        )
        model_span = next(
            span for span in spans if span.attributes["openinference.span.kind"] == "LLM"
        )
        assert model_span.parent.span_id == evaluator_span.context.span_id
        assert json.loads(model_span.attributes["input.value"])["state"] == requests[0]["state"]
        assert json.loads(model_span.attributes["output.value"])["answers"] == payload["answers"]
        assert model_span.attributes["llm.response.model_name"] == "jev-resolved"
        assert json.loads(evaluator_span.attributes["output.value"]) == [score.to_dict()]
        assert score.metadata["trace_id"] == format(evaluator_span.context.trace_id, "032x")
    finally:
        instrumentor.uninstrument()
        provider.shutdown()


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize(
    "failure",
    ["empty", "wrong_type", "malformed", "http", "invalid_label", "incomplete", "confidence"],
)
async def test_sdk_errors(payload, failure, asynchronous):
    expected = ValueError
    status = 200
    if failure == "empty":
        payload["answers"] = {}
    elif failure == "wrong_type":
        payload["answers"] = {"label": {"type": "noul", "noul": 0.5}}
    elif failure == "malformed":
        payload["answers"]["label"] = {"type": "choice"}
        expected = TypeSafeAPIResponseValidationError
    elif failure == "http":
        status = 503
        expected = TypeSafeAPIError
    elif failure == "invalid_label":
        payload["answers"]["label"]["choice"] = "unknown"
    elif failure == "incomplete":
        payload["answers"]["label"]["probabilities"] = {"grounded": 0.85}
    elif failure == "confidence":
        payload["answers"]["label"]["confidence"] = 1.1
    transport = httpx2.MockTransport(lambda request: httpx2.Response(status, json=payload))
    inputs = {"input": "Q", "output": "A"}
    if asynchronous:
        async with AsyncTypeSafeClient(
            api_key="test-key", transport=transport, retry=RetryPolicy(max_retries=0)
        ) as client:
            evaluator = HallucinationEvaluator(llm=TypeSafeEvaluationModel(async_client=client))
            with pytest.raises(expected):
                await evaluator.async_evaluate(inputs)
    else:
        with TypeSafeClient(
            api_key="test-key", transport=transport, retry=RetryPolicy(max_retries=0)
        ) as client:
            evaluator = HallucinationEvaluator(llm=TypeSafeEvaluationModel(client=client))
            with pytest.raises(expected):
                evaluator.evaluate(inputs)


async def test_missing_client_modes():
    with pytest.raises(ValueError, match="Supply"):
        TypeSafeEvaluationModel()
    with TypeSafeClient(api_key="test-key") as client:
        judge = TypeSafeEvaluationModel(client=client)
        with pytest.raises(ValueError, match="async_client"):
            await judge.async_classify(prompt="P", criteria={"yes": None, "no": None})
    async with AsyncTypeSafeClient(api_key="test-key") as client:
        judge = TypeSafeEvaluationModel(async_client=client)
        with pytest.raises(ValueError, match="Synchronous"):
            judge.classify(prompt="P", criteria={"yes": None, "no": None})


def test_sdk_multiclass_and_client_model_default(payload):
    payload["answers"]["label"].update(
        choice="fair", probabilities={"good": 0.2, "fair": 0.7, "bad": 0.1}
    )
    criteria = {"good": "Correct", "fair": "Partial", "bad": "Wrong"}

    def handler(request):
        body = json.loads(request.content)
        assert body["model"] == "custom-model"
        assert body["state"] == "Rate the response"
        assert body["questions"]["label"]["criteria"] == criteria
        return httpx2.Response(200, json=payload)

    with TypeSafeClient(
        api_key="test-key", model="custom-model", transport=httpx2.MockTransport(handler)
    ) as client:
        result = TypeSafeEvaluationModel(client=client).classify(
            prompt="Rate the response", criteria=criteria
        )
    assert result.label == "fair"
    assert result.probabilities == {"good": 0.2, "fair": 0.7, "bad": 0.1}
