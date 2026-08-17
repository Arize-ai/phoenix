from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_ENABLED,
    ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED,
)
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.derivation import STALE_FINGERPRINT_ERROR
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project, _add_project_session, _add_trace
from tests.unit.graphql import AsyncGraphQLClient

_REQUEST = """
mutation($input: RequestProjectSessionEvaluationInput!) {
  requestProjectSessionEvaluation(input: $input) {
    evaluationRequest { id state blockingReason requestedAt }
  }
}
"""

_READ = """
query($id: ID!, $projectEvaluatorId: ID!) {
  node(id: $id) {
    ... on ProjectSession {
      evaluationRequest(projectEvaluatorId: $projectEvaluatorId) {
        id
        state
        blockingReason
      }
    }
  }
}
"""


@pytest.fixture(autouse=True)
def session_evaluation_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "true")


@dataclass(frozen=True)
class _Pair:
    project_session_rowid: int
    criteria_id: int
    evaluator_id: int

    @property
    def project_session_id(self) -> str:
        return str(GlobalID("ProjectSession", str(self.project_session_rowid)))

    @property
    def project_evaluator_id(self) -> str:
        return str(GlobalID("ProjectEvaluator", str(self.criteria_id)))


async def _seed_pair(
    session: AsyncSession,
    *,
    last_span_ingested_at: Optional[datetime],
    builtin_key: str = "exact_match",
) -> _Pair:
    """A session and a SESSION evaluator on the same project."""
    project = await _add_project(session)
    project_session = await _add_project_session(session, project)
    project_session.last_span_ingested_at = last_span_ingested_at
    await _add_trace(session, project, project_session)
    evaluator = await session.scalar(
        select(models.BuiltinEvaluator).where(models.BuiltinEvaluator.key == builtin_key)
    )
    if evaluator is None:
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=builtin_key,
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
    criteria = models.ProjectEvaluatorCriteria(
        project_id=project.id,
        evaluator_id=evaluator.id,
        name=Identifier(root=f"criteria-{token_hex(4)}"),
        filter_condition="",
        sampling_rate=1.0,
        evaluation_target="SESSION",
    )
    session.add(criteria)
    await session.flush()
    return _Pair(
        project_session_rowid=project_session.id,
        criteria_id=criteria.id,
        evaluator_id=evaluator.id,
    )


async def _link_evaluation(
    session: AsyncSession,
    pair: _Pair,
    *,
    status: str,
    error: Optional[str] = None,
    attempts: int = 0,
) -> models.EvalSessionWorkUnit:
    """Attach a running or finished evaluation to the pair's outstanding request."""
    evaluation = models.EvalSessionWorkUnit(
        project_session_rowid=pair.project_session_rowid,
        evaluator_id=pair.evaluator_id,
        criteria_id=pair.criteria_id,
        config_fingerprint=token_hex(8),
        evaluated_through=datetime.now(timezone.utc),
        status=status,
        error=error,
        attempts=attempts,
    )
    session.add(evaluation)
    await session.flush()
    request = await session.scalar(
        select(models.EvaluationRequest).where(
            models.EvaluationRequest.project_session_rowid == pair.project_session_rowid,
            models.EvaluationRequest.criteria_id == pair.criteria_id,
        )
    )
    assert request is not None
    request.materialized_generation = request.requested_generation
    request.materialized_by_session_work_unit_id = evaluation.id
    await session.flush()
    return evaluation


async def _quiet_pair(db: DbSessionFactory, **kwargs: Any) -> _Pair:
    """A pair whose session went quiet long enough ago to be due for evaluation."""
    async with db() as session:
        return await _seed_pair(
            session,
            last_span_ingested_at=datetime.now(timezone.utc) - timedelta(hours=1),
            **kwargs,
        )


async def _request(gql_client: AsyncGraphQLClient, pair: _Pair, **extra: Any) -> dict[str, Any]:
    result = await gql_client.execute(
        _REQUEST,
        {
            "input": {
                "projectSessionId": pair.project_session_id,
                "projectEvaluatorId": pair.project_evaluator_id,
                **extra,
            }
        },
    )
    assert result.data and not result.errors, result.errors
    request = result.data["requestProjectSessionEvaluation"]["evaluationRequest"]
    assert isinstance(request, dict)
    return request


