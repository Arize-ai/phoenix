"""Saved decision evaluators, their owned version pins, and dataset previews."""

from typing import Any
from unittest.mock import AsyncMock

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.helpers.decision_clients import (
    DecisionResponse,
    PredicateAnswer,
    RefusalAnswer,
    TypeSafeDecisionClient,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from .test_saved_decision_mutations import CREATE_VERSION, create, version_input

CREATE_EVALUATOR = """
mutation ($input: CreateDecisionEvaluatorInput!) {
  createDecisionEvaluator(input: $input) { evaluator {
    id name kind projectionPolicy {
      questions { __typename name optimizationDirection
        ... on DecisionPredicateProjection { threshold }
        ... on DecisionChoiceProjection { scores { choice score } }
        ... on DecisionScaleProjection { includeLabel }
      }
    } inputSchema decisionVersion { id }
    decisionVersionTag { id name }
    outputConfigs { ... on ContinuousAnnotationConfig { name lowerBound upperBound } ... on CategoricalAnnotationConfig { name values { label score } } }
  } }
}
"""


async def saved_evaluator(gql_client: AsyncGraphQLClient) -> tuple[dict[str, Any], dict[str, Any]]:
    decision = await create(gql_client)
    result = await gql_client.execute(
        CREATE_EVALUATOR,
        variables={
            "input": {
                "name": "triage-judge",
                "decisionVersionId": decision["version"]["id"],
                "projectionPolicy": {
                    "questions": [{"predicate": {"name": "urgent", "threshold": 0.8}}],
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    return decision, result.data["createDecisionEvaluator"]["evaluator"]


async def test_saved_decision_evaluator_discovery_and_owned_tag(
    gql_client: AsyncGraphQLClient,
) -> None:
    decision, evaluator = await saved_evaluator(gql_client)
    assert evaluator["kind"] == "DECISION"
    assert evaluator["decisionVersion"]["id"] == decision["version"]["id"]
    assert evaluator["outputConfigs"][0] == {"name": "urgent", "lowerBound": 0, "upperBound": 1}
    result = await gql_client.execute(
        "query($id: ID!){ node(id:$id) { ... on DecisionEvaluator { name kind } } evaluators { edges { node { name kind } } } }",
        variables={"id": evaluator["id"]},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["node"] == {"name": "triage-judge", "kind": "DECISION"}
    assert any(edge["node"]["kind"] == "DECISION" for edge in result.data["evaluators"]["edges"])
    result = await gql_client.execute(
        "mutation($input: DeleteDecisionVersionTagInput!){ deleteDecisionVersionTag(input:$input){ query { __typename } } }",
        variables={"input": {"decisionVersionTagId": evaluator["decisionVersionTag"]["id"]}},
    )
    assert result.errors and "owned by a decision evaluator" in result.errors[0].message
    result = await gql_client.execute(
        "mutation($input: DeleteDecisionInput!){ deleteDecision(input:$input){ query { __typename } } }",
        variables={"input": {"decisionId": decision["id"]}},
    )
    assert result.errors and "referenced by an evaluator" in result.errors[0].message


async def test_dataset_binding_and_mixed_refusal_preview(
    gql_client: AsyncGraphQLClient, empty_dataset: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    result = await gql_client.execute(
        """
      mutation($input:CreateDatasetDecisionEvaluatorInput!) {
        createDatasetDecisionEvaluator(input:$input) { evaluator { id name evaluator { kind } outputConfigs { ... on ContinuousAnnotationConfig { name } ... on CategoricalAnnotationConfig { name } } } }
      }
    """,
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "judge",
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket"}},
            }
        },
    )
    assert result.data and not result.errors, result.errors
    assert result.data["createDatasetDecisionEvaluator"]["evaluator"]["outputConfigs"] == [
        {"name": "urgent"},
        {"name": "team"},
    ]
    invoke = AsyncMock(
        return_value=DecisionResponse(
            model="jev-resolved",
            answers={"urgent": PredicateAnswer(probability=0.7), "team": RefusalAnswer()},
            input_tokens=1,
            output_tokens=1,
        )
    )
    monkeypatch.setattr(TypeSafeDecisionClient, "invoke", invoke)
    result = await gql_client.execute(
        """
      mutation($input:EvaluatorPreviewsInput!) { evaluatorPreviews(input:$input) { results { evaluatorName error annotation { name label score explanation metadata } } } }
    """,
        variables={
            "input": {
                "credentials": [{"envVarName": "TYPESAFE_API_KEY", "value": "test"}],
                "previews": [
                    {
                        "evaluator": {"decisionEvaluatorId": evaluator["id"]},
                        "context": {"input": {"ticket": {"id": 1}}},
                        "inputMapping": {
                            "literalMapping": {},
                            "pathMapping": {"ticket": "input.ticket"},
                        },
                    }
                ],
            }
        },
    )
    assert result.data and not result.errors, result.errors
    answered, refused = result.data["evaluatorPreviews"]["results"]
    assert answered["annotation"]["label"] == "false"
    assert answered["annotation"]["score"] == 0.7
    assert refused["error"] is None
    assert refused["annotation"]["score"] is None and refused["annotation"]["label"] is None
    assert refused["annotation"]["metadata"]["decision"]["status"] == "refused"
    assert refused["annotation"]["explanation"] == "Decision model refused this question."
    assert invoke.await_count == 1
    assert invoke.call_args.args[0].state == {"id": 1}


async def test_bound_tag_move_rejects_breaking_questions(
    gql_client: AsyncGraphQLClient, empty_dataset: None
) -> None:
    decision, evaluator = await saved_evaluator(gql_client)
    binding = await gql_client.execute(
        "mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "judge",
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket"}},
            }
        },
    )
    assert binding.data and not binding.errors, binding.errors
    result = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {
                "decisionId": decision["id"],
                "version": version_input(
                    questions=[{"predicate": {"name": "renamed", "instructions": "New question?"}}]
                ),
                "tags": [{"name": evaluator["decisionVersionTag"]["name"]}],
            }
        },
    )
    assert result.errors and "would break dataset evaluators 'judge'" in result.errors[0].message
    result = await gql_client.execute(
        "mutation($input:DeleteDecisionEvaluatorInput!){deleteDecisionEvaluator(input:$input){query{__typename}}}",
        variables={"input": {"evaluatorId": evaluator["id"]}},
    )
    assert result.errors and "still bound" in result.errors[0].message


async def test_unbound_tag_move_carries_the_judges_policy_to_the_new_questions(
    gql_client: AsyncGraphQLClient,
) -> None:
    decision, evaluator = await saved_evaluator(gql_client)
    policy_query = """query($id:ID!){node(id:$id){... on DecisionEvaluator{projectionPolicy{
      questions{name ... on DecisionPredicateProjection{threshold}}}}}}"""

    async def move_to(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = await gql_client.execute(
            CREATE_VERSION,
            variables={
                "input": {
                    "decisionId": decision["id"],
                    "version": version_input(questions=questions),
                    "tags": [{"name": evaluator["decisionVersionTag"]["name"]}],
                }
            },
        )
        assert result.data and not result.errors, result.errors
        result = await gql_client.execute(policy_query, variables={"id": evaluator["id"]})
        assert result.data and not result.errors, result.errors
        policy: list[dict[str, Any]] = result.data["node"]["projectionPolicy"]["questions"]
        return policy

    urgent = {"predicate": {"name": "urgent", "instructions": "Is the ticket urgent?"}}
    added = {"predicate": {"name": "angry", "instructions": "Is the customer angry?"}}
    # A kept question keeps its threshold; a new one gets the default.
    assert await move_to([urgent, added]) == [
        {"name": "urgent", "threshold": 0.8},
        {"name": "angry", "threshold": 0.5},
    ]
    # Removing the customized question no longer blocks the move.
    assert await move_to([added]) == [{"name": "angry", "threshold": 0.5}]


async def test_detaching_last_binding_keeps_the_standalone_judge(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
    db: DbSessionFactory,
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    binding_id = await bind(gql_client, evaluator)
    result = await gql_client.execute(
        "mutation($input:DeleteDatasetEvaluatorsInput!){deleteDatasetEvaluators(input:$input){query{__typename}}}",
        variables={"input": {"datasetEvaluatorIds": [binding_id]}},
    )
    assert result.data and not result.errors, result.errors
    judge_id = int(GlobalID.from_id(evaluator["id"]).node_id)
    tag_id = int(GlobalID.from_id(evaluator["decisionVersionTag"]["id"]).node_id)
    async with db() as session:
        assert await session.get(models.Evaluator, judge_id) is not None
        assert await session.get(models.DecisionVersionTag, tag_id) is not None
    result = await gql_client.execute(
        "mutation($input:DeleteDecisionEvaluatorInput!){deleteDecisionEvaluator(input:$input){query{__typename}}}",
        variables={"input": {"evaluatorId": evaluator["id"]}},
    )
    assert result.data and not result.errors, result.errors
    async with db() as session:
        assert await session.get(models.Evaluator, judge_id) is None
        assert await session.get(models.DecisionVersionTag, tag_id) is None


async def bind(
    gql_client: AsyncGraphQLClient,
    evaluator: dict[str, Any],
    *,
    name: str = "judge",
    projection_policy: Any = None,
) -> str:
    result = await gql_client.execute(
        "mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": name,
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket"}},
                **({"projectionPolicy": projection_policy} if projection_policy else {}),
            }
        },
    )
    assert result.data and not result.errors, result.errors
    return str(result.data["createDatasetDecisionEvaluator"]["evaluator"]["id"])


async def test_binding_input_mapping_rejects_undeclared_keys(
    gql_client: AsyncGraphQLClient, empty_dataset: None
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    create = "mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{id}}}"
    for mapping in (
        {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket", "tickt": "input.x"}},
        {"literalMapping": {"nope": 1}, "pathMapping": {"ticket": "input.ticket"}},
    ):
        result = await gql_client.execute(
            create,
            variables={
                "input": {
                    "datasetId": str(GlobalID("Dataset", "1")),
                    "evaluatorId": evaluator["id"],
                    "name": "bad",
                    "inputMapping": mapping,
                }
            },
        )
        assert result.errors
        message = result.errors[0].message
        assert "undeclared inputs" in message and "Declared inputs: 'ticket'" in message
    # An unmapped input is filled from the run only when named like a context key.
    result = await gql_client.execute(
        create,
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "empty",
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
            }
        },
    )
    assert result.errors and "Map the inputs 'ticket'" in result.errors[0].message
    result = await gql_client.execute(
        create,
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "empty",
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input"}},
            }
        },
    )
    assert result.data and not result.errors, result.errors
    binding_id = result.data["createDatasetDecisionEvaluator"]["evaluator"]["id"]
    update = "mutation($input:UpdateDatasetDecisionEvaluatorInput!){updateDatasetDecisionEvaluator(input:$input){evaluator{id}}}"
    result = await gql_client.execute(
        update,
        variables={
            "input": {
                "datasetEvaluatorId": binding_id,
                "inputMapping": {"literalMapping": {"ghost": 1}, "pathMapping": {}},
            }
        },
    )
    assert result.errors and "'ghost'" in result.errors[0].message
    result = await gql_client.execute(
        update,
        variables={
            "input": {
                "datasetEvaluatorId": binding_id,
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
            }
        },
    )
    assert result.errors and "Map the inputs 'ticket'" in result.errors[0].message
    # Omitting the mapping keeps the saved one, which still fills ticket.
    result = await gql_client.execute(
        update, variables={"input": {"datasetEvaluatorId": binding_id, "description": "x"}}
    )
    assert result.data and not result.errors, result.errors
    result = await gql_client.execute(
        update,
        variables={
            "input": {
                "datasetEvaluatorId": binding_id,
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.t"}},
            }
        },
    )
    assert result.data and not result.errors, result.errors


