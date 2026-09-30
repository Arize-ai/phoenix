"""Request builders and API helpers for evaluator integration tests."""

from secrets import token_hex
from typing import Any

import httpx

from .._helpers import _AppInfo, _gql


def _mapping(value: str = "value") -> dict[str, Any]:
    return {"literal_mapping": {"output": value}, "path_mapping": {}}


def _llm_body() -> dict[str, Any]:
    return {
        "name": f"llm-{token_hex(8)}",
        "evaluation_target": "SESSION",
        "sampling_rate": 0.5,
        "input_mapping": _mapping(),
        "enabled": False,
        "evaluator": {
            "type": "llm",
            "description": "correctness",
            "output_configs": [
                {
                    "type": "CATEGORICAL",
                    "name": "correctness",
                    "optimization_direction": "MAXIMIZE",
                    "values": [
                        {"label": "correct", "score": 1},
                        {"label": "incorrect", "score": 0},
                    ],
                }
            ],
            "prompt_version": {
                "model_provider": "OPENAI",
                "model_name": "gpt-4o-mini",
                "template_type": "CHAT",
                "template_format": "MUSTACHE",
                "template": {
                    "type": "chat",
                    "messages": [
                        {"role": "user", "content": [{"type": "text", "text": "Judge {{output}}"}]}
                    ],
                },
                "invocation_parameters": {"type": "openai", "openai": {"temperature": 0}},
                "tools": {
                    "type": "tools",
                    "tools": [
                        {
                            "type": "function",
                            "function": {
                                "name": "correctness",
                                "description": "correctness",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "label": {
                                            "type": "string",
                                            "enum": ["correct", "incorrect"],
                                            "description": "correctness",
                                        }
                                    },
                                    "required": ["label"],
                                },
                            },
                        }
                    ],
                    "tool_choice": {"type": "specific_function", "function_name": "correctness"},
                },
            },
        },
    }


def _graphql(app: _AppInfo, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    response, _ = _gql(app, app.admin_secret, query=query, variables=variables)
    assert not response.get("errors"), response
    result: dict[str, Any] = response["data"]
    return result


def _create_dataset_evaluator(
    client: httpx.Client, dataset_id: str, body: dict[str, Any]
) -> dict[str, Any]:
    response = client.post(f"v1/datasets/{dataset_id}/evaluators", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


def _judge_prompt_version(
    client: httpx.Client, *, label_values: tuple[str, str] = ("correct", "incorrect")
) -> str:
    """Create a judge prompt through the prompts API and return its version's GlobalID."""
    response = client.post(
        "v1/prompts",
        json={
            "prompt": {"name": f"judge-{token_hex(8)}"},
            "version": {
                "model_provider": "OPENAI",
                "model_name": "gpt-4o-mini",
                "template_type": "CHAT",
                "template_format": "MUSTACHE",
                "template": {
                    "type": "chat",
                    "messages": [
                        {"role": "user", "content": [{"type": "text", "text": "Judge {{output}}"}]}
                    ],
                },
                "invocation_parameters": {"type": "openai", "openai": {"temperature": 0}},
                "tools": {
                    "type": "tools",
                    "tools": [
                        {
                            "type": "function",
                            "function": {
                                "name": "correctness",
                                "description": "correctness",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "label": {
                                            "type": "string",
                                            "enum": list(label_values),
                                            "description": "correctness",
                                        }
                                    },
                                    "required": ["label"],
                                },
                            },
                        }
                    ],
                    "tool_choice": {"type": "specific_function", "function_name": "correctness"},
                },
            },
        },
    )
    assert response.status_code == 200, response.text
    version_id: str = response.json()["data"]["id"]
    return version_id


def _correctness_configs(
    labels: tuple[str, str] = ("correct", "incorrect"),
) -> list[dict[str, Any]]:
    return [
        {
            "type": "CATEGORICAL",
            "name": "correctness",
            "optimization_direction": "MAXIMIZE",
            "values": [{"label": labels[0], "score": 1}, {"label": labels[1], "score": 0}],
        }
    ]


def _pin(prompt_version_id: str) -> dict[str, Any]:
    return {"selector": {"type": "version", "prompt_version_id": prompt_version_id}}


def _llm_definition(client: httpx.Client) -> dict[str, Any]:
    """Create a standalone LLM definition that runs a new judge prompt."""
    response = client.post(
        "v1/evaluators",
        json={
            "type": "llm",
            "name": f"llm-{token_hex(8)}",
            "description": "correctness",
            "prompt": _pin(_judge_prompt_version(client)),
            "output_configs": _correctness_configs(),
        },
    )
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


def _code_definition(client: httpx.Client, sandbox_id: str) -> dict[str, Any]:
    """Create a standalone code definition."""
    response = client.post(
        "v1/evaluators",
        json={
            "type": "code",
            "name": f"code-{token_hex(8)}",
            "description": "shared description",
            "source_code": "def evaluate(output):\n    return {'score': 1.0}",
            "language": "PYTHON",
            "sandbox_config_id": sandbox_id,
            "input_mapping": _mapping("shared value"),
            "output_configs": [
                {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}
            ],
        },
    )
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


def _binding_body(evaluator_id: str, **fields: Any) -> dict[str, Any]:
    return {
        "name": f"binding-{token_hex(8)}",
        "evaluator_id": evaluator_id,
        "input_mapping": _mapping("dataset value"),
        **fields,
    }
