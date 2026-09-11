"""Shared evaluator definitions remain usable independently of project bindings."""

from collections.abc import Iterator
from secrets import token_hex
from typing import Any

import httpx
import pytest
from strawberry.relay import GlobalID

from .._helpers import _AppInfo, _httpx_client
from ._helpers import _graphql


@pytest.fixture
def code_definition(_app: _AppInfo, dataset_id: str) -> Iterator[dict[str, Any]]:
    config = _graphql(
        _app,
        """
        mutation($input: CreateSandboxConfigInput!) {
          createSandboxConfig(input: $input) { sandboxConfig { id } }
        }
    """,
        {"input": {"name": f"rest-{token_hex(8)}", "config": {"wasm": {"language": "PYTHON"}}}},
    )
    config_id = config["createSandboxConfig"]["sandboxConfig"]["id"]
    evaluator = _graphql(
        _app,
        """
        mutation($input: CreateCodeEvaluatorInput!) {
          createCodeEvaluator(input: $input) { evaluator { id name } }
        }
    """,
        {
            "input": {
                "name": f"definition-{token_hex(8)}",
                "language": "PYTHON",
                "sourceCode": "def evaluate(output):\n    return {'score': 1.0}",
                "sandboxConfigId": config_id,
                "inputMapping": {"literalMapping": {"output": "value"}, "pathMapping": {}},
                "outputConfigs": [
                    {"continuous": {"name": "score", "optimizationDirection": "MAXIMIZE"}}
                ],
            }
        },
    )["createCodeEvaluator"]["evaluator"]
    _graphql(
        _app,
        """
        mutation($input: CreateDatasetCodeEvaluatorInput!) {
          createDatasetCodeEvaluator(input: $input) { evaluator { id } }
        }
    """,
        {
            "input": {
                "datasetId": dataset_id,
                "evaluatorId": evaluator["id"],
                "name": f"binding-{token_hex(8)}",
                "inputMapping": {"literalMapping": {}, "pathMapping": {}},
            }
        },
    )
    try:
        yield evaluator
    finally:
        with _httpx_client(_app, _app.admin_secret) as client:
            client.delete(f"v1/datasets/{dataset_id}").raise_for_status()
        _graphql(
            _app,
            """
            mutation($input: DeleteSandboxConfigInput!) { deleteSandboxConfig(input: $input) { deletedId } }
        """,
            {"input": {"id": config_id}},
        )


def test_shared_code_definition(
    client: httpx.Client, code_definition: dict[str, Any], _app: _AppInfo
) -> None:
    route = f"v1/evaluators/{code_definition['id']}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    initial = response.json()["data"]
    assert initial["type"] == "code"
    response = client.patch(route, json={"type": "code", "description": "shared"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["source_code"] == initial["source_code"]
    assert client.patch(route, json={"type": "code", "language": "TYPESCRIPT"}).status_code == 422
    assert client.patch(route, json={"type": "code", "output_configs": []}).status_code == 422
    assert client.patch(route, json={"type": "llm", "description": "wrong kind"}).status_code == 422
    source = "def evaluate(output):\n    return {'score': 0.5}"
    response = client.post(f"{route}/versions", json={"source_code": source, "output_configs": []})
    assert response.status_code == 422, response.text
    response = client.post(f"{route}/versions", json={"source_code": source})
    assert response.status_code == 201, response.text
    created = response.json()["data"]
    version_id = created["id"]
    assert created["evaluator_id"] == code_definition["id"]
    response = client.post(f"{route}/versions", json={"source_code": source})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["was_created"] is False
    assert response.json()["data"]["id"] == version_id
    response = client.get(f"{route}/versions")
    assert response.status_code == 200, response.text
    versions = response.json()["data"]
    assert [version["id"] for version in versions][:1] == [version_id]
    assert versions[0]["source_code"] == source and versions[-1]["source_code"] != source
    assert client.get(route).json()["data"]["current_version_id"] == version_id
    response = client.get(f"{route}/versions", params={"limit": 1})
    assert response.status_code == 200, response.text
    assert len(response.json()["data"]) == 1 and response.json()["next_cursor"]
    listed = client.get("v1/evaluators", params={"type": "code"})
    assert listed.status_code == 200, listed.text
    assert code_definition["id"] in {item["id"] for item in listed.json()["data"]}
    assert all(item["type"] == "code" for item in listed.json()["data"])
    result = _graphql(
        _app,
        """
        query($id: ID!) { node(id: $id) { ... on CodeEvaluator { description currentVersion { sourceCode } } } }
    """,
        {"id": code_definition["id"]},
    )
    assert result["node"] == {"description": "shared", "currentVersion": {"sourceCode": source}}


def test_definition_errors(client: httpx.Client) -> None:
    assert client.get("v1/evaluators/bad-id").status_code == 422
    assert client.patch("v1/evaluators/bad-id", json={"type": "code"}).status_code == 422
    assert client.get("v1/evaluators", params={"cursor": "bad-cursor"}).status_code == 422
    assert client.get("v1/evaluators", params={"type": "widget"}).status_code == 422
    assert client.get("v1/evaluators").status_code == 200


@pytest.fixture
def llm_definition(dataset_id: str, _app: _AppInfo) -> dict[str, Any]:
    prompt = {
        "templateFormat": "MUSTACHE",
        "template": {
            "messages": [{"role": "USER", "content": [{"text": {"text": "Judge {{output}}"}}]}]
        },
        "modelProvider": "OPENAI",
        "modelName": "gpt-4o-mini",
        "invocationParameters": {"openai": {"temperature": 0}},
        "tools": {
            "tools": [
                {
                    "function": {
                        "name": "correctness",
                        "description": "correctness",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "label": {
                                    "type": "string",
                                    "description": "correctness",
                                    "enum": ["correct", "incorrect"],
                                }
                            },
                            "required": ["label"],
                        },
                    }
                }
            ],
            "toolChoice": {"functionName": "correctness"},
        },
    }
    binding: dict[str, Any] = _graphql(
        _app,
        """
        mutation($input: CreateDatasetLLMEvaluatorInput!) {
          createDatasetLlmEvaluator(input: $input) { evaluator { id evaluator { id } } }
        }
    """,
        {
            "input": {
                "datasetId": dataset_id,
                "name": f"llm-{token_hex(8)}",
                "description": "correctness",
                "promptVersion": prompt,
                "inputMapping": {"literalMapping": {"output": "value"}, "pathMapping": {}},
                "outputConfigs": [
                    {
                        "categorical": {
                            "name": "correctness",
                            "optimizationDirection": "MAXIMIZE",
                            "values": [
                                {"label": "correct", "score": 1},
                                {"label": "incorrect", "score": 0},
                            ],
                        }
                    }
                ],
            }
        },
    )["createDatasetLlmEvaluator"]["evaluator"]
    return binding


