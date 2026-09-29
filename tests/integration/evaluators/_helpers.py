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


def _dataset_code_body(sandbox_id: str) -> dict[str, Any]:
    return {
        "name": f"dataset-code-{token_hex(8)}",
        "input_mapping": _mapping("dataset value"),
        "evaluator": {
            "type": "code",
            "source_code": "def evaluate(output):\n    return {'score': 1.0}",
            "language": "PYTHON",
            "sandbox_config_id": sandbox_id,
            "description": "shared description",
            "input_mapping": _mapping("shared value"),
            "output_configs": [
                {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}
            ],
        },
    }


def _create_dataset_evaluator(
    client: httpx.Client, dataset_id: str, body: dict[str, Any]
) -> dict[str, Any]:
    response = client.post(f"v1/datasets/{dataset_id}/evaluators", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    return data
