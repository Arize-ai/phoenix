"""Native judges preserve typed values, scoring semantics, and evaluator tracing."""

import asyncio
from datetime import datetime, timezone
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
from phoenix.server.api.helpers.decision_evaluators import project_decision_response
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
                expected_level=0.5,
                confidence=0.5,
                probabilities={0: 0.5, 1: 0.25, 2: 0.25},
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


def project(
    definition: InlineDecisionEvaluatorDefinition, decision_response: DecisionResponse
) -> dict[str, dict[str, Any]]:
    now = datetime.now(timezone.utc)
    results = project_decision_response(
        definition,
        decision_response,
        name="binding",
        trace_id=None,
        start_time=now,
        end_time=now,
    )
    return {result["metadata"]["decision"]["question"]["name"]: result for result in results}


def test_scale_label_is_the_most_probable_level_not_the_first(
    definition: InlineDecisionEvaluatorDefinition,
) -> None:
    decision_response = response()
    decision_response.answers["quality"] = ScaleAnswer(
        expected_level=0.8, confidence=0.7, probabilities={0: 0.1, 1: 0.1, 2: 0.8}
    )
    quality = project(definition, decision_response)["quality"]
    assert quality["label"] == "high"
    assert quality["score"] == 0.8


def test_scale_metadata_keeps_the_asked_levels(
    definition: InlineDecisionEvaluatorDefinition,
) -> None:
    results = project(definition, response())
    [scale] = [question for question in definition.questions if question.type == "scale"]
    assert results["quality"]["metadata"]["decision"]["question"]["levels"] == [
        {"label": level.label, "description": level.description} for level in scale.levels
    ]
    assert "levels" not in results["correct"]["metadata"]["decision"]["question"]


def test_scale_label_is_omitted_unless_requested(
    definition: InlineDecisionEvaluatorDefinition,
) -> None:
    definition = definition.model_copy(
        update={
            "projection_policy": DecisionProjectionPolicy.model_validate(
                {"questions": {"quality": {"type": "scale", "include_label": False}}}
            )
        }
    )
    decision_response = response()
    decision_response.answers["quality"] = ScaleAnswer(
        expected_level=0.8, confidence=0.7, probabilities={0: 0.1, 1: 0.1, 2: 0.8}
    )
    quality = project(definition, decision_response)["quality"]
    assert quality["label"] is None
    assert quality["score"] == 0.8


def test_unscored_choice_has_a_label_and_no_score(
    definition: InlineDecisionEvaluatorDefinition,
) -> None:
    definition = definition.model_copy(
        update={
            "projection_policy": DecisionProjectionPolicy.model_validate(
                {"questions": {"route": {"type": "choice", "scores": {"accept": 1}}}}
            )
        }
    )
    decision_response = response()
    decision_response.answers["route"] = ChoiceAnswer(
        choice="review", confidence=0.9, probabilities={"accept": 0.1, "review": 0.9}
    )
    route = project(definition, decision_response)["route"]
    assert route["label"] == "review"
    assert route["score"] is None


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
    assert results[1]["explanation"] == "Decision model refused this question."
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


async def test_runner_retries_a_returned_rate_limit_from_a_decision_judge_only(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.server.daemons.experiment_runner import _raise_retryable_evaluation_error

    error = DecisionRateLimitError("slow down")
    monkeypatch.setattr(client, "invoke", AsyncMock(side_effect=error))
    evaluator = DecisionEvaluator(definition, client)
    results = await evaluator.evaluate(
        context={},
        input_mapping=InputMapping(path_mapping={}, literal_mapping={"ticket": {"id": 1}}),
        name="judge",
        output_configs=list(evaluator.output_configs),
    )
    with pytest.raises(DecisionRateLimitError):
        _raise_retryable_evaluation_error(evaluator, results)
    # Other judges that return failures (LLM judges) keep recording them, as before.
    other = MagicMock(provider_client=client)
    _raise_retryable_evaluation_error(other, results)


async def test_runner_recorded_errors_keep_the_decision_error_metadata(
    definition: InlineDecisionEvaluatorDefinition,
    client: TypeSafeDecisionClient,
) -> None:
    from phoenix.server.daemons.experiment_runner import EvalWorkItem
    from tests.unit.server.daemons.test_experiment_runner import _make_running_experiment

    evaluator = DecisionEvaluator(definition, client)
    work_item = MagicMock(spec=EvalWorkItem)
    work_item.experiment_run = MagicMock(id=1)
    work_item.annotation_names = ["judge.correct"]
    work_item._evaluator = evaluator
    work_item._persist_eval_results = AsyncMock()
    await _make_running_experiment()._persist_exhausted_retry(work_item, "retries exhausted")
    [annotations, _] = work_item._persist_eval_results.await_args.args
    assert [annotation.metadata_ for annotation in annotations] == [evaluator.error_metadata]
    assert evaluator.error_metadata["decision"]["status"] == "error"


async def test_eval_log_for_a_deleted_binding_is_skipped() -> None:
    from phoenix.db import models
    from tests.unit.server.daemons.test_experiment_runner import (
        _AsyncSessionContext,
        _make_running_experiment,
    )

    exp = _make_running_experiment()
    session = MagicMock()
    session.get = AsyncMock(return_value=None)
    exp._db = MagicMock(return_value=_AsyncSessionContext(session))
    await exp._persist_log(
        models.ExperimentEvalLog(
            experiment_id=1,
            level="ERROR",
            message="failed",
            experiment_run_id=1,
            dataset_evaluator_id=7,
        )
    )
    session.add.assert_not_called()
