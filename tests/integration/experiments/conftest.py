"""Fixtures for playground experiment integration tests."""

from __future__ import annotations

from collections.abc import AsyncIterator
from secrets import token_hex
from typing import Any, Iterator, Mapping, NamedTuple, cast

import httpx
import pytest
import pytest_asyncio

from tests.integration._helpers import _AppInfo, _server
from tests.integration._mock_llm_server import _MockLLMServer

# =============================================================================
# GraphQL Queries/Mutations
# =============================================================================

CREATE_CUSTOM_PROVIDER = """
mutation CreateCustomProvider($input: CreateGenerativeModelCustomProviderMutationInput!) {
    createGenerativeModelCustomProvider(input: $input) {
        provider {
            id
            name
        }
    }
}
"""

CREATE_DATASET = """
mutation CreateDataset($input: CreateDatasetInput!) {
    createDataset(input: $input) {
        dataset {
            id
            name
        }
    }
}
"""

ADD_EXAMPLES_TO_DATASET = """
mutation AddExamplesToDataset($input: AddExamplesToDatasetInput!) {
    addExamplesToDataset(input: $input) {
        dataset {
            id
            exampleCount
        }
    }
}
"""

CREATE_DATASET_LLM_EVALUATOR = """
mutation CreateDatasetLlmEvaluator($input: CreateDatasetLLMEvaluatorInput!) {
    createDatasetLlmEvaluator(input: $input) {
        evaluator {
            id
            name
        }
    }
}
"""

DELETE_DATASET = """
mutation DeleteDataset($input: DeleteDatasetInput!) {
    deleteDataset(input: $input) {
        dataset {
            id
        }
    }
}
"""

DELETE_CUSTOM_PROVIDER = """
mutation DeleteCustomProvider($input: DeleteGenerativeModelCustomProviderMutationInput!) {
    deleteGenerativeModelCustomProvider(input: $input) {
        id
    }
}
"""

DELETE_DATASET_EVALUATORS = """
mutation DeleteDatasetEvaluators($input: DeleteDatasetEvaluatorsInput!) {
    deleteDatasetEvaluators(input: $input) {
        datasetEvaluatorIds
    }
}
"""


# =============================================================================
# Helper Functions
# =============================================================================


