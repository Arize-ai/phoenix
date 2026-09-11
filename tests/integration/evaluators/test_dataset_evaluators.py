"""Dataset binding CRUD, shared-definition ownership, and GraphQL compatibility."""

import httpx
import pytest

from .._helpers import _AppInfo, _httpx_client
from ._helpers import _create_dataset_evaluator, _dataset_code_body, _graphql, _llm_body, _mapping


def test_code_binding_overrides_and_cross_api_readback(
    client: httpx.Client, dataset_id: str, sandbox_id: str, _app: _AppInfo
) -> None:
    body = _dataset_code_body(sandbox_id)
    binding = _create_dataset_evaluator(client, dataset_id, body)
    route = f"v1/dataset_evaluators/{binding['dataset_evaluator_id']}"
    definition_route = f"v1/evaluators/{binding['evaluator_id']}"
    assert binding["dataset_id"] == dataset_id
    assert binding["evaluator_kind"] == "CODE"
    assert binding["description"] is None
    assert binding["output_configs"] is None
    before = client.get(definition_route).json()["data"]
    response = client.patch(
        route,
        json={"name": "dataset-only", "description": "local", "output_configs": []},
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["output_configs"] == []
    assert response.json()["data"]["input_mapping"] == body["input_mapping"]
    assert client.get(definition_route).json()["data"] == before
    for invalid in [
        {},
        {"input_mapping": None},
        {"dataset_id": dataset_id},
        {"evaluator_id": binding["evaluator_id"]},
        {"enabled": True},
    ]:
        assert client.patch(route, json=invalid).status_code == 422
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
        {"id": binding["dataset_evaluator_id"]},
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
    assert client.get(definition_route).status_code == 404
    assert client.get(f"v1/projects/{binding['trace_project_id']}").status_code == 404


def test_dataset_pagination_conflicts_and_atomic_bulk_delete(
    client: httpx.Client, dataset_id: str, sandbox_id: str, _app: _AppInfo
) -> None:
    body = _dataset_code_body(sandbox_id)
    first = _create_dataset_evaluator(client, dataset_id, body)
    collection = f"v1/datasets/{dataset_id}/evaluators"
    response = client.post(collection, json=body)
    assert response.status_code == 409, response.text
    reference = {
        "name": body["name"],
        "input_mapping": _mapping(),
        "evaluator": {"type": "reference", "evaluator_id": first["evaluator_id"]},
    }
    assert client.post(collection, json=reference).status_code == 409
    second = _create_dataset_evaluator(client, dataset_id, {**reference, "name": "second-binding"})
    assert (
        client.patch(
            f"v1/dataset_evaluators/{second['dataset_evaluator_id']}", json={"name": first["name"]}
        ).status_code
        == 409
    )
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
    assert client.delete("v1/dataset_evaluators").status_code == 422
    params = [("dataset_evaluator_ids", row["dataset_evaluator_id"]) for row in [first, second]]
    for bad_id in ["bad-id", first["evaluator_id"]]:
        assert (
            client.delete(
                "v1/dataset_evaluators", params=params + [("dataset_evaluator_ids", bad_id)]
            ).status_code
            == 422
        )
        assert len(client.get(collection).json()["data"]) == 2
    assert client.delete("v1/dataset_evaluators", params=params).status_code == 204
    assert client.delete("v1/dataset_evaluators", params=params).status_code == 204
    assert client.get(collection).json()["data"] == []
    assert client.get(f"v1/evaluators/{first['evaluator_id']}").status_code == 404


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
    body = {
        "name": "built-in-binding",
        "input_mapping": _mapping(),
        "evaluator": {"type": "reference", "evaluator_id": builtin["id"]},
    }
    binding = _create_dataset_evaluator(client, dataset_id, body)
    assert binding["evaluator_kind"] == "BUILTIN"
    assert binding["output_configs"] is None
    assert client.post(f"v1/datasets/{dataset_id}/evaluators", json=body).status_code == 409
    route = f"v1/dataset_evaluators/{binding['dataset_evaluator_id']}"
    response = client.patch(route, json={"output_configs": [], "description": "local"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["output_configs"] == []
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
    assert client.delete(route).status_code == 204
    assert client.get(definition_route).json()["data"] == definition


@pytest.mark.parametrize("retain_prompt", [False, True])
def test_llm_binding_overrides_and_prompt_cleanup(
    client: httpx.Client, dataset_id: str, _app: _AppInfo, retain_prompt: bool
) -> None:
    project_body = _llm_body()
    body = {key: project_body[key] for key in ["name", "input_mapping", "evaluator"]}
    binding = _create_dataset_evaluator(client, dataset_id, body)
    route = f"v1/dataset_evaluators/{binding['dataset_evaluator_id']}"
    definition_route = f"v1/evaluators/{binding['evaluator_id']}"
    definition = client.get(definition_route).json()["data"]
    assert binding["output_configs"] is None
    for invalid in [{"description": "inconsistent"}, {"output_configs": []}]:
        assert client.patch(route, json=invalid).status_code == 422
        assert client.get(route).json()["data"] == binding
    override = body["evaluator"]["output_configs"]
    override[0]["values"][0]["score"] = 0.75
    response = client.patch(route, json={"output_configs": override})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["output_configs"][0]["values"][0]["score"] == 0.75
    assert client.get(definition_route).json()["data"] == definition
    response = client.patch(route, json={"output_configs": None})
    assert response.status_code == 200, response.text
    prompt = definition["prompt_version"]
    prompt["model_name"] = "gpt-4.1-mini"
    response = client.patch(definition_route, json={"type": "llm", "prompt_version": prompt})
    assert response.status_code == 200, response.text
    updated = response.json()["data"]
    result = _graphql(
        _app,
        """
        query($id: ID!) { node(id: $id) { ... on DatasetEvaluator {
          evaluator { ... on LLMEvaluator { promptVersion { id } } }
          outputConfigs { ... on CategoricalAnnotationConfig { values { label score } } }
        } } }
        """,
        {"id": binding["dataset_evaluator_id"]},
    )["node"]
    assert result["evaluator"]["promptVersion"]["id"] == updated["prompt_version_id"]
    assert result["outputConfigs"][0]["values"][0]["score"] == 1
    prompt_id = _graphql(
        _app,
        "query($id: ID!) { node(id: $id) { ... on LLMEvaluator { prompt { id } } } }",
        {"id": binding["evaluator_id"]},
    )["node"]["prompt"]["id"]
    response = client.delete(
        route, params={"delete_associated_prompt": str(not retain_prompt).lower()}
    )
    assert response.status_code == 204, response.text
    assert client.get(definition_route).status_code == 404
    assert client.get(f"v1/prompts/{prompt_id}/latest").status_code == (
        200 if retain_prompt else 404
    )
    if retain_prompt:
        client.delete(f"v1/prompts/{prompt_id}").raise_for_status()


def test_dataset_endpoint_errors_and_auth(
    client: httpx.Client, dataset_id: str, _app: _AppInfo
) -> None:
    collection = f"v1/datasets/{dataset_id}/evaluators"
    assert client.post(collection, json={"name": "invalid"}).status_code == 422
    assert client.get("v1/datasets/missing/evaluators").status_code == 404
    assert (
        client.post(
            collection,
            json={
                "name": "invalid",
                "input_mapping": _mapping(),
                "evaluator": {"type": "reference", "evaluator_id": dataset_id},
            },
        ).status_code
        == 422
    )
    with _httpx_client(_app) as anonymous:
        for method, path in [
            ("GET", "datasets/missing/evaluators"),
            ("POST", "datasets/missing/evaluators"),
            ("GET", "dataset_evaluators/missing"),
            ("PATCH", "dataset_evaluators/missing"),
            ("DELETE", "dataset_evaluators/missing"),
            ("DELETE", "dataset_evaluators"),
        ]:
            response = anonymous.request(method, f"v1/{path}")
            assert response.status_code == 401, response.text
