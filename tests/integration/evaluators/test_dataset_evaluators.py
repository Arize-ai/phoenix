"""Dataset binding deletion removes trace projects while retaining shared definitions."""

import httpx

from .._helpers import _AppInfo, _httpx_client
from ._helpers import (
    _binding_body,
    _code_definition,
    _correctness_configs,
    _create_dataset_evaluator,
    _graphql,
    _judge_prompt_version,
    _llm_definition,
    _mapping,
    _pin,
)


def test_code_binding_overrides_and_cross_api_readback(
    client: httpx.Client, dataset_id: str, sandbox_id: str, _app: _AppInfo
) -> None:
    definition = _code_definition(client, sandbox_id)
    body = _binding_body(definition["id"])
    response = client.post(
        f"v1/datasets/{dataset_id}/evaluators", json={**body, "output_configs": []}
    )
    assert response.status_code == 422, response.text
    binding = _create_dataset_evaluator(client, dataset_id, body)
    route = f"v1/dataset_evaluators/{binding['id']}"
    definition_route = f"v1/evaluators/{definition['id']}"
    assert binding["dataset_id"] == dataset_id
    assert binding["evaluator_id"] == definition["id"]
    assert binding["evaluator_type"] == "code"
    assert binding["description"] is None
    assert binding["output_configs"] is None
    before = client.get(definition_route).json()["data"]
    override = [{"type": "CONTINUOUS", "name": "score", "optimization_direction": "MINIMIZE"}]
    response = client.patch(
        route,
        json={"name": "dataset-only", "description": "local", "output_configs": override},
    )
    assert response.status_code == 200, response.text
    overridden = response.json()["data"]
    assert [config["optimization_direction"] for config in overridden["output_configs"]] == [
        "MINIMIZE"
    ]
    assert overridden["input_mapping"] == body["input_mapping"]
    assert client.get(definition_route).json()["data"] == before
    for invalid in [
        {},
        {"input_mapping": None},
        {"dataset_id": dataset_id},
        {"evaluator_id": definition["id"]},
        {"enabled": True},
        {"output_configs": []},
    ]:
        response = client.patch(route, json=invalid)
        assert response.status_code == 422, response.text
        assert response.headers["content-type"] == "application/problem+json"
    assert client.get(route).json()["data"] == overridden
    response = client.patch(route, json={"description": None, "output_configs": None})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["output_configs"] is None
    assert response.json()["data"]["name"] == "dataset-only"
    response = client.patch(
        definition_route, json={"type": "code", "description": "updated shared description"}
    )
    assert response.status_code == 200, response.text
    result = _graphql(
        _app,
        """
        query($id: ID!) {
          node(id: $id) { ... on DatasetEvaluator {
            name description inputMapping { literalMapping pathMapping }
            outputConfigs { ... on ContinuousAnnotationConfig { name } }
          } }
        }
        """,
        {"id": binding["id"]},
    )["node"]
    assert result == {
        "name": "dataset-only",
        "description": "updated shared description",
        "inputMapping": {"literalMapping": {"output": "dataset value"}, "pathMapping": {}},
        "outputConfigs": [{"name": "score"}],
    }
    assert client.delete(route).status_code == 204
    assert client.delete(route).status_code == 204
    assert client.get(route).status_code == 404
    assert client.get(definition_route).status_code == 200
    assert client.get(f"v1/projects/{binding['trace_project_id']}").status_code == 404
    assert client.delete(definition_route).status_code == 204


