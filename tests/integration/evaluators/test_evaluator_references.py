"""A definition outlives every binding that references it until it is deleted itself."""

from typing import Any

import httpx

from ._helpers import _binding_body, _code_definition, _create_dataset_evaluator


def test_definition_survives_dataset_and_project_references(
    client: httpx.Client, dataset_id: str, sandbox_id: str, project: dict[str, Any]
) -> None:
    definition = _code_definition(client, sandbox_id)
    definition_route = f"v1/evaluators/{definition['id']}"
    first = _create_dataset_evaluator(client, dataset_id, _binding_body(definition["id"]))
    second = _create_dataset_evaluator(client, dataset_id, _binding_body(definition["id"]))
    assert second["output_configs"] is None
    response = client.post(
        f"v1/projects/{project['id']}/evaluators",
        json={
            "name": "also-online",
            "evaluator_id": definition["id"],
            "sampling_rate": 1,
            "evaluation_target": "SPAN",
            "enabled": False,
        },
    )
    assert response.status_code == 201, response.text
    online = response.json()["data"]
    assert client.delete(definition_route).status_code == 409
    for binding in [first, second]:
        assert client.delete(f"v1/dataset_evaluators/{binding['id']}").status_code == 204
    assert client.delete(f"v1/project_evaluators/{online['id']}").status_code == 204
    assert client.get(definition_route).status_code == 200
    assert client.delete(definition_route).status_code == 204
    assert client.get(definition_route).status_code == 404