def test_llm_definition_from_dataset(
    client: httpx.Client, llm_definition: dict[str, Any], _app: _AppInfo
) -> None:
    route = f"v1/evaluators/{llm_definition['evaluator']['id']}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    before = response.json()["data"]
    assert before["type"] == "llm"
    prompt_body = {key: value for key, value in before["prompt_version"].items() if key != "id"}
    prompt_body["model_name"] = "gpt-4.1-mini"
    response = client.post(
        f"v1/prompts/{before['prompt_id']}/versions", json={"version": prompt_body}
    )
    assert response.status_code == 201, response.text
    new_version_id = response.json()["data"]["id"]
    assert new_version_id != before["prompt_version"]["id"]
    response = client.patch(
        route,
        json={
            "type": "llm",
            "prompt_version_id": new_version_id,
            "output_configs": before["output_configs"],
        },
    )
    assert response.status_code == 200, response.text
    after = response.json()["data"]
    assert after["prompt_version"]["id"] == new_version_id
    assert after["prompt_id"] == before["prompt_id"]
    response = client.patch(route, json={"type": "llm", "prompt_version_id": new_version_id})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt_version"]["id"] == new_version_id
    response = client.patch(route, json={"type": "llm", "prompt_version": before["prompt_version"]})
    assert response.status_code == 422, response.text
    response = client.patch(route, json={"type": "llm", "description": "inconsistent"})
    assert response.status_code == 422
    assert client.get(route).json()["data"]["description"] == "correctness"
    result = _graphql(
        _app,
        """
        query($id: ID!) { node(id: $id) { ... on DatasetEvaluator { evaluator { ... on LLMEvaluator { promptVersion { id } } } } } }
    """,
        {"id": llm_definition["id"]},
    )
    assert result["node"]["evaluator"]["promptVersion"]["id"] == after["prompt_version"]["id"]


def test_llm_definition_missing_custom_provider(
    client: httpx.Client, llm_definition: dict[str, Any]
) -> None:
    route = f"v1/evaluators/{llm_definition['evaluator']['id']}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    before = response.json()["data"]
    provider_id = str(GlobalID("GenerativeModelCustomProvider", str(2**31 - 1)))
    content = {key: value for key, value in before["prompt_version"].items() if key != "id"}
    response = client.post(
        f"v1/prompts/{before['prompt_id']}/versions",
        json={"version": {**content, "custom_provider_id": provider_id}},
    )
    assert response.status_code == 404, response.text
    response = client.get(route)
    assert response.status_code == 200, response.text
    assert response.json()["data"] == before