def test_dataset_pagination_conflicts_and_atomic_bulk_delete(
    client: httpx.Client, dataset_id: str, sandbox_id: str, _app: _AppInfo
) -> None:
    definition = _code_definition(client, sandbox_id)
    body = _binding_body(definition["id"])
    first = _create_dataset_evaluator(client, dataset_id, body)
    collection = f"v1/datasets/{dataset_id}/evaluators"
    response = client.post(collection, json=body)
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "already_exists"
    assert response.json()["existing_id"] == first["id"]
    second = _create_dataset_evaluator(client, dataset_id, {**body, "name": "second-binding"})
    response = client.patch(f"v1/dataset_evaluators/{second['id']}", json={"name": first["name"]})
    assert response.status_code == 409, response.text
    dataset_name = _graphql(
        _app, "query($id: ID!) { node(id: $id) { ... on Dataset { name } } }", {"id": dataset_id}
    )["node"]["name"]
    first_page = client.get(f"v1/datasets/{dataset_name}/evaluators", params={"limit": 1}).json()
    assert first_page["data"] == [second]
    second_page = client.get(
        collection, params={"limit": 1, "cursor": first_page["next_cursor"]}
    ).json()
    assert second_page["data"] == [first]
    assert second_page["next_cursor"] is None
    assert client.get(collection, params={"cursor": "bad-id"}).status_code == 422
    assert client.get(collection, params={"limit": 0}).status_code == 422
    response = client.delete(collection)
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "validation_error"
    ids = [row["id"] for row in [first, second]]
    for bad_id in ["bad-id", definition["id"]]:
        response = client.delete(collection, params={"dataset_evaluator_id": ids + [bad_id]})
        assert response.status_code == 422, response.text
        assert len(client.get(collection).json()["data"]) == 2
    assert client.delete(collection, params={"dataset_evaluator_id": ids}).status_code == 204
    assert client.delete(collection, params={"dataset_evaluator_id": ids}).status_code == 204
    assert client.get(collection).json()["data"] == []
    for binding in (first, second):
        assert client.get(f"v1/projects/{binding['trace_project_id']}").status_code == 404
    assert client.get(f"v1/evaluators/{definition['id']}").status_code == 200
    assert client.delete(f"v1/evaluators/{definition['id']}").status_code == 204


