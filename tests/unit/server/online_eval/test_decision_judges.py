"""Decision judges run online like LLM judges: bound to a project, resolved, hydrated, and
annotating spans with Phoenix's decision metadata."""

from secrets import token_hex
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import with_polymorphic
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.decision_evaluators import DecisionScoringPolicy, PredicateScoring
from phoenix.db.types.decisions import DecisionInput, InputState
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.decision_clients import (
    DecisionRateLimitError,
    DecisionResponse,
    PredicateAnswer,
    RefusalAnswer,
    ScaleAnswer,
    TypeSafeDecisionClient,
)
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.derivation import annotation_identifier, config_fingerprint
from phoenix.server.online_eval.project_evaluator_resolution import resolve_project_evaluator
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.helpers.test_decision_evaluator_policy import questions

from ..._helpers import _add_project, _add_span, _add_trace
from .test_consumer import _annotations, _cycle_to_completion, _get_unit

_POLYMORPHIC = with_polymorphic(
    models.Evaluator,
    [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator, models.DecisionEvaluator],
)


def _response() -> DecisionResponse:
    return DecisionResponse(
        model="jev-resolved",
        answers={
            "correct": PredicateAnswer(probability=0.9),
            "route": RefusalAnswer(),
            "quality": ScaleAnswer(
                expected_level=1.5, confidence=0.6, probabilities={0: 0.1, 1: 0.3, 2: 0.6}
            ),
        },
        input_tokens=3,
        output_tokens=2,
    )


async def _seed_judge(db: DbSessionFactory, *, threshold: float = 0.8) -> int:
    """A saved TypeSafe judge asking three questions about a span's output."""
    async with db() as session:
        decision = models.Decision(name=Identifier(f"decision-{token_hex(4)}"), metadata_={})
        version = models.DecisionVersion(
            decision=decision,
            inputs=[DecisionInput(name="output")],
            state=InputState(type="input", name="output"),
            questions=questions(),
            model_provider=ModelProvider.TYPESAFE,
            model_name="jev-latest",
            metadata_={},
        )
        session.add(version)
        await session.flush()
        judge = models.DecisionEvaluator(
            name=Identifier(f"judge-{token_hex(4)}"),
            description=None,
            metadata_={},
            decision_version_id=version.id,
            scoring_policy=DecisionScoringPolicy(
                questions={"correct": PredicateScoring(type="predicate", threshold=threshold)}
            ),
        )
        session.add(judge)
        await session.flush()
        return judge.id


async def _bind(db: DbSessionFactory, project_id: int, judge_id: int) -> int:
    async with db() as session:
        binding = models.ProjectEvaluator(
            trace_project=models.Project(name=f"project-evaluator-{token_hex(12)}"),
            project_id=project_id,
            evaluator_id=judge_id,
            name=Identifier(f"judge-binding-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(binding)
        await session.flush()
        return binding.id


async def _fingerprint(db: DbSessionFactory, judge_id: int, binding_id: int) -> str:
    async with db() as session:
        binding = await session.get(models.ProjectEvaluator, binding_id)
        judge = await session.scalar(select(_POLYMORPHIC).where(_POLYMORPHIC.id == judge_id))
        assert binding is not None and judge is not None
        resolved = await resolve_project_evaluator(session, binding, judge)
        assert resolved is not None
        return config_fingerprint(resolved)


async def _materialize(db: DbSessionFactory, span_rowid: int, binding_id: int) -> int:
    async with db() as session:
        unit = models.EvalWorkUnit(span_rowid=span_rowid, project_evaluator_id=binding_id)
        session.add(unit)
        await session.flush()
        return unit.id


async def _span_with_output(db: DbSessionFactory) -> tuple[int, int]:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "refund?"}, "output": {"value": "refunded"}},
        )
        return project.id, span.id


@pytest.fixture(autouse=True)
def _typesafe_key(monkeypatch: pytest.MonkeyPatch) -> None:
    # Online evaluation has no request credentials; the key comes from the server.
    monkeypatch.setenv("TYPESAFE_API_KEY", "server-key")


