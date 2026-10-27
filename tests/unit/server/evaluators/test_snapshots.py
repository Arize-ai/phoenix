"""Dataset judge snapshots survive changes and deletion of their source bindings."""

import json
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from pydantic import SecretStr
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.decision_evaluators import PredicateScoring
from phoenix.db.types.evaluator_definition import (
    InlineCodeEvaluatorDefinition,
    StoredCodeEvaluatorDefinition,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.daemons.experiment_runner import ExperimentRunner
from phoenix.server.evaluators.runtime.decision import DecisionEvaluator
from phoenix.server.evaluators.snapshots import (
    capture_dataset_decision_evaluators,
    pin_evaluator_definition,
)
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_decision_evaluator_mutations import (
    PATCH_EVALUATOR,
    saved_evaluator,
)
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
        await capture_dataset_decision_evaluators(session, experiment.id)
        job = await session.get(models.ExperimentJob, experiment.id)
        assert job is not None
        original = job.decision_evaluator_snapshots[0]
        assert "TYPESAFE_API_KEY" not in json.dumps(
            [snapshot.model_dump(mode="json") for snapshot in job.decision_evaluator_snapshots]
        )

    result = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {
                "decisionId": decision["id"],
                "version": version_input(modelName="jev-new"),
            }
        },
    )
    assert result.data and not result.errors, result.errors
    new_version_id = result.data["createDecisionVersion"]["version"]["id"]
    result = await gql_client.execute(
        "mutation($input:UpdateDatasetDecisionEvaluatorInput!){updateDatasetDecisionEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetEvaluatorId": binding_id,
                "name": "changed-judge",
                "inputMapping": {"literalMapping": {"ticket": {"id": 2}}, "pathMapping": {}},
            }
        },
    )
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(
        PATCH_EVALUATOR,
        variables={
            "input": {
                "evaluatorId": evaluator["id"],
                "decisionVersionId": new_version_id,
                "scoringPolicy": {
                    "questions": [{"predicate": {"name": "urgent", "threshold": 0.9}}]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    async with db() as session:
        # Advance the projects table's max rowid before deleting the binding so SQLite does
        # not reuse the deleted trace project's ID for the fallback project.
        session.add(models.Project(name="intervening-project"))
        await session.flush()
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
        scoring = spec.evaluator.definition.scoring_policy.questions["urgent"]
        # The judge's policy as frozen, not its later edit.
        assert isinstance(scoring, PredicateScoring) and scoring.threshold == 0.8
        assert await session.get(models.Project, spec.evaluator_project_id) is not None
        assert spec.evaluator_project_id != original.project_id
        resumed = job.decision_evaluator_snapshots[0]
        assert resumed.definition == original.definition
        assert resumed.input_mapping == original.input_mapping
        assert resumed.project_id == spec.evaluator_project_id
        session.expunge(job)

    async with db() as session:
        persisted_job = await session.get(models.ExperimentJob, experiment.id)
        assert persisted_job is not None
        persisted = persisted_job.decision_evaluator_snapshots[0]
        assert persisted.project_id == spec.evaluator_project_id
        assert persisted.project_id != original.project_id
        _, _, second_specs, _, _ = await runner._load_experiment_config(
            session,
            experiment.id,
            credentials=[
                GenerativeCredentialInput(env_var_name="TYPESAFE_API_KEY", value=SecretStr("test"))
            ],
        )
        assert second_specs[0].evaluator_project_id == spec.evaluator_project_id


async def _insert_code_evaluator(
    db: DbSessionFactory, *, versions: int, sandbox_config_id: int | None = None
) -> tuple[int, list[int]]:
    async with db() as session:
        code_eval = models.CodeEvaluator(
            name=Identifier("pinned"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[],
            language="PYTHON",
            sandbox_config_id=sandbox_config_id,
        )
        session.add(code_eval)
        await session.flush()
        version_ids: list[int] = []
        for i in range(versions):
            version = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code=f"def evaluate(output): return {i}",
            )
            session.add(version)
            await session.flush()
            version_ids.append(version.id)
        return code_eval.id, version_ids


class TestPinEvaluatorDefinition:
    async def test_pins_a_stored_code_evaluator_to_its_current_version_and_sandbox(
        self, db: DbSessionFactory, sandbox_config: models.SandboxConfig
    ) -> None:
        code_eval_id, version_ids = await _insert_code_evaluator(
            db, versions=2, sandbox_config_id=sandbox_config.id
        )
        definition = StoredCodeEvaluatorDefinition(
            type="code_evaluator", code_evaluator_id=code_eval_id
        )
        async with db() as session:
            pinned = await pin_evaluator_definition(definition, session=session)
        assert isinstance(pinned, StoredCodeEvaluatorDefinition)
        assert pinned.code_evaluator_id == code_eval_id
        assert pinned.code_evaluator_version_id == version_ids[-1]
        assert pinned.sandbox_config_id == sandbox_config.id
        assert pinned.language == "PYTHON"

    async def test_keeps_a_version_already_pinned(
        self, db: DbSessionFactory, seed_languages: None
    ) -> None:
        code_eval_id, version_ids = await _insert_code_evaluator(db, versions=2)
        definition = StoredCodeEvaluatorDefinition(
            type="code_evaluator",
            code_evaluator_id=code_eval_id,
            code_evaluator_version_id=version_ids[0],
        )
        async with db() as session:
            pinned = await pin_evaluator_definition(definition, session=session)
        assert isinstance(pinned, StoredCodeEvaluatorDefinition)
        assert pinned.code_evaluator_version_id == version_ids[0]

    async def test_rejects_an_evaluator_without_a_version(
        self, db: DbSessionFactory, seed_languages: None
    ) -> None:
        code_eval_id, _ = await _insert_code_evaluator(db, versions=0)
        definition = StoredCodeEvaluatorDefinition(
            type="code_evaluator", code_evaluator_id=code_eval_id
        )
        async with db() as session:
            with pytest.raises(BadRequest, match="no current version"):
                await pin_evaluator_definition(definition, session=session)

    async def test_leaves_inline_definitions_alone(self, db: DbSessionFactory) -> None:
        definition = InlineCodeEvaluatorDefinition(
            type="inline_code_evaluator",
            name="draft",
            language="PYTHON",
            source_code="def evaluate(output): return 1",
            sandbox_config_id=1,
            output_configs=[],
        )
        async with db() as session:
            assert await pin_evaluator_definition(definition, session=session) is definition