async def _gql(
    client: httpx.AsyncClient,
    query: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute a GraphQL query/mutation."""
    response = await client.post(
        "/graphql",
        json={"query": query, "variables": variables or {}},
    )
    response.raise_for_status()
    data: dict[str, Any] = response.json()
    if errors := data.get("errors"):
        raise AssertionError(f"GraphQL errors: {errors}")
    return cast(dict[str, Any], data["data"])


# =============================================================================
# Data Classes
# =============================================================================


class CustomProviders(NamedTuple):
    """Container for custom provider IDs."""

    openai: str
    anthropic: str
    google_genai: str
    bedrock: str


class DatasetEvaluators(NamedTuple):
    """Container for dataset evaluator IDs."""

    openai: str
    anthropic: str
    google_genai: str
    bedrock: str


# =============================================================================
# Basic Fixtures
# =============================================================================


@pytest.fixture(scope="package")
def _env(
    _env_ports: Mapping[str, str],
    _env_database: Mapping[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_ports,
        **_env_database,
    }


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


@pytest.fixture(scope="package")
def _mock_llm_server(_ports: Iterator[int]) -> Iterator[_MockLLMServer]:
    """Start a mock LLM server for testing."""
    port = next(_ports)
    with _MockLLMServer(port=port) as server:
        yield server


# =============================================================================
# Custom Provider Fixtures
# =============================================================================


@pytest_asyncio.fixture(scope="function")
async def _custom_providers(
    _app: _AppInfo,
    _mock_llm_server: _MockLLMServer,
) -> AsyncIterator[CustomProviders]:
    """Create custom providers for all supported LLM providers."""
    suffix = token_hex(8)
    providers: CustomProviders | None = None

    async with httpx.AsyncClient(base_url=_app.base_url) as client:
        # Create OpenAI provider
        openai_data = await _gql(
            client,
            CREATE_CUSTOM_PROVIDER,
            {
                "input": {
                    "name": f"Test OpenAI Provider {suffix}",
                    "description": "OpenAI provider pointing to mock server",
                    "provider": "openai",
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": "test-api-key"},
                            "openaiClientKwargs": {"baseUrl": f"{_mock_llm_server.url}/v1"},
                        }
                    },
                }
            },
        )
        openai_id = str(openai_data["createGenerativeModelCustomProvider"]["provider"]["id"])

        # Create Anthropic provider
        anthropic_data = await _gql(
            client,
            CREATE_CUSTOM_PROVIDER,
            {
                "input": {
                    "name": f"Test Anthropic Provider {suffix}",
                    "description": "Anthropic provider pointing to mock server",
                    "provider": "anthropic",
                    "clientConfig": {
                        "anthropic": {
                            "anthropicAuthenticationMethod": {"apiKey": "test-api-key"},
                            "anthropicClientKwargs": {"baseUrl": _mock_llm_server.url},
                        }
                    },
                }
            },
        )
        anthropic_id = str(anthropic_data["createGenerativeModelCustomProvider"]["provider"]["id"])

        # Create Google GenAI provider
        google_data = await _gql(
            client,
            CREATE_CUSTOM_PROVIDER,
            {
                "input": {
                    "name": f"Test Google GenAI Provider {suffix}",
                    "description": "Google GenAI provider pointing to mock server",
                    "provider": "google",
                    "clientConfig": {
                        "googleGenai": {
                            "googleGenaiAuthenticationMethod": {"apiKey": "test-api-key"},
                            "googleGenaiClientKwargs": {
                                "httpOptions": {"baseUrl": _mock_llm_server.url}
                            },
                        }
                    },
                }
            },
        )
        google_id = str(google_data["createGenerativeModelCustomProvider"]["provider"]["id"])

        # Create Bedrock provider
        bedrock_data = await _gql(
            client,
            CREATE_CUSTOM_PROVIDER,
            {
                "input": {
                    "name": f"Test Bedrock Provider {suffix}",
                    "description": "AWS Bedrock provider pointing to mock server",
                    "provider": "aws",
                    "clientConfig": {
                        "awsBedrock": {
                            "awsBedrockAuthenticationMethod": {
                                "accessKeys": {
                                    "awsAccessKeyId": "test-access-key",
                                    "awsSecretAccessKey": "test-secret-key",
                                }
                            },
                            "awsBedrockClientKwargs": {
                                "regionName": "us-east-1",
                                "endpointUrl": _mock_llm_server.url,
                            },
                        }
                    },
                }
            },
        )
        bedrock_id = str(bedrock_data["createGenerativeModelCustomProvider"]["provider"]["id"])

        providers = CustomProviders(
            openai=openai_id,
            anthropic=anthropic_id,
            google_genai=google_id,
            bedrock=bedrock_id,
        )

        yield providers

        # Cleanup: delete all custom providers
        for provider_id in [openai_id, anthropic_id, google_id, bedrock_id]:
            await _gql(
                client,
                DELETE_CUSTOM_PROVIDER,
                {"input": {"id": provider_id}},
            )


# =============================================================================
# Dataset Fixture
# =============================================================================


@pytest_asyncio.fixture(scope="function")
async def _dataset_id(
    _app: _AppInfo,
) -> AsyncIterator[str]:
    """Create a dataset with 2 examples for testing."""
    suffix = token_hex(8)

    async with httpx.AsyncClient(base_url=_app.base_url) as client:
        # Create dataset
        data = await _gql(
            client,
            CREATE_DATASET,
            {
                "input": {
                    "name": f"Playground Test Dataset {suffix}",
                    "description": "Dataset with 2 examples",
                }
            },
        )
        ds_id = str(data["createDataset"]["dataset"]["id"])

        # Add examples
        examples = [
            {
                "input": {"question": f"What is {i} + {i}?"},
                "output": {"answer": str(i * 2)},
                "metadata": {"index": i},
            }
            for i in range(1, 3)
        ]
        await _gql(
            client,
            ADD_EXAMPLES_TO_DATASET,
            {"input": {"datasetId": ds_id, "examples": examples}},
        )

        yield ds_id

        # Cleanup: delete dataset
        await _gql(
            client,
            DELETE_DATASET,
            {"input": {"datasetId": ds_id}},
        )


# =============================================================================
# Dataset Evaluator Fixtures
# =============================================================================


def _openai_tool(output_name: str) -> dict[str, Any]:
    """OpenAI tool definition format."""
    return {
        "type": "function",
        "function": {
            "name": output_name,
            "description": "Evaluate the correctness of the output",
            "parameters": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "enum": ["correct", "incorrect"],
                        "description": output_name,
                    },
                    "explanation": {
                        "type": "string",
                        "description": "Explanation for the evaluation result",
                    },
                },
                "required": ["label", "explanation"],
            },
        },
    }


def _anthropic_tool(output_name: str) -> dict[str, Any]:
    """Anthropic tool definition format."""
    return {
        "name": output_name,
        "description": "Evaluate the correctness of the output",
        "input_schema": {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": output_name,
                },
                "explanation": {
                    "type": "string",
                    "description": "Explanation for the evaluation result",
                },
            },
            "required": ["label", "explanation"],
        },
    }


def _bedrock_tool(output_name: str) -> dict[str, Any]:
    """AWS Bedrock tool definition format."""
    return {
        "toolSpec": {
            "name": output_name,
            "description": "Evaluate the correctness of the output",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "label": {
                            "type": "string",
                            "enum": ["correct", "incorrect"],
                            "description": output_name,
                        },
                        "explanation": {
                            "type": "string",
                            "description": "Explanation for the evaluation result",
                        },
                    },
                    "required": ["label", "explanation"],
                }
            },
        }
    }


def _google_tool(output_name: str) -> dict[str, Any]:
    """Google Gemini tool definition format."""
    return {
        "name": output_name,
        "description": "Evaluate the correctness of the output",
        "parameters": {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "enum": ["correct", "incorrect"],
                    "description": output_name,
                },
                "explanation": {
                    "type": "string",
                    "description": "Explanation for the evaluation result",
                },
            },
            "required": ["label", "explanation"],
        },
    }


def _openai_tool_choice(output_name: str) -> dict[str, Any]:
    """OpenAI tool_choice format."""
    return {"type": "function", "function": {"name": output_name}}


def _anthropic_tool_choice(output_name: str) -> dict[str, Any]:
    """Anthropic tool_choice format."""
    return {"type": "tool", "name": output_name}


def _bedrock_tool_choice(output_name: str) -> dict[str, Any]:
    """AWS Bedrock tool_choice format (Anthropic-style)."""
    return {"type": "tool", "name": output_name}


def _google_tool_choice(output_name: str) -> dict[str, Any]:
    """Google Gemini tool_choice format (function_calling_config)."""
    return {
        "function_calling_config": {
            "mode": "any",
            "allowed_function_names": [output_name],
        }
    }


def _openai_invocation_params(output_name: str) -> dict[str, Any]:
    """OpenAI invocation parameters."""
    return {"tool_choice": _openai_tool_choice(output_name)}


def _anthropic_invocation_params(output_name: str) -> dict[str, Any]:
    """Anthropic invocation parameters (max_tokens is required)."""
    return {
        "max_tokens": 1024,
        "tool_choice": _anthropic_tool_choice(output_name),
    }


def _bedrock_invocation_params(output_name: str) -> dict[str, Any]:
    """AWS Bedrock invocation parameters."""
    return {"tool_choice": _bedrock_tool_choice(output_name)}


def _google_invocation_params(output_name: str) -> dict[str, Any]:
    """Google Gemini invocation parameters."""
    return {"tool_choice": _google_tool_choice(output_name)}


def _evaluator_prompt_version(
    model_provider: str,
    model_name: str,
    output_name: str,
    custom_provider_id: str | None = None,
) -> dict[str, Any]:
    """Create a prompt version input for an evaluator.

    Tool definitions, tool_choice, and invocation parameters are provider-specific.
    """
    # Select provider-specific tool and invocation parameters
    if model_provider == "OPENAI":
        tool = _openai_tool(output_name)
        invocation_params = _openai_invocation_params(output_name)
    elif model_provider == "ANTHROPIC":
        tool = _anthropic_tool(output_name)
        invocation_params = _anthropic_invocation_params(output_name)
    elif model_provider == "AWS":
        tool = _bedrock_tool(output_name)
        invocation_params = _bedrock_invocation_params(output_name)
    elif model_provider == "GOOGLE":
        tool = _google_tool(output_name)
        invocation_params = _google_invocation_params(output_name)
    else:
        raise ValueError(f"Unsupported model provider: {model_provider}")

    return {
        "templateFormat": "MUSTACHE",
        "template": {
            "messages": [
                {
                    "role": "SYSTEM",
                    "content": [
                        {
                            "text": {
                                "text": (
                                    "You are an evaluator that assesses the correctness of outputs. "
                                    "Use the provided tool to return your evaluation result."
                                )
                            }
                        }
                    ],
                },
                {
                    "role": "USER",
                    "content": [
                        {
                            "text": {
                                "text": (
                                    "Evaluate the following:\n"
                                    "Input: {{input}}\n"
                                    "Output: {{output}}\n"
                                    "Reference: {{reference}}\n\n"
                                    "Is the output correct?"
                                )
                            }
                        }
                    ],
                },
            ]
        },
        "invocationParameters": invocation_params,
        "tools": [{"definition": tool}],
        "modelProvider": model_provider,
        "modelName": model_name,
        **({"customProviderId": custom_provider_id} if custom_provider_id else {}),
    }


def _evaluator_output_config(name: str) -> dict[str, Any]:
    """Create an output config for an evaluator."""
    return {
        "name": name,
        "description": "Evaluate the correctness of the output",
        "optimizationDirection": "MAXIMIZE",
        "values": [
            {"label": "correct", "score": 1.0},
            {"label": "incorrect", "score": 0.0},
        ],
    }


@pytest_asyncio.fixture(scope="function")
async def _dataset_evaluators(
    _app: _AppInfo,
    _dataset_id: str,
    _custom_providers: CustomProviders,
) -> AsyncIterator[DatasetEvaluators]:
    """Create dataset evaluators for all supported LLM providers."""
    suffix = token_hex(8)

    async with httpx.AsyncClient(base_url=_app.base_url) as client:
        # Create OpenAI evaluator
        openai_output_name = f"openai_eval_{suffix}"
        openai_data = await _gql(
            client,
            CREATE_DATASET_LLM_EVALUATOR,
            {
                "input": {
                    "datasetId": _dataset_id,
                    "name": f"openai_evaluator_{suffix}",
                    "description": "Evaluate the correctness of the output",
                    "promptVersion": _evaluator_prompt_version(
                        model_provider="OPENAI",
                        model_name="gpt-4o-mini",
                        output_name=openai_output_name,
                        custom_provider_id=_custom_providers.openai,
                    ),
                    "outputConfigs": [
                        {"categorical": _evaluator_output_config(openai_output_name)}
                    ],
                }
            },
        )
        openai_id = str(openai_data["createDatasetLlmEvaluator"]["evaluator"]["id"])

        # Create Anthropic evaluator
        anthropic_output_name = f"anthropic_eval_{suffix}"
        anthropic_data = await _gql(
            client,
            CREATE_DATASET_LLM_EVALUATOR,
            {
                "input": {
                    "datasetId": _dataset_id,
                    "name": f"anthropic_evaluator_{suffix}",
                    "description": "Evaluate the correctness of the output",
                    "promptVersion": _evaluator_prompt_version(
                        model_provider="ANTHROPIC",
                        model_name="claude-3-5-sonnet-latest",
                        output_name=anthropic_output_name,
                        custom_provider_id=_custom_providers.anthropic,
                    ),
                    "outputConfigs": [
                        {"categorical": _evaluator_output_config(anthropic_output_name)}
                    ],
                }
            },
        )
        anthropic_id = str(anthropic_data["createDatasetLlmEvaluator"]["evaluator"]["id"])

        # Create Google GenAI evaluator
        google_output_name = f"google_eval_{suffix}"
        google_data = await _gql(
            client,
            CREATE_DATASET_LLM_EVALUATOR,
            {
                "input": {
                    "datasetId": _dataset_id,
                    "name": f"google_evaluator_{suffix}",
                    "description": "Evaluate the correctness of the output",
                    "promptVersion": _evaluator_prompt_version(
                        model_provider="GOOGLE",
                        model_name="gemini-2.0-flash",
                        output_name=google_output_name,
                        custom_provider_id=_custom_providers.google_genai,
                    ),
                    "outputConfigs": [
                        {"categorical": _evaluator_output_config(google_output_name)}
                    ],
                }
            },
        )
        google_id = str(google_data["createDatasetLlmEvaluator"]["evaluator"]["id"])

        # Create Bedrock evaluator
        bedrock_output_name = f"bedrock_eval_{suffix}"
        bedrock_data = await _gql(
            client,
            CREATE_DATASET_LLM_EVALUATOR,
            {
                "input": {
                    "datasetId": _dataset_id,
                    "name": f"bedrock_evaluator_{suffix}",
                    "description": "Evaluate the correctness of the output",
                    "promptVersion": _evaluator_prompt_version(
                        model_provider="AWS",
                        model_name="anthropic.claude-3-haiku-20240307-v1:0",
                        output_name=bedrock_output_name,
                        custom_provider_id=_custom_providers.bedrock,
                    ),
                    "outputConfigs": [
                        {"categorical": _evaluator_output_config(bedrock_output_name)}
                    ],
                }
            },
        )
        bedrock_id = str(bedrock_data["createDatasetLlmEvaluator"]["evaluator"]["id"])

        evaluators = DatasetEvaluators(
            openai=openai_id,
            anthropic=anthropic_id,
            google_genai=google_id,
            bedrock=bedrock_id,
        )

        yield evaluators

        # Cleanup: delete all evaluators
        await _gql(
            client,
            DELETE_DATASET_EVALUATORS,
            {
                "input": {
                    "datasetEvaluatorIds": [openai_id, anthropic_id, google_id, bedrock_id],
                    "deleteAssociatedPrompt": True,
                }
            },
        )