async def test_a_judge_annotates_a_span_with_one_call_per_span(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id, span_rowid = await _span_with_output(db)
    judge_id = await _seed_judge(db)
    binding_id = await _bind(db, project_id, judge_id)
    fingerprint = await _fingerprint(db, judge_id, binding_id)
    unit_id = await _materialize(db, span_rowid, binding_id)
    invoke = AsyncMock(return_value=_response())
    monkeypatch.setattr(TypeSafeDecisionClient, "invoke", invoke)

    await _cycle_to_completion(OnlineEvalConsumer(db, decrypt=lambda value: value))

    assert (await _get_unit(db, unit_id)).status == "DONE"
    assert invoke.await_count == 1
    # The span's output, as the online context shapes it for every evaluator.
    assert invoke.call_args.args[0].state == {"output": "refunded"}
    by_name = {annotation.name: annotation for annotation in await _annotations(db)}
    async with db() as session:
        binding = await session.get(models.ProjectEvaluator, binding_id)
        assert binding is not None
        name = binding.name.root
    assert set(by_name) == {f"{name}.correct", f"{name}.route", f"{name}.quality"}
    correct = by_name[f"{name}.correct"]
    # Scored by the judge's own policy (threshold 0.8).
    assert (correct.label, correct.score) == ("true", 0.9)
    assert correct.annotator_kind == "LLM"
    assert correct.identifier == annotation_identifier(fingerprint)
    assert correct.metadata_["decision"]["status"] == "answered"
    # A refused choice has no label, yet passes the categorical check.
    route = by_name[f"{name}.route"]
    assert (route.label, route.score) == (None, None)
    assert route.metadata_["decision"]["status"] == "refused"
    assert by_name[f"{name}.quality"].score == 1.5


async def test_a_rate_limited_judge_retries_without_spending_an_attempt(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id, span_rowid = await _span_with_output(db)
    judge_id = await _seed_judge(db)
    binding_id = await _bind(db, project_id, judge_id)
    unit_id = await _materialize(db, span_rowid, binding_id)
    monkeypatch.setattr(
        TypeSafeDecisionClient, "invoke", AsyncMock(side_effect=DecisionRateLimitError("slow"))
    )

    await _cycle_to_completion(OnlineEvalConsumer(db, decrypt=lambda value: value))

    unit = await _get_unit(db, unit_id)
    assert unit.status != "DONE"
    assert unit.attempts == 0
    assert await _annotations(db) == []


async def test_editing_the_judges_policy_changes_its_fingerprint(
    db: DbSessionFactory,
) -> None:
    project_id, _ = await _span_with_output(db)
    judge_id = await _seed_judge(db, threshold=0.8)
    binding_id = await _bind(db, project_id, judge_id)
    before = await _fingerprint(db, judge_id, binding_id)
    async with db() as session:
        judge = await session.get(models.DecisionEvaluator, judge_id)
        assert judge is not None
        judge.scoring_policy = DecisionScoringPolicy(
            questions={"correct": PredicateScoring(type="predicate", threshold=0.5)}
        )
    assert await _fingerprint(db, judge_id, binding_id) != before


async def test_binding_a_judge_to_a_project_checks_what_the_target_can_fill(
    db: DbSessionFactory, httpx_client: httpx.AsyncClient
) -> None:
    project_id, _ = await _span_with_output(db)
    judge_id = await _seed_judge(db)
    async with db() as session:
        judge = await session.get(models.DecisionEvaluator, judge_id)
        assert judge is not None
        version = judge.selected_version
        version.inputs = [DecisionInput(name="ticket")]
        version.state = InputState(type="input", name="ticket")
    route = f"v1/projects/{GlobalID('Project', str(project_id))}/evaluators"
    body: dict[str, Any] = {
        "name": "judge",
        "evaluator_id": str(GlobalID("DecisionEvaluator", str(judge_id))),
        "evaluation_target": "SPAN",
        "sampling_rate": 1.0,
    }
    response = await httpx_client.post(route, json=body)
    assert response.status_code == 422, response.text
    assert "'ticket'" in response.text and "span, trace, or session" in response.text

    body["input_mapping"] = {"literal_mapping": {}, "path_mapping": {"ticket": "output"}}
    response = await httpx_client.post(route, json=body)
    assert response.status_code == 201, response.text
    assert response.json()["data"]["evaluator_type"] == "decision"


async def test_span_annotations_expose_the_typed_decision(
    db: DbSessionFactory, gql_client: AsyncGraphQLClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id, span_rowid = await _span_with_output(db)
    judge_id = await _seed_judge(db)
    binding_id = await _bind(db, project_id, judge_id)
    await _materialize(db, span_rowid, binding_id)
    monkeypatch.setattr(TypeSafeDecisionClient, "invoke", AsyncMock(return_value=_response()))
    await _cycle_to_completion(OnlineEvalConsumer(db, decrypt=lambda value: value))
    annotation = next(a for a in await _annotations(db) if a.name.endswith(".quality"))

    result = await gql_client.execute(
        """query ($id: ID!) { node(id: $id) { ... on SpanAnnotation {
          decision { status question { name type levels { label } }
            answer { __typename ... on ScaleAnswer { expectedLevel } } modelProvider } } } }""",
        variables={"id": str(GlobalID("SpanAnnotation", str(annotation.id)))},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["node"]["decision"] == {
        "status": "ANSWERED",
        "question": {
            "name": "quality",
            "type": "SCALE",
            "levels": [{"label": "low"}, {"label": "medium"}, {"label": "high"}],
        },
        "answer": {"__typename": "ScaleAnswer", "expectedLevel": 1.5},
        "modelProvider": "TYPESAFE",
    }


async def test_a_project_binding_blocks_breaking_judge_changes(
    db: DbSessionFactory, gql_client: AsyncGraphQLClient
) -> None:
    project_id, _ = await _span_with_output(db)
    judge_id = await _seed_judge(db)
    await _bind(db, project_id, judge_id)
    async with db() as session:
        judge = await session.get(models.DecisionEvaluator, judge_id)
        assert judge is not None
        breaking = models.DecisionVersion(
            decision_id=judge.selected_version.decision_id,
            inputs=[DecisionInput(name="output")],
            state=InputState(type="input", name="output"),
            questions=questions()[:1],
            model_provider=ModelProvider.TYPESAFE,
            model_name="jev-latest",
            metadata_={},
        )
        session.add(breaking)
        await session.flush()
        breaking_id = breaking.id
    result = await gql_client.execute(
        """mutation ($input: PatchDecisionEvaluatorInput!) {
          patchDecisionEvaluator(input: $input) { evaluator { id } } }""",
        variables={
            "input": {
                "evaluatorId": str(GlobalID("DecisionEvaluator", str(judge_id))),
                "decisionVersionId": str(GlobalID("DecisionVersion", str(breaking_id))),
            }
        },
    )
    assert result.errors and "would break project evaluators" in result.errors[0].message


async def test_an_oversized_request_gives_up_without_calling_the_model(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace, attributes={"output": {"value": "x" * 2_000}})
        project_id, span_rowid = project.id, span.id
    judge_id = await _seed_judge(db)
    binding_id = await _bind(db, project_id, judge_id)
    unit_id = await _materialize(db, span_rowid, binding_id)
    monkeypatch.setenv("PHOENIX_ONLINE_EVAL_MAX_LLM_MESSAGE_BYTES", "1024")
    invoke = AsyncMock(return_value=_response())
    monkeypatch.setattr(TypeSafeDecisionClient, "invoke", invoke)

    await _cycle_to_completion(OnlineEvalConsumer(db, decrypt=lambda value: value))

    unit = await _get_unit(db, unit_id)
    assert invoke.await_count == 0
    assert unit.status == "EXPIRED"
    assert unit.error is not None and "RENDERED_MESSAGE_TOO_LARGE" in unit.error