def test_builtin_binding_and_read_only_definition(
    client: httpx.Client, dataset_id: str, _app: _AppInfo
) -> None:
    builtin = _graphql(_app, "query { builtInEvaluators { id name } }", {})["builtInEvaluators"][0]
    definition_route = f"v1/evaluators/{builtin['id']}"
    response = client.get(definition_route)
    assert response.status_code == 200, response.text
    definition = response.json()["data"]
    assert definition["type"] == "builtin"
    assert definition["name"] == builtin["name"]
    body = {"name": "built-in-binding", "input_mapping": _mapping(), "evaluator_id": builtin["id"]}
    binding = _create_dataset_evaluator(client, dataset_id, body)
    assert binding["evaluator_type"] == "builtin"
    assert binding["output_configs"] is None
    response = client.post(f"v1/datasets/{dataset_id}/evaluators", json=body)
    assert response.status_code == 409, response.text
    assert response.json()["existing_id"] == binding["id"]
    route = f"v1/dataset_evaluators/{binding['id']}"
    assert client.patch(route, json={"output_configs": []}).status_code == 422
    override = [{"type": "CONTINUOUS", "name": "local", "optimization_direction": "MINIMIZE"}]
    response = client.patch(route, json={"output_configs": override, "description": "local"})
    assert response.status_code == 200, response.text
    assert [config["name"] for config in response.json()["data"]["output_configs"]] == ["local"]
    assert client.patch(route, json={"output_configs": None}).status_code == 200
    assert client.get(definition_route).json()["data"] == definition
    assert (
        client.patch(
            definition_route, json={"type": "code", "description": "disallowed"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{definition_route}/versions", json={"source_code": "def evaluate(): return 1"}
        ).status_code
        == 422
    )
    assert client.delete(definition_route).status_code == 422
    assert client.delete(route).status_code == 204
    assert client.get(definition_route).json()["data"] == definition


def test_llm_binding_overrides_across_shared_bindings(
    client: httpx.Client, dataset_id: str, _app: _AppInfo
) -> None:
    dataset_name = _graphql(
        _app,
        "query($id: ID!) { node(id: $id) { ... on Dataset { name } } }",
        {"id": dataset_id},
    )["node"]["name"]
    definition = _llm_definition(client)
    definition_route = f"v1/evaluators/{definition['id']}"
    binding = _create_dataset_evaluator(client, dataset_id, _binding_body(definition["id"]))
    other = _create_dataset_evaluator(client, dataset_id, _binding_body(definition["id"]))
    assert binding["evaluator_id"] == other["evaluator_id"] == definition["id"]
    assert binding["evaluator_type"] == "llm"
    route = f"v1/dataset_evaluators/{binding['id']}"
    # A description that no longer matches the prompt's tool is the same override
    # incompatibility a definition edit rejects with, not a plain validation error.
    incompatible = client.patch(route, json={"description": "inconsistent"})
    assert incompatible.status_code == 409, incompatible.text
    assert incompatible.json()["reason"] == "incompatible_override"
    assert binding["id"] in incompatible.json()["dataset_evaluator_ids"]
    assert client.get(route).json()["data"] == binding
    # An empty override list fails schema validation before that check ever runs.
    assert client.patch(route, json={"output_configs": []}).status_code == 422
    assert client.get(route).json()["data"] == binding
    override = _correctness_configs()
    override[0]["values"][0]["score"] = 0.75
    response = client.patch(route, json={"output_configs": override})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["output_configs"][0]["values"][0]["score"] == 0.75
    assert client.get(definition_route).json()["data"] == definition

    relabeled = _judge_prompt_version(client, label_values=("pass", "fail"))
    relabel_patch = {
        "type": "llm",
        "prompt": _pin(relabeled),
        "output_configs": _correctness_configs(("pass", "fail")),
    }
    response = client.patch(definition_route, json=relabel_patch)
    assert response.status_code == 409, response.text
    problem = response.json()
    assert problem["reason"] == "incompatible_override"
    assert problem["dataset_evaluator_ids"] == [binding["id"]]
    assert f"binding '{binding['name']}' on dataset '{dataset_name}'" in problem["detail"]
    assert client.get(definition_route).json()["data"] == definition
    response = client.patch(route, json={"output_configs": None})
    assert response.status_code == 200, response.text
    response = client.patch(definition_route, json=relabel_patch)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt"]["resolved_prompt_version_id"] == relabeled
    result = _graphql(
        _app,
        """
        query($id: ID!) { node(id: $id) { ... on DatasetEvaluator {
          evaluator { ... on LLMEvaluator { promptVersion { id } } }
        } } }
        """,
        {"id": other["id"]},
    )["node"]
    assert result["evaluator"]["promptVersion"]["id"] == relabeled

    collection = f"v1/datasets/{dataset_id}/evaluators"
    params = {"dataset_evaluator_id": [binding["id"], other["id"]]}
    assert client.delete(collection, params=params).status_code == 204
    for row in (binding, other):
        assert client.get(f"v1/projects/{row['trace_project_id']}").status_code == 404
    assert client.get(definition_route).status_code == 200
    assert client.get(f"v1/prompt_versions/{relabeled}").status_code == 200
    assert client.delete(definition_route).status_code == 204
    assert client.get(f"v1/prompt_versions/{relabeled}").status_code == 200


def test_dataset_endpoint_errors_and_auth(
    client: httpx.Client, dataset_id: str, _app: _AppInfo
) -> None:
    collection = f"v1/datasets/{dataset_id}/evaluators"
    response = client.post(collection, json={"name": "invalid"})
    assert response.status_code == 422, response.text
    fields = {error["field"] for error in response.json()["errors"]}
    assert {"body.evaluator_id", "body.input_mapping"} <= fields
    response = client.get("v1/datasets/missing/evaluators")
    assert response.status_code == 404, response.text
    assert response.json()["code"] == "not_found"
    response = client.post(
        collection,
        json={"name": "invalid", "input_mapping": _mapping(), "evaluator_id": dataset_id},
    )
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "invalid_argument"
    with _httpx_client(_app) as anonymous:
        for method, path in [
            ("GET", "datasets/missing/evaluators"),
            ("POST", "datasets/missing/evaluators"),
            ("DELETE", "datasets/missing/evaluators"),
            ("GET", "dataset_evaluators/missing"),
            ("PATCH", "dataset_evaluators/missing"),
            ("DELETE", "dataset_evaluators/missing"),
        ]:
            response = anonymous.request(method, f"v1/{path}")
            assert response.status_code == 401, response.text
