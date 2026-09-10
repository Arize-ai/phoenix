"""Evaluator definition ownership across project and dataset bindings."""

from typing import Any

import httpx

from ._helpers import _mapping
from ._helpers import client as client
from ._helpers import sandbox_id as sandbox_id
from .test_dataset_evaluators import _code_body, _create
from .test_dataset_evaluators import dataset_id as dataset_id
from .test_definitions import definition_client as definition_client
from .test_definitions import definition_dataset as definition_dataset
from .test_evaluators import project as project


def test_definition_survives_dataset_and_project_references(
    client: httpx.Client, dataset_id: str, sandbox_id: str, project: dict[str, Any]
) -> None:
    first = _create(client, dataset_id, _code_body(sandbox_id))
    second = _create(
        client,
        dataset_id,
        {
            "name": "another-dataset-binding",
            "input_mapping": _mapping(),
            "evaluator": {"type": "reference", "evaluator_id": first["evaluator_id"]},
        },
    )
    assert second["output_configs"] is None
    response = client.post(
        f"v1/projects/{project['id']}/evaluators",
        json={
            "name": "also-online",
            "sampling_rate": 1,
            "evaluation_target": "SPAN",
            "enabled": False,
            "evaluator": {"type": "reference", "evaluator_id": first["evaluator_id"]},
        },
    )
    assert response.status_code == 201, response.text
    online = response.json()["data"]
    definition_route = f"v1/evaluators/{first['evaluator_id']}"
    for binding in [first, second]:
        assert (
            client.delete(f"v1/dataset_evaluators/{binding['dataset_evaluator_id']}").status_code
            == 204
        )
        assert client.get(definition_route).status_code == 200
    assert (
        client.delete(f"v1/project_evaluators/{online['project_evaluator_id']}").status_code == 204
    )
    assert client.get(definition_route).status_code == 404
