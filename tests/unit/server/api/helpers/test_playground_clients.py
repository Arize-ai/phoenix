import pytest
from unittest.mock import AsyncMock, MagicMock

from phoenix.server.api.helpers.playground_clients import (
    AzureOpenAIStreamingClient,
    AzureOpenAIReasoningStreamingClient,
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


def test_azure_openai_reasoning_supported_parameters():
    """Test that Azure OpenAI reasoning client supports the correct parameters."""
    params = AzureOpenAIReasoningStreamingClient.supported_invocation_parameters()

    # Check that reasoning-specific parameters are included
    param_names = [param.invocation_name for param in params]
    assert "reasoning_effort" in param_names
    assert "max_completion_tokens" in param_names
    assert "seed" in param_names
    assert "tool_choice" in param_names
    assert "response_format" in param_names

    # Check that regular streaming parameters are NOT included
    assert "temperature" not in param_names
    assert "max_tokens" not in param_names
    assert "frequency_penalty" not in param_names
    assert "presence_penalty" not in param_names
    assert "top_p" not in param_names


@pytest.mark.asyncio
async def test_azure_openai_reasoning_client_uses_non_streaming():
    """Test that Azure OpenAI reasoning client uses non-streaming mode."""
    # Mock the client and model
    mock_client = AsyncMock()
    mock_model = GenerativeModelInput(
        name="o3-mini",
        provider_key="AZURE_OPENAI",
        endpoint="https://test.openai.azure.com",
        api_version="2024-02-15-preview",
    )

    # Create the client
    client = AzureOpenAIReasoningStreamingClient(model=mock_model)
    client.client = mock_client
    client.rate_limiter = MagicMock()

    # Mock the response
    mock_response = MagicMock()
    mock_response.usage = None
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content="Test response",
                tool_calls=None,
            )
        )
    ]

    # Mock the throttled_create method
    mock_throttled_create = AsyncMock(return_value=mock_response)
    client.rate_limiter._alimit.return_value = mock_throttled_create

    # Test the method
    messages = [(ChatCompletionMessageRole.USER, "Hello", None, None)]
    tools = []

    chunks = []
    async for chunk in client.chat_completion_create(
        messages=messages,
        tools=tools,
        max_completion_tokens=100,
        reasoning_effort="medium",
    ):
        chunks.append(chunk)

    # Verify that the create method was called with stream=False
    mock_throttled_create.assert_called_once()
    call_args = mock_throttled_create.call_args
    assert call_args[1]["stream"] is False
    assert call_args[1]["max_completion_tokens"] == 100
    assert call_args[1]["reasoning_effort"] == "medium"

    # Verify that we got a text chunk
    assert len(chunks) == 1
    assert chunks[0].content == "Test response"


def test_azure_openai_reasoning_client_system_message_transform():
    """Test that Azure OpenAI reasoning client transforms system messages to developer messages."""
    # Mock the client and model
    mock_model = GenerativeModelInput(
        name="o3-mini",
        provider_key="AZURE_OPENAI",
        endpoint="https://test.openai.azure.com",
        api_version="2024-02-15-preview",
    )

    # Create the client
    client = AzureOpenAIReasoningStreamingClient(model=mock_model)

    # Test system message transformation
    result = client.to_openai_chat_completion_param(
        ChatCompletionMessageRole.SYSTEM,
        "You are a helpful assistant",
        None,
        None,
    )

    assert result["role"] == "developer"
    assert result["content"] == "You are a helpful assistant"


def test_azure_openai_reasoning_client_user_message():
    """Test that Azure OpenAI reasoning client handles user messages correctly."""
    # Mock the client and model
    mock_model = GenerativeModelInput(
        name="o3-mini",
        provider_key="AZURE_OPENAI",
        endpoint="https://test.openai.azure.com",
        api_version="2024-02-15-preview",
    )

    # Create the client
    client = AzureOpenAIReasoningStreamingClient(model=mock_model)

    # Test user message
    result = client.to_openai_chat_completion_param(
        ChatCompletionMessageRole.USER,
        "Hello, how are you?",
        None,
        None,
    )

    assert result["role"] == "user"
    assert result["content"] == "Hello, how are you?"