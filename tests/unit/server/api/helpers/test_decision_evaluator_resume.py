"""Resume queues each frozen decision judge once per run, from its recorded results."""

from datetime import datetime, timezone
from typing import Any, Optional, cast
from unittest.mock import MagicMock

import pytest
from pydantic import SecretStr
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.helpers.decision_evaluator_snapshots import (
    freeze_dataset_decision_evaluators,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.daemons.experiment_runner import EvalWorkItem, ExperimentRunner
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_saved_decision_mutations import create, version_input
from tests.unit.server.daemons.test_experiment_runner import _make_running_experiment

_CREATE_EVALUATOR = """
mutation ($input: CreateDecisionEvaluatorInput!) {
  createDecisionEvaluator(input: $input) { evaluator { id } }
}
"""
_BIND = """
mutation ($input: CreateDatasetDecisionEvaluatorInput!) {
  createDatasetDecisionEvaluator(input: $input) { evaluator { id } }
}
"""

# An annotation's state: a score, an error, or a refusal (neither score nor error).
_OK, _ERROR, _REFUSED = "ok", "error", "refused"


async def _bind_judge(
    gql_client: AsyncGraphQLClient, *, name: str, questions: Optional[list[Any]] = None
) -> int:
    decision = await create(
        gql_client,
        name=f"{name}-decision",
        version=version_input(**({"questions": questions} if questions else {})),
    )
    result = await gql_client.execute(
        _CREATE_EVALUATOR,
        variables={
            "input": {"name": f"{name}-judge", "decisionVersionId": decision["version"]["id"]}
        },
    )
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(
        _BIND,
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": result.data["createDecisionEvaluator"]["evaluator"]["id"],
                "name": name,
                "inputMapping": {"literalMapping": {"ticket": "hi"}, "pathMapping": {}},
            }
        },
    )
    assert result.data and not result.errors, result.errors
    return int(
        GlobalID.from_id(result.data["createDatasetDecisionEvaluator"]["evaluator"]["id"]).node_id
    )


@pytest.mark.parametrize(
    "recorded, queued",
    [
        pytest.param({}, {"triage", "solo"}, id="nothing-recorded"),
        pytest.param(
            {"triage.urgent": _OK, "triage.team": _REFUSED, "solo": _OK},
            set(),
            id="refusal-is-terminal",
        ),
        pytest.param(
            {"triage.urgent": _OK, "solo": _OK},
            {"triage"},
            id="incomplete-multi-question-set-is-queued-once",
        ),
        pytest.param(
            {"triage.urgent": _ERROR, "triage.team": _OK},
            {"triage", "solo"},
            id="errored-and-missing-are-queued",
        ),
        pytest.param(
            {"triage.urgent": _OK, "triage.team": _OK, "urgent": _OK},
            {"solo"},
            id="single-question-judge-writes-under-its-binding",
        ),
    ],
)
async def test_resume_queues_incomplete_judges_once(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    empty_dataset: None,
    recorded: dict[str, str],
    queued: set[str],
) -> None:
    binding_ids = [
        await _bind_judge(gql_client, name="triage"),
        await _bind_judge(
            gql_client,
            name="solo",
            questions=[{"predicate": {"name": "urgent", "instructions": "Is it urgent?"}}],
        ),
    ]
    now = datetime.now(timezone.utc)
    async with db() as session:
        experiment = models.Experiment(
            dataset_id=1, dataset_version_id=1, name="resume", repetitions=1, metadata_={}
        )
        session.add(experiment)
        await session.flush()
        session.add(models.ExperimentEvalOnlyConfig(id=experiment.id))
        await session.flush()
        for binding_id in binding_ids:
            session.add(
                models.ExperimentDatasetEvaluator(
                    experiment_id=experiment.id, dataset_evaluator_id=binding_id
                )
            )
        await freeze_dataset_decision_evaluators(session, experiment.id)
        session.add(
            models.ExperimentDatasetExample(
                experiment_id=experiment.id, dataset_example_id=1, dataset_example_revision_id=1
            )
        )
        run = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=1,
            repetition_number=1,
            output={"task_output": "done"},
            start_time=now,
            end_time=now,
        )
        session.add(run)
        await session.flush()
        for name, state in recorded.items():
            session.add(
                models.ExperimentRunAnnotation(
                    experiment_run_id=run.id,
                    name=name,
                    annotator_kind="LLM",
                    label=None,
                    score=1.0 if state == _OK else None,
                    explanation="Decision model refused this question."
                    if state == _REFUSED
                    else None,
                    trace_id=None,
                    error="boom" if state == _ERROR else None,
                    metadata_={},
                    start_time=now,
                    end_time=now,
                )
            )

    runner = ExperimentRunner(
        db,
        decrypt=lambda value: value,
        tracer_factory=lambda: Tracer(span_cost_calculator=cast(Any, MagicMock())),
        sandbox_session_manager=cast(Any, MagicMock(replica_id="replica-1")),
        sandbox_runtime=cast(Any, MagicMock()),
    )
    async with db() as session:
        _, _, specs, _, _ = await runner._load_experiment_config(
            session,
            experiment.id,
            credentials=[
                GenerativeCredentialInput(env_var_name="TYPESAFE_API_KEY", value=SecretStr("test"))
            ],
        )
    assert {spec.name: spec.annotation_names for spec in specs} == {
        "triage": ["triage.urgent", "triage.team"],
        "solo": ["solo"],
    }

    running = _make_running_experiment(experiment.id, evaluator_run_specs=specs)
    running._db = db
    running._task_db_exhausted = True
    running._eval_db_exhausted = False
    await running._ensure_eval_buffer()

    items = [item for item in running._eval_queue if isinstance(item, EvalWorkItem)]
    assert sorted(item.annotation_names[0].split(".")[0] for item in items) == sorted(queued)
