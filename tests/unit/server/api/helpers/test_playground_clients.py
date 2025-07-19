import pytest
from unittest.mock import AsyncMock, MagicMock

from phoenix.server.api.helpers.playground_clients import (
    AzureOpenAIStreamingClient,
    _get_azure_token_param_name,
)
from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


def test_get_azure_token_param_name():
    """Test that the correct parameter name is returned for different model types."""
    # o1 models should use max_completion_tokens
    assert _get_azure_token_param_name("o1") == "max_completion_tokens"
    assert _get_azure_token_param_name("o1-mini") == "max_completion_tokens"
    assert _get_azure_token_param_name("o1-pro") == "max_completion_tokens"

    # o3 models should use max_completion_tokens
    assert _get_azure_token_param_name("o3") == "max_completion_tokens"
    assert _get_azure_token_param_name("o3-mini") == "max_completion_tokens"
    assert _get_azure_token_param_name("o3-pro") == "max_completion_tokens"

    # Other models should use max_tokens
    assert _get_azure_token_param_name("gpt-4") == "max_tokens"
    assert _get_azure_token_param_name("gpt-4o") == "max_tokens"
    assert _get_azure_token_param_name("gpt-3.5-turbo") == "max_tokens"


@pytest.mark.asyncio
async def test_azure_openai_o3_model_parameter_transformation():
    """Test that o3 models correctly transform max_tokens to max_completion_tokens."""
    # Mock the client and model
    mock_client = AsyncMock()
    mock_model = GenerativeModelInput(
        name="o3-mini",
        provider_key="AZURE_OPENAI",
        endpoint="https://test.openai.azure.com",
        api_version="2024-02-15-preview",
    )

    # Create the client
    client = AzureOpenAIStreamingClient(model=mock_model)
    client.client = mock_client

    # Mock the parent method to capture the parameters
    original_method = client.__class__.__bases__[0].chat_completion_create
    captured_params = {}

    async def mock_parent_method(messages, tools, **kwargs):
        captured_params.update(kwargs)
        return []

    client.__class__.__bases__[0].chat_completion_create = mock_parent_method

    # Test with max_tokens parameter
    messages = [(ChatCompletionMessageRole.USER, "Hello", None, None)]
    tools = []

    await client.chat_completion_create(
        messages=messages,
        tools=tools,
        max_tokens=100,
        temperature=0.7,
    )

    # Verify that max_tokens was transformed to max_completion_tokens
    assert "max_completion_tokens" in captured_params
    assert captured_params["max_completion_tokens"] == 100
    assert "max_tokens" not in captured_params
    assert captured_params["temperature"] == 0.7


@pytest.mark.asyncio
async def test_azure_openai_regular_model_parameter_transformation():
    """Test that regular models keep max_tokens as max_tokens."""
    # Mock the client and model
    mock_client = AsyncMock()
    mock_model = GenerativeModelInput(
        name="gpt-4",
        provider_key="AZURE_OPENAI",
        endpoint="https://test.openai.azure.com",
        api_version="2024-02-15-preview",
    )

    # Create the client
    client = AzureOpenAIStreamingClient(model=mock_model)
    client.client = mock_client

    # Mock the parent method to capture the parameters
    original_method = client.__class__.__bases__[0].chat_completion_create
    captured_params = {}

    async def mock_parent_method(messages, tools, **kwargs):
        captured_params.update(kwargs)
        return []

    client.__class__.__bases__[0].chat_completion_create = mock_parent_method

    # Test with max_tokens parameter
    messages = [(ChatCompletionMessageRole.USER, "Hello", None, None)]
    tools = []

    await client.chat_completion_create(
        messages=messages,
        tools=tools,
        max_tokens=100,
        temperature=0.7,
    )

    # Verify that max_tokens was not transformed
    assert "max_tokens" in captured_params
    assert captured_params["max_tokens"] == 100
    assert "max_completion_tokens" not in captured_params
    assert captured_params["temperature"] == 0.7


def test_azure_openai_supported_parameters():
    """Test that Azure OpenAI client supports the correct parameters."""
    params = AzureOpenAIStreamingClient.supported_invocation_parameters()

    # Check that max_tokens is included (it will be transformed later)
    param_names = [param.invocation_name for param in params]
    assert "max_tokens" in param_names

    # Check that other parameters are also included
    assert "temperature" in param_names
    assert "top_p" in param_names
    assert "frequency_penalty" in param_names
    assert "presence_penalty" in param_names