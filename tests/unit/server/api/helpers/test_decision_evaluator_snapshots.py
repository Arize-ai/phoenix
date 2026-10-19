"""Dataset judge snapshots survive changes and deletion of their source bindings."""

import json
from typing import Any, cast
from unittest.mock import MagicMock

from pydantic import SecretStr
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.decision_evaluators import PredicateProjection
from phoenix.server.api.decision_evaluator import DecisionEvaluator
from phoenix.server.api.helpers.decision_evaluator_snapshots import (
    DecisionEvaluatorSnapshot,
    freeze_dataset_decision_evaluators,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.daemons.experiment_runner import ExperimentRunner
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_decision_evaluator_mutations import saved_evaluator
from tests.unit.server.api.mutations.test_saved_decision_mutations import (
    CREATE_VERSION,
    version_input,
)


async def test_resume_uses_original_judge_after_source_changes_and_deletion(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    empty_dataset: None,
) -> None:
    decision, evaluator = await saved_evaluator(gql_client)
    result = await gql_client.execute(
        "mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "judge",
                "inputMapping": {"literalMapping": {"ticket": {"id": 1}}, "pathMapping": {}},
                "projectionPolicy": {
                    "questions": [{"predicate": {"name": "urgent", "threshold": 0.4}}]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    binding_id = result.data["createDatasetDecisionEvaluator"]["evaluator"]["id"]
    async with db() as session:
        experiment = models.Experiment(
            dataset_id=1, dataset_version_id=1, name="frozen-judge", repetitions=1, metadata_={}
        )
        session.add(experiment)
        await session.flush()
        session.add(models.ExperimentEvalOnlyConfig(id=experiment.id))
        await session.flush()
        session.add(
            models.ExperimentDatasetEvaluator(
                experiment_id=experiment.id,
                dataset_evaluator_id=int(GlobalID.from_id(binding_id).node_id),
            )
        )
        await freeze_dataset_decision_evaluators(session, experiment.id)
        job = await session.get(models.ExperimentJob, experiment.id)
        assert job is not None
        original = DecisionEvaluatorSnapshot.model_validate(job.decision_evaluator_snapshots[0])
        assert "TYPESAFE_API_KEY" not in json.dumps(job.decision_evaluator_snapshots)

    result = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {
                "decisionId": decision["id"],
                "version": version_input(modelName="jev-new"),
                "tags": [{"name": evaluator["decisionVersionTag"]["name"]}],
            }
        },
    )
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(
        "mutation($input:UpdateDatasetDecisionEvaluatorInput!){updateDatasetDecisionEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetEvaluatorId": binding_id,
                "name": "changed-judge",
                "inputMapping": {"literalMapping": {"ticket": {"id": 2}}, "pathMapping": {}},
                "projectionPolicy": {
                    "questions": [{"predicate": {"name": "urgent", "threshold": 0.9}}]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(
        "mutation($input:DeleteDatasetEvaluatorsInput!){deleteDatasetEvaluators(input:$input){query{__typename}}}",
        variables={"input": {"datasetEvaluatorIds": [binding_id]}},
    )
    assert result.data and not result.errors, result.errors

    runner = ExperimentRunner(
        db,
        decrypt=lambda value: value,
        tracer_factory=lambda: Tracer(span_cost_calculator=cast(Any, MagicMock())),
        sandbox_session_manager=cast(Any, MagicMock(replica_id="replica-1")),
        sandbox_runtime=cast(Any, MagicMock()),
    )
    async with db() as session:
        job, _, specs, _, _ = await runner._load_experiment_config(
            session,
            experiment.id,
            credentials=[
                GenerativeCredentialInput(env_var_name="TYPESAFE_API_KEY", value=SecretStr("test"))
            ],
        )
        assert len(specs) == 1
        spec = specs[0]
        assert spec.name == "judge"
        assert spec.input_mapping.literal_mapping == {"ticket": {"id": 1}}
        assert spec.output_configs == original.output_configs
        assert isinstance(spec.evaluator, DecisionEvaluator)
        assert spec.evaluator.definition.model_name == decision["version"]["modelName"]
        projection = spec.evaluator.definition.projection_policy.questions["urgent"]
        assert isinstance(projection, PredicateProjection) and projection.threshold == 0.4
        assert await session.get(models.Project, spec.evaluator_project_id) is not None
        resumed = DecisionEvaluatorSnapshot.model_validate(job.decision_evaluator_snapshots[0])
        assert resumed.definition == original.definition
        assert resumed.input_mapping == original.input_mapping