async def _read(gql_client: AsyncGraphQLClient, pair: _Pair) -> Optional[dict[str, Any]]:
    result = await gql_client.execute(
        _READ,
        {"id": pair.project_session_id, "projectEvaluatorId": pair.project_evaluator_id},
    )
    assert result.data and not result.errors, result.errors
    request = result.data["node"]["evaluationRequest"]
    assert request is None or isinstance(request, dict)
    return request


async def _request_count(db: DbSessionFactory) -> int:
    async with db() as session:
        count = await session.scalar(select(func.count()).select_from(models.EvaluationRequest))
    assert isinstance(count, int)
    return count


async def test_a_request_reports_the_funnel_as_its_evaluation_advances(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    pair = await _quiet_pair(db)
    assert await _read(gql_client, pair) is None

    requested = await _request(gql_client, pair)
    assert requested["state"] == "REQUESTED"
    assert requested["blockingReason"] is None

    async with db() as session:
        evaluation = await _link_evaluation(session, pair, status="PENDING")
    queued = await _read(gql_client, pair)
    assert queued is not None
    assert queued["id"] == requested["id"]
    assert queued["state"] == "QUEUED"
    assert queued["blockingReason"] is None

    async with db() as session:
        (await session.get(models.EvalSessionWorkUnit, evaluation.id)).status = "DONE"  # type: ignore[union-attr]
    evaluated = await _read(gql_client, pair)
    assert evaluated is not None
    assert evaluated["state"] == "EVALUATED"


async def test_a_request_whose_evaluation_is_retired_by_a_configuration_change_reports_failed(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    pair = await _quiet_pair(db)
    await _request(gql_client, pair)
    async with db() as session:
        await _link_evaluation(session, pair, status="EXPIRED", error=STALE_FINGERPRINT_ERROR)

    failed = await _read(gql_client, pair)
    assert failed is not None
    assert failed["state"] == "FAILED"
    assert failed["blockingReason"] is None


async def test_a_request_closed_without_an_evaluation_reports_failed(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    pair = await _quiet_pair(db)
    await _request(gql_client, pair)
    async with db() as session:
        request = await session.scalar(
            select(models.EvaluationRequest).where(
                models.EvaluationRequest.criteria_id == pair.criteria_id
            )
        )
        assert request is not None
        request.materialized_generation = request.requested_generation

    failed = await _read(gql_client, pair)
    assert failed is not None
    assert failed["state"] == "FAILED"
    assert failed["blockingReason"] is None


async def test_a_continuously_active_session_stays_requested_and_says_why(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session, last_span_ingested_at=datetime.now(timezone.utc))

    requested = await _request(gql_client, pair)
    assert requested["state"] == "REQUESTED"
    assert requested["blockingReason"] == "SESSION_ACTIVE"


async def test_a_request_for_an_unresolvable_evaluator_stays_requested_and_says_why(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    pair = await _quiet_pair(db, builtin_key=f"unknown-{token_hex(4)}")

    requested = await _request(gql_client, pair)
    assert requested["state"] == "REQUESTED"
    assert requested["blockingReason"] == "EVALUATOR_VERSION_UNRESOLVED"


async def test_requesting_an_evaluation_for_a_session_with_no_spans_is_refused(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        pair = await _seed_pair(session, last_span_ingested_at=None)

    result = await gql_client.execute(
        _REQUEST,
        {
            "input": {
                "projectSessionId": pair.project_session_id,
                "projectEvaluatorId": pair.project_evaluator_id,
            }
        },
    )
    assert result.errors
    assert "has not ingested any spans" in result.errors[0].message
    assert await _request_count(db) == 0


async def test_requesting_an_evaluation_is_refused_while_session_evaluation_is_off(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pair = await _quiet_pair(db)
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "false")

    result = await gql_client.execute(
        _REQUEST,
        {
            "input": {
                "projectSessionId": pair.project_session_id,
                "projectEvaluatorId": pair.project_evaluator_id,
            }
        },
    )
    assert result.errors
    assert "Session evaluation is turned off" in result.errors[0].message
    assert await _request_count(db) == 0
