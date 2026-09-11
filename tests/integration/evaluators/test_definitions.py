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
    assert client.patch(route, json={"type": "llm", "description": "wrong kind"}).status_code == 422
    source = "def evaluate(output):\n    return {'score': 0.5}"
    response = client.post(f"{route}/versions", json={"source_code": source})
    assert response.status_code == 201, response.text
    version_id = response.json()["data"]["evaluator_version_id"]
    response = client.post(f"{route}/versions", json={"source_code": source})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["was_created"] is False
    assert response.json()["data"]["evaluator_version_id"] == version_id
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
    prompt_body = before["prompt_version"]
    prompt_body["model_name"] = "gpt-4.1-mini"
    response = client.patch(
        route,
        json={
            "type": "llm",
            "prompt_version": prompt_body,
            "output_configs": before["output_configs"],
        },
    )
    assert response.status_code == 200, response.text
    after = response.json()["data"]
    assert after["prompt_version_id"] != before["prompt_version_id"]
    response = client.patch(route, json={"type": "llm", "prompt_version": prompt_body})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt_version_id"] == after["prompt_version_id"]
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
    assert result["node"]["evaluator"]["promptVersion"]["id"] == after["prompt_version_id"]


def test_llm_definition_missing_custom_provider(
    client: httpx.Client, llm_definition: dict[str, Any]
) -> None:
    route = f"v1/evaluators/{llm_definition['evaluator']['id']}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    before = response.json()["data"]
    provider_id = str(GlobalID("GenerativeModelCustomProvider", str(2**31 - 1)))
    response = client.patch(
        route,
        json={
            "type": "llm",
            "name": f"renamed-{token_hex(8)}",
            "prompt_version": {**before["prompt_version"], "custom_provider_id": provider_id},
        },
    )
    assert response.status_code == 404, response.text
    assert response.text == f"Custom provider not found: {provider_id}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    assert response.json()["data"] == before


def test_llm_definition_reuses_regular_prompt_version(
    client: httpx.Client, llm_definition: dict[str, Any]
) -> None:
    route = f"v1/evaluators/{llm_definition['evaluator']['id']}"
    response = client.get(route)
    assert response.status_code == 200, response.text
    prompt_body = response.json()["data"]["prompt_version"]
    prompt_body["description"] = "Shared evaluation prompt"
    response = client.post(
        "v1/prompts",
        json={"prompt": {"name": f"shared-prompt-{token_hex(8)}"}, "version": prompt_body},
    )
    assert response.status_code == 200, response.text
    prompt_data = response.json()["data"]
    prompt_version_id = prompt_data.pop("id")
    response = client.patch(route, json={"type": "llm", "prompt_version_id": prompt_version_id})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt_version_id"] == prompt_version_id
    assert response.json()["data"]["prompt_version"] == prompt_data

    response = client.patch(route, json={"type": "llm", "prompt_version": prompt_data})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt_version_id"] == prompt_version_id

    for invalid_prompt in (
        {
            **prompt_data,
            "template_type": "STR",
            "template": {"type": "string", "template": "Judge"},
        },
        {**prompt_data, "unexpected": True},
    ):
        response = client.patch(route, json={"type": "llm", "prompt_version": invalid_prompt})
        assert response.status_code == 422, response.text
    response = client.get(route)
    assert response.json()["data"]["prompt_version_id"] == prompt_version_id
    assert response.json()["data"]["prompt_version"] == prompt_data
