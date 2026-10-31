"""REST lifecycle and binding contracts for native decision judges."""

from typing import Any

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.decision_evaluators import (
    ChoiceScoring,
    DecisionScoringPolicy,
    PredicateScoring,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient
from tests.unit.server.api.mutations.test_saved_decision_mutations import (
    CREATE_VERSION,
    DELETE_TAG,
    SET_TAG,
    create,
    version_input,
)


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
            "decision": {
                "selector": {"type": "version", "decision_version_id": decision["version"]["id"]}
            },
        },
    )
    assert response.status_code == 201, response.text
    evaluator = response.json()["data"]
    evaluator_id = evaluator["id"]
    assert evaluator["type"] == "decision"
    assert evaluator["decision"]["selector"] == {
        "type": "version",
        "decision_version_id": decision["version"]["id"],
    }
    assert evaluator["decision"]["resolved_decision_version_id"] == decision["version"]["id"]
    assert evaluator["decision"]["decision_id"] == decision["id"]
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
        "decision": {
            "selector": {"type": "version", "decision_version_id": decision["version"]["id"]}
        },
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
            "decision": {
                "selector": {"type": "version", "decision_version_id": decision["version"]["id"]}
            },
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
            "decision": {
                "selector": {"type": "version", "decision_version_id": decision["version"]["id"]}
            },
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


async def _judge_and_newer_version(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    scoring_policy: dict[str, Any],
    questions: list[dict[str, Any]],
) -> tuple[str, models.DecisionVersionTag, str]:
    """A judge on a decision's first version, and a newer version with other questions.

    Returns the judge's id, the tag it runs through, and the newer version's id.
    """
    decision = await create(gql_client)
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "decision",
            "name": "native-judge",
            "decision": {
                "selector": {"type": "version", "decision_version_id": decision["version"]["id"]}
            },
            "scoring_policy": scoring_policy,
        },
    )
    assert response.status_code == 201, response.text
    evaluator_id = response.json()["data"]["id"]
    result = await gql_client.execute(
        CREATE_VERSION,
        variables={
            "input": {"decisionId": decision["id"], "version": version_input(questions=questions)}
        },
    )
    assert result.data and not result.errors, result.errors
    async with db() as session:
        evaluator = await session.get(
            models.DecisionEvaluator, int(GlobalID.from_id(evaluator_id).node_id)
        )
        assert evaluator is not None and evaluator.decision_version_tag_id is not None
        tag = await session.get(models.DecisionVersionTag, evaluator.decision_version_tag_id)
        assert tag is not None
    return evaluator_id, tag, result.data["createDecisionVersion"]["version"]["id"]


async def test_deleting_the_tag_leaves_the_judge_on_the_newest_version(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    evaluator_id, tag, newest_id = await _judge_and_newer_version(
        httpx_client,
        gql_client,
        db,
        scoring_policy={"questions": {}},
        questions=[{"predicate": {"name": "urgent", "instructions": "Is it urgent today?"}}],
    )
    result = await gql_client.execute(
        DELETE_TAG,
        variables={
            "input": {"decisionVersionTagId": str(GlobalID("DecisionVersionTag", str(tag.id)))}
        },
    )
    assert result.data and not result.errors, result.errors

    response = await httpx_client.get(f"v1/evaluators/{evaluator_id}")
    assert response.status_code == 200, response.text
    decision = response.json()["data"]["decision"]
    assert decision["selector"] == {"type": "latest"}
    assert decision["resolved_decision_version_id"] == newest_id


async def test_a_moved_tag_adapts_the_judges_scoring_to_the_new_questions(
    httpx_client: httpx.AsyncClient,
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    evaluator_id, tag, newer_id = await _judge_and_newer_version(
        httpx_client,
        gql_client,
        db,
        scoring_policy={
            "questions": {
                "urgent": {"type": "predicate", "threshold": 0.9},
                "team": {"type": "choice", "scores": {"billing": 1, "technical": 0}},
            }
        },
        questions=[
            {
                "choice": {
                    "name": "team",
                    "instructions": "Which team owns it?",
                    "choices": [{"value": "technical"}, {"value": "sales"}],
                }
            },
            {"predicate": {"name": "spam", "instructions": "Is it spam?"}},
        ],
    )
    result = await gql_client.execute(
        SET_TAG,
        variables={"input": {"decisionVersionId": newer_id, "name": tag.name.root}},
    )
    assert result.data and not result.errors, result.errors

    response = await httpx_client.get(f"v1/evaluators/{evaluator_id}")
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["decision"]["resolved_decision_version_id"] == newer_id
    assert DecisionScoringPolicy.model_validate(data["scoring_policy"]) == DecisionScoringPolicy(
        questions={
            "team": ChoiceScoring(type="choice", scores={"technical": 0}),
            "spam": PredicateScoring(type="predicate"),
        }
    )
    assert [config["name"] for config in data["output_configs"]] == ["team", "spam"]
