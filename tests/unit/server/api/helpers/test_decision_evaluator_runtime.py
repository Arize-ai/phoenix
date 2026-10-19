"""Native judges preserve typed values, scoring semantics, and evaluator tracing."""

import asyncio
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from opentelemetry.context import Context

from phoenix.db.types.decision_evaluators import DecisionProjectionPolicy
from phoenix.db.types.decisions import DecisionInput, InputState
from phoenix.db.types.evaluator_definition import InlineDecisionEvaluatorDefinition
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.decision_evaluator import DecisionEvaluator
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionConnection,
    DecisionRateLimitError,
    DecisionRequest,
    DecisionResponse,
    PredicateAnswer,
    RefusalAnswer,
    ScaleAnswer,
    TypeSafeDecisionClient,
)
from phoenix.tracers import Tracer

from .test_decision_evaluator_policy import questions


@pytest.fixture
def definition() -> InlineDecisionEvaluatorDefinition:
    return InlineDecisionEvaluatorDefinition(
        type="inline_decision_evaluator",
        name="judge",
        inputs=[DecisionInput(name="ticket")],
        state=InputState(type="input", name="ticket"),
        questions=questions(),
        model_provider=ModelProvider.TYPESAFE,
        model_name="jev-latest",
        projection_policy=DecisionProjectionPolicy.model_validate(
            {
                "questions": {
                    "correct": {"type": "predicate", "threshold": 0.8},
                    "route": {"type": "choice", "scores": {"accept": 1, "review": 0}},
                    "quality": {"type": "scale", "include_label": True},
                }
            }
        ),
    )


@pytest.fixture
def client() -> TypeSafeDecisionClient:
    return TypeSafeDecisionClient(
        model_name="jev-latest",
        connection=DecisionConnection(api_key="test", base_url="https://example.com"),
    )


def response() -> DecisionResponse:
    return DecisionResponse(
        model="jev-resolved",
        answers={
            "correct": PredicateAnswer(probability=0.8),
            "route": ChoiceAnswer(
                choice="accept", confidence=0.9, probabilities={"accept": 0.9, "review": 0.1}
            ),
            "quality": ScaleAnswer(
                expected_level=0.5, confidence=0.5, probabilities={0: 0.5, 1: 0.5}
            ),
        },
        input_tokens=3,
        output_tokens=2,
    )


async def test_scoring_and_nested_trace(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invoke = AsyncMock(return_value=response())
    monkeypatch.setattr(client, "invoke", invoke)
    evaluator = DecisionEvaluator(definition, client)
    tracer = Tracer(span_cost_calculator=cast(Any, MagicMock()))
    results = await evaluator.evaluate(
        context={"output": {"ticket": {"items": [1, False]}}},
        input_mapping=InputMapping(literal_mapping={}, path_mapping={"ticket": "output.ticket"}),
        name="binding",
        output_configs=list(evaluator.output_configs),
        tracer=tracer,
    )
    assert [(result["name"], result["label"], result["score"]) for result in results] == [
        ("binding.correct", "true", 0.8),
        ("binding.route", "accept", 1),
        ("binding.quality", "low", 0.5),
    ]
    assert invoke.call_args.args[0].state == {"items": [1, False]}
    assert results[0]["metadata"]["decision"]["resolved_model"] == "jev-resolved"
    traces = tracer.get_db_traces(project_id=1)
    assert len(traces) == 1
    spans = {span.span_kind: span for span in traces[0].spans}
    assert set(spans) == {"EVALUATOR", "DECISION"}
    assert spans["DECISION"].parent_id == spans["EVALUATOR"].span_id
    assert spans["EVALUATOR"].parent_id is None
    assert {result["trace_id"] for result in results} == {traces[0].trace_id}


async def test_refusal_is_terminal_and_keeps_siblings(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    result = response()
    result.answers["route"] = RefusalAnswer()
    invoke = AsyncMock(return_value=result)
    monkeypatch.setattr(client, "invoke", invoke)
    evaluator = DecisionEvaluator(definition, client)
    results = await evaluator.evaluate(
        context={},
        input_mapping=InputMapping(path_mapping={}, literal_mapping={"ticket": ["state"]}),
        name="judge",
        output_configs=list(evaluator.output_configs),
    )
    assert results[0]["score"] == 0.8
    assert results[2]["score"] == 0.5
    assert results[1]["label"] is None and results[1]["score"] is None
    assert results[1]["error"] is None
    assert results[1]["metadata"]["decision"]["status"] == "refused"
    assert results[1]["explanation"] == "Decision model refused this question"
    assert invoke.await_count == 1


async def test_provider_error_preserves_exception_for_runner_retry(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error = DecisionRateLimitError("slow down")
    monkeypatch.setattr(client, "invoke", AsyncMock(side_effect=error))
    evaluator = DecisionEvaluator(definition, client)
    results = await evaluator.evaluate(
        context={},
        input_mapping=InputMapping(path_mapping={}, literal_mapping={"ticket": {"id": 1}}),
        name="judge",
        output_configs=list(evaluator.output_configs),
    )
    assert all(isinstance(result["error_exc"], DecisionRateLimitError) for result in results)
    assert all(result["metadata"]["decision"]["status"] == "error" for result in results)
    assert all(
        client.is_rate_limit_error(result["error_exc"])
        for result in results
        if result["error_exc"] is not None
    )


async def test_cancellation_propagates(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(client, "invoke", AsyncMock(side_effect=asyncio.CancelledError()))
    evaluator = DecisionEvaluator(definition, client)
    with pytest.raises(asyncio.CancelledError):
        await evaluator.evaluate(
            context={},
            input_mapping=InputMapping(path_mapping={}, literal_mapping={"ticket": {"id": 1}}),
            name="judge",
            output_configs=list(evaluator.output_configs),
        )


async def test_explicit_context_keeps_standalone_decision_detached(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(client, "invoke", AsyncMock(return_value=response()))
    tracer = Tracer(span_cost_calculator=cast(Any, MagicMock()))
    with tracer.start_as_current_span("ambient"):
        await client.create(
            request=DecisionRequest(state={"id": 1}, questions=definition.questions),
            tracer=tracer,
            otel_context=Context(),
        )
    assert len(tracer.get_db_traces(project_id=1)) == 2
