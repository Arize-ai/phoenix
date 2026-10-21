"""REST lifecycle and binding contracts for native decision judges."""

import httpx
from strawberry.relay import GlobalID

from phoenix.db.types.decision_evaluators import (
    ChoiceScoring,
    DecisionScoringPolicy,
    PredicateScoring,
)
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_saved_decision_mutations import create


async def test_decision_evaluator_and_binding_lifecycle(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    decision = await create(gql_client)
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "decision",
            "name": "native-judge",
            "decision_version_id": decision["version"]["id"],
        },
    )
    assert response.status_code == 201, response.text
    evaluator = response.json()["data"]
    evaluator_id = evaluator["id"]
    assert evaluator["type"] == "decision"
    assert evaluator["decision_version_id"] == decision["version"]["id"]
    assert [config["name"] for config in evaluator["output_configs"]] == ["urgent", "team"]
    response = await httpx_client.get("v1/evaluators", params={"type": "decision"})
    assert response.status_code == 200
    assert [value["id"] for value in response.json()["data"]] == [evaluator_id]
    route = f"v1/evaluators/{evaluator_id}"
    response = await httpx_client.patch(
        route,
        json={
            "type": "decision",
            "scoring_policy": {"questions": {"urgent": {"type": "predicate", "threshold": 0.75}}},
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["scoring_policy"]["questions"]["urgent"]["threshold"] == 0.75
    dataset_route = f"v1/datasets/{GlobalID('Dataset', '1')}/evaluators"
    response = await httpx_client.post(
        dataset_route,
        json={
            "name": "judge",
            "evaluator_id": evaluator_id,
            "input_mapping": {"literal_mapping": {}, "path_mapping": {"ticket": "input.ticket"}},
        },
    )
    assert response.status_code == 201, response.text
    binding = response.json()["data"]
    assert binding["evaluator_type"] == "decision"
    # Scoring is the judge's own; a binding has no policy to set.
    assert "scoring_policy" not in binding
    response = await httpx_client.patch(
        f"v1/dataset_evaluators/{binding['id']}", json={"scoring_policy": None}
    )
    assert response.status_code == 422, response.text
    assert (await httpx_client.delete(route)).status_code == 409
    response = await httpx_client.delete(
        dataset_route, params={"dataset_evaluator_id": binding["id"]}
    )
    assert response.status_code == 204, response.text
    assert (await httpx_client.get(route)).status_code == 200
    assert (await httpx_client.delete(route)).status_code == 204
    assert (await httpx_client.get(route)).status_code == 404


async def test_unbound_judge_can_be_deleted(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
) -> None:
    decision = await create(gql_client)
    body = {
        "type": "decision",
        "name": "native-judge",
        "decision_version_id": decision["version"]["id"],
    }
    response = await httpx_client.post("v1/evaluators", json=body)
    assert response.status_code == 201, response.text
    evaluator_id = response.json()["data"]["id"]
    assert (await httpx_client.post("v1/evaluators", json=body)).status_code == 409
    assert (await httpx_client.delete(f"v1/evaluators/{evaluator_id}")).status_code == 204


async def test_default_scoring_policy_keeps_discriminators_in_responses(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    decision = await create(gql_client)
    expected = DecisionScoringPolicy(
        questions={
            "urgent": PredicateScoring(type="predicate"),
            "team": ChoiceScoring(type="choice"),
        }
    )
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "decision",
            "name": "native-judge",
            "decision_version_id": decision["version"]["id"],
        },
    )
    assert response.status_code == 201, response.text
    evaluator_id = response.json()["data"]["id"]
    response = await httpx_client.get(f"v1/evaluators/{evaluator_id}")
    assert response.status_code == 200, response.text
    policy = response.json()["data"]["scoring_policy"]
    assert {name: question["type"] for name, question in policy["questions"].items()} == {
        "urgent": "predicate",
        "team": "choice",
    }
    assert DecisionScoringPolicy.model_validate(policy) == expected


async def test_binding_output_configs_must_match_the_derived_outputs(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    decision = await create(gql_client)
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "decision",
            "name": "native-judge",
            "decision_version_id": decision["version"]["id"],
        },
    )
    assert response.status_code == 201, response.text
    response = await httpx_client.post(
        f"v1/datasets/{GlobalID('Dataset', '1')}/evaluators",
        json={
            "name": "judge",
            "evaluator_id": response.json()["data"]["id"],
            "input_mapping": {"literal_mapping": {}, "path_mapping": {"ticket": "input.ticket"}},
            "output_configs": [
                {
                    "type": "CONTINUOUS",
                    "name": "urgent",
                    "optimization_direction": "NONE",
                    "lower_bound": 0,
                    "upper_bound": 5,
                }
            ],
        },
    )
    assert response.status_code == 422, response.text
    assert "Decision outputs are derived from the questions and scoring policy" in response.text
