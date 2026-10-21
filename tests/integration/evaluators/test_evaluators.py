"""Project binding deletion removes trace projects while retaining shared definitions."""

from secrets import token_hex
from typing import Any

import httpx

from .._helpers import _AppInfo, _gql, _httpx_client
from ._helpers import (
    _code_definition,
    _judge_prompt_version,
    _llm_definition,
    _mapping,
    _pin,
)


def _bind(
    client: httpx.Client, project: dict[str, Any], evaluator_id: str, **changes: Any
) -> dict[str, Any]:
    body = {
        "name": f"binding-{token_hex(8)}",
        "evaluator_id": evaluator_id,
        "evaluation_target": "SPAN",
        "sampling_rate": 0.5,
        "enabled": False,
        **changes,
    }
    response = client.post(f"v1/projects/{project['name']}/evaluators", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


def test_code_lifecycle_and_shared_definition(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str, _app: _AppInfo
) -> None:
    definition = _code_definition(client, sandbox_id)
    evaluator = f"v1/evaluators/{definition['id']}"
    first = _bind(client, project, definition["id"])
    assert first["evaluator_type"] == "code"
    assert first["evaluator_id"] == definition["id"]
    assert first["evaluation_delay_seconds"] == 0
    item = f"v1/project_evaluators/{first['id']}"
    second = _bind(
        client,
        project,
        definition["id"],
        name="attached",
        evaluation_target="SESSION",
        sampling_rate=1,
        evaluation_delay_seconds=30,
    )
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
    assert client.delete(evaluator).status_code == 409
    assert client.delete(item).status_code == 204
    assert client.delete(item).status_code == 204
    assert client.delete(second_item).status_code == 204
    assert client.get(evaluator).status_code == 200
    assert client.get(f"v1/projects/{first['trace_project_id']}").status_code == 404
    assert client.delete(evaluator).status_code == 204


def test_pagination_and_bulk_delete(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str
) -> None:
    definition = _code_definition(client, sandbox_id)
    bindings = [_bind(client, project, definition["id"]) for _ in range(3)]
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
    response = client.delete(collection)
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "validation_error"
    response = client.delete(collection, params={"project_evaluator_id": ids + ["bad-id"]})
    assert response.status_code == 422, response.text
    assert len(client.get(collection).json()["data"]) == 3
    assert client.delete(collection, params={"project_evaluator_id": ids}).status_code == 204
    assert client.delete(collection, params={"project_evaluator_id": ids}).status_code == 204
    assert client.get(collection).json()["data"] == []
    for binding in bindings:
        assert client.get(f"v1/projects/{binding['trace_project_id']}").status_code == 404
    assert client.get(f"v1/evaluators/{definition['id']}").status_code == 200


def test_binding_validation_and_conflicts(
    client: httpx.Client, project: dict[str, Any], sandbox_id: str, _app: _AppInfo
) -> None:
    definition = _code_definition(client, sandbox_id)
    first = _bind(client, project, definition["id"])
    second = _bind(client, project, definition["id"])
    response = client.post(
        f"v1/projects/{project['name']}/evaluators",
        json={
            "name": first["name"],
            "evaluator_id": definition["id"],
            "evaluation_target": "SPAN",
            "sampling_rate": 1,
        },
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "already_exists"
    assert response.json()["existing_id"] == first["id"]
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
    other = _code_definition(client, sandbox_id)
    response = client.patch(
        f"v1/evaluators/{definition['id']}", json={"type": "code", "name": other["name"]}
    )
    assert response.status_code == 409, response.text
    assert client.get("v1/project_evaluators/bad-id").status_code == 422
    builtin = _gql(_app, _app.admin_secret, query="query { builtInEvaluators { id } }")[0]
    for evaluator_id in (builtin["data"]["builtInEvaluators"][0]["id"], project["id"]):
        response = client.post(
            f"v1/projects/{project['name']}/evaluators",
            json={
                "name": "unsupported",
                "evaluator_id": evaluator_id,
                "evaluation_target": "SPAN",
                "sampling_rate": 1,
            },
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_argument"
    response = client.post(
        f"v1/projects/{first['trace_project_id']}/evaluators",
        json={
            "name": "recursive",
            "evaluator_id": definition["id"],
            "evaluation_target": "SPAN",
            "sampling_rate": 1,
        },
    )
    assert response.status_code == 422, response.text


def test_llm_binding_and_definition_edits(
    client: httpx.Client, project: dict[str, Any], _app: _AppInfo
) -> None:
    definition = _llm_definition(client)
    evaluator = f"v1/evaluators/{definition['id']}"
    binding = _bind(
        client, project, definition["id"], evaluation_target="SESSION", sampling_rate=0.5
    )
    assert binding["evaluator_type"] == "llm"
    assert binding["input_mapping"] is None
    item = f"v1/project_evaluators/{binding['id']}"
    response = client.patch(item, json={"input_mapping": _mapping()})
    assert response.status_code == 200, response.text
    response = client.patch(item, json={"input_mapping": None})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["input_mapping"] is None
    response = client.patch(item, json={"evaluation_delay_seconds": 30})
    assert response.status_code == 200, response.text
    response = client.patch(item, json={"evaluation_delay_seconds": None})
    assert response.status_code == 200, response.text
    assert (
        response.json()["data"]["evaluation_delay_seconds"] == binding["evaluation_delay_seconds"]
    )
    new_version_id = _judge_prompt_version(client)
    response = client.patch(evaluator, json={"type": "llm", "prompt": _pin(new_version_id)})
    assert response.status_code == 200, response.text
    updated = response.json()["data"]
    assert updated["prompt"]["resolved_prompt_version_id"] == new_version_id
    response = client.patch(evaluator, json={"type": "llm", "description": "new description"})
    assert response.status_code == 422, response.text
    assert client.get(evaluator).json()["data"]["description"] == "correctness"
    response = client.patch(evaluator, json={"type": "llm", "name": f"renamed-{token_hex(8)}"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt"] == updated["prompt"]
    result, _ = _gql(
        _app,
        _app.admin_secret,
        query="""
        query($id: ID!) { node(id: $id) { ... on LLMEvaluator { promptVersion { id } } } }
    """,
        variables={"id": definition["id"]},
    )
    assert result["data"]["node"]["promptVersion"]["id"] == new_version_id
    assert client.delete(item).status_code == 204
    assert client.get(evaluator).status_code == 200
    assert client.get(f"v1/projects/{binding['trace_project_id']}").status_code == 404
    assert client.delete(evaluator).status_code == 204
    assert client.get(f"v1/prompt_versions/{new_version_id}").status_code == 200


def test_session_evaluation_delay_bounds(
    client: httpx.Client, project: dict[str, Any], _app: _AppInfo
) -> None:
    definition = _llm_definition(client)
    collection = f"v1/projects/{project['id']}/evaluators"
    body = {
        "name": f"session-{token_hex(8)}",
        "evaluator_id": definition["id"],
        "evaluation_target": "SESSION",
        "sampling_rate": 0.5,
        "enabled": False,
    }
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
            ("DELETE", "projects/missing/evaluators"),
            ("GET", "project_evaluators/missing"),
            ("PATCH", "project_evaluators/missing"),
            ("DELETE", "project_evaluators/missing"),
            ("GET", "evaluators"),
            ("POST", "evaluators"),
            ("GET", "evaluators/missing/versions"),
            ("GET", "evaluators/missing"),
            ("PATCH", "evaluators/missing"),
            ("DELETE", "evaluators/missing"),
            ("POST", "evaluators/missing/versions"),
            ("GET", "sandbox_configs"),
        ]:
            response = client.request(method, f"v1/{path}")
            assert response.status_code == 401, response.text
