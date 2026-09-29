"""REST evaluator lifecycle and cross-API compatibility tests."""

from secrets import token_hex
from typing import Any

import httpx

from .._helpers import _AppInfo, _gql, _httpx_client
from ._helpers import _llm_body, _mapping


def _create_code(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str, **changes: Any
) -> dict[str, Any]:
    body = {
        "name": f"code-{token_hex(8)}",
        "evaluation_target": "SPAN",
        "sampling_rate": 0.5,
        "enabled": False,
        "evaluator": {
            "type": "code",
            "source_code": "def evaluate(output):\n    return {'score': 1.0}",
            "language": "PYTHON",
            "sandbox_config_id": sandbox_id,
            "input_mapping": _mapping(),
            "output_configs": [
                {
                    "type": "CONTINUOUS",
                    "name": "score",
                    "optimization_direction": "MAXIMIZE",
                    "lower_bound": 0,
                    "upper_bound": 1,
                }
            ],
        },
        **changes,
    }
    response = client.post(f"v1/projects/{project['name']}/evaluators", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


def test_code_lifecycle_and_shared_definition(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str, _app: _AppInfo
) -> None:
    first = _create_code(client, project, sandbox_id)
    assert first["evaluator_type"] == "code"
    assert first["evaluation_delay_seconds"] == 0
    item = f"v1/project_evaluators/{first['id']}"
    evaluator = f"v1/evaluators/{first['evaluator_id']}"
    definition = client.get(evaluator).json()["data"]
    assert definition["type"] == "code"
    assert definition["id"] == first["evaluator_id"]
    assert definition["output_configs"][0]["upper_bound"] == 1
    assert definition["source_code"].startswith("def evaluate")
    response = client.post(
        f"v1/projects/{project['id']}/evaluators",
        json={
            "name": "attached",
            "evaluation_target": "SESSION",
            "sampling_rate": 1,
            "enabled": False,
            "evaluation_delay_seconds": 30,
            "evaluator": {"type": "reference", "evaluator_id": first["evaluator_id"]},
        },
    )
    assert response.status_code == 201, response.text
    second = response.json()["data"]
    assert second["evaluation_delay_seconds"] == 30
    second_item = f"v1/project_evaluators/{second['id']}"
    response = client.patch(
        item, json={"name": "binding-only", "enabled": True, "input_mapping": _mapping("override")}
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["sampling_rate"] == 0.5
    assert client.get(evaluator).json()["data"]["name"] == definition["name"]
    response = client.patch(item, json={"input_mapping": None})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["input_mapping"] is None
    response = client.patch(
        evaluator,
        json={"type": "code", "description": "shared", "input_mapping": _mapping("new default")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["description"] == "shared"
    assert client.get(second_item).json()["data"]["input_mapping"] is None
    result, _ = _gql(
        _app,
        _app.admin_secret,
        query="""
        query($id: ID!) { node(id: $id) { ... on ProjectEvaluator { name enabled evaluator { description } } } }
    """,
        variables={"id": first["id"]},
    )
    assert result["data"]["node"] == {
        "name": "binding-only",
        "enabled": True,
        "evaluator": {"description": "shared"},
    }
    source = "def evaluate(output):\n    return {'score': 0.5}"
    response = client.post(f"{evaluator}/versions", json={"source_code": source})
    assert response.status_code == 201, response.text
    version_id = response.json()["data"]["id"]
    response = client.post(f"{evaluator}/versions", json={"source_code": source})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["id"] == version_id
    assert response.json()["data"]["was_created"] is False
    assert client.delete(item).status_code == 204
    assert client.delete(item).status_code == 204
    assert client.get(evaluator).status_code == 200
    assert client.delete(second_item).status_code == 204
    assert client.get(evaluator).status_code == 404
    assert client.get(f"v1/projects/{first['trace_project_id']}").status_code == 404


def test_pagination_and_bulk_delete(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str
) -> None:
    bindings = [_create_code(client, project, sandbox_id) for _ in range(3)]
    collection = f"v1/projects/{project['id']}/evaluators"
    ids = []
    cursor = None
    for _ in range(3):
        response = client.get(
            collection, params={"limit": 1, **({"cursor": cursor} if cursor else {})}
        )
        assert response.status_code == 200, response.text
        page = response.json()
        ids.append(page["data"][0]["id"])
        cursor = page["next_cursor"]
    assert cursor is None
    assert set(ids) == {binding["id"] for binding in bindings}
    bulk = "v1/project_evaluators/delete"
    assert client.post(bulk, json={}).status_code == 422
    assert client.post(bulk, json={"project_evaluator_ids": []}).status_code == 422
    assert client.post(bulk, json={"project_evaluator_ids": ids + ["bad-id"]}).status_code == 422
    assert len(client.get(collection).json()["data"]) == 3
    assert client.post(bulk, json={"project_evaluator_ids": ids}).status_code == 204
    assert client.post(bulk, json={"project_evaluator_ids": ids}).status_code == 204
    assert client.get(collection).json()["data"] == []


def test_binding_validation_and_conflicts(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str
) -> None:
    first = _create_code(client, project, sandbox_id)
    second = _create_code(client, project, sandbox_id)
    item = f"v1/project_evaluators/{first['id']}"
    for patch in [
        {"name": second["name"]},
        {"filter_condition": "invalid !!!"},
        {"evaluation_delay_seconds": 30},
        {"evaluation_target": "SESSION"},
    ]:
        response = client.patch(item, json=patch)
        assert response.status_code == (409 if "name" in patch else 422), response.text
    assert client.get(item).json()["data"]["name"] == first["name"]
    response = client.patch(
        f"v1/evaluators/{first['evaluator_id']}", json={"type": "code", "name": second["name"]}
    )
    assert response.status_code == 409, response.text
    assert client.get("v1/project_evaluators/bad-id").status_code == 422
    trace_project = {"name": first["trace_project_id"]}
    response = client.post(
        f"v1/projects/{trace_project['name']}/evaluators",
        json={
            "name": "recursive",
            "evaluation_target": "SPAN",
            "sampling_rate": 1,
            "evaluator": {"type": "reference", "evaluator_id": first["evaluator_id"]},
        },
    )
    assert response.status_code == 422, response.text


def test_llm_creation_patch_and_prompt_retention(
    client: httpx.Client, project: dict[str, Any], _app: _AppInfo
) -> None:
    body = _llm_body()
    response = client.post(f"v1/projects/{project['id']}/evaluators", json=body)
    assert response.status_code == 201, response.text
    binding = response.json()["data"]
    item = f"v1/project_evaluators/{binding['id']}"
    evaluator = f"v1/evaluators/{binding['evaluator_id']}"
    definition = client.get(evaluator).json()["data"]
    assert definition["prompt_version"]["model_name"] == "gpt-4o-mini"
    assert client.patch(item, json={"input_mapping": None}).status_code == 422
    response = client.patch(item, json={"evaluation_delay_seconds": 30})
    assert response.status_code == 200, response.text
    response = client.patch(item, json={"evaluation_delay_seconds": None})
    assert response.status_code == 200, response.text
    assert (
        response.json()["data"]["evaluation_delay_seconds"] == binding["evaluation_delay_seconds"]
    )
    assert binding["evaluator_type"] == "llm"
    prompt = body["evaluator"]["prompt_version"]
    prompt["model_name"] = "gpt-4.1-mini"
    response = client.post(
        f"v1/prompts/{definition['prompt_id']}/versions", json={"version": prompt}
    )
    assert response.status_code == 201, response.text
    new_version_id = response.json()["data"]["id"]
    response = client.patch(evaluator, json={"type": "llm", "prompt_version": prompt})
    assert response.status_code == 422, response.text
    response = client.patch(evaluator, json={"type": "llm", "prompt_version_id": new_version_id})
    assert response.status_code == 200, response.text
    updated = response.json()["data"]
    assert updated["prompt_version"]["id"] == new_version_id
    assert updated["prompt_version"]["id"] != definition["prompt_version"]["id"]
    response = client.patch(evaluator, json={"type": "llm", "description": "new description"})
    assert response.status_code == 422, response.text
    assert client.get(evaluator).json()["data"]["description"] == "correctness"
    response = client.patch(evaluator, json={"type": "llm", "name": f"renamed-{token_hex(8)}"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt_version"]["id"] == updated["prompt_version"]["id"]
    result, _ = _gql(
        _app,
        _app.admin_secret,
        query="""
        query($id: ID!) { node(id: $id) { ... on LLMEvaluator { promptVersion { id } } } }
    """,
        variables={"id": binding["evaluator_id"]},
    )
    assert result["data"]["node"]["promptVersion"]["id"] == updated["prompt_version"]["id"]
    assert client.delete(item, params={"delete_associated_prompt": "false"}).status_code == 204
    assert client.get(evaluator).status_code == 404
    result, _ = _gql(
        _app,
        _app.admin_secret,
        query="query($id: ID!) { node(id: $id) { id } }",
        variables={"id": updated["prompt_version"]["id"]},
    )
    assert result["data"]["node"]["id"] == updated["prompt_version"]["id"]


def test_session_evaluation_delay_bounds(
    client: httpx.Client, project: dict[str, Any], _app: _AppInfo
) -> None:
    collection = f"v1/projects/{project['id']}/evaluators"
    body = _llm_body()
    for delay in (9, 2**31):
        response = client.post(collection, json={**body, "evaluation_delay_seconds": delay})
        assert response.status_code == 422, response.text
    assert client.get(collection).json()["data"] == []

    maximum_delay = 2**31 - 1
    response = client.post(collection, json={**body, "evaluation_delay_seconds": maximum_delay})
    assert response.status_code == 201, response.text
    binding = response.json()["data"]
    item = f"v1/project_evaluators/{binding['id']}"
    assert binding["evaluation_delay_seconds"] == maximum_delay
    for delay in (9, 2**31):
        response = client.patch(
            item, json={"name": f"renamed-{token_hex(8)}", "evaluation_delay_seconds": delay}
        )
        assert response.status_code == 422, response.text
    assert client.get(item).json()["data"] == binding

    for delay in (10, maximum_delay):
        response = client.patch(item, json={"evaluation_delay_seconds": delay})
        assert response.status_code == 200, response.text
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query="""
            query($id: ID!) {
              node(id: $id) { ... on ProjectEvaluator { evaluationDelaySeconds } }
            }
            """,
            variables={"id": binding["id"]},
        )
        assert not result.get("errors"), result
        assert result["data"]["node"]["evaluationDelaySeconds"] == delay


def test_unauthenticated_requests_are_rejected(_app: _AppInfo) -> None:
    with _httpx_client(_app) as client:
        for method, path in [
            ("GET", "projects/missing/evaluators"),
            ("POST", "projects/missing/evaluators"),
            ("GET", "project_evaluators/missing"),
            ("PATCH", "project_evaluators/missing"),
            ("DELETE", "project_evaluators/missing"),
            ("POST", "project_evaluators/delete"),
            ("GET", "evaluators"),
            ("GET", "evaluators/missing/versions"),
            ("GET", "evaluators/missing"),
            ("PATCH", "evaluators/missing"),
            ("POST", "evaluators/missing/versions"),
        ]:
            response = client.request(method, f"v1/{path}")
            assert response.status_code == 401, response.text
