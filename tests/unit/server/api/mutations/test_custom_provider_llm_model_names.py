"""A custom provider's suggested LLM model names replace its SDK's built-in list.

An empty list falls back to the built-in models, so existing providers are unchanged.
"""

from typing import Any

import pytest

from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from tests.unit.graphql import AsyncGraphQLClient

CREATE = """
mutation ($input: CreateGenerativeModelCustomProviderMutationInput!) {
  createGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

PATCH = """
mutation ($input: PatchGenerativeModelCustomProviderMutationInput!) {
  patchGenerativeModelCustomProvider(input: $input) { provider { id } }
}
"""

PROVIDER = """
query ($id: ID!) {
  node(id: $id) {
    ... on GenerativeModelCustomProvider {
      llm: modelNames(modelType: LLM)
      config {
        ... on OpenAICustomProviderConfig { modelNames }
        ... on AzureOpenAICustomProviderConfig { modelNames }
        ... on AnthropicCustomProviderConfig { modelNames }
        ... on AWSBedrockCustomProviderConfig { modelNames }
        ... on GoogleGenAICustomProviderConfig { modelNames }
      }
    }
  }
}
"""

CONFIGS: dict[str, tuple[GenerativeProviderKey, dict[str, Any]]] = {
    "openai": (
        GenerativeProviderKey.OPENAI,
        {"openaiAuthenticationMethod": {"apiKey": "sk-test"}},
    ),
    "azureOpenai": (
        GenerativeProviderKey.AZURE_OPENAI,
        {
            "azureOpenaiAuthenticationMethod": {"apiKey": "sk-test"},
            "azureOpenaiClientKwargs": {"azureEndpoint": "https://example.openai.azure.com"},
        },
    ),
    "anthropic": (
        GenerativeProviderKey.ANTHROPIC,
        {"anthropicAuthenticationMethod": {"apiKey": "sk-test"}},
    ),
    "awsBedrock": (
        GenerativeProviderKey.AWS,
        {
            "awsBedrockAuthenticationMethod": {"defaultCredentials": True},
            "awsBedrockClientKwargs": {"regionName": "us-east-1"},
        },
    ),
    "googleGenai": (
        GenerativeProviderKey.GOOGLE,
        {"googleGenaiAuthenticationMethod": {"apiKey": "sk-test"}},
    ),
}


async def create(gql_client: AsyncGraphQLClient, name: str, config: dict[str, Any]) -> str:
    result = await gql_client.execute(
        CREATE, variables={"input": {"name": name, "provider": "proxy", "clientConfig": config}}
    )
    assert result.data and not result.errors, result.errors
    return str(result.data["createGenerativeModelCustomProvider"]["provider"]["id"])


async def model_names(gql_client: AsyncGraphQLClient, provider_id: str) -> dict[str, Any]:
    result = await gql_client.execute(PROVIDER, variables={"id": provider_id})
    assert result.data and not result.errors, result.errors
    node: dict[str, Any] = result.data["node"]
    return {"llm": node["llm"], "configured": node["config"]["modelNames"]}


@pytest.mark.parametrize("sdk", list(CONFIGS))
async def test_suggested_names_replace_the_built_in_list(
    gql_client: AsyncGraphQLClient, sdk: str
) -> None:
    _, config = CONFIGS[sdk]
    provider_id = await create(
        gql_client,
        f"{sdk} gateway",
        {sdk: {**config, "modelNames": ["qwen3-coder", " ", "llama-5-70b", "qwen3-coder"]}},
    )
    assert await model_names(gql_client, provider_id) == {
        "llm": ["qwen3-coder", "llama-5-70b"],
        "configured": ["qwen3-coder", "llama-5-70b"],
    }


@pytest.mark.parametrize("sdk", list(CONFIGS))
async def test_no_suggested_names_lists_the_built_in_models(
    gql_client: AsyncGraphQLClient, sdk: str
) -> None:
    provider_key, config = CONFIGS[sdk]
    provider_id = await create(gql_client, f"{sdk} plain", {sdk: config})
    names = await model_names(gql_client, provider_id)
    assert names["configured"] == []
    assert names["llm"] == PLAYGROUND_CLIENT_REGISTRY.list_models(provider_key)
    assert names["llm"]


async def test_clearing_the_names_restores_the_built_in_list(
    gql_client: AsyncGraphQLClient,
) -> None:
    _, config = CONFIGS["openai"]
    provider_id = await create(
        gql_client, "vLLM box", {"openai": {**config, "modelNames": ["qwen3-coder"]}}
    )
    assert (await model_names(gql_client, provider_id))["llm"] == ["qwen3-coder"]

    result = await gql_client.execute(
        PATCH, variables={"input": {"id": provider_id, "clientConfig": {"openai": config}}}
    )
    assert result.data and not result.errors, result.errors
    assert (await model_names(gql_client, provider_id))["llm"] == (
        PLAYGROUND_CLIENT_REGISTRY.list_models(GenerativeProviderKey.OPENAI)
    )