async def test_preview_as_binding_uses_binding_name_and_override(
    gql_client: AsyncGraphQLClient, empty_dataset: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    binding_id = await bind(
        gql_client,
        evaluator,
        name="ticket-urgency",
        projection_policy={"questions": [{"predicate": {"name": "urgent", "threshold": 0.5}}]},
    )
    monkeypatch.setattr(
        TypeSafeDecisionClient,
        "invoke",
        AsyncMock(
            return_value=DecisionResponse(
                model="m",
                answers={"urgent": PredicateAnswer(probability=0.7), "team": RefusalAnswer()},
                input_tokens=1,
                output_tokens=1,
            )
        ),
    )
    query = """
      mutation($input:EvaluatorPreviewsInput!) { evaluatorPreviews(input:$input) { results { evaluatorName annotation { name label score } } } }
    """

    async def preview(**extra: Any) -> list[dict[str, Any]]:
        result = await gql_client.execute(
            query,
            variables={
                "input": {
                    "credentials": [{"envVarName": "TYPESAFE_API_KEY", "value": "test"}],
                    "previews": [
                        {
                            "evaluator": {"decisionEvaluatorId": evaluator["id"]},
                            "context": {"input": {"ticket": {"id": 1}}},
                            "inputMapping": {
                                "literalMapping": {},
                                "pathMapping": {"ticket": "input.ticket"},
                            },
                            **extra,
                        }
                    ],
                }
            },
        )
        assert result.data and not result.errors, result.errors
        return list(result.data["evaluatorPreviews"]["results"])

    judge_only = await preview()
    as_binding = await preview(datasetEvaluatorId=binding_id)
    assert judge_only[0]["annotation"]["label"] == "false"  # threshold 0.8
    assert as_binding[0]["annotation"]["label"] == "true"  # binding override 0.5
    assert as_binding[0]["evaluatorName"] != judge_only[0]["evaluatorName"]
    assert "ticket-urgency" in as_binding[0]["evaluatorName"] + as_binding[0]["annotation"]["name"]
    assert "ticket-urgency" not in (
        judge_only[0]["evaluatorName"] + judge_only[0]["annotation"]["name"]
    )
    # A binding of another judge, or a missing one, is rejected.
    result = await gql_client.execute(
        query,
        variables={
            "input": {
                "previews": [
                    {
                        "evaluator": {"decisionEvaluatorId": evaluator["id"]},
                        "context": {},
                        "inputMapping": {"literalMapping": {}, "pathMapping": {}},
                        "datasetEvaluatorId": str(GlobalID("DatasetEvaluator", "999")),
                    }
                ]
            }
        },
    )
    assert result.errors and "not found" in result.errors[0].message


async def test_frozen_decision_evaluators_survive_binding_deletion_and_experiment_cleanup(
    gql_client: AsyncGraphQLClient, empty_dataset: None, db: DbSessionFactory
) -> None:
    from sqlalchemy import insert, select

    from phoenix.server.api.helpers.decision_evaluator_snapshots import (
        freeze_dataset_decision_evaluators,
    )

    _, evaluator = await saved_evaluator(gql_client)
    binding_id = await bind(gql_client, evaluator, name="ticket-urgency")
    binding_row_id = int(GlobalID.from_id(binding_id).node_id)
    async with db() as session:
        dataset_version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=1, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=1,
                dataset_version_id=dataset_version_id,
                name="exp",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        await session.execute(
            insert(models.ExperimentJob).values(id=experiment_id, type="PROMPT", status="STOPPED")
        )
        await session.execute(
            insert(models.ExperimentDatasetEvaluator).values(
                experiment_id=experiment_id, dataset_evaluator_id=binding_row_id
            )
        )
        await freeze_dataset_decision_evaluators(session, experiment_id)
        binding_project_id = await session.scalar(
            select(models.DatasetEvaluators.project_id).where(
                models.DatasetEvaluators.id == binding_row_id
            )
        )
        # Simulate what the runner does on resume after the binding and its project vanished:
        # a fallback project recorded only in the snapshot.
        fallback = models.Project(
            name="dataset-evaluator-fallback",
            description=(
                f"Traces for dataset evaluator: ticket-urgency on dataset: experiment "
                f"{experiment_id}"
            ),
        )
        session.add(fallback)
        await session.flush()
        job = await session.get(models.ExperimentJob, experiment_id)
        assert job is not None
        job.decision_evaluator_snapshots = [
            {**job.decision_evaluator_snapshots[0], "project_id": fallback.id}
        ]
        fallback_id = fallback.id
    assert binding_project_id is not None
    result = await gql_client.execute(
        "mutation($input:DeleteDatasetEvaluatorsInput!){deleteDatasetEvaluators(input:$input){query{__typename}}}",
        variables={"input": {"datasetEvaluatorIds": [binding_id]}},
    )
    assert result.data and not result.errors, result.errors

    job_id = str(GlobalID("ExperimentJob", str(experiment_id)))
    result = await gql_client.execute(
        """query($id: ID!) { node(id:$id) { ... on ExperimentJob {
          datasetEvaluators { edges { node { id } } }
          frozenDecisionEvaluators { name datasetEvaluatorId annotationNames
            definition { name projectionPolicy { questions { name } } } }
        } } }""",
        variables={"id": job_id},
    )
    assert result.data and not result.errors, result.errors
    job_data = result.data["node"]
    assert job_data["datasetEvaluators"]["edges"] == []
    [frozen] = job_data["frozenDecisionEvaluators"]
    assert frozen["name"] == "ticket-urgency"
    assert frozen["datasetEvaluatorId"] == binding_id
    assert frozen["definition"]["name"] == "ticket-urgency"
    assert frozen["annotationNames"] == ["urgent", "team"]

    result = await gql_client.execute(
        "mutation($ids: [ID!]!){deleteExperiments(input:{experimentIds:$ids}){experiments{id}}}",
        variables={"ids": [str(GlobalID("Experiment", str(experiment_id)))]},
    )
    assert result.data and not result.errors, result.errors
    async with db() as session:
        assert await session.get(models.Project, fallback_id) is None


async def test_typed_projection_variants_and_frozen_definition(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    empty_dataset: None,
) -> None:
    from phoenix.db.types.evaluators import InputMapping
    from phoenix.server.api.helpers.decision_evaluators import freeze_decision_evaluator

    version = version_input()
    version["questions"].append(
        {
            "scale": {
                "name": "quality",
                "instructions": "Rate quality",
                "levels": [{"label": "low"}, {"label": "high"}],
            }
        }
    )
    decision = await create(gql_client, version=version)
    result = await gql_client.execute(
        CREATE_EVALUATOR,
        variables={
            "input": {
                "name": "typed-judge",
                "decisionVersionId": decision["version"]["id"],
                "projectionPolicy": {
                    "questions": [
                        {
                            "predicate": {
                                "name": "urgent",
                                "threshold": 0.75,
                                "optimizationDirection": "MAXIMIZE",
                            }
                        },
                        {
                            "choice": {
                                "name": "team",
                                "scores": [
                                    {"choice": "billing", "score": 1},
                                    {"choice": "technical", "score": 0},
                                ],
                                "optimizationDirection": "MINIMIZE",
                            }
                        },
                        {"scale": {"name": "quality", "includeLabel": True}},
                    ]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    evaluator = result.data["createDecisionEvaluator"]["evaluator"]
    policy = evaluator["projectionPolicy"]
    # Declared order, not the order sent or the stored map's key order.
    expected_policy: dict[str, Any] = {
        "questions": [
            {
                "__typename": "DecisionPredicateProjection",
                "name": "urgent",
                "threshold": 0.75,
                "optimizationDirection": "MAXIMIZE",
            },
            {
                "__typename": "DecisionChoiceProjection",
                "name": "team",
                "scores": [{"choice": "billing", "score": 1}, {"choice": "technical", "score": 0}],
                "optimizationDirection": "MINIMIZE",
            },
            {
                "__typename": "DecisionScaleProjection",
                "name": "quality",
                "includeLabel": True,
                "optimizationDirection": "NONE",
            },
        ],
    }
    assert policy == expected_policy
    async with db() as session:
        record = await session.get(
            models.DecisionEvaluator, int(GlobalID.from_id(evaluator["id"]).node_id)
        )
        assert record is not None
        definition = freeze_decision_evaluator(record)
        experiment = models.Experiment(
            dataset_id=1, dataset_version_id=1, name="typed-frozen", repetitions=1, metadata_={}
        )
        session.add(experiment)
        await session.flush()
        session.add(
            models.ExperimentEvaluatorTask(
                id=experiment.id,
                evaluator_kind="DECISION",
                name=Identifier("typed-judge"),
                definition=definition,
                input_mapping=InputMapping(
                    literal_mapping={}, path_mapping={"ticket": "input.ticket"}
                ),
                output_configs=record.output_configs,
            )
        )
    result = await gql_client.execute(
        """
      query($id: ID!) { node(id:$id) { ... on ExperimentJob { taskConfig {
        ... on EvaluatorTaskConfig { definition { ... on InlineDecisionEvaluatorDefinition {
          projectionPolicy { questions { __typename name optimizationDirection
            ... on DecisionPredicateProjection { threshold }
            ... on DecisionChoiceProjection { scores { choice score } }
            ... on DecisionScaleProjection { includeLabel }
          } }
        } } }
      } } } }
    """,
        variables={"id": str(GlobalID("ExperimentJob", str(experiment.id)))},
    )
    assert result.data and not result.errors, result.errors
    assert result.data["node"]["taskConfig"]["definition"]["projectionPolicy"] == policy


@pytest.mark.parametrize(
    "policy, message",
    [
        pytest.param(
            {"questions": [{"predicate": {"name": "urgent"}}, {"predicate": {"name": "urgent"}}]},
            "Duplicate projection question 'urgent'",
            id="duplicate-question-names",
        ),
        pytest.param(
            {
                "questions": [
                    {
                        "choice": {
                            "name": "team",
                            "scores": [
                                {"choice": "billing", "score": 1},
                                {"choice": "billing", "score": 0},
                            ],
                        }
                    }
                ]
            },
            "Duplicate score for choice 'billing'",
            id="duplicate-choice-scores",
        ),
        pytest.param(
            {"questions": [{}]},
            "must specify exactly one key",
            id="empty-projection",
        ),
        pytest.param(
            {"questions": [{"predicate": {"name": "urgent"}, "scale": {"name": "urgent"}}]},
            "must specify exactly one key",
            id="two-projection-keys",
        ),
    ],
)
async def test_invalid_typed_policy_does_not_create_an_evaluator(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    policy: dict[str, Any],
    message: str,
) -> None:
    from sqlalchemy import select

    decision = await create(gql_client)
    result = await gql_client.execute(
        CREATE_EVALUATOR,
        variables={
            "input": {
                "name": "invalid-policy",
                "decisionVersionId": decision["version"]["id"],
                "projectionPolicy": policy,
            }
        },
    )
    assert result.errors, result.data
    assert message in result.errors[0].message
    async with db() as session:
        assert (
            await session.scalar(
                select(models.DecisionEvaluator).where(
                    models.DecisionEvaluator.name == Identifier("invalid-policy")
                )
            )
            is None
        )


async def test_binding_policy_patch_preserves_omission_and_null_restores_inheritance(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    result = await gql_client.execute(
        """
      mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{
        id decisionProjectionPolicy { questions { name ... on DecisionPredicateProjection { threshold } } }
      }}}
    """,
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "judge",
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket"}},
                "projectionPolicy": {
                    "questions": [{"predicate": {"name": "urgent", "threshold": 0.6}}]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    binding = result.data["createDatasetDecisionEvaluator"]["evaluator"]
    assert binding["decisionProjectionPolicy"] == {
        "questions": [{"name": "urgent", "threshold": 0.6}]
    }
    patch = """
      mutation($input:UpdateDatasetDecisionEvaluatorInput!){updateDatasetDecisionEvaluator(input:$input){evaluator{
        decisionProjectionPolicy { questions { name ... on DecisionPredicateProjection { threshold } } }
        evaluator { ... on DecisionEvaluator { projectionPolicy { questions { name ... on DecisionPredicateProjection { threshold } } } } }
      }}}
    """
    result = await gql_client.execute(
        patch, variables={"input": {"datasetEvaluatorId": binding["id"], "description": "changed"}}
    )
    assert result.data and not result.errors, result.errors
    assert (
        result.data["updateDatasetDecisionEvaluator"]["evaluator"]["decisionProjectionPolicy"]
        == binding["decisionProjectionPolicy"]
    )
    result = await gql_client.execute(
        patch, variables={"input": {"datasetEvaluatorId": binding["id"], "projectionPolicy": None}}
    )
    assert result.data and not result.errors, result.errors
    patched = result.data["updateDatasetDecisionEvaluator"]["evaluator"]
    assert patched["decisionProjectionPolicy"] is None
    inherited = {
        question["name"]: question
        for question in patched["evaluator"]["projectionPolicy"]["questions"]
    }
    assert inherited["urgent"]["threshold"] == 0.8


async def test_binding_override_replaces_only_the_questions_it_names(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    decision = await create(gql_client)
    result = await gql_client.execute(
        CREATE_EVALUATOR,
        variables={
            "input": {
                "name": "scored-judge",
                "decisionVersionId": decision["version"]["id"],
                "projectionPolicy": {
                    "questions": [
                        {"predicate": {"name": "urgent", "threshold": 0.8}},
                        {
                            "choice": {
                                "name": "team",
                                "scores": [
                                    {"choice": "technical", "score": 0},
                                    {"choice": "billing", "score": 1},
                                ],
                            }
                        },
                    ]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    evaluator = result.data["createDecisionEvaluator"]["evaluator"]
    # Choice scores come back in the choices' declared order.
    team = next(q for q in evaluator["projectionPolicy"]["questions"] if q["name"] == "team")
    assert team["scores"] == [
        {"choice": "billing", "score": 1},
        {"choice": "technical", "score": 0},
    ]
    result = await gql_client.execute(
        """
      mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{
        outputConfigs { ... on CategoricalAnnotationConfig { name values { label score } } }
      }}}
    """,
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "judge",
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket"}},
                "projectionPolicy": {
                    "questions": [{"predicate": {"name": "urgent", "threshold": 0.6}}]
                },
            }
        },
    )
    assert result.data and not result.errors, result.errors
    configs = result.data["createDatasetDecisionEvaluator"]["evaluator"]["outputConfigs"]
    # The override names only `urgent`, so `team` keeps the judge's scores.
    assert {
        "name": "team",
        "values": [{"label": "billing", "score": 1}, {"label": "technical", "score": 0}],
    } in configs


PATCH_EVALUATOR = """
mutation ($input: PatchDecisionEvaluatorInput!) {
  patchDecisionEvaluator(input: $input) { evaluator {
    name decisionVersion { id }
    projectionPolicy { questions { name ... on DecisionPredicateProjection { threshold } } }
  } }
}
"""


async def test_patch_decision_evaluator(gql_client: AsyncGraphQLClient) -> None:
    decision, evaluator = await saved_evaluator(gql_client)

    async def patch(**fields: Any) -> Any:
        return await gql_client.execute(
            PATCH_EVALUATOR, variables={"input": {"evaluatorId": evaluator["id"], **fields}}
        )

    def threshold(patched: Any) -> float:
        questions = patched.data["patchDecisionEvaluator"]["evaluator"]["projectionPolicy"][
            "questions"
        ]
        return float(next(q["threshold"] for q in questions if q["name"] == "urgent"))

    result = await patch(
        projectionPolicy={"questions": [{"predicate": {"name": "urgent", "threshold": 0.3}}]}
    )
    assert result.data and not result.errors, result.errors
    assert threshold(result) == 0.3
    result = await patch(name="renamed-judge")
    assert result.data and not result.errors, result.errors
    assert threshold(result) == 0.3, "omitting the policy keeps it"
    result = await patch(projectionPolicy=None)
    assert result.errors and "cannot be null" in result.errors[0].message
    other = await create(gql_client, name="other-decision")
    result = await patch(decisionVersionId=other["version"]["id"])
    assert result.errors and "its own decision" in result.errors[0].message
    result = await patch(
        projectionPolicy={"questions": [{"predicate": {"name": "urgent", "threshold": 1.5}}]}
    )
    assert result.errors
    message = result.errors[0].message
    assert "question 'urgent'" in message and "threshold" in message
    assert "pydantic" not in message and "PredicateProjection" not in message


async def test_reordering_bound_questions_is_compatible(
    gql_client: AsyncGraphQLClient, empty_dataset: None
) -> None:
    decision, evaluator = await saved_evaluator(gql_client)
    binding = await gql_client.execute(
        "mutation($input:CreateDatasetDecisionEvaluatorInput!){createDatasetDecisionEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": evaluator["id"],
                "name": "judge",
                "inputMapping": {"literalMapping": {}, "pathMapping": {"ticket": "input.ticket"}},
            }
        },
    )
    assert binding.data and not binding.errors, binding.errors
    questions = version_input()["questions"]
    questions[1]["choice"]["choices"].reverse()
    result = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {
                "decisionId": decision["id"],
                "version": version_input(questions=questions[::-1]),
                "tags": [{"name": evaluator["decisionVersionTag"]["name"]}],
            }
        },
    )
    assert result.data and not result.errors, result.errors


async def test_update_dataset_decision_evaluator_rejects_other_bindings(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    empty_dataset: None,
    synced_builtin_evaluators: None,
) -> None:
    from sqlalchemy import select

    async with db() as session:
        builtin_id = await session.scalar(select(models.BuiltinEvaluator.id).limit(1))
    result = await gql_client.execute(
        "mutation($input:CreateDatasetBuiltinEvaluatorInput!){createDatasetBuiltinEvaluator(input:$input){evaluator{id}}}",
        variables={
            "input": {
                "datasetId": str(GlobalID("Dataset", "1")),
                "evaluatorId": str(GlobalID("BuiltInEvaluator", str(builtin_id))),
                "name": "builtin",
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
            }
        },
    )
    assert result.data and not result.errors, result.errors
    update = "mutation($input:UpdateDatasetDecisionEvaluatorInput!){updateDatasetDecisionEvaluator(input:$input){evaluator{id}}}"
    result = await gql_client.execute(
        update,
        variables={
            "input": {
                "datasetEvaluatorId": result.data["createDatasetBuiltinEvaluator"]["evaluator"][
                    "id"
                ],
                "description": "x",
            }
        },
    )
    assert result.errors and "not a decision evaluator" in result.errors[0].message
    result = await gql_client.execute(
        update,
        variables={
            "input": {
                "datasetEvaluatorId": str(GlobalID("DatasetEvaluator", "999")),
                "description": "x",
            }
        },
    )
    assert result.errors and "not found" in result.errors[0].message


async def test_repin_to_compatible_new_version_of_the_same_decision(
    gql_client: AsyncGraphQLClient,
) -> None:
    decision, evaluator = await saved_evaluator(gql_client)
    result = await gql_client.execute(
        CREATE_VERSION,
        variables={"input": {"decisionId": decision["id"], "version": version_input()}},
    )
    assert result.data and not result.errors, result.errors
    new_version_id = result.data["createDecisionVersion"]["version"]["id"]
    assert new_version_id != decision["version"]["id"]
    result = await gql_client.execute(
        PATCH_EVALUATOR,
        variables={"input": {"evaluatorId": evaluator["id"], "decisionVersionId": new_version_id}},
    )
    assert result.data and not result.errors, result.errors
    patched = result.data["patchDecisionEvaluator"]["evaluator"]
    assert patched["decisionVersion"]["id"] == new_version_id
    assert patched["decisionVersion"]["id"] != evaluator["decisionVersion"]["id"]


async def test_delete_unbound_decision_evaluator_removes_its_owned_tag(
    gql_client: AsyncGraphQLClient, db: DbSessionFactory
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    result = await gql_client.execute(
        "mutation($input:DeleteDecisionEvaluatorInput!){deleteDecisionEvaluator(input:$input){query{__typename}}}",
        variables={"input": {"evaluatorId": evaluator["id"]}},
    )
    assert result.data and not result.errors, result.errors
    async with db() as session:
        assert (
            await session.get(models.Evaluator, int(GlobalID.from_id(evaluator["id"]).node_id))
            is None
        )
        assert (
            await session.get(
                models.DecisionVersionTag,
                int(GlobalID.from_id(evaluator["decisionVersionTag"]["id"]).node_id),
            )
            is None
        )