def test_llm_definition_reuses_regular_prompt_version(
    client: httpx.Client, llm_definition: dict[str, Any]
) -> None:
    route = f"v1/evaluators/{llm_definition['evaluator']['id']}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    original_prompt_id = response.json()["data"]["prompt_id"]
    prompt_body = {
        key: value
        for key, value in response.json()["data"]["prompt_version"].items()
        if key != "id"
    }
    prompt_body["description"] = "Shared evaluation prompt"
    response = client.post(
        "v1/prompts",
        json={"prompt": {"name": f"shared-prompt-{token_hex(8)}"}, "version": prompt_body},
    )
    assert response.status_code == 200, response.text
    prompt_data = response.json()["data"]
    prompt_version_id = prompt_data["id"]
    response = client.patch(route, json={"type": "llm", "prompt_version_id": prompt_version_id})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt_version"] == prompt_data
    assert response.json()["data"]["prompt_id"] != original_prompt_id
    response = client.get(route)
    assert response.json()["data"]["prompt_version"] == prompt_data


@pytest.fixture
def sandbox_config_id(_app: _AppInfo) -> Iterator[str]:
    config = _graphql(
        _app,
        """
        mutation($input: CreateSandboxConfigInput!) {
          createSandboxConfig(input: $input) { sandboxConfig { id } }
        }
        """,
        {"input": {"name": f"rest-{token_hex(8)}", "config": {"wasm": {"language": "PYTHON"}}}},
    )
    config_id: str = config["createSandboxConfig"]["sandboxConfig"]["id"]
    try:
        yield config_id
    finally:
        _graphql(
            _app,
            """
            mutation($input: DeleteSandboxConfigInput!) { deleteSandboxConfig(input: $input) { deletedId } }
            """,
            {"input": {"id": config_id}},
        )


def _code_body(name: str, sandbox_config_id: str) -> dict[str, Any]:
    return {
        "type": "code",
        "name": name,
        "source_code": "def evaluate(output):\n    return {'score': 1.0}",
        "language": "PYTHON",
        "sandbox_config_id": sandbox_config_id,
        "input_mapping": {"literal_mapping": {"output": "value"}, "path_mapping": {}},
        "output_configs": [
            {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}
        ],
    }


def test_standalone_code_definition_lifecycle(client: httpx.Client, sandbox_config_id: str) -> None:
    name = f"standalone-{token_hex(8)}"
    response = client.post("v1/evaluators", json=_code_body(name, sandbox_config_id))
    assert response.status_code == 201, response.text
    created = response.json()["data"]
    assert created["type"] == "code" and created["name"] == name
    assert created["current_version_id"] and created["source_code"].startswith("def evaluate")
    route = f"v1/evaluators/{created['id']}"
    assert client.post("v1/evaluators", json=_code_body(name, sandbox_config_id)).status_code == 409
    without_outputs = _code_body(f"{name}-outputs", sandbox_config_id)
    without_outputs["output_configs"] = []
    assert client.post("v1/evaluators", json=without_outputs).status_code == 422
    del without_outputs["output_configs"]
    assert client.post("v1/evaluators", json=without_outputs).status_code == 422
    assert client.get(route).json()["data"] == created

    listed = client.get("v1/evaluators", params={"name": name}).json()["data"]
    assert [item["id"] for item in listed] == [created["id"]]
    assert client.get("v1/evaluators", params={"name": f"{name}-missing"}).json()["data"] == []

    stale = created["current_version_id"]
    source = "def evaluate(output):\n    return {'score': 0.5}"
    response = client.post(
        f"{route}/versions",
        json={
            "source_code": source,
            "expected_current_version_id": stale,
            "output_configs": [
                {
                    "type": "CONTINUOUS",
                    "name": "score",
                    "optimization_direction": "MAXIMIZE",
                    "lower_bound": 0,
                    "upper_bound": 1,
                }
            ],
            "description": "deployed together",
        },
    )
    assert response.status_code == 201, response.text
    deployed = response.json()["data"]
    definition = client.get(route).json()["data"]
    assert definition["current_version_id"] == deployed["id"]
    assert definition["description"] == "deployed together"
    assert definition["output_configs"][0]["name"] == "score"

    response = client.post(
        f"{route}/versions",
        json={
            "source_code": "def evaluate(output):\n    return 0",
            "expected_current_version_id": stale,
        },
    )
    assert response.status_code == 409, response.text
    assert deployed["id"] in response.text
    assert client.get(route).json()["data"]["current_version_id"] == deployed["id"]

    response = client.post(
        f"{route}/versions", json={"source_code": source, "description": "same code"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["was_created"] is False
    assert client.get(route).json()["data"]["description"] == "same code"

    assert client.delete(route).status_code == 204
    assert client.get(route).status_code == 404
    assert client.delete(route).status_code == 204


def test_bound_code_definition_cannot_be_deleted(
    client: httpx.Client, code_definition: dict[str, Any]
) -> None:
    route = f"v1/evaluators/{code_definition['id']}"
    response = client.delete(route)
    assert response.status_code == 409, response.text
    assert "dataset" in response.text
    assert client.get(route).status_code == 200


def test_delete_rejects_non_code_definitions(
    client: httpx.Client, llm_definition: dict[str, Any]
) -> None:
    assert client.delete(f"v1/evaluators/{llm_definition['evaluator']['id']}").status_code == 422
    assert client.delete("v1/evaluators/bad-id").status_code == 422
