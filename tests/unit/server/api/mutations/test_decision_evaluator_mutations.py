"""Saved decision evaluators, their owned version pins, and dataset previews."""

from typing import Any
from unittest.mock import AsyncMock

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
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
    id name kind projectionPolicy inputSchema decisionVersion { id }
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
                    "schema_version": 1,
                    "questions": {"urgent": {"type": "predicate", "threshold": 0.8}},
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
    assert refused["annotation"]["explanation"] == "Decision model refused this question"
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
    assert result.errors and "incompatible" in result.errors[0].message
    result = await gql_client.execute(
        "mutation($input:DeleteDecisionEvaluatorInput!){deleteDecisionEvaluator(input:$input){query{__typename}}}",
        variables={"input": {"evaluatorId": evaluator["id"]}},
    )
    assert result.errors and "still bound" in result.errors[0].message


async def test_detaching_last_binding_releases_owned_pin(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
    db: DbSessionFactory,
) -> None:
    _, evaluator = await saved_evaluator(gql_client)
    result = await gql_client.execute(
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
    assert result.data and not result.errors, result.errors
    binding_id = result.data["createDatasetDecisionEvaluator"]["evaluator"]["id"]
    result = await gql_client.execute(
        "mutation($input:DeleteDatasetEvaluatorsInput!){deleteDatasetEvaluators(input:$input){query{__typename}}}",
        variables={"input": {"datasetEvaluatorIds": [binding_id]}},
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
